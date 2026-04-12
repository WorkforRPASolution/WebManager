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
  trigger: { collection: 'RECOVERY_SUMMARY_BY_TRIGGER', groupField: 'trigger_by' },
  category: { collection: 'RECOVERY_SUMMARY_BY_CATEGORY', groupField: 'scCategory', needsLookup: true }
}

// ── Pipeline-Aware Helpers ──

function getPipelineKeys() {
  return Object.keys(PIPELINE_CONFIGS)
}

/**
 * pipelineResults에서 누락/실패 파이프라인 키 목록 반환.
 * @param {Object|Map|null} pipelineResults - CRON_RUN_LOG의 pipelineResults
 * @param {string[]} requiredKeys - 현재 PIPELINE_CONFIGS 키 목록
 * @returns {string[]} 실행이 필요한 키 목록
 */
function getMissingOrFailedPipelines(pipelineResults, requiredKeys) {
  if (!pipelineResults) return [...requiredKeys]
  const entries = pipelineResults instanceof Map
    ? Object.fromEntries(pipelineResults)
    : pipelineResults
  return requiredKeys.filter(k => !entries[k] || entries[k] !== 'success')
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

/**
 * Category 전용 파이프라인.
 * scCategory는 EQP_AUTO_RECOVERY에 없으므로 SC_PROPERTY에서 $lookup으로 가져온다.
 */
function buildCategoryPipeline(period, bucketStart, dateGte, dateLt) {
  const targetCollection = PIPELINE_CONFIGS.category.collection

  return [
    // 1. $match — create_date 범위 + status not null (기존과 동일)
    { $match: { create_date: { $gte: dateGte, $lt: dateLt }, status: { $ne: null } } },

    // 2. $lookup SC_PROPERTY (같은 EARS DB, scname 인덱스 활용)
    { $lookup: {
      from: 'SC_PROPERTY',
      localField: 'ears_code',
      foreignField: 'scname',
      as: '_scProp'
    } },

    // 3. scCategory 추출 (첫 번째 매치, null/미매칭이면 -1 = Uncategorized)
    { $addFields: {
      scCategory: { $ifNull: [{ $arrayElemAt: ['$_scProp.scCategory', 0] }, -1] }
    } },
    { $unset: '_scProp' },

    // 4. 1차 $group (line, process, model, scCategory, status → count)
    { $group: {
      _id: {
        line: '$line', process: '$process', model: '$model',
        scCategory: '$scCategory', status: '$status'
      },
      count: { $sum: 1 }
    } },

    // 5. 2차 $group → status_counts 합산
    { $group: {
      _id: {
        line: '$_id.line', process: '$_id.process', model: '$_id.model',
        scCategory: '$_id.scCategory'
      },
      total: { $sum: '$count' },
      status_pairs: { $push: { k: '$_id.status', v: '$count' } }
    } },

    // 6. $addFields — period, bucket, status_counts 변환
    { $addFields: {
      period,
      bucket: bucketStart,
      line: '$_id.line',
      process: '$_id.process',
      model: '$_id.model',
      scCategory: '$_id.scCategory',
      status_counts: { $arrayToObject: '$status_pairs' },
      updated_at: '$$NOW'
    } },
    { $unset: ['_id', 'status_pairs'] },

    // 7. $merge
    { $merge: {
      into: targetCollection,
      on: ['period', 'bucket', 'line', 'process', 'model', 'scCategory'],
      whenMatched: 'replace',
      whenNotMatched: 'insert'
    } }
  ]
}

// ── Core Pipeline Execution ──

async function runPipelinesForBucket(period, bucketStart, dateGte, dateLt, options = {}) {
  const { source = 'cron', pipelineKeys = null } = options
  const earsDb = getEarsDb()
  const CronRunLog = getCronRunLog()
  const startedAt = new Date()
  const pipelineResults = {}
  const errors = []

  // 선택 실행: pipelineKeys가 지정되면 해당 키만 실행
  const targetConfigs = pipelineKeys
    ? Object.entries(PIPELINE_CONFIGS).filter(([key]) => pipelineKeys.includes(key))
    : Object.entries(PIPELINE_CONFIGS)

  for (const [configKey, config] of targetConfigs) {
    try {
      const pipeline = config.needsLookup
        ? buildCategoryPipeline(period, bucketStart, dateGte, dateLt)
        : buildPipeline(configKey, period, bucketStart, dateGte, dateLt)
      await earsDb.collection('EQP_AUTO_RECOVERY')
        .aggregate(pipeline, { allowDiskUse: true, maxTimeMS: 55000 })
        .toArray()

      pipelineResults[configKey] = 'success'
    } catch (err) {
      pipelineResults[configKey] = `failed: ${err.message}`
      errors.push({ configKey, error: err.message })
    }
  }

  const isSelective = pipelineKeys !== null
  const filter = { jobName: 'recoverySummary', period, bucket: bucketStart }

  if (isSelective) {
    // 선택 실행: dot notation으로 개별 키만 머지 (기존 성공 키 보존)
    const $set = { source, startedAt, completedAt: new Date() }
    for (const [key, value] of Object.entries(pipelineResults)) {
      $set[`pipelineResults.${key}`] = value
    }
    const updateOp = { $set, $unset: { docsInBucket: '' } }
    if (errors.length > 0) {
      updateOp.$push = { errorMessage: { $each: errors } }
    }
    const updatedDoc = await CronRunLog.findOneAndUpdate(filter, updateOp, { upsert: true, returnDocument: 'after' })

    // 머지된 전체 pipelineResults에서 status 재계산
    const allKeys = Object.keys(PIPELINE_CONFIGS)
    const mergedPR = updatedDoc?.pipelineResults instanceof Map
      ? Object.fromEntries(updatedDoc.pipelineResults)
      : updatedDoc?.pipelineResults || pipelineResults
    const totalSuccess = allKeys.filter(k => mergedPR[k] === 'success').length
    let status
    if (totalSuccess === allKeys.length) status = 'success'
    else if (totalSuccess === 0) status = 'failed'
    else status = 'partial'

    // status 갱신
    await CronRunLog.findOneAndUpdate(filter, { $set: { status } })

    return { status, pipelineResults: mergedPR, errors }
  }

  // 전체 실행: 기존 로직
  const totalPipelines = Object.keys(PIPELINE_CONFIGS).length
  const successCount = Object.values(pipelineResults).filter(r => r === 'success').length
  let status
  if (successCount === totalPipelines) status = 'success'
  else if (successCount === 0) status = 'failed'
  else status = 'partial'

  await CronRunLog.findOneAndUpdate(
    filter,
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

    // 4. CronRunLog 사전 체크 — 이미 모든 파이프라인이 성공한 bucket이면 skip (이중 방어).
    //    분산 락이 어떤 이유로 뚫려도 같은 bucket이 재실행되는 것을 막는다.
    //    failed 상태 또는 파이프라인 키 누락은 재시도 대상.
    const existing = await getCronRunLog().findOne({
      jobName: 'recoverySummary',
      period,
      bucket: bucketStart,
      status: { $in: ['success', 'partial'] }
    }).select('status source completedAt pipelineResults').lean()

    if (existing) {
      const requiredKeys = Object.keys(PIPELINE_CONFIGS)
      const pr = existing.pipelineResults instanceof Map
        ? Object.fromEntries(existing.pipelineResults)
        : existing.pipelineResults
      const allComplete = requiredKeys.every(k => pr && pr[k] === 'success')
      if (!allComplete) {
        const missing = requiredKeys.filter(k => !pr || pr[k] !== 'success')
        log.info(`[RecoverySummary] ${period} ${bucketStart.toISOString()} incomplete (${missing.join(', ')}) — re-running`)
      } else {
        log.info(`[RecoverySummary] ${period} ${bucketStart.toISOString()} already completed by ${existing.source} (${existing.completedAt?.toISOString?.() || existing.completedAt}) — skipping`)
        deps.createBatchLog({
          batchAction: 'cron_skipped',
          batchPeriod: period,
          batchParams: { period, bucket: bucketStart.toISOString(), reason: 'alreadyCompleted' },
          podId: pod
        }).catch(e => log.error(`[BatchLog] cron_skipped log failed: ${e?.message || e}`))
        return
      }
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
  const requiredKeys = Object.keys(PIPELINE_CONFIGS)
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
  }).select('bucket pipelineResults').lean()

  // Pipeline-aware: only consider a bucket complete if ALL current pipeline keys are success
  const completedSet = new Set()
  for (const log of logs) {
    const pr = log.pipelineResults instanceof Map
      ? Object.fromEntries(log.pipelineResults)
      : log.pipelineResults
    const allComplete = requiredKeys.every(k => pr && pr[k] === 'success')
    if (allComplete) {
      completedSet.add(log.bucket.getTime())
    }
  }

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
  getPipelineKeys,
  getMissingOrFailedPipelines,
  buildPipeline,
  buildCategoryPipeline,
  runPipelinesForBucket,
  runBatch,
  detectGaps,
  runBackfillCheck,
  _resetIsRunning
}
