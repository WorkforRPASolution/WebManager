import {
  validateRow as baseValidateRow,
  validateAllRows as baseValidateAllRows,
  patterns
} from '@/shared/utils/dataGridValidation'

// Master-specific validation rules
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
    pattern: patterns.alphanumericWithSymbols,
    message: 'Equipment ID is required (alphanumeric, _, -)'
  },
  category: {
    required: true,
    message: 'Category is required'
  },
  IpAddr: {
    required: true,
    pattern: patterns.ipv4,
    message: 'Valid IPv4 address required'
  },
  IpAddrL: {
    required: false,
    pattern: patterns.ipv4,
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
    pattern: patterns.date,
    message: 'Date format: yyyy-MM-dd'
  },
  scFirstExcute: {
    required: false,
    pattern: patterns.date,
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

// Client-side validation using shared utility
// Note: Duplicate checks for eqpId and IpAddr are handled by the server
export function validateRow(row) {
  return baseValidateRow(row, validationRules)
}

export function validateAllRows(rows) {
  return baseValidateAllRows(rows, validationRules)
}
