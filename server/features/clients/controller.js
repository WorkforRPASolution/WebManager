/**
 * Client controller - Request/Response handling
 */

const service = require('./service')
const { ApiError } = require('../../shared/middleware/errorHandler')

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
  const { process } = req.query
  const models = await service.getModels(process)
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
  const { process, model, status, ipSearch, page, pageSize } = req.query
  const result = await service.getClientsPaginated(
    { process, model, status, ipSearch },
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
  const client = await service.getClientById(id)

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
// Control Controllers (Mock for Phase 2)
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

  // Mock response (will connect to Akka server in Phase 3)
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

  // Mock response (will connect to Akka server in Phase 3)
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

  // Mock response (will connect to Akka server in Phase 3)
  res.json({
    success: true,
    message: `Config command sent to ${ids.length} client(s)`,
    settings: settings || {},
    affectedIds: ids,
    timestamp: new Date().toISOString()
  })
}

/**
 * POST /api/clients/:id/restart
 */
async function restartClient(req, res) {
  const { id } = req.params

  const exists = await service.clientExists(id)
  if (!exists) {
    throw ApiError.notFound('Client not found')
  }

  // Mock response (will connect to Akka server in Phase 3)
  res.json({
    success: true,
    message: `Restart command sent to ${id}`,
    timestamp: new Date().toISOString()
  })
}

/**
 * POST /api/clients/:id/stop
 */
async function stopClient(req, res) {
  const { id } = req.params

  const exists = await service.clientExists(id)
  if (!exists) {
    throw ApiError.notFound('Client not found')
  }

  // Mock response (will connect to Akka server in Phase 3)
  res.json({
    success: true,
    message: `Stop command sent to ${id}`,
    timestamp: new Date().toISOString()
  })
}

// ============================================
// Equipment Info Management Controllers
// ============================================

/**
 * GET /api/clients/equipment-info
 */
async function getMasterData(req, res) {
  const { process, model, ipSearch, page, pageSize } = req.query
  const result = await service.getMasterData(
    { process, model, ipSearch },
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

module.exports = {
  // Filter & List
  getProcesses,
  getModels,
  getClients,
  getClientsList,
  // Detail
  getClientDetail,
  getClientLogs,
  // Control
  controlClients,
  updateClientsSoftware,
  configureClients,
  restartClient,
  stopClient,
  // Equipment Info
  getMasterData,
  createMasterData,
  updateMasterData,
  deleteMasterData
}
