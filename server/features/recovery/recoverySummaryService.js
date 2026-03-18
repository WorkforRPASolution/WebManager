/**
 * Recovery Summary Batch Service
 *
 * Aggregates EQP_AUTO_RECOVERY documents into summary collections
 * on hourly and daily schedules using MongoDB aggregation pipelines.
 */

const cron = require('node-cron')
const { earsConnection } = require('../../shared/db/connection')
const CronRunLogModel = require('./cronRunLogModel')
const {
  computeHourlyBoundaries,
  computeDailyBoundaries,
  computeBoundariesForBucket,
  generateExpectedBuckets,
  floorToKSTBucket
} = require('./dateUtils')

// ── Environment Config ──

const SETTLING_HOURS = parseInt(process.env.RECOVERY_SETTLING_HOURS || '3', 10)
const AUTO_BACKFILL_LIMIT = parseInt(process.env.RECOVERY_AUTO_BACKFILL_LIMIT || '6', 10)
const DEFAULT_THROTTLE_MS = parseInt(process.env.RECOVERY_BACKFILL_THROTTLE_MS || '1000', 10)

// ── Pipeline Configuration ──

const PIPELINE_CONFIGS = {
  scenario: { collection: 'RECOVERY_SUMMARY_BY_SCENARIO', groupField: 'ears_code' },
  equipment: { collection: 'RECOVERY_SUMMARY_BY_EQUIPMENT', groupField: 'eqpid' },
  trigger: { collection: 'RECOVERY_SUMMARY_BY_TRIGGER', groupField: 'trigger_by' }
}

// ── Dependency Injection (for testing) ──

let deps = {
  earsDb: null,
  CronRunLog: CronRunLogModel,
  settlingHours: SETTLING_HOURS,
  autoBackfillLimit: AUTO_BACKFILL_LIMIT,
  defaultThrottleMs: DEFAULT_THROTTLE_MS,
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
}

function _setDeps(overrides) {
  deps = { ...deps, ...overrides }
}

function getEarsDb() {
  return deps.earsDb || earsConnection.db
}

function getCronRunLog() {
  return deps.CronRunLog
}

// ── Pipeline Builder ──

/**
 * Build MongoDB aggregation pipeline for a given config key.
 */
function buildPipeline(configKey, period, bucketStart, dateGte, dateLt) {
  const config = PIPELINE_CONFIGS[configKey]
  if (!config) throw new Error(`Unknown pipeline config: ${configKey}`)

  const { collection: targetCollection, groupField } = config

  // Stage 1: $match — filter by create_date range and valid status
  const matchStage = {
    $match: {
      create_date: { $gte: dateGte, $lt: dateLt },
      status: { $ne: null }
    }
  }

  // Stage 2: First $group — by (line, process, model, groupField, status) with count
  const firstGroupId = {
    line: '$line',
    process: '$process',
    model: '$model',
    [groupField]: `$${groupField}`,
    status: '$status'
  }
  const firstGroupStage = {
    $group: {
      _id: firstGroupId,
      count: { $sum: 1 }
    }
  }

  // Stage 3: Second $group — by (line, process, model, groupField) with total and status_pairs
  const secondGroupId = {
    line: '$_id.line',
    process: '$_id.process',
    model: '$_id.model',
    [groupField]: `$_id.${groupField}`
  }
  const secondGroupStage = {
    $group: {
      _id: secondGroupId,
      total: { $sum: '$count' },
      status_pairs: { $push: { k: '$_id.status', v: '$count' } }
    }
  }

  // Stage 4: $addFields — set dimension fields, period, bucket, status_counts
  const addFieldsStage = {
    $addFields: {
      period,
      bucket: bucketStart,
      line: '$_id.line',
      process: '$_id.process',
      model: '$_id.model',
      [groupField]: `$_id.${groupField}`,
      status_counts: { $arrayToObject: '$status_pairs' },
      updated_at: '$$NOW'
    }
  }

  // Stage 5: $unset — remove helper fields
  const unsetStage = {
    $unset: ['_id', 'status_pairs']
  }

  // Stage 6: $merge — upsert into target collection
  const mergeOn = ['period', 'bucket', 'line', 'process', 'model', groupField]
  const mergeStage = {
    $merge: {
      into: targetCollection,
      on: mergeOn,
      whenMatched: 'replace',
      whenNotMatched: 'insert'
    }
  }

  return [matchStage, firstGroupStage, secondGroupStage, addFieldsStage, unsetStage, mergeStage]
}

