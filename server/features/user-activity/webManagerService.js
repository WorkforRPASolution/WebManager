/**
 * WebManager Activity Service
 * MongoDB aggregation pipelines for WEBMANAGER_LOG (category='access') statistics.
 *
 * Data source: WEBMANAGER_LOG collection (WEB_MANAGER DB)
 * - useAccessLogger composable이 수집한 페이지 접근 로그
 * - TTL: 90일 (ACCESS_RETENTION_DAYS=90)
 *
 * Admin filter strategy:
 * - ARS_USER_INFO에서 authorityManager=1 인 userId 사전 조회
 * - baseMatch.userId = { $nin: adminIds } 추가
 */

const { earsConnection, webManagerConnection } = require('../../shared/db/connection')
const { createLogger } = require('../../shared/logger')
const log = createLogger('user-activity')

// ── Dependency Injection (for testing) ──

let deps = {}
function _setDeps(overrides) {
  deps = { ...deps, ...overrides }
}

function getWebManagerDb() {
  return deps.webManagerDb || webManagerConnection.db
}

function getEarsDb() {
  return deps.earsDb || earsConnection.db
}

// ── Constants ──

const DURATION_CAP_MS = 1800000 // 30분

const PAGE_MAP = {
  '/': { name: 'Overview', group: 'Dashboard' },
  '/agent-monitor': { name: 'ARSAgent Status', group: 'Dashboard' },
  '/agent-version': { name: 'ARSAgent Version', group: 'Dashboard' },
  '/resource-agent-status': { name: 'ResourceAgent Status', group: 'Dashboard' },
  '/resource-agent-version': { name: 'ResourceAgent Version', group: 'Dashboard' },
  '/recovery-overview': { name: 'Recovery Overview', group: 'Dashboard' },
  '/recovery-by-process': { name: 'Recovery by Process', group: 'Dashboard' },
  '/recovery-analysis': { name: 'Recovery Analysis', group: 'Dashboard' },
  '/user-activity': { name: 'User Activity', group: 'Dashboard' },
  '/clients': { name: 'ARSAgent List', group: 'Clients' },
  '/clients/:id': { name: 'ARSAgent Detail', group: 'Clients' },
  '/resource-clients': { name: 'ResourceAgent List', group: 'Clients' },
  '/resource-clients/:id': { name: 'ResourceAgent Detail', group: 'Clients' },
  '/equipment-info': { name: 'Equipment Info', group: 'Master Data' },
  '/email-template': { name: 'Email Template', group: 'Master Data' },
  '/popup-template': { name: 'Popup Template', group: 'Master Data' },
  '/email-image': { name: 'Email Image', group: 'Master Data' },
  '/email-recipients': { name: 'Email Recipients', group: 'Master Data' },
  '/email-info': { name: 'Email Info', group: 'Master Data' },
  '/users': { name: 'User Management', group: 'Master Data' },
  '/permissions': { name: 'Permissions', group: 'System' },
  '/system-logs': { name: 'System Logs', group: 'System' },
  '/settings': { name: 'Settings', group: 'System' }
}

const TOTAL_PAGES = Object.keys(PAGE_MAP).length

// ── Period helpers ──

const PERIOD_LABELS = {
  all: '최근 90일',
  today: '최근 24시간',
  '7d': '최근 7일',
  '30d': '최근 30일',
  custom: '커스텀'
}

const PERIOD_DAYS = {
  today: 1,
  '7d': 7,
  '30d': 30
}

// ── Trend granularity (Recovery Overview 동일 로직) ──

const GRANULARITY_MAP = {
  today: 'hourly',
  '7d': 'daily',
  '30d': 'daily',
  all: 'weekly'
}

function determineTrendGranularity(period, startDate, endDate) {
  if (period !== 'custom') return GRANULARITY_MAP[period] || 'daily'
  if (!startDate) return 'daily'
  const s = new Date(startDate)
  const e = endDate ? new Date(endDate) : new Date()
  const diffDays = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays <= 1) return 'hourly'
  if (diffDays <= 30) return 'daily'
  return 'weekly'
}

function getTrendDateFormat(granularity) {
  if (granularity === 'hourly') return '%Y-%m-%dT%H:00'
  return '%Y-%m-%d'
}

/**
 * 일별 데이터를 주별로 롤업 (월요일 기준)
 * @param {Array} dailyData - [{ date, ...values }]
 * @param {string[]} valueKeys - 합산할 필드 목록
 */
