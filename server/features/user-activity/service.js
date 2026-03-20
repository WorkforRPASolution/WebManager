/**
 * User Activity Service
 * MongoDB aggregation pipelines for ScenarioEditor tool usage statistics.
 *
 * Period filter logic:
 * - period=all: "SE 사용자" = accessnum > 0 (ever used)
 * - period=7d etc: "SE 사용자" = lastExecution >= periodStart (used within period)
 * - End is always "now" — not configurable.
 * - "전체 사용자" is always period-independent (all active accounts).
 */

const { earsConnection } = require('../../shared/db/connection')
const { formatKST } = require('../recovery/dateUtils')

// ── Dependency Injection (for testing) ──

let deps = {}
function _setDeps(overrides) {
  deps = { ...deps, ...overrides }
}

function getEarsDb() {
  return deps.earsDb || earsConnection.db
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

/**
 * Compute KST date string for period start.
 * End is always "now" — not configurable.
 */
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
 * Build period-aware "active user" condition.
 * - period=all: accessnum > 0
 * - period with date: accessnum > 0 AND lastExecution >= periodStart
 */
function buildActiveCondition(periodStart) {
  if (!periodStart) {
    return { $gt: ['$accessnum', 0] }
  }
  return {
    $and: [
      { $gt: ['$accessnum', 0] },
      { $ne: ['$lastExecution', ''] },
      { $ne: ['$lastExecution', null] },
      { $gte: ['$lastExecution', periodStart] }
    ]
  }
}

// ── Main API ──

async function getToolUsage({ period = 'all', process, startDate }) {
  const db = getEarsDb()
  const coll = db.collection('ARS_USER_INFO')

  const baseMatch = { accountStatus: 'active' }
  if (process) {
    const processList = process.split(',').map(p => p.trim()).filter(Boolean)
    if (processList.length === 1) {
      baseMatch.processes = processList[0]
    } else if (processList.length > 1) {
      baseMatch.processes = { $in: processList }
    }
  }

  const periodStart = computePeriodStart(period, startDate)

  const [kpiResult, topUsersResult, recentUsersResult, processSummaryResult] = await Promise.all([
    coll.aggregate(buildKpiPipeline(baseMatch, periodStart)).toArray(),
    coll.aggregate(buildTopUsersPipeline(baseMatch, periodStart)).toArray(),
    coll.aggregate(buildRecentUsersPipeline(baseMatch, periodStart)).toArray(),
    coll.aggregate(buildProcessSummaryPipeline(baseMatch, periodStart)).toArray()
  ])

  const kpi = kpiResult[0] || { totalUsers: 0, activeUsers: 0, totalAccessNum: 0 }
  const totalUsers = kpi.totalUsers || 0
  const activeUsers = kpi.activeUsers || 0
  const usageRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 1000) / 10 : 0

  const mapUser = u => ({
    singleid: u.singleid,
    name: u.name,
    accessnum: u.accessnum,
    process: (u.processes || []).join(', '),
    lastExecution: u.lastExecution
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
    match.lastExecution = { $gte: periodStart, $nin: ['', null] }
  }
  return [
    { $match: match },
    { $sort: { accessnum: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, singleid: 1, name: 1, accessnum: 1, processes: 1, lastExecution: 1 } }
  ]
}

function buildRecentUsersPipeline(baseMatch, periodStart) {
  const match = { ...baseMatch, accessnum: { $gt: 0 } }
  if (periodStart) {
    match.lastExecution = { $gte: periodStart, $nin: ['', null] }
  }

  if (periodStart) {
    // All results have valid lastExecution, simple sort
    return [
      { $match: match },
      { $sort: { lastExecution: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, singleid: 1, name: 1, accessnum: 1, processes: 1, lastExecution: 1 } }
    ]
  }

  // period=all: show users with valid lastExecution first
  return [
    { $match: match },
    {
      $addFields: {
        _hasExecution: { $and: [{ $ne: ['$lastExecution', ''] }, { $ne: ['$lastExecution', null] }] }
      }
    },
    { $sort: { _hasExecution: -1, lastExecution: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, singleid: 1, name: 1, accessnum: 1, processes: 1, lastExecution: 1 } }
  ]
}

function buildProcessSummaryPipeline(baseMatch, periodStart) {
  const activeCondition = buildActiveCondition(periodStart)
  return [
    { $match: { ...baseMatch } },
    { $unwind: '$processes' },
    {
      $group: {
        _id: '$processes',
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: [activeCondition, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]
}

module.exports = {
  getToolUsage,
  _setDeps
}
