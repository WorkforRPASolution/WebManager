import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryLogs, getLogById, getStatistics, _setDeps } from './service.js'

// Mock WebManagerLog model
const mockFind = vi.fn()
const mockCountDocuments = vi.fn()
const mockFindById = vi.fn()
const mockAggregate = vi.fn()

const MockModel = {
  find: mockFind,
  countDocuments: mockCountDocuments,
  findById: mockFindById,
  aggregate: mockAggregate
}

beforeEach(() => {
  vi.clearAllMocks()
  _setDeps({ WebManagerLog: MockModel })
})

describe('queryLogs', () => {
  it('returns paginated logs with default params', async () => {
    const mockDocs = [
      { _id: '1', category: 'auth', timestamp: new Date() },
      { _id: '2', category: 'error', timestamp: new Date() }
    ]
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockDocs)
          })
        })
      })
    })
    mockCountDocuments.mockResolvedValue(2)

    const result = await queryLogs({})

    expect(result.data).toHaveLength(2)
    expect(result.pagination).toEqual({
      total: 2,
      page: 1,
      pageSize: 25,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false
    })
  })

  it('filters by category', async () => {
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

    await queryLogs({ category: 'auth' })

    const query = mockFind.mock.calls[0][0]
    expect(query.category).toBe('auth')
  })

  it('filters by userId', async () => {
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

    await queryLogs({ userId: 'admin' })

    const query = mockFind.mock.calls[0][0]
    expect(query.userId).toBe('admin')
  })

  it('filters by date range', async () => {
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

    const start = '2026-03-01T00:00:00Z'
    const end = '2026-03-19T23:59:59Z'
    await queryLogs({ startDate: start, endDate: end })

    const query = mockFind.mock.calls[0][0]
    expect(query.timestamp.$gte).toEqual(new Date(start))
    expect(query.timestamp.$lte).toEqual(new Date(end))
  })

  it('filters by search text (errorMessage)', async () => {
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

    await queryLogs({ search: 'connection failed' })

    const query = mockFind.mock.calls[0][0]
    expect(query.$or).toBeDefined()
  })

  it('filters by action (audit action)', async () => {
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

    await queryLogs({ action: 'login' })

    const query = mockFind.mock.calls[0][0]
    expect(query.$or).toBeDefined()
  })

  it('paginates correctly', async () => {
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([])
          })
        })
      })
    })
    mockCountDocuments.mockResolvedValue(100)

    const result = await queryLogs({ page: 2, pageSize: 10 })

    expect(result.pagination.page).toBe(2)
    expect(result.pagination.pageSize).toBe(10)
    expect(result.pagination.totalPages).toBe(10)
    expect(result.pagination.hasNextPage).toBe(true)
    expect(result.pagination.hasPrevPage).toBe(true)

    // verify skip/limit
    const sortRet = mockFind.mock.results[0].value.sort.mock.results[0].value
    expect(sortRet.skip).toHaveBeenCalledWith(10) // (page-1)*pageSize
    const skipRet = sortRet.skip.mock.results[0].value
    expect(skipRet.limit).toHaveBeenCalledWith(10)
  })
})

describe('getLogById', () => {
  it('returns a single log by ID', async () => {
    const mockDoc = { _id: '123', category: 'auth', authAction: 'login' }
    mockFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockDoc)
    })

    const result = await getLogById('123')
    expect(result).toEqual(mockDoc)
    expect(mockFindById).toHaveBeenCalledWith('123')
  })

  it('returns null for non-existent ID', async () => {
    mockFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    })

    const result = await getLogById('nonexistent')
    expect(result).toBeNull()
  })
})

describe('getStatistics', () => {
  it('returns KPI counts and trend data', async () => {
    // Mock aggregate for categoryKPI
    const mockKpi = [
      { _id: 'audit', count: 100 },
      { _id: 'error', count: 20 },
      { _id: 'auth', count: 50 },
      { _id: 'batch', count: 30 }
    ]

    // Mock aggregate for trend
    const mockTrend = [
      { _id: { date: '2026-03-19', hour: 10, category: 'auth' }, count: 5 },
      { _id: { date: '2026-03-19', hour: 11, category: 'error' }, count: 3 }
    ]

    // Mock aggregate for topErrors
    const mockTopErrors = [
      { _id: 'ServerError', count: 15, lastOccurrence: new Date() },
      { _id: 'ValidationError', count: 8, lastOccurrence: new Date() }
    ]

    // Mock aggregate for loginFailures
    const mockLoginFailures = [
      { _id: { date: '2026-03-19', hour: 10 }, count: 2 }
    ]

    mockAggregate
      .mockResolvedValueOnce(mockKpi)       // categoryKPI
      .mockResolvedValueOnce(mockTrend)     // trend
      .mockResolvedValueOnce(mockTopErrors) // topErrors
      .mockResolvedValueOnce(mockLoginFailures) // loginFailures

    const result = await getStatistics({ period: 'today' })

    expect(result.kpi).toBeDefined()
    expect(result.trend).toBeDefined()
    expect(result.topErrors).toBeDefined()
    expect(result.loginFailures).toBeDefined()
    expect(mockAggregate).toHaveBeenCalledTimes(4)
  })

  it('handles 7d period', async () => {
    mockAggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await getStatistics({ period: '7d' })

    expect(result.kpi).toBeDefined()
    expect(result.trend).toBeDefined()
    expect(result.topErrors).toBeDefined()
    expect(result.loginFailures).toBeDefined()
  })

  it('handles custom period', async () => {
    mockAggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await getStatistics({
      period: 'custom',
      startDate: '2026-03-01T00:00:00Z',
      endDate: '2026-03-19T23:59:59Z'
    })

    expect(result.kpi).toBeDefined()
  })
})
