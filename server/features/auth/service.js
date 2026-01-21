/**
 * Authentication service
 */

const bcrypt = require('bcrypt')
const { generateToken, generateRefreshToken, verifyToken } = require('../../shared/utils/jwt')
const { getUserBySingleId, updateLastLogin, getRolePermissionByLevel } = require('../users/service')

/**
 * Authenticate user with credentials
 * @param {string} singleid - User ID
 * @param {string} password - Plain text password
 * @returns {Object|null} - Auth result with tokens or null if invalid
 */
async function login(singleid, password) {
  // Get user with password
  const user = await getUserBySingleId(singleid)

  if (!user) {
    return null
  }

  // Check if user is active
  if (!user.isActive) {
    return { error: 'Account is deactivated' }
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password)
  if (!isValidPassword) {
    return null
  }

  // Get role permissions
  const rolePermission = await getRolePermissionByLevel(user.authorityManager)
  const permissions = rolePermission?.permissions || {}

  // Create token payload
  const tokenPayload = {
    id: user._id.toString(),
    singleid: user.singleid,
    name: user.name,
    authorityManager: user.authorityManager,
    permissions
  }

  // Generate tokens
  const token = generateToken(tokenPayload)
  const refreshToken = generateRefreshToken({ id: user._id.toString() })

  // Update last login
  await updateLastLogin(user._id)

  // Return user data without password
  const { password: _, ...userWithoutPassword } = user

  return {
    success: true,
    token,
    refreshToken,
    user: {
      ...userWithoutPassword,
      roleName: rolePermission?.roleName || 'Unknown',
      permissions
    }
  }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Object|null} - New tokens or null if invalid
 */
async function refreshAccessToken(refreshToken) {
  const decoded = verifyToken(refreshToken)

  if (!decoded) {
    return null
  }

  // Get fresh user data
  const user = await getUserBySingleId(decoded.singleid)

  if (!user || !user.isActive) {
    return null
  }

  // Get role permissions
  const rolePermission = await getRolePermissionByLevel(user.authorityManager)
  const permissions = rolePermission?.permissions || {}

  // Create new token payload
  const tokenPayload = {
    id: user._id.toString(),
    singleid: user.singleid,
    name: user.name,
    authorityManager: user.authorityManager,
    permissions
  }

  // Generate new access token
  const newToken = generateToken(tokenPayload)

  return {
    success: true,
    token: newToken
  }
}

/**
 * Get current user info from token
 * @param {Object} tokenPayload - Decoded token payload
 * @returns {Object|null} - User info or null
 */
async function getCurrentUser(tokenPayload) {
  if (!tokenPayload || !tokenPayload.id) {
    return null
  }

  // Get fresh user data (avoid using stale token data)
  const { User } = require('../users/model')
  const user = await User.findById(tokenPayload.id).select('-password').lean()

  if (!user) {
    return null
  }

  // Get role permissions
  const rolePermission = await getRolePermissionByLevel(user.authorityManager)

  return {
    ...user,
    roleName: rolePermission?.roleName || 'Unknown',
    permissions: rolePermission?.permissions || {}
  }
}

module.exports = {
  login,
  refreshAccessToken,
  getCurrentUser
}
