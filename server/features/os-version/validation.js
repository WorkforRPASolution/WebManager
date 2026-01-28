/**
 * OS Version validation rules and helpers
 */

// Validation patterns
const patterns = {
  // Allowed characters: alphanumeric, space, dot, dash
  version: /^[A-Za-z0-9.\- ]+$/
}

/**
 * Validate OS version data
 * @param {Object} data - OS version data to validate
 * @returns {Object|null} - Validation errors or null if valid
 */
function validateOSVersionData(data) {
  const errors = {}

  // version is required
  if (!data.version || (typeof data.version === 'string' && !data.version.trim())) {
    errors.version = 'version is required'
  } else if (!patterns.version.test(data.version)) {
    errors.version = 'version: 영문, 숫자, 공백, ., - 만 허용'
  }

  return Object.keys(errors).length > 0 ? errors : null
}

/**
 * Validate batch of OS version data for creation
 * @param {Array} items - Array of OS version data
 * @param {Array} existingVersions - Existing versions (lowercase)
 * @returns {Object} - { valid: [], errors: [] }
 */
function validateBatchCreate(items, existingVersions) {
  const valid = []
  const errors = []
  const batchVersions = []

  for (let i = 0; i < items.length; i++) {
    const itemData = items[i]
    const versionLower = itemData.version?.toLowerCase?.() || ''

    // Check for duplicate version within batch
    if (versionLower && batchVersions.includes(versionLower)) {
      errors.push({ rowIndex: i, field: 'version', message: '중복된 버전' })
      continue
    }

    // Check for duplicate version against existing data
    if (versionLower && existingVersions.includes(versionLower)) {
      errors.push({ rowIndex: i, field: 'version', message: '이미 존재하는 버전' })
      continue
    }

    const validationErrors = validateOSVersionData(itemData)

    if (validationErrors) {
      for (const [field, message] of Object.entries(validationErrors)) {
        errors.push({ rowIndex: i, field, message })
      }
    } else {
      if (versionLower) {
        batchVersions.push(versionLower)
      }
      valid.push(itemData)
    }
  }

  return { valid, errors }
}

/**
 * Validate OS version data for update
 * @param {Object} data - OS version data
 * @param {Array} existingVersions - Other versions (lowercase)
 * @returns {Object} - { valid: boolean, errors: Object|null }
 */
function validateUpdate(data, existingVersions) {
  const errors = {}
  const versionLower = data.version?.toLowerCase?.() || ''

  // Check unique constraint against other versions
  if (versionLower && existingVersions.includes(versionLower)) {
    errors.version = '이미 존재하는 버전'
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors }
  }

  const validationErrors = validateOSVersionData(data)
  return { valid: !validationErrors, errors: validationErrors }
}

module.exports = {
  validateOSVersionData,
  validateBatchCreate,
  validateUpdate,
  patterns
}
