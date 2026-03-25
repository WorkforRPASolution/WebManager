import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryLogs, getLogById, getStatistics, getFilterOptions, rollupWeekly, _setDeps, _resetFilterCache } from './service.js'

// Mock WebManagerLog model
const mockFind = vi.fn()
const mockCountDocuments = vi.fn()
const mockFindById = vi.fn()
const mockAggregate = vi.fn()
const mockDistinct = vi.fn()

const MockModel = {
  find: mockFind,
  countDocuments: mockCountDocuments,
  findById: mockFindById,
  aggregate: mockAggregate,
  distinct: mockDistinct
}

beforeEach(() => {
  vi.clearAllMocks()
  _setDeps({ WebManagerLog: MockModel })
  _resetFilterCache()
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
      pageSize: 50,
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

  it('filters by search text using $and', async () => {
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
    expect(query.$and).toBeDefined()
    expect(query.$and.length).toBe(1)
    // Should contain search $or
    expect(query.$and[0].$or).toBeDefined()
  })

  it('filters by action using $and', async () => {
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
    expect(query.$and).toBeDefined()
    expect(query.$and.length).toBe(1)
    expect(query.$and[0].$or).toEqual([
      { action: 'login' },
      { authAction: 'login' },
      { batchAction: 'login' }
    ])
  })

  it('filters by pagePath', async () => {
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

    await queryLogs({ pagePath: '/clients' })

    const query = mockFind.mock.calls[0][0]
    expect(query.pagePath).toBe('/clients')
  })

  it('H1: action + search 동시 사용 시 $and로 결합 (충돌 없음)', async () => {
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

    await queryLogs({ action: 'login', search: 'admin' })

    const query = mockFind.mock.calls[0][0]
    expect(query.$and).toBeDefined()
    expect(query.$and.length).toBe(2)
    // First condition: action match
    expect(query.$and[0].$or).toEqual([
      { action: 'login' },
      { authAction: 'login' },
      { batchAction: 'login' }
    ])
    // Second condition: search regex
    expect(query.$and[1].$or.length).toBeGreaterThan(0)
    // No top-level $or (was the bug)
    expect(query.$or).toBeUndefined()
  })

  it('H2: regex 특수문자 이스케이프', async () => {
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

    await queryLogs({ search: 'test.*error(foo)' })

    const query = mockFind.mock.calls[0][0]
    const searchOr = query.$and[0].$or
    // Special chars should be escaped
    expect(searchOr[0].errorMessage.$regex).toBe('test\\.\\*error\\(foo\\)')
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
  function mockAggregateChain() {
    // Make aggregate chainable with allowDiskUse + maxTimeMS
    const createChainableResult = (resolvedValue) => {
      const chain = {}
      chain.allowDiskUse = vi.fn().mockReturnValue(chain)
      chain.maxTimeMS = vi.fn().mockReturnValue(chain)
      // Make it thenable (Promise-like)
      chain.then = (resolve) => Promise.resolve(resolvedValue).then(resolve)
      chain.catch = (reject) => Promise.resolve(resolvedValue).catch(reject)
      return chain
    }
    return createChainableResult
  }

  // Helper: mock all 8 aggregate pipelines
  function mockAllAggregates(results = {}) {
    const createChain = mockAggregateChain()
    mockAggregate
      .mockReturnValueOnce(createChain(results.kpi || []))       // 1. KPI
      .mockReturnValueOnce(createChain(results.trend || []))     // 2. Trend
      .mockReturnValueOnce(createChain(results.topErrors || [])) // 3. Top Errors
      .mockReturnValueOnce(createChain(results.securityTrend || []))  // 4. Security Trend
      .mockReturnValueOnce(createChain(results.authBreakdown || []))  // 5. Auth Breakdown
      .mockReturnValueOnce(createChain(results.batchBreakdown || [])) // 6. Batch Breakdown
      .mockReturnValueOnce(createChain(results.topUsers || []))       // 7. Top Users
      .mockReturnValueOnce(createChain(results.recentAudits || []))   // 8. Recent Audits
  }

  it('returns KPI counts including access category', async () => {
    const mockKpi = [
      { _id: 'audit', count: 100 },
      { _id: 'error', count: 20 },
      { _id: 'auth', count: 50 },
      { _id: 'batch', count: 30 },
      { _id: 'access', count: 200 }
    ]

    mockAllAggregates({ kpi: mockKpi })

    const result = await getStatistics({ period: 'today' })

    expect(result.kpi.access).toBe(200)
    expect(result.kpi.audit).toBe(100)
  })

  it('returns enhanced KPI with derived fields', async () => {
    const mockKpi = [
      { _id: 'audit', count: 100 },
      { _id: 'error', count: 20 },
      { _id: 'auth', count: 50 },
      { _id: 'batch', count: 30 },
      { _id: 'access', count: 200 }
    ]
    const mockAuthBreakdown = [
      { _id: 'login', count: 20 },
      { _id: 'logout', count: 15 },
      { _id: 'login_failed', count: 10 },
      { _id: 'permission_denied', count: 5 }
    ]
    const mockBatchBreakdown = [
      { _id: 'cron_completed', count: 20 },
      { _id: 'backfill_completed', count: 5 },
      { _id: 'cron_failed', count: 3 },
      { _id: 'cron_skipped', count: 2 }
    ]

    mockAllAggregates({ kpi: mockKpi, authBreakdown: mockAuthBreakdown, batchBreakdown: mockBatchBreakdown })

    const result = await getStatistics({ period: '7d' })

    // total = 100+20+50+30+200 = 400
    expect(result.kpi.total).toBe(400)
    // errorRate = 20/400*100 = 5.0
    expect(result.kpi.errorRate).toBe(5)
    // securityEvents = login_failed(10) + permission_denied(5) = 15
    expect(result.kpi.securityEvents).toBe(15)
    // batchTotal = 20+5+3+2 = 30
    expect(result.kpi.batchTotal).toBe(30)
    // batchSuccess = cron_completed(20) + backfill_completed(5) = 25
    expect(result.kpi.batchSuccess).toBe(25)
    // batchSuccessRate = 25/30*100 = 83.3
    expect(result.kpi.batchSuccessRate).toBe(83.3)
    // auditPerDay and periodDays should be defined
    expect(result.kpi.auditPerDay).toBeDefined()
    expect(result.kpi.periodDays).toBeGreaterThan(0)
  })

  it('returns securityTrend (login_failed + permission_denied)', async () => {
    const mockSecurityTrend = [
      { _id: { date: '2026-03-20', authAction: 'login_failed' }, count: 5 },
      { _id: { date: '2026-03-20', authAction: 'permission_denied' }, count: 2 },
      { _id: { date: '2026-03-21', authAction: 'login_failed' }, count: 3 }
    ]

    mockAllAggregates({ securityTrend: mockSecurityTrend })

    const result = await getStatistics({ period: '7d' })

    expect(result.securityTrend).toHaveLength(3)
    expect(result.securityTrend[0]._id.authAction).toBe('login_failed')
    // No more loginFailures key
    expect(result.loginFailures).toBeUndefined()
  })

  it('returns authBreakdown grouped by authAction', async () => {
    const mockAuthBreakdown = [
      { _id: 'login', count: 100 },
      { _id: 'logout', count: 80 },
      { _id: 'login_failed', count: 10 }
    ]

    mockAllAggregates({ authBreakdown: mockAuthBreakdown })

    const result = await getStatistics({ period: 'today' })

    expect(result.authBreakdown).toHaveLength(3)
    expect(result.authBreakdown[0]._id).toBe('login')
    expect(result.authBreakdown[0].count).toBe(100)
  })

  it('returns batchBreakdown grouped by batchAction', async () => {
    const mockBatchBreakdown = [
      { _id: 'cron_completed', count: 50 },
      { _id: 'cron_failed', count: 5 },
      { _id: 'cron_skipped', count: 3 }
    ]

    mockAllAggregates({ batchBreakdown: mockBatchBreakdown })

    const result = await getStatistics({ period: 'today' })

    expect(result.batchBreakdown).toHaveLength(3)
    expect(result.batchBreakdown[0]._id).toBe('cron_completed')
  })

  it('returns topUsers (top 10, excludes access)', async () => {
    const mockTopUsers = [
      { _id: 'admin', count: 200 },
      { _id: 'user1', count: 150 },
      { _id: 'user2', count: 100 }
    ]

    mockAllAggregates({ topUsers: mockTopUsers })

    const result = await getStatistics({ period: '7d' })

    expect(result.topUsers).toHaveLength(3)
    expect(result.topUsers[0]._id).toBe('admin')

    // Verify pipeline: should exclude access category
    const topUsersPipeline = mockAggregate.mock.calls[6][0]
    const matchStage = topUsersPipeline.find(s => s.$match)
    expect(matchStage.$match.category.$ne).toBe('access')
    // Should limit to 10
    const limitStage = topUsersPipeline.find(s => s.$limit)
    expect(limitStage.$limit).toBe(10)
  })

  it('returns recentAudits (latest 20, audit only)', async () => {
    const mockAudits = [
      { timestamp: new Date(), userId: 'admin', action: 'create', collectionName: 'EQP_INFO', targetType: 'equipmentInfo', documentId: '123' }
    ]

    mockAllAggregates({ recentAudits: mockAudits })

    const result = await getStatistics({ period: '7d' })

    expect(result.recentAudits).toHaveLength(1)
    expect(result.recentAudits[0].userId).toBe('admin')

    // Verify pipeline: audit only, limit 20, sorted desc
    const auditPipeline = mockAggregate.mock.calls[7][0]
    const matchStage = auditPipeline.find(s => s.$match)
    expect(matchStage.$match.category).toBe('audit')
    const limitStage = auditPipeline.find(s => s.$limit)
    expect(limitStage.$limit).toBe(20)
    const sortStage = auditPipeline.find(s => s.$sort)
    expect(sortStage.$sort.timestamp).toBe(-1)
  })

  it('M5: calls allowDiskUse(true) on all 8 aggregations', async () => {
    const chains = []
    const createChain = () => {
      const chain = { allowDiskUse: vi.fn(), maxTimeMS: vi.fn() }
      chain.allowDiskUse.mockReturnValue(chain)
      chain.maxTimeMS.mockReturnValue(chain)
      chain.then = (resolve) => Promise.resolve([]).then(resolve)
      chain.catch = (reject) => Promise.resolve([]).catch(reject)
      chains.push(chain)
      return chain
    }

    for (let i = 0; i < 8; i++) {
      mockAggregate.mockReturnValueOnce(createChain())
    }

    await getStatistics({ period: 'today' })

    // All 8 aggregations should call allowDiskUse(true)
    expect(chains).toHaveLength(8)
    for (const chain of chains) {
      expect(chain.allowDiskUse).toHaveBeenCalledWith(true)
    }
  })

  it('calls maxTimeMS(30000) on all 8 aggregations', async () => {
    const chains = []
    const createChain = () => {
      const chain = { allowDiskUse: vi.fn(), maxTimeMS: vi.fn() }
      chain.allowDiskUse.mockReturnValue(chain)
      chain.maxTimeMS.mockReturnValue(chain)
      chain.then = (resolve) => Promise.resolve([]).then(resolve)
      chain.catch = (reject) => Promise.resolve([]).catch(reject)
      chains.push(chain)
      return chain
    }

    for (let i = 0; i < 8; i++) {
      mockAggregate.mockReturnValueOnce(createChain())
    }

    await getStatistics({ period: 'today' })

    expect(chains).toHaveLength(8)
    for (const chain of chains) {
      expect(chain.maxTimeMS).toHaveBeenCalledWith(30000)
    }
  })

  it('M4: uses hourly granularity for today period', async () => {
    mockAllAggregates({})

    const result = await getStatistics({ period: 'today' })

    expect(result.granularity).toBe('hourly')

    // Check the trend aggregation pipeline (2nd call)
    const trendPipeline = mockAggregate.mock.calls[1][0]
    const groupStage = trendPipeline.find(s => s.$group)
    expect(groupStage.$group._id.hour).toBeDefined()
  })

  it('M4: uses daily granularity for 7d/30d periods', async () => {
    mockAllAggregates({})

    const result = await getStatistics({ period: '7d' })

    expect(result.granularity).toBe('daily')

    // Check the trend pipeline uses date-only grouping (no hour)
    const trendPipeline = mockAggregate.mock.calls[1][0]
    const groupStage = trendPipeline.find(s => s.$group)
    expect(groupStage.$group._id.hour).toBeUndefined()
  })

  it('uses weekly granularity for 90d period', async () => {
    const mockTrend = [
      { _id: { date: '2026-03-17', category: 'audit' }, count: 10 },
      { _id: { date: '2026-03-18', category: 'audit' }, count: 20 },
      { _id: { date: '2026-03-24', category: 'audit' }, count: 15 }
    ]
    const mockSecurityTrend = [
      { _id: { date: '2026-03-17', authAction: 'login_failed' }, count: 3 },
      { _id: { date: '2026-03-18', authAction: 'login_failed' }, count: 2 }
    ]

    mockAllAggregates({ trend: mockTrend, securityTrend: mockSecurityTrend })

    const result = await getStatistics({ period: '90d' })

    expect(result.granularity).toBe('weekly')
    // Trend should be rolled up: 03-17 and 03-18 are same week (Mon 03-16)
    // 03-24 is next week (Mon 03-23)
    expect(result.trend.length).toBeLessThanOrEqual(mockTrend.length)
    // Security trend should also be rolled up
    expect(result.securityTrend.length).toBeLessThanOrEqual(mockSecurityTrend.length)
  })

  it('handles custom period', async () => {
    mockAllAggregates({})

    const result = await getStatistics({
      period: 'custom',
      startDate: '2026-03-01T00:00:00Z',
      endDate: '2026-03-19T23:59:59Z'
    })

    expect(result.kpi).toBeDefined()
    // 19 days → daily granularity
    expect(result.granularity).toBe('daily')
  })

  it('uses weekly granularity for custom period > 30 days', async () => {
    mockAllAggregates({})

    const result = await getStatistics({
      period: 'custom',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-03-19T23:59:59Z'
    })

    expect(result.granularity).toBe('weekly')
  })
})

describe('getFilterOptions', () => {
  it('H3: returns merged and sorted filter options including pagePaths', async () => {
    mockDistinct
      .mockResolvedValueOnce(['admin', 'user1'])
      .mockResolvedValueOnce(['create', 'update'])
      .mockResolvedValueOnce(['login', 'logout'])
      .mockResolvedValueOnce(['cron_completed'])
      .mockResolvedValueOnce([])  // syncOperation
      .mockResolvedValueOnce(['/clients', '/users', '/'])

    const result = await getFilterOptions()

    expect(result.userIds).toEqual(['admin', 'user1'])
    expect(result.actions).toEqual(['create', 'cron_completed', 'login', 'logout', 'update'])
    expect(result.pagePaths).toEqual(['/', '/clients', '/users'])
  })

  it('H3: applies 90-day timestamp filter to distinct queries', async () => {
    mockDistinct
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])  // syncOperation
      .mockResolvedValueOnce([])

    await getFilterOptions()

    // Each distinct call should have a timestamp filter
    for (const call of mockDistinct.mock.calls) {
      expect(call[1]).toBeDefined()
      expect(call[1].timestamp).toBeDefined()
      expect(call[1].timestamp.$gte).toBeInstanceOf(Date)
    }
    // pagePath distinct should also filter by category: 'access'
    const pagePathCall = mockDistinct.mock.calls[5]
    expect(pagePathCall[0]).toBe('pagePath')
    expect(pagePathCall[1].category).toBe('access')
  })

  it('H3: caches unfiltered results for 60 seconds', async () => {
    mockDistinct
      .mockResolvedValueOnce(['admin'])
      .mockResolvedValueOnce(['create'])
      .mockResolvedValueOnce(['login'])
      .mockResolvedValueOnce(['cron_completed'])
      .mockResolvedValueOnce([])  // syncOperation
      .mockResolvedValueOnce(['/clients'])

    const result1 = await getFilterOptions()
    const result2 = await getFilterOptions()

    // Second call should use cache (only 6 distinct calls total, not 12)
    expect(mockDistinct).toHaveBeenCalledTimes(6)
    expect(result2).toEqual(result1)
  })

  it('H3: skips cache for filtered requests', async () => {
    // First call: unfiltered (cached)
    mockDistinct
      .mockResolvedValueOnce(['admin', 'user1'])
      .mockResolvedValueOnce(['create'])
      .mockResolvedValueOnce(['login'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])  // syncOperation
      .mockResolvedValueOnce([])

    await getFilterOptions()
    expect(mockDistinct).toHaveBeenCalledTimes(6)

    // Second call: with category filter (should NOT use cache)
    mockDistinct
      .mockResolvedValueOnce(['admin'])
      .mockResolvedValueOnce(['create'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])  // syncOperation
      .mockResolvedValueOnce([])

    const result = await getFilterOptions({ category: 'audit' })
    expect(mockDistinct).toHaveBeenCalledTimes(12) // 6 + 6 new calls

    // Should have category filter on userId/action distinct calls
    const userIdCall = mockDistinct.mock.calls[6]
    expect(userIdCall[1].category).toBe('audit')
  })

  it('cascading: category narrows userId, userId narrows action', async () => {
    mockDistinct
      .mockResolvedValueOnce(['admin'])       // userId with category filter
      .mockResolvedValueOnce(['create'])       // action with category + userId filter
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])  // syncOperation
      .mockResolvedValueOnce([])

    await getFilterOptions({ category: 'audit', userId: 'admin' })

    // userId distinct: should have category filter
    const userIdFilter = mockDistinct.mock.calls[0][1]
    expect(userIdFilter.category).toBe('audit')

    // action distinct: should have category + userId filter
    const actionFilter = mockDistinct.mock.calls[1][1]
    expect(actionFilter.category).toBe('audit')
    expect(actionFilter.userId).toBe('admin')
  })

  it('H3: filters out null/empty values', async () => {
    mockDistinct
      .mockResolvedValueOnce(['admin', null, '', 'user1'])
      .mockResolvedValueOnce([null, 'create'])
      .mockResolvedValueOnce(['login', null])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])  // syncOperation
      .mockResolvedValueOnce([null, '/clients'])

    const result = await getFilterOptions()

    expect(result.userIds).toEqual(['admin', 'user1'])
    expect(result.actions).toEqual(['create', 'login'])
    expect(result.pagePaths).toEqual(['/clients'])
  })
})

