/**
 * Authentication and Authorization Middleware
 */

const { verifyToken } = require('../utils/jwt')
const { ApiError } = require('./errorHandler')

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    throw ApiError.unauthorized('No token provided')
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw ApiError.unauthorized('Invalid token format')
  }

  const token = parts[1]
  const decoded = verifyToken(token)

  if (!decoded) {
    throw ApiError.unauthorized('Invalid or expired token')
  }

  // Attach user info to request
  req.user = decoded
  next()
}

/**
 * Role-based authorization middleware factory
 * @param {number|number[]} allowedRoles - Allowed role level(s) (1 = admin, 2 = conductor, 3 = manager, 0 = user)
 * @returns {Function} - Middleware function
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required')
    }

    const userLevel = req.user.authorityManager
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

    // Check if user's role is in the allowed roles list
    if (!roles.includes(userLevel)) {
      throw ApiError.forbidden('Insufficient permissions')
    }

    next()
  }
}

/**
 * Permission-based authorization middleware factory (uses JWT token permissions)
 * @param {string} permission - Required permission key (e.g., 'users', 'settings')
 * @returns {Function} - Middleware function
 * @deprecated Use requireMenuPermission for real-time DB permission check
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required')
    }

    const userPermissions = req.user.permissions

    if (!userPermissions || !userPermissions[permission]) {
      throw ApiError.forbidden(`No permission for ${permission}`)
    }

    next()
  }
}

/**
 * Menu permission middleware - DB에서 실시간 권한 확인
 * JWT 토큰에 저장된 권한 대신 DB에서 최신 권한을 조회하여 검증
 * @param {string|string[]} menu - 필요한 메뉴 권한 (단일 또는 배열, 배열인 경우 하나라도 있으면 통과)
 * @returns {Function} - Middleware function
 */
function requireMenuPermission(menu) {
  return async (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required')
    }

    // Admin (authorityManager === 1)은 항상 통과
    if (req.user.authorityManager === 1) {
      return next()
    }

    // DB에서 최신 권한 조회
    const { getRolePermissionByLevel } = require('../../features/users/service')
    const rolePermission = await getRolePermissionByLevel(req.user.authorityManager)

    if (!rolePermission) {
      throw ApiError.forbidden('Role not found')
    }

    // 배열인 경우: 하나라도 권한이 있으면 통과
    const menus = Array.isArray(menu) ? menu : [menu]
    const hasPermission = menus.some(m => rolePermission.permissions && rolePermission.permissions[m])

    if (!hasPermission) {
      throw ApiError.forbidden(`No access to ${menus.join(' or ')}`)
    }

    next()
  }
}

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require it
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return next()
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next()
  }

  const token = parts[1]
  const decoded = verifyToken(token)

  if (decoded) {
    req.user = decoded
  }

  next()
}

module.exports = {
  authenticate,
  requireRole,
  requirePermission,
  requireMenuPermission,
  optionalAuth
}
