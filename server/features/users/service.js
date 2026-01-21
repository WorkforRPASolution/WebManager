/**
 * User service - Database operations and business logic
 */

const bcrypt = require('bcrypt')
const { User, RolePermission, DEFAULT_ROLE_PERMISSIONS } = require('./model')
const { parsePaginationParams } = require('../../shared/utils/pagination')
const { validateBatchCreate, validateUpdate } = require('./validation')

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12

// ===========================================
// User CRUD Operations
// ===========================================

/**
 * Get users with filtering and pagination
 */
async function getUsers(filters = {}, paginationQuery = {}) {
  const query = {}

  if (filters.process) {
    query.process = filters.process
  }

  if (filters.line) {
    query.line = filters.line
  }

  if (filters.authorityManager !== undefined && filters.authorityManager !== '') {
    query.authorityManager = Number(filters.authorityManager)
  }

  if (filters.isActive !== undefined && filters.isActive !== '') {
    query.isActive = filters.isActive === 'true' || filters.isActive === true
  }

  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { singleid: { $regex: filters.search, $options: 'i' } },
      { email: { $regex: filters.search, $options: 'i' } }
    ]
  }

  const { page, pageSize, skip, limit } = parsePaginationParams(paginationQuery)

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query)
  ])

  return {
    data: users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

/**
 * Get user by ID
 */
async function getUserById(id) {
  const user = await User.findById(id).select('-password').lean()
  return user
}

/**
 * Get user by singleid (for authentication)
 */
async function getUserBySingleId(singleid) {
  const user = await User.findOne({ singleid }).lean()
  return user
}

/**
 * Create multiple users
 */
async function createUsers(usersData) {
  // Get existing singleids for validation
  const existingUsers = await User.find({}, 'singleid').lean()
  const existingSingleIds = existingUsers.map(u => u.singleid)

  // Validate
  const { valid, errors } = validateBatchCreate(usersData, existingSingleIds)

  // Hash passwords and insert valid users
  let created = 0
  if (valid.length > 0) {
    const usersToCreate = await Promise.all(
      valid.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, SALT_ROUNDS),
        authorityManager: Number(user.authorityManager) ?? 3
      }))
    )

    const inserted = await User.insertMany(usersToCreate)
    created = inserted.length
  }

  return { created, errors }
}

/**
 * Update multiple users
 */
async function updateUsers(usersData) {
  const errors = []
  let updated = 0

  // Get all other users' singleids once (avoid N+1)
  const allUsers = await User.find({}, '_id singleid').lean()

  for (let i = 0; i < usersData.length; i++) {
    const userData = usersData[i]
    const { _id, ...updateData } = userData

    if (!_id) {
      errors.push({ rowIndex: i, field: '_id', message: '_id is required for update' })
      continue
    }

    // Get other users (excluding current one)
    const otherUsers = allUsers.filter(u => u._id.toString() !== _id)
    const existingSingleIds = otherUsers.map(u => u.singleid)

    // Validate
    const validation = validateUpdate(updateData, existingSingleIds)

    if (!validation.valid) {
      for (const [field, message] of Object.entries(validation.errors)) {
        errors.push({ rowIndex: i, field, message })
      }
      continue
    }

    // Hash password if provided
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, SALT_ROUNDS)
    }

    // Ensure authorityManager is a number
    if (updateData.authorityManager !== undefined) {
      updateData.authorityManager = Number(updateData.authorityManager)
    }

    const result = await User.updateOne({ _id }, { $set: updateData })
    if (result.modifiedCount > 0) {
      updated++
    }
  }

  return { updated, errors }
}

/**
 * Delete multiple users
 */
async function deleteUsers(ids) {
  const result = await User.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

/**
 * Update last login timestamp
 */
async function updateLastLogin(userId) {
  await User.updateOne(
    { _id: userId },
    {
      $set: { lastLoginAt: new Date() },
      $inc: { accessnum: 1 }
    }
  )
}

// ===========================================
// Role Permission Operations
// ===========================================

/**
 * Get all role permissions
 */
async function getRolePermissions() {
  const roles = await RolePermission.find().sort({ roleLevel: 1 }).lean()
  return roles
}

/**
 * Get role permission by level
 */
async function getRolePermissionByLevel(level) {
  const role = await RolePermission.findOne({ roleLevel: level }).lean()
  return role
}

/**
 * Update role permissions
 */
async function updateRolePermissions(level, permissions) {
  const result = await RolePermission.findOneAndUpdate(
    { roleLevel: level },
    { $set: { permissions } },
    { new: true, runValidators: true }
  ).lean()

  return result
}

/**
 * Initialize default role permissions if not exist
 */
async function initializeRolePermissions() {
  const count = await RolePermission.countDocuments()
  if (count === 0) {
    await RolePermission.insertMany(DEFAULT_ROLE_PERMISSIONS)
    console.log('Default role permissions initialized')
    return true
  }
  return false
}

// ===========================================
// Filter Options
// ===========================================

/**
 * Get distinct process values
 */
async function getProcesses() {
  const processes = await User.distinct('process')
  return processes.filter(p => p).sort()
}

/**
 * Get distinct line values
 */
async function getLines(process) {
  const query = process ? { process } : {}
  const lines = await User.distinct('line', query)
  return lines.filter(l => l).sort()
}

module.exports = {
  // User CRUD
  getUsers,
  getUserById,
  getUserBySingleId,
  createUsers,
  updateUsers,
  deleteUsers,
  updateLastLogin,

  // Role Permissions
  getRolePermissions,
  getRolePermissionByLevel,
  updateRolePermissions,
  initializeRolePermissions,

  // Filter Options
  getProcesses,
  getLines
}
