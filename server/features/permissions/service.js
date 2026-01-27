/**
 * Feature Permission Service
 * Business logic for feature-level permissions
 */

const { FeaturePermission, DEFAULT_FEATURE_PERMISSIONS, FEATURE_NAMES } = require('./model')

/**
 * Get all feature permissions
 * @returns {Promise<Array>} - All feature permissions
 */
async function getAllPermissions() {
  const permissions = await FeaturePermission.find().lean()

  // Convert Map to plain object for each permission
  return permissions.map(p => ({
    feature: p.feature,
    featureName: FEATURE_NAMES[p.feature] || p.feature,
    permissions: p.permissions instanceof Map ? Object.fromEntries(p.permissions) : p.permissions,
    updatedAt: p.updatedAt,
    updatedBy: p.updatedBy
  }))
}

/**
 * Get permission for a specific feature
 * @param {string} feature - Feature identifier
 * @returns {Promise<Object|null>} - Feature permission or null
 */
async function getPermissionByFeature(feature) {
  const permission = await FeaturePermission.findOne({ feature }).lean()

  if (!permission) {
    return null
  }

  return {
    feature: permission.feature,
    featureName: FEATURE_NAMES[permission.feature] || permission.feature,
    permissions: permission.permissions instanceof Map
      ? Object.fromEntries(permission.permissions)
      : permission.permissions,
    updatedAt: permission.updatedAt,
    updatedBy: permission.updatedBy
  }
}

/**
 * Update permissions for a specific feature
 * @param {string} feature - Feature identifier
 * @param {Object} permissions - New permissions object
 * @param {string} updatedBy - User who made the update
 * @returns {Promise<Object>} - Updated feature permission
 */
async function updateFeaturePermission(feature, permissions, updatedBy) {
  // Validate feature
  if (!['equipmentInfo', 'emailTemplate', 'users'].includes(feature)) {
    throw new Error('Invalid feature')
  }

  // Normalize keys to strings (Mongoose Map requires string keys)
  const normalizedPermissions = {}
  for (const [key, value] of Object.entries(permissions)) {
    normalizedPermissions[String(key)] = value
  }

  // Ensure Admin (roleLevel 1) always has full permissions
  normalizedPermissions['1'] = { read: true, write: true, delete: true }

  const updated = await FeaturePermission.findOneAndUpdate(
    { feature },
    {
      $set: {
        permissions: normalizedPermissions,
        updatedBy
      }
    },
    { new: true, upsert: true }
  ).lean()

  return {
    feature: updated.feature,
    featureName: FEATURE_NAMES[updated.feature] || updated.feature,
    permissions: updated.permissions instanceof Map
      ? Object.fromEntries(updated.permissions)
      : updated.permissions,
    updatedAt: updated.updatedAt,
    updatedBy: updated.updatedBy
  }
}

/**
 * Check if a role has specific permission for a feature
 * @param {string} feature - Feature identifier
 * @param {number} roleLevel - Role level (0-3)
 * @param {string} action - Permission action (read, write, delete)
 * @returns {Promise<boolean>} - Whether the role has the permission
 */
async function checkPermission(feature, roleLevel, action) {
  // Admin always has all permissions
  if (roleLevel === 1) {
    return true
  }

  const permission = await FeaturePermission.findOne({ feature }).lean()

  if (!permission) {
    return false
  }

  const rolePermissions = permission.permissions instanceof Map
    ? permission.permissions.get(String(roleLevel))
    : permission.permissions[roleLevel]

  return rolePermissions?.[action] === true
}

/**
 * Get all permissions for a specific role level
 * @param {number} roleLevel - Role level (0-3)
 * @returns {Promise<Object>} - Permissions object for the role
 */
async function getPermissionsByRole(roleLevel) {
  const allPermissions = await FeaturePermission.find().lean()

  const result = {}

  for (const p of allPermissions) {
    const rolePerms = p.permissions instanceof Map
      ? p.permissions.get(String(roleLevel))
      : p.permissions[roleLevel]

    result[p.feature] = rolePerms || { read: false, write: false, delete: false }
  }

  return result
}

/**
 * Initialize default permissions if not exist
 * @returns {Promise<void>}
 */
async function initializeDefaultPermissions() {
  for (const defaultPerm of DEFAULT_FEATURE_PERMISSIONS) {
    const exists = await FeaturePermission.findOne({ feature: defaultPerm.feature })
    if (!exists) {
      await FeaturePermission.create({
        feature: defaultPerm.feature,
        permissions: defaultPerm.permissions,
        updatedBy: 'system'
      })
    }
  }
}

module.exports = {
  getAllPermissions,
  getPermissionByFeature,
  updateFeaturePermission,
  checkPermission,
  getPermissionsByRole,
  initializeDefaultPermissions
}
