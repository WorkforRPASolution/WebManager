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
 * @param {Date} now - Current time
 * @param {number} settlingHours - Hours to subtract before computing (default 0)
 * Returns { bucketStart: Date, dateGte: string, dateLt: string }
 */
function computeHourlyBoundaries(now, settlingHours = 0) {
  // Apply settling offset
  const adjustedNow = settlingHours > 0
    ? new Date(now.getTime() - settlingHours * 60 * 60 * 1000)
    : now

  // Convert to KST by adding offset, then floor to current hour, subtract 1 hour
  const kstMs = adjustedNow.getTime() + KST_OFFSET_MS
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

/**
 * Compute boundaries for a specific bucket Date.
 * @param {'hourly'|'daily'} period
 * @param {Date} bucketDate - The bucket start time (UTC)
 * Returns { bucketStart: Date, dateGte: string, dateLt: string }
 */
function computeBoundariesForBucket(period, bucketDate) {
  const dateGte = formatKST(bucketDate)
  const increment = period === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const ltUtc = new Date(bucketDate.getTime() + increment)
  const dateLt = formatKST(ltUtc)
  return { bucketStart: bucketDate, dateGte, dateLt }
}

/**
 * Generate array of expected bucket Dates in [startDate, endDate) range.
 * @param {'hourly'|'daily'} period
 * @param {Date} startDate - Inclusive start (UTC bucket time)
 * @param {Date} endDate - Exclusive end (UTC bucket time)
 * @returns {Date[]}
 */
function generateExpectedBuckets(period, startDate, endDate) {
  const increment = period === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const buckets = []
  let current = startDate.getTime()
  const end = endDate.getTime()
  // bucket의 종료 시각(current + increment)이 endDate 이내인 것만 포함
  // → 아직 완료되지 않은 기간의 bucket은 제외
  while (current + increment <= end) {
    buckets.push(new Date(current))
    current += increment
  }
  return buckets
}

/**
 * Floor an arbitrary Date to KST bucket start.
 * @param {'hourly'|'daily'} period
 * @param {Date} date
 * @returns {Date} - UTC Date representing the KST-aligned bucket start
 */
function floorToKSTBucket(period, date) {
  const kstMs = date.getTime() + KST_OFFSET_MS
  const kstDate = new Date(kstMs)

  if (period === 'hourly') {
    kstDate.setUTCMinutes(0, 0, 0)
  } else {
    kstDate.setUTCHours(0, 0, 0, 0)
  }

  return new Date(kstDate.getTime() - KST_OFFSET_MS)
}

module.exports = {
  formatKST,
  computeHourlyBoundaries,
  computeDailyBoundaries,
  computeBoundariesForBucket,
  generateExpectedBuckets,
  floorToKSTBucket
}
