/**
 * Client controller - Request/Response handling
 */

const service = require('./service')
const controlService = require('./controlService')
const ftpService = require('./ftpService')
const { ApiError } = require('../../shared/middleware/errorHandler')
const strategyRegistry = require('./strategies')
const configSettingsService = require('./configSettingsService')

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
  // Parse userProcesses parameter (comma-separated string → array)
  const userProcessesArray = userProcesses
    ? userProcesses.split(',').map(p => p.trim()).filter(p => p)
    : null
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
  const { process, model, status, ipSearch, page, pageSize, userProcesses } = req.query
  // Parse userProcesses parameter (comma-separated string → array)
  const userProcessesArray = userProcesses
    ? userProcesses.split(',').map(p => p.trim()).filter(p => p)
    : null
  const result = await service.getClientsPaginated(
    { process, model, status, ipSearch, userProcesses: userProcessesArray },
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
// Control Controllers (Batch Operations - Mock for Phase 3)
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

// ============================================
// Single Client Control (RPC via ManagerAgent)
// ============================================

/**
 * GET /api/clients/:id/status - Get client service status
 */
async function getClientStatus(req, res) {
  const { id } = req.params

  const exists = await service.clientExists(id)
  if (!exists) {
    throw ApiError.notFound('Client not found')
  }

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

  const exists = await service.clientExists(id)
  if (!exists) {
    throw ApiError.notFound('Client not found')
  }

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

  const exists = await service.clientExists(id)
  if (!exists) {
    throw ApiError.notFound('Client not found')
  }

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

  const exists = await service.clientExists(id)
  if (!exists) {
    throw ApiError.notFound('Client not found')
  }

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
  // Parse userProcesses parameter (comma-separated string → array)
  const userProcessesArray = userProcesses
    ? userProcesses.split(',').map(p => p.trim()).filter(p => p)
    : null
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
// Config Management Controllers (FTP)
// ============================================

/**
 * GET /api/clients/config/settings
 * Get config file settings (names, paths)
 */
async function getConfigSettings(req, res) {
  const { agentGroup } = req.query
  const settings = await ftpService.getConfigSettings(agentGroup)
  res.json(settings)
}

/**
 * GET /api/clients/by-model
 * Get clients by eqpModel (for rollout targets)
 */
async function getClientsByModel(req, res) {
  const { eqpModel, excludeEqpId } = req.query

  if (!eqpModel) {
    throw ApiError.badRequest('eqpModel is required')
  }

  const clients = await service.getClientsByModel(eqpModel, excludeEqpId)
  res.json(clients)
}

/**
 * GET /api/clients/:id/config
 * Read all config files for a client via FTP
 */
async function getClientConfigs(req, res) {
  const { id } = req.params
  const { agentGroup } = req.query

  const exists = await service.clientExists(id)
  if (!exists) {
    throw ApiError.notFound('Client not found')
  }

  try {
    const configs = await ftpService.readAllConfigs(id, agentGroup)
    res.json(configs)
  } catch (error) {
    throw ApiError.internal(`Failed to read configs: ${error.message}`)
  }
}

/**
 * PUT /api/clients/:id/config/:fileId
 * Save a single config file via FTP
 */
async function updateClientConfig(req, res) {
  const { id, fileId } = req.params
  const { content, agentGroup } = req.body

  if (content === undefined || content === null) {
    throw ApiError.badRequest('content is required')
  }

  const exists = await service.clientExists(id)
  if (!exists) {
    throw ApiError.notFound('Client not found')
  }

  // Find the config file path by fileId
  const configs = await ftpService.getConfigSettings(agentGroup)
  const config = configs.find(c => c.fileId === fileId)
  if (!config) {
    throw ApiError.notFound(`Config file not found: ${fileId}`)
  }

  try {
    await ftpService.writeConfigFile(id, config.path, content)
    res.json({ success: true, message: 'Config saved successfully' })
  } catch (error) {
    throw ApiError.internal(`Failed to save config: ${error.message}`)
  }
}

/**
 * POST /api/clients/config/deploy
 * Deploy config to multiple clients via SSE
 */
async function deployConfig(req, res) {
  const { sourceEqpId, fileId, targetEqpIds, mode, selectedKeys, agentGroup } = req.body

  if (!sourceEqpId || !fileId || !targetEqpIds || !Array.isArray(targetEqpIds) || targetEqpIds.length === 0) {
    throw ApiError.badRequest('sourceEqpId, fileId, and targetEqpIds are required')
  }

  // Find config path
  const configs = await ftpService.getConfigSettings(agentGroup)
  const config = configs.find(c => c.fileId === fileId)
  if (!config) {
    throw ApiError.notFound(`Config file not found: ${fileId}`)
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    // Read source config
    const sourceContent = await ftpService.readConfigFile(sourceEqpId, config.path)

    const onProgress = (progress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`)
    }

    let results
    if (mode === 'selective' && selectedKeys && selectedKeys.length > 0) {
      const sourceConfig = JSON.parse(sourceContent)
      results = await ftpService.deployConfigSelective(
        sourceConfig, selectedKeys, targetEqpIds, config.path, onProgress
      )
    } else {
      results = await ftpService.deployConfig(
        sourceContent, targetEqpIds, config.path, onProgress
      )
    }

    // Send final summary
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    res.write(`data: ${JSON.stringify({
      done: true,
      total: targetEqpIds.length,
      success: successCount,
      failed: failCount,
      results
    })}\n\n`)
  } catch (error) {
    res.write(`data: ${JSON.stringify({ done: true, error: error.message })}\n\n`)
  }

  res.end()
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

  const exists = await service.clientExists(id)
  if (!exists) throw ApiError.notFound('Client not found')

  try {
    const result = await controlService.executeAction(id, agentGroup, action)
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

  // SSE headers (same pattern as deployConfig)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Detect client disconnection via res.on('close'), NOT req.on('close').
  // req 'close' fires when request body is consumed (immediately for small POST),
  // res 'close' fires when the actual TCP connection drops.
  let aborted = false
  res.on('close', () => { aborted = true })

  const onProgress = (progress) => {
    if (!aborted) {
      res.write(`data: ${JSON.stringify(progress)}\n\n`)
    }
  }

  try {
    await controlService.batchExecuteActionStream(eqpIds, agentGroup, action, onProgress)
    if (!aborted) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    }
  } catch (error) {
    if (!aborted) {
      res.write(`data: ${JSON.stringify({ done: true, error: error.message })}\n\n`)
    }
  }
  res.end()
}


// ============================================
// Config Settings Management Controllers
// ============================================

/**
 * GET /api/clients/config/settings/:agentGroup
 * Get config settings document for management UI
 */
async function getConfigSettingsDocument(req, res) {
  const { agentGroup } = req.params
  const doc = await configSettingsService.getDocument(agentGroup)
  res.json(doc || { agentGroup, configFiles: [] })
}

/**
 * PUT /api/clients/config/settings/:agentGroup
 * Save config settings for an agentGroup
 */
async function saveConfigSettingsDocument(req, res) {
  const { agentGroup } = req.params
  const { configFiles } = req.body

  if (!configFiles || !Array.isArray(configFiles)) {
    throw ApiError.badRequest('configFiles array is required')
  }

  for (const f of configFiles) {
    if (!f.name || !f.name.trim()) throw ApiError.badRequest('Config file name is required')
    if (!f.path || !f.path.trim()) throw ApiError.badRequest('Config file path is required')
  }

  const updatedBy = req.user?.username || 'unknown'
  const doc = await configSettingsService.saveConfigSettings(agentGroup, configFiles, updatedBy)
  res.json(doc)
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
  // Config Management (FTP)
  getConfigSettings,
  getClientsByModel,
  getClientConfigs,
  updateClientConfig,
  deployConfig,
  getConfigSettingsDocument,
  saveConfigSettingsDocument,
  // Strategy-based Service Control
  getServiceTypes,
  handleExecuteAction,
  handleBatchExecuteAction,
  handleBatchActionStream
}
