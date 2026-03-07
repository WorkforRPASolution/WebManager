const Redis = require('ioredis')

let redisClient = null

async function connectRedis() {
  const url = process.env.REDIS_URL
  if (!url) {
    console.log('REDIS_URL not set, Redis features disabled')
    return
  }
  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null  // stop retrying
        return Math.min(times * 200, 2000)
      },
      lazyConnect: true,
    })
    await redisClient.connect()
    console.log('Redis Connected:', url.replace(/\/\/.*@/, '//***@'))
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

module.exports = { connectRedis, closeRedis, getRedisClient, isRedisAvailable, _setClient }
