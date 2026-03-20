/**
 * Update Service - Software deployment orchestration
 */

const os = require('os')
const crypto = require('crypto')
const fs = require('fs')
const fsPromises = require('fs/promises')
const path = require('path')
const { pipeline } = require('stream/promises')
const LocalSource = require('./updateSources/localSource')

let ftpService = require('./ftpService')
let updateSettingsService = require('./updateSettingsService')
let createUpdateSource = require('./updateSources').createUpdateSource
let controlService = require('./controlService')
const { runConcurrently } = require('../../shared/utils/concurrencyPool')
const { createLogger } = require('../../shared/logger')
const log = createLogger('clients')

/** Infer copy type from sourcePath: trailing '/' means directory */
function isDirectoryTask(task) {
  return task.sourcePath.endsWith('/')
}

/** Normalize targetPath: strip leading '/' (FTP root prepends it) */
function normalizeTarget(targetPath) {
  return targetPath.replace(/^\/+/, '')
}

/** @internal Replace dependencies for testing */
function _setDeps(deps) {
  if (deps.ftpService) ftpService = deps.ftpService
  if (deps.updateSettingsService) updateSettingsService = deps.updateSettingsService
  if (deps.createUpdateSource) createUpdateSource = deps.createUpdateSource
  if (deps.controlService) controlService = deps.controlService
}

/**
 * Download source files to a local temp cache directory.
 * Returns the temp directory path. Caller must clean up.
 */
async function cacheSourceFiles(source, tasks) {
  const tempDir = path.join(os.tmpdir(), 'update-deploy-' + crypto.randomUUID())
  await fsPromises.mkdir(tempDir, { recursive: true })

  for (const task of tasks) {
    if (task.type === 'exec') continue
    if (isDirectoryTask(task)) {
      const files = await source.listFilesRecursive(task.sourcePath)
      for (const file of files) {
        const localPath = path.join(tempDir, file.relativePath)
        await fsPromises.mkdir(path.dirname(localPath), { recursive: true })
        const stream = await source.getFileStream(file.relativePath)
        await pipeline(stream, fs.createWriteStream(localPath))
      }
    } else {
      const localPath = path.join(tempDir, task.sourcePath)
      await fsPromises.mkdir(path.dirname(localPath), { recursive: true })
      const stream = await source.getFileStream(task.sourcePath)
      await pipeline(stream, fs.createWriteStream(localPath))
    }
  }

  return tempDir
}

/**
 * Deploy update tasks to multiple clients with SSE progress
 * @param {string} agentGroup
 * @param {string} profileId - Profile ID to deploy from
 * @param {string[]} taskIds - Selected task IDs to deploy
 * @param {string[]} targetEqpIds - Target client equipment IDs
 * @param {function} onProgress - SSE progress callback
 * @param {number} concurrency - Max concurrent deployments (default 3)
 */
