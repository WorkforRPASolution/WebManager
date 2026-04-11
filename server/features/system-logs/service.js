const { WebManagerLog } = require('../../shared/models/webmanagerLogModel')
const { createPaginatedResponse } = require('../../shared/utils/pagination')

// Dependency injection for testing
let deps = {}
function _setDeps(d) { deps = d }
function getModel() { return deps.WebManagerLog || WebManagerLog }

// H3: Filter options cache (60s TTL) with promise locking to prevent concurrent duplicate queries
let filterCache = { data: null, expireAt: 0, promise: null }
function _resetFilterCache() { filterCache = { data: null, expireAt: 0, promise: null } }
const CACHE_TTL = 60000

/**
 * H2: Escape regex special characters to prevent ReDoS
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build query filter from params
 * H1: Uses $and to combine action + search filters (fixes $or collision)
 * H2: Escapes regex special characters in search
 */
function buildFilter({ category, userId, action, pagePath, startDate, endDate, search }) {
  const filter = {}

  if (category) filter.category = category
  if (userId) {
    filter.userId = Array.isArray(userId) ? { $in: userId } : userId
  }
  if (pagePath) filter.pagePath = pagePath

  if (startDate || endDate) {
    filter.timestamp = {}
    if (startDate) filter.timestamp.$gte = new Date(startDate)
    if (endDate) filter.timestamp.$lte = new Date(endDate)
  }

  const conditions = []

  if (action) {
    const actionMatch = Array.isArray(action) ? { $in: action } : action
    conditions.push({ $or: [
      { action: actionMatch },
      { authAction: actionMatch },
      { batchAction: actionMatch }
    ]})
  }

  if (search) {
    const escaped = escapeRegex(search)
    const regex = { $regex: escaped, $options: 'i' }
    conditions.push({ $or: [
      { errorMessage: regex },
      { userId: regex },
      { collectionName: regex },
      { errorType: regex },
      { authAction: regex },
      { batchAction: regex },
      { action: regex },
      { documentId: regex },
      { pagePath: regex },
      { pageName: regex },
      { syncEqpId: regex },
      { syncError: regex },
      { syncOperation: regex }
    ]})
  }

  if (conditions.length > 0) {
    filter.$and = (filter.$and || []).concat(conditions)
  }

  return filter
}

/**
 * Query logs with filtering and pagination
 */
async function queryLogs({ category, userId, action, pagePath, startDate, endDate, search, page = 1, pageSize = 50 }) {
  const Model = getModel()
  const filter = buildFilter({ category, userId, action, pagePath, startDate, endDate, search })

  const parsedPage = Math.max(1, parseInt(page, 10) || 1)
  const parsedPageSize = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 25))
  const skip = (parsedPage - 1) * parsedPageSize

  const [data, total] = await Promise.all([
    Model.find(filter).sort({ timestamp: -1 }).skip(skip).limit(parsedPageSize).lean(),
    Model.countDocuments(filter)
  ])

  return createPaginatedResponse(data, total, parsedPage, parsedPageSize)
}

/**
 * Get a single log by ID
 */
async function getLogById(id) {
  const Model = getModel()
  return Model.findById(id).lean()
}

/**
 * Compute period date range
 */
function computeDateRange(period, { startDate, endDate } = {}) {
  const now = new Date()

  if (period === 'custom' && startDate && endDate) {
    return { $gte: new Date(startDate), $lte: new Date(endDate) }
  }

  const daysMap = { today: 0, '7d': 7, '30d': 30, '90d': 90 }
  const days = daysMap[period] ?? 0

  const start = new Date(now)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)

  return { $gte: start, $lte: now }
}

/**
 * M4: Determine granularity based on period
 * weekly added for 90d and custom >30d
 */
function getGranularity(period, { startDate, endDate } = {}) {
  if (period === 'today') return 'hourly'
  if (period === '90d') return 'weekly'

  if (period === 'custom' && startDate && endDate) {
    const diffMs = new Date(endDate) - new Date(startDate)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffDays <= 1) return 'hourly'
    if (diffDays > 30) return 'weekly'
    return 'daily'
  }

  return 'daily'
}

/**
 * Generic weekly rollup: groups daily entries into Monday-based weeks, summing counts.
 * @param {Array} dailyData - daily aggregation results with _id.date and _id[groupField]
 * @param {string} groupField - the _id sub-field to group by (e.g. 'category', 'authAction')
 */
