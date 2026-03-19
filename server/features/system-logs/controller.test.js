import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getLogs, getLogDetail, getStats, _setDeps } from './controller.js'

const mockQueryLogs = vi.fn()
const mockGetLogById = vi.fn()
const mockGetStatistics = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  _setDeps({
    service: {
      queryLogs: mockQueryLogs,
      getLogById: mockGetLogById,
      getStatistics: mockGetStatistics
    }
  })
})

function mockRes() {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('getLogs', () => {
  it('passes query params to service and returns result', async () => {
    const mockResult = { data: [], pagination: { total: 0, page: 1, pageSize: 25, totalPages: 1, hasNextPage: false, hasPrevPage: false } }
    mockQueryLogs.mockResolvedValue(mockResult)

    const req = { query: { category: 'auth', page: '1', pageSize: '25' } }
    const res = mockRes()

    await getLogs(req, res)

    expect(mockQueryLogs).toHaveBeenCalledWith({
      category: 'auth',
      userId: undefined,
      action: undefined,
      startDate: undefined,
      endDate: undefined,
      search: undefined,
      page: '1',
      pageSize: '25'
    })
    expect(res.json).toHaveBeenCalledWith(mockResult)
  })

  it('validates category enum', async () => {
    const req = { query: { category: 'invalid' } }
    const res = mockRes()

    await getLogs(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }))
  })
})

describe('getLogDetail', () => {
  it('returns log detail by ID', async () => {
    const mockDoc = { _id: '123', category: 'auth' }
    mockGetLogById.mockResolvedValue(mockDoc)

    const req = { params: { id: '123' } }
    const res = mockRes()

    await getLogDetail(req, res)

    expect(mockGetLogById).toHaveBeenCalledWith('123')
    expect(res.json).toHaveBeenCalledWith(mockDoc)
  })

  it('returns 404 for non-existent ID', async () => {
    mockGetLogById.mockResolvedValue(null)

    const req = { params: { id: 'nonexistent' } }
    const res = mockRes()

    await getLogDetail(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('getStats', () => {
  it('passes period params to service', async () => {
    const mockResult = { kpi: {}, trend: [], topErrors: [], loginFailures: [] }
    mockGetStatistics.mockResolvedValue(mockResult)

    const req = { query: { period: '7d' } }
    const res = mockRes()

    await getStats(req, res)

    expect(mockGetStatistics).toHaveBeenCalledWith({
      period: '7d',
      startDate: undefined,
      endDate: undefined
    })
    expect(res.json).toHaveBeenCalledWith(mockResult)
  })

  it('validates period enum', async () => {
    const req = { query: { period: 'invalid' } }
    const res = mockRes()

    await getStats(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })
})
