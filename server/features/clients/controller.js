/**
 * Client controller - Request/Response handling
 */

const service = require('./service')
const controlService = require('./controlService')
const { getAliveStatusWithVersions } = require('./aliveStatusHelper')
const { ApiError } = require('../../shared/middleware/errorHandler')
const { createActionLog } = require('../../shared/models/webmanagerLogModel')
const strategyRegistry = require('./strategies')
const { setupSSE } = require('../../shared/utils/sseHelper')
const { parseCommaSeparated } = require('../../shared/utils/parseUtils')
const { createLogger } = require('../../shared/logger')
const log = createLogger('clients')

// ============================================
// Filter & List Controllers
// ============================================

/**
 * GET /api/clients/processes
 */
async function getProcesses(req, res) {
  const processes = await service.getProcesses()
  res.json(processes)
}

/**
 * GET /api/clients/models
 */
async function getModels(req, res) {
  const { process, userProcesses } = req.query
  const userProcessesArray = parseCommaSeparated(userProcesses)
  const models = await service.getModels(process, userProcessesArray)
  res.json(models)
}

/**
 * GET /api/clients
 */
async function getClients(req, res) {
  const { process, model } = req.query
  const clients = await service.getClients({ process, model })
  res.json(clients)
}

/**
 * GET /api/clients/list
 */
async function getClientsList(req, res) {
  const { process, model, status, eqpIdSearch, ipSearch, page, pageSize, userProcesses } = req.query
  const userProcessesArray = parseCommaSeparated(userProcesses)
  const result = await service.getClientsPaginated(
    { process, model, status, eqpIdSearch, ipSearch, userProcesses: userProcessesArray },
    { page, pageSize }
  )
  res.json(result)
}

// ============================================
// Client Detail Controllers
// ============================================

/**
 * GET /api/clients/:id
 */
async function getClientDetail(req, res) {
  const { id } = req.params
  const { agentGroup } = req.query
  const client = await service.getClientById(id, agentGroup)

  if (!client) {
    throw ApiError.notFound('Client not found')
  }

  res.json(client)
}

/**
 * GET /api/clients/:id/logs
 */
async function getClientLogs(req, res) {
  const { id } = req.params
  const { limit = 50 } = req.query

  const logs = await service.getClientLogs(id, parseInt(limit))

  if (!logs) {
    throw ApiError.notFound('Client not found')
  }

  res.json(logs)
}

// ============================================
// Control Controllers (Batch Operations)
// TODO: Phase 3 구현 시 실제 batch control 로직으로 교체
// ============================================

/**
 * POST /api/clients/control
 */
async function controlClients(req, res) {
  const { ids, action } = req.body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('ids array is required')
  }

  if (!['start', 'stop', 'restart'].includes(action)) {
    throw ApiError.badRequest('action must be start, stop, or restart')
  }

  // TODO: Phase 3 — 실제 Akka 서버 연동으로 교체
  res.json({
    success: true,
    message: `${action} command sent to ${ids.length} client(s)`,
    affectedIds: ids,
    timestamp: new Date().toISOString()
  })
}

/**
 * POST /api/clients/update
 */
async function updateClientsSoftware(req, res) {
  const { ids, version } = req.body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('ids array is required')
  }

  // TODO: Phase 3 — 실제 Akka 서버 연동으로 교체
  res.json({
    success: true,
    message: `Update command sent to ${ids.length} client(s)`,
    version: version || 'latest',
    affectedIds: ids,
    timestamp: new Date().toISOString()
  })
}

/**
 * POST /api/clients/config
 */
async function configureClients(req, res) {
  const { ids, settings } = req.body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('ids array is required')
  }

  // TODO: Phase 3 — 실제 Akka 서버 연동으로 교체
  res.json({
    success: true,
    message: `Config command sent to ${ids.length} client(s)`,
    settings: settings || {},
    affectedIds: ids,
    timestamp: new Date().toISOString()
  })
}

// ============================================
// Single Client Control (RPC via ManagerAgent)
// ============================================

/**
 * GET /api/clients/:id/status - Get client service status
 */