// ── Core Pipeline Execution ──

/**
 * Run 3 aggregation pipelines for a single bucket and log to CRON_RUN_LOG.
 * Uses findOneAndUpdate(upsert) for idempotent logging.
 */
async function runPipelinesForBucket(period, bucketStart, dateGte, dateLt, options = {}) {
  const { source = 'cron' } = options
  const earsDb = getEarsDb()
  const CronRunLog = getCronRunLog()
  const startedAt = new Date()
  const pipelineResults = {}
  const docsInBucket = {}
  const errors = []

  for (const [configKey, config] of Object.entries(PIPELINE_CONFIGS)) {
    try {
      const pipeline = buildPipeline(configKey, period, bucketStart, dateGte, dateLt)
      await earsDb.collection('EQP_AUTO_RECOVERY')
        .aggregate(pipeline, { allowDiskUse: true })
        .toArray()

      const count = await earsDb.collection(config.collection)
        .countDocuments({ period, bucket: bucketStart })

      pipelineResults[configKey] = 'success'
      docsInBucket[configKey] = count
    } catch (err) {
      pipelineResults[configKey] = `failed: ${err.message}`
      docsInBucket[configKey] = 0
      errors.push({ configKey, error: err.message })
    }
  }

  const successCount = Object.values(pipelineResults).filter(r => r === 'success').length
  let status
  if (successCount === 3) status = 'success'
  else if (successCount === 0) status = 'failed'
  else status = 'partial'

  // Idempotent upsert — one authoritative record per bucket
  await CronRunLog.findOneAndUpdate(
    { jobName: 'recoverySummary', period, bucket: bucketStart },
    {
      $set: {
        status,
        source,
        startedAt,
        completedAt: new Date(),
        pipelineResults,
        docsInBucket,
        errorMessage: errors.length > 0 ? errors : undefined
      }
    },
    { upsert: true, new: true }
  )

  return { status, pipelineResults, docsInBucket, errors }
}

// ── Batch Execution ──

let isRunning = false

/**
 * Run the aggregation batch for a given period ('hourly' or 'daily').
 */
async function runBatch(period) {
  if (isRunning) {
    console.log(`[RecoverySummary] Skipping ${period} batch — previous run still in progress`)
    return
  }

  isRunning = true

  try {
    const now = new Date()
    const boundaries = period === 'hourly'
      ? computeHourlyBoundaries(now, deps.settlingHours)
      : computeDailyBoundaries(now)

    const { bucketStart, dateGte, dateLt } = boundaries

    console.log(`[RecoverySummary] Starting ${period} batch: ${dateGte} ~ ${dateLt}`)

    const result = await runPipelinesForBucket(period, bucketStart, dateGte, dateLt, { source: 'cron' })

    console.log(`[RecoverySummary] ${period} batch completed: ${result.status}`)

    // Auto backfill after successful/partial cron run
    if (result.status === 'success' || result.status === 'partial') {
      await runBackfillCheck(period)
    }
  } catch (err) {
    console.error(`[RecoverySummary] ${period} batch fatal error:`, err.message)
  } finally {
    isRunning = false
  }
}

// ── Gap Detection & Auto Backfill ──