async function deployUpdate(agentGroup, profileId, taskIds, targetEqpIds, onProgress, concurrency = 3) {
  // 1. Load profile
  const profile = await updateSettingsService.getProfile(agentGroup, profileId)
  if (!profile) throw new Error(`Profile not found: ${profileId}`)

  // 2. Filter selected tasks
  const selectedTasks = (profile.tasks || []).filter(t => taskIds.includes(t.taskId))
  if (selectedTasks.length === 0) throw new Error('No matching tasks found')

  // 2.5. exec 태스크에 상대경로가 있으면 basePath 일괄 사전 감지
  const hasRelativeExec = selectedTasks.some(t =>
    t.type === 'exec' && (t.commandLine.startsWith('./') || t.commandLine.startsWith('.\\')))
  if (hasRelativeExec) {
    await controlService.ensureBasePaths(targetEqpIds)
  }

  // 3. Cache source files to temp directory (download once)
  const source = createUpdateSource(profile.source)
  let tempDir
  try {
    tempDir = await cacheSourceFiles(source, selectedTasks)
  } finally {
    await source.close()
  }

  // 4. Deploy from local cache (LocalSource supports concurrent reads safely)
  const cacheSource = new LocalSource(tempDir)

  try {
    const total = targetEqpIds.length * selectedTasks.length
    let completed = 0
    let successCount = 0
    let failCount = 0

    // 5. eqpId별 순차 실행, eqpId 간 병렬
    const eqpJobs = targetEqpIds.map(eqpId => ({ eqpId }))

    await runConcurrently(eqpJobs, async ({ eqpId }) => {
      let stopped = false
      for (const task of selectedTasks) {
        if (stopped) {
          completed++
          if (onProgress) {
            onProgress({ eqpId, taskId: task.taskId, status: 'skipped', completed, total })
          }
          continue
        }
        try {
          await deployTaskToClient(eqpId, agentGroup, task, cacheSource)
          completed++
          successCount++
          if (onProgress) {
            onProgress({ eqpId, taskId: task.taskId, status: 'success', completed, total })
          }
        } catch (err) {
          log.warn(`deployUpdate: task ${task.taskId} failed for ${eqpId}: ${err.message}`)
          completed++
          failCount++
          if (onProgress) {
            onProgress({ eqpId, taskId: task.taskId, status: 'error', error: err.message, completed, total })
          }
          if (task.stopOnFail) stopped = true
        }
      }
    }, concurrency)

    return { total, success: successCount, failed: failCount }
  } finally {
    // 6. Clean up temp cache (always)
    await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Deploy a single task to a single client
 *
 * FTP path = targetPath directly (NOT basePath + targetPath).
 * Reason: FTP server is chrooted to the agent's base directory (EEG_BASE),
 * which is the same as basePath. So targetPath is already relative to FTP root.
 *
 * sourcePath/targetPath separation:
 *   file:      source.getFileStream(sourcePath) → FTP upload to /targetPath
 *   directory: source.listFilesRecursive(sourcePath) → strip sourcePath prefix,
 *              prepend targetPath for each file
 */
async function deployTaskToClient(eqpId, agentGroup, taskDef, source) {
  if (taskDef.type === 'exec') {
    const commandLine = await controlService.resolveCommandPath(eqpId, taskDef.commandLine)
    const result = await controlService.executeRaw(
      eqpId, commandLine, taskDef.args || [], taskDef.timeout || 30000
    )
    if (!result.success) {
      throw new Error(result.error || 'Command execution failed')
    }
    return
  }
  if (isDirectoryTask(taskDef)) {
    const files = await source.listFilesRecursive(taskDef.sourcePath)
    if (files.length === 0) throw new Error(`No files found in source: ${taskDef.sourcePath}`)

    let uploaded = 0
    for (const file of files) {
      // Strip sourcePath prefix from relativePath, prepend targetPath
      const suffix = file.relativePath.startsWith(taskDef.sourcePath)
        ? file.relativePath.slice(taskDef.sourcePath.length)
        : file.relativePath
      const t = normalizeTarget(taskDef.targetPath)
      const target = t.endsWith('/') ? t : t + '/'
      const remotePath = '/' + target + suffix
      try {
        const readStream = await source.getFileStream(file.relativePath)
        await ftpService.uploadStreamToFile(eqpId, readStream, remotePath)
        uploaded++
      } catch (err) {
        throw new Error(`Failed after uploading ${uploaded}/${files.length} files: ${err.message}`)
      }
    }
  } else {
    // Single file upload: read from sourcePath in cache, upload to targetPath
    const remotePath = '/' + normalizeTarget(taskDef.targetPath)
    const readStream = await source.getFileStream(taskDef.sourcePath)
    await ftpService.uploadStreamToFile(eqpId, readStream, remotePath)
  }
}

/**
 * List files in the update source for preview
 */
async function listSourceFiles(sourceConfig, relativePath) {
  const source = createUpdateSource(sourceConfig)
  try {
    return await source.listFiles(relativePath || '')
  } finally {
    await source.close()
  }
}

/**
 * Test source connection by listing root files
 */
async function testSourceConnection(sourceConfig) {
  const source = createUpdateSource(sourceConfig)
  try {
    const files = await source.listFiles('')
    return { ok: true, message: `Connected successfully (${files.length} items in root)` }
  } catch (err) {
    return { ok: false, message: err.message }
  } finally {
    await source.close().catch(() => {})
  }
}

module.exports = {
  deployUpdate,
  listSourceFiles,
  testSourceConnection,
  _setDeps
}
