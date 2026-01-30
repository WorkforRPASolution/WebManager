import {
  validateRow as baseValidateRow,
  validateAllRows as baseValidateAllRows,
  patterns,
  containsKorean
} from '@/shared/utils/dataGridValidation'

// Custom validator for text fields with allowed pattern
const createTextValidator = (fieldName) => {
  return (value) => {
    if (!value) return null
    if (containsKorean(value)) {
      return `${fieldName}: Korean characters not allowed`
    }
    if (!patterns.noKoreanWithDash.test(value)) {
      return `${fieldName}: Only alphanumeric, ., _, - allowed`
    }
    return null
  }
}

// EmailRecipients-specific validation rules
export const validationRules = {
  app: {
    required: true,
    maxLength: 50,
    validator: createTextValidator('App'),
    message: 'App: Required (alphanumeric, ., _, - only)'
  },
  line: {
    required: true,
    maxLength: 100,
    validator: createTextValidator('Line'),
    message: 'Line: Required (alphanumeric, ., _, - only)'
  },
  process: {
    required: true,
    maxLength: 100,
    validator: createTextValidator('Process'),
    message: 'Process: Required (alphanumeric, ., _, - only)'
  },
  model: {
    required: true,
    maxLength: 100,
    validator: createTextValidator('Model'),
    message: 'Model: Required (alphanumeric, ., _, - only)'
  },
  code: {
    required: true,
    maxLength: 100,
    validator: createTextValidator('Code'),
    message: 'Code: Required (alphanumeric, ., _, - only)'
  },
  emailCategory: {
    required: true,
    maxLength: 200,
    validator: createTextValidator('Email Category'),
    message: 'Email Category: Required (alphanumeric, ., _, - only)'
  }
}

// Client-side validation using shared utility
export function validateRow(row) {
  return baseValidateRow(row, validationRules)
}

export function validateAllRows(rows) {
  return baseValidateAllRows(rows, validationRules)
}
