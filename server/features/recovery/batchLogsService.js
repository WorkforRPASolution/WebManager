/**
 * Batch Logs Service — query building for batch log API.
 */

const { KST_OFFSET_MS } = require('./dateUtils')
const { WebManagerLog } = require('../../shared/models/webmanagerLogModel')

let deps = {}

function _setDeps(overrides) { deps = { ...deps, ...overrides } }

function getWebManagerLog() {
  return deps.WebManagerLog || WebManagerLog
}

function buildBatchLogsQuery(query) {
  const filter = { category: 'batch' }
  if (query.batchAction) filter.batchAction = query.batchAction
  if (query.startDate || query.endDate) {
    filter.timestamp = {}
    if (query.startDate) {
      const start = new Date(query.startDate)
      start.setUTCHours(0, 0, 0, 0)
      filter.timestamp.$gte = new Date(start.getTime() - KST_OFFSET_MS)
    }
    if (query.endDate) {
      const end = new Date(query.endDate)
      end.setUTCHours(0, 0, 0, 0)
      filter.timestamp.$lte = new Date(end.getTime() - KST_OFFSET_MS + 24 * 60 * 60 * 1000 - 1)
    }
  } else if (query.period) {
    const now = new Date()
    let startDate
    if (query.period === 'today') {
      const kstNow = new Date(now.getTime() + KST_OFFSET_MS)
      kstNow.setUTCHours(0, 0, 0, 0)
      startDate = new Date(kstNow.getTime() - KST_OFFSET_MS)
    } else if (query.period === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (query.period === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
    if (startDate) filter.timestamp = { $gte: startDate }
  }
  return filter
}

const BACKFILL_ACTIONS = new Set([
  'backfill_started', 'backfill_completed', 'backfill_cancelled', 'auto_backfill_completed'
])

async function queryBatchLogs(queryParams, { skip, limit }) {
  const Log = getWebManagerLog()
  const filter = buildBatchLogsQuery(queryParams)
  const [data, total] = await Promise.all([
    Log.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    Log.countDocuments(filter)
  ])
  return { data, total }
}

async function queryBatchHeatmap(days) {
  const Log = getWebManagerLog()
  const clampedDays = Math.min(90, Math.max(1, days))
  const since = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000)
  const pipeline = [
    { $match: { category: 'batch', timestamp: { $gte: since } } },
    { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: '+09:00' } }, action: '$batchAction' }, count: { $sum: 1 } } },
    { $group: { _id: '$_id.date', total: { $sum: '$count' }, actions: { $push: { k: '$_id.action', v: '$count' } } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', total: 1, actions: { $arrayToObject: '$actions' } } }
  ]
  const raw = await Log.collection.aggregate(pipeline).toArray()
  return raw.map(row => ({
    date: row.date,
    total: row.total,
    cron: row.actions.cron_completed || 0,
    skip: row.actions.cron_skipped || 0,
    backfill: Object.entries(row.actions).filter(([k]) => BACKFILL_ACTIONS.has(k)).reduce((sum, [, v]) => sum + v, 0)
  }))
}

module.exports = {
  buildBatchLogsQuery,
  BACKFILL_ACTIONS,
  queryBatchLogs,
  queryBatchHeatmap,
  _setDeps
}
