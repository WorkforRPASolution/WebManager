/**
 * Client validation rules and helpers
 */

const strategyRegistry = require('./strategies')
const sharedPatterns = require('../../shared/utils/validationPatterns')

// Validation patterns (ip is client-specific, rest from shared)
const patterns = {
  ip: /^(\d{1,3}\.){3}\d{1,3}$/,
  ...sharedPatterns
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
/**
 * Pick the first eqpId from a Set (for error messages).
 * Sets keep insertion order so this is deterministic per build.
 */
function firstEqpIdFromSet(set) {
  if (!set) return null
  for (const id of set) return id
  return null
}

/**
 * Validate batch create data
 * @param {Array} clients - Array of client data to create
 * @param {Set<string>} existingEqpIds - Set of existing eqpId values (lowercase), may have _originals Map
 * @param {Map<string, Set<string>>} existingIpCombos - Map of "ipAddr|ipAddrL" → Set of eqpIds (handles duplicate combos)
 * @returns {Object} - { valid: [], errors: [] }
 */
function validateBatchCreate(clients, existingEqpIds, existingIpCombos) {
  const valid = []
  const errors = []
  const batchEqpIds = new Set()
  const batchIpCombos = new Set()

  for (let i = 0; i < clients.length; i++) {
    const clientData = clients[i]
    const ipCombo = `${clientData.ipAddr || ''}|${clientData.ipAddrL || ''}`
    const eqpIdLower = clientData.eqpId?.toLowerCase?.() || ''

    // Check for duplicate eqpId within batch
    if (eqpIdLower && batchEqpIds.has(eqpIdLower)) {
      errors.push({ rowIndex: i, field: 'eqpId', message: `중복된 Equipment ID (배치 내)` })
      continue
    }

    // Check for duplicate IP combination within batch
    if (clientData.ipAddr && batchIpCombos.has(ipCombo)) {
      errors.push({ rowIndex: i, field: 'ipAddr', message: `중복된 IP 조합 (배치 내)` })
      continue
    }

    // Check for duplicate eqpId against existing data
    if (eqpIdLower && existingEqpIds.has(eqpIdLower)) {
      const originalId = existingEqpIds._originals?.get(eqpIdLower) || clientData.eqpId
      errors.push({ rowIndex: i, field: 'eqpId', message: `이미 존재하는 Equipment ID (${originalId})` })
      continue
    }

    // Check for duplicate IP combination against existing data
    if (clientData.ipAddr && existingIpCombos.has(ipCombo)) {
      const conflictSet = existingIpCombos.get(ipCombo)
      const conflictEqpId = firstEqpIdFromSet(conflictSet) || 'unknown'
      const extra = conflictSet && conflictSet.size > 1 ? ` 외 ${conflictSet.size - 1}건` : ''
      errors.push({ rowIndex: i, field: 'ipAddr', message: `중복된 IP 조합 (${conflictEqpId}${extra})` })
      continue
    }

    const validationErrors = validateClientData(clientData, [], [], false)

    if (validationErrors) {
      for (const [field, message] of Object.entries(validationErrors)) {
        errors.push({ rowIndex: i, field, message })
      }
    } else {
      batchEqpIds.add(eqpIdLower)
      batchIpCombos.add(ipCombo)
      valid.push(clientData)
    }
  }

  return { valid, errors }
}

/**
 * Validate client data for update
 * @param {Object} data - Client data to update
 * @param {Set<string>} existingEqpIds - Set of other clients' eqpId values (lowercase), with _originals Map
 * @param {Map<string, Set<string>>} existingIpCombos - Map of other clients' "ipAddr|ipAddrL" → Set of eqpIds
 * @returns {Object} - { valid: boolean, errors: Object|null }
 */
function validateUpdate(data, existingEqpIds, existingIpCombos) {
  const errors = {}
  const ipCombo = `${data.ipAddr || ''}|${data.ipAddrL || ''}`

  if (data.eqpId) {
    const eqpIdLower = data.eqpId.toLowerCase()
    if (existingEqpIds.has(eqpIdLower)) {
      const originalId = existingEqpIds._originals?.get(eqpIdLower) || data.eqpId
      errors.eqpId = `이미 존재하는 Equipment ID (${originalId})`
    }
  }
  if (data.ipAddr && existingIpCombos.has(ipCombo)) {
    const conflictSet = existingIpCombos.get(ipCombo)
    const conflictEqpId = firstEqpIdFromSet(conflictSet) || 'unknown'
    const extra = conflictSet && conflictSet.size > 1 ? ` 외 ${conflictSet.size - 1}건` : ''
    errors.ipAddr = `중복된 IP 조합 (${conflictEqpId}${extra})`
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
