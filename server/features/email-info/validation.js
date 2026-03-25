/**
 * EmailInfo validation rules and helpers
 */

const { allowedWithDash, korean, email } = require('../../shared/utils/validationPatterns')

// Validation patterns
const patterns = { allowedWithDash, korean, email }

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
 * @param {Array} existingRecords - Existing records (full objects with project, category)
 * @returns {Object} - { valid: [], errors: [] }
 */
function validateBatchCreate(items, existingRecords) {
  const valid = []
  const errors = []
  const batchEntries = []

  for (let i = 0; i < items.length; i++) {
    const itemData = items[i]
    const key = `${itemData.project}|${itemData.category}`.toLowerCase()

    // Check for duplicate key within batch
    if (batchEntries.some(e => e.key === key)) {
      errors.push({ rowIndex: i, field: 'category', message: '중복된 Project + Category 조합 (배치 내)' })
      continue
    }

    // Check for duplicate key against existing data
    const conflict = existingRecords.find(r =>
      `${r.project}|${r.category}`.toLowerCase() === key
    )
    if (conflict) {
      errors.push({ rowIndex: i, field: 'category', message: `이미 존재하는 Project + Category 조합 (${conflict.project}/${conflict.category})` })
      continue
    }

    const validationErrors = validateEmailInfoData(itemData, false)

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
 * Validate email info data for update
 * @param {Object} data - EmailInfo data (including _id)
 * @param {Array} otherRecords - Other items' full records (excluding current)
 * @returns {Object} - { valid: boolean, errors: Object|null }
 */
function validateUpdate(data, otherRecords) {
  const errors = {}
  const key = `${data.project}|${data.category}`.toLowerCase()

  // Check unique constraints against other items
  if (data.project && data.category) {
    const conflict = otherRecords.find(r =>
      `${r.project}|${r.category}`.toLowerCase() === key
    )
    if (conflict) {
      errors.category = `이미 존재하는 Project + Category 조합 (${conflict.project}/${conflict.category})`
    }
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