async function getClientStatus(req, res) {
  const { id } = req.params

  try {
    const status = await controlService.getClientStatus(id)
    res.json(status)
  } catch (error) {
    throw ApiError.internal(`Failed to get client status: ${error.message}`)
  }
}

/**
 * POST /api/clients/:id/start - Start client service
 */
async function startClient(req, res) {
  const { id } = req.params

  try {
    const result = await controlService.startClient(id)
    res.json(result)
  } catch (error) {
    throw ApiError.internal(`Failed to start client: ${error.message}`)
  }
}

/**
 * POST /api/clients/:id/restart - Restart client service
 */
async function restartClient(req, res) {
  const { id } = req.params

  try {
    const result = await controlService.restartClient(id)
    res.json(result)
  } catch (error) {
    throw ApiError.internal(`Failed to restart client: ${error.message}`)
  }
}

/**
 * POST /api/clients/:id/stop - Stop client service
 */
async function stopClient(req, res) {
  const { id } = req.params

  try {
    const result = await controlService.stopClient(id)
    res.json(result)
  } catch (error) {
    throw ApiError.internal(`Failed to stop client: ${error.message}`)
  }
}


/**
 * POST /api/clients/batch-status - Get batch client service status
 */
async function getBatchClientStatus(req, res) {
  const { eqpIds, agentGroup } = req.body

  if (!agentGroup) throw ApiError.badRequest('agentGroup is required')

  if (!eqpIds || !Array.isArray(eqpIds) || eqpIds.length === 0) {
    throw ApiError.badRequest('eqpIds array is required')
  }

  try {
    const statuses = await controlService.getBatchClientStatus(eqpIds)
    res.json(statuses)
  } catch (error) {
    throw ApiError.internal(`Failed to get batch client status: ${error.message}`)
  }
}

// ============================================
// Equipment Info Management Controllers
// ============================================

/**
 * GET /api/clients/equipment-info
 */
async function getMasterData(req, res) {
  const { process, model, ipSearch, eqpIdSearch, page, pageSize, userProcesses } = req.query
  const userProcessesArray = parseCommaSeparated(userProcesses)
  const result = await service.getMasterData(
    { process, model, ipSearch, eqpIdSearch, userProcesses: userProcessesArray },
    { page, pageSize }
  )
  res.json(result)
}

/**
 * POST /api/clients/equipment-info
 */
async function createMasterData(req, res) {
  const { clients } = req.body

  if (!clients || !Array.isArray(clients) || clients.length === 0) {
    throw ApiError.badRequest('clients array is required')
  }

  // Build context from request
  const context = { user: req.user }

  const { created, errors } = await service.createClients(clients, context)

  const statusCode = errors.length > 0 && created === 0 ? 400 : 201
  res.status(statusCode).json({
    success: created > 0,
    created,
    errors
  })
}

/**
 * PUT /api/clients/equipment-info
 */
async function updateMasterData(req, res) {
  const { clients } = req.body

  if (!clients || !Array.isArray(clients) || clients.length === 0) {
    throw ApiError.badRequest('clients array is required')
  }

  // Build context from request
  const context = { user: req.user }

  const { updated, errors } = await service.updateClients(clients, context)

  res.json({
    success: updated > 0 || errors.length === 0,
    updated,
    errors
  })
}

/**
 * DELETE /api/clients/equipment-info
 */
async function deleteMasterData(req, res) {
  const { ids } = req.body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('ids array is required')
  }

  // Build context from request
  const context = { user: req.user }

  const { deleted } = await service.deleteClients(ids, context)

  res.json({
    success: true,
    deleted
  })
}

// ============================================
// Strategy-based Service Control Controllers
// ============================================

/**
 * GET /api/clients/service-types
 */
async function getServiceTypes(req, res) {
  const types = strategyRegistry.list()
  res.json(types)
}

/**
 * POST /api/clients/:id/action/:action
 */
