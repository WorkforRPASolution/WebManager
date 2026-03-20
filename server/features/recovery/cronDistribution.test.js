import { describe, it, expect, vi, beforeEach } from 'vitest'
import { floorToKSTBucket, generateExpectedBuckets } from './dateUtils.js'

// ── Controller under test ──
const {
  getCronRunDistribution,
  _setDeps
} = require('./controller.js')

// ── Mock summaryService ──
const mockGetCronRunDistribution = vi.fn()

// ── Helpers ──
function mockReq(query = {}) {
  return { query }
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

// ═══════════════════════════════════════════════
// Section A: Controller tests
// ═══════════════════════════════════════════════

describe('getCronRunDistribution controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCronRunDistribution.mockResolvedValue({ granularity: 'daily', data: [] })

    _setDeps({
      summaryService: {
        getCronRunDistribution: mockGetCronRunDistribution,
        isIndexReady: () => true,
        _getSettlingHours: () => 3,
        getCompletedBucketSet: vi.fn(),
        getPartialBucketSet: vi.fn(),
        runManualBackfill: vi.fn(),
        getBackfillState: vi.fn().mockReturnValue({ status: 'idle' }),
        cancelBackfill: vi.fn(),
        getLastCronRun: vi.fn()
      }
    })
  })

  it('returns 400 for invalid period', async () => {
    const req = mockReq({ period: 'invalid' })
    const res = mockRes()
    await getCronRunDistribution(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('defaults period to 7d', async () => {
    const req = mockReq({})
    const res = mockRes()
    await getCronRunDistribution(req, res)
    expect(res.statusCode).toBe(200)
    expect(mockGetCronRunDistribution).toHaveBeenCalledWith('7d')
  })

  it('accepts valid periods: today, 7d, 30d, 90d', async () => {
    for (const period of ['today', '7d', '30d', '90d']) {
      vi.clearAllMocks()
      mockGetCronRunDistribution.mockResolvedValue({ granularity: 'daily', data: [] })
      const req = mockReq({ period })
      const res = mockRes()
      await getCronRunDistribution(req, res)
      expect(res.statusCode).toBe(200)
      expect(mockGetCronRunDistribution).toHaveBeenCalledWith(period)
    }
  })

  it('returns data from summaryService including pending', async () => {
    const mockData = {
      granularity: 'daily',
      data: [
        { bucket: '2026-03-17T15:00:00.000Z', success: 10, partial: 1, failed: 0, pending: 14, total: 25 }
      ]
    }
    mockGetCronRunDistribution.mockResolvedValue(mockData)
    const req = mockReq({ period: '7d' })
    const res = mockRes()
    await getCronRunDistribution(req, res)
    expect(res.body).toEqual(mockData)
  })
})

// ═══════════════════════════════════════════════
// Section B: Service layer tests
// ═══════════════════════════════════════════════

describe('getCronRunDistribution service', () => {
  const {
    _setDeps: setServiceDeps,
    _resetState,
    _setIndexReady
  } = require('./recoverySummaryService.js')

  const mockFind = vi.fn()
  const MockCronRunLog = {
    find: mockFind,
    collection: { createIndex: vi.fn() }
  }

  // Fixed "now": 2026-03-18T12:00:00.000Z (KST 21:00 03/18)
  const FIXED_NOW = new Date('2026-03-18T12:00:00.000Z')
  const SETTLING_HOURS = 3

  beforeEach(() => {
    vi.clearAllMocks()
    _resetState()
    _setIndexReady(true)
    setServiceDeps({
      CronRunLog: MockCronRunLog,
      settlingHours: SETTLING_HOURS
    })
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([])
      })
    })
  })

  const { getCronRunDistribution: svc } = require('./recoverySummaryService.js')

  // ── Granularity mapping ──

  it('returns hourly granularity for today', async () => {
    const result = await svc('today', FIXED_NOW)
    expect(result.granularity).toBe('hourly')
  })

  it('returns daily granularity for 7d', async () => {
    const result = await svc('7d', FIXED_NOW)
    expect(result.granularity).toBe('daily')
  })

  it('returns daily granularity for 30d', async () => {
    const result = await svc('30d', FIXED_NOW)
    expect(result.granularity).toBe('daily')
  })

  it('returns weekly granularity for 90d', async () => {
    const result = await svc('90d', FIXED_NOW)
    expect(result.granularity).toBe('weekly')
  })

  // ── Pending buckets ──

  it('today with no logs → all expected hourly buckets are pending', async () => {
    const result = await svc('today', FIXED_NOW)

    // KST 03/18 00:00 = 2026-03-17T15:00Z to settled end 2026-03-18T09:00Z = 18 hourly buckets
    // daily end = floorToKSTBucket('daily', settledEnd) = same as start → 0 daily
    // So 18 pending (hourly only)
    const totalPending = result.data.reduce((sum, d) => sum + d.pending, 0)
    expect(totalPending).toBe(18)
    // All should have 0 success/partial/failed
    for (const entry of result.data) {
      expect(entry.success).toBe(0)
      expect(entry.partial).toBe(0)
      expect(entry.failed).toBe(0)
    }
  })

  it('some logs reduce pending count', async () => {
    // Supply 2 successful hourly logs within today's range
    const b1 = new Date('2026-03-17T15:00:00.000Z') // KST 03/18 00:00
    const b2 = new Date('2026-03-17T16:00:00.000Z') // KST 03/18 01:00
    const logs = [
      { bucket: b1, period: 'hourly', status: 'success' },
      { bucket: b2, period: 'hourly', status: 'success' },
    ]
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(logs)
      })
    })

    const result = await svc('today', FIXED_NOW)

    const totalSuccess = result.data.reduce((sum, d) => sum + d.success, 0)
    const totalPending = result.data.reduce((sum, d) => sum + d.pending, 0)
    expect(totalSuccess).toBe(2)
    expect(totalPending).toBe(16) // 18 expected - 2 actual
  })

  it('total = success + partial + failed + pending', async () => {
    const b1 = new Date('2026-03-17T15:00:00.000Z')
    const logs = [
      { bucket: b1, period: 'hourly', status: 'partial' },
    ]
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(logs)
      })
    })

    const result = await svc('today', FIXED_NOW)

    for (const entry of result.data) {
      expect(entry.total).toBe(entry.success + entry.partial + entry.failed + entry.pending)
    }
  })

  // ── Grouping ──

  it('daily granularity groups hourly+daily logs into same KST day', async () => {
    // Two buckets on same KST day (03/18): one daily, one hourly
    const dailyBucket = new Date('2026-03-17T15:00:00.000Z') // KST 03/18 00:00
    const hourlyBucket = new Date('2026-03-17T16:00:00.000Z') // KST 03/18 01:00
    const logs = [
      { bucket: dailyBucket, period: 'daily', status: 'success' },
      { bucket: hourlyBucket, period: 'hourly', status: 'failed' },
    ]
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(logs)
      })
    })

    const result = await svc('7d', FIXED_NOW)

    // Both fall on KST 03/18 → same group
    const kst18 = result.data.find(d =>
      new Date(d.bucket).getTime() === new Date('2026-03-17T15:00:00.000Z').getTime()
    )
    expect(kst18).toBeDefined()
    expect(kst18.success).toBe(1)
    expect(kst18.failed).toBe(1)
  })

  it('weekly rollup groups into ISO week (KST Monday)', async () => {
    const week1 = new Date('2026-03-16T15:00:00.000Z') // KST Tue 03/17
    const week2 = new Date('2026-03-09T15:00:00.000Z') // KST Tue 03/10
    const logs = [
      { bucket: week1, period: 'daily', status: 'success' },
      { bucket: week2, period: 'daily', status: 'failed' },
    ]
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(logs)
      })
    })

    const result = await svc('90d', FIXED_NOW)

    // Two different weeks → at least 2 groups
    expect(result.data.length).toBeGreaterThanOrEqual(2)
  })

  // ── Sorting ──

  it('output data sorted by bucket ascending', async () => {
    const b1 = new Date('2026-03-17T15:00:00.000Z')
    const b2 = new Date('2026-03-16T15:00:00.000Z')
    const logs = [
      { bucket: b1, period: 'daily', status: 'success' },
      { bucket: b2, period: 'daily', status: 'failed' },
    ]
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(logs)
      })
    })

    const result = await svc('7d', FIXED_NOW)

    for (let i = 1; i < result.data.length; i++) {
      expect(new Date(result.data[i].bucket).getTime())
        .toBeGreaterThanOrEqual(new Date(result.data[i - 1].bucket).getTime())
    }
  })
})