function rollupWeekly(dailyData, valueKeys) {
  const buckets = {}
  for (const item of dailyData) {
    const d = new Date(item.date + 'T00:00:00+09:00')
    const day = d.getUTCDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(d)
    monday.setUTCDate(monday.getUTCDate() + mondayOffset)
    const weekKey = monday.toISOString().slice(0, 10)

    if (!buckets[weekKey]) buckets[weekKey] = { date: weekKey }
    for (const key of valueKeys) {
      buckets[weekKey][key] = (buckets[weekKey][key] || 0) + (item[key] || 0)
    }
  }
  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date))
}

function computePeriodRange(period, startDate, endDate) {
  if (period === 'all') {
    const now = new Date()
    return { periodStart: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), periodEnd: now }
  }
  if (period === 'custom' && startDate) {
    const start = new Date(startDate + 'T00:00:00+09:00')
    const end = endDate
      ? new Date(endDate + 'T23:59:59.999+09:00')
      : new Date()
    return { periodStart: start, periodEnd: end }
  }
  const days = PERIOD_DAYS[period] || 30
  const now = new Date()
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return { periodStart, periodEnd: now }
}

// ── Path normalization ──

const PATH_NORMALIZATION_STAGE = {
  $addFields: {
    _normalizedPath: {
      $switch: {
        branches: [
          {
            case: { $regexMatch: { input: '$pagePath', regex: /^\/clients\/[^/]+$/ } },
            then: '/clients/:id'
          },
          {
            case: { $regexMatch: { input: '$pagePath', regex: /^\/resource-clients\/[^/]+$/ } },
            then: '/resource-clients/:id'
          }
        ],
        default: '$pagePath'
      }
    }
  }
}

// ── Main API ──

