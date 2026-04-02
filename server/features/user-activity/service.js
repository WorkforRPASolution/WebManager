/**
 * User Activity Service
 * MongoDB aggregation pipelines for ScenarioEditor tool usage statistics.
 *
 * Period filter logic:
 * - period=all: "SE 사용자" = accessnum > 0 (ever used)
 * - period=7d etc: "SE 사용자" = latestExecution >= periodStart (used within period)
 * - End is always "now" — not configurable.
 * - "전체 사용자" is always period-independent (all users).
 *
 * Process field handling:
 * - `processes` (Array): WebManager가 동기화한 배열. 있으면 우선 사용.
 * - `process` (String): Akka 원본. 세미콜론 구분 (e.g., "CVD;ETCH").
 * - processes가 비어있거나 없으면 process를 split(';')하여 사용.
 */

const { earsConnection } = require('../../shared/db/connection')
const { getRedisClient } = require('../../shared/db/redisConnection')
const { getWithCache, buildCacheKey } = require('../../shared/utils/apiCache')
const { formatKST } = require('../recovery/dateUtils')

// ── Dependency Injection (for testing) ──

let deps = {}
function _setDeps(overrides) {
  deps = { ...deps, ...overrides }
}

function getEarsDb() {
  return deps.earsDb || earsConnection.db
}

function getRedis() {
  return deps.redisClient !== undefined ? deps.redisClient : getRedisClient()
}

// ── Period helpers ──

const PERIOD_LABELS = {
  all: '전체',
  today: '최근 24시간',
  '7d': '최근 7일',
  '30d': '최근 30일',
  '1y': '최근 1년',
  custom: '커스텀'
}

const PERIOD_DAYS = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '1y': 365
}

function computePeriodStart(period, startDate) {
  if (period === 'custom' && startDate) {
    const d = new Date(startDate + 'T00:00:00+09:00')
    return formatKST(d)
  }
  const days = PERIOD_DAYS[period]
  if (!days) return null
  const now = new Date()
  const startUtc = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return formatKST(startUtc)
}

/**
 * $addFields stage: processes 배열이 비어있거나 없으면 process 문자열을 split하여 생성.
 * 모든 파이프라인의 첫 번째 단계로 사용.
 */
const NORMALIZE_PROCESSES_STAGE = {
  $addFields: {
    _procs: {
      $cond: {
        if: { $and: [{ $isArray: '$processes' }, { $gt: [{ $size: '$processes' }, 0] }] },
        then: '$processes',
        else: {
          $cond: {
            if: { $and: [{ $ne: ['$process', null] }, { $ne: ['$process', ''] }] },
            then: { $split: ['$process', ';'] },
            else: []
          }
        }
      }
    }
  }
}

function buildActiveCondition(periodStart) {
  if (!periodStart) {
    return { $gt: ['$accessnum', 0] }
  }
  return {
    $and: [
      { $gt: ['$accessnum', 0] },
      { $ne: ['$latestExecution', ''] },
      { $ne: ['$latestExecution', null] },
      { $gte: ['$latestExecution', periodStart] }
    ]
  }
}

// ── Main API ──

async function getToolUsage(params = {}) {
  const redis = getRedis()
  const cacheKey = buildCacheKey('user-activity:tool-usage', {
    period: params.period, process: params.process, startDate: params.startDate,
    includeAdmin: params.includeAdmin, noLimit: params.noLimit
  })
  return getWithCache(redis, cacheKey, () => _getToolUsageCore(params), 60)
}

