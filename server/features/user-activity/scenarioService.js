/**
 * Scenario Stats Service
 * MongoDB aggregation pipelines for SC_PROPERTY scenario statistics.
 *
 * Period filter logic:
 * - Scenario KPI (pipeline 1) and Process Summary (pipeline 2) are period-independent (current state).
 * - Modification KPI (pipeline 3), Top Authors (4), Recent Modifications (5) are period-reactive.
 * - Period filters use property.Owners timestamp (format: "yyyy-MM-dd HH:mm:ss", KST).
 *
 * Performance fields (DB typo preserved):
 * - performance.EqpPerfornmanceLoss (NOT "Performance" — intentional DB field name typo)
 */

const { earsConnection } = require('../../shared/db/connection')

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
 * Compute period start in "yyyy-MM-dd HH:mm:ss" KST format
 * to match property.Owners timestamp format.
 */
function computeScenarioPeriodStart(period, startDate) {
  if (period === 'custom' && startDate) {
    return startDate + ' 00:00:00'
  }
  const days = PERIOD_DAYS[period]
  if (!days) return null // period === 'all'
  const now = new Date()
  const startUtc = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const kst = new Date(startUtc.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().replace('T', ' ').substring(0, 19)
}

// ── Main API ──

async function getScenarioStats({ period = 'all', process, startDate }) {
  const db = getEarsDb()
  const coll = db.collection('SC_PROPERTY')

  const baseMatch = {}
  if (process) {
    const processList = process.split(',').map(p => p.trim()).filter(Boolean)
    if (processList.length === 1) {
      baseMatch.process = processList[0]
    } else if (processList.length > 1) {
      baseMatch.process = { $in: processList }
    }
  }

  const periodStart = computeScenarioPeriodStart(period, startDate)

  const [scenarioKpiResult, processSummaryResult, modKpiResult, topAuthorsResult, recentResult] = await Promise.all([
    coll.aggregate(buildScenarioKpiPipeline(baseMatch), { allowDiskUse: true }).toArray(),
    coll.aggregate(buildProcessSummaryPipeline(baseMatch), { allowDiskUse: true }).toArray(),
    coll.aggregate(buildModificationKpiPipeline(baseMatch, periodStart), { allowDiskUse: true }).toArray(),
    coll.aggregate(buildTopAuthorsPipeline(baseMatch, periodStart), { allowDiskUse: true }).toArray(),
    coll.aggregate(buildRecentModificationsPipeline(baseMatch, periodStart), { allowDiskUse: true }).toArray()
  ])

  // Scenario KPI (period-independent)
  const sKpi = scenarioKpiResult[0] || { totalScenarios: 0, activeScenarios: 0, performanceFilled: 0 }

  // Modification KPI (period-reactive)
  const mKpi = modKpiResult[0] || { modifiedScenarios: [], activeAuthors: [] }
  const modifiedScenarios = Array.isArray(mKpi.modifiedScenarios) ? mKpi.modifiedScenarios.length : 0
  const activeAuthors = Array.isArray(mKpi.activeAuthors) ? mKpi.activeAuthors.length : 0

  return {
    kpi: {
      totalScenarios: sKpi.totalScenarios || 0,
      activeScenarios: sKpi.activeScenarios || 0,
      performanceFilled: sKpi.performanceFilled || 0,
      modifiedScenarios,
      activeAuthors,
      periodLabel: PERIOD_LABELS[period] || '전체'
    },
    processSummary: processSummaryResult.map(p => ({
      process: p._id,
      total: p.total,
      active: p.active,
      inactive: p.total - p.active,
      performanceFilled: p.performanceFilled,
      performanceRate: p.total > 0 ? Math.round((p.performanceFilled / p.total) * 1000) / 10 : 0
    })),
    topAuthors: topAuthorsResult.map(a => ({
      userId: a._id,
      modificationCount: a.modificationCount,
      scenarioCount: Array.isArray(a.scenarios) ? a.scenarios.length : 0
    })),
    recentModifications: recentResult.map(r => ({
      scname: r.scname,
      process: r.process,
      eqpModel: r.eqpModel,
      userId: r._ownerId,
      modifiedAt: r._ownerTimestamp
    }))
  }
}

// ── Pipeline builders ──

/**
 * Pipeline 1: Scenario KPI (period-independent)
 * Count total and active (IsEnabled) scenarios.
 */
function buildScenarioKpiPipeline(baseMatch) {
  const performanceCondition = {
    $or: [
      { $gt: ['$performance.ManWorkLoss', 0] },
      { $gt: ['$performance.EqpPerfornmanceLoss', 0] }, // DB typo preserved
      { $gt: ['$performance.EqpStopLoss', 0] },
      { $gt: ['$performance.WaferLoss', 0] },
      { $gt: ['$performance.InvestCostLoss', 0] }
    ]
  }

  return [
    { $match: { ...baseMatch } },
    {
      $group: {
        _id: null,
        totalScenarios: { $sum: 1 },
        activeScenarios: {
          $sum: { $cond: [{ $eq: ['$property.IsEnabled', true] }, 1, 0] }
        },
        performanceFilled: {
          $sum: { $cond: [performanceCondition, 1, 0] }
        }
      }
    },
    { $project: { _id: 0 } }
  ]
}

/**
 * Pipeline 2: Process Summary (period-independent)
 * Per-process total, active, and performance-filled counts.
 */
function buildProcessSummaryPipeline(baseMatch) {
  const performanceCondition = {
    $or: [
      { $gt: ['$performance.ManWorkLoss', 0] },
      { $gt: ['$performance.EqpPerfornmanceLoss', 0] }, // DB typo preserved
      { $gt: ['$performance.EqpStopLoss', 0] },
      { $gt: ['$performance.WaferLoss', 0] },
      { $gt: ['$performance.InvestCostLoss', 0] }
    ]
  }

  return [
    { $match: { ...baseMatch } },
    {
      $group: {
        _id: '$process',
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$property.IsEnabled', true] }, 1, 0] }
        },
        performanceFilled: {
          $sum: { $cond: [performanceCondition, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]
}

/**
 * Pipeline 3: Modification KPI (period-reactive)
 * $unwind Owners → $split('@') → period filter → $addToSet for dedup.
 */
function buildModificationKpiPipeline(baseMatch, periodStart) {
  const pipeline = [
    { $match: { ...baseMatch, 'property.Owners': { $exists: true, $ne: [] } } },
    { $unwind: '$property.Owners' },
    {
      $addFields: {
        _ownerParts: { $split: ['$property.Owners', '@'] },
      }
    },
    {
      $addFields: {
        _ownerId: { $arrayElemAt: ['$_ownerParts', 0] },
        _ownerTimestamp: { $arrayElemAt: ['$_ownerParts', 1] }
      }
    }
  ]

  if (periodStart) {
    pipeline.push({ $match: { _ownerTimestamp: { $gte: periodStart } } })
  }

  pipeline.push(
    {
      $group: {
        _id: null,
        modifiedScenarios: { $addToSet: '$property.ID' },
        activeAuthors: { $addToSet: '$_ownerId' }
      }
    },
    { $project: { _id: 0 } }
  )

  return pipeline
}

/**
 * Pipeline 4: Top 10 Authors (period-reactive)
 * $unwind → $split → period filter → group by author → sort → limit 10.
 */
function buildTopAuthorsPipeline(baseMatch, periodStart) {
  const pipeline = [
    { $match: { ...baseMatch, 'property.Owners': { $exists: true, $ne: [] } } },
    { $unwind: '$property.Owners' },
    {
      $addFields: {
        _ownerParts: { $split: ['$property.Owners', '@'] }
      }
    },
    {
      $addFields: {
        _ownerId: { $arrayElemAt: ['$_ownerParts', 0] },
        _ownerTimestamp: { $arrayElemAt: ['$_ownerParts', 1] }
      }
    }
  ]

  if (periodStart) {
    pipeline.push({ $match: { _ownerTimestamp: { $gte: periodStart } } })
  }

  pipeline.push(
    {
      $group: {
        _id: '$_ownerId',
        modificationCount: { $sum: 1 },
        scenarios: { $addToSet: '$scname' }
      }
    },
    { $sort: { modificationCount: -1 } },
    { $limit: 10 }
  )

  return pipeline
}

/**
 * Pipeline 5: Recent 30 Modifications (period-reactive)
 * $unwind → $split → period filter → sort by timestamp desc → limit 30.
 */
function buildRecentModificationsPipeline(baseMatch, periodStart) {
  const pipeline = [
    { $match: { ...baseMatch, 'property.Owners': { $exists: true, $ne: [] } } },
    { $unwind: '$property.Owners' },
    {
      $addFields: {
        _ownerParts: { $split: ['$property.Owners', '@'] }
      }
    },
    {
      $addFields: {
        _ownerId: { $arrayElemAt: ['$_ownerParts', 0] },
        _ownerTimestamp: { $arrayElemAt: ['$_ownerParts', 1] }
      }
    }
  ]

  if (periodStart) {
    pipeline.push({ $match: { _ownerTimestamp: { $gte: periodStart } } })
  }

  pipeline.push(
    { $sort: { _ownerTimestamp: -1 } },
    { $limit: 30 },
    { $project: { _id: 0, scname: 1, process: 1, eqpModel: 1, _ownerId: 1, _ownerTimestamp: 1 } }
  )

  return pipeline
}

module.exports = {
  getScenarioStats,
  _setDeps
}
