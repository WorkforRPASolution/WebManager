const crypto = require('crypto')
const { createLogger } = require('../logger')
const log = createLogger('cache')

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Deterministic cache key from prefix + filter params.
 * - Filters out null/undefined values
 * - Sorts object keys alphabetically
 * - Sorts comma-separated string values (e.g., 'B,A' → 'A,B')
 * - MD5 hashes the normalized JSON
 *
 * @param {string} prefix - Key namespace (e.g., 'dashboard:agent-status')
 * @param {Object} params - Filter parameters
 * @returns {string} Cache key: 'wm:cache:{prefix}' or 'wm:cache:{prefix}:{hash}'
 */
function buildCacheKey(prefix, params = {}) {
  const filtered = {}
  for (const [k, v] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b))) {
    if (v === undefined || v === null) continue
    filtered[k] = typeof v === 'string' && v.includes(',')
      ? v.split(',').map(s => s.trim()).sort().join(',')
      : v
  }
  if (Object.keys(filtered).length === 0) return `wm:cache:${prefix}`
  const hash = crypto.createHash('md5').update(JSON.stringify(filtered)).digest('hex')
  return `wm:cache:${prefix}:${hash}`
}

/**
 * Cache-or-compute with stampede prevention (exponential backoff mutex).
 *
 * - If redis is null, calls computeFn directly (graceful degradation).
 * - On cache HIT, returns parsed cached value.
 * - On cache MISS, acquires NX lock (EX 10s) and computes.
 * - Non-lock-holders retry with exponential backoff (50-1600ms, 6 attempts).
 * - All Redis errors are non-fatal: logged and bypassed.
 * - Cached values are JSON strings; Date objects become ISO strings after round-trip.
 *
 * @param {Object|null} redis - ioredis client (null = skip cache)
 * @param {string} key - Cache key (from buildCacheKey)
 * @param {Function} computeFn - Async function to compute the result
 * @param {number} ttlSec - Cache TTL in seconds
 * @returns {Promise<*>} Cached or computed result
 */
async function getWithCache(redis, key, computeFn, ttlSec) {
  if (!redis) return computeFn()

  // 1. Cache HIT check
  try {
    const cached = await redis.get(key)
    if (cached) {
      log.debug(`Cache HIT: ${key}`)
      return JSON.parse(cached)
    }
  } catch (err) {
    log.warn(`Cache read error: ${err.message}`)
    return computeFn()
  }

  log.debug(`Cache MISS: ${key}`)

  // 2. Stampede prevention — exponential backoff mutex
  const lockKey = `wm:lock:${key}`
  let acquired = false
  try {
    acquired = await redis.set(lockKey, '1', 'NX', 'EX', 10)
  } catch { /* lock failure → direct compute */ }

  if (!acquired) {
    for (let i = 0; i < 6; i++) {
      await sleep(Math.min(50 * Math.pow(2, i), 2000))
      try {
        const retry = await redis.get(key)
        if (retry) return JSON.parse(retry)
      } catch { /* retry failure → next attempt */ }
    }
  }

  // 3. Compute + cache store
  try {
    const result = await computeFn()
    try {
      await redis.set(key, JSON.stringify(result), 'EX', ttlSec)
    } catch (err) {
      log.warn(`Cache write error: ${err.message}`)
    }
    return result
  } finally {
    if (acquired) {
      try { await redis.del(lockKey) } catch (_) { /* lock cleanup failure ignored */ }
    }
  }
}

module.exports = { getWithCache, buildCacheKey, sleep }