async function getWebManagerStats({
  period = '30d',
  startDate,
  endDate,
  includeAdmin = false,
  noLimit = false
}) {
  const wmDb = getWebManagerDb()
  const wmColl = wmDb.collection('WEBMANAGER_LOG')

  const { periodStart, periodEnd } = computePeriodRange(period, startDate, endDate)

  const baseMatch = {
    category: 'access',
    timestamp: { $gte: periodStart, $lte: periodEnd }
  }

  // Admin 필터링: ARS_USER_INFO에서 authorityManager=1 인 userId 사전 조회
  if (!includeAdmin) {
    const earsDb = getEarsDb()
    const userColl = earsDb.collection('ARS_USER_INFO')
    const admins = await userColl.aggregate([
      { $match: { authorityManager: 1 } },
      { $project: { _id: 0, singleid: 1 } }
    ]).toArray()

    if (admins.length > 0) {
      baseMatch.userId = { $nin: admins.map(a => a.singleid) }
    }
  }

  const aggOpts = { allowDiskUse: true, maxTimeMS: 55000 }
  const granularity = determineTrendGranularity(period, startDate, endDate)
  const dateFormat = getTrendDateFormat(granularity)

  const [kpiResult, pageSummaryResult, topUsersResult, recentResult, trendResult, heatmapResult, pageTrendResult, groupTrendResult] = await Promise.all([
    wmColl.aggregate(buildKpiPipeline(baseMatch), aggOpts).toArray(),
    wmColl.aggregate(buildPageSummaryPipeline(baseMatch), aggOpts).toArray(),
    wmColl.aggregate(buildTopUsersPipeline(baseMatch), aggOpts).toArray(),
    wmColl.aggregate(buildRecentVisitsPipeline(baseMatch, noLimit), aggOpts).toArray(),
    wmColl.aggregate(buildTrendPipeline(baseMatch), aggOpts).toArray(),
    wmColl.aggregate(buildHourlyHeatmapPipeline(baseMatch), aggOpts).toArray(),
    wmColl.aggregate(buildPageTrendPipeline(baseMatch, dateFormat), aggOpts).toArray(),
    wmColl.aggregate(buildGroupTrendPipeline(baseMatch, dateFormat), aggOpts).toArray()
  ])

  // KPI
  const kpi = kpiResult[0] || { _users: [], totalVisits: 0, _cappedDurationSum: 0, _validDurationCount: 0, _visitedPaths: [] }
  const activeUsers = Array.isArray(kpi._users) ? kpi._users.length : 0
  const totalVisits = kpi.totalVisits || 0
  const visitedPages = Array.isArray(kpi._visitedPaths) ? kpi._visitedPaths.length : 0
  const avgDurationMs = kpi._validDurationCount > 0
    ? Math.round(kpi._cappedDurationSum / kpi._validDurationCount)
    : 0
  const pageReachRate = TOTAL_PAGES > 0
    ? Math.round((visitedPages / TOTAL_PAGES) * 1000) / 10
    : 0

  // Page summary + PAGE_MAP 매핑
  const pageSummary = pageSummaryResult.map(p => {
    const mapped = PAGE_MAP[p._id]
    return {
      pagePath: p._id,
      pageName: mapped ? mapped.name : p._id,
      menuGroup: mapped ? mapped.group : 'Other',
      visitCount: p.visitCount,
      uniqueUsers: Array.isArray(p._users) ? p._users.length : 0,
      totalDurationMs: p.totalDurationMs || 0,
      avgDurationMs: Math.round(p.avgDurationMs || 0)
    }
  })

  // Menu group summary (JS 그룹핑)
  const groupMap = {}
  for (const p of pageSummary) {
    if (!groupMap[p.menuGroup]) {
      groupMap[p.menuGroup] = { menuGroup: p.menuGroup, totalDurationMs: 0, visitCount: 0 }
    }
    groupMap[p.menuGroup].totalDurationMs += p.totalDurationMs
    groupMap[p.menuGroup].visitCount += p.visitCount
  }
  const menuGroupSummary = Object.values(groupMap)

  // Top users
  const topUsers = topUsersResult.map(u => ({
    userId: u._id,
    visitCount: u.visitCount,
    totalDurationMs: u.totalDurationMs || 0,
    lastVisitTime: u.lastVisitTime
  }))

  // Recent visits
  const recentVisits = recentResult.map(r => ({
    userId: r.userId,
    pagePath: r.pagePath,
    pageName: r.pageName,
    enterTime: r.enterTime,
    durationMs: r.durationMs
  }))

  // Trend
  const trend = trendResult.map(t => ({
    date: t._id,
    visits: t.visits,
    uniqueUsers: Array.isArray(t._users) ? t._users.length : 0
  }))

  // Hourly heatmap: hour(0-23) × dayOfWeek(1=Sun ~ 7=Sat)
  const hourlyHeatmap = heatmapResult.map(h => ({
    hour: h.hour,
    dayOfWeek: h.dayOfWeek,
    count: h.count
  }))

  // Page trend: date × page visits (pageName 매핑) + granularity 롤업
  const pageTrendMap = {}
  const pageNames = new Set()
  for (const r of pageTrendResult) {
    const date = r._id.date
    const path = r._id.path
    const mapped = PAGE_MAP[path]
    const pageName = mapped ? mapped.name : path
    pageNames.add(pageName)
    if (!pageTrendMap[date]) pageTrendMap[date] = { date }
    pageTrendMap[date][pageName] = (pageTrendMap[date][pageName] || 0) + r.visits
  }
  let pageTrend = Object.values(pageTrendMap).sort((a, b) => a.date.localeCompare(b.date))
  if (granularity === 'weekly') {
    pageTrend = rollupWeekly(pageTrend, [...pageNames])
  }

  // Group trend: date × menuGroup visits + granularity 롤업
  const groupTrendMap = {}
  const groupNames = new Set()
  for (const r of groupTrendResult) {
    const date = r._id.date
    const group = r._id.group
    groupNames.add(group)
    if (!groupTrendMap[date]) groupTrendMap[date] = { date }
    groupTrendMap[date][group] = r.visits
  }
  let groupTrend = Object.values(groupTrendMap).sort((a, b) => a.date.localeCompare(b.date))
  if (granularity === 'weekly') {
    groupTrend = rollupWeekly(groupTrend, [...groupNames])
  }

  return {
    kpi: {
      activeUsers,
      totalVisits,
      pageReachRate,
      visitedPages,
      totalPages: TOTAL_PAGES,
      avgDurationMs,
      periodLabel: PERIOD_LABELS[period] || '최근 30일'
    },
    pageSummary,
    menuGroupSummary,
    trend,
    hourlyHeatmap,
    pageTrend,
    groupTrend,
    granularity,
    topUsers,
    recentVisits
  }
}

// ── Pipeline builders ──

function buildKpiPipeline(baseMatch) {
  return [
    { $match: { ...baseMatch } },
    PATH_NORMALIZATION_STAGE,
    {
      $group: {
        _id: null,
        _users: { $addToSet: '$userId' },
        totalVisits: { $sum: 1 },
        _cappedDurationSum: {
          $sum: {
            $cond: [
              { $gt: ['$durationMs', 0] },
              { $min: ['$durationMs', DURATION_CAP_MS] },
              0
            ]
          }
        },
        _validDurationCount: {
          $sum: { $cond: [{ $gt: ['$durationMs', 0] }, 1, 0] }
        },
        _visitedPaths: { $addToSet: '$_normalizedPath' }
      }
    },
    { $project: { _id: 0 } }
  ]
}

