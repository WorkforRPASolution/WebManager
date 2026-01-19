/**
 * Client validation rules and helpers
 */

// Validation patterns
const patterns = {
  ip: /^(\d{1,3}\.){3}\d{1,3}$/,
  date: /^\d{4}-\d{2}-\d{2}$/
}

// Required fields for client data
const requiredFields = [
  'line', 'lineDesc', 'process', 'eqpModel', 'eqpId', 'category',
  'IpAddr', 'emailcategory', 'osVer'
]

// Required number fields (0 is valid)
const requiredNumberFields = [
  'localpcNunber', 'onoffNunber', 'webmanagerUse', 'usereleasemsg', 'usetkincancel'
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

  // IP address format
  if (data.IpAddr && !patterns.ip.test(data.IpAddr)) {
    errors.IpAddr = 'Invalid IP address format'
  }
  if (data.IpAddrL && data.IpAddrL.trim() && !patterns.ip.test(data.IpAddrL)) {
    errors.IpAddrL = 'Invalid IP address format'
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
    if (data.IpAddr && existingIps.includes(data.IpAddr)) {
      errors.IpAddr = 'IP address already exists'
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
function validateBatchCreate(clients, existingIds, existingIps) {
  const valid = []
  const errors = []
  const batchIds = []
  const batchIps = []

  for (let i = 0; i < clients.length; i++) {
    const clientData = clients[i]

    // Check for duplicates within batch
    if (batchIds.includes(clientData.eqpId)) {
      errors.push({ rowIndex: i, field: 'eqpId', message: 'Duplicate Equipment ID in batch' })
      continue
    }
    if (batchIps.includes(clientData.IpAddr)) {
      errors.push({ rowIndex: i, field: 'IpAddr', message: 'Duplicate IP address in batch' })
      continue
    }

    const validationErrors = validateClientData(
      clientData,
      [...existingIds, ...batchIds],
      [...existingIps, ...batchIps]
    )

    if (validationErrors) {
      for (const [field, message] of Object.entries(validationErrors)) {
        errors.push({ rowIndex: i, field, message })
      }
    } else {
      batchIds.push(clientData.eqpId)
      batchIps.push(clientData.IpAddr)
      valid.push(clientData)
    }
  }

  return { valid, errors }
}

/**
 * Validate client data for update
 * @param {Object} data - Client data (including _id)
 * @param {Array} existingIds - Other clients' equipment IDs
 * @param {Array} existingIps - Other clients' IP addresses
 * @returns {Object} - { valid: boolean, errors: Object|null }
 */
function validateUpdate(data, existingIds, existingIps) {
  const errors = {}

  // Check unique constraints against other clients
  if (data.eqpId && existingIds.includes(data.eqpId)) {
    errors.eqpId = 'Equipment ID already exists'
  }
  if (data.IpAddr && existingIps.includes(data.IpAddr)) {
    errors.IpAddr = 'IP address already exists'
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors }
  }

  const validationErrors = validateClientData(data, [], [], true)
  return { valid: !validationErrors, errors: validationErrors }
}

module.exports = {
  validateClientData,
  validateBatchCreate,
  validateUpdate,
  patterns,
  requiredFields,
  requiredNumberFields
}
