export const validationRules = {
  line: {
    required: true,
    maxLength: 50,
    message: 'Line is required (max 50 chars)'
  },
  lineDesc: {
    required: true,
    maxLength: 100,
    message: 'Line description is required'
  },
  process: {
    required: true,
    message: 'Process is required'
  },
  eqpModel: {
    required: true,
    message: 'Equipment Model is required'
  },
  eqpId: {
    required: true,
    pattern: /^[A-Za-z0-9_-]+$/,
    message: 'Equipment ID is required (alphanumeric, _, -)'
  },
  category: {
    required: true,
    message: 'Category is required'
  },
  IpAddr: {
    required: true,
    pattern: /^(\d{1,3}\.){3}\d{1,3}$/,
    message: 'Valid IPv4 address required'
  },
  IpAddrL: {
    required: false,
    pattern: /^(\d{1,3}\.){3}\d{1,3}$/,
    message: 'Valid IPv4 format if provided'
  },
  localpcNunber: {
    required: true,
    enum: [0, 1],
    message: 'Must be 0 or 1'
  },
  emailcategory: {
    required: true,
    message: 'Email category is required'
  },
  osVer: {
    required: true,
    message: 'OS version is required'
  },
  onoffNunber: {
    required: true,
    enum: [0, 1],
    message: 'Must be 0 or 1'
  },
  webmanagerUse: {
    required: true,
    enum: [0, 1],
    message: 'Must be 0 or 1'
  },
  installdate: {
    required: false,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: 'Date format: yyyy-MM-dd'
  },
  scFirstExcute: {
    required: false,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: 'Date format: yyyy-MM-dd'
  },
  snapshotTimeDiff: {
    required: false,
    type: 'number',
    message: 'Must be a number'
  },
  usereleasemsg: {
    required: true,
    enum: [0, 1],
    message: 'Must be 0 or 1'
  },
  usetkincancel: {
    required: true,
    enum: [0, 1],
    message: 'Must be 0 or 1'
  },
}

// Client-side validation: format/required checks only
// Duplicate validation (eqpId, IpAddr) is handled server-side during save
export function validateRow(row) {
  const errors = {}

  for (const [field, rules] of Object.entries(validationRules)) {
    const value = row[field]

    // Required check
    if (rules.required) {
      if (value === null || value === undefined || value === '') {
        errors[field] = rules.message
        continue
      }
    }

    // Skip further validation if empty and not required
    if (value === null || value === undefined || value === '') {
      continue
    }

    // Pattern check
    if (rules.pattern && !rules.pattern.test(String(value))) {
      errors[field] = rules.message
    }

    // Enum check
    if (rules.enum && !rules.enum.includes(Number(value))) {
      errors[field] = rules.message
    }

    // Max length check
    if (rules.maxLength && String(value).length > rules.maxLength) {
      errors[field] = `Max ${rules.maxLength} characters`
    }

    // Type check
    if (rules.type === 'number' && isNaN(Number(value))) {
      errors[field] = rules.message
    }
  }

  // Note: Duplicate checks for eqpId and IpAddr are handled by the server
  // during create/update operations since with server-side pagination,
  // we don't have access to all data on the client

  return Object.keys(errors).length > 0 ? errors : null
}

export function validateAllRows(rows) {
  const allErrors = {}

  for (const row of rows) {
    const rowId = row._id || row._tempId
    const errors = validateRow(row)
    if (errors) {
      allErrors[rowId] = errors
    }
  }

  return allErrors
}
