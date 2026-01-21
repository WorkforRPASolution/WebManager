/**
 * Feature Permission Controller
 * Request handling for feature permissions
 */

const service = require('./service')

/**
 * GET /api/permissions
 * Get all feature permissions
 */
async function getAllPermissions(req, res) {
  const permissions = await service.getAllPermissions()
  res.json(permissions)
}

/**
 * GET /api/permissions/:feature
 * Get permission for a specific feature
 */
async function getPermissionByFeature(req, res) {
  const { feature } = req.params

  const permission = await service.getPermissionByFeature(feature)

  if (!permission) {
    return res.status(404).json({ error: 'Feature permission not found' })
  }

  res.json(permission)
}

/**
 * PUT /api/permissions/:feature
 * Update permissions for a specific feature (Admin only)
 */
async function updateFeaturePermission(req, res) {
  const { feature } = req.params
  const { permissions } = req.body
  const updatedBy = req.user?.singleid || 'unknown'

  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: 'Invalid permissions object' })
  }

  const updated = await service.updateFeaturePermission(feature, permissions, updatedBy)
  res.json(updated)
}

/**
 * GET /api/permissions/role/:level
 * Get all feature permissions for a specific role level
 */
async function getPermissionsByRole(req, res) {
  const level = parseInt(req.params.level, 10)

  if (isNaN(level) || level < 0 || level > 3) {
    return res.status(400).json({ error: 'Invalid role level' })
  }

  const permissions = await service.getPermissionsByRole(level)
  res.json(permissions)
}

/**
 * GET /api/permissions/check
 * Check if current user has permission for a feature action
 * Query params: feature, action (read|write|delete)
 */
async function checkPermission(req, res) {
  const { feature, action } = req.query
  const roleLevel = req.user?.authorityManager

  if (!feature || !action) {
    return res.status(400).json({ error: 'Missing feature or action parameter' })
  }

  if (!['read', 'write', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be read, write, or delete' })
  }

  const hasPermission = await service.checkPermission(feature, roleLevel, action)
  res.json({ hasPermission })
}

module.exports = {
  getAllPermissions,
  getPermissionByFeature,
  updateFeaturePermission,
  getPermissionsByRole,
  checkPermission
}