function buildPageSummaryPipeline(baseMatch) {
  return [
    { $match: { ...baseMatch } },
    PATH_NORMALIZATION_STAGE,
    {
      $group: {
        _id: '$_normalizedPath',
        visitCount: { $sum: 1 },
        _users: { $addToSet: '$userId' },
        totalDurationMs: { $sum: '$durationMs' },
        avgDurationMs: {
          $avg: {
            $cond: [
              { $gt: ['$durationMs', 0] },
              { $min: ['$durationMs', DURATION_CAP_MS] },
              null
            ]
          }
        }
      }
    },
    { $sort: { visitCount: -1 } }
  ]
}

function buildTopUsersPipeline(baseMatch) {
  return [
    { $match: { ...baseMatch } },
    {
      $group: {
        _id: '$userId',
        visitCount: { $sum: 1 },
        totalDurationMs: { $sum: '$durationMs' },
        lastVisitTime: { $max: '$enterTime' }
      }
    },
    { $sort: { visitCount: -1 } },
    { $limit: 10 }
  ]
}

function buildRecentVisitsPipeline(baseMatch, noLimit = false) {
  const pipeline = [
    { $match: { ...baseMatch } },
    { $sort: { enterTime: -1 } },
    { $limit: noLimit ? 10000 : 30 },
    { $project: { _id: 0, userId: 1, pagePath: 1, pageName: 1, enterTime: 1, durationMs: 1 } }
  ]
  return pipeline
}

function buildTrendPipeline(baseMatch) {
  return [
    { $match: { ...baseMatch } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: '+09:00' } },
        visits: { $sum: 1 },
        _users: { $addToSet: '$userId' }
      }
    },
    { $sort: { _id: 1 } }
  ]
}

// ── Menu group assignment stage (for groupTrend pipeline) ──

const MENU_GROUP_STAGE = {
  $addFields: {
    _menuGroup: {
      $switch: {
        branches: [
          { case: { $in: ['$_normalizedPath', ['/', '/agent-monitor', '/agent-version', '/resource-agent-status', '/resource-agent-version', '/recovery-overview', '/recovery-by-process', '/recovery-analysis', '/user-activity']] }, then: 'Dashboard' },
          { case: { $in: ['$_normalizedPath', ['/clients', '/clients/:id', '/resource-clients', '/resource-clients/:id']] }, then: 'Clients' },
          { case: { $in: ['$_normalizedPath', ['/equipment-info', '/email-template', '/popup-template', '/email-image', '/email-recipients', '/email-info', '/users']] }, then: 'Master Data' },
          { case: { $in: ['$_normalizedPath', ['/permissions', '/system-logs', '/settings']] }, then: 'System' }
        ],
        default: 'Other'
      }
    }
  }
}

function buildHourlyHeatmapPipeline(baseMatch) {
  return [
    { $match: { ...baseMatch } },
    {
      $group: {
        _id: {
          hour: { $hour: { date: '$timestamp', timezone: '+09:00' } },
          dayOfWeek: { $dayOfWeek: { date: '$timestamp', timezone: '+09:00' } }
        },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        hour: '$_id.hour',
        dayOfWeek: '$_id.dayOfWeek',
        count: 1
      }
    },
    { $sort: { dayOfWeek: 1, hour: 1 } }
  ]
}

function buildPageTrendPipeline(baseMatch, dateFormat = '%Y-%m-%d') {
  return [
    { $match: { ...baseMatch } },
    PATH_NORMALIZATION_STAGE,
    {
      $group: {
        _id: {
          date: { $dateToString: { format: dateFormat, date: '$timestamp', timezone: '+09:00' } },
          path: '$_normalizedPath'
        },
        visits: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]
}

function buildGroupTrendPipeline(baseMatch, dateFormat = '%Y-%m-%d') {
  return [
    { $match: { ...baseMatch } },
    PATH_NORMALIZATION_STAGE,
    MENU_GROUP_STAGE,
    {
      $group: {
        _id: {
          date: { $dateToString: { format: dateFormat, date: '$timestamp', timezone: '+09:00' } },
          group: '$_menuGroup'
        },
        visits: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]
}

module.exports = {
  getWebManagerStats,
  _setDeps,
  PAGE_MAP,
  TOTAL_PAGES
}
