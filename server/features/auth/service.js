/**
 * Authentication service
 */

const bcrypt = require('bcryptjs')
const { generateToken, generateRefreshToken, verifyToken } = require('../../shared/utils/jwt')
const { getUserBySingleId, getRolePermissionByLevel } = require('../users/service')
const { User } = require('../users/model')

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12

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

  // Check account status
  if (user.accountStatus === 'pending') {
    return { error: '계정이 승인 대기 중입니다. 관리자 승인 후 로그인 가능합니다.' }
  }
  if (user.accountStatus === 'suspended') {
    return { error: '계정이 비활성화되었습니다. 관리자에게 문의하세요.' }
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

  // Derive login stats from webmanagerLoginInfo (before updating)
  const loginInfo = user.webmanagerLoginInfo || {}
  const lastLoginAt = loginInfo.lastLoginAt || null
  const loginCount = (loginInfo.loginCount || 0) + 1

  // Update login info: set lastLoginAt, increment loginCount (fire-and-forget)
  User.updateOne(
    { _id: user._id },
    { $set: { 'webmanagerLoginInfo.lastLoginAt': new Date() }, $inc: { 'webmanagerLoginInfo.loginCount': 1 } }
  ).catch(err => console.error('Failed to update webmanagerLoginInfo:', err.message))

  // Return user data without password
  const { password: _, webmanagerLoginInfo: __, ...userWithoutPassword } = user

  return {
    success: true,
    token,
    refreshToken,
    mustChangePassword: user.passwordStatus === 'must_change',
    user: {
      ...userWithoutPassword,
      lastLoginAt,
      loginCount,
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

  if (!user || user.accountStatus !== 'active') {
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
  const user = await User.findById(tokenPayload.id).select('-password -webmanagerLoginInfo').lean()

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

/**
 * Sign up a new user
 * @param {Object} userData - User registration data
 * @returns {Object} - Result with success status
 */
async function signup(userData) {
  const { name, singleid, password, email, line, process, department, note, authorityManager, authority } = userData

  // Check if singleid already exists
  const existingUser = await User.findOne({ singleid }).lean()
  if (existingUser) {
    return { error: 'singleid', message: '이미 사용 중인 ID입니다' }
  }

  // Check if email already exists (if provided)
  if (email) {
    const existingEmail = await User.findOne({ email: email.toLowerCase() }).lean()
    if (existingEmail) {
      return { error: 'email', message: '이미 사용 중인 이메일입니다' }
    }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

  // Create user with pending status
  // Note: authorityManager and authority are requested values that admin can modify on approval
  const newUser = new User({
    name,
    singleid,
    password: hashedPassword,
    email: email?.toLowerCase() || '',
    line,
    process,
    department: department || '',
    note: note || '',
    accountStatus: 'pending',
    passwordStatus: 'normal',
    authorityManager: authorityManager ?? 0,
    authority: authority || '',
    accessnum: 0,
    accessnum_desktop: 0
  })

  await newUser.save()

  return {
    success: true,
    message: '회원가입이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.',
    user: {
      singleid: newUser.singleid,
      name: newUser.name,
      email: newUser.email,
      accountStatus: newUser.accountStatus,
      authorityManager: newUser.authorityManager,
      authority: newUser.authority
    }
  }
}

/**
 * Request password reset
 * @param {string} singleid - User ID
 * @returns {Object} - Result
 */
async function requestPasswordReset(singleid) {
  const user = await User.findOne({ singleid })

  if (!user) {
    // Return success even if user not found (security)
    return {
      success: true,
      message: '비밀번호 초기화 요청이 접수되었습니다. 관리자 승인 후 로그인 시 새 비밀번호를 설정할 수 있습니다.'
    }
  }

  // Set password status to reset_requested
  user.passwordStatus = 'reset_requested'
  user.passwordResetRequestedAt = new Date()
  await user.save()

  return {
    success: true,
    message: '비밀번호 초기화 요청이 접수되었습니다. 관리자 승인 후 로그인 시 새 비밀번호를 설정할 수 있습니다.'
  }
}

/**
 * Change password (for logged-in users)
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Object} - Result
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId)

  if (!user) {
    return { error: 'User not found' }
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password)
  if (!isValid) {
    return { error: '현재 비밀번호가 일치하지 않습니다' }
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS)

  // Update password
  user.password = hashedPassword
  await user.save()

  return {
    success: true,
    message: '비밀번호가 변경되었습니다.'
  }
}

/**
 * Set new password (after reset approval)
 * @param {string} userId - User ID
 * @param {string} newPassword - New password
 * @returns {Object} - Result
 */
async function setNewPassword(userId, newPassword) {
  const user = await User.findById(userId)

  if (!user) {
    return { error: 'User not found' }
  }

  if (user.passwordStatus !== 'must_change') {
    return { error: '비밀번호 변경이 필요하지 않습니다' }
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS)

  // Update password and reset status
  user.password = hashedPassword
  user.passwordStatus = 'normal'
  user.passwordResetRequestedAt = null
  await user.save()

  return {
    success: true,
    message: '비밀번호가 설정되었습니다.'
  }
}

/**
 * Approve password reset (admin function)
 * @param {string} userId - User ID to approve
 * @returns {Object} - Result
 */
async function approvePasswordReset(userId) {
  const user = await User.findById(userId)

  if (!user) {
    return { error: 'User not found' }
  }

  // Set password status to must_change
  user.passwordStatus = 'must_change'
  user.passwordResetRequestedAt = null
  await user.save()

  return {
    success: true,
    message: '비밀번호 초기화가 승인되었습니다.'
  }
}

/**
 * Approve user account (admin function)
 * @param {string} userId - User ID to approve
 * @returns {Object} - Result
 */
async function approveUserAccount(userId) {
  const user = await User.findById(userId)

  if (!user) {
    return { error: 'User not found' }
  }

  // Activate user
  user.accountStatus = 'active'
  await user.save()

  return {
    success: true,
    message: '계정이 활성화되었습니다.'
  }
}

module.exports = {
  login,
  refreshAccessToken,
  getCurrentUser,
  signup,
  requestPasswordReset,
  changePassword,
  setNewPassword,
  approvePasswordReset,
  approveUserAccount
}
