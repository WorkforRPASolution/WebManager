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
      return `${fieldName}: 한글 사용 불가`
    }
    if (!patterns.noKoreanWithDash.test(value)) {
      return `${fieldName}: 영문, 숫자, ., _, - 만 허용`
    }
    return null
  }
}

// Email array validator
const createEmailArrayValidator = (fieldName) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return (value) => {
    if (!value || value.length === 0) return null
    const invalid = value.filter(email => email && !emailPattern.test(email.trim()))
    if (invalid.length > 0) {
      return `${fieldName}: 잘못된 이메일 형식 (${invalid.join(', ')})`
    }
    return null
  }
}

// EmailInfo-specific validation rules
export const validationRules = {
  project: {
    required: true,
    maxLength: 50,
    validator: createTextValidator('Project'),
    message: 'Project: 필수 (영문, 숫자, ., _, - 만 허용)'
  },
  category: {
    required: true,
    maxLength: 200,
    validator: createTextValidator('Category'),
    message: 'Category: 필수 (영문, 숫자, ., _, - 만 허용)'
  },
  account: {
    required: false,
    type: 'array',
    validator: createEmailArrayValidator('Account'),
    message: 'Account: 이메일 형식 필요'
  },
  departments: {
    required: false,
    type: 'array',
    message: 'Departments: 배열 형식'
  }
}

// Client-side validation using shared utility
export function validateRow(row) {
  return baseValidateRow(row, validationRules)
}

export function validateAllRows(rows) {
  return baseValidateAllRows(rows, validationRules)
}

// Array to string conversion (for display in grid)
export const arrayToString = (arr) => arr?.join('; ') || ''

// String to array conversion (for editing)
export const stringToArray = (str) =>
  str?.split(/[;,]/).map(s => s.trim()).filter(Boolean) || []
