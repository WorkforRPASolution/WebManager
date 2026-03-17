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
function buildMatchFilter(period, { process, line, model } = {}) {
  const parsed = parsePeriod(period)
  const match = { period: 'daily' }

  if (parsed) {
    match.bucket = { $gte: new Date(parsed.startDate), $lte: new Date(parsed.endDate) }
  }

  if (process) match.process = process
  if (line) match.line = line
  if (model) match.model = model

  return match
}

/**
 * Build hourly match filter for trend data.
 */
function buildHourlyMatchFilter(period, { process, line, model } = {}) {
  const parsed = parsePeriod(period)
  const match = { period: 'hourly' }

  if (parsed) {
    match.bucket = { $gte: new Date(parsed.startDate), $lte: new Date(parsed.endDate) }
  }

  if (process) match.process = process
  if (line) match.line = line
  if (model) match.model = model

  return match
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
  const { period = 'today', process, line } = filters
  const db = getEarsDb()

  const dailyMatch = buildMatchFilter(period, { process, line })
  const hourlyMatch = buildHourlyMatchFilter(period, { process, line })

  // 1. KPI from scenario daily
  const kpiPipeline = buildSimpleKpiPipeline(dailyMatch)
  const kpiResult = await db.collection('RECOVERY_SUMMARY_BY_SCENARIO')
    .aggregate(kpiPipeline).toArray()
  const kpi = extractKpi(kpiResult)

  // 2. Previous period KPI for comparison
  const parsed = parsePeriod(period)
  let prevKpi = { total: 0, success: 0, successRate: 0 }
  if (parsed) {
    const start = new Date(parsed.startDate)
    const end = new Date(parsed.endDate)
    const durationMs = end.getTime() - start.getTime()
    const prevEnd = new Date(start.getTime())
    const prevStart = new Date(start.getTime() - durationMs)
    const prevMatch = { period: 'daily', bucket: { $gte: prevStart, $lt: prevEnd } }
    if (process) prevMatch.process = process
    if (line) prevMatch.line = line

    const prevResult = await db.collection('RECOVERY_SUMMARY_BY_SCENARIO')
      .aggregate(buildSimpleKpiPipeline(prevMatch)).toArray()
    const prev = extractKpi(prevResult)
    prevKpi = { total: prev.total, success: prev.success, successRate: prev.successRate }
  }
  kpi.prevTotal = prevKpi.total
  kpi.prevSuccess = prevKpi.success
  kpi.prevSuccessRate = prevKpi.successRate

  // 3. Hourly trend from scenario
  const trendPipeline = [
    { $match: hourlyMatch },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    {
      $group: {
        _id: { bucket: '$bucket', status: '$sc_array.k' },
        count: { $sum: '$sc_array.v' }
      }
    },
    {
      $group: {
        _id: '$_id.bucket',
        total: { $sum: '$count' },
        statuses: { $push: { k: '$_id.status', v: '$count' } }
      }
    },
    { $addFields: { status_counts: { $arrayToObject: '$statuses' } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, bucket: '$_id', total: 1, status_counts: 1 } }
  ]
  const trend = await db.collection('RECOVERY_SUMMARY_BY_SCENARIO')
    .aggregate(trendPipeline).toArray()

  // 4. Status distribution (from KPI — already computed)
  const statusDistribution = {
    Success: kpi.success,
    Failed: kpi.failed,
    Stopped: kpi.stopped,
    Skip: kpi.skip
  }

  // 5. Top 10 failed scenarios
  const topScenariosPipeline = [
    { $match: dailyMatch },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    { $match: { 'sc_array.k': { $in: FAILED_STATUSES } } },
    {
      $group: {
        _id: '$ears_code',
        failedCount: { $sum: '$sc_array.v' }
      }
    },
    { $sort: { failedCount: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, name: '$_id', count: '$failedCount' } }
  ]
  const topScenarios = await db.collection('RECOVERY_SUMMARY_BY_SCENARIO')
    .aggregate(topScenariosPipeline).toArray()

  // 6. Top 10 failed equipment
  const topEquipmentPipeline = [
    { $match: buildMatchFilter(period, { process, line }) },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    { $match: { 'sc_array.k': { $in: FAILED_STATUSES } } },
    {
      $group: {
        _id: '$eqpid',
        failedCount: { $sum: '$sc_array.v' }
      }
    },
    { $sort: { failedCount: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, name: '$_id', count: '$failedCount' } }
  ]
  const topEquipment = await db.collection('RECOVERY_SUMMARY_BY_EQUIPMENT')
    .aggregate(topEquipmentPipeline).toArray()

  // 7. Trigger distribution
  const triggerPipeline = [
    { $match: buildMatchFilter(period, { process, line }) },
    {
      $group: {
        _id: '$trigger_by',
        total: { $sum: '$total' }
      }
    },
    { $sort: { total: -1 } },
    { $project: { _id: 0, trigger_by: '$_id', total: 1 } }
  ]
  const triggerDistribution = await db.collection('RECOVERY_SUMMARY_BY_TRIGGER')
    .aggregate(triggerPipeline).toArray()

  return { kpi, trend: normalizeDoc(trend), statusDistribution, topScenarios, topEquipment, triggerDistribution }
}

