const mongoose = require('mongoose')
const { isRedisAvailable, getRedisClient, isEqpRedisAvailable, getEqpRedisClient } = require('../db/redisConnection')

let deps = {}
function _setDeps(d) { deps = d }

async function getHealthStatus() {
  const mongoReady = (deps.mongooseReadyState || (() => mongoose.connection.readyState))() === 1
  const redisDb0Available = (deps.isRedisAvailable || isRedisAvailable)()
  const eqpRedisAvailable = (deps.isEqpRedisAvailable || isEqpRedisAvailable)()

  // Determine if Redis clients exist (disabled vs down)
  const redisDb0Exists = deps.redisClientExists
    ? deps.redisClientExists()
    : getRedisClient() !== null
  const eqpRedisExists = deps.eqpRedisClientExists
    ? deps.eqpRedisClientExists()
    : getEqpRedisClient() !== null

  const mongodb = { status: mongoReady ? 'ok' : 'down' }

  let redisDb0Status
  if (redisDb0Available) redisDb0Status = 'ok'
  else if (!redisDb0Exists) redisDb0Status = 'disabled'
  else redisDb0Status = 'down'

  let redisDb10Status
  if (eqpRedisAvailable) redisDb10Status = 'ok'
  else if (!eqpRedisExists) redisDb10Status = 'disabled'
  else redisDb10Status = 'down'

  const redis_db0 = { status: redisDb0Status }
  const redis_db10_eqp = { status: redisDb10Status }

  // Gather EQP stats if DB 10 is available
  if (eqpRedisAvailable) {
    const client = (deps.getEqpRedisClient || getEqpRedisClient)()
    if (client) {
      try {
        const [eqpInfoCount, eqpInfoLineCount, lastnumStr] = await Promise.all([
          client.hlen('EQP_INFO'),
          client.hlen('EQP_INFO_LINE'),
          client.get('EQP_INFO_lastnum')
        ])
        redis_db10_eqp.eqpInfoCount = eqpInfoCount
        redis_db10_eqp.eqpInfoLineCount = eqpInfoLineCount
        redis_db10_eqp.lastnum = lastnumStr ? parseInt(lastnumStr, 10) : 0
      } catch {
        // Stats fetch failed, keep status as-is
      }
    }
  }

  // Overall status
  const hasDownRedis = redisDb0Status === 'down' || redisDb10Status === 'down'
  let status
  if (!mongoReady) status = 'down'
  else if (hasDownRedis) status = 'degraded'
  else status = 'ok'

  return {
    status,
    timestamp: new Date().toISOString(),
    components: { mongodb, redis_db0, redis_db10_eqp }
  }
}

module.exports = { getHealthStatus, _setDeps }
