import {
  validateRow as baseValidateRow,
  validateAllRows as baseValidateAllRows,
  patterns,
  containsKorean
} from '@/shared/utils/dataGridValidation'

// Custom validator for Korean character check with allowed pattern
const createTextValidator = (fieldName, allowDash = false) => {
  const pattern = allowDash ? patterns.noKoreanWithDash : patterns.noKoreanBasic
  const allowedChars = allowDash ? '영문, 숫자, ., _, -' : '영문, 숫자, ., _'

  return (value) => {
    if (!value) return null
    if (containsKorean(value)) {
      return `${fieldName}: 한글 사용 불가`
    }
    if (!pattern.test(value)) {
      return `${fieldName}: ${allowedChars} 만 허용`
    }
    return null
  }
}

// Master-specific validation rules
export const validationRules = {
  line: {
    required: true,
    maxLength: 50,
    validator: createTextValidator('Line', true),  // dash 허용
    message: 'Line: 필수 (영문, 숫자, ., _, - 만 허용, max 50자)'
  },
  lineDesc: {
    required: true,
    maxLength: 100,
    validator: createTextValidator('Line Desc'),
    message: 'Line Desc: 필수 (영문, 숫자, ., _ 만 허용)'
  },
  process: {
    required: true,
    validator: createTextValidator('Process'),
    message: 'Process: 필수 (영문, 숫자, ., _ 만 허용)'
  },
  eqpModel: {
    required: true,
    validator: createTextValidator('EqpModel'),
    message: 'EqpModel: 필수 (영문, 숫자, ., _ 만 허용)'
  },
  eqpId: {
    required: true,
    validator: createTextValidator('EqpId'),
    message: 'EqpId: 필수 (영문, 숫자, ., _ 만 허용)'
  },
  category: {
    required: true,
    validator: createTextValidator('Category'),
    message: 'Category: 필수 (영문, 숫자, ., _ 만 허용)'
  },
  ipAddr: {
    required: true,
    pattern: patterns.ipv4Strict,
    message: 'IPv4 주소 형식 필요 (0-255.0-255.0-255.0-255)'
  },
  ipAddrL: {
    required: false,
    pattern: patterns.ipv4Strict,
    message: 'IPv4 주소 형식 필요 (0-255.0-255.0-255.0-255)'
  },
  localpc: {
    required: true,
    enum: [0, 1],
    message: 'Must be 0 or 1'
  },
  emailcategory: {
    required: true,
    validator: createTextValidator('Email Category', true),  // dash 허용
    message: 'Email Category: 필수 (영문, 숫자, ., _, - 만 허용)'
  },
  osVer: {
    required: true,
    validator: createTextValidator('OS Ver'),
    message: 'OS Ver: 필수 (영문, 숫자, ., _ 만 허용)'
  },
  onoff: {
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
// Note: Duplicate checks for eqpId and ipAddr are handled by the server
export function validateRow(row) {
  return baseValidateRow(row, validationRules)
}

export function validateAllRows(rows) {
  return baseValidateAllRows(rows, validationRules)
}
