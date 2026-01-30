/**
 * EmailRecipients controller - Request/Response handling
 */

const service = require('./service')
const { ApiError } = require('../../shared/middleware/errorHandler')

// ============================================
// Filter & List Controllers
// ============================================

/**
 * GET /api/email-recipients/apps
 */
async function getApps(req, res) {
  const apps = await service.getApps()
  res.json(apps)
}

/**
 * GET /api/email-recipients/processes
 */
async function getProcesses(req, res) {
  const { app } = req.query
  const processes = await service.getProcesses(app)
  res.json(processes)
}

/**
 * GET /api/email-recipients/models
 */
async function getModels(req, res) {
  const { app, process, userProcesses } = req.query
  // Parse userProcesses parameter (comma-separated string → array)
  const userProcessesArray = userProcesses
    ? userProcesses.split(',').map(p => p.trim()).filter(p => p)
    : null
  const models = await service.getModels(app, process, userProcessesArray)
  res.json(models)
}

/**
 * GET /api/email-recipients/codes
 */
async function getCodes(req, res) {
  const { app, process, model, userProcesses } = req.query
  // Parse userProcesses parameter (comma-separated string → array)
  const userProcessesArray = userProcesses
    ? userProcesses.split(',').map(p => p.trim()).filter(p => p)
    : null
  const codes = await service.getCodes(app, process, model, userProcessesArray)
  res.json(codes)
}

/**
 * GET /api/email-recipients
 */
async function getEmailRecipients(req, res) {
  const { app, process, model, code, emailCategory, page, pageSize, userProcesses } = req.query
  // Parse userProcesses parameter (comma-separated string → array)
  const userProcessesArray = userProcesses
    ? userProcesses.split(',').map(p => p.trim()).filter(p => p)
    : null
  const result = await service.getEmailRecipientsPaginated(
    { app, process, model, code, emailCategory, userProcesses: userProcessesArray },
    { page, pageSize }
  )
  res.json(result)
}

// ============================================
// CRUD Controllers
// ============================================

/**
 * POST /api/email-recipients
 */
async function createEmailRecipients(req, res) {
  const { items } = req.body

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('items array is required')
  }

  // Build context from request
  const context = { user: req.user }

  const { created, errors } = await service.createEmailRecipients(items, context)

  const statusCode = errors.length > 0 && created === 0 ? 400 : 201
  res.status(statusCode).json({
    success: created > 0,
    created,
    errors
  })
}

/**
 * PUT /api/email-recipients
 */
async function updateEmailRecipients(req, res) {
  const { items } = req.body

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('items array is required')
  }

  // Build context from request
  const context = { user: req.user }

  const { updated, errors } = await service.updateEmailRecipients(items, context)

  res.json({
    success: updated > 0 || errors.length === 0,
    updated,
    errors
  })
}

/**
 * DELETE /api/email-recipients
 */
async function deleteEmailRecipients(req, res) {
  const { ids } = req.body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('ids array is required')
  }

  // Build context from request
  const context = { user: req.user }

  const { deleted } = await service.deleteEmailRecipients(ids, context)

  res.json({
    success: true,
    deleted
  })
}

module.exports = {
  getApps,
  getProcesses,
  getModels,
  getCodes,
  getEmailRecipients,
  createEmailRecipients,
  updateEmailRecipients,
  deleteEmailRecipients
}
