const VALID_CATEGORIES = ['audit', 'error', 'auth', 'batch', 'access', 'eqp-redis']
const VALID_PERIODS = ['today', '7d', '30d', '90d', 'custom']

function validateCategory(category) {
  if (category && !VALID_CATEGORIES.includes(category)) {
    return `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
  }
  return null
}

function validatePeriod(period) {
  if (period && !VALID_PERIODS.includes(period)) {
    return `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`
  }
  return null
}

module.exports = {
  VALID_CATEGORIES,
  VALID_PERIODS,
  validateCategory,
  validatePeriod
}
