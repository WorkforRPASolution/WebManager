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

const ftpService = require('./ftpService')
const updateSettingsService = require('./updateSettingsService')
const { createUpdateSource } = require('./updateSources')

/**
 * Download source files to a local temp cache directory.
 * Returns the temp directory path. Caller must clean up.
 */
async function cacheSourceFiles(source, packages) {
  const tempDir = path.join(os.tmpdir(), 'update-deploy-' + crypto.randomUUID())
  await fsPromises.mkdir(tempDir, { recursive: true })

  for (const pkg of packages) {
    if (pkg.targetType === 'directory') {
      const files = await source.listFilesRecursive(pkg.targetPath)
      for (const file of files) {
        const localPath = path.join(tempDir, file.relativePath)
        await fsPromises.mkdir(path.dirname(localPath), { recursive: true })
        const stream = await source.getFileStream(file.relativePath)
        await pipeline(stream, fs.createWriteStream(localPath))
      }
    } else {
      const localPath = path.join(tempDir, pkg.targetPath)
      await fsPromises.mkdir(path.dirname(localPath), { recursive: true })
      const stream = await source.getFileStream(pkg.targetPath)
      await pipeline(stream, fs.createWriteStream(localPath))
    }
  }

  return tempDir
}

/**
 * Deploy update packages to multiple clients with SSE progress
 * @param {string} agentGroup
 * @param {string[]} packageIds - Selected package IDs to deploy
 * @param {string[]} targetEqpIds - Target client equipment IDs
 * @param {function} onProgress - SSE progress callback
 * @param {number} concurrency - Max concurrent deployments (default 3)
 */
async function deployUpdate(agentGroup, packageIds, targetEqpIds, onProgress, concurrency = 3) {
  // 1. Load settings
  const settings = await updateSettingsService.getDocument(agentGroup)
  if (!settings) throw new Error(`Update settings not found for agentGroup: ${agentGroup}`)

  // 2. Filter selected packages
  const packages = (settings.packages || []).filter(p => packageIds.includes(p.packageId))
  if (packages.length === 0) throw new Error('No matching packages found')

  // 3. Cache source files to temp directory (download once)
  const source = createUpdateSource(settings.source)
  let tempDir
  try {
    tempDir = await cacheSourceFiles(source, packages)
  } finally {
    await source.close()
  }

  // 4. Deploy from local cache (LocalSource supports concurrent reads safely)
  const cacheSource = new LocalSource(tempDir)

  try {
    const tasks = []
    for (const eqpId of targetEqpIds) {
      for (const pkg of packages) {
        tasks.push({ eqpId, pkg })
      }
    }

    const total = tasks.length
    let completed = 0
    let successCount = 0
    let failCount = 0

    // 5. Concurrency pool
    const pool = new Set()

    for (const task of tasks) {
      const promise = (async () => {
        try {
          await deployPackageToClient(task.eqpId, agentGroup, task.pkg, cacheSource)
          completed++
          successCount++
          if (onProgress) {
            onProgress({
              eqpId: task.eqpId,
              packageId: task.pkg.packageId,
              status: 'success',
              completed,
              total
            })
          }
        } catch (err) {
          completed++
          failCount++
          if (onProgress) {
            onProgress({
              eqpId: task.eqpId,
              packageId: task.pkg.packageId,
              status: 'error',
              error: err.message,
              completed,
              total
            })
          }
        }
      })()

      pool.add(promise)
      promise.finally(() => pool.delete(promise))

      if (pool.size >= concurrency) {
        await Promise.race(pool)
      }
    }

    await Promise.all(pool)

    return { total, success: successCount, failed: failCount }
  } finally {
    // 6. Clean up temp cache (always)
    await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Deploy a single package to a single client
 *
 * FTP path = targetPath directly (NOT basePath + targetPath).
 * Reason: FTP server is chrooted to the agent's base directory (EEG_BASE),
 * which is the same as basePath. So targetPath is already relative to FTP root.
 */
async function deployPackageToClient(eqpId, agentGroup, packageDef, source) {
  if (packageDef.targetType === 'directory') {
    // Recursive upload: list all files in source directory, upload each
    const files = await source.listFilesRecursive(packageDef.targetPath)
    if (files.length === 0) throw new Error(`No files found in source: ${packageDef.targetPath}`)

    for (const file of files) {
      const remotePath = '/' + file.relativePath
      const readStream = await source.getFileStream(file.relativePath)
      await ftpService.uploadStreamToFile(eqpId, readStream, remotePath)
    }
  } else {
    // Single file upload
    const remotePath = '/' + packageDef.targetPath
    const readStream = await source.getFileStream(packageDef.targetPath)
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

module.exports = {
  deployUpdate,
  deployPackageToClient,
  listSourceFiles
}
