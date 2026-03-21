/**
 * Update Controller
 * Handles software update settings and deployment
 */

let updateSettingsService = require('./updateSettingsService')
let updateService = require('./updateService')
const { ApiError } = require('../../shared/middleware/errorHandler')
const { createActionLog } = require('../../shared/models/webmanagerLogModel')
let _setupSSE = require('../../shared/utils/sseHelper').setupSSE
const { createLogger } = require('../../shared/logger')
const log = createLogger('clients')

/** @internal Replace dependencies for testing */
function _setDeps(deps) {
  if (deps.updateSettingsService) updateSettingsService = deps.updateSettingsService
  if (deps.updateService) updateService = deps.updateService
  if (deps.setupSSE) _setupSSE = deps.setupSSE
}

/**
 * GET /api/clients/update-settings/:agentGroup
 */
async function getUpdateSettings(req, res) {
  const { agentGroup } = req.params
  const doc = await updateSettingsService.getDocument(agentGroup)
  res.json(doc || { agentGroup, profiles: [] })
}

/**
 * PUT /api/clients/update-settings/:agentGroup
 */
async function saveUpdateSettings(req, res) {
  const { agentGroup } = req.params
  const { profiles } = req.body

  if (!Array.isArray(profiles)) throw ApiError.badRequest('profiles must be an array')

  for (const p of profiles) {
    if (!p.name?.trim()) throw ApiError.badRequest('Each profile must have a name')
    for (const task of (p.tasks || [])) {
      if (!task.name?.trim()) throw ApiError.badRequest('Each task requires a name')
      if (task.type === 'exec') {
        if (!task.commandLine?.trim()) throw ApiError.badRequest('Exec task requires commandLine')
      } else {
        if (!task.sourcePath?.trim() || !task.targetPath?.trim())
          throw ApiError.badRequest('Copy task requires sourcePath and targetPath')
      }
    }
  }

  const updatedBy = req.user?.singleid || 'unknown'
  const doc = await updateSettingsService.saveUpdateSettings(agentGroup, profiles, updatedBy)
  res.json(doc)
}

/**
 * POST /api/clients/update-source/list
 */
async function listUpdateSourceFiles(req, res) {
  const { source, relativePath } = req.body

  if (!source || !source.type) {
    throw ApiError.badRequest('source with type is required')
  }

  try {
    const files = await updateService.listSourceFiles(source, relativePath)
    res.json(files)
  } catch (error) {
    throw ApiError.internal(`Failed to list source files: ${error.message}`)
  }
}

/**
 * POST /api/clients/update/deploy
 */
async function deployUpdate(req, res) {
  const { agentGroup, profileId, taskIds, targetEqpIds } = req.body

  if (!agentGroup) throw ApiError.badRequest('agentGroup is required')
  if (!profileId) throw ApiError.badRequest('profileId is required')
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    throw ApiError.badRequest('taskIds array is required')
  }
  if (!targetEqpIds || !Array.isArray(targetEqpIds) || targetEqpIds.length === 0) {
    throw ApiError.badRequest('targetEqpIds array is required')
  }

  const sse = _setupSSE(res)

  try {
    const result = await updateService.deployUpdate(agentGroup, profileId, taskIds, targetEqpIds, (progress) => {
      sse.send(progress)
    })
    // Audit logging (fire-and-forget)
    createActionLog({
      action: 'deploy',
      targetType: 'software_update',
      targetId: profileId,
      details: { agentGroup, profileId, taskCount: taskIds.length, targetCount: targetEqpIds.length, ...result },
      userId: req.user?.singleid || 'system'
    }).catch(() => {})

    if (!sse.isAborted()) {
      sse.send({ done: true, ...result })
    }
  } catch (error) {
    log.error(`[deployUpdate] Error deploying ${profileId} to [${targetEqpIds.join(',')}]: ${error.message}`)
    if (!sse.isAborted()) {
      sse.send({ done: true, error: error.message })
    }
  }

  if (sse.isAborted()) {
    log.error(`[deployUpdate] SSE aborted: ${profileId} → [${targetEqpIds.join(',')}]`)
  }
  sse.end()
}

/**
 * POST /api/clients/update-source/test
 */
async function testSourceConnection(req, res) {
  const { source } = req.body
  if (!source || !source.type) {
    throw ApiError.badRequest('source with type is required')
  }

  const result = await updateService.testSourceConnection(source)
  res.json(result)
}

module.exports = {
  getUpdateSettings,
  saveUpdateSettings,
  listUpdateSourceFiles,
  testSourceConnection,
  deployUpdate,
  _setDeps
}
