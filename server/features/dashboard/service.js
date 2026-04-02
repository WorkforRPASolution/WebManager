const Client = require('../clients/model')
const { getRedisClient, isRedisAvailable } = require('../../shared/db/redisConnection')
const { buildAgentRunningKey, parseAliveValue } = require('../clients/agentAliveService')
const { buildAgentMetaInfoKey, buildResourceAgentMetaInfoKey, parseAgentMetaInfoVersion } = require('../clients/agentVersionService')
const { buildAgentHealthKey, parseAliveValue: parseHealthValue } = require('../clients/agentAliveService')
const { getWithCache, buildCacheKey } = require('../../shared/utils/apiCache')

// Test DI
let deps = {}
function _setDeps(d) { deps = d }

function getModel() { return deps.ClientModel || Client }
function getClient() { return deps.redisClient !== undefined ? deps.redisClient : getRedisClient() }
function isAvailable() { return deps.isRedisAvailable !== undefined ? deps.isRedisAvailable : isRedisAvailable() }

async function getAgentStatus(options = {}) {
  const { process, eqpModel, groupByModel, includeDetails = false } = options

  if (includeDetails) {
    const result = await _getAgentStatusCore(options)
    return { ...result, redisAvailable: isAvailable() }
  }

  const redis = getClient()
  const cacheKey = buildCacheKey('dashboard:agent-status', { process, eqpModel, groupByModel })
  const cached = await getWithCache(redis, cacheKey, () => _getAgentStatusCore(options), 15)
  return { ...cached, redisAvailable: isAvailable() }
}

async function _getAgentStatusCore(options = {}) {
  const { process, eqpModel, groupByModel, includeDetails = false } = options
  const ClientModel = getModel()

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
    return { data: [], details: includeDetails ? [] : undefined }
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
  const clientStatuses = new Array(clientList.length) // 설비별 상태 추적

  if (redisUp && keys.length > 0) {
    const redis = getClient()
    const allValues = await redis.mget(keys)

    // 4. Running 카운트 집계 + not-running 인덱스 수집
    const notRunningIndices = []
    for (let i = 0; i < allValues.length; i++) {
      const parsed = parseAliveValue(allValues[i])
      if (parsed.alive) {
        groupMap[keyGroupMap[i]].runningCount++
        clientStatuses[i] = 'Running'
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
            clientStatuses[items[j].idx] = 'Stopped'
          } else {
            clientStatuses[items[j].idx] = 'Never Started'
          }
        }
      }
    }
  } else {
    // Redis 미연결 → 모든 상태 Unknown
    for (let i = 0; i < clientList.length; i++) {
      clientStatuses[i] = 'Unknown'
    }
  }

  // 6. 정렬 (process → eqpModel)
  const data = Object.values(groupMap).sort((a, b) => {
    const pCmp = a.process.localeCompare(b.process)
    if (pCmp !== 0) return pCmp
    if (a.eqpModel && b.eqpModel) return a.eqpModel.localeCompare(b.eqpModel)
    return 0
  })

  // 7. details 배열 생성 (CSV export 시에만 요청)
  const details = includeDetails
    ? clientList.map((c, i) => ({
        process: c.process,
        eqpModel: c.eqpModel,
        eqpId: c.eqpId,
        status: clientStatuses[i],
      })).sort((a, b) => {
        const pCmp = a.process.localeCompare(b.process)
        if (pCmp !== 0) return pCmp
        const mCmp = a.eqpModel.localeCompare(b.eqpModel)
        if (mCmp !== 0) return mCmp
        return a.eqpId.localeCompare(b.eqpId)
      })
    : undefined

  return { data, details }
}

/**
 * 버전 문자열 내림차순 정렬 (semver-like), "Unknown" 항상 마지막
 */
function sortVersionsDesc(versions) {
  return [...versions].sort((a, b) => {
    if (a === 'Unknown') return 1
    if (b === 'Unknown') return -1
    const aParts = a.split('.').map(Number)
    const bParts = b.split('.').map(Number)
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const av = aParts[i] || 0
      const bv = bParts[i] || 0
      if (bv !== av) return bv - av
    }
    return 0
  })
}