describe('eqp-redis category integration', () => {
  it('buildFilter: syncEqpId/syncError/syncOperation in search $or', async () => {
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

    await queryLogs({ search: 'EQP001' })

    const query = mockFind.mock.calls[0][0]
    const searchOr = query.$and[0].$or
    const fieldNames = searchOr.map(cond => Object.keys(cond)[0])
    expect(fieldNames).toContain('syncEqpId')
    expect(fieldNames).toContain('syncError')
    expect(fieldNames).toContain('syncOperation')
  })

  it('getStatistics: eqp-redis in KPI', async () => {
    const createChainableResult = (resolvedValue) => {
      const chain = {}
      chain.allowDiskUse = vi.fn().mockReturnValue(chain)
      chain.maxTimeMS = vi.fn().mockReturnValue(chain)
      chain.then = (resolve) => Promise.resolve(resolvedValue).then(resolve)
      chain.catch = (reject) => Promise.resolve(resolvedValue).catch(reject)
      return chain
    }

    const mockKpi = [
      { _id: 'audit', count: 10 },
      { _id: 'error', count: 5 },
      { _id: 'auth', count: 3 },
      { _id: 'batch', count: 2 },
      { _id: 'access', count: 20 },
      { _id: 'eqp-redis', count: 7 }
    ]

    mockAggregate
      .mockReturnValueOnce(createChainableResult(mockKpi))
      .mockReturnValueOnce(createChainableResult([]))
      .mockReturnValueOnce(createChainableResult([]))
      .mockReturnValueOnce(createChainableResult([]))
      .mockReturnValueOnce(createChainableResult([]))
      .mockReturnValueOnce(createChainableResult([]))
      .mockReturnValueOnce(createChainableResult([]))
      .mockReturnValueOnce(createChainableResult([]))

    const result = await getStatistics({ period: 'today' })

    expect(result.kpi['eqp-redis']).toBe(7)
    // total = 10+5+3+2+20+7 = 47
    expect(result.kpi.total).toBe(47)
  })

  it('getFilterOptions: syncOperation included in actions', async () => {
    mockDistinct
      .mockResolvedValueOnce(['admin'])          // userId
      .mockResolvedValueOnce(['create'])          // action
      .mockResolvedValueOnce(['login'])           // authAction
      .mockResolvedValueOnce(['cron_completed'])  // batchAction
      .mockResolvedValueOnce(['sync_create', 'sync_delete'])  // syncOperation
      .mockResolvedValueOnce(['/clients'])        // pagePath

    const result = await getFilterOptions()

    expect(result.actions).toContain('sync_create')
    expect(result.actions).toContain('sync_delete')
  })
})

