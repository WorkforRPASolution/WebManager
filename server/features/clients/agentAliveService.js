const { getRedisClient } = require('../../shared/db/redisConnection')
const Client = require('./model')

// Test DI
let deps = {}
function _setDeps(d) { deps = d }

function getClient() {
  return deps.redisClient !== undefined ? deps.redisClient : getRedisClient()
}
function getModel() {
  return deps.ClientModel || Client
}

function buildAgentRunningKey(process, eqpModel, eqpId) {
  return `AgentRunning:${process}-${eqpModel}-${eqpId}`
}

function parseAliveValue(value) {
  if (value === null || value === undefined || value === '') {
    return { alive: false, uptimeSeconds: null, health: null }
  }

  // Future format: "OK:3600" or "WARN:3600:reason"
  if (value.includes(':')) {
    const parts = value.split(':')
    const health = parts[0]
    const uptimeSeconds = parseInt(parts[1], 10)
    const reason = parts[2] || null
    return {
      alive: true,
      uptimeSeconds: isNaN(uptimeSeconds) ? null : uptimeSeconds,
      health,
      reason,
    }
  }

  // Current format: pure number string "3600"
  const uptimeSeconds = parseInt(value, 10)
  if (isNaN(uptimeSeconds)) {
    return { alive: false, uptimeSeconds: null, health: null }
  }
  return { alive: true, uptimeSeconds, health: 'OK' }
}

function formatUptime(seconds) {
  if (seconds === null || seconds === undefined) return null

  const s = Math.floor(seconds)
  if (s < 60) return `${s}s`

  const minutes = Math.floor(s / 60)
  const secs = s % 60
  if (minutes < 60) return `${minutes}m ${secs}s`

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 24) return `${hours}h ${mins}m`

  const days = Math.floor(hours / 24)
  const hrs = hours % 24
  return `${days}d ${hrs}h`
}

async function getBatchAliveStatus(eqpIds) {
  if (!eqpIds || eqpIds.length === 0) return {}

  const redis = getClient()
  if (!redis) {
    const result = {}
    for (const id of eqpIds) {
      result[id] = { alive: null, redisUnavailable: true }
    }
    return result
  }

  // MongoDB에서 process, eqpModel 조회
  const ClientModel = getModel()
  const clients = await ClientModel.find({ eqpId: { $in: eqpIds } })
    .select('eqpId process eqpModel')
    .lean()

  const clientMap = {}
  for (const c of clients) {
    clientMap[c.eqpId] = c
  }

  // Redis 키 생성
  const keys = eqpIds.map(id => {
    const c = clientMap[id]
    if (!c) return null
    return buildAgentRunningKey(c.process, c.eqpModel, id)
  })

  // null 키는 빈 결과로 처리
  const validKeys = keys.filter(k => k !== null)

  let values = []
  if (validKeys.length > 0) {
    values = await redis.mget(...validKeys)
  }

  // 결과 매핑
  const result = {}
  let valueIdx = 0
  for (let i = 0; i < eqpIds.length; i++) {
    const eqpId = eqpIds[i]
    if (keys[i] === null) {
      result[eqpId] = { alive: false, uptimeSeconds: null, health: null, uptimeFormatted: null }
      continue
    }
    const parsed = parseAliveValue(values[valueIdx++])
    result[eqpId] = {
      ...parsed,
      uptimeFormatted: formatUptime(parsed.uptimeSeconds),
    }
  }

  return result
}

module.exports = {
  buildAgentRunningKey,
  parseAliveValue,
  formatUptime,
  getBatchAliveStatus,
  _setDeps,
}