async function getAgentVersionDistribution(options = {}) {
  const { process, eqpModel, groupByModel, runningOnly, includeDetails = false } = options

  if (includeDetails) {
    const result = await _getAgentVersionDistributionCore(options)
    return { ...result, redisAvailable: isAvailable() }
  }

  const redis = getClient()
  const cacheKey = buildCacheKey('dashboard:agent-version', { process, eqpModel, groupByModel, runningOnly })
  const cached = await getWithCache(redis, cacheKey, () => _getAgentVersionDistributionCore(options), 30)
  return { ...cached, redisAvailable: isAvailable() }
}

async function _getAgentVersionDistributionCore(options = {}) {
  const { process, eqpModel, groupByModel, runningOnly, includeDetails = false } = options
  const ClientModel = getModel()

  // 1. MongoDB 쿼리 빌드
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
    .select('process eqpModel eqpId agentVersion')
    .lean()

  if (clients.length === 0) {
    return { data: [], allVersions: [], details: includeDetails ? [] : undefined }
  }

  const redisUp = isAvailable()

  // 2. runningOnly 필터링
  let targetClients = clients
  if (runningOnly) {
    if (!redisUp) {
      const groupMap = {}
      for (const c of clients) {
        const groupKey = groupByModel ? `${c.process}\0${c.eqpModel}` : c.process
        if (!groupMap[groupKey]) {
          const entry = { process: c.process, agentCount: 0, versionCounts: {} }
          if (groupByModel) entry.eqpModel = c.eqpModel
          groupMap[groupKey] = entry
        }
      }
      const data = Object.values(groupMap).sort((a, b) => a.process.localeCompare(b.process))
      return { data, allVersions: [], details: includeDetails ? [] : undefined }
    }

    const redis = getClient()
    const runningKeys = clients.map(c => buildAgentRunningKey(c.process, c.eqpModel, c.eqpId))
    const allValues = runningKeys.length > 0 ? await redis.mget(runningKeys) : []
    targetClients = clients.filter((_, i) => parseAliveValue(allValues[i]).alive)
  }

  // 3. 그룹핑
  const groupMap = {}
  const redisTargets = [] // MongoDB 버전 없는 client (Redis fallback 필요)
  const clientVersionMap = new Map() // eqpId → version (설비별 버전 추적)

  for (const c of targetClients) {
    const groupKey = groupByModel ? `${c.process}\0${c.eqpModel}` : c.process
    if (!groupMap[groupKey]) {
      const entry = { process: c.process, agentCount: 0, versionCounts: {} }
      if (groupByModel) entry.eqpModel = c.eqpModel
      groupMap[groupKey] = entry
    }
    groupMap[groupKey].agentCount++

    const mongoVersion = c.agentVersion?.arsAgent || null
    if (mongoVersion) {
      groupMap[groupKey].versionCounts[mongoVersion] = (groupMap[groupKey].versionCounts[mongoVersion] || 0) + 1
      clientVersionMap.set(c.eqpId, mongoVersion)
    } else {
      redisTargets.push({ client: c, groupKey })
    }
  }

  // 4. Redis fallback (AgentMetaInfo)
  if (redisUp && redisTargets.length > 0) {
    const redis = getClient()
    const metaGroups = new Map()
    for (const { client: c, groupKey } of redisTargets) {
      const metaKey = buildAgentMetaInfoKey(c.process, c.eqpModel)
      if (!metaGroups.has(metaKey)) metaGroups.set(metaKey, [])
      metaGroups.get(metaKey).push({ eqpId: c.eqpId, groupKey })
    }

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
        const version = parseAgentMetaInfoVersion(values[j]) || 'Unknown'
        const gk = items[j].groupKey
        groupMap[gk].versionCounts[version] = (groupMap[gk].versionCounts[version] || 0) + 1
        clientVersionMap.set(items[j].eqpId, version)
      }
    }
  } else if (redisTargets.length > 0) {
    // Redis 미연결 → 모두 Unknown
    for (const { client: c, groupKey } of redisTargets) {
      groupMap[groupKey].versionCounts['Unknown'] = (groupMap[groupKey].versionCounts['Unknown'] || 0) + 1
      clientVersionMap.set(c.eqpId, 'Unknown')
    }
  }

  // 5. allVersions 수집 + 정렬
  const versionSet = new Set()
  for (const group of Object.values(groupMap)) {
    for (const v of Object.keys(group.versionCounts)) {
      versionSet.add(v)
    }
  }
  const allVersions = sortVersionsDesc([...versionSet])

  // 6. 정렬 (process → eqpModel)
  const data = Object.values(groupMap).sort((a, b) => {
    const pCmp = a.process.localeCompare(b.process)
    if (pCmp !== 0) return pCmp
    if (a.eqpModel && b.eqpModel) return a.eqpModel.localeCompare(b.eqpModel)
    return 0
  })

  // 7. details 배열 생성 (CSV export 시에만 요청)
  const details = includeDetails
    ? targetClients.map(c => ({
        process: c.process,
        eqpModel: c.eqpModel,
        eqpId: c.eqpId,
        version: clientVersionMap.get(c.eqpId) || 'Unknown',
      })).sort((a, b) => {
        const pCmp = a.process.localeCompare(b.process)
        if (pCmp !== 0) return pCmp
        const mCmp = a.eqpModel.localeCompare(b.eqpModel)
        if (mCmp !== 0) return mCmp
        return a.eqpId.localeCompare(b.eqpId)
      })
    : undefined

  return { data, allVersions, details }
}

