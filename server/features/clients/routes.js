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
// Client Detail Routes (requires 'clients' permission)
// ============================================

// GET /api/clients/:id - Get client detail
router.get('/:id', authenticate, requireMenuPermission('clients'), asyncHandler(controller.getClientDetail))

// GET /api/clients/:id/logs - Get client logs
router.get('/:id/logs', authenticate, requireMenuPermission('clients'), asyncHandler(controller.getClientLogs))

// POST /api/clients/:id/restart - Restart client
router.post('/:id/restart', authenticate, requireMenuPermission('clients'), asyncHandler(controller.restartClient))

// POST /api/clients/:id/stop - Stop client
router.post('/:id/stop', authenticate, requireMenuPermission('clients'), asyncHandler(controller.stopClient))

module.exports = router
