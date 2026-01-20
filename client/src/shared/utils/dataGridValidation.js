/**
 * Shared data grid validation utilities
 * Provides consistent validation across all data grid views
 */

/**
 * Validate a single row against validation rules
 * @param {Object} row - Row data to validate
 * @param {Object} rules - Validation rules object
 * @returns {Object|null} - Errors object or null if valid
 */
export function validateRow(row, rules) {
  const errors = {}

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = row[field]

    // Required check
    if (fieldRules.required) {
      if (value === null || value === undefined || value === '') {
        errors[field] = fieldRules.message
        continue
      }
    }

    // Skip further validation if empty and not required
    if (value === null || value === undefined || value === '') {
      continue
    }

    // Pattern check (regex)
    if (fieldRules.pattern && !fieldRules.pattern.test(String(value))) {
      errors[field] = fieldRules.message
    }

    // Enum check
    if (fieldRules.enum && !fieldRules.enum.includes(Number(value))) {
      errors[field] = fieldRules.message
    }

    // Max length check
    if (fieldRules.maxLength && String(value).length > fieldRules.maxLength) {
      errors[field] = `Max ${fieldRules.maxLength} characters`
    }

    // Min length check
    if (fieldRules.minLength && String(value).length < fieldRules.minLength) {
      errors[field] = `Min ${fieldRules.minLength} characters`
    }

    // Type check
    if (fieldRules.type === 'number' && isNaN(Number(value))) {
      errors[field] = fieldRules.message
    }

    // Custom validator
    if (fieldRules.validator && typeof fieldRules.validator === 'function') {
      const customError = fieldRules.validator(value, row)
      if (customError) {
        errors[field] = customError
      }
    }
  }

  return Object.keys(errors).length > 0 ? errors : null
}

/**
 * Validate all rows against validation rules
 * @param {Array} rows - Array of row data
 * @param {Object} rules - Validation rules object
 * @returns {Object} - Object with row IDs as keys and error objects as values
 */
export function validateAllRows(rows, rules) {
  const allErrors = {}

  for (const row of rows) {
    const rowId = row._id || row._tempId
    const errors = validateRow(row, rules)
    if (errors) {
      allErrors[rowId] = errors
    }
  }

  return allErrors
}

/**
 * Create a validation rules object from a schema definition
 * @param {Object} schema - Schema definition
 * @returns {Object} - Validation rules object
 */
export function createValidationRules(schema) {
  const rules = {}

  for (const [field, config] of Object.entries(schema)) {
    rules[field] = {
      required: config.required ?? false,
      message: config.message || `${field} is invalid`
    }

    if (config.pattern) rules[field].pattern = config.pattern
    if (config.enum) rules[field].enum = config.enum
    if (config.maxLength) rules[field].maxLength = config.maxLength
    if (config.minLength) rules[field].minLength = config.minLength
    if (config.type) rules[field].type = config.type
    if (config.validator) rules[field].validator = config.validator
  }

  return rules
}

/**
 * Common validation patterns
 */
export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
  alphanumeric: /^[A-Za-z0-9]+$/,
  alphanumericWithSymbols: /^[A-Za-z0-9_-]+$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
}