// ===================================================
// ResourceAgent Status (5상태: OK/WARN/SHUTDOWN/Stopped/NeverStarted)
// ===================================================
async function getResourceAgentStatus(options = {}) {
  const { process, eqpModel, groupByModel, includeDetails = false } = options

  if (includeDetails) {
    const result = await _getResourceAgentStatusCore(options)
    return { ...result, redisAvailable: isAvailable() }
  }

  const redis = getClient()
  const cacheKey = buildCacheKey('dashboard:resource-agent-status', { process, eqpModel, groupByModel })
  const cached = await getWithCache(redis, cacheKey, () => _getResourceAgentStatusCore(options), 15)
  return { ...cached, redisAvailable: isAvailable() }
}

async function _getResourceAgentStatusCore(options = {}) {
  const { process, eqpModel, groupByModel, includeDetails = false } = options
  const ClientModel = getModel()

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
    return { data: [], details: includeDetails ? [] : undefined }
  }

  // 그룹핑 + AgentHealth:resource_agent 키 생성
  const groupMap = {}
  const keys = []
  const keyGroupMap = []
  const clientList = []

  for (const c of clients) {
    const groupKey = groupByModel ? `${c.process}\0${c.eqpModel}` : c.process
    if (!groupMap[groupKey]) {
      const entry = { process: c.process, agentCount: 0, okCount: 0, warnCount: 0, shutdownCount: 0, stoppedCount: 0 }
      if (groupByModel) entry.eqpModel = c.eqpModel
      groupMap[groupKey] = entry
    }
    groupMap[groupKey].agentCount++
    keys.push(buildAgentHealthKey('resource_agent', c.process, c.eqpModel, c.eqpId))
    keyGroupMap.push(groupKey)
    clientList.push(c)
  }

  const redisUp = isAvailable()
  const clientStatuses = new Array(clientList.length)

  if (redisUp && keys.length > 0) {
    const redis = getClient()
    const allValues = await redis.mget(keys)

    // 5상태 분류
    const notRunningIndices = []
    for (let i = 0; i < allValues.length; i++) {
      const parsed = parseHealthValue(allValues[i])
      if (parsed.alive) {
        const health = (parsed.health || 'OK').toUpperCase()
        if (health === 'WARN') {
          groupMap[keyGroupMap[i]].warnCount++
          clientStatuses[i] = 'WARN'
        } else if (health === 'SHUTDOWN') {
          groupMap[keyGroupMap[i]].shutdownCount++
          clientStatuses[i] = 'SHUTDOWN'
        } else {
          groupMap[keyGroupMap[i]].okCount++
          clientStatuses[i] = 'OK'
        }
      } else {
        notRunningIndices.push(i)
      }
    }

    // ResourceAgentMetaInfo로 Stopped vs NeverStarted 구분
    if (notRunningIndices.length > 0) {
      const metaGroups = new Map()
      for (const idx of notRunningIndices) {
        const c = clientList[idx]
        const metaKey = buildResourceAgentMetaInfoKey(c.process, c.eqpModel)
        if (!metaGroups.has(metaKey)) metaGroups.set(metaKey, [])
        metaGroups.get(metaKey).push({ idx, eqpId: c.eqpId })
      }

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
            groupMap[keyGroupMap[items[j].idx]].stoppedCount++
            clientStatuses[items[j].idx] = 'Stopped'
          } else {
            clientStatuses[items[j].idx] = 'Never Started'
          }
        }
      }
    }
  } else {
    for (let i = 0; i < clientList.length; i++) {
      clientStatuses[i] = 'Unknown'
    }
  }

  const data = Object.values(groupMap).sort((a, b) => {
    const pCmp = a.process.localeCompare(b.process)
    if (pCmp !== 0) return pCmp
    if (a.eqpModel && b.eqpModel) return a.eqpModel.localeCompare(b.eqpModel)
    return 0
  })

  const details = includeDetails
    ? clientList.map((c, i) => ({
        process: c.process,
        eqpModel: c.eqpModel,
        eqpId: c.eqpId,
        status: clientStatuses[i],
      })).sort((a, b) => {
        const pCmp = a.process.localeCompare(b.process)
        if (pCmp !== 0) return pCmp
        const mCmp = a.eqpModel.localeCompare(b.eqpModel)
        if (mCmp !== 0) return mCmp
        return a.eqpId.localeCompare(b.eqpId)
      })
    : undefined

  return { data, details }
}