/**
 * Detect missing buckets in CRON_RUN_LOG within a scan window.
 * @param {'hourly'|'daily'} period
 * @param {Object} opts - { scanWindowHours? }
 * @returns {Date[]} - Missing bucket dates, oldest first
 */
async function detectGaps(period, opts = {}) {
  const CronRunLog = getCronRunLog()
  const defaultWindow = period === 'hourly' ? 48 : 7 * 24
  const scanWindowHours = opts.scanWindowHours ?? defaultWindow

  const now = new Date()
  const scanEnd = new Date(now.getTime() - deps.settlingHours * 60 * 60 * 1000)
  const scanStart = new Date(scanEnd.getTime() - scanWindowHours * 60 * 60 * 1000)

  // Generate expected buckets in [scanStart, scanEnd)
  const expected = generateExpectedBuckets(period, scanStart, scanEnd)
  if (expected.length === 0) return []

  // Query completed buckets
  const logs = await CronRunLog.find({
    jobName: 'recoverySummary',
    period,
    bucket: { $gte: scanStart, $lt: scanEnd },
    status: { $in: ['success', 'partial'] }
  }).select('bucket').lean()

  const completedSet = new Set(logs.map(l => l.bucket.getTime()))

  // Return gaps (oldest first — already in order from generateExpectedBuckets)
  return expected.filter(b => !completedSet.has(b.getTime()))
}

/**
 * Auto-backfill detected gaps, limited by RECOVERY_AUTO_BACKFILL_LIMIT.
 */
async function runBackfillCheck(period) {
  try {
    const gaps = await detectGaps(period)
    if (gaps.length === 0) return

    const limit = deps.autoBackfillLimit
    const toProcess = gaps.slice(0, limit)

    console.log(`[RecoverySummary] Auto-backfilling ${toProcess.length} ${period} gaps (of ${gaps.length} total)`)

    for (let i = 0; i < toProcess.length; i++) {
      const bucketDate = toProcess[i]
      const { bucketStart, dateGte, dateLt } = computeBoundariesForBucket(period, bucketDate)

      await runPipelinesForBucket(period, bucketStart, dateGte, dateLt, { source: 'autoBackfill' })

      // Throttle between buckets (skip after last)
      if (i < toProcess.length - 1) {
        await deps.sleep(deps.defaultThrottleMs)
      }
    }
  } catch (err) {
    console.error(`[RecoverySummary] Auto-backfill error:`, err.message)
  }
}

// ── Manual Backfill ──

const INITIAL_BACKFILL_STATE = {
  status: 'idle',
  current: 0,
  total: 0,
  skipped: 0,
  period: null,
  currentBucket: null,
  startedAt: null,
  completedAt: null,
  errors: []
}

let backfillState = { ...INITIAL_BACKFILL_STATE }
let backfillPromise = null

/**
 * Get completed bucket set for skip detection.
 */
async function getCompletedBucketSet(period, startDate, endDate, { retryPartial = false } = {}) {
  const CronRunLog = getCronRunLog()
  const statusFilter = retryPartial ? ['success'] : ['success', 'partial']
  const logs = await CronRunLog.find({
    jobName: 'recoverySummary',
    period,
    bucket: { $gte: startDate, $lte: endDate },
    status: { $in: statusFilter }
  }).select('bucket').lean()
  return new Set(logs.map(l => l.bucket.getTime()))
}

/**
 * Get partial-status bucket set for retry detection.
 */
async function getPartialBucketSet(period, startDate, endDate) {
  const CronRunLog = getCronRunLog()
  const logs = await CronRunLog.find({
    jobName: 'recoverySummary',
    period,
    bucket: { $gte: startDate, $lte: endDate },
    status: 'partial'
  }).select('bucket').lean()
  return new Set(logs.map(l => l.bucket.getTime()))
}

/**
 * Validate backfill date range (max 2 years = 730 days).
 */
