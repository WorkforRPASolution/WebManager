/**
 * User service - Database operations and business logic
 */

const bcrypt = require('bcryptjs')
const { User, RolePermission, DEFAULT_ROLE_PERMISSIONS } = require('./model')
const { parsePaginationParams } = require('../../shared/utils/pagination')
const { validateBatchCreate, validateUpdate } = require('./validation')
const { makeAuditHelper, calculateChanges } = require('../../shared/models/webmanagerLogModel')
const { createLogger } = require('../../shared/logger')
const { toLong, stripNullFields, separateNullFields } = require('../../shared/utils/mongoLong')
const log = createLogger('users')

const SENSITIVE_FIELDS = ['password']
const logUserAudit = makeAuditHelper('ARS_USER_INFO', { sensitiveFields: SENSITIVE_FIELDS, log })


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

  // Multi-process filtering: process 필드(세미콜론 구분 문자열)에서 매칭
  if (filters.processes && filters.processes.length > 0) {
    // 여러 process 중 하나라도 포함된 사용자 (OR)
    const escaped = filters.processes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    query.process = { $regex: new RegExp(`(^|;)(${escaped.join('|')})(;|$)`, 'i') }
  } else if (filters.process) {
    const escaped = filters.process.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.process = { $regex: new RegExp(`(^|;)${escaped}(;|$)`, 'i') }
  }

  // 키워드 검색 시 process 권한 필터링 (userProcesses가 전달된 경우)
  // process 필터가 이미 설정된 경우에는 적용하지 않음
  if (filters.userProcesses && Array.isArray(filters.userProcesses) && filters.userProcesses.length > 0 && !filters.processes && !filters.process) {
    const escaped = filters.userProcesses.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    query.process = { $regex: new RegExp(`(^|;)(${escaped.join('|')})(;|$)`, 'i') }
  }

  if (filters.authority) {
    if (filters.authority === 'WRITE') {
      query.authority = 'WRITE'
    } else if (filters.authority === 'NONE') {
      query.authority = { $in: [null, '', undefined] }
    }
  }

  if (filters.authorityManager) {
    if (Array.isArray(filters.authorityManager)) {
      query.authorityManager = { $in: filters.authorityManager.map(Number) }
    } else if (filters.authorityManager !== '') {
      query.authorityManager = Number(filters.authorityManager)
    }
  }

  // Filter by account status (single or multi)
  if (filters.accountStatus) {
    query.accountStatus = Array.isArray(filters.accountStatus)
      ? { $in: filters.accountStatus }
      : filters.accountStatus
  }

  // Filter by password status (single or multi)
  if (filters.passwordStatus) {
    query.passwordStatus = Array.isArray(filters.passwordStatus)
      ? { $in: filters.passwordStatus }
      : filters.passwordStatus
  }

  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { singleid: { $regex: filters.search, $options: 'i' } }
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

  const usersWithStats = users.map(u => {
    const { webmanagerLoginInfo, ...rest } = u
    // [process → processes 동기화]
    // process 필드가 단일 진실 소스 (source of truth).
    // Akka 시스템이 process를 외부에서 변경할 수 있으므로,
    // DB의 processes 배열이 stale할 수 있음.
    // 조회 시 항상 process에서 재생성하여 불일치 방지.
    // (WebManager 저장 시에는 syncProcessFields()가 역방향 동기화)
    if (rest.process) {
      rest.processes = rest.process.split(';').map(p => p.trim()).filter(Boolean)
    }
    return {
      ...rest,
      lastLoginAt: webmanagerLoginInfo?.lastLoginAt || null,
      loginCount: webmanagerLoginInfo?.loginCount || 0
    }
  })

  return {
    data: usersWithStats,
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
  const user = await User.findById(id).select('-password -webmanagerLoginInfo').lean()
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
 * @param {Array} usersData
 * @param {Object} context - { user } execution context
 */
async function createUsers(usersData, context = {}) {
  // Get existing records for validation
  const existingRecords = await User.find({}, 'singleid').lean()

  // Validate
  const { valid, errors } = validateBatchCreate(usersData, existingRecords)

  // Hash passwords and insert valid users
  let created = 0
  if (valid.length > 0) {
    const usersToCreate = await Promise.all(
      valid.map(async (user) => {
        // Sync process ↔ processes fields
        const syncedUser = syncProcessFields({ ...user })
        return {
          ...syncedUser,
          ...(user.password ? { password: await bcrypt.hash(user.password, SALT_ROUNDS) } : {}),
          authorityManager: toLong(Number(user.authorityManager) ?? 3)
        }
      })
    )

    // NumberLong 변환 + null 필드 제거
    const prepared = usersToCreate.map(u => stripNullFields(u))
    const inserted = await User.insertMany(prepared)
    created = inserted.length

    // Audit logging (fire-and-forget)
    for (const doc of inserted) {
      const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc
      logUserAudit('create', plain.singleid || plain._id, context, { newData: plain })
    }
  }

  return { created, errors }
}

/**
 * Update multiple users
 * @param {Array} usersData
 * @param {Object} context - { user } execution context
 */
async function updateUsers(usersData, context = {}) {
  const errors = []
  let updated = 0

  // Get all users once (avoid N+1 — audit + validation 모두 사용)
  const allUsers = await User.find({}).select('-webmanagerLoginInfo').lean()
  const allUsersById = new Map(allUsers.map(u => [u._id.toString(), u]))

  for (let i = 0; i < usersData.length; i++) {
    const userData = usersData[i]
    const { _id, ...updateData } = userData

    if (!_id) {
      errors.push({ rowIndex: i, field: '_id', message: '_id is required for update' })
      continue
    }

    // Get existing document from pre-fetched map (no N+1)
    const existingDoc = allUsersById.get(_id)

    // Get other users (excluding current one)
    const otherRecords = allUsers.filter(u => u._id.toString() !== _id)

    // Validate
    const validation = validateUpdate(updateData, otherRecords)

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

    // Ensure authorityManager is NumberLong
    if (updateData.authorityManager !== undefined) {
      updateData.authorityManager = toLong(Number(updateData.authorityManager))
    }

    // Sync process ↔ processes fields if either is being updated
    if (updateData.processes !== undefined || updateData.process !== undefined) {
      syncProcessFields(updateData)
    }

    // null 필드를 $unset으로 분리
    const { $set, $unset } = separateNullFields(updateData)
    const update = {}
    if (Object.keys($set).length > 0) update.$set = $set
    if (Object.keys($unset).length > 0) update.$unset = $unset
    if (Object.keys(update).length === 0) continue
    const result = await User.updateOne({ _id }, update)
    if (result.modifiedCount > 0) {
      updated++

      // Audit logging (fire-and-forget)
      if (existingDoc) {
        const updatedDoc = await User.findById(_id).select('-webmanagerLoginInfo').lean()
        if (updatedDoc) {
          const changes = calculateChanges(existingDoc, updatedDoc, { sensitiveFields: SENSITIVE_FIELDS })
          if (Object.keys(changes).length > 0) {
            logUserAudit('update', existingDoc.singleid || _id, context, {
              changes, previousData: existingDoc, newData: updatedDoc
            })
          }
        }
      }
    }
  }

  return { updated, errors }
}

/**
 * Delete multiple users
 * @param {Array} ids
 * @param {Object} context - { user } execution context
 */
async function deleteUsers(ids, context = {}) {
  // Get documents before deletion for audit
  const docsToDelete = await User.find({ _id: { $in: ids } }).select('-webmanagerLoginInfo').lean()

  const result = await User.deleteMany({ _id: { $in: ids } })

  // Audit logging (fire-and-forget)
  for (const doc of docsToDelete) {
    logUserAudit('delete', doc.singleid || doc._id, context, { previousData: doc })
  }

  return { deleted: result.deletedCount }
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
 * @param {number} level - Role level
 * @param {Object} permissions - New permissions
 * @param {Object} context - { user } execution context
 */
async function updateRolePermissions(level, permissions, context = {}) {
  const longLevel = toLong(Number(level))
  // Get previous state for audit
  const previousDoc = await RolePermission.findOne({ roleLevel: longLevel }).lean()

  const result = await RolePermission.findOneAndUpdate(
    { roleLevel: longLevel },
    { $set: { permissions } },
    { returnDocument: 'after', runValidators: true }
  ).lean()

  // Audit logging (fire-and-forget)
  if (result && previousDoc) {
    const changes = calculateChanges(previousDoc.permissions || {}, permissions)
    if (Object.keys(changes).length > 0) {
      const roleAudit = makeAuditHelper('WEBMANAGER_ROLE_PERMISSIONS', { log })
      roleAudit('update', `role_${level}`, context, {
        changes,
        previousData: { roleLevel: level, permissions: previousDoc.permissions },
        newData: { roleLevel: level, permissions }
      })
    }
  }

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
    const defaultRole = DEFAULT_ROLE_PERMISSIONS.find(r => Number(r.roleLevel) === Number(dbRole.roleLevel))
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
    log.info(`Created ${result.created} role permissions`)
  }
  if (result.addedFields.length > 0) {
    log.info(`Added permission fields: ${result.addedFields.join(', ')}`)
  }
  if (result.removedFields.length > 0) {
    log.info(`Removed permission fields: ${result.removedFields.join(', ')}`)
  }
  if (result.synced > 0) {
    log.info(`Synced ${result.synced} role(s)`)
  }

  return result.created > 0 || result.synced > 0
}

// ===========================================
// Filter Options
// ===========================================

/**
 * Get distinct process values from process field (semicolon-separated string)
 * @param {string[]} userProcesses - User's process permissions (for filtering)
 */
async function getProcesses(userProcesses) {
  // processes 배열을 $unwind하여 process별 사용자 수를 정확하게 카운트
  const pipeline = [
    // processes 배열이 있으면 사용, 없으면 process 문자열에서 split
    { $addFields: {
      _procs: {
        $cond: {
          if: { $and: [{ $isArray: '$processes' }, { $gt: [{ $size: '$processes' }, 0] }] },
          then: '$processes',
          else: { $split: [{ $ifNull: ['$process', ''] }, ';'] }
        }
      }
    }},
    { $unwind: '$_procs' },
    { $match: { _procs: { $nin: [null, ''] } } },
    { $group: { _id: '$_procs', count: { $sum: 1 } } },
    { $project: { _id: 0, value: '$_id', count: 1 } },
    { $sort: { value: 1 } }
  ]

  let results = await User.aggregate(pipeline)

  // If userProcesses is provided, filter to only include processes the user has access to
  if (userProcesses && userProcesses.length > 0) {
    const userProcessUpper = userProcesses.map(p => p.toUpperCase())
    results = results.filter(r => userProcessUpper.includes(r.value.toUpperCase()))
  }

  return results
}

/**
 * Get distinct line values
 * @param {string} processFilter - Comma-separated process values (supports multiple, explicit selection)
 * @param {string[]} userProcesses - User's process permissions (for filtering when no explicit selection)
 */
async function getLines(processFilter, userProcesses) {
  const query = {}
  // 복수 process 지원: process 필드(세미콜론 구분 문자열)에서 매칭
  if (processFilter) {
    const processes = processFilter.split(',').map(p => p.trim()).filter(p => p)
    if (processes.length > 0) {
      const escaped = processes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      query.process = { $regex: new RegExp(`(^|;)(${escaped.join('|')})(;|$)`, 'i') }
    }
  } else if (userProcesses && userProcesses.length > 0) {
    // Process 선택 없이 조회 시 사용자 권한으로 필터링
    const escaped = userProcesses.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    query.process = { $regex: new RegExp(`(^|;)(${escaped.join('|')})(;|$)`, 'i') }
  }
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

  // Role Permissions
  getRolePermissions,
  getRolePermissionByLevel,
  updateRolePermissions,
  initializeRolePermissions,

  // Filter Options
  getProcesses,
  getLines
}
