const Client = require('../clients/model')
const { getRedisClient, isRedisAvailable } = require('../../shared/db/redisConnection')
const { buildAgentRunningKey, parseAliveValue } = require('../clients/agentAliveService')
const { buildAgentMetaInfoKey } = require('../clients/agentVersionService')

// Test DI
let deps = {}
function _setDeps(d) { deps = d }

function getModel() { return deps.ClientModel || Client }
function getClient() { return deps.redisClient !== undefined ? deps.redisClient : getRedisClient() }
function isAvailable() { return deps.isRedisAvailable !== undefined ? deps.isRedisAvailable : isRedisAvailable() }

const BATCH_SIZE = 500

async function getAgentStatus(options = {}) {
  const { process, eqpModel, groupByModel } = options
  const ClientModel = getModel()

  // 1. MongoDB 쿼리 빌드 (쉼표 구분 다중 값 지원)
  const query = {}
  if (process) {
    const arr = process.split(',').map(s => s.trim()).filter(Boolean)
    query.process = arr.length === 1 ? arr[0] : { $in: arr }
  }
  if (eqpModel) {
    const arr = eqpModel.split(',').map(s => s.trim()).filter(Boolean)
    query.eqpModel = arr.length === 1 ? arr[0] : { $in: arr }
  }

  const clients = await ClientModel.find(query)
    .select('process eqpModel eqpId')
    .lean()

  if (clients.length === 0) {
    return { data: [], redisAvailable: isAvailable() }
  }

  // 2. 그룹핑 + Redis 키 생성
  const groupMap = {} // { groupKey: { process, eqpModel?, agentCount, runningCount, stoppedCount } }
  const keys = []
  const keyGroupMap = [] // keys[i]가 어떤 groupKey에 속하는지
  const clientList = []  // 원본 client 정보 보존 (MetaInfo 조회용)

  for (const c of clients) {
    const groupKey = groupByModel ? `${c.process}\0${c.eqpModel}` : c.process
    if (!groupMap[groupKey]) {
      const entry = { process: c.process, agentCount: 0, runningCount: 0, stoppedCount: 0 }
      if (groupByModel) entry.eqpModel = c.eqpModel
      groupMap[groupKey] = entry
    }
    groupMap[groupKey].agentCount++
    keys.push(buildAgentRunningKey(c.process, c.eqpModel, c.eqpId))
    keyGroupMap.push(groupKey)
    clientList.push(c)
  }

  // 3. Redis 배치 mget (AgentRunning)
  const redisUp = isAvailable()
  if (redisUp && keys.length > 0) {
    const redis = getClient()
    const allValues = []

    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE)
      const vals = await redis.mget(batch)
      allValues.push(...vals)
    }

    // 4. Running 카운트 집계 + not-running 인덱스 수집
    const notRunningIndices = []
    for (let i = 0; i < allValues.length; i++) {
      const parsed = parseAliveValue(allValues[i])
      if (parsed.alive) {
        groupMap[keyGroupMap[i]].runningCount++
      } else {
        notRunningIndices.push(i)
      }
    }

    // 5. AgentMetaInfo로 Stopped vs NeverStarted 구분
    if (notRunningIndices.length > 0) {
      // process-eqpModel 단위로 그룹핑 (Hash 구조이므로)
      const metaGroups = new Map() // metaKey → [{ idx, eqpId }]
      for (const idx of notRunningIndices) {
        const c = clientList[idx]
        const metaKey = buildAgentMetaInfoKey(c.process, c.eqpModel)
        if (!metaGroups.has(metaKey)) metaGroups.set(metaKey, [])
        metaGroups.get(metaKey).push({ idx, eqpId: c.eqpId })
      }

      // pipeline으로 hmget 배치 실행
      const pipeline = redis.pipeline()
      const pipelineEntries = []
      for (const [metaKey, items] of metaGroups) {
        pipeline.hmget(metaKey, ...items.map(it => it.eqpId))
        pipelineEntries.push(items)
      }

      const responses = await pipeline.exec()
      for (let i = 0; i < pipelineEntries.length; i++) {
        const [err, values] = responses[i]
        if (err) continue
        const items = pipelineEntries[i]
        for (let j = 0; j < items.length; j++) {
          if (values[j] !== null && values[j] !== undefined) {
            // MetaInfo 존재 → Stopped (한번은 실행된 적 있음)
            groupMap[keyGroupMap[items[j].idx]].stoppedCount++
          }
        }
      }
    }
  }

  // 6. 정렬 (process → eqpModel)
  const data = Object.values(groupMap).sort((a, b) => {
    const pCmp = a.process.localeCompare(b.process)
    if (pCmp !== 0) return pCmp
    if (a.eqpModel && b.eqpModel) return a.eqpModel.localeCompare(b.eqpModel)
    return 0
  })

  return { data, redisAvailable: redisUp }
}

module.exports = { getAgentStatus, _setDeps }
