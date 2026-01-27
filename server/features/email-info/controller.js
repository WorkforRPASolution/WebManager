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
 * GET /api/email-info
 */
async function getEmailInfo(req, res) {
  const { project, category, page, pageSize } = req.query
  const result = await service.getEmailInfoPaginated(
    { project, category },
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

module.exports = {
  getProjects,
  getCategories,
  getEmailInfo,
  createEmailInfo,
  updateEmailInfo,
  deleteEmailInfo
}
