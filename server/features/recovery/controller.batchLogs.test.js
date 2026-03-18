import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getBatchLogs, getBatchHeatmap, _setDeps } = require('./controller.js')

const mockFind = vi.fn()
const mockCountDocuments = vi.fn()

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

describe('controller.batchLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([])
          })
        })
      })
    })
    mockCountDocuments.mockResolvedValue(0)

    _setDeps({
      WebManagerLog: {
        find: mockFind,
        countDocuments: mockCountDocuments
      }
    })
  })

  describe('getBatchLogs', () => {
    it('returns paginated response with default params', async () => {
      mockCountDocuments.mockResolvedValue(3)
      mockFind.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue([
                { batchAction: 'cron_completed', timestamp: new Date() },
                { batchAction: 'cron_completed', timestamp: new Date() },
                { batchAction: 'cron_skipped', timestamp: new Date() }
              ])
            })
          })
        })
      })

      const req = mockReq({})
      const res = mockRes()
      await getBatchLogs(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.data).toHaveLength(3)
      expect(res.body.pagination).toBeDefined()
      expect(res.body.pagination.total).toBe(3)
      expect(res.body.pagination.page).toBe(1)
    })

    it('filters by batchAction', async () => {
      const req = mockReq({ batchAction: 'cron_skipped' })
      const res = mockRes()
      await getBatchLogs(req, res)

      const findCall = mockFind.mock.calls[0][0]
      expect(findCall.batchAction).toBe('cron_skipped')
    })

    it('filters by period=today', async () => {
      const req = mockReq({ period: 'today' })
      const res = mockRes()
      await getBatchLogs(req, res)

      const findCall = mockFind.mock.calls[0][0]
      expect(findCall.timestamp).toBeDefined()
      expect(findCall.timestamp.$gte).toBeInstanceOf(Date)
    })

    it('filters by startDate/endDate (heatmap cell click)', async () => {
      const req = mockReq({ startDate: '2026-03-17', endDate: '2026-03-17' })
      const res = mockRes()
      await getBatchLogs(req, res)

      const findCall = mockFind.mock.calls[0][0]
      expect(findCall.timestamp.$gte).toBeInstanceOf(Date)
      expect(findCall.timestamp.$lte).toBeInstanceOf(Date)
    })
  })

  describe('getBatchHeatmap', () => {
    it('returns heatmap data with default 30 days', async () => {
      const mockAggregate = vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { date: '2026-03-18', total: 26, actions: { cron_completed: 24, cron_skipped: 1, backfill_started: 1 } }
        ])
      })
      _setDeps({
        WebManagerLog: {
          find: mockFind,
          countDocuments: mockCountDocuments,
          collection: { aggregate: mockAggregate }
        }
      })

      const req = mockReq({})
      const res = mockRes()
      await getBatchHeatmap(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].date).toBe('2026-03-18')
      expect(res.body.data[0].cron).toBe(24)
      expect(res.body.data[0].skip).toBe(1)
      expect(res.body.data[0].backfill).toBe(1)
    })

    it('maps batchActions to 3 categories correctly', async () => {
      const mockAggregate = vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            date: '2026-03-18',
            total: 30,
            actions: {
              cron_completed: 24,
              cron_skipped: 2,
              backfill_started: 1,
              backfill_completed: 1,
              backfill_cancelled: 1,
              auto_backfill_completed: 1
            }
          }
        ])
      })
      _setDeps({
        WebManagerLog: {
          find: mockFind,
          countDocuments: mockCountDocuments,
          collection: { aggregate: mockAggregate }
        }
      })

      const req = mockReq({})
      const res = mockRes()
      await getBatchHeatmap(req, res)

      const day = res.body.data[0]
      expect(day.cron).toBe(24)
      expect(day.skip).toBe(2)
      expect(day.backfill).toBe(4)
    })

    it('accepts days=90 parameter', async () => {
      const mockAggregate = vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
      _setDeps({
        WebManagerLog: {
          find: mockFind,
          countDocuments: mockCountDocuments,
          collection: { aggregate: mockAggregate }
        }
      })

      const req = mockReq({ days: '90' })
      const res = mockRes()
      await getBatchHeatmap(req, res)

      const pipeline = mockAggregate.mock.calls[0][0]
      const matchDate = pipeline[0].$match.timestamp.$gte
      const diffMs = Date.now() - matchDate.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeGreaterThan(89)
      expect(diffDays).toBeLessThan(91)
    })
  })
})
