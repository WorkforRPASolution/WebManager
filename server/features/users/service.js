/**
 * User service - Database operations and business logic
 */

const bcrypt = require('bcrypt')
const { User, RolePermission, DEFAULT_ROLE_PERMISSIONS } = require('./model')
const { parsePaginationParams } = require('../../shared/utils/pagination')
const { validateBatchCreate, validateUpdate } = require('./validation')

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12

// ===========================================
// Process Field Synchronization
// ===========================================

/**
 * Sync processes (array) ↔ process (string with `;` separator)
 * @param {Object} userData - User data to sync
 * @returns {Object} - Synced user data
 */
function syncProcessFields(userData) {
  if (userData.processes && Array.isArray(userData.processes) && userData.processes.length > 0) {
    // processes → process: Join array with `;`
    userData.process = userData.processes.join(';')
  } else if (userData.process && (!userData.processes || userData.processes.length === 0)) {
    // process → processes: Split string by `;`
    userData.processes = userData.process.split(';').map(p => p.trim()).filter(Boolean)
  }
  return userData
}

// ===========================================
// User CRUD Operations
// ===========================================

/**
 * Get users with filtering and pagination
 */
async function getUsers(filters = {}, paginationQuery = {}) {
  const query = {}

  // Multi-process filtering with OR logic (any match)
  if (filters.processes && filters.processes.length > 0) {
    // Array of processes: use $in operator on processes array field
    query.processes = { $in: filters.processes }
  } else if (filters.process) {
    // Single process: use $in on processes array field for backward compatibility
    query.processes = { $in: [filters.process] }
  }

  if (filters.line) {
    query.line = filters.line
  }

  if (filters.authorityManager !== undefined && filters.authorityManager !== '') {
    query.authorityManager = Number(filters.authorityManager)
  }

  // Filter by account status
  if (filters.accountStatus) {
    query.accountStatus = filters.accountStatus
  }

  // Filter by password status
  if (filters.passwordStatus) {
    query.passwordStatus = filters.passwordStatus
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
      valid.map(async (user) => {
        // Sync process ↔ processes fields
        const syncedUser = syncProcessFields({ ...user })
        return {
          ...syncedUser,
          password: await bcrypt.hash(user.password, SALT_ROUNDS),
          authorityManager: Number(user.authorityManager) ?? 3
        }
      })
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

    // Sync process ↔ processes fields if either is being updated
    if (updateData.processes !== undefined || updateData.process !== undefined) {
      syncProcessFields(updateData)
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
 * Sync role permissions with code definitions
 * - Add missing permission fields
 * - Remove obsolete permission fields
 * @returns {Promise<{created: number, synced: number, addedFields: string[], removedFields: string[]}>}
 */
async function syncRolePermissions() {
  const result = { created: 0, synced: 0, addedFields: [], removedFields: [] }

  // Get all permission keys defined in code
  const codePermissionKeys = Object.keys(DEFAULT_ROLE_PERMISSIONS[0].permissions)

  // Check if collection is empty
  const count = await RolePermission.countDocuments()
  if (count === 0) {
    await RolePermission.insertMany(DEFAULT_ROLE_PERMISSIONS)
    result.created = DEFAULT_ROLE_PERMISSIONS.length
    return result
  }

  // Sync each role's permissions
  const dbRoles = await RolePermission.find().lean()

  for (const dbRole of dbRoles) {
    const defaultRole = DEFAULT_ROLE_PERMISSIONS.find(r => r.roleLevel === dbRole.roleLevel)
    if (!defaultRole) continue

    const dbPermissionKeys = Object.keys(dbRole.permissions || {})
    const updates = {}
    const unsets = {}
    let needsUpdate = false

    // Add missing permission fields
    for (const key of codePermissionKeys) {
      if (!dbPermissionKeys.includes(key)) {
        updates[`permissions.${key}`] = defaultRole.permissions[key]
        if (!result.addedFields.includes(key)) {
          result.addedFields.push(key)
        }
        needsUpdate = true
      }
    }

    // Remove obsolete permission fields
    for (const key of dbPermissionKeys) {
      if (!codePermissionKeys.includes(key)) {
        unsets[`permissions.${key}`] = ''
        if (!result.removedFields.includes(key)) {
          result.removedFields.push(key)
        }
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      const updateQuery = {}
      if (Object.keys(updates).length > 0) {
        updateQuery.$set = updates
      }
      if (Object.keys(unsets).length > 0) {
        updateQuery.$unset = unsets
      }
      await RolePermission.updateOne({ _id: dbRole._id }, updateQuery)
      result.synced++
    }
  }

  return result
}

/**
 * Initialize default role permissions if not exist (legacy - calls syncRolePermissions)
 */
async function initializeRolePermissions() {
  const result = await syncRolePermissions()

  if (result.created > 0) {
    console.log(`  + Created ${result.created} role permissions`)
  }
  if (result.addedFields.length > 0) {
    console.log(`  + Added permission fields: ${result.addedFields.join(', ')}`)
  }
  if (result.removedFields.length > 0) {
    console.log(`  - Removed permission fields: ${result.removedFields.join(', ')}`)
  }
  if (result.synced > 0) {
    console.log(`  ✓ Synced ${result.synced} role(s)`)
  }

  return result.created > 0 || result.synced > 0
}

// ===========================================
// Filter Options
// ===========================================

/**
 * Get distinct process values from processes array field
 */
async function getProcesses() {
  // Get distinct values from processes array field
  const processesFromArray = await User.distinct('processes')
  return processesFromArray.filter(p => p).sort()
}

/**
 * Get distinct line values
 */
async function getLines(process) {
  // Use processes array field for filtering
  const query = process ? { processes: { $in: [process] } } : {}
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
