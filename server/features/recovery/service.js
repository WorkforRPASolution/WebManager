/**
 * Recovery Dashboard API Service
 *
 * Queries Summary collections (RECOVERY_SUMMARY_BY_SCENARIO/EQUIPMENT/TRIGGER)
 * and original EQP_AUTO_RECOVERY for history lookups.
 */

const { earsConnection } = require('../../shared/db/connection')
const { parsePeriod } = require('./validation')

// ── Dependency Injection (for testing) ──

let deps = {}

function _setDeps(d) { deps = d }

function getEarsDb() {
  return deps.earsDb || earsConnection.db
}

// ── Collection & Tab Config ──

const TAB_CONFIG = {
  scenario:  { collection: 'RECOVERY_SUMMARY_BY_SCENARIO',  groupField: 'ears_code' },
  equipment: { collection: 'RECOVERY_SUMMARY_BY_EQUIPMENT', groupField: 'eqpid' },
  trigger:   { collection: 'RECOVERY_SUMMARY_BY_TRIGGER',   groupField: 'trigger_by' }
}

// Failed-category statuses for Top N rankings
const FAILED_STATUSES = ['Failed', 'ScriptFailed', 'VisionDelayed', 'NotStarted']

// ── Response Normalization ──

/**
 * Rename status_counts → statusCounts in a document (or array of documents).
 * Applied to all service return values so the frontend receives camelCase keys.
 */
function normalizeDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc
  if (Array.isArray(doc)) return doc.map(normalizeDoc)
  if (doc.status_counts !== undefined) {
    doc.statusCounts = doc.status_counts
    delete doc.status_counts
  }
  return doc
}

// ── Helpers ──

/**
 * Build a $match filter object from period + optional dimension filters.
 */
/**
 * 콤마 구분 문자열을 $in 조건으로 변환. 단일 값이면 직접 매칭.
 */
function toMatchValue(csv) {
  if (!csv) return undefined
  const arr = csv.split(',').map(s => s.trim()).filter(Boolean)
  return arr.length === 1 ? arr[0] : { $in: arr }
}

function buildMatchFilter(period, { process, line, model, startDate, endDate } = {}) {
  const parsed = parsePeriod(period, { startDate, endDate })
  const match = { period: 'daily' }

  if (parsed) {
    match.bucket = { $gte: new Date(parsed.startDate), $lte: new Date(parsed.endDate) }
  }

  const pv = toMatchValue(process)
  if (pv) match.process = pv
  const lv = toMatchValue(line)
  if (lv) match.line = lv
  const mv = toMatchValue(model)
  if (mv) match.model = mv

  return match
}

/**
 * 기간 길이에 따라 트렌드 표시 단위(granularity) 결정
 * @param {string} period - 프리셋 기간
 * @param {Object} opts - { startDate, endDate } for custom
 * @returns {'hourly'|'daily'|'weekly'|'monthly'}
 */
function determineTrendGranularity(period, { startDate, endDate } = {}) {
  const GRANULARITY_MAP = {
    today: 'hourly',
    '7d': 'daily',
    '30d': 'daily',
    '90d': 'weekly',
    '1y': 'monthly',
    '2y': 'monthly'
  }
  if (period !== 'custom') return GRANULARITY_MAP[period] || 'daily'

  // 커스텀: 기간 길이로 자동 판별
  if (!startDate || !endDate) return 'daily'
  const diffDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays <= 1) return 'hourly'
  if (diffDays <= 30) return 'daily'
  if (diffDays <= 90) return 'weekly'
  return 'monthly'
}

/**
 * Build trend match filter.
 * hourly는 hourly summary 사용, daily/weekly/monthly는 daily summary 사용 (weekly/monthly는 후처리로 롤업).
 */
