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

function buildAgentHealthKey(agentGroup, process, eqpModel, eqpId) {
  return `AgentHealth:${agentGroup}:${process}-${eqpModel}-${eqpId}`
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

async function getBatchAliveStatus(eqpIds, agentGroup) {
  if (!eqpIds || eqpIds.length === 0) return {}

  const effectiveGroup = agentGroup || 'ars_agent'
  const needRunningFallback = effectiveGroup !== 'resource_agent'

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

  // Redis 키 생성: AgentHealth 키 (agentGroup 포함)
  const healthKeys = eqpIds.map(id => {
    const c = clientMap[id]
    if (!c) return null
    return buildAgentHealthKey(effectiveGroup, c.process, c.eqpModel, id)
  })

  // ars_agent일 때만 AgentRunning fallback 키 생성
  const runningKeys = needRunningFallback
    ? eqpIds.map(id => {
        const c = clientMap[id]
        if (!c) return null
        return buildAgentRunningKey(c.process, c.eqpModel, id)
      })
    : eqpIds.map(() => null)

  // null 키 제거하여 유효 키만 모아서 한 번에 mget
  const validHealthKeys = healthKeys.filter(k => k !== null)
  const validRunningKeys = needRunningFallback ? runningKeys.filter(k => k !== null) : []
  const validKeys = [...validHealthKeys, ...validRunningKeys]

  let values = []
  if (validKeys.length > 0) {
    values = await redis.mget(validKeys)
  }

  // 결과 분리: health values, running values
  const healthValues = values.slice(0, validHealthKeys.length)
  const runningValues = needRunningFallback ? values.slice(validHealthKeys.length) : []

  // 결과 매핑
  const result = {}
  let healthIdx = 0
  let runningIdx = 0
  for (let i = 0; i < eqpIds.length; i++) {
    const eqpId = eqpIds[i]
    if (healthKeys[i] === null) {
      result[eqpId] = { alive: false, uptimeSeconds: null, health: null, uptimeFormatted: null }
      continue
    }
    const healthValue = healthValues[healthIdx++]
    let rawValue = healthValue
    // AgentHealth 우선, ars_agent일 때만 AgentRunning fallback
    if (needRunningFallback) {
      const runningValue = runningValues[runningIdx++]
      if (rawValue === null || rawValue === undefined) {
        rawValue = runningValue
      }
    }
    const parsed = parseAliveValue(rawValue)
    result[eqpId] = {
      ...parsed,
      uptimeFormatted: formatUptime(parsed.uptimeSeconds),
    }
  }

  return result
}

module.exports = {
  buildAgentRunningKey,
  buildAgentHealthKey,
  parseAliveValue,
  formatUptime,
  getBatchAliveStatus,
  _setDeps,
}
