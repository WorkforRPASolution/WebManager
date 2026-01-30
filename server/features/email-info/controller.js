/**
 * EmailInfo controller - Request/Response handling
 */

const service = require('./service')
const { ApiError } = require('../../shared/middleware/errorHandler')

// ============================================
// Filter & List Controllers
// ============================================

/**
 * GET /api/email-info/projects
 */
async function getProjects(req, res) {
  const projects = await service.getProjects()
  res.json(projects)
}

/**
 * GET /api/email-info/categories
 */
async function getCategories(req, res) {
  const { project } = req.query
  const categories = await service.getCategories(project)
  res.json(categories)
}

/**
 * GET /api/email-info/processes-from-category
 * Get distinct process values extracted from category (2nd part)
 */
async function getProcessesFromCategory(req, res) {
  const { project, userProcesses } = req.query
  // Parse userProcesses parameter (comma-separated string → array)
  const userProcessesArray = userProcesses
    ? userProcesses.split(',').map(p => p.trim()).filter(p => p)
    : null
  const processes = await service.getProcessesFromCategory(project, userProcessesArray)
  res.json(processes)
}

/**
 * GET /api/email-info/models-from-category
 * Get distinct model values extracted from category (3rd part)
 */
async function getModelsFromCategory(req, res) {
  const { project, process, userProcesses } = req.query
  // Parse userProcesses parameter (comma-separated string → array)
  const userProcessesArray = userProcesses
    ? userProcesses.split(',').map(p => p.trim()).filter(p => p)
    : null
  const models = await service.getModelsFromCategory(project, process, userProcessesArray)
  res.json(models)
}

/**
 * GET /api/email-info
 */
async function getEmailInfo(req, res) {
  const { project, category, account, process, model, page, pageSize, userProcesses } = req.query
  // Parse userProcesses from comma-separated string to array
  const userProcessesArray = userProcesses
    ? userProcesses.split(',').map(p => p.trim()).filter(p => p)
    : null
  const result = await service.getEmailInfoPaginated(
    { project, category, account, process, model, userProcesses: userProcessesArray },
    { page, pageSize }
  )
  res.json(result)
}

// ============================================
// CRUD Controllers
// ============================================

/**
 * POST /api/email-info
 */
async function createEmailInfo(req, res) {
  const { items } = req.body

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('items array is required')
  }

  // Build context from request
  const context = { user: req.user }

  const { created, errors } = await service.createEmailInfo(items, context)

  const statusCode = errors.length > 0 && created === 0 ? 400 : 201
  res.status(statusCode).json({
    success: created > 0,
    created,
    errors
  })
}

/**
 * PUT /api/email-info
 */
async function updateEmailInfo(req, res) {
  const { items } = req.body

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('items array is required')
  }

  // Build context from request
  const context = { user: req.user }

  const { updated, errors } = await service.updateEmailInfo(items, context)

  res.json({
    success: updated > 0 || errors.length === 0,
    updated,
    errors
  })
}

/**
 * DELETE /api/email-info
 */
async function deleteEmailInfo(req, res) {
  const { ids } = req.body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('ids array is required')
  }

  // Build context from request
  const context = { user: req.user }

  const { deleted } = await service.deleteEmailInfo(ids, context)

  res.json({
    success: true,
    deleted
  })
}

/**
 * POST /api/email-info/check-categories
 * Check which categories exist in EMAILINFO collection
 */
async function checkCategories(req, res) {
  const { categories } = req.body

  if (!categories || !Array.isArray(categories)) {
    throw ApiError.badRequest('categories array is required')
  }

  const result = await service.checkCategories(categories)
  res.json(result)
}

module.exports = {
  getProjects,
  getCategories,
  getProcessesFromCategory,
  getModelsFromCategory,
  getEmailInfo,
  createEmailInfo,
  updateEmailInfo,
  deleteEmailInfo,
  checkCategories
}