function buildTrendMatchFilter(period, { process, line, model, startDate, endDate } = {}) {
  const parsed = parsePeriod(period, { startDate, endDate })
  const granularity = determineTrendGranularity(period, { startDate, endDate })
  // hourly만 hourly summary, 나머지는 daily summary에서 롤업
  const summaryPeriod = (granularity === 'hourly') ? 'hourly' : 'daily'
  const match = { period: summaryPeriod }

  if (parsed) {
    match.bucket = { $gte: new Date(parsed.startDate), $lte: new Date(parsed.endDate) }
  }

  const pv = toMatchValue(process)
  if (pv) match.process = pv
  const lv = toMatchValue(line)
  if (lv) match.line = lv
  const mv = toMatchValue(model)
  if (mv) match.model = mv

  return match
}

/**
 * daily 트렌드 결과를 weekly 또는 monthly로 롤업
 * @param {Array} dailyTrend - [{ bucket, total, status_counts, scenarioCount? }]
 * @param {'daily'|'weekly'|'monthly'} granularity
 * @returns {Array} 롤업된 트렌드
 */
/**
 * 항목 구분 키 추출 (Analysis trend처럼 ears_code/eqpid/trigger_by/name 등)
 */
function extractItemKey(item) {
  return item.ears_code || item.eqpid || item.trigger_by || item.name || item.process || null
}

function rollupTrend(dailyTrend, granularity) {
  if (granularity === 'daily' || granularity === 'hourly') return dailyTrend

  // 항목 구분 필드가 있는지 확인 (Analysis trend는 항목별, Overview trend는 전체)
  const hasItemKey = dailyTrend.length > 0 && extractItemKey(dailyTrend[0]) !== null
  // 항목 구분에 사용할 원본 필드명 보존
  const ITEM_FIELDS = ['ears_code', 'eqpid', 'trigger_by', 'name', 'process', 'model']

  const groups = new Map()

  for (const item of dailyTrend) {
    const date = new Date(item.bucket)
    let timeBucket

    if (granularity === 'weekly') {
      const day = date.getUTCDay()
      const mondayOffset = day === 0 ? -6 : 1 - day
      const monday = new Date(date)
      monday.setUTCDate(monday.getUTCDate() + mondayOffset)
      monday.setUTCHours(0, 0, 0, 0)
      timeBucket = monday.toISOString()
    } else {
      const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
      timeBucket = monthStart.toISOString()
    }

    // 항목별 구분이 있으면 timeBucket + itemKey로 그룹, 없으면 timeBucket만
    const itemKey = hasItemKey ? extractItemKey(item) : ''
    const groupKey = `${timeBucket}||${itemKey}`

    if (!groups.has(groupKey)) {
      const base = { bucket: timeBucket, total: 0, statusCounts: {}, scenarioSum: 0 }
      // 원본 필드 보존
      for (const f of ITEM_FIELDS) {
        if (item[f] !== undefined) base[f] = item[f]
      }
      groups.set(groupKey, base)
    }

    const g = groups.get(groupKey)
    g.total += item.total || 0

    const sc = item.statusCounts || item.status_counts || {}
    for (const [k, v] of Object.entries(sc)) {
      g.statusCounts[k] = (g.statusCounts[k] || 0) + v
    }

    if (item.scenarioCount) g.scenarioSum += item.scenarioCount
  }

  return Array.from(groups.values())
    .map(g => {
      const result = { bucket: g.bucket, total: g.total, statusCounts: g.statusCounts, scenarioCount: g.scenarioSum }
      for (const f of ITEM_FIELDS) {
        if (g[f] !== undefined) result[f] = g[f]
      }
      return result
    })
    .sort((a, b) => {
      const cmp = a.bucket.localeCompare(b.bucket)
      if (cmp !== 0) return cmp
      return (extractItemKey(a) || '').localeCompare(extractItemKey(b) || '')
    })
}

/**
 * Simpler KPI pipeline: just sum total and use $objectToArray to aggregate status_counts.
 */
function buildSimpleKpiPipeline(matchFilter) {
  return [
    { $match: matchFilter },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    {
      $group: {
        _id: '$sc_array.k',
        count: { $sum: '$sc_array.v' }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' },
        statuses: { $push: { k: '$_id', v: '$count' } }
      }
    },
    { $addFields: { status_counts: { $arrayToObject: '$statuses' } } },
    { $project: { _id: 0, total: 1, status_counts: 1 } }
  ]
}

