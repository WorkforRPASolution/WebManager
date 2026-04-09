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
const { tryAcquireLock } = require('../../shared/utils/redisLock')
const { createLogger } = require('../../shared/logger')
const log = createLogger('recovery')

// Cron 분산 락 TTL
// - hourly 간격(3600s), daily 간격(86400s)보다 충분히 짧음 → 다음 정상 트리거 방해 안 함
// - 배치 실행 시간 + Pod 간 clock drift를 모두 흡수
// - 실패/크래시 시에도 이 시간만큼 재시도 대기 (장애 폭주 방지)
// - releaseLock을 제거하고 TTL 자연 만료에 의존 (중복 실행의 근본 해결)
const LOCK_TTL_SEC = 300

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
  // 주의: 락은 배치 완료 후에도 release하지 않고 TTL로 자연 만료시킨다.
  // 이유: releaseLock을 호출하면 배치가 빨리 끝난 경우 락 유지 시간이 수백 ms에 불과해,
  //       다른 Pod의 cron 트리거가 clock drift로 수백 ms 늦게 오면 락이 이미 비어 있어
  //       양쪽이 같은 bucket을 중복 실행하는 race condition이 발생한다 (실제 관찰됨).
  //       TTL로 유지하면 다음 hourly 트리거(3600s)가 오기 전에는 어떤 인스턴스도 재실행 불가.
  const redis = getRedis()
  const pod = getPod()
  const lockKey = `wm:cron:lock:${period}`
  const lockResult = await tryAcquireLock(redis, lockKey, pod, LOCK_TTL_SEC)

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

  if (lockResult === null) {
    // Redis 미연결 — 분산 락이 조용히 무력화되는 사일런트 버그 방지용 경고.
    // 인메모리 isRunning 폴백만 작동하므로 멀티 인스턴스 안전성 상실.
    log.warn(`[CronLock] ${period} distributed lock DISABLED — Redis unavailable, multi-instance safety lost`)
  }

  // 3. 인메모리 가드 (Redis 미사용 폴백 + 이중 안전)
  // Redis가 정상이면 위의 lockResult === false 분기에서 이미 차단되므로 이 블록은 사실상
  // Redis 미연결 시에만 의미가 있다. release도 하지 않음 (애초에 락 상태가 불분명).
  if (isRunning) {
    log.info(`[RecoverySummary] Skipping ${period} batch — previous run still in progress`)
    deps.createBatchLog({
      batchAction: 'cron_skipped',
      batchPeriod: period,
      batchParams: { period, reason: 'isRunning' },
      podId: pod
    }).catch(e => log.error(`[BatchLog] cron_skipped log failed: ${e?.message || e}`))
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

    // 4. CronRunLog 사전 체크 — 이미 성공/부분성공한 bucket이면 skip (이중 방어).
    //    분산 락이 어떤 이유로 뚫려도 같은 bucket이 재실행되는 것을 막는다.
    //    failed 상태는 재시도 대상이므로 여기서 걸리지 않음.
    const existing = await getCronRunLog().findOne({
      jobName: 'recoverySummary',
      period,
      bucket: bucketStart,
      status: { $in: ['success', 'partial'] }
    }).lean()

    if (existing) {
      log.info(`[RecoverySummary] ${period} ${bucketStart.toISOString()} already completed by ${existing.source} (${existing.completedAt?.toISOString?.() || existing.completedAt}) — skipping`)
      deps.createBatchLog({
        batchAction: 'cron_skipped',
        batchPeriod: period,
        batchParams: { period, bucket: bucketStart.toISOString(), reason: 'alreadyCompleted' },
        podId: pod
      }).catch(e => log.error(`[BatchLog] cron_skipped log failed: ${e?.message || e}`))
      return
    }

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
    // 락은 TTL로 자연 만료시킨다 (위 주석 참조). releaseLock 호출하지 않음.
    isRunning = false
  }

  // 4. Auto backfill (락 밖 — idempotent, 중복 실행 무해)
  // runBackfillCheck는 내부 try/catch로 모든 에러를 흡수하므로 외부 catch 불필요
  if (result && (result.status === 'success' || result.status === 'partial')) {
    await runBackfillCheck(period)
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
