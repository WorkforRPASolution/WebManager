/**
 * Client routes - Route definitions only
 */

const express = require('express')
const router = express.Router()
const controller = require('./controller')
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate, requireMenuPermission } = require('../../shared/middleware/authMiddleware')
const { requireFeaturePermission } = require('../permissions/middleware')

// ============================================
// Filter & List Routes (requires 'clients' OR 'equipmentInfo' permission)
// ============================================

// GET /api/clients/processes - Get distinct process list
// Used by Clients page and Equipment Info page
router.get('/processes', authenticate, requireMenuPermission(['clients', 'equipmentInfo']), asyncHandler(controller.getProcesses))

// GET /api/clients/models - Get distinct eqpModel list
// Used by Clients page and Equipment Info page
router.get('/models', authenticate, requireMenuPermission(['clients', 'equipmentInfo']), asyncHandler(controller.getModels))

// GET /api/clients/list - Get clients with server-side pagination
router.get('/list', authenticate, requireMenuPermission('clients'), asyncHandler(controller.getClientsList))

// GET /api/clients - Get all clients (simple list)
router.get('/', authenticate, requireMenuPermission('clients'), asyncHandler(controller.getClients))

// ============================================
// Control Routes (requires 'clients' permission)
// ============================================

// POST /api/clients/control - Batch control clients
router.post('/control', authenticate, requireMenuPermission('clients'), asyncHandler(controller.controlClients))

// POST /api/clients/update - Batch software update
router.post('/update', authenticate, requireMenuPermission('clients'), asyncHandler(controller.updateClientsSoftware))

// POST /api/clients/config - Batch config change
router.post('/config', authenticate, requireMenuPermission('clients'), asyncHandler(controller.configureClients))

// ============================================
// Strategy-based Service Control Routes
// ============================================

// GET /api/clients/service-types - Get registered service types
router.get('/service-types', authenticate, requireMenuPermission('clients'), asyncHandler(controller.getServiceTypes))

// POST /api/clients/batch-action/:action - Strategy-based batch action
router.post('/batch-action/:action', authenticate, requireMenuPermission('clients'), asyncHandler(controller.handleBatchExecuteAction))

// POST /api/clients/batch-status - Get batch client service status (RPC)
router.post('/batch-status', authenticate, requireMenuPermission('clients'), asyncHandler(controller.getBatchClientStatus))

// ============================================
// Equipment Info Management Routes (requires 'equipmentInfo' feature permission)
// ============================================

// GET /api/clients/equipment-info - Get equipment info with pagination
router.get('/equipment-info', authenticate, requireFeaturePermission('equipmentInfo', 'read'), asyncHandler(controller.getMasterData))

// POST /api/clients/equipment-info - Batch create clients
router.post('/equipment-info', authenticate, requireFeaturePermission('equipmentInfo', 'write'), asyncHandler(controller.createMasterData))

// PUT /api/clients/equipment-info - Batch update clients
router.put('/equipment-info', authenticate, requireFeaturePermission('equipmentInfo', 'write'), asyncHandler(controller.updateMasterData))

// DELETE /api/clients/equipment-info - Batch delete clients
router.delete('/equipment-info', authenticate, requireFeaturePermission('equipmentInfo', 'delete'), asyncHandler(controller.deleteMasterData))

// ============================================
// Config Management Routes (requires 'clients' permission)
// ============================================

// GET /api/clients/config/settings - Get config file settings
router.get('/config/settings', authenticate, requireMenuPermission('clients'), asyncHandler(controller.getConfigSettings))

// GET /api/clients/by-model - Get clients by eqpModel (rollout targets)
router.get('/by-model', authenticate, requireMenuPermission('clients'), asyncHandler(controller.getClientsByModel))

// POST /api/clients/config/deploy - Deploy config to multiple clients (SSE)
router.post('/config/deploy', authenticate, requireMenuPermission('clients'), asyncHandler(controller.deployConfig))

// ============================================
// Client Detail Routes (requires 'clients' permission)
// ============================================

// GET /api/clients/:id - Get client detail
router.get('/:id', authenticate, requireMenuPermission('clients'), asyncHandler(controller.getClientDetail))

// GET /api/clients/:id/logs - Get client logs
router.get('/:id/logs', authenticate, requireMenuPermission('clients'), asyncHandler(controller.getClientLogs))

// GET /api/clients/:id/status - Get client service status (RPC)
router.get('/:id/status', authenticate, requireMenuPermission('clients'), asyncHandler(controller.getClientStatus))

// POST /api/clients/:id/start - Start client service (RPC)
router.post('/:id/start', authenticate, requireMenuPermission('clients'), asyncHandler(controller.startClient))

// POST /api/clients/:id/restart - Restart client service (RPC)
router.post('/:id/restart', authenticate, requireMenuPermission('clients'), asyncHandler(controller.restartClient))

// POST /api/clients/:id/stop - Stop client service (RPC)
router.post('/:id/stop', authenticate, requireMenuPermission('clients'), asyncHandler(controller.stopClient))

// GET /api/clients/:id/config - Read all config files (FTP)
router.get('/:id/config', authenticate, requireMenuPermission('clients'), asyncHandler(controller.getClientConfigs))


// POST /api/clients/:id/action/:action - Strategy-based action execution
router.post('/:id/action/:action', authenticate, requireMenuPermission('clients'), asyncHandler(controller.handleExecuteAction))

// PUT /api/clients/:id/config/:fileId - Save single config file (FTP)
router.put('/:id/config/:fileId', authenticate, requireMenuPermission('clients'), asyncHandler(controller.updateClientConfig))

module.exports = router