/**
 * Extract KPI values from aggregation result.
 */
function extractKpi(aggResult) {
  if (!aggResult || aggResult.length === 0) {
    return {
      total: 0, success: 0, failed: 0, stopped: 0, skip: 0, successRate: 0,
      prevTotal: 0, prevSuccess: 0, prevSuccessRate: 0
    }
  }

  const doc = aggResult[0]
  const sc = doc.status_counts || {}
  const total = doc.total || 0
  const success = sc.Success || 0
  const failed = (sc.Failed || 0) + (sc.ScriptFailed || 0) + (sc.VisionDelayed || 0) + (sc.NotStarted || 0)
  const stopped = sc.Stopped || 0
  const skip = sc.Skip || 0
  const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 0

  return { total, success, failed, stopped, skip, successRate }
}

// ── Main API Functions ──

/**
 * GET /api/recovery/overview
 */
async function getOverview(filters = {}) {
  const { period = 'today', process, line, startDate, endDate } = filters
  const db = getEarsDb()
  const dimFilters = { process, line, startDate, endDate }

  const dailyMatch = buildMatchFilter(period, dimFilters)
  const trendMatch = buildTrendMatchFilter(period, dimFilters)

  // Build pipelines
  const trendPipeline = [
    { $match: trendMatch },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    { $group: { _id: { bucket: '$bucket', status: '$sc_array.k' }, count: { $sum: '$sc_array.v' } } },
    { $group: { _id: '$_id.bucket', total: { $sum: '$count' }, statuses: { $push: { k: '$_id.status', v: '$count' } } } },
    { $addFields: { status_counts: { $arrayToObject: '$statuses' } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, bucket: '$_id', total: 1, status_counts: 1 } }
  ]

  const scenarioCountPipeline = [
    { $match: trendMatch },
    { $group: { _id: { bucket: '$bucket', ears_code: '$ears_code' } } },
    { $group: { _id: '$_id.bucket', scenarioCount: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, bucket: '$_id', scenarioCount: 1 } }
  ]

  const topScenariosPipeline = [
    { $match: dailyMatch },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    { $match: { 'sc_array.k': { $in: FAILED_STATUSES } } },
    { $group: { _id: '$ears_code', failedCount: { $sum: '$sc_array.v' } } },
    { $sort: { failedCount: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, name: '$_id', count: '$failedCount' } }
  ]

  const topEquipmentPipeline = [
    { $match: dailyMatch },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    { $match: { 'sc_array.k': { $in: FAILED_STATUSES } } },
    { $group: { _id: '$eqpid', failedCount: { $sum: '$sc_array.v' } } },
    { $sort: { failedCount: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, name: '$_id', count: '$failedCount' } }
  ]

  const triggerPipeline = [
    { $match: dailyMatch },
    { $group: { _id: '$trigger_by', total: { $sum: '$total' } } },
    { $sort: { total: -1 } },
    { $project: { _id: 0, trigger_by: '$_id', total: 1 } }
  ]

  // Previous period match
  const parsed = parsePeriod(period, { startDate, endDate })
  let prevMatch = null
  if (parsed) {
    const start = new Date(parsed.startDate)
    const end = new Date(parsed.endDate)
    const durationMs = end.getTime() - start.getTime()
    prevMatch = { period: 'daily', bucket: { $gte: new Date(start.getTime() - durationMs), $lt: start } }
    const pv = toMatchValue(process)
    if (pv) prevMatch.process = pv
    const lv = toMatchValue(line)
    if (lv) prevMatch.line = lv
  }

  const scenarioColl = db.collection('RECOVERY_SUMMARY_BY_SCENARIO')
  const opts = { allowDiskUse: true, maxTimeMS: 55000 }

  // 병렬 실행 — 7개 쿼리 동시
  const [kpiResult, prevResult, trend, scenarioCounts, topScenarios, topEquipment, triggerDistribution] = await Promise.all([
    scenarioColl.aggregate(buildSimpleKpiPipeline(dailyMatch), opts).toArray(),
    prevMatch ? scenarioColl.aggregate(buildSimpleKpiPipeline(prevMatch), opts).toArray() : Promise.resolve([]),
    scenarioColl.aggregate(trendPipeline, opts).toArray(),
    scenarioColl.aggregate(scenarioCountPipeline, opts).toArray(),
    scenarioColl.aggregate(topScenariosPipeline, opts).toArray(),
    db.collection('RECOVERY_SUMMARY_BY_EQUIPMENT').aggregate(topEquipmentPipeline, opts).toArray(),
    db.collection('RECOVERY_SUMMARY_BY_TRIGGER').aggregate(triggerPipeline, opts).toArray()
  ])

  // KPI 조립
  const kpi = extractKpi(kpiResult)
  const prev = extractKpi(prevResult)
  kpi.prevTotal = prev.total
  kpi.prevSuccess = prev.success
  kpi.prevSuccessRate = prev.successRate

  // trend에 scenarioCount 병합
  const scMap = new Map(scenarioCounts.filter(s => s.bucket).map(s => [s.bucket.toISOString(), s.scenarioCount]))
  for (const t of trend) {
    if (!t.bucket) continue
    const key = t.bucket instanceof Date ? t.bucket.toISOString() : new Date(t.bucket).toISOString()
    t.scenarioCount = scMap.get(key) || 0
  }

  const statusDistribution = {
    Success: kpi.success,
    Failed: kpi.failed,
    Stopped: kpi.stopped,
    Skip: kpi.skip
  }

  const granularity = determineTrendGranularity(period, { startDate, endDate })
  const rolledTrend = rollupTrend(normalizeDoc(trend), granularity)

  return { kpi, trend: rolledTrend, granularity, statusDistribution, topScenarios, topEquipment, triggerDistribution }
}

