/**
 * Period validation utilities for Recovery Dashboard API.
 */

const { formatKST } = require('./dateUtils')

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * Validate that the date range doesn't exceed maxDays.
 * @param {string|null} startDate - Start date ISO string
 * @param {string|null} endDate - End date ISO string
 * @param {number} maxDays - Maximum allowed days
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePeriodRange(startDate, endDate, maxDays = 7) {
  if (!startDate || !endDate) {
    return { valid: false, error: 'startDate and endDate are required' }
  }

  const start = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: 'Invalid date format' }
  }

  if (start >= end) {
    return { valid: false, error: 'startDate must be before endDate' }
  }

  const diffMs = end.getTime() - start.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays > maxDays) {
    return { valid: false, error: `Date range exceeds maximum of ${maxDays} days` }
  }

  return { valid: true }
}

/**
 * Parse period string into start/end dates in KST ISO format.
 * @param {string} period - 'today', '7d', '30d', 'custom'
 * @returns {{ startDate: string, endDate: string } | null}
 */
function parsePeriod(period) {
  if (period === 'custom') return null

  const now = new Date()
  const endDate = formatKST(now)

  // Calculate KST midnight for the start date
  const kstMs = now.getTime() + KST_OFFSET_MS
  const kstDate = new Date(kstMs)
  // Floor to start of KST day
  kstDate.setUTCHours(0, 0, 0, 0)

  let daysBack = 0
  if (period === 'today') {
    daysBack = 0
  } else if (period === '7d') {
    daysBack = 7
  } else if (period === '30d') {
    daysBack = 30
  } else {
    // Default to today
    daysBack = 0
  }

  if (daysBack > 0) {
    kstDate.setUTCDate(kstDate.getUTCDate() - daysBack)
  }

  // Convert back to UTC for formatKST
  const startUtc = new Date(kstDate.getTime() - KST_OFFSET_MS)
  const startDate = formatKST(startUtc)

  return { startDate, endDate }
}

module.exports = { validatePeriodRange, parsePeriod }
