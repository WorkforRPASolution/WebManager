/**
 * I11: Recovery 분산 락 통합 테스트
 *
 * 회귀 방지: batchRunner.runBatch / backfillManager.runManualBackfill의
 * tryAcquireLock + owner key 경로는 기존 단위 테스트에서 redis가 mock되지
 * 않아 노출되지 않은 상태였다. 본 파일은 멀티 Pod 환경의 분산 락 동작
 * (락 획득/실패/해제, 소유자 검증, cross-pod 가시성)을 명시적으로 검증한다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  runBatch,
  runManualBackfill,
  getBackfillState,
  cancelBackfill,
  _setDeps,
  _getBackfillPromise,
  _resetState,
  _setIndexReady
} from './recoverySummaryService.js'

// ── helpers ──

function createMockRedis(overrides = {}) {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    eval: vi.fn().mockResolvedValue(1),
    ...overrides
  }
}

function createMockEarsDb() {
  const collection = {
    aggregate: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    countDocuments: vi.fn().mockResolvedValue(0),
    createIndex: vi.fn().mockResolvedValue('ok')
  }
  return {
    collection: vi.fn().mockReturnValue(collection),
    _collection: collection
  }
}

function createMockCronRunLog() {
  const MockModel = vi.fn(function (data) { Object.assign(this, data); this.save = vi.fn().mockResolvedValue({}) })
  // findOne supports both `.lean()` and `.sort().lean()` chains
  MockModel.findOne = vi.fn().mockReturnValue({
    sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    lean: vi.fn().mockResolvedValue(null)
  })
  MockModel.findOneAndUpdate = vi.fn().mockResolvedValue({})
  MockModel.find = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) })
  })
  MockModel.collection = { createIndex: vi.fn().mockResolvedValue('ok') }
  return MockModel
}

function setupDeps({
  redis = createMockRedis(),
  pod = 'pod-test-1',
  createBatchLog = vi.fn().mockResolvedValue({})
} = {}) {
  const earsDb = createMockEarsDb()
  const CronRunLog = createMockCronRunLog()
  _setDeps({
    earsDb,
    CronRunLog,
    settlingHours: 0,
    autoBackfillLimit: 0,
    defaultThrottleMs: 0,
    sleep: () => Promise.resolve(),
    createBatchLog,
    getRedisClient: () => redis,
    isRedisAvailable: () => redis !== null,
    getPodId: () => pod
  })
  return { redis, pod, earsDb, CronRunLog, createBatchLog }
}

// ────────────────────────────────────────────────────────────────────
// Section A: batchRunner.runBatch — 분산 락 (cron)
// ────────────────────────────────────────────────────────────────────

describe('batchRunner.runBatch — 분산 락 (I11)', () => {
  beforeEach(() => {
    _resetState()
    _setIndexReady(true)
  })

  it('락 획득 성공 → 배치 실행 + 락은 TTL로 유지 (releaseLock 호출 없음)', async () => {
    const { redis, pod, earsDb, CronRunLog } = setupDeps()

    await runBatch('hourly')

    // 락 획득 호출 (SET wm:cron:lock:hourly NX EX 300) — TTL 600 → 300으로 단축
    expect(redis.set).toHaveBeenCalledWith('wm:cron:lock:hourly', pod, 'NX', 'EX', 300)
    // 배치 실행 (4개 파이프라인 aggregate: scenario, equipment, trigger, category)
    expect(earsDb._collection.aggregate).toHaveBeenCalledTimes(4)
    // CronRunLog 업데이트 호출 (runPipelinesForBucket 내부)
    expect(CronRunLog.findOneAndUpdate).toHaveBeenCalled()
    // ★ 락 해제 호출 없음 — TTL로 자연 만료하여 clock drift 흡수
    expect(redis.eval).not.toHaveBeenCalled()
  })

  it('락 미획득 (다른 Pod 보유) → cron_skipped distributedLock 로그 + 배치 미실행', async () => {
    const redis = createMockRedis({ set: vi.fn().mockResolvedValue(null) }) // NX 실패
    const { earsDb, CronRunLog, createBatchLog } = setupDeps({ redis })

    await runBatch('hourly')

    // 배치 실행 안 됨
    expect(earsDb._collection.aggregate).not.toHaveBeenCalled()
    expect(CronRunLog.findOneAndUpdate).not.toHaveBeenCalled()
    // cron_skipped 로그 'distributedLock' 이유
    const skippedCall = createBatchLog.mock.calls.find(c => c[0]?.batchAction === 'cron_skipped')
    expect(skippedCall).toBeDefined()
    expect(skippedCall[0].batchParams.reason).toBe('distributedLock')
    expect(skippedCall[0].batchPeriod).toBe('hourly')
    // 락 해제 시도 안 함 (락 획득 안 했으므로)
    expect(redis.eval).not.toHaveBeenCalled()
  })

  it('Redis null (unavailable) → 인메모리 isRunning 폴백 + 정상 배치 실행', async () => {
    // tryAcquireLock(null, ...) → null 반환 → if (lockResult === false) 분기 미진입 → 정상 진행
    const earsDb = createMockEarsDb()
    const CronRunLog = createMockCronRunLog()
    const createBatchLog = vi.fn().mockResolvedValue({})
    _setDeps({
      earsDb,
      CronRunLog,
      settlingHours: 0,
      autoBackfillLimit: 0,
      defaultThrottleMs: 0,
      sleep: () => Promise.resolve(),
      createBatchLog,
      getRedisClient: () => null,
      isRedisAvailable: () => false,
      getPodId: () => 'pod-noredis'
    })

    await runBatch('hourly')

    // 배치 정상 실행 (4개 파이프라인)
    expect(earsDb._collection.aggregate).toHaveBeenCalledTimes(4)
    expect(CronRunLog.findOneAndUpdate).toHaveBeenCalled()
    // cron_completed 로그 발생
    const completed = createBatchLog.mock.calls.find(c => c[0]?.batchAction === 'cron_completed')
    expect(completed).toBeDefined()
  })

  it('배치 실행 중 fatal error → 락은 TTL로 유지 (release 호출 없음, 재시도까지 5분 대기)', async () => {
    const redis = createMockRedis()
    setupDeps({ redis })
    // findOneAndUpdate가 throw하도록 → fatal catch 진입
    const deps = require('./recoveryDeps').getDeps()
    deps.CronRunLog.findOneAndUpdate.mockRejectedValue(new Error('DB lost'))

    await runBatch('hourly')

    // ★ 락 해제 호출 없음 — 실패 시에도 TTL 만료까지 재시도 방지 (장애 폭주 방지)
    expect(redis.eval).not.toHaveBeenCalled()
    // 락은 정상적으로 획득됐어야 함 (TTL 300s)
    expect(redis.set).toHaveBeenCalledWith('wm:cron:lock:hourly', 'pod-test-1', 'NX', 'EX', 300)
  })

  it('락 획득 + 인메모리 isRunning true → cron_skipped isRunning (release 호출 없음)', async () => {
    // mock redis.set이 항상 'OK' 반환하는 특성상, 두 호출 모두 락을 획득하는 것으로 보임.
    // 실제 Redis에서는 두 번째 호출이 lockResult === false로 distributedLock skip 경로에 걸림.
    // 이 테스트는 인메모리 폴백(isRunning) 경로 자체를 검증하기 위한 것.
    const redis = createMockRedis()
    const { earsDb, createBatchLog } = setupDeps({ redis })

    // 느린 aggregate로 첫 번째 runBatch가 진행 중이도록
    earsDb._collection.aggregate.mockReturnValue({
      toArray: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 80)))
    })

    const run1 = runBatch('hourly')
    // 잠시 후 두 번째 시도 (run1이 isRunning=true 상태)
    await new Promise(r => setTimeout(r, 10))
    const run2 = runBatch('hourly')

    await Promise.all([run1, run2])

    // 둘 중 하나는 isRunning skip 발생
    const isRunningSkip = createBatchLog.mock.calls.find(
      c => c[0]?.batchAction === 'cron_skipped' && c[0]?.batchParams?.reason === 'isRunning'
    )
    expect(isRunningSkip).toBeDefined()
    // ★ 락 해제 호출 없음 — TTL로 자연 만료
    expect(redis.eval).not.toHaveBeenCalled()
  })

  it('다른 period(hourly/daily)는 별도 락 키 사용', async () => {
    const { redis } = setupDeps()

    await runBatch('hourly')
    await runBatch('daily')

    // 두 개의 다른 락 키
    const lockKeys = redis.set.mock.calls.map(c => c[0]).filter(k => k.startsWith('wm:cron:lock:'))
    expect(lockKeys).toContain('wm:cron:lock:hourly')
    expect(lockKeys).toContain('wm:cron:lock:daily')
  })

  // ── 신규: CronRunLog 사전 체크 (이중 방어) ──

  it('CronRunLog에 이미 성공한 bucket 존재 → cron_skipped alreadyCompleted + 배치 미실행', async () => {
    const { redis, earsDb, CronRunLog, createBatchLog } = setupDeps()

    // 동일 bucket에 대해 이미 success 상태의 CronRunLog가 존재
    const existingLog = {
      bucket: new Date(),
      period: 'hourly',
      status: 'success',
      source: 'cron',
      completedAt: new Date()
    }
    CronRunLog.findOne = vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingLog),
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(existingLog) })
    })

    await runBatch('hourly')

    // 락은 획득함 (SET NX EX 300)
    expect(redis.set).toHaveBeenCalledWith('wm:cron:lock:hourly', expect.any(String), 'NX', 'EX', 300)
    // ★ aggregate는 실행 안 됨 — 이미 성공한 bucket이므로 skip
    expect(earsDb._collection.aggregate).not.toHaveBeenCalled()
    // ★ CronRunLog upsert도 호출 안 됨 (runPipelinesForBucket 진입 안 함)
    expect(CronRunLog.findOneAndUpdate).not.toHaveBeenCalled()

    // cron_skipped 'alreadyCompleted' 로그
    const skippedCall = createBatchLog.mock.calls.find(
      c => c[0]?.batchAction === 'cron_skipped' && c[0]?.batchParams?.reason === 'alreadyCompleted'
    )
    expect(skippedCall).toBeDefined()
    expect(skippedCall[0].batchPeriod).toBe('hourly')
    // 락은 TTL로 유지 — release 호출 없음
    expect(redis.eval).not.toHaveBeenCalled()
  })

  it('CronRunLog에 partial 상태 bucket 존재 → cron_skipped alreadyCompleted', async () => {
    const { earsDb, CronRunLog, createBatchLog } = setupDeps()

    // partial 상태도 '이미 실행됨'으로 간주
    const existingLog = {
      bucket: new Date(),
      period: 'hourly',
      status: 'partial',
      source: 'autoBackfill',
      completedAt: new Date()
    }
    CronRunLog.findOne = vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingLog),
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(existingLog) })
    })

    await runBatch('hourly')

    expect(earsDb._collection.aggregate).not.toHaveBeenCalled()
    const skippedCall = createBatchLog.mock.calls.find(
      c => c[0]?.batchAction === 'cron_skipped' && c[0]?.batchParams?.reason === 'alreadyCompleted'
    )
    expect(skippedCall).toBeDefined()
  })

  it('CronRunLog에 failed 상태 bucket 존재 → 재실행 진행 (failed는 재시도 대상)', async () => {
    const { earsDb, CronRunLog } = setupDeps()

    // failed 상태는 재시도되어야 함 → findOne이 null 반환 (failed는 {success, partial}에 포함 안 됨)
    // 기본 mock이 null 반환하므로 추가 설정 불필요하지만, 명시성을 위해:
    CronRunLog.findOne = vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    })

    await runBatch('hourly')

    // 배치 정상 실행 (4개 파이프라인)
    expect(earsDb._collection.aggregate).toHaveBeenCalledTimes(4)
  })
})

// ────────────────────────────────────────────────────────────────────
// Section B: backfillManager — owner key (cross-pod backfill)
// ────────────────────────────────────────────────────────────────────

describe('backfillManager — owner key (I11)', () => {
  beforeEach(() => {
    _resetState()
    _setIndexReady(true)
  })

  afterEach(async () => {
    // 진행 중인 backfillPromise 정리 (다른 테스트 영향 방지)
    const promise = _getBackfillPromise()
    if (promise) await promise.catch(() => {})
    _resetState()
  })

  it('runManualBackfill 시작 → owner key SET NX EX 호출', async () => {
    const { redis, pod } = setupDeps()

    const start = new Date('2026-04-01T00:00:00.000Z')
    const end = new Date('2026-04-01T01:00:00.000Z')
    await runManualBackfill(start, end, { skipDaily: true })

    // 시작 시 owner key SET NX EX
    const ownerSetCall = redis.set.mock.calls.find(c => c[0] === 'wm:backfill:owner')
    expect(ownerSetCall).toBeDefined()
    expect(ownerSetCall[1]).toBe(pod)
    expect(ownerSetCall[2]).toBe('NX')
    expect(ownerSetCall[3]).toBe('EX')
    expect(ownerSetCall[4]).toBe(600)

    const promise = _getBackfillPromise()
    if (promise) await promise
  })

  it('runManualBackfill — 다른 Pod 락 보유 시 throw', async () => {
    const redis = createMockRedis({
      set: vi.fn().mockResolvedValue(null), // NX 실패
      get: vi.fn().mockResolvedValue('pod-other')
    })
    setupDeps({ redis })

    const start = new Date('2026-04-01T00:00:00.000Z')
    const end = new Date('2026-04-01T01:00:00.000Z')

    await expect(runManualBackfill(start, end, { skipDaily: true }))
      .rejects.toThrow(/Backfill already running on pod pod-other/)
  })

  it('runManualBackfill 완료 → finally에서 releaseLock(owner) Lua eval 호출', async () => {
    const { redis, pod } = setupDeps()

    const start = new Date('2026-04-01T00:00:00.000Z')
    const end = new Date('2026-04-01T01:00:00.000Z')
    await runManualBackfill(start, end, { skipDaily: true })

    const promise = _getBackfillPromise()
    if (promise) await promise

    // 종료 시 Lua compare-and-delete (owner 기반)
    const releaseCall = redis.eval.mock.calls.find(
      c => c[1] === 1 && c[2] === 'wm:backfill:owner' && c[3] === pod
    )
    expect(releaseCall).toBeDefined()
    // 첫 번째 인자는 Lua 스크립트
    expect(releaseCall[0]).toContain("redis.call('del'")
  })

  it('getBackfillState — 다른 Pod에서 실행 중이면 running_on_other_pod 반환', async () => {
    const redis = createMockRedis({
      get: vi.fn().mockResolvedValue('pod-other-99')
    })
    setupDeps({ redis })
    // 로컬 backfillPromise는 없음 → Redis 조회 경로

    const state = await getBackfillState()

    expect(state.status).toBe('running_on_other_pod')
    expect(state.ownerPod).toBe('pod-other-99')
    expect(redis.get).toHaveBeenCalledWith('wm:backfill:owner')
  })

  it('getBackfillState — Redis owner 없음 + 로컬 promise 없음 → idle 반환', async () => {
    const redis = createMockRedis({ get: vi.fn().mockResolvedValue(null) })
    setupDeps({ redis })

    const state = await getBackfillState()

    expect(state.status).toBe('idle')
  })

  it('cancelBackfill — 다른 Pod 실행 중 → BACKFILL_CANCEL_KEY 설정', async () => {
    const redis = createMockRedis({
      get: vi.fn().mockResolvedValue('pod-other-99')
    })
    setupDeps({ redis })

    await cancelBackfill()

    // cancel key 설정 호출
    const cancelSetCall = redis.set.mock.calls.find(c => c[0] === 'wm:backfill:cancel')
    expect(cancelSetCall).toBeDefined()
    expect(cancelSetCall[1]).toBe('1')
    expect(cancelSetCall[2]).toBe('EX')
  })

  it('cancelBackfill — 로컬 실행 중 → 로컬 status=cancelled (Redis 호출 없음)', async () => {
    const { redis } = setupDeps()

    // 로컬 실행 시작
    const start = new Date('2026-04-01T00:00:00.000Z')
    const end = new Date('2026-04-01T01:00:00.000Z')
    await runManualBackfill(start, end, { skipDaily: true })

    // 즉시 취소 (로컬 backfillState.status='running')
    await cancelBackfill()

    // backfillState.status가 cancelled로 전환
    // (로컬 분기에서 즉시 return — Redis cancel key 안 만짐)
    const cancelSetCall = redis.set.mock.calls.find(c => c[0] === 'wm:backfill:cancel')
    expect(cancelSetCall).toBeUndefined()

    const promise = _getBackfillPromise()
    if (promise) await promise.catch(() => {})
  })

  it('Redis null — owner key 우회, 로컬만으로 backfill 진행', async () => {
    const earsDb = createMockEarsDb()
    const CronRunLog = createMockCronRunLog()
    _setDeps({
      earsDb,
      CronRunLog,
      settlingHours: 0,
      autoBackfillLimit: 0,
      defaultThrottleMs: 0,
      sleep: () => Promise.resolve(),
      createBatchLog: vi.fn().mockResolvedValue({}),
      getRedisClient: () => null,
      isRedisAvailable: () => false,
      getPodId: () => 'pod-noredis'
    })

    const start = new Date('2026-04-01T00:00:00.000Z')
    const end = new Date('2026-04-01T01:00:00.000Z')

    // throw 안 해야 함 (Redis 미사용 시 owner check skip)
    await expect(runManualBackfill(start, end, { skipDaily: true })).resolves.toBeUndefined()

    const promise = _getBackfillPromise()
    if (promise) await promise
  })
})
