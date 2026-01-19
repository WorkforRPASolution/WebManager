import {
  validateRow as baseValidateRow,
  validateAllRows as baseValidateAllRows
} from '@/shared/utils/dataGridValidation'

// Email template-specific validation rules
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

// Client-side validation using shared utility
export function validateRow(row) {
  return baseValidateRow(row, validationRules)
}

export function validateAllRows(rows) {
  return baseValidateAllRows(rows, validationRules)
}
