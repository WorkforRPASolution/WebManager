/**
 * Authentication controller
 */

const authService = require('./service')
const { ApiError } = require('../../shared/middleware/errorHandler')
const { createAuthLog } = require('../../shared/models/webmanagerLogModel')

/**
 * Helper: Extract client info from request
 */
function getClientInfo(req) {
  return {
    ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown'
  }
}

/**
 * POST /api/auth/login
 * Login with credentials
 */
async function login(req, res) {
  const { username, password } = req.body
  const clientInfo = getClientInfo(req)

  if (!username || !password) {
    throw ApiError.badRequest('Username and password are required')
  }

  const result = await authService.login(username, password)

  if (!result) {
    // Log failed login
    createAuthLog({
      authAction: 'login_failed',
      userId: username,
      ...clientInfo
    }).catch(err => console.error('Failed to save auth log:', err.message))

    throw ApiError.unauthorized('Invalid credentials')
  }

  if (result.error) {
    // Log failed login (account status issue)
    createAuthLog({
      authAction: 'login_failed',
      userId: username,
      ...clientInfo
    }).catch(err => console.error('Failed to save auth log:', err.message))

    throw ApiError.unauthorized(result.error)
  }

  // Log successful login
  createAuthLog({
    authAction: 'login',
    userId: username,
    ...clientInfo
  }).catch(err => console.error('Failed to save auth log:', err.message))

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
  const clientInfo = getClientInfo(req)

  // Log logout
  createAuthLog({
    authAction: 'logout',
    userId: req.user?.singleid || req.user?.id || 'unknown',
    ...clientInfo
  }).catch(err => console.error('Failed to save auth log:', err.message))

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

/**
 * POST /api/auth/signup
 * Register a new user
 */
async function signup(req, res) {
  const { name, singleid, password, email, line, process, department, note, authorityManager, authority } = req.body

  // Validation
  const errors = []

  if (!name || name.trim().length < 2) {
    errors.push({ field: 'name', message: '이름은 2자 이상이어야 합니다' })
  }

  if (!singleid || singleid.trim().length < 3) {
    errors.push({ field: 'singleid', message: 'ID는 3자 이상이어야 합니다' })
  } else if (!/^[A-Za-z0-9_-]+$/.test(singleid)) {
    errors.push({ field: 'singleid', message: 'ID는 영문, 숫자, _, -만 사용 가능합니다' })
  }

  if (!password || password.length < 8) {
    errors.push({ field: 'password', message: '비밀번호는 8자 이상이어야 합니다' })
  } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.push({ field: 'password', message: '비밀번호는 영문과 숫자를 포함해야 합니다' })
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: '유효한 이메일을 입력해주세요' })
  }

  // Process validation: 영문 대문자, 언더바만 허용
  if (!process || process.trim().length === 0) {
    errors.push({ field: 'process', message: 'Process를 입력해주세요' })
  } else if (!/^[A-Z_]+$/.test(process.trim())) {
    errors.push({ field: 'process', message: 'Process는 영문 대문자와 언더바(_)만 사용 가능합니다' })
  }

  // Line validation: 한글 제외
  if (!line || line.trim().length === 0) {
    errors.push({ field: 'line', message: 'Line을 입력해주세요' })
  } else if (/[\uAC00-\uD7A3]/.test(line.trim())) {
    errors.push({ field: 'line', message: 'Line에는 한글을 사용할 수 없습니다' })
  }

  // AuthorityManager validation: 0-3
  if (authorityManager !== undefined && authorityManager !== '') {
    const authMgrNum = Number(authorityManager)
    if (isNaN(authMgrNum) || authMgrNum < 0 || authMgrNum > 3) {
      errors.push({ field: 'authorityManager', message: '유효한 사용자 권한을 선택해주세요' })
    }
  }

  // Authority validation: '' or 'WRITE'
  if (authority !== undefined && authority !== '' && authority !== 'WRITE') {
    errors.push({ field: 'authority', message: '유효한 RPA 권한을 선택해주세요' })
  }

  if (errors.length > 0) {
    throw ApiError.badRequest('Validation failed', errors)
  }

  const result = await authService.signup({
    name: name.trim(),
    singleid: singleid.trim(),
    password,
    email: email.trim(),
    line: line.trim(),
    process: process.trim(),
    department: department?.trim() || '',
    note: note?.trim() || '',
    authorityManager: authorityManager !== undefined && authorityManager !== '' ? Number(authorityManager) : 0,
    authority: authority || ''
  })

  if (result.error) {
    throw ApiError.badRequest('Validation failed', [{ field: result.error, message: result.message }])
  }

  // Log successful signup
  const clientInfo = getClientInfo(req)
  createAuthLog({
    authAction: 'signup',
    userId: singleid.trim(),
    ...clientInfo
  }).catch(err => console.error('Failed to save auth log:', err.message))

  res.status(201).json(result)
}

