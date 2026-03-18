import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  computeHourlyBoundaries,
  computeDailyBoundaries,
  generateExpectedBuckets,
  floorToKSTBucket
} from './dateUtils.js'

// ── Controller under test ──
// dateUtils: REAL (DI로 주입하되 실제 구현 사용 — KST alignment 검증이 목적)
// recoverySummaryService: mock (DB dependency)
// validation: REAL (controller가 top-level require로 로드)

const {
  analyzeBackfill,
  startBackfill,
  _setDeps
} = require('./controller.js')

// ── Mock summaryService ──

const mockGetCompletedBucketSet = vi.fn()
const mockGetPartialBucketSet = vi.fn()
const mockRunManualBackfill = vi.fn()
const mockGetBackfillState = vi.fn()

// ── Helpers ──

function mockReq(body = {}, query = {}) {
  return { body, query }
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res },
    json(data) { res.body = data; return res }
  }
  return res
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000

describe('controller.backfill — KST alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCompletedBucketSet.mockResolvedValue(new Set())
    mockGetPartialBucketSet.mockResolvedValue(new Set())
    mockRunManualBackfill.mockResolvedValue(undefined)
    mockGetBackfillState.mockReturnValue({ status: 'idle' })

    // DI: 실제 dateUtils + mock summaryService
    _setDeps({
      dateUtils: { generateExpectedBuckets, floorToKSTBucket },
      summaryService: {
        getCompletedBucketSet: mockGetCompletedBucketSet,
        getPartialBucketSet: mockGetPartialBucketSet,
        runManualBackfill: mockRunManualBackfill,
        getBackfillState: mockGetBackfillState,
        cancelBackfill: vi.fn(),
        getLastCronRun: vi.fn(),
        isIndexReady: () => true,
        _getSettlingHours: () => 3
      }
    })
  })

  // ────────────────────────────────────────────
  // Section A: analyzeBackfill KST alignment (6개)
  // ────────────────────────────────────────────

  describe('Section A: analyzeBackfill KST alignment', () => {
    it('A1: date-only "2026-03-17"~"2026-03-18" → KST daily bucket 2개', async () => {
      const req = mockReq({
        startDate: '2026-03-17',
        endDate: '2026-03-18',
        skipHourly: true
      })
      const res = mockRes()

      await analyzeBackfill(req, res)

      expect(res.statusCode).toBe(200)
      // "2026-03-17" → new Date("2026-03-17") = UTC 자정 = KST 09:00
      // floorToKSTBucket('daily') → KST 03/17 자정 = 2026-03-16T15:00Z
      // end: floor("2026-03-18") + 24h → KST 03/19 자정 = 2026-03-18T15:00Z
      // daily buckets: 03-16T15:00Z, 03-17T15:00Z = 2개
      expect(res.body.daily.total).toBe(2)
    })

    it('A2: ISO "2026-03-17T00:00:00.000Z" → A1과 동일 결과', async () => {
      const req = mockReq({
        startDate: '2026-03-17T00:00:00.000Z',
        endDate: '2026-03-18T00:00:00.000Z',
        skipHourly: true
      })
      const res = mockRes()

      await analyzeBackfill(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.daily.total).toBe(2)
    })

    it('A3: non-midnight UTC "2026-03-17T14:30:00Z" → 같은 KST 날짜로 floor', async () => {
      // 14:30 UTC = 23:30 KST 03/17 → floor → KST 03/17 자정 = 2026-03-16T15:00Z
      // Same as "2026-03-17" date-only
      const req1 = mockReq({
        startDate: '2026-03-17T14:30:00Z',
        endDate: '2026-03-18T14:30:00Z',
        skipHourly: true
      })
      const req2 = mockReq({
        startDate: '2026-03-17',
        endDate: '2026-03-18',
        skipHourly: true
      })
      const res1 = mockRes()
      const res2 = mockRes()

      await analyzeBackfill(req1, res1)
      await analyzeBackfill(req2, res2)

      expect(res1.body.daily.total).toBe(res2.body.daily.total)
    })

    it('A4: KST 자정 경계 "2026-03-17T15:00:00.000Z" → KST 03/18로 넘어감', () => {
      // 15:00 UTC = 00:00 KST 03/18 → floor → KST 03/18 자정 = 2026-03-17T15:00Z
      // vs 14:59 UTC = 23:59 KST 03/17 → floor → KST 03/17 자정 = 2026-03-16T15:00Z
      const kstBoundaryStart = floorToKSTBucket('daily', new Date('2026-03-17T15:00:00.000Z'))
      const beforeBoundaryStart = floorToKSTBucket('daily', new Date('2026-03-17T14:59:59.999Z'))

      expect(kstBoundaryStart.toISOString()).toBe('2026-03-17T15:00:00.000Z')
      expect(beforeBoundaryStart.toISOString()).toBe('2026-03-16T15:00:00.000Z')
      expect(kstBoundaryStart.getTime() - beforeBoundaryStart.getTime()).toBe(ONE_DAY_MS)
    })

    it('A5: startDate == endDate → 400 validation error', async () => {
      const req = mockReq({
        startDate: '2026-03-17',
        endDate: '2026-03-17'
      })
      const res = mockRes()

      await analyzeBackfill(req, res)

      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBeDefined()
    })

    it('A6: hourly도 daily-floor 범위 사용 → 48개 hourly bucket', async () => {
      // "2026-03-17"~"2026-03-18", skipDaily=true → hourly만
      // KST floor: 03-16T15:00Z ~ 03-18T15:00Z (2 KST days) = 48 hourly buckets
      const req = mockReq({
        startDate: '2026-03-17',
        endDate: '2026-03-18',
        skipDaily: true
      })
      const res = mockRes()

      await analyzeBackfill(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.hourly.total).toBe(48)
    })
  })

  // ────────────────────────────────────────────
  // Section B: startBackfill KST alignment (3개)
  // ────────────────────────────────────────────

  describe('Section B: startBackfill KST alignment', () => {
    it('B1: "2026-03-17"~"2026-03-18" → runManualBackfill에 KST-aligned Date 전달', async () => {
      const req = mockReq({
        startDate: '2026-03-17',
        endDate: '2026-03-18'
      })
      const res = mockRes()

      await startBackfill(req, res)

      expect(res.statusCode).toBe(202)
      expect(mockRunManualBackfill).toHaveBeenCalledTimes(1)

      const [alignedStart, alignedEnd] = mockRunManualBackfill.mock.calls[0]
      // "2026-03-17" → UTC 자정 → KST 09:00 → floor → KST 03/17 자정 = 03-16T15:00Z
      expect(alignedStart.toISOString()).toBe('2026-03-16T15:00:00.000Z')
      // "2026-03-18" → floor → KST 03/18 자정 + 24h = 03-18T15:00Z
      expect(alignedEnd.toISOString()).toBe('2026-03-18T15:00:00.000Z')
    })

    it('B2: 월 경계 "2026-02-28"~"2026-03-01"', async () => {
      const req = mockReq({
        startDate: '2026-02-28',
        endDate: '2026-03-01'
      })
      const res = mockRes()

      await startBackfill(req, res)

      expect(res.statusCode).toBe(202)
      const [alignedStart, alignedEnd] = mockRunManualBackfill.mock.calls[0]
      // 02-28 UTC 자정 → KST 09:00 → floor → KST 02/28 자정 = 02-27T15:00Z
      expect(alignedStart.toISOString()).toBe('2026-02-27T15:00:00.000Z')
      // 03-01 → floor → KST 03/01 자정 + 24h = 03-01T15:00Z
      expect(alignedEnd.toISOString()).toBe('2026-03-01T15:00:00.000Z')
    })

    it('B3: 연도 경계 "2025-12-31"~"2026-01-01"', async () => {
      const req = mockReq({
        startDate: '2025-12-31',
        endDate: '2026-01-01'
      })
      const res = mockRes()

      await startBackfill(req, res)

      expect(res.statusCode).toBe(202)
      const [alignedStart, alignedEnd] = mockRunManualBackfill.mock.calls[0]
      // 12-31 UTC 자정 → KST 09:00 → floor → KST 12/31 자정 = 12-30T15:00Z
      expect(alignedStart.toISOString()).toBe('2025-12-30T15:00:00.000Z')
      // 01-01 → floor → KST 01/01 자정 + 24h = 01-01T15:00Z
      expect(alignedEnd.toISOString()).toBe('2026-01-01T15:00:00.000Z')
    })
  })

  // ────────────────────────────────────────────
  // Section C: Bucket timestamp identity (4개)
  // ────────────────────────────────────────────

  describe('Section C: Bucket timestamp identity — 근본 원인 검증', () => {
    it('C1: hourly: expected buckets == computeHourlyBoundaries bucketStart', () => {
      // KST 2026-03-17 10:00 ~ 13:00 = 3시간
      const start = new Date('2026-03-17T01:00:00.000Z') // KST 10:00
      const end = new Date('2026-03-17T04:00:00.000Z')   // KST 13:00

      const expectedBuckets = generateExpectedBuckets('hourly', start, end)
      expect(expectedBuckets).toHaveLength(3)

      // computeHourlyBoundaries(now) returns PREVIOUS completed hour's bucket
      for (let i = 0; i < 3; i++) {
        const hourAfterBucket = new Date(expectedBuckets[i].getTime() + ONE_HOUR_MS + 5 * 60 * 1000)
        const { bucketStart } = computeHourlyBoundaries(hourAfterBucket)
        expect(bucketStart.getTime()).toBe(expectedBuckets[i].getTime())
      }
    })

    it('C2: daily: expected buckets == computeDailyBoundaries bucketStart', () => {
      // KST 03/15 ~ 03/18 = 3일
      const start = new Date('2026-03-14T15:00:00.000Z') // KST 03/15 자정
      const end = new Date('2026-03-17T15:00:00.000Z')   // KST 03/18 자정

      const expectedBuckets = generateExpectedBuckets('daily', start, end)
      expect(expectedBuckets).toHaveLength(3)

      for (let i = 0; i < 3; i++) {
        const dayAfterBucket = new Date(expectedBuckets[i].getTime() + ONE_DAY_MS + 2 * ONE_HOUR_MS)
        const { bucketStart } = computeDailyBoundaries(dayAfterBucket)
        expect(bucketStart.getTime()).toBe(expectedBuckets[i].getTime())
      }
    })

    it('C3: hourly E2E: cron이 쓴 bucket → analyze가 completed로 인식', async () => {
      // Cron이 3개 hourly bucket을 저장
      const cronBuckets = [
        new Date('2026-03-17T01:00:00.000Z'), // KST 10:00
        new Date('2026-03-17T02:00:00.000Z'), // KST 11:00
        new Date('2026-03-17T03:00:00.000Z'), // KST 12:00
      ]

      mockGetCompletedBucketSet.mockImplementation(async (period, start, end) => {
        const set = new Set()
        for (const b of cronBuckets) {
          if (b.getTime() >= start.getTime() && b.getTime() < end.getTime()) {
            set.add(b.getTime())
          }
        }
        return set
      })

      // "2026-03-17"~"2026-03-18" → KST range: 03-16T15:00Z ~ 03-18T15:00Z
      const req = mockReq({
        startDate: '2026-03-17',
        endDate: '2026-03-18',
        skipDaily: true
      })
      const res = mockRes()

      await analyzeBackfill(req, res)

      // 48 total hourly buckets, 3 completed by cron (shown as success since partialSet is empty)
      expect(res.body.hourly.success).toBe(3)
      expect(res.body.hourly.pending).toBe(48 - 3)
    })

    it('C4: daily E2E: cron이 쓴 bucket → analyze가 completed로 인식', async () => {
      // Cron writes daily buckets at KST 자정 = UTC 전일 15:00
      const cronBuckets = [
        new Date('2026-03-16T15:00:00.000Z'), // KST 03/17 자정
        new Date('2026-03-17T15:00:00.000Z'), // KST 03/18 자정
      ]

      mockGetCompletedBucketSet.mockImplementation(async (period, start, end) => {
        const set = new Set()
        for (const b of cronBuckets) {
          if (b.getTime() >= start.getTime() && b.getTime() < end.getTime()) {
            set.add(b.getTime())
          }
        }
        return set
      })

      const req = mockReq({
        startDate: '2026-03-17',
        endDate: '2026-03-18',
        skipHourly: true
      })
      const res = mockRes()

      await analyzeBackfill(req, res)

      expect(res.body.daily.total).toBe(2)
      expect(res.body.daily.success).toBe(2)
      expect(res.body.daily.pending).toBe(0)
    })
  })

  // ────────────────────────────────────────────
  // Section D: KST 자정 경계 edge cases (4개)
  // ────────────────────────────────────────────

  describe('Section D: KST 자정 경계 edge cases', () => {
    it('D1: 14:59:59.999 UTC (23:59:59.999 KST) → floor to 당일 KST 자정', () => {
      const result = floorToKSTBucket('daily', new Date('2026-03-17T14:59:59.999Z'))
      expect(result.toISOString()).toBe('2026-03-16T15:00:00.000Z')
    })

    it('D2: 15:00:00.000 UTC (00:00:00.000 KST) → floor to 다음날 KST 자정', () => {
      const result = floorToKSTBucket('daily', new Date('2026-03-17T15:00:00.000Z'))
      expect(result.toISOString()).toBe('2026-03-17T15:00:00.000Z')
    })

    it('D3: 15:00:00.001 UTC (00:00:00.001 KST) → floor to 다음날 KST 자정', () => {
      const result = floorToKSTBucket('daily', new Date('2026-03-17T15:00:00.001Z'))
      expect(result.toISOString()).toBe('2026-03-17T15:00:00.000Z')
    })

    it('D4: end - start == 86400000ms (정확히 1 KST day)', () => {
      const start = floorToKSTBucket('daily', new Date('2026-03-17'))
      const end = floorToKSTBucket('daily', new Date('2026-03-18'))

      expect(end.getTime() - start.getTime()).toBe(ONE_DAY_MS)

      const hourlyBuckets = generateExpectedBuckets('hourly', start, end)
      expect(hourlyBuckets).toHaveLength(24)
    })
  })

  // ────────────────────────────────────────────
  // Section E: 프론트엔드 날짜 형식 (1개)
  // ────────────────────────────────────────────

  describe('Section E: 프론트엔드 날짜 형식', () => {
    it('E1: "2026-03-17" vs "2026-03-17T00:00:00.000Z" → 동일 결과', async () => {
      const reqDateOnly = mockReq({
        startDate: '2026-03-17',
        endDate: '2026-03-18',
        skipHourly: true
      })
      const reqISO = mockReq({
        startDate: '2026-03-17T00:00:00.000Z',
        endDate: '2026-03-18T00:00:00.000Z',
        skipHourly: true
      })
      const res1 = mockRes()
      const res2 = mockRes()

      await analyzeBackfill(reqDateOnly, res1)
      await analyzeBackfill(reqISO, res2)

      expect(res1.body.daily).toEqual(res2.body.daily)
      expect(res1.body.estimatedMinutes).toBe(res2.body.estimatedMinutes)
    })
  })

  // ────────────────────────────────────────────
  // Section F: Partial 분리 표시 + retryPartial (4개)
  // ────────────────────────────────────────────

  describe('Section F: Partial 분리 표시', () => {
    it('F1: analyzeBackfill returns success/partial/pending 3-way breakdown', async () => {
      const partialBucket = new Date('2026-03-16T15:00:00.000Z')

      mockGetCompletedBucketSet.mockResolvedValue(
        new Set([partialBucket.getTime()])
      )
      mockGetPartialBucketSet.mockResolvedValue(
        new Set([partialBucket.getTime()])
      )

      const req = mockReq({
        startDate: '2026-03-17',
        endDate: '2026-03-18',
        skipHourly: true
      })
      const res = mockRes()

      await analyzeBackfill(req, res)

      expect(res.body.daily.success).toBe(0)
      expect(res.body.daily.partial).toBe(1)
      expect(res.body.daily.pending).toBe(1)
      expect(res.body.daily.total).toBe(2)
    })

    it('F2: analyzeBackfill with retryPartial=true, actionable shows partial count', async () => {
      const partialBucket = new Date('2026-03-16T15:00:00.000Z')

      mockGetCompletedBucketSet.mockResolvedValue(
        new Set([partialBucket.getTime()])
      )
      mockGetPartialBucketSet.mockResolvedValue(
        new Set([partialBucket.getTime()])
      )

      const req = mockReq({
        startDate: '2026-03-17',
        endDate: '2026-03-18',
        skipHourly: true,
        retryPartial: true
      })
      const res = mockRes()

      await analyzeBackfill(req, res)

      expect(res.body.daily.actionable).toBe(1)
      // 1 bucket × 2.5s / 60 = 0.04분 → rounds to 0
      expect(res.body.estimatedMinutes).toBeGreaterThanOrEqual(0)
    })

    it('F3: startBackfill passes retryPartial to runManualBackfill', async () => {
      const req = mockReq({
        startDate: '2026-03-17',
        endDate: '2026-03-18',
        retryPartial: true
      })
      const res = mockRes()

      await startBackfill(req, res)

      expect(res.statusCode).toBe(202)
      const options = mockRunManualBackfill.mock.calls[0][2]
      expect(options.retryPartial).toBe(true)
    })

    it('F4: startBackfill defaults retryPartial to false', async () => {
      const req = mockReq({
        startDate: '2026-03-17',
        endDate: '2026-03-18'
      })
      const res = mockRes()

      await startBackfill(req, res)

      const options = mockRunManualBackfill.mock.calls[0][2]
      expect(options.retryPartial).toBeFalsy()
    })
  })
})
