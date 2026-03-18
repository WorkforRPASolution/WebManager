/**
 * Recovery Dashboard Controller
 * Parses request parameters and delegates to service layer.
 */

const service = require('./service')
const { validatePeriodRange, validateBackfillRange } = require('./validation')
const { parsePaginationParams, createPaginatedResponse } = require('../../shared/utils/pagination')

// ── Dependency Injection (for testing) ──

let deps = {}
function _setDeps(overrides) { deps = { ...deps, ...overrides } }

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
  const { startDate, endDate, skipHourly, skipDaily, throttleMs, retryPartial } = req.body
  const validation = validateBackfillRange(startDate, endDate)
  if (!validation.valid) return res.status(400).json({ error: validation.error })

  const { generateExpectedBuckets, floorToKSTBucket } = getDateUtils()
  const summaryService = getSummaryService()

  const rawStart = new Date(startDate)
  const rawEnd = new Date(endDate)
  const result = { hourly: null, daily: null, estimatedMinutes: 0 }
  let totalActionable = 0
  const effectiveThrottle = throttleMs ?? 1000

  for (const period of ['hourly', 'daily']) {
    if ((period === 'hourly' && skipHourly) || (period === 'daily' && skipDaily)) continue

    const start = floorToKSTBucket('daily', rawStart)
    const endFloored = floorToKSTBucket('daily', rawEnd)
    const end = new Date(endFloored.getTime() + 24 * 60 * 60 * 1000)

    const expected = generateExpectedBuckets(period, start, end)
    const completedSet = await summaryService.getCompletedBucketSet(period, start, end)
    const partialSet = await summaryService.getPartialBucketSet(period, start, end)

    const successCount = expected.filter(b =>
      completedSet.has(b.getTime()) && !partialSet.has(b.getTime())
    ).length
    const partialCount = expected.filter(b => partialSet.has(b.getTime())).length
    const pendingCount = expected.length - successCount - partialCount
    const actionable = retryPartial ? partialCount : pendingCount

    result[period] = {
      total: expected.length,
      success: successCount,
      partial: partialCount,
      pending: pendingCount,
      actionable
    }
    totalActionable += actionable
  }

  result.estimatedMinutes = Math.round(totalActionable * (1.5 + effectiveThrottle / 1000) / 60 * 10) / 10

  res.json(result)
}

async function startBackfill(req, res) {
  const { startDate, endDate, skipHourly, skipDaily, throttleMs, retryPartial } = req.body
  const validation = validateBackfillRange(startDate, endDate)
  if (!validation.valid) return res.status(400).json({ error: validation.error })

  const { floorToKSTBucket } = getDateUtils()
  const summaryService = getSummaryService()

  // Check if already running
  const currentState = summaryService.getBackfillState()
  if (currentState.status === 'running') {
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
    res.status(202).json({ message: 'Backfill started' })
  } catch (err) {
    res.status(409).json({ error: err.message })
  }
}

async function getBackfillStatus(req, res) {
  const summaryService = getSummaryService()
  res.json(summaryService.getBackfillState())
}

async function handleCancelBackfill(req, res) {
  const summaryService = getSummaryService()
  summaryService.cancelBackfill()
  res.json({ message: 'Backfill cancel requested' })
}

module.exports = {
  getOverview,
  getByProcess,
  getAnalysis,
  getHistory,
  getLastAggregation,
  analyzeBackfill,
  startBackfill,
  getBackfillStatus,
  cancelBackfill: handleCancelBackfill,
  _setDeps
}
