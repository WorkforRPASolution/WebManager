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
  MockModel.findOne = vi.fn().mockReturnValue({
    sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
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

  it('락 획득 성공 → 배치 실행 + Lua eval로 락 해제', async () => {
    const { redis, pod, earsDb, CronRunLog } = setupDeps()

    await runBatch('hourly')

    // 락 획득 호출 (SET wm:cron:lock:hourly NX EX 600)
    expect(redis.set).toHaveBeenCalledWith('wm:cron:lock:hourly', pod, 'NX', 'EX', 600)
    // 배치 실행 (3개 파이프라인 aggregate)
    expect(earsDb._collection.aggregate).toHaveBeenCalledTimes(3)
    // CronRunLog 업데이트 호출
    expect(CronRunLog.findOneAndUpdate).toHaveBeenCalled()
    // 락 해제 — Lua compare-and-delete (eval)
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('del'"),
      1,
      'wm:cron:lock:hourly',
      pod
    )
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

    // 배치 정상 실행
    expect(earsDb._collection.aggregate).toHaveBeenCalledTimes(3)
    expect(CronRunLog.findOneAndUpdate).toHaveBeenCalled()
    // cron_completed 로그 발생
    const completed = createBatchLog.mock.calls.find(c => c[0]?.batchAction === 'cron_completed')
    expect(completed).toBeDefined()
  })

  it('배치 실행 중 fatal error → finally에서 락 해제 보장', async () => {
    const redis = createMockRedis()
    setupDeps({ redis })
    // findOneAndUpdate가 throw하도록 → fatal catch 진입
    const deps = require('./recoveryDeps').getDeps()
    deps.CronRunLog.findOneAndUpdate.mockRejectedValue(new Error('DB lost'))

    await runBatch('hourly')

    // 락 해제 호출 보장 (Lua eval)
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('del'"),
      1,
      'wm:cron:lock:hourly',
      'pod-test-1'
    )
  })

  it('락 획득 + 인메모리 isRunning true → cron_skipped isRunning + 즉시 락 해제', async () => {
    // 첫 번째 runBatch가 진행 중인 동안 두 번째 runBatch 시도
    // 두 번째는 락 획득 → isRunning 체크 → skip + releaseLock
    const redis = createMockRedis()
    const { earsDb, CronRunLog, createBatchLog } = setupDeps({ redis })

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
    // 락 해제는 두 번 발생 (run1 finally + run2의 skip 경로)
    expect(redis.eval.mock.calls.length).toBeGreaterThanOrEqual(2)
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
