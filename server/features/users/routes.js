/**
 * User routes - Route definitions
 */

const express = require('express')
const router = express.Router()
const controller = require('./controller')
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate, requireRole } = require('../../shared/middleware/authMiddleware')
const { requireFeaturePermission } = require('../permissions/middleware')

// ===========================================
// Filter & List Routes
// ===========================================

// GET /api/users/processes - Get distinct process list
router.get('/processes', authenticate, asyncHandler(controller.getProcesses))

// GET /api/users/lines - Get distinct line list
router.get('/lines', authenticate, asyncHandler(controller.getLines))

// GET /api/users/roles - Get role definitions
router.get('/roles', authenticate, asyncHandler(controller.getRoles))

// PUT /api/users/roles/:level - Update role permissions (Admin only)
router.put('/roles/:level', authenticate, requireRole(1), asyncHandler(controller.updateRole))

// GET /api/users - Get users list with pagination
router.get('/', authenticate, requireFeaturePermission('users', 'read'), asyncHandler(controller.getUsers))

// ===========================================
// CRUD Routes
// ===========================================

// POST /api/users - Create users (batch)
router.post('/', authenticate, requireFeaturePermission('users', 'write'), asyncHandler(controller.createUsers))

// PUT /api/users - Update users (batch)
router.put('/', authenticate, requireFeaturePermission('users', 'write'), asyncHandler(controller.updateUsers))

// DELETE /api/users - Delete users (batch)
router.delete('/', authenticate, requireFeaturePermission('users', 'delete'), asyncHandler(controller.deleteUsers))

// GET /api/users/:id - Get user detail
router.get('/:id', authenticate, requireFeaturePermission('users', 'read'), asyncHandler(controller.getUser))

module.exports = router