/**
 * GET /api/recovery/by-process
 */
async function getByProcess(filters = {}) {
  const { period = 'today', process, line, startDate, endDate } = filters
  const db = getEarsDb()
  const dimFilters = { process, line, startDate, endDate }

  const dailyMatch = buildMatchFilter(period, dimFilters)
  const trendMatch = buildTrendMatchFilter(period, dimFilters)

  // 1. Process-level aggregation from scenario summary
  const opts = { allowDiskUse: true, maxTimeMS: 55000 }

  const processPipeline = [
    { $match: dailyMatch },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    {
      $group: {
        _id: { process: '$process', status: '$sc_array.k' },
        count: { $sum: '$sc_array.v' }
      }
    },
    {
      $group: {
        _id: '$_id.process',
        total: { $sum: '$count' },
        statuses: { $push: { k: '$_id.status', v: '$count' } }
      }
    },
    { $addFields: { status_counts: { $arrayToObject: '$statuses' } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, process: '$_id', total: 1, status_counts: 1 } }
  ]

  // 2. Hourly trend per process (success rate timeline)
  const trendPipeline = [
    { $match: trendMatch },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    {
      $group: {
        _id: { bucket: '$bucket', process: '$process', status: '$sc_array.k' },
        count: { $sum: '$sc_array.v' }
      }
    },
    {
      $group: {
        _id: { bucket: '$_id.bucket', process: '$_id.process' },
        total: { $sum: '$count' },
        statuses: { $push: { k: '$_id.status', v: '$count' } }
      }
    },
    { $addFields: { status_counts: { $arrayToObject: '$statuses' } } },
    { $sort: { '_id.bucket': 1 } },
    {
      $project: {
        _id: 0,
        bucket: '$_id.bucket',
        process: '$_id.process',
        total: 1,
        status_counts: 1
      }
    }
  ]

  // 3. Drilldown: Top 5 failed scenarios and equipment per process
  const drilldownScenarioPipeline = [
    { $match: dailyMatch },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    { $match: { 'sc_array.k': { $in: FAILED_STATUSES } } },
    {
      $group: {
        _id: { process: '$process', ears_code: '$ears_code' },
        failedCount: { $sum: '$sc_array.v' }
      }
    },
    { $sort: { failedCount: -1 } },
    {
      $group: {
        _id: '$_id.process',
        topScenarios: { $push: { name: '$_id.ears_code', count: '$failedCount' } }
      }
    },
    { $project: { _id: 0, process: '$_id', topScenarios: { $slice: ['$topScenarios', 5] } } }
  ]

  const drilldownEquipmentPipeline = [
    { $match: dailyMatch },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    { $match: { 'sc_array.k': { $in: FAILED_STATUSES } } },
    {
      $group: {
        _id: { process: '$process', eqpid: '$eqpid' },
        failedCount: { $sum: '$sc_array.v' }
      }
    },
    { $sort: { failedCount: -1 } },
    {
      $group: {
        _id: '$_id.process',
        topEquipment: { $push: { name: '$_id.eqpid', count: '$failedCount' } }
      }
    },
    { $project: { _id: 0, process: '$_id', topEquipment: { $slice: ['$topEquipment', 5] } } }
  ]

  // 3-c. Trigger distribution per process
  const drilldownTriggerPipeline = [
    { $match: dailyMatch },
    {
      $group: {
        _id: { process: '$process', trigger_by: '$trigger_by' },
        total: { $sum: '$total' }
      }
    },
    { $sort: { total: -1 } },
    {
      $group: {
        _id: '$_id.process',
        triggers: { $push: { trigger_by: '$_id.trigger_by', total: '$total' } }
      }
    },
    { $project: { _id: 0, process: '$_id', triggers: 1 } }
  ]

  // 병렬 실행 — 5개 쿼리 동시
  const [processes, trend, drilldownScenarios, drilldownEquipment, drilldownTriggers] = await Promise.all([
    db.collection('RECOVERY_SUMMARY_BY_SCENARIO').aggregate(processPipeline, opts).toArray(),
    db.collection('RECOVERY_SUMMARY_BY_SCENARIO').aggregate(trendPipeline, opts).toArray(),
    db.collection('RECOVERY_SUMMARY_BY_SCENARIO').aggregate(drilldownScenarioPipeline, opts).toArray(),
    db.collection('RECOVERY_SUMMARY_BY_EQUIPMENT').aggregate(drilldownEquipmentPipeline, opts).toArray(),
    db.collection('RECOVERY_SUMMARY_BY_TRIGGER').aggregate(drilldownTriggerPipeline, opts).toArray()
  ])

  // Merge drilldown data by process
  const drilldown = {}
  for (const item of drilldownScenarios) {
    if (!drilldown[item.process]) drilldown[item.process] = {}
    drilldown[item.process].topScenarios = item.topScenarios
  }
  for (const item of drilldownEquipment) {
    if (!drilldown[item.process]) drilldown[item.process] = {}
    drilldown[item.process].topEquipment = item.topEquipment
  }
  for (const item of drilldownTriggers) {
    if (!drilldown[item.process]) drilldown[item.process] = {}
    drilldown[item.process].triggerDistribution = item.triggers
  }

  const granularity = determineTrendGranularity(period, { startDate, endDate })
  const rolledTrend = rollupTrend(normalizeDoc(trend), granularity)

  return { processes: normalizeDoc(processes), trend: rolledTrend, granularity, drilldown }
}