function validateBackfillRange(startDate, endDate) {
  if (!startDate || !endDate) {
    return { valid: false, error: 'startDate and endDate are required' }
  }
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: 'Invalid date format' }
  }
  if (start >= end) {
    return { valid: false, error: 'startDate must be before endDate' }
  }
  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays > 730) {
    return { valid: false, error: 'Date range exceeds maximum of 730 days (2 years)' }
  }
  return { valid: true }
}

/**
 * Run manual backfill. Executes asynchronously — returns immediately.
 */
async function runManualBackfill(startDate, endDate, options = {}) {
  if (backfillState.status === 'running') {
    throw new Error('Backfill already in progress')
  }

  const { skipHourly = false, skipDaily = false, throttleMs = deps.defaultThrottleMs, retryPartial = false } = options

  // Clamp endDate to now - settlingHours
  const maxEnd = new Date(Date.now() - deps.settlingHours * 60 * 60 * 1000)
  const clampedEnd = new Date(Math.min(new Date(endDate).getTime(), maxEnd.getTime()))
  const start = new Date(startDate)

  // Reset state
  backfillState = {
    status: 'running',
    current: 0,
    total: 0,
    skipped: 0,
    period: null,
    currentBucket: null,
    startedAt: new Date(),
    completedAt: null,
    errors: []
  }

  // Build work list
  const periods = []
  if (!skipHourly) periods.push('hourly')
  if (!skipDaily) periods.push('daily')

  backfillPromise = processBackfill(periods, start, clampedEnd, throttleMs, { retryPartial })
  // Don't await — return immediately
}

async function processBackfill(periods, startDate, endDate, throttleMs, { retryPartial = false } = {}) {
  try {
    // Calculate total buckets across all periods
    let allBuckets = []
    for (const period of periods) {
      // startDate/endDate는 이미 runManualBackfill에서 KST-aligned + clamped 됨
      const expected = generateExpectedBuckets(period, startDate, endDate)

      if (retryPartial) {
        // Partial 재처리: partial만 처리, success+pending은 skip
        const partialSet = await getPartialBucketSet(period, startDate, endDate)
        for (const bucket of expected) {
          if (partialSet.has(bucket.getTime())) {
            allBuckets.push({ period, bucket })
          } else {
            backfillState.skipped++
          }
        }
      } else {
        // 기존 동작: success+partial skip, pending만 처리
        const completed = await getCompletedBucketSet(period, startDate, endDate)
        for (const bucket of expected) {
          if (completed.has(bucket.getTime())) {
            backfillState.skipped++
          } else {
            allBuckets.push({ period, bucket })
          }
        }
      }
    }

    backfillState.total = allBuckets.length + backfillState.skipped

    for (let i = 0; i < allBuckets.length; i++) {
      // Check for cancellation
      if (backfillState.status === 'cancelled') {
        return
      }

      const { period, bucket } = allBuckets[i]
      backfillState.period = period
      backfillState.currentBucket = bucket

      try {
        const { bucketStart, dateGte, dateLt } = computeBoundariesForBucket(period, bucket)
        await runPipelinesForBucket(period, bucketStart, dateGte, dateLt, { source: 'manualBackfill' })
      } catch (err) {
        if (backfillState.errors.length < 100) {
          backfillState.errors.push({
            period,
            bucket: bucket.toISOString(),
            error: err.message
          })
        }
      }

      backfillState.current = backfillState.skipped + i + 1

      // Throttle between buckets (skip after last)
      if (i < allBuckets.length - 1 && throttleMs > 0) {
        await deps.sleep(throttleMs)
      }
    }

    backfillState.status = 'completed'
    backfillState.completedAt = new Date()
    backfillState.current = backfillState.total
  } catch (err) {
    backfillState.status = 'error'
    backfillState.completedAt = new Date()
    if (backfillState.errors.length < 100) {
      backfillState.errors.push({ error: err.message })
    }
  }
}

function getBackfillState() {
  return { ...backfillState }
}

