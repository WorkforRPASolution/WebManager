/**
 * Client routes - Route definitions only
 */

const express = require('express')
const router = express.Router()
const controller = require('./controller')
const { asyncHandler } = require('../../shared/middleware/errorHandler')

// ============================================
// Filter & List Routes
// ============================================

// GET /api/clients/processes - Get distinct process list
router.get('/processes', asyncHandler(controller.getProcesses))

// GET /api/clients/models - Get distinct eqpModel list
router.get('/models', asyncHandler(controller.getModels))

// GET /api/clients/list - Get clients with server-side pagination
router.get('/list', asyncHandler(controller.getClientsList))

// GET /api/clients - Get all clients (simple list)
router.get('/', asyncHandler(controller.getClients))

// ============================================
// Control Routes (Mock for Phase 2)
// ============================================

// POST /api/clients/control - Batch control clients
router.post('/control', asyncHandler(controller.controlClients))

// POST /api/clients/update - Batch software update
router.post('/update', asyncHandler(controller.updateClientsSoftware))

// POST /api/clients/config - Batch config change
router.post('/config', asyncHandler(controller.configureClients))

// ============================================
// Master Data Management Routes
// ============================================

// GET /api/clients/master - Get master data with pagination
router.get('/master', asyncHandler(controller.getMasterData))

// POST /api/clients/master - Batch create clients
router.post('/master', asyncHandler(controller.createMasterData))

// PUT /api/clients/master - Batch update clients
router.put('/master', asyncHandler(controller.updateMasterData))

// DELETE /api/clients/master - Batch delete clients
router.delete('/master', asyncHandler(controller.deleteMasterData))

// ============================================
// Client Detail Routes
// ============================================

// GET /api/clients/:id - Get client detail
router.get('/:id', asyncHandler(controller.getClientDetail))

// GET /api/clients/:id/logs - Get client logs
router.get('/:id/logs', asyncHandler(controller.getClientLogs))

// POST /api/clients/:id/restart - Restart client
router.post('/:id/restart', asyncHandler(controller.restartClient))

// POST /api/clients/:id/stop - Stop client
router.post('/:id/stop', asyncHandler(controller.stopClient))

module.exports = router
