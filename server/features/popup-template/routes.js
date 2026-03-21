const express = require('express')
const router = express.Router()
const controller = require('./controller')
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate } = require('../../shared/middleware/authMiddleware')
const { requireFeaturePermission } = require('../permissions/middleware')

// Filter options
router.get('/processes', authenticate, requireFeaturePermission('popupTemplate', 'read'), asyncHandler(controller.getProcesses))
router.get('/models', authenticate, requireFeaturePermission('popupTemplate', 'read'), asyncHandler(controller.getModels))
router.get('/codes', authenticate, requireFeaturePermission('popupTemplate', 'read'), asyncHandler(controller.getCodes))

// CRUD
router.get('/', authenticate, requireFeaturePermission('popupTemplate', 'read'), asyncHandler(controller.getTemplates))
router.post('/', authenticate, requireFeaturePermission('popupTemplate', 'write'), asyncHandler(controller.createTemplates))
router.put('/', authenticate, requireFeaturePermission('popupTemplate', 'write'), asyncHandler(controller.updateTemplates))
router.delete('/', authenticate, requireFeaturePermission('popupTemplate', 'delete'), asyncHandler(controller.deleteTemplates))

module.exports = router
