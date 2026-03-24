const Redis = require('ioredis')
const { createLogger } = require('../logger')
const log = createLogger('redis')

let redisClient = null
let eqpRedisClient = null  // DB 10 for EQP_INFO

const COMMON_OPTS = {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) return null
    return Math.min(times * 200, 2000)
  },
  lazyConnect: true,
}

/**
 * REDIS_URL 문자열을 파싱하여 연결 모드와 설정을 반환
 * - Sentinel: {host:port},{host:port}#masterName
 * - Simple:  redis://host:port/db
 */
function parseRedisUrl(url) {
  if (!url) return null

  // '#' 포함 시 Sentinel 형식
  if (url.includes('#')) {
    const [sentinelPart, name] = url.split('#')
    const sentinels = sentinelPart
      .split('},{')
      .map(s => s.replace(/[{}]/g, ''))
      .map(s => {
        const [host, portStr] = s.split(':')
        return { host, port: portStr ? parseInt(portStr, 10) : 26379 }
      })
    return { mode: 'sentinel', sentinels, name }
  }

  return { mode: 'simple', url }
}

async function connectRedis() {
  const url = process.env.REDIS_URL
  if (!url) {
    log.info('REDIS_URL not set, Redis features disabled')
    return
  }

  const parsed = parseRedisUrl(url)
  if (!parsed) {
    log.info('REDIS_URL not set, Redis features disabled')
    return
  }

  try {
    if (parsed.mode === 'sentinel') {
      const password = process.env.REDIS_PASSWORD || undefined
      redisClient = new Redis({
        sentinels: parsed.sentinels,
        name: parsed.name,
        password,
        sentinelPassword: password,
        db: 0,
        ...COMMON_OPTS,
      })
      await redisClient.connect()
      const sentinelList = parsed.sentinels.map(s => `${s.host}:${s.port}`).join(', ')
      log.info(`Redis Sentinel Connected: [${sentinelList}] master=${parsed.name}`)
    } else {
      redisClient = new Redis(parsed.url, COMMON_OPTS)
      await redisClient.connect()
      log.info(`Redis Connected: ${parsed.url.replace(/\/\/.*@/, '//***@')}`)
    }
  } catch (err) {
    log.warn(`Redis connection failed (non-fatal): ${err.message}`)
    redisClient = null
  }
}

async function closeRedis() {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    log.info('Redis connection closed')
  }
}

function getRedisClient() {
  return redisClient
}

function isRedisAvailable() {
  return redisClient !== null && redisClient.status === 'ready'
}

// Test injection
function _setClient(client) {
  redisClient = client
}

// ============================================
// DB 10: EQP_INFO Redis
// ============================================

async function connectEqpRedis() {
  const url = process.env.REDIS_URL
  if (!url) { log.info('REDIS_URL not set, EQP Redis (DB 10) disabled'); return }
  const parsed = parseRedisUrl(url)
  if (!parsed) return

  try {
    if (parsed.mode === 'sentinel') {
      const password = process.env.REDIS_PASSWORD || undefined
      eqpRedisClient = new Redis({
        sentinels: parsed.sentinels,
        name: parsed.name,
        password,
        sentinelPassword: password,
        db: 10,
        ...COMMON_OPTS,
      })
      await eqpRedisClient.connect()
      log.info('Redis EQP (DB 10) Sentinel Connected')
    } else {
      const baseUrl = parsed.url.replace(/\/\d+$/, '')
      eqpRedisClient = new Redis(`${baseUrl}/10`, COMMON_OPTS)
      await eqpRedisClient.connect()
      log.info('Redis EQP (DB 10) Connected')
    }
  } catch (err) {
    log.warn(`Redis EQP (DB 10) connection failed (non-fatal): ${err.message}`)
    eqpRedisClient = null
  }
}

async function closeEqpRedis() {
  if (eqpRedisClient) {
    await eqpRedisClient.quit()
    eqpRedisClient = null
  }
}

function getEqpRedisClient() { return eqpRedisClient }
function isEqpRedisAvailable() { return eqpRedisClient !== null && eqpRedisClient.status === 'ready' }
function _setEqpClient(client) { eqpRedisClient = client }

module.exports = {
  // DB 0 (기존)
  connectRedis, closeRedis, getRedisClient, isRedisAvailable, _setClient, parseRedisUrl,
  // DB 10 (EQP_INFO)
  connectEqpRedis, closeEqpRedis, getEqpRedisClient, isEqpRedisAvailable, _setEqpClient,
}
