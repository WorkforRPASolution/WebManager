/**
 * EmailRecipients validation rules and helpers
 */

const { allowedWithDash, korean } = require('../../shared/utils/validationPatterns')

// Validation patterns
const patterns = { allowedWithDash, korean }

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
 * @param {Array} existingRecords - Existing records (full objects with app, line, process, model, code)
 * @returns {Object} - { valid: [], errors: [] }
 */
function validateBatchCreate(items, existingRecords) {
  const valid = []
  const errors = []
  const batchEntries = []

  for (let i = 0; i < items.length; i++) {
    const itemData = items[i]
    const key = `${itemData.app}|${itemData.line}|${itemData.process}|${itemData.model}|${itemData.code}`.toLowerCase()

    // Check for duplicate key within batch
    if (batchEntries.some(e => e.key === key)) {
      errors.push({ rowIndex: i, field: 'code', message: 'Duplicate key combination in batch' })
      continue
    }

    // Check for duplicate key against existing data
    const conflict = existingRecords.find(r =>
      `${r.app}|${r.line}|${r.process}|${r.model}|${r.code}`.toLowerCase() === key
    )
    if (conflict) {
      errors.push({ rowIndex: i, field: 'code', message: `Key combination already exists (${conflict.code})` })
      continue
    }

    const validationErrors = validateEmailRecipientsData(itemData, false)

    if (validationErrors) {
      for (const [field, message] of Object.entries(validationErrors)) {
        errors.push({ rowIndex: i, field, message })
      }
    } else {
      batchEntries.push({ key })
      valid.push(itemData)
    }
  }

  return { valid, errors }
}

/**
 * Validate email recipients data for update
 * @param {Object} data - EmailRecipients data (including _id)
 * @param {Array} otherRecords - Other items' full records (excluding current)
 * @returns {Object} - { valid: boolean, errors: Object|null }
 */
function validateUpdate(data, otherRecords) {
  const errors = {}
  const key = `${data.app}|${data.line}|${data.process}|${data.model}|${data.code}`.toLowerCase()

  // Check unique constraints against other items
  if (data.app && data.line && data.process && data.model && data.code) {
    const conflict = otherRecords.find(r =>
      `${r.app}|${r.line}|${r.process}|${r.model}|${r.code}`.toLowerCase() === key
    )
    if (conflict) {
      errors.code = `Key combination already exists (${conflict.code})`
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
