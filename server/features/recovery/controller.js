/**
 * Recovery Dashboard Controller
 * Parses request parameters and delegates to service layer.
 */

const service = require('./service')
const { validatePeriodRange, validateBackfillRange } = require('./validation')
const { parsePaginationParams, createPaginatedResponse } = require('../../shared/utils/pagination')
const { createBatchLog } = require('../../shared/models/webmanagerLogModel')
const batchLogsService = require('./batchLogsService')
const { getPodId } = require('../../shared/utils/podIdentity')
const { createLogger } = require('../../shared/logger')
const log = createLogger('recovery')

// ── Dependency Injection (for testing) ──

let deps = {}
function _setDeps(overrides) {
  deps = { ...deps, ...overrides }
  if (overrides.WebManagerLog) {
    batchLogsService._setDeps({ WebManagerLog: overrides.WebManagerLog })
  }
}

function getSummaryService() {
  return deps.summaryService || require('./recoverySummaryService')
}

function getDateUtils() {
  return deps.dateUtils || require('./dateUtils')
}

async function getOverview(req, res) {
  const { period, process, line, startDate, endDate } = req.query
  // 커스텀 기간 90일 제한
  if (period === 'custom') {
    const validation = validatePeriodRange(startDate, endDate, 730)
    if (!validation.valid) return res.status(400).json({ error: validation.error })
  }
  const result = await service.getOverview({
    period: period || 'today',
    process: process || undefined,
    line: line || undefined,
    startDate, endDate
  })
  res.json(result)
}

async function getByProcess(req, res) {
  const { period, process, line, startDate, endDate } = req.query
  if (period === 'custom') {
    const validation = validatePeriodRange(startDate, endDate, 730)
    if (!validation.valid) return res.status(400).json({ error: validation.error })
  }
  const result = await service.getByProcess({
    period: period || 'today',
    process: process || undefined,
    line: line || undefined,
    startDate, endDate
  })
  res.json(result)
}

async function getByModel(req, res) {
  const { period, process, line, model, startDate, endDate } = req.query
  if (period === 'custom') {
    const validation = validatePeriodRange(startDate, endDate, 730)
    if (!validation.valid) return res.status(400).json({ error: validation.error })
  }
  const result = await service.getByModel({
    period: period || 'today',
    process: process || undefined,
    line: line || undefined,
    model: model || undefined,
    startDate, endDate
  })
  res.json(result)
}

async function getAnalysis(req, res) {
  const { period, process, line, model, tab, startDate, endDate } = req.query
  if (period === 'custom') {
    const validation = validatePeriodRange(startDate, endDate, 730)
    if (!validation.valid) return res.status(400).json({ error: validation.error })
  }
  const result = await service.getAnalysis({
    period: period || 'today',
    process: process || undefined,
    line: line || undefined,
    model: model || undefined,
    tab: tab || 'scenario',
    startDate, endDate
  })
  res.json(result)
}

async function getAnalysisFilters(req, res) {
  const { period, startDate, endDate } = req.query
  const userProcesses = req.user?.process
    ? req.user.process.split(';').map(p => p.trim()).filter(Boolean)
    : null
  const result = await service.getAnalysisFilters({
    userProcesses,
    period: period || 'today',
    startDate,
    endDate
  })
  res.json(result)
}

async function getHistory(req, res) {
  const { eqpid, ears_code, status, startDate, endDate } = req.query

  // Enforce 7-day limit
  const validation = validatePeriodRange(startDate, endDate, 7)
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error })
  }

  const { page, pageSize, skip, limit } = parsePaginationParams(req.query)
  const result = await service.getHistory({
    eqpid: eqpid || undefined,
    ears_code: ears_code || undefined,
    status: status || undefined,
    startDate,
    endDate,
    skip,
    limit
  })

  res.json(createPaginatedResponse(result.data, result.total, page, pageSize))
}

async function getLastAggregation(req, res) {
  const summaryService = getSummaryService()
  const hourly = await summaryService.getLastCronRun('hourly')
  const daily = await summaryService.getLastCronRun('daily')
  res.json({ hourly, daily })
}

