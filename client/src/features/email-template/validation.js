export const validationRules = {
  app: {
    required: true,
    maxLength: 50,
    message: 'App is required (max 50 chars)'
  },
  process: {
    required: true,
    message: 'Process is required'
  },
  model: {
    required: true,
    message: 'Model is required'
  },
  code: {
    required: true,
    message: 'Code is required'
  },
  subcode: {
    required: true,
    message: 'Subcode is required'
  },
  title: {
    required: true,
    maxLength: 200,
    message: 'Title is required (max 200 chars)'
  },
  htmp: {
    required: true,
    message: 'HTML content is required'
  },
}

// Client-side validation: format/required checks only
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

    // Max length check
    if (rules.maxLength && String(value).length > rules.maxLength) {
      errors[field] = `Max ${rules.maxLength} characters`
    }
  }

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
