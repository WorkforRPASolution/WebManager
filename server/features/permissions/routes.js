/**
 * Feature Permission Routes
 */

const express = require('express')
const router = express.Router()
const controller = require('./controller')
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate, requireRole } = require('../../shared/middleware/authMiddleware')

// GET /api/permissions - Get all feature permissions
router.get('/', authenticate, asyncHandler(controller.getAllPermissions))

// GET /api/permissions/check - Check current user's permission
router.get('/check', authenticate, asyncHandler(controller.checkPermission))

// GET /api/permissions/role/:level - Get permissions for a specific role level
router.get('/role/:level', authenticate, asyncHandler(controller.getPermissionsByRole))

// GET /api/permissions/:feature - Get permission for a specific feature
router.get('/:feature', authenticate, asyncHandler(controller.getPermissionByFeature))

// PUT /api/permissions/:feature - Update feature permission (Admin only)
router.put('/:feature', authenticate, requireRole(1), asyncHandler(controller.updateFeaturePermission))

module.exports = router