async function analyzeBackfill(req, res) {
  const summaryService = getSummaryService()
  if (!summaryService.isIndexReady()) {
    return res.status(503).json({
      error: 'EQP_AUTO_RECOVERY create_date 인덱스가 확인되지 않았습니다. 서버 재시작이 필요할 수 있습니다.',
      indexReady: false
    })
  }

  const { startDate, endDate, skipHourly, skipDaily, throttleMs, retryPartial } = req.body
  const validation = validateBackfillRange(startDate, endDate)
  if (!validation.valid) return res.status(400).json({ error: validation.error })

  const { generateExpectedBuckets, floorToKSTBucket } = getDateUtils()

  const rawStart = new Date(startDate)
  const rawEnd = new Date(endDate)
  const result = { hourly: null, daily: null, estimatedMinutes: 0 }
  let totalActionable = 0
  const effectiveThrottle = throttleMs ?? 1000

  // Settling time clamping — match runManualBackfill behavior
  const settlingHours = summaryService._getSettlingHours()
  const maxEnd = new Date(Date.now() - settlingHours * 60 * 60 * 1000)

  for (const period of ['hourly', 'daily']) {
    if ((period === 'hourly' && skipHourly) || (period === 'daily' && skipDaily)) continue

    const start = floorToKSTBucket('daily', rawStart)
    const endFloored = floorToKSTBucket('daily', rawEnd)
    const rawEndMs = endFloored.getTime() + 24 * 60 * 60 * 1000
    const end = new Date(Math.min(rawEndMs, maxEnd.getTime()))

    if (end <= start) continue

    const expected = generateExpectedBuckets(period, start, end)
    const completedSet = await summaryService.getCompletedBucketSet(period, start, end)
    const partialSet = await summaryService.getPartialBucketSet(period, start, end)
    const incompleteSet = await summaryService.getIncompleteBucketSet(period, start, end)

    const successCount = expected.filter(b =>
      completedSet.has(b.getTime()) && !partialSet.has(b.getTime())
    ).length
    const partialCount = expected.filter(b => partialSet.has(b.getTime())).length
    const incompleteCount = expected.filter(b =>
      incompleteSet.has(b.getTime()) && !partialSet.has(b.getTime()) && !completedSet.has(b.getTime())
    ).length
    const pendingCount = expected.length - successCount - partialCount - incompleteCount
    const actionable = retryPartial ? partialCount : (pendingCount + incompleteCount)

    result[period] = {
      total: expected.length,
      success: successCount,
      partial: partialCount,
      incomplete: incompleteCount,
      pending: pendingCount,
      actionable
    }
    totalActionable += actionable
  }

  result.estimatedMinutes = Math.round(totalActionable * (1.5 + effectiveThrottle / 1000) / 60 * 10) / 10

  // Settling 안내: endDate가 클램핑되는 경우 실제 적용 범위 표시
  const requestedEnd = new Date(endDate)
  if (requestedEnd > maxEnd) {
    result.settlingInfo = {
      requestedEnd: requestedEnd.toISOString(),
      effectiveEnd: maxEnd.toISOString(),
      settlingHours: settlingHours,
      message: `settling 기간(${settlingHours}시간) 이내 데이터는 제외됩니다`
    }
  }

  res.json(result)
}

async function startBackfill(req, res) {
  const summaryService = getSummaryService()
  if (!summaryService.isIndexReady()) {
    return res.status(503).json({
      error: 'EQP_AUTO_RECOVERY create_date 인덱스가 확인되지 않았습니다.',
      indexReady: false
    })
  }

  const { startDate, endDate, skipHourly, skipDaily, throttleMs, retryPartial } = req.body
  const validation = validateBackfillRange(startDate, endDate)
  if (!validation.valid) return res.status(400).json({ error: validation.error })

  const { floorToKSTBucket } = getDateUtils()

  // Check if already running
  const currentState = await summaryService.getBackfillState()
  if (currentState.status === 'running' || currentState.status === 'running_on_other_pod') {
    return res.status(409).json({
      error: '이미 실행 중입니다',
      state: currentState
    })
  }

  const clampedThrottle = Math.max(0, Math.min(5000, throttleMs ?? 1000))

  // KST align: 사용자 날짜 → KST 자정 기준 범위로 변환
  const alignedStart = floorToKSTBucket('daily', new Date(startDate))
  const endFloored = floorToKSTBucket('daily', new Date(endDate))
  const alignedEnd = new Date(endFloored.getTime() + 24 * 60 * 60 * 1000)

  try {
    await summaryService.runManualBackfill(alignedStart, alignedEnd, {
      skipHourly: !!skipHourly,
      skipDaily: !!skipDaily,
      throttleMs: clampedThrottle,
      retryPartial: !!retryPartial
    })

    createBatchLog({
      batchAction: 'backfill_started',
      batchParams: {
        startDate: alignedStart.toISOString(),
        endDate: alignedEnd.toISOString(),
        skipHourly: !!skipHourly,
        skipDaily: !!skipDaily,
        throttleMs: clampedThrottle,
        retryPartial: !!retryPartial
      },
      userId: req.user?.singleid || 'system',
      podId: getPodId()
    }).catch(e => log.error(`[BatchLog] backfill_started log failed: ${e.message}`))

    res.status(202).json({ message: 'Backfill started' })
  } catch (err) {
    res.status(409).json({ error: err.message })
  }
}

