/**
 * User validation utilities
 */

/**
 * Validate user data for create/update operations
 * @param {Object} userData - User data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} - { valid: boolean, errors: Array }
 */
function validateUser(userData, isUpdate = false) {
  const errors = []

  // Name validation
  if (!isUpdate || userData.name !== undefined) {
    if (!userData.name || userData.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name is required' })
    } else if (userData.name.length > 100) {
      errors.push({ field: 'name', message: 'Name must be at most 100 characters' })
    }
  }

  // SingleID validation
  if (!isUpdate || userData.singleid !== undefined) {
    if (!userData.singleid || userData.singleid.trim().length === 0) {
      errors.push({ field: 'singleid', message: 'User ID is required' })
    } else if (userData.singleid.length > 50) {
      errors.push({ field: 'singleid', message: 'User ID must be at most 50 characters' })
    } else if (!/^[A-Za-z0-9_-]+$/.test(userData.singleid)) {
      errors.push({ field: 'singleid', message: 'User ID can only contain letters, numbers, underscores, and hyphens' })
    }
  }

  // Password validation (only required for create)
  if (!isUpdate) {
    if (!userData.password || userData.password.length < 4) {
      errors.push({ field: 'password', message: 'Password must be at least 4 characters' })
    }
  } else if (userData.password !== undefined && userData.password.length > 0 && userData.password.length < 4) {
    errors.push({ field: 'password', message: 'Password must be at least 4 characters' })
  }

  // Line validation
  if (!isUpdate || userData.line !== undefined) {
    if (!userData.line || userData.line.trim().length === 0) {
      errors.push({ field: 'line', message: 'Line is required' })
    } else if (userData.line.length > 50) {
      errors.push({ field: 'line', message: 'Line must be at most 50 characters' })
    }
  }

  // Process validation (either process or processes should be provided)
  const hasProcess = userData.process && userData.process.trim().length > 0
  const hasProcesses = userData.processes && Array.isArray(userData.processes) && userData.processes.length > 0

  if (!isUpdate || userData.process !== undefined || userData.processes !== undefined) {
    if (!hasProcess && !hasProcesses) {
      errors.push({ field: 'process', message: 'Process is required' })
    } else if (userData.process && userData.process.length > 200) {
      errors.push({ field: 'process', message: 'Process must be at most 200 characters' })
    }
  }

  // Processes array validation
  if (userData.processes !== undefined) {
    if (!Array.isArray(userData.processes)) {
      errors.push({ field: 'processes', message: 'Processes must be an array' })
    } else {
      for (let i = 0; i < userData.processes.length; i++) {
        const proc = userData.processes[i]
        if (typeof proc !== 'string' || proc.trim().length === 0) {
          errors.push({ field: 'processes', message: `Invalid process value at index ${i}` })
          break
        }
        if (proc.length > 50) {
          errors.push({ field: 'processes', message: `Process "${proc}" must be at most 50 characters` })
          break
        }
      }
    }
  }

  // Authority validation
  if (userData.authority !== undefined) {
    if (!['', 'WRITE'].includes(userData.authority)) {
      errors.push({ field: 'authority', message: 'Authority must be empty or WRITE' })
    }
  }

  // AuthorityManager validation
  if (!isUpdate || userData.authorityManager !== undefined) {
    const authMgr = Number(userData.authorityManager)
    if (isNaN(authMgr) || authMgr < 0 || authMgr > 3) {
      errors.push({ field: 'authorityManager', message: 'Authority level must be between 0 and 3' })
    }
  }

  // Email validation (optional but must be valid if provided)
  if (userData.email !== undefined && userData.email.trim() !== '') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.push({ field: 'email', message: 'Invalid email format' })
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate batch user creation
 * @param {Array} users - Array of user data
 * @param {Array} existingSingleIds - Existing user IDs to check for duplicates
 * @returns {Object} - { valid: Array, errors: Array }
 */
function validateBatchCreate(users, existingSingleIds = []) {
  const valid = []
  const errors = []
  const seenIds = new Set(existingSingleIds.map(id => id.toLowerCase()))

  users.forEach((user, index) => {
    const validation = validateUser(user, false)

    if (!validation.valid) {
      validation.errors.forEach(err => {
        errors.push({ rowIndex: index, field: err.field, message: err.message })
      })
      return
    }

    // Check for duplicate singleid
    const lowerSingleId = user.singleid.toLowerCase()
    if (seenIds.has(lowerSingleId)) {
      errors.push({ rowIndex: index, field: 'singleid', message: 'User ID already exists' })
      return
    }

    seenIds.add(lowerSingleId)
    valid.push(user)
  })

  return { valid, errors }
}

/**
 * Validate batch user update
 * @param {Object} userData - User data to update
 * @param {Array} existingSingleIds - Other users' IDs (excluding current user)
 * @returns {Object} - { valid: boolean, errors: Object }
 */
function validateUpdate(userData, existingSingleIds = []) {
  const validation = validateUser(userData, true)
  const errors = { ...Object.fromEntries(validation.errors.map(e => [e.field, e.message])) }

  // Check for duplicate singleid if changed
  if (userData.singleid) {
    const lowerSingleId = userData.singleid.toLowerCase()
    if (existingSingleIds.some(id => id.toLowerCase() === lowerSingleId)) {
      errors.singleid = 'User ID already exists'
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  }
}

module.exports = {
  validateUser,
  validateBatchCreate,
  validateUpdate
}
