const { getRedisClient, isRedisAvailable } = require('../../shared/db/redisConnection')
const Client = require('./model')

// Test DI
let deps = {}
function _setDeps(d) { deps = d }

function getClient() {
  return deps.redisClient !== undefined ? deps.redisClient : getRedisClient()
}
function isAvailable() {
  if (deps.isRedisAvailable !== undefined) return deps.isRedisAvailable
  return isRedisAvailable()
}
function getModel() {
  return deps.ClientModel || Client
}

function buildAgentMetaInfoKey(process, eqpModel) {
  return `AgentMetaInfo:${process}-${eqpModel}`
}

function buildResourceAgentMetaInfoKey(process, eqpModel) {
  return `ResourceAgentMetaInfo:${process}-${eqpModel}`
}

function parseAgentMetaInfoVersion(value) {
  if (value === null || value === undefined || value === '') return null
  const colonIndex = value.indexOf(':')
  return colonIndex === -1 ? value : value.substring(0, colonIndex)
}

function groupByKey(targets, keyBuilder) {
  const groups = new Map()
  for (const t of targets) {
    const key = keyBuilder(t.process, t.eqpModel)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(t.eqpId)
  }
  return groups
}

async function getBatchAgentVersions(eqpIds) {
  if (!eqpIds || eqpIds.length === 0) return {}

  const ClientModel = getModel()
  const clients = await ClientModel.find({ eqpId: { $in: eqpIds } })
    .select('eqpId process eqpModel agentVersion')
    .lean()

  const clientMap = {}
  for (const c of clients) {
    clientMap[c.eqpId] = c
  }

  const result = {}
  const arsRedisTargets = []
  const resRedisTargets = []

  for (const eqpId of eqpIds) {
    const c = clientMap[eqpId]
    if (!c) {
      result[eqpId] = { arsAgent: null, resourceAgent: null }
      continue
    }

    const mongoArs = c.agentVersion?.arsAgent || null
    const mongoRes = c.agentVersion?.resourceAgent || null

    result[eqpId] = { arsAgent: mongoArs, resourceAgent: mongoRes }

    if (!mongoArs) {
      arsRedisTargets.push({ eqpId, process: c.process, eqpModel: c.eqpModel })
    }
    if (!mongoRes) {
      resRedisTargets.push({ eqpId, process: c.process, eqpModel: c.eqpModel })
    }
  }

  const totalTargets = arsRedisTargets.length + resRedisTargets.length
  if (isAvailable() && totalTargets > 0) {
    const redis = getClient()
    const arsGroups = groupByKey(arsRedisTargets, buildAgentMetaInfoKey)
    const resGroups = groupByKey(resRedisTargets, buildResourceAgentMetaInfoKey)

    const pipeline = redis.pipeline()
    const pipelineEntries = []

    for (const [key, eqpIds] of arsGroups) {
      pipeline.hmget(key, ...eqpIds)
      pipelineEntries.push({ type: 'ars', eqpIds })
    }
    for (const [key, eqpIds] of resGroups) {
      pipeline.hmget(key, ...eqpIds)
      pipelineEntries.push({ type: 'res', eqpIds })
    }

    const responses = await pipeline.exec()

    for (let i = 0; i < pipelineEntries.length; i++) {
      const [err, values] = responses[i]
      if (err) continue
      const entry = pipelineEntries[i]
      for (let j = 0; j < entry.eqpIds.length; j++) {
        const value = values[j]
        if (!value) continue
        const eqpId = entry.eqpIds[j]
        if (entry.type === 'ars') {
          result[eqpId].arsAgent = parseAgentMetaInfoVersion(value)
        } else {
          result[eqpId].resourceAgent = parseAgentMetaInfoVersion(value)
        }
      }
    }
  }

  return result
}

module.exports = {
  buildAgentMetaInfoKey,
  buildResourceAgentMetaInfoKey,
  parseAgentMetaInfoVersion,
  getBatchAgentVersions,
  _setDeps,
}