function rollupWeekly(dailyData, groupField) {
  const buckets = {}
  for (const item of dailyData) {
    const id = item._id || {}
    const d = new Date(id.date + 'T00:00:00+09:00')
    const day = d.getUTCDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(d)
    monday.setUTCDate(monday.getUTCDate() + mondayOffset)
    const weekKey = monday.toISOString().slice(0, 10)

    const groupVal = id[groupField]
    const key = `${weekKey}|${groupVal}`
    if (!buckets[key]) buckets[key] = { _id: { date: weekKey, [groupField]: groupVal }, count: 0 }
    buckets[key].count += item.count
  }

  return Object.values(buckets).sort((a, b) => {
    const dc = a._id.date.localeCompare(b._id.date)
    return dc !== 0 ? dc : (a._id[groupField] || '').localeCompare(b._id[groupField] || '')
  })
}

/**
 * Get statistics: KPI counts, trend, top errors, security trend, auth/batch breakdown, top users, recent audits
 * M4: Granularity auto-switch (hourly for today, daily for 7d/30d, weekly for 90d)
 * M5: allowDiskUse(true) on all 8 aggregations
 * M3/L5: Includes access category in KPI
 */
async function getStatistics({ period = 'today', startDate, endDate }) {
  const Model = getModel()
  const dateRange = computeDateRange(period, { startDate, endDate })
  const matchStage = { $match: { timestamp: dateRange } }
  const granularity = getGranularity(period, { startDate, endDate })

  // For weekly granularity, use daily grouping in MongoDB then rollup in JS
  const useHourly = granularity === 'hourly'

  // M4: Build trend group stage based on granularity
  const trendGroupId = useHourly
    ? {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        hour: { $hour: '$timestamp' },
        category: '$category'
      }
    : {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        category: '$category'
      }

  const trendSort = useHourly
    ? { '_id.date': 1, '_id.hour': 1 }
    : { '_id.date': 1 }

  // Security trend group (login_failed + permission_denied, dual series)
  const securityGroupId = useHourly
    ? {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        hour: { $hour: '$timestamp' },
        authAction: '$authAction'
      }
    : {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        authAction: '$authAction'
      }

  const [kpiRaw, trendRaw, topErrors, securityTrendRaw, authBreakdown, batchBreakdown, topUsers, recentAudits] = await Promise.all([
    // 1. Category KPI
    Model.aggregate([
      matchStage,
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]).allowDiskUse(true).maxTimeMS(30000),

    // 2. Trend by category (granularity-aware)
    Model.aggregate([
      matchStage,
      { $group: { _id: trendGroupId, count: { $sum: 1 } } },
      { $sort: trendSort }
    ]).allowDiskUse(true).maxTimeMS(30000),

    // 3. Top N errors by errorType
    Model.aggregate([
      { $match: { ...matchStage.$match, category: 'error' } },
      {
        $group: {
          _id: '$errorType',
          count: { $sum: 1 },
          lastOccurrence: { $max: '$timestamp' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).allowDiskUse(true).maxTimeMS(30000),

    // 4. Security trend (login_failed + permission_denied)
    Model.aggregate([
      { $match: { ...matchStage.$match, category: 'auth', authAction: { $in: ['login_failed', 'permission_denied'] } } },
      { $group: { _id: securityGroupId, count: { $sum: 1 } } },
      { $sort: trendSort }
    ]).allowDiskUse(true).maxTimeMS(30000),

    // 5. Auth breakdown by authAction
    Model.aggregate([
      { $match: { ...matchStage.$match, category: 'auth' } },
      { $group: { _id: '$authAction', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).allowDiskUse(true).maxTimeMS(30000),

    // 6. Batch breakdown by batchAction
    Model.aggregate([
      { $match: { ...matchStage.$match, category: 'batch' } },
      { $group: { _id: '$batchAction', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).allowDiskUse(true).maxTimeMS(30000),

    // 7. Top users (exclude access category)
    Model.aggregate([
      { $match: { ...matchStage.$match, category: { $ne: 'access' } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).allowDiskUse(true).maxTimeMS(30000),

    // 8. Recent audit entries (latest 20)
    Model.aggregate([
      { $match: { ...matchStage.$match, category: 'audit' } },
      { $sort: { timestamp: -1 } },
      { $limit: 20 },
      { $project: { timestamp: 1, userId: 1, action: 1, collectionName: 1, targetType: 1, documentId: 1 } }
    ]).allowDiskUse(true).maxTimeMS(30000)
  ])

  // Weekly rollup if needed
  const trend = granularity === 'weekly' ? rollupWeekly(trendRaw, 'category') : trendRaw
  const securityTrend = granularity === 'weekly' ? rollupWeekly(securityTrendRaw, 'authAction') : securityTrendRaw

  // Transform KPI to object with derived fields
  const kpi = { audit: 0, error: 0, auth: 0, batch: 0, access: 0, 'eqp-redis': 0 }
  for (const item of kpiRaw) {
    if (item._id in kpi) kpi[item._id] = item.count
  }

  const total = kpi.audit + kpi.error + kpi.auth + kpi.batch + kpi.access + kpi['eqp-redis']
  const errorRate = total > 0 ? Math.round(kpi.error / total * 1000) / 10 : 0

  // Security events from authBreakdown
  const securityEvents = authBreakdown
    .filter(a => a._id === 'login_failed' || a._id === 'permission_denied')
    .reduce((sum, a) => sum + a.count, 0)

  // Batch success rate
  const batchTotal = batchBreakdown.reduce((sum, b) => sum + b.count, 0)
  const batchSuccess = batchBreakdown
    .filter(b => ['cron_completed', 'backfill_completed', 'auto_backfill_completed'].includes(b._id))
    .reduce((sum, b) => sum + b.count, 0)
  const batchSuccessRate = batchTotal > 0 ? Math.round(batchSuccess / batchTotal * 1000) / 10 : 0

  // Period days for auditPerDay
  const periodStart = dateRange.$gte
  const periodEnd = dateRange.$lte
  const periodDays = Math.max(1, Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)))
  const auditPerDay = Math.round(kpi.audit / periodDays * 10) / 10

  Object.assign(kpi, { total, errorRate, securityEvents, batchTotal, batchSuccess, batchSuccessRate, auditPerDay, periodDays })

  return { kpi, trend, topErrors, securityTrend, authBreakdown, batchBreakdown, topUsers, recentAudits, granularity }
}

/**
 * Get distinct filter options (userIds + actions + pagePaths)
 * Cascading: upstream filters narrow downstream options
 * Cache only for unfiltered (initial) request
 */
async function getFilterOptions({ category, userId, startDate, endDate } = {}) {
  const hasFilters = category || userId || startDate || endDate

  // For unfiltered requests: return pending promise or cached data
  if (!hasFilters) {
    if (filterCache.promise) return filterCache.promise
    if (filterCache.data && Date.now() < filterCache.expireAt) return filterCache.data
  }

  // Execute distinct queries
  const queryPromise = _executeFilterQueries({ category, userId, startDate, endDate })

  // For unfiltered requests: store promise to prevent concurrent duplicate queries
  if (!hasFilters) {
    filterCache.promise = queryPromise
    return queryPromise.then(result => {
      filterCache = { data: result, expireAt: Date.now() + CACHE_TTL, promise: null }
      return result
    }).catch(err => {
      filterCache.promise = null
      throw err
    })
  }

  return queryPromise
}

/**
 * Internal: execute 6 distinct queries for filter options
 */
async function _executeFilterQueries({ category, userId, startDate, endDate }) {
  const Model = getModel()

  // Base time filter: use provided dates or default 90 days
  const baseFilter = {}
  if (startDate || endDate) {
    baseFilter.timestamp = {}
    if (startDate) baseFilter.timestamp.$gte = new Date(startDate)
    if (endDate) baseFilter.timestamp.$lte = new Date(endDate)
  } else {
    baseFilter.timestamp = { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
  }

  // UserID options: scoped by period + category
  const userIdFilter = { ...baseFilter }
  if (category) userIdFilter.category = category

  // Action options: scoped by period + category + userId
  const actionFilter = { ...userIdFilter }
  if (userId) actionFilter.userId = userId

  // PagePath options: scoped by period + category(access) + userId
  const pagePathFilter = { ...baseFilter, category: 'access' }
  if (userId) pagePathFilter.userId = userId

  const [userIds, actions, authActions, batchActions, syncOperations, pagePaths] = await Promise.all([
    Model.distinct('userId', userIdFilter),
    Model.distinct('action', actionFilter),
    Model.distinct('authAction', actionFilter),
    Model.distinct('batchAction', actionFilter),
    Model.distinct('syncOperation', actionFilter),
    Model.distinct('pagePath', pagePathFilter)
  ])

  // Merge all action-type fields, remove nulls/empty
  const allActions = [...new Set([
    ...actions, ...authActions, ...batchActions, ...syncOperations
  ])].filter(Boolean).sort()

  return {
    userIds: userIds.filter(Boolean).sort(),
    actions: allActions,
    pagePaths: pagePaths.filter(Boolean).sort()
  }
}

module.exports = {
  queryLogs,
  getLogById,
  getStatistics,
  getFilterOptions,
  rollupWeekly,
  _setDeps,
  _resetFilterCache
}