async function handleExecuteAction(req, res) {
  const { id, action } = req.params
  const { agentGroup } = req.body
  if (!agentGroup) throw ApiError.badRequest('agentGroup is required')

  try {
    const result = await controlService.executeAction(id, agentGroup, action)

    // Audit logging (fire-and-forget)
    createActionLog({
      action,
      targetType: `${agentGroup}_service`,
      targetId: id,
      details: { agentGroup, result: result?.status || 'ok' },
      userId: req.user?.singleid || 'system'
    }).catch(() => {})

    res.json(result)
  } catch (error) {
    throw ApiError.internal(`Action '${action}' failed: ${error.message}`)
  }
}

/**
 * POST /api/clients/batch-action/:action
 */
async function handleBatchExecuteAction(req, res) {
  const { action } = req.params
  const { eqpIds, agentGroup } = req.body

  if (!agentGroup) throw ApiError.badRequest('agentGroup is required')
  if (!eqpIds || !Array.isArray(eqpIds) || eqpIds.length === 0) {
    throw ApiError.badRequest('eqpIds array is required')
  }
  const results = await controlService.batchExecuteAction(eqpIds, agentGroup, action)

  // Audit logging (fire-and-forget)
  createActionLog({
    action,
    targetType: `${agentGroup}_service_batch`,
    targetId: eqpIds.join(','),
    details: { agentGroup, eqpIds, resultCount: results.length },
    userId: req.user?.singleid || 'system'
  }).catch(() => {})

  res.json({ results })
}


/**
 * POST /api/clients/batch-action-stream/:action
 * SSE streaming batch action execution
 */
async function handleBatchActionStream(req, res) {
  const { action } = req.params
  const { eqpIds, agentGroup } = req.body

  if (!agentGroup) throw ApiError.badRequest('agentGroup is required')

  if (!eqpIds || !Array.isArray(eqpIds) || eqpIds.length === 0) {
    throw ApiError.badRequest('eqpIds array is required')
  }

  const sse = setupSSE(res)

  try {
    await controlService.batchExecuteActionStream(eqpIds, agentGroup, action, (progress) => {
      sse.send(progress)
    })
    // Audit logging (fire-and-forget)
    createActionLog({
      action,
      targetType: `${agentGroup}_service_batch`,
      targetId: eqpIds.join(','),
      details: { agentGroup, eqpIds, count: eqpIds.length },
      userId: req.user?.singleid || 'system'
    }).catch(() => {})

    // Append alive statuses before done (non-fatal)
    if (!sse.isAborted()) {
      try {
        const aliveStatuses = await getAliveStatusWithVersions(eqpIds, agentGroup)
        sse.send({ aliveStatuses })
      } catch (_) { /* alive fetch failure is non-fatal */ }
      sse.send({ done: true })
    }
  } catch (error) {
    log.error(`[batchActionStream] Error executing ${action} on [${eqpIds.join(',')}]: ${error.message}`)
    if (!sse.isAborted()) {
      sse.send({ done: true, error: error.message })
    }
  }
  sse.end()
}


/**
 * POST /api/clients/alive-status
 * Batch alive status + agent version query (Redis, no RPC)
 */
async function getBatchAliveStatusHandler(req, res) {
  const { eqpIds, agentGroup } = req.body

  if (!eqpIds || !Array.isArray(eqpIds) || eqpIds.length === 0) {
    throw ApiError.badRequest('eqpIds array is required')
  }
  if (!agentGroup) {
    throw ApiError.badRequest('agentGroup is required')
  }

  const statuses = await getAliveStatusWithVersions(eqpIds, agentGroup)
  res.json(statuses)
}

module.exports = {
  // Filter & List
  getProcesses,
  getModels,
  getClients,
  getClientsList,
  // Detail
  getClientDetail,
  getClientLogs,
  // Batch Control (Mock)
  controlClients,
  updateClientsSoftware,
  configureClients,
  // Single Client Control (RPC)
  getClientStatus,
  getBatchClientStatus,
  startClient,
  restartClient,
  stopClient,
  // Equipment Info
  getMasterData,
  createMasterData,
  updateMasterData,
  deleteMasterData,
  // Strategy-based Service Control
  getServiceTypes,
  handleExecuteAction,
  handleBatchExecuteAction,
  handleBatchActionStream,
  // Alive Status (Redis)
  getBatchAliveStatusHandler,
}