describe('getFilterOptions — cache behavior', () => {
  it('첫 호출 → distinct 6회 실행', async () => {
    mockDistinct
      .mockResolvedValueOnce(['admin'])          // userId
      .mockResolvedValueOnce(['create'])          // action
      .mockResolvedValueOnce(['login'])           // authAction
      .mockResolvedValueOnce(['cron_completed'])  // batchAction
      .mockResolvedValueOnce(['sync_create'])     // syncOperation
      .mockResolvedValueOnce(['/clients'])        // pagePath

    await getFilterOptions()

    expect(mockDistinct).toHaveBeenCalledTimes(6)
  })

  it('캐시 유효 시 즉시 반환 → distinct 0회', async () => {
    mockDistinct
      .mockResolvedValueOnce(['admin'])
      .mockResolvedValueOnce(['create'])
      .mockResolvedValueOnce(['login'])
      .mockResolvedValueOnce(['cron_completed'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['/clients'])

    const result1 = await getFilterOptions()

    // Clear call counts after first call
    mockDistinct.mockClear()

    const result2 = await getFilterOptions()

    // Second call should NOT trigger any distinct calls
    expect(mockDistinct).toHaveBeenCalledTimes(0)
    expect(result2).toEqual(result1)
  })

  it('필터 있는 호출은 캐시 무시', async () => {
    // First: unfiltered → populates cache
    mockDistinct
      .mockResolvedValueOnce(['admin', 'user1'])
      .mockResolvedValueOnce(['create'])
      .mockResolvedValueOnce(['login'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['/clients'])

    await getFilterOptions()
    expect(mockDistinct).toHaveBeenCalledTimes(6)

    // Second: with filter → should bypass cache and call distinct again
    mockDistinct
      .mockResolvedValueOnce(['admin'])
      .mockResolvedValueOnce(['create'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await getFilterOptions({ category: 'auth' })

    expect(mockDistinct).toHaveBeenCalledTimes(12) // 6 + 6
  })

  it('캐시 만료 후 재실행', async () => {
    vi.useFakeTimers()

    try {
      mockDistinct
        .mockResolvedValueOnce(['admin'])
        .mockResolvedValueOnce(['create'])
        .mockResolvedValueOnce(['login'])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['/clients'])

      await getFilterOptions()
      expect(mockDistinct).toHaveBeenCalledTimes(6)

      // Advance time past CACHE_TTL (60000ms)
      vi.advanceTimersByTime(60001)

      mockDistinct
        .mockResolvedValueOnce(['admin', 'user2'])
        .mockResolvedValueOnce(['create', 'delete'])
        .mockResolvedValueOnce(['login', 'logout'])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['/clients', '/users'])

      await getFilterOptions()

      // Should have called distinct again after cache expiry
      expect(mockDistinct).toHaveBeenCalledTimes(12) // 6 + 6
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('getFilterOptions — promise locking', () => {
  it('동시 2회 호출 시 distinct 6회만 실행', async () => {
    mockDistinct.mockResolvedValue(['admin'])

    const [result1, result2] = await Promise.all([
      getFilterOptions(),
      getFilterOptions()
    ])

    // Both calls share the same promise → only 6 distinct calls total (not 12)
    expect(mockDistinct).toHaveBeenCalledTimes(6)
    expect(result1).toEqual(result2)
  })

  it('promise 실패 시 후속 호출은 재실행', async () => {
    // First call: all distincts reject
    mockDistinct.mockRejectedValue(new Error('DB error'))

    await expect(getFilterOptions()).rejects.toThrow('DB error')

    // Promise should be cleared after failure
    mockDistinct.mockClear()
    mockDistinct.mockResolvedValue(['admin'])

    const result = await getFilterOptions()

    // Second call should succeed and trigger new distinct calls
    expect(mockDistinct).toHaveBeenCalledTimes(6)
    expect(result.userIds).toEqual(['admin'])
  })
})

describe('rollupWeekly equivalence', () => {
  it('category 필드로 주간 롤업 — 같은 주 항목 합산', () => {
    // KST 기준: 2026-03-17(Tue, Mon key=03-16), 2026-03-18(Wed, Mon key=03-16), 2026-03-24(Mon, Mon key=03-23)
    const dailyData = [
      { _id: { date: '2026-03-17', category: 'audit' }, count: 10 },
      { _id: { date: '2026-03-18', category: 'audit' }, count: 20 },
      { _id: { date: '2026-03-24', category: 'audit' }, count: 15 }
    ]

    const result = rollupWeekly(dailyData, 'category')

    expect(result).toHaveLength(2)
    // First week: Mon 2026-03-16 → 10 + 20 = 30
    expect(result[0]).toEqual({ _id: { date: '2026-03-16', category: 'audit' }, count: 30 })
    // Second week: Mon 2026-03-23 → 15
    expect(result[1]).toEqual({ _id: { date: '2026-03-23', category: 'audit' }, count: 15 })
  })

  it('authAction 필드로 주간 롤업 — 같은 주 항목 합산', () => {
    // KST 기준: 2026-03-17(Tue), 2026-03-18(Wed) 모두 Mon key=03-16
    const dailyData = [
      { _id: { date: '2026-03-17', authAction: 'login_failed' }, count: 3 },
      { _id: { date: '2026-03-18', authAction: 'login_failed' }, count: 2 },
      { _id: { date: '2026-03-17', authAction: 'permission_denied' }, count: 1 }
    ]

    const result = rollupWeekly(dailyData, 'authAction')

    expect(result).toHaveLength(2)
    // Sorted by date then authAction
    expect(result[0]).toEqual({ _id: { date: '2026-03-16', authAction: 'login_failed' }, count: 5 })
    expect(result[1]).toEqual({ _id: { date: '2026-03-16', authAction: 'permission_denied' }, count: 1 })
  })

  it('빈 배열 입력 시 빈 배열 반환', () => {
    expect(rollupWeekly([], 'category')).toEqual([])
  })

  it('null groupField 값도 정상 처리', () => {
    const dailyData = [
      { _id: { date: '2026-03-16', authAction: null }, count: 5 }
    ]

    const result = rollupWeekly(dailyData, 'authAction')

    expect(result).toHaveLength(1)
    expect(result[0]._id.authAction).toBeNull()
    expect(result[0].count).toBe(5)
  })

  it('일요일 데이터가 이전 주 월요일로 그룹핑', () => {
    // KST 기준: 2026-03-23(Mon) 00:00 KST = 2026-03-22 15:00 UTC = UTC Sunday
    // → mondayOffset for Sunday(0) = -6, so Monday key = 2026-03-16
    const dailyData = [
      { _id: { date: '2026-03-23', category: 'error' }, count: 7 }
    ]

    const result = rollupWeekly(dailyData, 'category')

    // UTC Sunday → belongs to previous week starting Mon 2026-03-16
    expect(result).toHaveLength(1)
    expect(result[0]._id.date).toBe('2026-03-16')
    expect(result[0].count).toBe(7)
  })
})
