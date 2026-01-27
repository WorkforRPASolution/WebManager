/**
 * EmailInfo routes - Route definitions only
 */

const express = require('express')
const router = express.Router()
const controller = require('./controller')
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate } = require('../../shared/middleware/authMiddleware')
const { requireFeaturePermission } = require('../permissions/middleware')

// ============================================
// Filter Routes (requires 'emailInfo' read permission)
// ============================================

// GET /api/email-info/projects - Get distinct project list
router.get('/projects', authenticate, requireFeaturePermission('emailInfo', 'read'), asyncHandler(controller.getProjects))

// GET /api/email-info/categories - Get distinct category list
router.get('/categories', authenticate, requireFeaturePermission('emailInfo', 'read'), asyncHandler(controller.getCategories))

// GET /api/email-info - Get email info list with pagination
router.get('/', authenticate, requireFeaturePermission('emailInfo', 'read'), asyncHandler(controller.getEmailInfo))

// ============================================
// CRUD Routes (requires respective feature permissions)
// ============================================

// POST /api/email-info - Batch create email info
router.post('/', authenticate, requireFeaturePermission('emailInfo', 'write'), asyncHandler(controller.createEmailInfo))

// PUT /api/email-info - Batch update email info
router.put('/', authenticate, requireFeaturePermission('emailInfo', 'write'), asyncHandler(controller.updateEmailInfo))

// DELETE /api/email-info - Batch delete email info
router.delete('/', authenticate, requireFeaturePermission('emailInfo', 'delete'), asyncHandler(controller.deleteEmailInfo))

module.exports = router
