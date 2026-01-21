/**
 * Authentication controller
 */

const authService = require('./service')
const { ApiError } = require('../../shared/middleware/errorHandler')

/**
 * POST /api/auth/login
 * Login with credentials
 */
async function login(req, res) {
  const { username, password } = req.body

  if (!username || !password) {
    throw ApiError.badRequest('Username and password are required')
  }

  const result = await authService.login(username, password)

  if (!result) {
    throw ApiError.unauthorized('Invalid credentials')
  }

  if (result.error) {
    throw ApiError.unauthorized(result.error)
  }

  res.json(result)
}

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
async function refresh(req, res) {
  const { refreshToken } = req.body

  if (!refreshToken) {
    throw ApiError.badRequest('Refresh token is required')
  }

  const result = await authService.refreshAccessToken(refreshToken)

  if (!result) {
    throw ApiError.unauthorized('Invalid refresh token')
  }

  res.json(result)
}

/**
 * POST /api/auth/logout
 * Logout (client-side token removal)
 */
async function logout(req, res) {
  // Server-side logout is mainly for logging/audit purposes
  // Token invalidation would require a token blacklist (not implemented in this phase)
  res.json({
    success: true,
    message: 'Logged out successfully'
  })
}

/**
 * GET /api/auth/me
 * Get current user info
 */
async function me(req, res) {
  if (!req.user) {
    throw ApiError.unauthorized('Not authenticated')
  }

  const user = await authService.getCurrentUser(req.user)

  if (!user) {
    throw ApiError.notFound('User not found')
  }

  res.json(user)
}

module.exports = {
  login,
  refresh,
  logout,
  me
}