async function _getToolUsageCore({ period = 'all', process, startDate, includeAdmin = false, noLimit = false }) {
  const db = getEarsDb()
  const coll = db.collection('ARS_USER_INFO')

  const baseMatch = {}
  if (!includeAdmin) {
    baseMatch.authorityManager = { $ne: 1 }
  }
  // processFilter: 선택된 공정 목록 (unwind 후 필터용)
  let processFilter = null
  if (process) {
    const processList = process.split(',').map(p => p.trim()).filter(Boolean)
    processFilter = processList
    // _procs는 NORMALIZE_PROCESSES_STAGE에서 생성된 배열 필드
    if (processList.length === 1) {
      baseMatch._procs = processList[0]
    } else if (processList.length > 1) {
      baseMatch._procs = { $in: processList }
    }
  }

  const periodStart = computePeriodStart(period, startDate)

  const [kpiResult, topUsersResult, recentUsersResult, processSummaryResult] = await Promise.all([
    coll.aggregate(buildKpiPipeline(baseMatch, periodStart)).toArray(),
    coll.aggregate(buildTopUsersPipeline(baseMatch, periodStart)).toArray(),
    coll.aggregate(buildRecentUsersPipeline(baseMatch, periodStart, noLimit)).toArray(),
    coll.aggregate(buildProcessSummaryPipeline(baseMatch, periodStart, processFilter)).toArray()
  ])

  const kpi = kpiResult[0] || { totalUsers: 0, activeUsers: 0, totalAccessNum: 0 }
  const totalUsers = kpi.totalUsers || 0
  const activeUsers = kpi.activeUsers || 0
  const usageRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 1000) / 10 : 0

  const mapUser = u => ({
    singleid: u.singleid,
    name: u.name,
    accessnum: u.accessnum,
    process: (u._procs || []).join(', '),
    latestExecution: u.latestExecution
  })

  return {
    kpi: {
      totalUsers,
      activeUsers,
      usageRate,
      periodLabel: PERIOD_LABELS[period] || '전체'
    },
    topUsers: topUsersResult.map(mapUser),
    recentUsers: recentUsersResult.map(mapUser),
    processSummary: processSummaryResult.map(p => ({
      process: p._id,
      totalUsers: p.totalUsers,
      activeUsers: p.activeUsers,
      usageRate: p.totalUsers > 0 ? Math.round((p.activeUsers / p.totalUsers) * 1000) / 10 : 0
    }))
  }
}

// ── Pipeline builders ──

function buildKpiPipeline(baseMatch, periodStart) {
  const activeCondition = buildActiveCondition(periodStart)
  return [
    NORMALIZE_PROCESSES_STAGE,
    { $match: { ...baseMatch } },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: [activeCondition, 1, 0] } },
        totalAccessNum: { $sum: '$accessnum' }
      }
    },
    { $project: { _id: 0 } }
  ]
}

function buildTopUsersPipeline(baseMatch, periodStart) {
  const match = { ...baseMatch, accessnum: { $gt: 0 } }
  if (periodStart) {
    match.latestExecution = { $gte: periodStart, $nin: ['', null] }
  }
  return [
    NORMALIZE_PROCESSES_STAGE,
    { $match: match },
    { $sort: { accessnum: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, singleid: 1, name: 1, accessnum: 1, _procs: 1, latestExecution: 1 } }
  ]
}

function buildRecentUsersPipeline(baseMatch, periodStart, noLimit = false) {
  const match = { ...baseMatch, accessnum: { $gt: 0 } }
  if (periodStart) {
    match.latestExecution = { $gte: periodStart, $nin: ['', null] }
  }

  if (periodStart) {
    const pipeline = [
      NORMALIZE_PROCESSES_STAGE,
      { $match: match },
      { $sort: { latestExecution: -1 } }
    ]
    if (!noLimit) pipeline.push({ $limit: 30 })
    pipeline.push({ $project: { _id: 0, singleid: 1, name: 1, accessnum: 1, _procs: 1, latestExecution: 1 } })
    return pipeline
  }

  const pipeline = [
    NORMALIZE_PROCESSES_STAGE,
    { $match: match },
    {
      $addFields: {
        _hasExecution: { $and: [{ $ne: ['$latestExecution', ''] }, { $ne: ['$latestExecution', null] }] }
      }
    },
    { $sort: { _hasExecution: -1, latestExecution: -1 } }
  ]
  if (!noLimit) pipeline.push({ $limit: 30 })
  pipeline.push({ $project: { _id: 0, singleid: 1, name: 1, accessnum: 1, _procs: 1, latestExecution: 1 } })
  return pipeline
}

function buildProcessSummaryPipeline(baseMatch, periodStart, processFilter) {
  const activeCondition = buildActiveCondition(periodStart)
  const pipeline = [
    NORMALIZE_PROCESSES_STAGE,
    { $match: { ...baseMatch } },
    { $unwind: '$_procs' }
  ]
  // unwind 후 선택 공정만 남기기 (다중 공정 사용자의 비선택 공정 제거)
  if (processFilter) {
    pipeline.push({
      $match: { _procs: processFilter.length === 1 ? processFilter[0] : { $in: processFilter } }
    })
  }
  pipeline.push(
    {
      $group: {
        _id: '$_procs',
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: [activeCondition, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  )
  return pipeline
}

module.exports = {
  getToolUsage,
  _setDeps
}
