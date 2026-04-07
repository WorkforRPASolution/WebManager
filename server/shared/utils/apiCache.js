const crypto = require('crypto')
const { createLogger } = require('../logger')
const log = createLogger('cache')

// Lua compare-and-delete: 자기 소유 락만 삭제 (TTL 만료 후 다른 holder의 락 보호)
const RELEASE_LUA = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end"

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Deterministic cache key from prefix + filter params.
 * - Filters out null/undefined values
 * - Sorts object keys alphabetically
 * - Sorts comma-separated string values (e.g., 'B,A' → 'A,B', 'A,,B' → 'A,B')
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
      ? v.split(',').map(s => s.trim()).filter(Boolean).sort().join(',')
      : v
  }
  if (Object.keys(filtered).length === 0) return `wm:cache:${prefix}`
  const hash = crypto.createHash('md5').update(JSON.stringify(filtered)).digest('hex')
  return `wm:cache:${prefix}:${hash}`
}

/**
 * Cache-or-compute with stampede prevention (UUID-tagged owner lock + Lua release).
 *
 * - If redis is null, calls computeFn directly (graceful degradation).
 * - On cache HIT, returns parsed cached value.
 * - On cache MISS, acquires NX lock with UUID owner (EX 30s) and computes.
 * - Non-lock-holders retry with exponential backoff (50-1600ms, 6 attempts) — total ~3s wait.
 * - After backoff exhaustion: re-check cache once, then attempt to acquire lock again before falling back to direct compute.
 * - Lock release uses Lua compare-and-delete to prevent deleting another holder's lock if our TTL expired.
 * - Cache write uses NX to prevent overwriting holder's value when racing.
 * - All Redis errors are non-fatal: logged and bypassed.
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

  // 2. Stampede prevention — UUID-tagged NX lock
  const lockKey = `wm:lock:${key}`
  const lockOwner = crypto.randomUUID()
  let acquired = false
  try {
    const setResult = await redis.set(lockKey, lockOwner, 'NX', 'EX', 30)
    acquired = (setResult === 'OK')
  } catch { /* lock failure → direct compute path */ }

  if (!acquired) {
    // Wait for holder to finish (50→1600ms, 6 attempts ≈ 3s total)
    for (let i = 0; i < 6; i++) {
      await sleep(Math.min(50 * Math.pow(2, i), 2000))
      try {
        const retry = await redis.get(key)
        if (retry) return JSON.parse(retry)
      } catch { /* retry failure → next attempt */ }
    }
    // Last-chance: try acquire lock one more time before fallback
    try {
      const setResult = await redis.set(lockKey, lockOwner, 'NX', 'EX', 30)
      acquired = (setResult === 'OK')
    } catch { /* still no lock → fall through to direct compute */ }
  }

  // 3. Compute + cache store
  try {
    const result = await computeFn()
    if (result !== undefined && result !== null) {
      try {
        // NX: don't overwrite holder's value if a racing holder beat us
        await redis.set(key, JSON.stringify(result), 'EX', ttlSec, 'NX')
      } catch (err) {
        log.warn(`Cache write error: ${err.message}`)
      }
    }
    return result
  } finally {
    if (acquired) {
      // Lua compare-and-delete: only delete if WE still own the lock
      try { await redis.eval(RELEASE_LUA, 1, lockKey, lockOwner) } catch (_) { /* lock cleanup failure ignored */ }
    }
  }
}

module.exports = { getWithCache, buildCacheKey, sleep }