async function getBackfillStatus(req, res) {
  const summaryService = getSummaryService()
  const state = await summaryService.getBackfillState()
  res.json({
    ...state,
    indexReady: summaryService.isIndexReady()
  })
}

const VALID_DISTRIBUTION_PERIODS = ['today', '7d', '30d', '90d']

async function getCronRunDistribution(req, res) {
  const period = req.query.period || '7d'
  if (!VALID_DISTRIBUTION_PERIODS.includes(period)) {
    return res.status(400).json({ error: `Invalid period. Must be one of: ${VALID_DISTRIBUTION_PERIODS.join(', ')}` })
  }
  const summaryService = getSummaryService()
  const { startDate, endDate } = req.query
  const dateRange = (startDate && endDate) ? { startDate, endDate } : undefined
  const result = await summaryService.getCronRunDistribution(period, dateRange)
  res.json(result)
}

async function handleCancelBackfill(req, res) {
  const summaryService = getSummaryService()
  await summaryService.cancelBackfill()

  createBatchLog({
    batchAction: 'backfill_cancelled',
    batchParams: {},
    userId: req.user?.singleid || 'system',
    podId: getPodId()
  }).catch(e => log.error(`[BatchLog] backfill_cancelled log failed: ${e.message}`))

  res.json({ message: 'Backfill cancel requested' })
}

// ── Batch Logs API ──

async function getBatchLogs(req, res) {
  const { page, pageSize, skip, limit } = parsePaginationParams(req.query, { defaultPageSize: 50 })
  const { data, total } = await batchLogsService.queryBatchLogs(req.query, { skip, limit })
  res.json(createPaginatedResponse(data, total, page, pageSize))
}

async function getBatchHeatmap(req, res) {
  const days = parseInt(req.query.days, 10) || 30
  const data = await batchLogsService.queryBatchHeatmap(days)
  res.json({ data })
}

// ── By Category ──

async function getByCategory(req, res) {
  const { period, process, line, startDate, endDate } = req.query
  if (period === 'custom') {
    const validation = validatePeriodRange(startDate, endDate, 730)
    if (!validation.valid) return res.status(400).json({ error: validation.error })
  }
  const result = await service.getByCategory({
    period: period || 'today',
    process: process || undefined,
    line: line || undefined,
    startDate, endDate
  })
  res.json(result)
}

// ── Category Map CRUD ──

const recoveryCategoryService = require('./recoveryCategoryService')

async function getCategoryMap(req, res) {
  const data = await recoveryCategoryService.getAll()
  res.json({ data })
}

async function upsertCategoryMap(req, res) {
  const { items } = req.body
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' })
  }
  const userId = req.user?.singleid || 'system'
  const data = await recoveryCategoryService.upsertCategories(items, userId)
  res.json({ data })
}

async function deleteCategoryMap(req, res) {
  const { scCategories } = req.body
  if (!Array.isArray(scCategories) || scCategories.length === 0) {
    return res.status(400).json({ error: 'scCategories array is required' })
  }
  const userId = req.user?.singleid || 'system'
  const result = await recoveryCategoryService.deleteCategories(scCategories, userId)
  res.json(result)
}

async function getScCategories(req, res) {
  const data = await recoveryCategoryService.getDistinctScCategories()
  res.json({ data })
}

module.exports = {
  getOverview,
  getByProcess,
  getByModel,
  getByCategory,
  getAnalysis,
  getAnalysisFilters,
  getHistory,
  getLastAggregation,
  analyzeBackfill,
  startBackfill,
  getBackfillStatus,
  getCronRunDistribution,
  cancelBackfill: handleCancelBackfill,
  getBatchLogs,
  getBatchHeatmap,
  getCategoryMap,
  upsertCategoryMap,
  deleteCategoryMap,
  getScCategories,
  _setDeps
}
