/**
 * Date utility functions for Recovery Summary batch jobs.
 * KST = UTC+09:00 fixed offset (Korea does not observe DST).
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000 // +09:00 in milliseconds

/**
 * Convert a JS Date to KST ISO 8601 string: YYYY-MM-DDTHH:mm:ss.SSS+09:00
 */
function formatKST(date) {
  const kstMs = date.getTime() + KST_OFFSET_MS
  const kst = new Date(kstMs)
  const y = kst.getUTCFullYear()
  const M = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  const h = String(kst.getUTCHours()).padStart(2, '0')
  const m = String(kst.getUTCMinutes()).padStart(2, '0')
  const s = String(kst.getUTCSeconds()).padStart(2, '0')
  const ms = String(kst.getUTCMilliseconds()).padStart(3, '0')
  return `${y}-${M}-${d}T${h}:${m}:${s}.${ms}+09:00`
}

/**
 * Compute boundaries for the PREVIOUS completed hour in KST.
 * Returns { bucketStart: Date, dateGte: string, dateLt: string }
 */
function computeHourlyBoundaries(now) {
  // Convert to KST by adding offset, then floor to current hour, subtract 1 hour
  const kstMs = now.getTime() + KST_OFFSET_MS
  const kstDate = new Date(kstMs)

  // Floor to current KST hour
  kstDate.setUTCMinutes(0, 0, 0)

  // Go back 1 hour to get the previous completed hour
  kstDate.setUTCHours(kstDate.getUTCHours() - 1)

  // bucketStart in UTC
  const bucketStartUtc = new Date(kstDate.getTime() - KST_OFFSET_MS)

  // dateGte = bucket start in KST string
  const dateGte = formatKST(bucketStartUtc)

  // dateLt = bucket start + 1 hour in KST string
  const ltUtc = new Date(bucketStartUtc.getTime() + 60 * 60 * 1000)
  const dateLt = formatKST(ltUtc)

  return { bucketStart: bucketStartUtc, dateGte, dateLt }
}

/**
 * Compute boundaries for the PREVIOUS completed day in KST.
 * Returns { bucketStart: Date, dateGte: string, dateLt: string }
 */
function computeDailyBoundaries(now) {
  // Convert to KST
  const kstMs = now.getTime() + KST_OFFSET_MS
  const kstDate = new Date(kstMs)

  // Floor to start of current KST day
  kstDate.setUTCHours(0, 0, 0, 0)

  // Go back 1 day to get previous completed day
  kstDate.setUTCDate(kstDate.getUTCDate() - 1)

  // bucketStart in UTC
  const bucketStartUtc = new Date(kstDate.getTime() - KST_OFFSET_MS)

  // dateGte = bucket start in KST string
  const dateGte = formatKST(bucketStartUtc)

  // dateLt = bucket start + 1 day in KST string
  const ltUtc = new Date(bucketStartUtc.getTime() + 24 * 60 * 60 * 1000)
  const dateLt = formatKST(ltUtc)

  return { bucketStart: bucketStartUtc, dateGte, dateLt }
}

module.exports = { formatKST, computeHourlyBoundaries, computeDailyBoundaries }
