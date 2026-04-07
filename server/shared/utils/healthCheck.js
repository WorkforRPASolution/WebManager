const { earsConnection, webManagerConnection } = require('../db/connection')
const { isRedisAvailable, getRedisClient, isEqpRedisAvailable, getEqpRedisClient } = require('../db/redisConnection')
const { getPodId } = require('./podIdentity')
const { createLogger } = require('../logger')
const log = createLogger('eqp-redis')

let deps = {}
function _setDeps(d) { deps = d }

async function getHealthStatus() {
  // createConnection() 사용 시 mongoose.connection(기본)은 항상 readyState=0
  // 실제 연결 객체(earsConnection, webManagerConnection)를 확인해야 함
  const earsReady = (deps.earsReadyState || (() => earsConnection.readyState))() === 1
  const wmReady = (deps.wmReadyState || (() => webManagerConnection.readyState))() === 1
  const mongoReady = earsReady && wmReady
  const redisDb0Available = (deps.isRedisAvailable || isRedisAvailable)()
  const eqpRedisAvailable = (deps.isEqpRedisAvailable || isEqpRedisAvailable)()

  // Determine if Redis clients exist (disabled vs down)
  const redisDb0Exists = deps.redisClientExists
    ? deps.redisClientExists()
    : getRedisClient() !== null
  const eqpRedisExists = deps.eqpRedisClientExists
    ? deps.eqpRedisClientExists()
    : getEqpRedisClient() !== null

  const mongodb = {
    status: mongoReady ? 'ok' : 'down',
    ears: earsReady ? 'ok' : 'down',
    webManager: wmReady ? 'ok' : 'down'
  }

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
      } catch (err) {
        (deps.log || log).warn(`EQP Redis stats fetch failed: ${err.message}`)
        redis_db10_eqp.statsError = err.message
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
    podId: getPodId(),
    timestamp: new Date().toISOString(),
    components: { mongodb, redis_db0, redis_db10_eqp }
  }
}

module.exports = { getHealthStatus, _setDeps }
