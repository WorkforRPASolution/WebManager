const { WebManagerLog } = require('../../shared/models/webmanagerLogModel')
const { createPaginatedResponse } = require('../../shared/utils/pagination')

// Dependency injection for testing
let deps = {}
function _setDeps(d) { deps = d }
function getModel() { return deps.WebManagerLog || WebManagerLog }

/**
 * Build query filter from params
 */
function buildFilter({ category, userId, action, startDate, endDate, search }) {
  const filter = {}

  if (category) filter.category = category
  if (userId) filter.userId = userId

  if (startDate || endDate) {
    filter.timestamp = {}
    if (startDate) filter.timestamp.$gte = new Date(startDate)
    if (endDate) filter.timestamp.$lte = new Date(endDate)
  }

  if (action) {
    filter.$or = [
      { action },
      { authAction: action },
      { batchAction: action }
    ]
  }

  if (search) {
    const regex = { $regex: search, $options: 'i' }
    filter.$or = [
      { errorMessage: regex },
      { userId: regex },
      { collectionName: regex },
      { errorType: regex }
    ]
  }

  return filter
}

/**
 * Query logs with filtering and pagination
 */
async function queryLogs({ category, userId, action, startDate, endDate, search, page = 1, pageSize = 25 }) {
  const Model = getModel()
  const filter = buildFilter({ category, userId, action, startDate, endDate, search })

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
 * Get statistics: KPI counts, hourly trend, top errors, login failures
 */
async function getStatistics({ period = 'today', startDate, endDate }) {
  const Model = getModel()
  const dateRange = computeDateRange(period, { startDate, endDate })
  const matchStage = { $match: { timestamp: dateRange } }

  const [kpiRaw, trend, topErrors, loginFailures] = await Promise.all([
    // Category KPI
    Model.aggregate([
      matchStage,
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]),

    // Hourly trend by category
    Model.aggregate([
      matchStage,
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            hour: { $hour: '$timestamp' },
            category: '$category'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1, '_id.hour': 1 } }
    ]),

    // Top N errors by errorType
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
    ]),

    // Login failure trend
    Model.aggregate([
      { $match: { ...matchStage.$match, category: 'auth', authAction: 'login_failed' } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            hour: { $hour: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1, '_id.hour': 1 } }
    ])
  ])

  // Transform KPI to object
  const kpi = { audit: 0, error: 0, auth: 0, batch: 0 }
  for (const item of kpiRaw) {
    if (item._id in kpi) kpi[item._id] = item.count
  }

  return { kpi, trend, topErrors, loginFailures }
}

module.exports = {
  queryLogs,
  getLogById,
  getStatistics,
  _setDeps
}
