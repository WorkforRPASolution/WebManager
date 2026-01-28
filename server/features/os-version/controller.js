/**
 * OS Version controller - Request/Response handling
 */

const service = require('./service')
const { ApiError } = require('../../shared/middleware/errorHandler')

// ============================================
// List Controllers
// ============================================

/**
 * GET /api/os-version
 * Get all OS versions
 */
async function getAll(req, res) {
  const items = await service.getAll()
  res.json({ data: items })
}

/**
 * GET /api/os-version/distinct
 * Get distinct active versions for dropdown
 */
async function getDistinct(req, res) {
  const versions = await service.getDistinct()
  res.json({ data: versions })
}

// ============================================
// CRUD Controllers
// ============================================

/**
 * POST /api/os-version
 * Batch create OS versions
 */
async function createOSVersion(req, res) {
  const { items } = req.body

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('items array is required')
  }

  // Build context from request
  const context = { user: req.user }

  const { created, errors } = await service.createOSVersion(items, context)

  const statusCode = errors.length > 0 && created === 0 ? 400 : 201
  res.status(statusCode).json({
    success: created > 0,
    created,
    errors
  })
}

/**
 * PUT /api/os-version
 * Batch update OS versions
 */
async function updateOSVersion(req, res) {
  const { items } = req.body

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('items array is required')
  }

  // Build context from request
  const context = { user: req.user }

  const { updated, errors } = await service.updateOSVersion(items, context)

  res.json({
    success: updated > 0 || errors.length === 0,
    updated,
    errors
  })
}

/**
 * DELETE /api/os-version
 * Batch delete OS versions
 */
async function deleteOSVersion(req, res) {
  const { ids } = req.body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('ids array is required')
  }

  // Build context from request
  const context = { user: req.user }

  const { deleted } = await service.deleteOSVersion(ids, context)

  res.json({
    success: true,
    deleted
  })
}

module.exports = {
  getAll,
  getDistinct,
  createOSVersion,
  updateOSVersion,
  deleteOSVersion
}
