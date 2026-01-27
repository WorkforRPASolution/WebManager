import {
  validateRow as baseValidateRow,
  validateAllRows as baseValidateAllRows,
  patterns
} from '@/shared/utils/dataGridValidation'

// User-specific validation rules
export const validationRules = {
  name: {
    required: true,
    maxLength: 100,
    message: 'Name is required (max 100 chars)'
  },
  singleid: {
    required: true,
    maxLength: 50,
    pattern: /^[A-Za-z0-9_-]+$/,
    message: 'User ID is required (letters, numbers, _, -)'
  },
  password: {
    required: false, // Not required for updates
    minLength: 4,
    message: 'Password must be at least 4 characters'
  },
  line: {
    required: true,
    maxLength: 50,
    message: 'Line is required'
  },
  processes: {
    required: true,
    type: 'array',
    minLength: 1,  // At least one process required
    message: 'At least one process is required'
  },
  authority: {
    required: false,
    enum: ['', 'WRITE'],
    message: 'Authority must be empty or WRITE'
  },
  authorityManager: {
    required: true,
    enum: [0, 1, 2, 3],
    message: 'Authority level must be 0-3'
  },
  email: {
    required: false,
    pattern: patterns.email,
    message: 'Invalid email format'
  }
}

// Validation rules for new users (password required)
export const newUserValidationRules = {
  ...validationRules,
  password: {
    required: true,
    minLength: 4,
    message: 'Password is required (min 4 chars)'
  }
}

// Client-side validation using shared utility
export function validateRow(row, isNew = false) {
  const rules = isNew ? newUserValidationRules : validationRules
  return baseValidateRow(row, rules)
}

export function validateAllRows(rows, newRowIds = new Set()) {
  const allErrors = {}

  for (const row of rows) {
    const rowId = row._id || row._tempId
    const isNew = row._tempId && newRowIds.has(row._tempId)
    const errors = validateRow(row, isNew)
    if (errors) {
      allErrors[rowId] = errors
    }
  }

  return allErrors
}
