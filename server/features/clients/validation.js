/**
 * Client validation rules and helpers
 */

const strategyRegistry = require('./strategies')
// Validation patterns
const patterns = {
  ip: /^(\d{1,3}\.){3}\d{1,3}$/,
  // Strict IPv4 with octet range check (0-255)
  ipStrict: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  // Korean character detection (Hangul syllables, Jamo, compatibility Jamo)
  korean: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,
  // Allowed characters: alphanumeric, dot, underscore only
  allowedBasic: /^[A-Za-z0-9._]*$/,
  // Allowed characters: alphanumeric, dot, underscore, dash (for line, emailcategory)
  allowedWithDash: /^[A-Za-z0-9._-]*$/,
  date: /^\d{4}-\d{2}-\d{2}$/
}

// Fields that allow dash character
const dashAllowedFields = ['line', 'emailcategory']

// Text fields to validate for Korean and allowed characters
const textFields = ['line', 'lineDesc', 'process', 'eqpModel', 'eqpId', 'category', 'emailcategory', 'osVer']

// Required fields for client data
const requiredFields = [
  'line', 'lineDesc', 'process', 'eqpModel', 'eqpId', 'category',
  'ipAddr', 'emailcategory', 'osVer'
]

// Required number fields (0 is valid)
const requiredNumberFields = [
  'localpc', 'onoff', 'webmanagerUse', 'usereleasemsg', 'usetkincancel'
]

/**
 * Validate client data
 * @param {Object} data - Client data to validate
 * @param {Array} existingIds - Existing equipment IDs for uniqueness check
 * @param {Array} existingIps - Existing IP addresses for uniqueness check
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object|null} - Validation errors or null if valid
 */
function validateClientData(data, existingIds = [], existingIps = [], isUpdate = false) {
  const errors = {}

  // Required string fields
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors[field] = `${field} is required`
    }
  }

  // Required number fields (0 is valid)
  for (const field of requiredNumberFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors[field] = `${field} is required`
    } else if (![0, 1].includes(Number(data[field]))) {
      errors[field] = `${field} must be 0 or 1`
    }
  }

  // Korean check and allowed character check for text fields
  for (const field of textFields) {
    const value = data[field]
    if (value && typeof value === 'string') {
      // Skip if already has required error
      if (errors[field]) continue

      // Korean character check
      if (patterns.korean.test(value)) {
        errors[field] = `${field}: 한글 사용 불가`
        continue
      }

      // Allowed character check
      const pattern = dashAllowedFields.includes(field)
        ? patterns.allowedWithDash
        : patterns.allowedBasic
      if (!pattern.test(value)) {
        const allowedChars = dashAllowedFields.includes(field)
          ? '영문, 숫자, ., _, -'
          : '영문, 숫자, ., _'
        errors[field] = `${field}: ${allowedChars} 만 허용`
      }
    }
  }

  // IP address format (strict check with 0-255 range)
  if (data.ipAddr && !patterns.ipStrict.test(data.ipAddr)) {
    errors.ipAddr = 'IPv4 주소 형식 필요 (0-255.0-255.0-255.0-255)'
  }
  if (data.ipAddrL && data.ipAddrL.trim() && !patterns.ipStrict.test(data.ipAddrL)) {
    errors.ipAddrL = 'IPv4 주소 형식 필요 (0-255.0-255.0-255.0-255)'
  }

  // Date format (optional fields)
  if (data.installdate && data.installdate.trim() && !patterns.date.test(data.installdate)) {
    errors.installdate = 'Date format must be yyyy-MM-dd'
  }
  if (data.scFirstExcute && data.scFirstExcute.trim() && !patterns.date.test(data.scFirstExcute)) {
    errors.scFirstExcute = 'Date format must be yyyy-MM-dd'
  }

  // Unique checks (for new records or if value changed)
  if (!isUpdate) {
    if (data.eqpId && existingIds.includes(data.eqpId)) {
      errors.eqpId = 'Equipment ID already exists'
    }
    if (data.ipAddr && existingIps.includes(data.ipAddr)) {
      errors.ipAddr = 'IP address already exists'
    }
  }

  return Object.keys(errors).length > 0 ? errors : null
}

