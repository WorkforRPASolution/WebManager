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


/**
 * Map action name to feature permission requirement
 * @param {string} actionName - Action name from route params
 * @returns {{ feature: string, action: string }}
 */
function getActionPermission(actionName) {
  const map = {
    status:  { feature: 'clientControl', action: 'read' },
    start:   { feature: 'clientControl', action: 'write' },
    stop:    { feature: 'clientControl', action: 'write' },
    restart: { feature: 'clientControl', action: 'write' },
    kill:    { feature: 'clientControl', action: 'write' },
  }
  return map[actionName] !== undefined
    ? map[actionName]
    : { feature: 'clientControl', action: 'write' }  // unknown → write
}

/**
 * Dynamic action permission middleware
 * Reads action from req.params.action and checks corresponding feature permission
 * @returns {Function} - Express middleware function
 */
function requireActionPermission() {
  return async (req, res, next) => {
    const permReq = getActionPermission(req.params.action)
    if (!permReq) return next()
    return requireFeaturePermission(permReq.feature, permReq.action)(req, res, next)
  }
}

module.exports = {
  requireFeaturePermission,
  requireActionPermission
}