/**
 * GET /api/recovery/by-process
 */
async function getByProcess(filters = {}) {
  const { period = 'today', line } = filters
  const db = getEarsDb()

  const dailyMatch = buildMatchFilter(period, { line })
  const hourlyMatch = buildHourlyMatchFilter(period, { line })

  // 1. Process-level aggregation from scenario summary
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
  const processes = await db.collection('RECOVERY_SUMMARY_BY_SCENARIO')
    .aggregate(processPipeline).toArray()

  // 2. Hourly trend per process (success rate timeline)
  const trendPipeline = [
    { $match: hourlyMatch },
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
  const trend = await db.collection('RECOVERY_SUMMARY_BY_SCENARIO')
    .aggregate(trendPipeline).toArray()

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
  const drilldownScenarios = await db.collection('RECOVERY_SUMMARY_BY_SCENARIO')
    .aggregate(drilldownScenarioPipeline).toArray()

  const equipDailyMatch = buildMatchFilter(period, { line })
  const drilldownEquipmentPipeline = [
    { $match: equipDailyMatch },
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
  const drilldownEquipment = await db.collection('RECOVERY_SUMMARY_BY_EQUIPMENT')
    .aggregate(drilldownEquipmentPipeline).toArray()

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

  return { processes: normalizeDoc(processes), trend: normalizeDoc(trend), drilldown }
}

/**
 * GET /api/recovery/analysis
 */
async function getAnalysis(filters = {}) {
  const { period = 'today', process, line, model, tab = 'scenario' } = filters
  const db = getEarsDb()

  const config = TAB_CONFIG[tab]
  if (!config) {
    throw new Error(`Unknown tab: ${tab}`)
  }

  const { collection: collName, groupField } = config
  const dailyMatch = buildMatchFilter(period, { process, line, model })
  const hourlyMatch = buildHourlyMatchFilter(period, { process, line, model })

  // 1. Grouped data by the tab's groupField
  const dataPipeline = [
    { $match: dailyMatch },
    { $addFields: { sc_array: { $objectToArray: '$status_counts' } } },
    { $unwind: '$sc_array' },
    {
      $group: {
        _id: { [groupField]: `$${groupField}`, status: '$sc_array.k' },
        count: { $sum: '$sc_array.v' }
      }
    },
    {
      $group: {
        _id: `$_id.${groupField}`,
        total: { $sum: '$count' },
        statuses: { $push: { k: '$_id.status', v: '$count' } }
      }
    },
    { $addFields: { status_counts: { $arrayToObject: '$statuses' } } },
    { $sort: { total: -1 } },
    { $project: { _id: 0, [groupField]: '$_id', total: 1, status_counts: 1 } }
  ]
  const rawData = await db.collection(collName).aggregate(dataPipeline).toArray()

  // Normalize: rename groupField → name, status_counts → statusCounts
  const data = rawData.map(doc => {
    const normalized = { ...doc }
    // Add 'name' alias from the group field
    if (normalized[groupField] !== undefined && groupField !== 'name') {
      normalized.name = normalized[groupField]
    }
    // Rename status_counts → statusCounts
    if (normalized.status_counts !== undefined) {
      normalized.statusCounts = normalized.status_counts
      delete normalized.status_counts
    }
    return normalized
  })

  // 2. Hourly trend for the tab's groupField
  const trendPipeline = [
    { $match: hourlyMatch },
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
    }
  ]
  const trend = await db.collection(collName).aggregate(trendPipeline).toArray()

  return { data, trend: normalizeDoc(trend) }
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