/**
 * Validate batch of client data for creation
 * @param {Array} clients - Array of client data
 * @param {Array} existingIds - Existing equipment IDs
 * @param {Array} existingIps - Existing IP addresses
 * @returns {Object} - { valid: [], errors: [] }
 */
function validateBatchCreate(clients, existingIds, existingIpCombos) {
  const valid = []
  const errors = []
  const batchIds = []
  const batchIpCombos = []

  for (let i = 0; i < clients.length; i++) {
    const clientData = clients[i]
    const ipCombo = `${clientData.ipAddr || ''}|${clientData.ipAddrL || ''}`

    // Check for duplicate eqpId within batch
    if (clientData.eqpId && batchIds.includes(clientData.eqpId.toLowerCase())) {
      errors.push({ rowIndex: i, field: 'eqpId', message: '중복된 Equipment ID' })
      continue
    }

    // Check for duplicate IP combination within batch
    if (clientData.ipAddr && batchIpCombos.includes(ipCombo)) {
      errors.push({ rowIndex: i, field: 'ipAddr', message: '중복된 IP 조합' })
      continue
    }

    // Check for duplicate eqpId against existing data
    if (clientData.eqpId && existingIds.includes(clientData.eqpId.toLowerCase())) {
      errors.push({ rowIndex: i, field: 'eqpId', message: '이미 존재하는 Equipment ID' })
      continue
    }

    // Check for duplicate IP combination against existing data
    if (clientData.ipAddr && existingIpCombos.includes(ipCombo)) {
      errors.push({ rowIndex: i, field: 'ipAddr', message: '이미 존재하는 IP 조합' })
      continue
    }

    const validationErrors = validateClientData(clientData, [], [], false)

    if (validationErrors) {
      for (const [field, message] of Object.entries(validationErrors)) {
        errors.push({ rowIndex: i, field, message })
      }
    } else {
      if (clientData.eqpId) {
        batchIds.push(clientData.eqpId.toLowerCase())
      }
      if (clientData.ipAddr) {
        batchIpCombos.push(ipCombo)
      }
      valid.push(clientData)
    }
  }

  return { valid, errors }
}

/**
 * Validate client data for update
 * @param {Object} data - Client data (including _id)
 * @param {Array} existingIds - Other clients' equipment IDs (lowercase)
 * @param {Array} existingIpCombos - Other clients' IP combinations (ipAddr|ipAddrL)
 * @returns {Object} - { valid: boolean, errors: Object|null }
 */
function validateUpdate(data, existingIds, existingIpCombos) {
  const errors = {}
  const ipCombo = `${data.ipAddr || ''}|${data.ipAddrL || ''}`

  // Check unique constraints against other clients
  if (data.eqpId && existingIds.includes(data.eqpId.toLowerCase())) {
    errors.eqpId = '이미 존재하는 Equipment ID'
  }
  if (data.ipAddr && existingIpCombos.includes(ipCombo)) {
    errors.ipAddr = '이미 존재하는 IP 조합'
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors }
  }

  const validationErrors = validateClientData(data, [], [], true)
  return { valid: !validationErrors, errors: validationErrors }
}

/**
 * Validate serviceType against strategy registry
 * @param {string|null|undefined} serviceType
 * @returns {boolean}
 */
function validateServiceType(serviceType) {
  if (serviceType === null || serviceType === undefined || serviceType === '') return true
  const strategy = strategyRegistry.get(serviceType)
  return !!strategy
}

module.exports = {
  validateClientData,
  validateBatchCreate,
  validateUpdate,
  patterns,
  requiredFields,
  requiredNumberFields,
  validateServiceType
}
