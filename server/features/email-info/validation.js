/**
 * EmailInfo validation rules and helpers
 */

// Validation patterns
const patterns = {
  // Allowed characters: alphanumeric, dot, underscore, dash
  allowedWithDash: /^[A-Za-z0-9._-]*$/,
  // Korean character detection
  korean: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,
  // Email pattern
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
}

// Required fields for email info data
const requiredFields = ['project', 'category']

/**
 * Validate email info data
 * @param {Object} data - EmailInfo data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object|null} - Validation errors or null if valid
 */
function validateEmailInfoData(data, isUpdate = false) {
  const errors = {}

  // Required string fields
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors[field] = `${field} is required`
    }
  }

  // Project validation
  if (data.project && typeof data.project === 'string') {
    if (patterns.korean.test(data.project)) {
      errors.project = 'Project: 한글 사용 불가'
    } else if (!patterns.allowedWithDash.test(data.project)) {
      errors.project = 'Project: 영문, 숫자, ., _, - 만 허용'
    }
  }

  // Category validation
  if (data.category && typeof data.category === 'string') {
    if (patterns.korean.test(data.category)) {
      errors.category = 'Category: 한글 사용 불가'
    } else if (!patterns.allowedWithDash.test(data.category)) {
      errors.category = 'Category: 영문, 숫자, ., _, - 만 허용'
    }
  }

  // Account validation (array of emails)
  if (data.account && Array.isArray(data.account)) {
    const invalidEmails = data.account.filter(email => email && !patterns.email.test(email.trim()))
    if (invalidEmails.length > 0) {
      errors.account = `잘못된 이메일 형식: ${invalidEmails.join(', ')}`
    }
  }

  return Object.keys(errors).length > 0 ? errors : null
}

/**
 * Validate batch of email info data for creation
 * @param {Array} items - Array of email info data
 * @param {Array} existingKeys - Existing project+category combinations
 * @returns {Object} - { valid: [], errors: [] }
 */
function validateBatchCreate(items, existingKeys) {
  const valid = []
  const errors = []
  const batchKeys = []

  for (let i = 0; i < items.length; i++) {
    const itemData = items[i]
    const key = `${itemData.project}|${itemData.category}`

    // Check for duplicate key within batch
    if (batchKeys.includes(key.toLowerCase())) {
      errors.push({ rowIndex: i, field: 'category', message: '중복된 Project + Category 조합' })
      continue
    }

    // Check for duplicate key against existing data
    if (existingKeys.includes(key.toLowerCase())) {
      errors.push({ rowIndex: i, field: 'category', message: '이미 존재하는 Project + Category 조합' })
      continue
    }

    const validationErrors = validateEmailInfoData(itemData, false)

    if (validationErrors) {
      for (const [field, message] of Object.entries(validationErrors)) {
        errors.push({ rowIndex: i, field, message })
      }
    } else {
      batchKeys.push(key.toLowerCase())
      valid.push(itemData)
    }
  }

  return { valid, errors }
}

/**
 * Validate email info data for update
 * @param {Object} data - EmailInfo data (including _id)
 * @param {Array} existingKeys - Other items' project+category combinations (lowercase)
 * @returns {Object} - { valid: boolean, errors: Object|null }
 */
function validateUpdate(data, existingKeys) {
  const errors = {}
  const key = `${data.project}|${data.category}`

  // Check unique constraints against other items
  if (data.project && data.category && existingKeys.includes(key.toLowerCase())) {
    errors.category = '이미 존재하는 Project + Category 조합'
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors }
  }

  const validationErrors = validateEmailInfoData(data, true)
  return { valid: !validationErrors, errors: validationErrors }
}

module.exports = {
  validateEmailInfoData,
  validateBatchCreate,
  validateUpdate,
  patterns,
  requiredFields
}