/**
 * POST /api/auth/request-password-reset
 * Request password reset
 */
async function requestPasswordReset(req, res) {
  const { singleid } = req.body

  if (!singleid) {
    throw ApiError.badRequest('사용자 ID를 입력해주세요')
  }

  const result = await authService.requestPasswordReset(singleid)

  // Log password reset request
  const clientInfo = getClientInfo(req)
  createAuthLog({
    authAction: 'password_reset_request',
    userId: singleid,
    ...clientInfo
  }).catch(err => console.error('Failed to save auth log:', err.message))

  res.json(result)
}

/**
 * POST /api/auth/change-password
 * Change password (for logged-in users)
 */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('현재 비밀번호와 새 비밀번호를 입력해주세요')
  }

  if (newPassword.length < 8) {
    throw ApiError.badRequest('새 비밀번호는 8자 이상이어야 합니다')
  }

  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw ApiError.badRequest('새 비밀번호는 영문과 숫자를 포함해야 합니다')
  }

  const result = await authService.changePassword(req.user.id, currentPassword, newPassword)

  if (result.error) {
    throw ApiError.badRequest(result.error)
  }

  // Log password changed
  const clientInfo = getClientInfo(req)
  createAuthLog({
    authAction: 'password_changed',
    userId: req.user?.singleid || req.user?.id,
    ...clientInfo
  }).catch(err => console.error('Failed to save auth log:', err.message))

  res.json(result)
}

/**
 * POST /api/auth/set-new-password
 * Set new password after reset approval
 */
async function setNewPassword(req, res) {
  const { newPassword } = req.body

  if (!newPassword) {
    throw ApiError.badRequest('새 비밀번호를 입력해주세요')
  }

  if (newPassword.length < 8) {
    throw ApiError.badRequest('새 비밀번호는 8자 이상이어야 합니다')
  }

  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw ApiError.badRequest('새 비밀번호는 영문과 숫자를 포함해야 합니다')
  }

  const result = await authService.setNewPassword(req.user.id, newPassword)

  if (result.error) {
    throw ApiError.badRequest(result.error)
  }

  // Log password changed (after reset)
  const clientInfo = getClientInfo(req)
  createAuthLog({
    authAction: 'password_changed',
    userId: req.user?.singleid || req.user?.id,
    ...clientInfo
  }).catch(err => console.error('Failed to save auth log:', err.message))

  res.json(result)
}

/**
 * GET /api/auth/signup-options
 * Get processes, lines, roles, and authorities for signup form (public)
 * Uses EQP_INFO collection for process/line data
 */
async function getSignupOptions(req, res) {
  const { getProcesses, getLines } = require('../clients/service')
  const { DEFAULT_ROLE_PERMISSIONS } = require('../users/model')

  const [processes, lines] = await Promise.all([
    getProcesses(),
    getLines()
  ])

  // Map roles from DEFAULT_ROLE_PERMISSIONS
  const roles = DEFAULT_ROLE_PERMISSIONS.map(r => ({
    level: r.roleLevel,
    name: r.roleName,
    description: r.description
  }))

  // Authority options (RPA 권한)
  const authorities = [
    { value: '', label: '없음 (읽기만 가능)' },
    { value: 'WRITE', label: '쓰기 권한' }
  ]

  res.json({ processes, lines, roles, authorities })
}

module.exports = {
  login,
  refresh,
  logout,
  me,
  signup,
  requestPasswordReset,
  changePassword,
  setNewPassword,
  getSignupOptions
}
