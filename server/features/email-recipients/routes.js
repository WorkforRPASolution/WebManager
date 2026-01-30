/**
 * EmailRecipients routes - Route definitions only
 */

const express = require('express')
const router = express.Router()
const controller = require('./controller')
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate } = require('../../shared/middleware/authMiddleware')
const { requireFeaturePermission } = require('../permissions/middleware')

// ============================================
// Filter Routes (requires 'emailRecipients' read permission)
// ============================================

// GET /api/email-recipients/apps - Get distinct app list
router.get('/apps', authenticate, requireFeaturePermission('emailRecipients', 'read'), asyncHandler(controller.getApps))

// GET /api/email-recipients/processes - Get distinct process list
router.get('/processes', authenticate, requireFeaturePermission('emailRecipients', 'read'), asyncHandler(controller.getProcesses))

// GET /api/email-recipients/models - Get distinct model list
router.get('/models', authenticate, requireFeaturePermission('emailRecipients', 'read'), asyncHandler(controller.getModels))

// GET /api/email-recipients/codes - Get distinct code list
router.get('/codes', authenticate, requireFeaturePermission('emailRecipients', 'read'), asyncHandler(controller.getCodes))

// GET /api/email-recipients - Get email recipients list with pagination
router.get('/', authenticate, requireFeaturePermission('emailRecipients', 'read'), asyncHandler(controller.getEmailRecipients))

// ============================================
// CRUD Routes (requires respective feature permissions)
// ============================================

// POST /api/email-recipients - Batch create email recipients
router.post('/', authenticate, requireFeaturePermission('emailRecipients', 'write'), asyncHandler(controller.createEmailRecipients))

// PUT /api/email-recipients - Batch update email recipients
router.put('/', authenticate, requireFeaturePermission('emailRecipients', 'write'), asyncHandler(controller.updateEmailRecipients))

// DELETE /api/email-recipients - Batch delete email recipients
router.delete('/', authenticate, requireFeaturePermission('emailRecipients', 'delete'), asyncHandler(controller.deleteEmailRecipients))

module.exports = router
