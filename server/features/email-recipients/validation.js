/**
 * EmailRecipients validation rules and helpers
 */

// Validation patterns
const patterns = {
  // Allowed characters: alphanumeric, dot, underscore, dash
  allowedWithDash: /^[A-Za-z0-9._-]*$/,
  // Korean character detection
  korean: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/
}

// Required fields for email recipients data
const requiredFields = ['app', 'line', 'process', 'model', 'code', 'emailCategory']

/**
 * Validate email recipients data
 * @param {Object} data - EmailRecipients data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object|null} - Validation errors or null if valid
 */
function validateEmailRecipientsData(data, isUpdate = false) {
  const errors = {}

  // Required string fields
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors[field] = `${field} is required`
    }
  }

  // Validate each field for pattern
  const fieldsToValidate = ['app', 'line', 'process', 'model', 'code', 'emailCategory']

  for (const field of fieldsToValidate) {
    if (data[field] && typeof data[field] === 'string') {
      if (patterns.korean.test(data[field])) {
        errors[field] = `${field}: Korean characters not allowed`
      } else if (!patterns.allowedWithDash.test(data[field])) {
        errors[field] = `${field}: Only alphanumeric, ., _, - allowed`
      }
    }
  }

  return Object.keys(errors).length > 0 ? errors : null
}

/**
 * Validate batch of email recipients data for creation
 * @param {Array} items - Array of email recipients data
 * @param {Array} existingKeys - Existing compound key combinations (lowercase)
 * @returns {Object} - { valid: [], errors: [] }
 */
function validateBatchCreate(items, existingKeys) {
  const valid = []
  const errors = []
  const batchKeys = []

  for (let i = 0; i < items.length; i++) {
    const itemData = items[i]
    const key = `${itemData.app}|${itemData.line}|${itemData.process}|${itemData.model}|${itemData.code}`

    // Check for duplicate key within batch
    if (batchKeys.includes(key.toLowerCase())) {
      errors.push({ rowIndex: i, field: 'code', message: 'Duplicate key combination in batch' })
      continue
    }

    // Check for duplicate key against existing data
    if (existingKeys.includes(key.toLowerCase())) {
      errors.push({ rowIndex: i, field: 'code', message: 'Key combination already exists' })
      continue
    }

    const validationErrors = validateEmailRecipientsData(itemData, false)

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
 * Validate email recipients data for update
 * @param {Object} data - EmailRecipients data (including _id)
 * @param {Array} existingKeys - Other items' key combinations (lowercase)
 * @returns {Object} - { valid: boolean, errors: Object|null }
 */
function validateUpdate(data, existingKeys) {
  const errors = {}
  const key = `${data.app}|${data.line}|${data.process}|${data.model}|${data.code}`

  // Check unique constraints against other items
  if (data.app && data.line && data.process && data.model && data.code) {
    if (existingKeys.includes(key.toLowerCase())) {
      errors.code = 'Key combination already exists'
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors }
  }

  const validationErrors = validateEmailRecipientsData(data, true)
  return { valid: !validationErrors, errors: validationErrors }
}

module.exports = {
  validateEmailRecipientsData,
  validateBatchCreate,
  validateUpdate,
  patterns,
  requiredFields
}
