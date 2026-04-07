const { createLogger } = require('../logger')
const log = createLogger('lock')

const RELEASE_SCRIPT = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end"

/**
 * Try to acquire a distributed lock via Redis SET NX EX.
 * @param {Object|null} redis - ioredis client (null = skip)
 * @param {string} lockKey - Redis key for the lock
 * @param {string} ownerId - Lock owner identifier (e.g., podId)
 * @param {number} ttlSec - Lock TTL in seconds
 * @returns {Promise<boolean|null>} true=acquired, false=held by other, null=Redis unavailable
 */
async function tryAcquireLock(redis, lockKey, ownerId, ttlSec) {
  if (!redis) return null
  try {
    const result = await redis.set(lockKey, ownerId, 'NX', 'EX', ttlSec)
    return result === 'OK'
  } catch (err) {
    log.warn(`[Lock] Acquire error for ${lockKey}: ${err?.message || err}`)
    return null
  }
}

/**
 * Release a distributed lock via Lua compare-and-delete (atomic).
 * Only deletes if the lock is still owned by ownerId.
 * @param {Object|null} redis - ioredis client
 * @param {string} lockKey - Redis key for the lock
 * @param {string} ownerId - Lock owner identifier
 */
async function releaseLock(redis, lockKey, ownerId) {
  if (!redis) return
  try {
    const released = await redis.eval(RELEASE_SCRIPT, 1, lockKey, ownerId)
    if (released === 0) log.warn(`[Lock] Release skipped — lock not owned: ${lockKey}`)
  } catch (err) {
    log.warn(`[Lock] Release error for ${lockKey}: ${err?.message || err}`)
  }
}

module.exports = { tryAcquireLock, releaseLock }
