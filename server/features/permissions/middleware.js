/**
 * Feature Permission Middleware
 * Server-side permission enforcement for features
 */

const service = require('./service')
const { ApiError } = require('../../shared/middleware/errorHandler')

/**
 * Middleware factory to check feature permission
 * @param {string} feature - Feature identifier (equipmentInfo, emailTemplate, users)
 * @param {string} action - Required action (read, write, delete)
 * @returns {Function} - Express middleware function
 */
function requireFeaturePermission(feature, action) {
  return async (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required')
    }

    const roleLevel = req.user.authorityManager

    // Admin always has full permissions
    if (roleLevel === 1) {
      return next()
    }

    const hasPermission = await service.checkPermission(feature, roleLevel, action)

    if (!hasPermission) {
      throw ApiError.forbidden(`No ${action} permission for ${feature}`)
    }

    next()
  }
}

module.exports = {
  requireFeaturePermission
}
