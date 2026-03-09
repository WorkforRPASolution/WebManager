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

  const redis = getClient()
  const totalTargets = arsRedisTargets.length + resRedisTargets.length
  if (redis && totalTargets > 0) {
    const pipeline = redis.pipeline()
    for (const t of arsRedisTargets) {
      pipeline.hget(buildAgentMetaInfoKey(t.process, t.eqpModel), t.eqpId)
    }
    for (const t of resRedisTargets) {
      pipeline.hget(buildResourceAgentMetaInfoKey(t.process, t.eqpModel), t.eqpId)
    }
    const responses = await pipeline.exec()

    for (let i = 0; i < arsRedisTargets.length; i++) {
      const [err, value] = responses[i]
      if (!err && value) {
        result[arsRedisTargets[i].eqpId].arsAgent = parseAgentMetaInfoVersion(value)
      }
    }
    const offset = arsRedisTargets.length
    for (let i = 0; i < resRedisTargets.length; i++) {
      const [err, value] = responses[offset + i]
      if (!err && value) {
        result[resRedisTargets[i].eqpId].resourceAgent = parseAgentMetaInfoVersion(value)
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
