const express = require('express')
const router = express.Router()
const controller = require('./controller')
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate } = require('../../shared/middleware/authMiddleware')
const { requireFeaturePermission } = require('../permissions/middleware')

// Filter options
router.get('/processes', authenticate, requireFeaturePermission('emailTemplate', 'read'), asyncHandler(controller.getProcesses))
router.get('/models', authenticate, requireFeaturePermission('emailTemplate', 'read'), asyncHandler(controller.getModels))
router.get('/codes', authenticate, requireFeaturePermission('emailTemplate', 'read'), asyncHandler(controller.getCodes))

// CRUD
router.get('/', authenticate, requireFeaturePermission('emailTemplate', 'read'), asyncHandler(controller.getTemplates))
router.post('/', authenticate, requireFeaturePermission('emailTemplate', 'write'), asyncHandler(controller.createTemplates))
router.put('/', authenticate, requireFeaturePermission('emailTemplate', 'write'), asyncHandler(controller.updateTemplates))
router.delete('/', authenticate, requireFeaturePermission('emailTemplate', 'delete'), asyncHandler(controller.deleteTemplates))

module.exports = router