/**
 * GET /api/recovery/analysis
 */
async function getAnalysis(filters = {}) {
  const { period = 'today', process, line, model, tab = 'scenario', startDate, endDate } = filters
  const db = getEarsDb()

  const config = TAB_CONFIG[tab]
  if (!config) {
    throw new Error(`Unknown tab: ${tab}`)
  }

  const { collection: collName, groupField } = config
  const dimFilters = { process, line, model, startDate, endDate }
  const dailyMatch = buildMatchFilter(period, dimFilters)
  const trendMatch = buildTrendMatchFilter(period, dimFilters)

  // 1. Grouped data by the tab's groupField
  // Equipment 탭은 process/model 추가 포함 (eqpid → process/model 1:1 매핑)
  const includeProcessModel = (tab === 'equipment')

  const firstGroupId = includeProcessModel
    ? { [groupField]: `$${groupField}`, process: '$process', model: '$model', status: '$sc_array.k' }
    : { [groupField]: `$${groupField}`, status: '$sc_array.k' }

  const secondGroup = {
    _id: includeProcessModel
      ? { [groupField]: `$_id.${groupField}`, process: '$_id.process', model: '$_id.model' }
      : `$_id.${groupField}`,
    total: { $sum: '$count' },
    statuses: { $push: { k: '$_id.status', v: '$count' } }
  }

  const projectStage = includeProcessModel
    ? { _id: 0, [groupField]: `$_id.${groupField}`, process: '$_id.process', model: '$_id.model', total: 1, status_counts: 1 }
    : { _id: 0, [groupField]: '$_id', total: 1, status_counts: 1 }

  const dataPipeline = [
    { $match: dailyMatch },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    { $group: { _id: firstGroupId, count: { $sum: '$sc_array.v' } } },
    { $group: secondGroup },
    { $addFields: { status_counts: { $arrayToObject: '$statuses' } } },
    { $sort: { total: -1 } },
    { $project: projectStage }
  ]
  const aggOpts = { allowDiskUse: true, maxTimeMS: 55000 }
  const rawData = await db.collection(collName).aggregate(dataPipeline, aggOpts).toArray()

  // Normalize: rename groupField → name, status_counts → statusCounts
  const data = rawData.map(doc => {
    const normalized = { ...doc }
    if (normalized[groupField] !== undefined && groupField !== 'name') {
      normalized.name = normalized[groupField]
    }
    if (normalized.status_counts !== undefined) {
      normalized.statusCounts = normalized.status_counts
      delete normalized.status_counts
    }
    return normalized
  })

  // 2. Hourly trend for the tab's groupField
  const trendPipeline = [
    { $match: trendMatch },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    {
      $group: {
        _id: { bucket: '$bucket', [groupField]: `$${groupField}`, status: '$sc_array.k' },
        count: { $sum: '$sc_array.v' }
      }
    },
    {
      $group: {
        _id: { bucket: '$_id.bucket', [groupField]: `$_id.${groupField}` },
        total: { $sum: '$count' },
        statuses: { $push: { k: '$_id.status', v: '$count' } }
      }
    },
    { $addFields: { status_counts: { $arrayToObject: '$statuses' } } },
    { $sort: { '_id.bucket': 1 } },
    {
      $project: {
        _id: 0,
        bucket: '$_id.bucket',
        [groupField]: `$_id.${groupField}`,
        total: 1,
        status_counts: 1
      }
    },
    // 산정 근거: 장비 200대 × 2년(730일) × 안전 마진 2배 ≈ 292,000 → 300,000
    { $limit: 300000 }
  ]
  const trend = await db.collection(collName).aggregate(trendPipeline, aggOpts).toArray()

  const granularity = determineTrendGranularity(period, { startDate, endDate })
  const rolledTrend = rollupTrend(normalizeDoc(trend), granularity)

  return { data, trend: rolledTrend, granularity }
}

/**
 * GET /api/recovery/history
 * Queries EQP_AUTO_RECOVERY directly (original collection).
 */
async function getHistory(filters = {}) {
  const { eqpid, ears_code, status, startDate, endDate, skip = 0, limit = 25 } = filters
  const db = getEarsDb()

  if (!eqpid && !ears_code) {
    throw new Error('Either eqpid or ears_code is required')
  }

  const query = {}
  if (eqpid) query.eqpid = eqpid
  if (ears_code) query.ears_code = ears_code
  if (status) query.status = status
  if (startDate && endDate) {
    query.create_date = { $gte: startDate, $lt: endDate }
  }

  const data = await db.collection('EQP_AUTO_RECOVERY')
    .find(query)
    .sort({ create_date: -1 })
    .skip(skip)
    .limit(limit)
    .toArray()

  const total = await db.collection('EQP_AUTO_RECOVERY')
    .countDocuments(query)

  return { data, total }
}

module.exports = {
  getOverview,
  getByProcess,
  getAnalysis,
  getHistory,
  _setDeps
}
