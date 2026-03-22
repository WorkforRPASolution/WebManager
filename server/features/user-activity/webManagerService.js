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
 * @param {'sum'|'avg'} mode - 'sum': 합산 (방문 횟수 등), 'avg': 평균 (체류시간 등)
 */
function rollupWeekly(dailyData, valueKeys, mode = 'sum') {
  const buckets = {}
  const counts = {}
  for (const item of dailyData) {
    const d = new Date(item.date + 'T00:00:00+09:00')
    const day = d.getUTCDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(d)
    monday.setUTCDate(monday.getUTCDate() + mondayOffset)
    const weekKey = monday.toISOString().slice(0, 10)

    if (!buckets[weekKey]) {
      buckets[weekKey] = { date: weekKey }
      counts[weekKey] = {}
    }
    for (const key of valueKeys) {
      const val = item[key] || 0
      buckets[weekKey][key] = (buckets[weekKey][key] || 0) + val
      if (val > 0) counts[weekKey][key] = (counts[weekKey][key] || 0) + 1
    }
  }
  if (mode === 'avg') {
    for (const weekKey of Object.keys(buckets)) {
      for (const key of valueKeys) {
        const cnt = counts[weekKey][key] || 1
        buckets[weekKey][key] = Math.round(buckets[weekKey][key] / cnt)
      }
    }
  }
  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * 동시접속자 계산 (sweep line algorithm)
 * enterTime~leaveTime 겹치는 세션 수를 시간 버킷별 피크로 집계
 */
function computeConcurrentUsers(logs, granularity, periodDurationMs = 0) {
  if (logs.length === 0) return { peak: 0, average: 0, trend: [] }

  const events = []
  let totalSessionMs = 0
  for (const log of logs) {
    const enter = new Date(log.enterTime).getTime()
    const leave = new Date(log.leaveTime).getTime()
    if (isNaN(enter) || isNaN(leave) || leave <= enter) continue
    totalSessionMs += (leave - enter)
    events.push({ time: enter, delta: 1 })
    events.push({ time: leave, delta: -1 })
  }
  if (events.length === 0) return { peak: 0, average: 0, trend: [] }

  // leave(-1)를 enter(+1)보다 먼저 처리 → 동시간 떠난 사용자 반영 후 카운트
  events.sort((a, b) => a.time - b.time || a.delta - b.delta)

  let current = 0
  let peak = 0
  const hourlyPeaks = {}

  for (const ev of events) {
    current += ev.delta
    if (current < 0) current = 0
    if (current > peak) peak = current

    // KST 시간 버킷
    const kstMs = ev.time + 9 * 3600000
    const hourStart = Math.floor(kstMs / 3600000) * 3600000
    const hourKey = new Date(hourStart - 9 * 3600000).toISOString().slice(0, 13) // "2026-03-21T14"
    hourlyPeaks[hourKey] = Math.max(hourlyPeaks[hourKey] || 0, current)
  }

  const hourlyEntries = Object.entries(hourlyPeaks)
    .map(([key, val]) => ({ date: key + ':00', concurrent: val }))
    .sort((a, b) => a.date.localeCompare(b.date))

  let trend
  if (granularity === 'hourly') {
    trend = hourlyEntries
  } else {
    // 일별 피크
    const dailyMap = {}
    for (const e of hourlyEntries) {
      const day = e.date.slice(0, 10)
      dailyMap[day] = Math.max(dailyMap[day] || 0, e.concurrent)
    }
    trend = Object.entries(dailyMap)
      .map(([date, concurrent]) => ({ date, concurrent }))
      .sort((a, b) => a.date.localeCompare(b.date))

    if (granularity === 'weekly') {
      const weeklyMap = {}
      for (const item of trend) {
        const d = new Date(item.date + 'T00:00:00+09:00')
        const day = d.getUTCDay()
        const mondayOffset = day === 0 ? -6 : 1 - day
        const monday = new Date(d)
        monday.setUTCDate(monday.getUTCDate() + mondayOffset)
        const weekKey = monday.toISOString().slice(0, 10)
        weeklyMap[weekKey] = Math.max(weeklyMap[weekKey] || 0, item.concurrent)
      }
      trend = Object.entries(weeklyMap)
        .map(([date, concurrent]) => ({ date, concurrent }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }
  }

  // 평균 동시접속 = 총 세션 시간 / 조회 기간
  const average = periodDurationMs > 0
    ? Math.round(totalSessionMs / periodDurationMs * 10) / 10
    : 0

  return { peak, average, trend }
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

function normalizePath(pagePath) {
  if (/^\/clients\/[^/]+$/.test(pagePath)) return '/clients/:id'
  if (/^\/resource-clients\/[^/]+$/.test(pagePath)) return '/resource-clients/:id'
  return pagePath
}

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
  noLimit = false,
  recentMode = 'detail'
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

  // noLimit=true: CSV 내보내기 전용 — recentVisits + 이름 조회 후 early return
  if (noLimit) {
    const earsDbNl = getEarsDb()
    const [recentResult, nameList] = await Promise.all([
      wmColl.aggregate(buildRecentVisitsPipeline(baseMatch, true, recentMode), aggOpts).toArray(),
      earsDbNl.collection('ARS_USER_INFO').aggregate([
        { $project: { _id: 0, singleid: 1, name: 1 } }
      ]).toArray()
    ])
    const nlNameMap = {}
    for (const u of nameList) { if (u.name) nlNameMap[u.singleid] = u.name }
    const recentVisits = recentResult.map(r => {
      const normalized = normalizePath(r.pagePath || '')
      const mapped = PAGE_MAP[normalized]
      return {
        userId: r.userId,
        name: nlNameMap[r.userId] || null,
        pagePath: r.pagePath,
        pageName: mapped ? mapped.name : (r.pageName || r.pagePath),
        enterTime: r.enterTime,
        durationMs: r.durationMs
      }
    })
    return {
      kpi: { activeUsers: 0, totalVisits: 0, pageReachRate: 0, visitedPages: 0, totalPages: TOTAL_PAGES, avgDurationMs: 0, periodLabel: PERIOD_LABELS[period] || '최근 30일' },
      pageSummary: [], menuGroupSummary: [], trend: [], hourlyHeatmap: [],
      pageTrend: [], groupTrend: [], concurrent: { peak: 0, avg: 0, trend: [] },
      processTrend: [], processActiveUsers: [], durationTrend: [],
      granularity: 'daily', topUsers: [], recentVisits
    }
  }

  const granularity = determineTrendGranularity(period, startDate, endDate)
  const dateFormat = getTrendDateFormat(granularity)

  // 동시접속 계산용 raw 로그 조회 (enterTime, leaveTime만)
  const concurrentLogs = await wmColl.aggregate([
    { $match: { ...baseMatch, enterTime: { $exists: true }, leaveTime: { $exists: true } } },
    { $project: { _id: 0, enterTime: 1, leaveTime: 1 } }
  ], aggOpts).toArray()
  const periodDurationMs = periodEnd.getTime() - periodStart.getTime()
  const concurrent = computeConcurrentUsers(concurrentLogs, granularity, periodDurationMs)

  // 공정별 활성 사용자 추이: 시간 버킷별 고유 userId 조회 + process 매핑
  const earsDb2 = getEarsDb()
  const [userInfoResult, activeUsersByBucket] = await Promise.all([
    earsDb2.collection('ARS_USER_INFO').aggregate([
      { $project: { _id: 0, singleid: 1, name: 1, processes: 1, process: 1 } }
    ]).toArray().then(users => {
      const map = {}
      for (const u of users) {
        let procs = []
        if (Array.isArray(u.processes) && u.processes.length > 0) {
          procs = u.processes
        } else if (u.process) {
          procs = u.process.split(';').map(p => p.trim()).filter(Boolean)
        }
        if (procs.length > 0) map[u.singleid] = procs
      }
      return { processMap: map, users }
    }),
    wmColl.aggregate([
      { $match: { ...baseMatch } },
      { $group: {
        _id: { date: { $dateToString: { format: dateFormat, date: '$timestamp', timezone: '+09:00' } } },
        _users: { $addToSet: '$userId' }
      }},
      { $sort: { '_id.date': 1 } }
    ], aggOpts).toArray()
  ])

  const userProcessMap = userInfoResult.processMap
  const userNameMap = {}
  for (const u of userInfoResult.users) {
    if (u.name) userNameMap[u.singleid] = u.name
  }

  // JS에서 process 매핑 → 시간 버킷 × process별 활성 사용자 수
  const processTrendMap = {}
  const processNames = new Set()
  for (const bucket of activeUsersByBucket) {
    const date = bucket._id.date
    const userIds = bucket._users || []
    const processCount = {}
    for (const uid of userIds) {
      const procs = userProcessMap[uid]
      if (procs) {
        for (const p of procs) {
          processCount[p] = (processCount[p] || 0) + 1
          processNames.add(p)
        }
      } else {
        processCount['미지정'] = (processCount['미지정'] || 0) + 1
        processNames.add('미지정')
      }
    }
    processTrendMap[date] = { date, ...processCount }
  }
  let processTrend = Object.values(processTrendMap).sort((a, b) => a.date.localeCompare(b.date))
  if (granularity === 'weekly') {
    processTrend = rollupWeekly(processTrend, [...processNames])
  }

  // 공정별 활성 사용자 도넛용: 전체 기간 고유 userId → process 매핑
  const allActiveUserIds = new Set()
  for (const bucket of activeUsersByBucket) {
    for (const uid of (bucket._users || [])) allActiveUserIds.add(uid)
  }
  const processActiveUsers = []
  const processCountMap = {}
  let unmappedCount = 0
  for (const uid of allActiveUserIds) {
    const procs = userProcessMap[uid]
    if (procs) {
      for (const p of procs) processCountMap[p] = (processCountMap[p] || 0) + 1
    } else {
      unmappedCount++
    }
  }
  for (const [process, count] of Object.entries(processCountMap)) {
    processActiveUsers.push({ process, activeUsers: count })
  }
  if (unmappedCount > 0) {
    processActiveUsers.push({ process: '미지정', activeUsers: unmappedCount })
  }
  processActiveUsers.sort((a, b) => b.activeUsers - a.activeUsers)

  const [kpiResult, pageSummaryResult, topUsersResult, recentResult, trendResult, heatmapResult, pageTrendResult, groupTrendResult, durationTrendResult] = await Promise.all([
    wmColl.aggregate(buildKpiPipeline(baseMatch), aggOpts).toArray(),
    wmColl.aggregate(buildPageSummaryPipeline(baseMatch), aggOpts).toArray(),
    wmColl.aggregate(buildTopUsersPipeline(baseMatch), aggOpts).toArray(),
    wmColl.aggregate(buildRecentVisitsPipeline(baseMatch, noLimit, recentMode), aggOpts).toArray(),
    wmColl.aggregate(buildTrendPipeline(baseMatch), aggOpts).toArray(),
    wmColl.aggregate(buildHourlyHeatmapPipeline(baseMatch), aggOpts).toArray(),
    wmColl.aggregate(buildPageTrendPipeline(baseMatch, dateFormat), aggOpts).toArray(),
    wmColl.aggregate(buildGroupTrendPipeline(baseMatch, dateFormat), aggOpts).toArray(),
    wmColl.aggregate(buildDurationTrendPipeline(baseMatch, dateFormat), aggOpts).toArray()
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
  const visitedPathSet = new Set(Array.isArray(kpi._visitedPaths) ? kpi._visitedPaths : [])
  const unvisitedPages = Object.entries(PAGE_MAP)
    .filter(([path]) => !visitedPathSet.has(path))
    .map(([, info]) => info.name)

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
    name: userNameMap[u._id] || null,
    visitCount: u.visitCount,
    totalDurationMs: u.totalDurationMs || 0,
    lastVisitTime: u.lastVisitTime
  }))

  // Recent visits (PAGE_MAP 매핑 적용)
  const recentVisits = recentResult.map(r => {
    const normalized = normalizePath(r.pagePath || '')
    const mapped = PAGE_MAP[normalized]
    return {
      userId: r.userId,
      name: userNameMap[r.userId] || null,
      pagePath: r.pagePath,
      pageName: mapped ? mapped.name : (r.pageName || r.pagePath),
      enterTime: r.enterTime,
      durationMs: r.durationMs
    }
  })

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

  // Duration trend: date × page avg duration (Top pages, 30분 캡 + 0 제외 적용됨)
  const durationTrendMap = {}
  const durationPageNames = new Set()
  for (const r of durationTrendResult) {
    const date = r._id.date
    const path = r._id.path
    const mapped = PAGE_MAP[path]
    const pageName = mapped ? mapped.name : path
    durationPageNames.add(pageName)
    if (!durationTrendMap[date]) durationTrendMap[date] = { date }
    durationTrendMap[date][pageName] = Math.round(r.avgDurationMs || 0)
  }
  let durationTrend = Object.values(durationTrendMap).sort((a, b) => a.date.localeCompare(b.date))
  if (granularity === 'weekly') {
    durationTrend = rollupWeekly(durationTrend, [...durationPageNames], 'avg')
  }

  return {
    kpi: {
      activeUsers,
      totalVisits,
      pageReachRate,
      visitedPages,
      totalPages: TOTAL_PAGES,
      avgDurationMs,
      unvisitedPages,
      periodLabel: PERIOD_LABELS[period] || '최근 30일'
    },
    pageSummary,
    menuGroupSummary,
    trend,
    hourlyHeatmap,
    pageTrend,
    groupTrend,
    concurrent,
    processTrend,
    processActiveUsers,
    durationTrend,
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

function buildRecentVisitsPipeline(baseMatch, noLimit = false, recentMode = 'detail') {
  if (recentMode === 'user') {
    // 사용자별 모드: userId별 최근 방문 1건만
    return [
      { $match: { ...baseMatch } },
      { $sort: { enterTime: -1 } },
      { $group: {
        _id: '$userId',
        pagePath: { $first: '$pagePath' },
        pageName: { $first: '$pageName' },
        enterTime: { $first: '$enterTime' },
        durationMs: { $first: '$durationMs' }
      }},
      { $sort: { enterTime: -1 } },
      { $limit: noLimit ? 10000 : 30 },
      { $project: { _id: 0, userId: '$_id', pagePath: 1, pageName: 1, enterTime: 1, durationMs: 1 } }
    ]
  }
  return [
    { $match: { ...baseMatch } },
    { $sort: { enterTime: -1 } },
    { $limit: noLimit ? 10000 : 30 },
    { $project: { _id: 0, userId: 1, pagePath: 1, pageName: 1, enterTime: 1, durationMs: 1 } }
  ]
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

function buildDurationTrendPipeline(baseMatch, dateFormat = '%Y-%m-%d') {
  return [
    { $match: { ...baseMatch, durationMs: { $gt: 0 } } },
    PATH_NORMALIZATION_STAGE,
    {
      $group: {
        _id: {
          date: { $dateToString: { format: dateFormat, date: '$timestamp', timezone: '+09:00' } },
          path: '$_normalizedPath'
        },
        avgDurationMs: {
          $avg: { $min: ['$durationMs', DURATION_CAP_MS] }
        }
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