// ===================================================
// ResourceAgent Version Distribution
// ===================================================
async function getResourceAgentVersionDistribution(options = {}) {
  const { process, eqpModel, groupByModel, runningOnly, includeDetails = false } = options

  if (includeDetails) {
    const result = await _getResourceAgentVersionDistributionCore(options)
    return { ...result, redisAvailable: isAvailable() }
  }

  const redis = getClient()
  const cacheKey = buildCacheKey('dashboard:resource-agent-version', { process, eqpModel, groupByModel, runningOnly })
  const cached = await getWithCache(redis, cacheKey, () => _getResourceAgentVersionDistributionCore(options), 30)
  return { ...cached, redisAvailable: isAvailable() }
}

async function _getResourceAgentVersionDistributionCore(options = {}) {
  const { process, eqpModel, groupByModel, runningOnly, includeDetails = false } = options
  const ClientModel = getModel()

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
    .select('process eqpModel eqpId agentVersion')
    .lean()

  if (clients.length === 0) {
    return { data: [], allVersions: [], details: includeDetails ? [] : undefined }
  }

  const redisUp = isAvailable()

  // runningOnly 필터링 (AgentHealth:resource_agent 키 사용)
  let targetClients = clients
  if (runningOnly) {
    if (!redisUp) {
      const groupMap = {}
      for (const c of clients) {
        const groupKey = groupByModel ? `${c.process}\0${c.eqpModel}` : c.process
        if (!groupMap[groupKey]) {
          const entry = { process: c.process, agentCount: 0, versionCounts: {} }
          if (groupByModel) entry.eqpModel = c.eqpModel
          groupMap[groupKey] = entry
        }
      }
      const data = Object.values(groupMap).sort((a, b) => a.process.localeCompare(b.process))
      return { data, allVersions: [], details: includeDetails ? [] : undefined }
    }

    const redis = getClient()
    const healthKeys = clients.map(c => buildAgentHealthKey('resource_agent', c.process, c.eqpModel, c.eqpId))
    const allValues = healthKeys.length > 0 ? await redis.mget(healthKeys) : []
    targetClients = clients.filter((_, i) => parseHealthValue(allValues[i]).alive)
  }

  // 그룹핑
  const groupMap = {}
  const redisTargets = []
  const clientVersionMap = new Map()

  for (const c of targetClients) {
    const groupKey = groupByModel ? `${c.process}\0${c.eqpModel}` : c.process
    if (!groupMap[groupKey]) {
      const entry = { process: c.process, agentCount: 0, versionCounts: {} }
      if (groupByModel) entry.eqpModel = c.eqpModel
      groupMap[groupKey] = entry
    }
    groupMap[groupKey].agentCount++

    const mongoVersion = c.agentVersion?.resourceAgent || null
    if (mongoVersion) {
      groupMap[groupKey].versionCounts[mongoVersion] = (groupMap[groupKey].versionCounts[mongoVersion] || 0) + 1
      clientVersionMap.set(c.eqpId, mongoVersion)
    } else {
      redisTargets.push({ client: c, groupKey })
    }
  }

  // Redis fallback (ResourceAgentMetaInfo)
  if (redisUp && redisTargets.length > 0) {
    const redis = getClient()
    const metaGroups = new Map()
    for (const { client: c, groupKey } of redisTargets) {
      const metaKey = buildResourceAgentMetaInfoKey(c.process, c.eqpModel)
      if (!metaGroups.has(metaKey)) metaGroups.set(metaKey, [])
      metaGroups.get(metaKey).push({ eqpId: c.eqpId, groupKey })
    }

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
        const version = parseAgentMetaInfoVersion(values[j]) || 'Unknown'
        const gk = items[j].groupKey
        groupMap[gk].versionCounts[version] = (groupMap[gk].versionCounts[version] || 0) + 1
        clientVersionMap.set(items[j].eqpId, version)
      }
    }
  } else if (redisTargets.length > 0) {
    for (const { client: c, groupKey } of redisTargets) {
      groupMap[groupKey].versionCounts['Unknown'] = (groupMap[groupKey].versionCounts['Unknown'] || 0) + 1
      clientVersionMap.set(c.eqpId, 'Unknown')
    }
  }

  const versionSet = new Set()
  for (const group of Object.values(groupMap)) {
    for (const v of Object.keys(group.versionCounts)) {
      versionSet.add(v)
    }
  }
  const allVersions = sortVersionsDesc([...versionSet])

  const data = Object.values(groupMap).sort((a, b) => {
    const pCmp = a.process.localeCompare(b.process)
    if (pCmp !== 0) return pCmp
    if (a.eqpModel && b.eqpModel) return a.eqpModel.localeCompare(b.eqpModel)
    return 0
  })

  const details = includeDetails
    ? targetClients.map(c => ({
        process: c.process,
        eqpModel: c.eqpModel,
        eqpId: c.eqpId,
        version: clientVersionMap.get(c.eqpId) || 'Unknown',
      })).sort((a, b) => {
        const pCmp = a.process.localeCompare(b.process)
        if (pCmp !== 0) return pCmp
        const mCmp = a.eqpModel.localeCompare(b.eqpModel)
        if (mCmp !== 0) return mCmp
        return a.eqpId.localeCompare(b.eqpId)
      })
    : undefined

  return { data, allVersions, details }
}

async function getDashboardSummary() {
  const redis = getClient()
  const cacheKey = buildCacheKey('dashboard:summary')

  return getWithCache(redis, cacheKey, async () => {
    const ClientModel = getModel()
    const [totalClients, activeClients, processCounts] = await Promise.all([
      ClientModel.countDocuments(),
      ClientModel.countDocuments({ onoff: 1 }),
      ClientModel.aggregate([
        { $group: { _id: '$process', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ])
    const inactiveClients = totalClients - activeClients

    return {
      activeClients,
      totalClients,
      inactiveClients,
      activeRate: totalClients > 0 ? ((activeClients / totalClients) * 100).toFixed(1) : 0,
      // TODO: Phase 3 — Akka 서버에서 실제 데이터 조회
      uptime: '99.9%',
      errors: Math.floor(Math.random() * 5),
      networkTraffic: `${(Math.random() * 100).toFixed(1)} MB/s`,
      processCounts: processCounts.map(p => ({
        process: p._id,
        count: p.count
      }))
    }
  }, 15)
}

module.exports = {
  getDashboardSummary,
  getAgentStatus,
  getAgentVersionDistribution,
  getResourceAgentStatus,
  getResourceAgentVersionDistribution,
  _setDeps
}
