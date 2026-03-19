/**
 * Recovery Summary — Manual Backfill Manager
 */

const {
  computeBoundariesForBucket,
  generateExpectedBuckets
} = require('./dateUtils')
const { getDeps, getCronRunLog } = require('./recoveryDeps')
const { runPipelinesForBucket } = require('./batchRunner')

// ── Manual Backfill State ──

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

async function getCompletedBucketSet(period, startDate, endDate, { retryPartial = false } = {}) {
  const CronRunLog = getCronRunLog()
  const statusFilter = retryPartial ? ['success'] : ['success', 'partial']
  const logs = await CronRunLog.find({
    jobName: 'recoverySummary',
    period,
    bucket: { $gte: startDate, $lt: endDate },
    status: { $in: statusFilter }
  }).select('bucket').lean()
  return new Set(logs.map(l => l.bucket.getTime()))
}

async function getPartialBucketSet(period, startDate, endDate) {
  const CronRunLog = getCronRunLog()
  const logs = await CronRunLog.find({
    jobName: 'recoverySummary',
    period,
    bucket: { $gte: startDate, $lt: endDate },
    status: 'partial'
  }).select('bucket').lean()
  return new Set(logs.map(l => l.bucket.getTime()))
}

async function runManualBackfill(startDate, endDate, options = {}) {
  const deps = getDeps()
  const indexManager = require('./indexManager')

  if (!indexManager.isIndexReady()) {
    throw new Error('EQP_AUTO_RECOVERY create_date index not verified. Backfill disabled.')
  }

  if (backfillState.status === 'running') {
    throw new Error('Backfill already in progress')
  }

  const { skipHourly = false, skipDaily = false, throttleMs = deps.defaultThrottleMs, retryPartial = false } = options

  const maxEnd = new Date(Date.now() - deps.settlingHours * 60 * 60 * 1000)
  const clampedEnd = new Date(Math.min(new Date(endDate).getTime(), maxEnd.getTime()))
  const start = new Date(startDate)

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

  const periods = []
  if (!skipHourly) periods.push('hourly')
  if (!skipDaily) periods.push('daily')

  backfillPromise = processBackfill(periods, start, clampedEnd, throttleMs, { retryPartial })
}

async function processBackfill(periods, startDate, endDate, throttleMs, { retryPartial = false } = {}) {
  const deps = getDeps()
  try {
    let allBuckets = []
    for (const period of periods) {
      const expected = generateExpectedBuckets(period, startDate, endDate)

      if (retryPartial) {
        const partialSet = await getPartialBucketSet(period, startDate, endDate)
        for (const bucket of expected) {
          if (partialSet.has(bucket.getTime())) {
            allBuckets.push({ period, bucket })
          } else {
            backfillState.skipped++
          }
        }
      } else {
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

      if (i < allBuckets.length - 1 && throttleMs > 0) {
        await deps.sleep(throttleMs)
      }
    }

    backfillState.status = backfillState.errors.length > 0 ? 'completed_with_warnings' : 'completed'
    backfillState.completedAt = new Date()
    backfillState.current = backfillState.total

    const durationMs = backfillState.completedAt.getTime() - backfillState.startedAt.getTime()
    deps.createBatchLog({
      batchAction: 'backfill_completed',
      batchResult: {
        status: backfillState.status,
        total: backfillState.total,
        processed: backfillState.current - backfillState.skipped,
        skipped: backfillState.skipped,
        errorCount: backfillState.errors.length,
        durationMs
      }
    }).catch(e => console.error('[BatchLog] backfill_completed log failed:', e))
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

function _getBackfillPromise() {
  return backfillPromise
}

function _resetBackfill() {
  backfillState = { ...INITIAL_BACKFILL_STATE }
  backfillPromise = null
}

module.exports = {
  getCompletedBucketSet,
  getPartialBucketSet,
  runManualBackfill,
  getBackfillState,
  cancelBackfill,
  _getBackfillPromise,
  _resetBackfill
}
