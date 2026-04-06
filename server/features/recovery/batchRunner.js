/**
 * Recovery Summary — Batch Runner
 * Pipeline building, execution, batch orchestration, gap detection, auto-backfill
 */

const {
  computeHourlyBoundaries,
  computeDailyBoundaries,
  computeBoundariesForBucket,
  generateExpectedBuckets,
  floorToKSTBucket
} = require('./dateUtils')
const { getDeps, getEarsDb, getCronRunLog, getRedis, getPod } = require('./recoveryDeps')
const { tryAcquireLock, releaseLock } = require('../../shared/utils/redisLock')
const { createLogger } = require('../../shared/logger')
const log = createLogger('recovery')

// ── Pipeline Configuration ──

const PIPELINE_CONFIGS = {
  scenario: { collection: 'RECOVERY_SUMMARY_BY_SCENARIO', groupField: 'ears_code' },
  equipment: { collection: 'RECOVERY_SUMMARY_BY_EQUIPMENT', groupField: 'eqpid' },
  trigger: { collection: 'RECOVERY_SUMMARY_BY_TRIGGER', groupField: 'trigger_by' }
}

// ── Pipeline Builder ──

function buildPipeline(configKey, period, bucketStart, dateGte, dateLt) {
  const config = PIPELINE_CONFIGS[configKey]
  if (!config) throw new Error(`Unknown pipeline config: ${configKey}`)

  const { collection: targetCollection, groupField } = config

  const matchStage = {
    $match: {
      create_date: { $gte: dateGte, $lt: dateLt },
      status: { $ne: null }
    }
  }

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

  const unsetStage = {
    $unset: ['_id', 'status_pairs']
  }

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

async function runPipelinesForBucket(period, bucketStart, dateGte, dateLt, options = {}) {
  const { source = 'cron' } = options
  const earsDb = getEarsDb()
  const CronRunLog = getCronRunLog()
  const startedAt = new Date()
  const pipelineResults = {}
  const errors = []

  for (const [configKey] of Object.entries(PIPELINE_CONFIGS)) {
    try {
      const pipeline = buildPipeline(configKey, period, bucketStart, dateGte, dateLt)
      await earsDb.collection('EQP_AUTO_RECOVERY')
        .aggregate(pipeline, { allowDiskUse: true, maxTimeMS: 55000 })
        .toArray()

      pipelineResults[configKey] = 'success'
    } catch (err) {
      pipelineResults[configKey] = `failed: ${err.message}`
      errors.push({ configKey, error: err.message })
    }
  }

  const successCount = Object.values(pipelineResults).filter(r => r === 'success').length
  let status
  if (successCount === 3) status = 'success'
  else if (successCount === 0) status = 'failed'
  else status = 'partial'

  await CronRunLog.findOneAndUpdate(
    { jobName: 'recoverySummary', period, bucket: bucketStart },
    {
      $set: {
        status,
        source,
        startedAt,
        completedAt: new Date(),
        pipelineResults,
        errorMessage: errors.length > 0 ? errors : undefined
      },
      $unset: { docsInBucket: '' }
    },
    { upsert: true, returnDocument: 'after' }
  )

  return { status, pipelineResults, errors }
}

// ── Batch Execution ──

// NOTE: Cron과 Manual Backfill은 동시 실행될 수 있다.
// $merge의 whenMatched:'replace' 멱등성 덕분에 같은 bucket을 동시에 처리해도
// 데이터 정합성 문제가 없다.

let isRunning = false

async function runBatch(period) {
  const deps = getDeps()
  const indexManager = require('./indexManager')

  // 1. Index 확인
  if (!indexManager.isIndexReady()) {
    const rechecked = await indexManager.checkEarIndexes()
    if (!rechecked) {
      log.warn(`[RecoverySummary] Skipping ${period} batch — EQP_AUTO_RECOVERY create_date index not verified`)
      deps.createBatchLog({
        batchAction: 'cron_skipped',
        batchPeriod: period,
        batchParams: { period, reason: 'indexNotReady' },
        podId: getPod()
      }).catch(e => log.error(`[BatchLog] cron_skipped log failed: ${e?.message || e}`))
      return
    }
    log.info(`[RecoverySummary] create_date index now available — resuming ${period} batch`)
  }

  // 2. 분산 락 시도 (멀티 Pod 중복 실행 방지)
  const redis = getRedis()
  const pod = getPod()
  const lockKey = `wm:cron:lock:${period}`
  const lockResult = await tryAcquireLock(redis, lockKey, pod, 600)

  if (lockResult === false) {
    log.info(`[CronLock] ${period} lock held by another pod — skipping`)
    deps.createBatchLog({
      batchAction: 'cron_skipped',
      batchPeriod: period,
      batchParams: { period, reason: 'distributedLock' },
      podId: pod
    }).catch(e => log.error(`[BatchLog] cron_skipped log failed: ${e?.message || e}`))
    return
  }

  // 3. 인메모리 가드 (Redis 미사용 폴백 + 이중 안전)
  if (isRunning) {
    log.info(`[RecoverySummary] Skipping ${period} batch — previous run still in progress`)
    deps.createBatchLog({
      batchAction: 'cron_skipped',
      batchPeriod: period,
      batchParams: { period, reason: 'isRunning' },
      podId: pod
    }).catch(e => log.error(`[BatchLog] cron_skipped log failed: ${e?.message || e}`))
    await releaseLock(redis, lockKey, pod)
    return
  }

  isRunning = true
  let result = null

  try {
    const now = new Date()
    const boundaries = period === 'hourly'
      ? computeHourlyBoundaries(now, deps.settlingHours)
      : computeDailyBoundaries(now, deps.settlingHours)

    const { bucketStart, dateGte, dateLt } = boundaries

    log.info(`[RecoverySummary] Starting ${period} batch: ${dateGte} ~ ${dateLt}`)

    result = await runPipelinesForBucket(period, bucketStart, dateGte, dateLt, { source: 'cron' })

    log.info(`[RecoverySummary] ${period} batch completed: ${result.status}`)

    deps.createBatchLog({
      batchAction: 'cron_completed',
      batchPeriod: period,
      batchParams: { period, bucket: bucketStart.toISOString() },
      batchResult: { status: result.status, pipelineResults: result.pipelineResults },
      podId: pod
    }).catch(e => log.error(`[BatchLog] cron_completed log failed: ${e?.message || e}`))
  } catch (err) {
    log.error(`[RecoverySummary] ${period} batch fatal error: ${err?.message || err}`)
    deps.createBatchLog({
      batchAction: 'cron_failed',
      batchPeriod: period,
      batchParams: { period, error: err?.message || String(err) },
      podId: pod
    }).catch(e => log.error(`[BatchLog] cron_failed log failed: ${e?.message || e}`))
  } finally {
    await releaseLock(redis, lockKey, pod)
    isRunning = false
  }

  // 4. Auto backfill (락 밖 — idempotent, 중복 실행 무해)
  if (result && (result.status === 'success' || result.status === 'partial')) {
    try {
      await runBackfillCheck(period)
    } catch (err) {
      log.error(`[RecoverySummary] Auto-backfill error: ${err?.message || err}`)
    }
  }
}

// ── Gap Detection & Auto Backfill ──

async function detectGaps(period, opts = {}) {
  const deps = getDeps()
  const CronRunLog = getCronRunLog()
  const defaultWindow = period === 'hourly' ? 48 : 7 * 24
  const scanWindowHours = opts.scanWindowHours ?? defaultWindow

  const now = new Date()
  const rawScanEnd = new Date(now.getTime() - deps.settlingHours * 60 * 60 * 1000)
  const scanEnd = floorToKSTBucket(period, rawScanEnd)
  const scanStart = new Date(scanEnd.getTime() - scanWindowHours * 60 * 60 * 1000)

  const expected = generateExpectedBuckets(period, scanStart, scanEnd)
  if (expected.length === 0) return []

  const logs = await CronRunLog.find({
    jobName: 'recoverySummary',
    period,
    bucket: { $gte: scanStart, $lt: scanEnd },
    status: { $in: ['success', 'partial'] }
  }).select('bucket').lean()

  const completedSet = new Set(logs.map(l => l.bucket.getTime()))

  return expected.filter(b => !completedSet.has(b.getTime()))
}

async function runBackfillCheck(period) {
  const deps = getDeps()
  try {
    const gaps = await detectGaps(period)
    if (gaps.length === 0) return

    const limit = deps.autoBackfillLimit
    const toProcess = gaps.slice(0, limit)

    log.info(`[RecoverySummary] Auto-backfilling ${toProcess.length} ${period} gaps (of ${gaps.length} total)`)

    for (let i = 0; i < toProcess.length; i++) {
      const bucketDate = toProcess[i]
      const { bucketStart, dateGte, dateLt } = computeBoundariesForBucket(period, bucketDate)

      await runPipelinesForBucket(period, bucketStart, dateGte, dateLt, { source: 'autoBackfill' })

      if (i < toProcess.length - 1) {
        await deps.sleep(deps.defaultThrottleMs)
      }
    }

    deps.createBatchLog({
      batchAction: 'auto_backfill_completed',
      batchPeriod: period,
      batchParams: { period, gapsFound: gaps.length, processed: toProcess.length },
      podId: getPod()
    }).catch(e => log.error(`[BatchLog] auto_backfill_completed log failed: ${e.message}`))
  } catch (err) {
    log.error(`[RecoverySummary] Auto-backfill error: ${err.message}`)
  }
}

function _resetIsRunning() {
  isRunning = false
}

module.exports = {
  PIPELINE_CONFIGS,
  buildPipeline,
  runPipelinesForBucket,
  runBatch,
  detectGaps,
  runBackfillCheck,
  _resetIsRunning
}
