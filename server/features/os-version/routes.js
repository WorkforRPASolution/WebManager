/**
 * OS Version routes - Route definitions only
 */

const express = require('express')
const router = express.Router()
const controller = require('./controller')
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate } = require('../../shared/middleware/authMiddleware')
const { requireFeaturePermission } = require('../permissions/middleware')

// ============================================
// Dropdown Route (requires 'equipmentInfo' read permission)
// ============================================

// GET /api/os-version/distinct - Get active versions for dropdown
router.get('/distinct', authenticate, requireFeaturePermission('equipmentInfo', 'read'), asyncHandler(controller.getDistinct))

// ============================================
// List Route (requires 'osVersion' read permission)
// ============================================

// GET /api/os-version - Get all OS versions
router.get('/', authenticate, requireFeaturePermission('osVersion', 'read'), asyncHandler(controller.getAll))

// ============================================
// CRUD Routes (requires respective osVersion permissions)
// ============================================

// POST /api/os-version - Batch create OS versions
router.post('/', authenticate, requireFeaturePermission('osVersion', 'write'), asyncHandler(controller.createOSVersion))

// PUT /api/os-version - Batch update OS versions
router.put('/', authenticate, requireFeaturePermission('osVersion', 'write'), asyncHandler(controller.updateOSVersion))

// DELETE /api/os-version - Batch delete OS versions
router.delete('/', authenticate, requireFeaturePermission('osVersion', 'delete'), asyncHandler(controller.deleteOSVersion))

module.exports = router
