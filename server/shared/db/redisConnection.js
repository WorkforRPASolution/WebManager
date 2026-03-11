const Redis = require('ioredis')

let redisClient = null

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
    console.log('REDIS_URL not set, Redis features disabled')
    return
  }

  const parsed = parseRedisUrl(url)
  if (!parsed) {
    console.log('REDIS_URL not set, Redis features disabled')
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
      console.log(`Redis Sentinel Connected: [${sentinelList}] master=${parsed.name}`)
    } else {
      redisClient = new Redis(parsed.url, COMMON_OPTS)
      await redisClient.connect()
      console.log('Redis Connected:', parsed.url.replace(/\/\/.*@/, '//***@'))
    }
  } catch (err) {
    console.warn('Redis connection failed (non-fatal):', err.message)
    redisClient = null
  }
}

async function closeRedis() {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    console.log('Redis connection closed')
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

module.exports = { connectRedis, closeRedis, getRedisClient, isRedisAvailable, _setClient, parseRedisUrl }