function cancelBackfill() {
  if (backfillState.status === 'running') {
    backfillState.status = 'cancelled'
  }
}

// Test helpers
function _getBackfillPromise() {
  return backfillPromise
}

function _resetState() {
  backfillState = { ...INITIAL_BACKFILL_STATE }
  backfillPromise = null
  isRunning = false
}

// ── Index Initialization ──

/**
 * Create unique indexes on the 3 Summary collections (EARS DB)
 * and CRON_RUN_LOG indexes.
 */
async function initializeRecoverySummary() {
  try {
    const earsDb = getEarsDb()

    // Summary collection indexes
    await earsDb.collection('RECOVERY_SUMMARY_BY_SCENARIO').createIndex(
      { period: 1, bucket: 1, line: 1, process: 1, model: 1, ears_code: 1 },
      { unique: true }
    )

    await earsDb.collection('RECOVERY_SUMMARY_BY_EQUIPMENT').createIndex(
      { period: 1, bucket: 1, line: 1, process: 1, model: 1, eqpid: 1 },
      { unique: true }
    )

    await earsDb.collection('RECOVERY_SUMMARY_BY_TRIGGER').createIndex(
      { period: 1, bucket: 1, line: 1, process: 1, model: 1, trigger_by: 1 },
      { unique: true }
    )

    // CRON_RUN_LOG indexes
    const CronRunLog = getCronRunLog()
    await CronRunLog.collection.createIndex(
      { jobName: 1, period: 1, bucket: 1 },
      { unique: true }
    )

    console.log('[RecoverySummary] Indexes initialized')
  } catch (err) {
    console.error('[RecoverySummary] Index initialization error:', err.message)
  }
}

// ── Cron Jobs ──

let cronTasks = []

/**
 * Start cron jobs for hourly and daily aggregation.
 * Daily cron time is offset by settlingHours.
 */
function startCronJobs() {
  const settlingHours = deps.settlingHours

  // Hourly at :05
  const hourlyTask = cron.schedule('5 * * * *', () => {
    runBatch('hourly').catch(err => console.error('[RecoverySummary] Hourly cron error:', err))
  }, { timezone: 'Asia/Seoul' })

  // Daily at settlingHours:10 KST (e.g., 03:10 for settling=3)
  const dailyCron = `10 ${settlingHours} * * *`
  const dailyTask = cron.schedule(dailyCron, () => {
    runBatch('daily').catch(err => console.error('[RecoverySummary] Daily cron error:', err))
  }, { timezone: 'Asia/Seoul' })

  cronTasks = [hourlyTask, dailyTask]
  console.log(`[RecoverySummary] Cron jobs started (hourly :05, daily ${String(settlingHours).padStart(2, '0')}:10 KST)`)
}

/**
 * Stop all scheduled cron tasks.
 */
function stopCronJobs() {
  for (const task of cronTasks) {
    task.stop()
  }
  cronTasks = []
  console.log('[RecoverySummary] Cron jobs stopped')
}

// ── Query Helpers ──

/**
 * Get the last successful (or partial) cron run for a given period.
 */
async function getLastCronRun(period) {
  const CronRunLog = getCronRunLog()
  return CronRunLog.findOne({
    jobName: 'recoverySummary',
    period,
    status: { $in: ['success', 'partial'] }
  })
    .sort({ bucket: -1 })
    .lean()
}

module.exports = {
  PIPELINE_CONFIGS,
  buildPipeline,
  runPipelinesForBucket,
  runBatch,
  detectGaps,
  runBackfillCheck,
  runManualBackfill,
  getBackfillState,
  cancelBackfill,
  getCompletedBucketSet,
  getPartialBucketSet,
  validateBackfillRange,
  initializeRecoverySummary,
  startCronJobs,
  stopCronJobs,
  getLastCronRun,
  _setDeps,
  _getBackfillPromise,
  _resetState
}
