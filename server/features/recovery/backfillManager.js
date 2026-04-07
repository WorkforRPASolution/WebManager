/**
 * Recovery Summary — Manual Backfill Manager
 */

const {
  computeBoundariesForBucket,
  generateExpectedBuckets
} = require('./dateUtils')
const { getDeps, getCronRunLog, getRedis, getPod } = require('./recoveryDeps')
const { runPipelinesForBucket } = require('./batchRunner')
const { releaseLock } = require('../../shared/utils/redisLock')
const { createLogger } = require('../../shared/logger')
const log = createLogger('recovery')

const BACKFILL_OWNER_KEY = 'wm:backfill:owner'
const BACKFILL_CANCEL_KEY = 'wm:backfill:cancel'
const BACKFILL_OWNER_TTL = 600 // 10분, 5초마다 갱신 (aggregate maxTimeMS 55초 대응)

// Lua compare-and-expire: 자기 소유 락만 TTL 갱신 (다른 Pod의 락 TTL 연장 방지)
const EXPIRE_IF_OWNER_LUA = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('expire',KEYS[1],ARGV[2]) else return 0 end"

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

  // 교차 Pod 중복 방지: Redis owner key 확인
  const redis = getRedis()
  if (redis) {
    try {
      const setResult = await redis.set(BACKFILL_OWNER_KEY, getPod(), 'NX', 'EX', BACKFILL_OWNER_TTL)
      if (setResult !== 'OK') {
        const owner = await redis.get(BACKFILL_OWNER_KEY)
        throw new Error(`Backfill already running on pod ${owner ?? 'unknown'}`)
      }
      // M8: 진입 시 stale cancel key 정리 (이전 backfill의 잔존 신호 false-positive 방지)
      try { await redis.del(BACKFILL_CANCEL_KEY) } catch (_) { /* ignore */ }
    } catch (err) {
      if (err.message.startsWith('Backfill already running')) throw err
      log.warn(`[Backfill] Redis owner check failed: ${err?.message || err}`)
    }
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
  const redis = getRedis()
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

    let lastRefreshTime = Date.now()

    for (let i = 0; i < allBuckets.length; i++) {
      // 로컬 취소 확인
      if (backfillState.status === 'cancelled') {
        return
      }

      // 교차 Pod 취소 확인 + owner TTL 갱신 (5초 간격)
      if (redis && Date.now() - lastRefreshTime > 5000) {
        try {
          const cancelFlag = await redis.get(BACKFILL_CANCEL_KEY)
          if (cancelFlag) {
            log.info('[Backfill] Cancel requested from another pod')
            backfillState.status = 'cancelled'
            await redis.del(BACKFILL_CANCEL_KEY)
            return
          }
          // Lua compare-and-expire: 자기 소유일 때만 TTL 갱신
          const extended = await redis.eval(EXPIRE_IF_OWNER_LUA, 1, BACKFILL_OWNER_KEY, getPod(), BACKFILL_OWNER_TTL)
          if (extended === 0) {
            // 락 잃음 (TTL 만료 → 다른 Pod이 잡음) — 즉시 중단
            log.warn('[Backfill] Lost ownership of backfill lock, aborting')
            backfillState.status = 'cancelled'
            return
          }
        } catch (err) {
          log.warn(`[Backfill] Redis refresh error: ${err?.message || err}`)
        }
        lastRefreshTime = Date.now()
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
      },
      podId: getPod()
    }).catch(e => log.error(`[BatchLog] backfill_completed log failed: ${e?.message || e}`))
  } catch (err) {
    backfillState.status = 'error'
    backfillState.completedAt = new Date()
    if (backfillState.errors.length < 100) {
      backfillState.errors.push({ error: err?.message || String(err) })
    }
  } finally {
    // owner key 정리를 backfillPromise null 처리 *전*에 수행 → getBackfillState race window 축소
    // CANCEL_KEY는 의도적으로 건드리지 않음:
    // - 자연 만료 (TTL 600s) 또는 line 160의 감지 시 del로 처리
    // - finally에서 무조건 del하면 cross-pod에서 새로운 cancel 신호를 race로 파괴할 수 있음
    if (redis) {
      try {
        await releaseLock(redis, BACKFILL_OWNER_KEY, getPod())
      } catch (e) {
        log.warn(`[Backfill] Owner key cleanup failed: ${e?.message || e}`)
      }
    }
    backfillPromise = null
  }
}

async function getBackfillState() {
  // 이 Pod에서 실행 중이면 로컬 상태 반환
  if (backfillPromise) {
    return { ...backfillState }
  }
  // 다른 Pod에서 실행 중인지 Redis 확인
  const redis = getRedis()
  if (redis) {
    try {
      const owner = await redis.get(BACKFILL_OWNER_KEY)
      // 자기 자신이 owner인 경우는 로컬 상태 반환 (finally에서 release 직전 race window 보호)
      if (owner && owner !== getPod()) {
        return { status: 'running_on_other_pod', ownerPod: owner }
      }
    } catch (err) {
      log.warn(`[Backfill] Redis state check failed: ${err?.message || err}`)
    }
  }
  return { ...backfillState }
}

async function cancelBackfill() {
  // 이 Pod에서 실행 중이면 로컬 취소
  if (backfillState.status === 'running') {
    backfillState.status = 'cancelled'
    // M7: stale cancel key 정리 (다른 사용자가 이전 cancel 요청을 남겼을 수 있음)
    const redis = getRedis()
    if (redis) {
      try { await redis.del(BACKFILL_CANCEL_KEY) } catch (_) { /* ignore */ }
    }
    return
  }
  // 다른 Pod에서 실행 중이면 Redis cancel key 설정
  const redis = getRedis()
  if (redis) {
    try {
      const owner = await redis.get(BACKFILL_OWNER_KEY)
      if (owner && owner !== getPod()) {
        await redis.set(BACKFILL_CANCEL_KEY, '1', 'EX', BACKFILL_OWNER_TTL)
        log.info(`[Backfill] Cancel requested for pod ${owner}`)
        return
      }
    } catch (err) {
      log.warn(`[Backfill] Redis cancel failed: ${err?.message || err}`)
    }
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
