import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── helpers ──

function createMockCollection(opts = {}) {
  const toArrayFn = vi.fn().mockResolvedValue(opts.aggregateResult || [])
  return {
    aggregate: vi.fn().mockReturnValue({ toArray: toArrayFn }),
    _toArrayFn: toArrayFn
  }
}

function createMockDb(collectionOverrides = {}) {
  const collections = {}
  return {
    collection: vi.fn((name) => {
      if (!collections[name]) {
        collections[name] = collectionOverrides[name] || createMockCollection()
      }
      return collections[name]
    }),
    _collections: collections
  }
}

/**
 * Set up all pipeline results sequentially.
 * wmColl order: concurrent → activeUsersByBucket → 8 main pipelines (Promise.all)
 * userColl order: admin query → userProcessMap query
 */
function mockPipelines(coll, kpi, pageSummary, topUsers, recent, trend, heatmap = [], pageTrend = [], groupTrend = [], concurrentLogs = [], durationTrend = []) {
  coll._toArrayFn
    .mockResolvedValueOnce(concurrentLogs) // concurrent logs
    .mockResolvedValueOnce([])             // activeUsersByBucket (processTrend)
    .mockResolvedValueOnce(kpi)
    .mockResolvedValueOnce(pageSummary)
    .mockResolvedValueOnce(topUsers)
    .mockResolvedValueOnce(recent)
    .mockResolvedValueOnce(trend)
    .mockResolvedValueOnce(heatmap)
    .mockResolvedValueOnce(pageTrend)
    .mockResolvedValueOnce(groupTrend)
    .mockResolvedValueOnce(durationTrend)
}

/** Mock userColl: admin query + userProcessMap query */
function mockUserColl(userColl, admins = [], users = []) {
  userColl._toArrayFn
    .mockResolvedValueOnce(admins)   // admin filter query
    .mockResolvedValueOnce(users)    // userProcessMap query
}

let service, _setDeps

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('./webManagerService.js')
  service = mod
  _setDeps = mod._setDeps
})

describe('webManagerService', () => {
  describe('getWebManagerStats', () => {
    it('returns correct KPI structure', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      // Admin query returns empty (no admin filter)
      mockUserColl(userColl)

      mockPipelines(wmColl,
        [{ _users: ['u1', 'u2', 'u3'], totalVisits: 150, _cappedDurationSum: 300000, _validDurationCount: 10, _visitedPaths: ['/', '/clients', '/users'] }],
        [{ _id: '/', visitCount: 100, _users: ['u1', 'u2'], totalDurationMs: 500000, avgDurationMs: 5000 }],
        [{ _id: 'u1', visitCount: 80, totalDurationMs: 400000, lastVisitTime: new Date('2026-03-20') }],
        [{ userId: 'u1', pagePath: '/', pageName: 'Overview', enterTime: new Date('2026-03-20'), durationMs: 5000 }],
        [{ _id: '2026-03-20', visits: 50, _users: ['u1', 'u2'] }]
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '30d' })

      expect(result.kpi).toBeDefined()
      expect(result.kpi.activeUsers).toBe(3)
      expect(result.kpi.totalVisits).toBe(150)
      expect(result.kpi.visitedPages).toBe(3)
      expect(result.kpi.avgDurationMs).toBe(30000)
      expect(result.kpi.pageReachRate).toBeGreaterThan(0)
      expect(result.kpi.periodLabel).toBe('최근 30일')
    })

    it('returns zeros when data is empty', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)
      mockPipelines(wmColl, [], [], [], [], [])

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '30d' })

      expect(result.kpi.activeUsers).toBe(0)
      expect(result.kpi.totalVisits).toBe(0)
      expect(result.kpi.visitedPages).toBe(0)
      expect(result.kpi.pageReachRate).toBe(0)
      expect(result.kpi.avgDurationMs).toBe(0)
    })

    it('applies durationMs cap at 30 minutes', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      // avgDurationMs capped value
      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 2, _cappedDurationSum: 3600000, _validDurationCount: 2, _visitedPaths: ['/'] }],
        [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '7d' })

      // avgDurationMs = 3600000 / 2 = 1800000 (30min cap)
      expect(result.kpi.avgDurationMs).toBe(1800000)
    })

    it('excludes durationMs=0 from avg calculation', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      // _validDurationCount=0 means all durations were 0
      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 5, _cappedDurationSum: 0, _validDurationCount: 0, _visitedPaths: ['/'] }],
        [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '30d' })
      expect(result.kpi.avgDurationMs).toBe(0)
    })

    it('maps pageSummary with PAGE_MAP (pageName + menuGroup)', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 100, _cappedDurationSum: 100000, _validDurationCount: 10, _visitedPaths: ['/', '/clients'] }],
        [
          { _id: '/', visitCount: 60, _users: ['u1'], totalDurationMs: 300000, avgDurationMs: 5000 },
          { _id: '/clients', visitCount: 40, _users: ['u1'], totalDurationMs: 200000, avgDurationMs: 5000 }
        ],
        [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '30d' })

      expect(result.pageSummary).toHaveLength(2)
      expect(result.pageSummary[0].pageName).toBe('Overview')
      expect(result.pageSummary[0].menuGroup).toBe('Dashboard')
      expect(result.pageSummary[1].pageName).toBe('ARSAgent List')
      expect(result.pageSummary[1].menuGroup).toBe('Clients')
    })

    it('generates menuGroupSummary from pageSummary', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 100, _cappedDurationSum: 100000, _validDurationCount: 10, _visitedPaths: ['/', '/clients'] }],
        [
          { _id: '/', visitCount: 60, _users: ['u1'], totalDurationMs: 300000, avgDurationMs: 5000 },
          { _id: '/agent-monitor', visitCount: 20, _users: ['u1'], totalDurationMs: 100000, avgDurationMs: 5000 },
          { _id: '/clients', visitCount: 40, _users: ['u1'], totalDurationMs: 200000, avgDurationMs: 5000 }
        ],
        [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '30d' })

      expect(result.menuGroupSummary).toBeDefined()
      const dashboard = result.menuGroupSummary.find(g => g.menuGroup === 'Dashboard')
      expect(dashboard).toBeDefined()
      expect(dashboard.visitCount).toBe(80) // 60 + 20
      const clients = result.menuGroupSummary.find(g => g.menuGroup === 'Clients')
      expect(clients).toBeDefined()
      expect(clients.visitCount).toBe(40)
    })

    it('returns trend data sorted by date', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 10, _cappedDurationSum: 10000, _validDurationCount: 5, _visitedPaths: ['/'] }],
        [],
        [],
        [],
        [
          { _id: '2026-03-18', visits: 30, _users: ['u1', 'u2'] },
          { _id: '2026-03-19', visits: 40, _users: ['u1'] },
          { _id: '2026-03-20', visits: 50, _users: ['u1', 'u2', 'u3'] }
        ]
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '7d' })

      expect(result.trend).toHaveLength(3)
      expect(result.trend[0].date).toBe('2026-03-18')
      expect(result.trend[0].visits).toBe(30)
      expect(result.trend[0].uniqueUsers).toBe(2)
      expect(result.trend[2].uniqueUsers).toBe(3)
    })

    it('returns top users limited to 10 sorted by visitCount desc', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 10, _cappedDurationSum: 10000, _validDurationCount: 5, _visitedPaths: ['/'] }],
        [],
        [
          { _id: 'user1', visitCount: 100, totalDurationMs: 500000, lastVisitTime: new Date('2026-03-20') },
          { _id: 'user2', visitCount: 50, totalDurationMs: 200000, lastVisitTime: new Date('2026-03-19') }
        ],
        [],
        []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '30d' })

      expect(result.topUsers).toHaveLength(2)
      expect(result.topUsers[0].userId).toBe('user1')
      expect(result.topUsers[0].visitCount).toBe(100)
      expect(result.topUsers[1].userId).toBe('user2')
    })

    it('pipeline 3 (topUsers) has $limit:10', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)
      mockPipelines(wmColl,
        [{ _users: [], totalVisits: 0, _cappedDurationSum: 0, _validDurationCount: 0, _visitedPaths: [] }],
        [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d' })

      // Pipeline 3 = topUsers (index 2 of wmColl.aggregate calls)
      const topPipeline = wmColl.aggregate.mock.calls[4][0]
      const limitStage = topPipeline.find(s => s.$limit)
      expect(limitStage.$limit).toBe(10)
    })

    it('returns recent visits limited to 30 by default', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)
      mockPipelines(wmColl,
        [{ _users: [], totalVisits: 0, _cappedDurationSum: 0, _validDurationCount: 0, _visitedPaths: [] }],
        [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d' })

      const recentPipeline = wmColl.aggregate.mock.calls[5][0]
      const limitStage = recentPipeline.find(s => s.$limit)
      expect(limitStage.$limit).toBe(30)
    })

    it('recent visits uses noLimit=10000 when specified', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      // noLimit=true triggers early return — only recent pipeline runs
      mockUserColl(userColl)
      wmColl._toArrayFn.mockResolvedValueOnce([])

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d', noLimit: true })

      // Early return: only 1 aggregate call (recent pipeline)
      expect(wmColl.aggregate).toHaveBeenCalledTimes(1)
      const recentPipeline = wmColl.aggregate.mock.calls[0][0]
      const limitStage = recentPipeline.find(s => s.$limit)
      expect(limitStage.$limit).toBe(10000)
    })

    it('filters admin users when includeAdmin=false', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      // Return admin user IDs + empty userProcessMap
      mockUserColl(userColl, [{ singleid: 'admin1' }, { singleid: 'admin2' }])

      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 10, _cappedDurationSum: 10000, _validDurationCount: 5, _visitedPaths: ['/'] }],
        [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d', includeAdmin: false })

      // All 5 pipelines should have userId: { $nin: ['admin1', 'admin2'] }
      const calls = wmColl.aggregate.mock.calls
      expect(calls.length).toBe(11)
      for (const [pipeline] of calls) {
        const matchStage = pipeline.find(s => s.$match)
        expect(matchStage.$match.userId).toEqual({ $nin: ['admin1', 'admin2'] })
      }
    })

    it('skips admin filter when includeAdmin=true', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      // userProcessMap query only (no admin query)
      userColl._toArrayFn.mockResolvedValueOnce([])

      // Should NOT query admin users when includeAdmin=true
      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 10, _cappedDurationSum: 10000, _validDurationCount: 5, _visitedPaths: ['/'] }],
        [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d', includeAdmin: true })

      // userColl should be called once (userProcessMap only, not admin filter)
      expect(userColl.aggregate).toHaveBeenCalledTimes(1)
      // Pipelines should not have userId $nin
      const calls = wmColl.aggregate.mock.calls
      for (const [pipeline] of calls) {
        const matchStage = pipeline.find(s => s.$match)
        expect(matchStage.$match.userId).toBeUndefined()
      }
    })

    it('uses WEBMANAGER_LOG collection with category=access', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)
      mockPipelines(wmColl,
        [{ _users: [], totalVisits: 0, _cappedDurationSum: 0, _validDurationCount: 0, _visitedPaths: [] }],
        [], [], [], []
      )

      const wmDb = createMockDb({ 'WEBMANAGER_LOG': wmColl })
      _setDeps({
        webManagerDb: wmDb,
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d' })

      expect(wmDb.collection).toHaveBeenCalledWith('WEBMANAGER_LOG')
      // All pipelines should match category=access
      for (const [pipeline] of wmColl.aggregate.mock.calls) {
        const matchStage = pipeline.find(s => s.$match)
        expect(matchStage.$match.category).toBe('access')
      }
    })

    it('computes period range for period=30d', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)
      mockPipelines(wmColl,
        [{ _users: [], totalVisits: 0, _cappedDurationSum: 0, _validDurationCount: 0, _visitedPaths: [] }],
        [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d' })

      const matchStage = wmColl.aggregate.mock.calls[3][0].find(s => s.$match)
      expect(matchStage.$match.timestamp).toBeDefined()
      expect(matchStage.$match.timestamp.$gte).toBeInstanceOf(Date)
      expect(matchStage.$match.timestamp.$lte).toBeInstanceOf(Date)
    })

    it('computes custom period with startDate and endDate', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)
      mockPipelines(wmColl,
        [{ _users: [], totalVisits: 0, _cappedDurationSum: 0, _validDurationCount: 0, _visitedPaths: [] }],
        [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({
        period: 'custom',
        startDate: '2026-03-01',
        endDate: '2026-03-15'
      })

      const matchStage = wmColl.aggregate.mock.calls[3][0].find(s => s.$match)
      expect(matchStage.$match.timestamp.$gte).toBeInstanceOf(Date)
      expect(matchStage.$match.timestamp.$lte).toBeInstanceOf(Date)
    })

    it('returns correct period labels', async () => {
      const periods = [
        { period: 'all', expected: '최근 90일' },
        { period: 'today', expected: '최근 24시간' },
        { period: '7d', expected: '최근 7일' },
        { period: '30d', expected: '최근 30일' },
        { period: 'custom', expected: '커스텀' }
      ]

      for (const { period, expected } of periods) {
        vi.resetModules()
        const mod = await import('./webManagerService.js')

        const wmColl = createMockCollection()
        const userColl = createMockCollection()
        mockUserColl(userColl)
        mockPipelines(wmColl,
          [{ _users: [], totalVisits: 0, _cappedDurationSum: 0, _validDurationCount: 0, _visitedPaths: [] }],
          [], [], [], []
        )

        mod._setDeps({
          webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
          earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
        })

        const result = await mod.getWebManagerStats({
          period,
          startDate: period === 'custom' ? '2026-03-01' : undefined,
          endDate: period === 'custom' ? '2026-03-15' : undefined
        })
        expect(result.kpi.periodLabel).toBe(expected)
      }
    })

    it('handles unknown page paths gracefully', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 10, _cappedDurationSum: 10000, _validDurationCount: 5, _visitedPaths: ['/unknown-page'] }],
        [{ _id: '/unknown-page', visitCount: 10, _users: ['u1'], totalDurationMs: 10000, avgDurationMs: 1000 }],
        [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '30d' })

      expect(result.pageSummary).toHaveLength(1)
      expect(result.pageSummary[0].pageName).toBe('/unknown-page')
      expect(result.pageSummary[0].menuGroup).toBe('Other')
    })

    it('normalizes dynamic client paths', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      // Pipeline should contain $addFields for path normalization
      mockPipelines(wmColl,
        [{ _users: [], totalVisits: 0, _cappedDurationSum: 0, _validDurationCount: 0, _visitedPaths: [] }],
        [],
        [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d' })

      // Pipeline 2 (pageSummary) should have path normalization
      const pagePipeline = wmColl.aggregate.mock.calls[3][0]
      const addFieldsStage = pagePipeline.find(s => s.$addFields && s.$addFields._normalizedPath)
      expect(addFieldsStage).toBeDefined()
    })

    it('all 5 pipelines use allowDiskUse', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)
      mockPipelines(wmColl,
        [{ _users: [], totalVisits: 0, _cappedDurationSum: 0, _validDurationCount: 0, _visitedPaths: [] }],
        [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d' })

      expect(wmColl.aggregate).toHaveBeenCalledTimes(11)
      for (const call of wmColl.aggregate.mock.calls) {
        expect(call[1]).toEqual(expect.objectContaining({ allowDiskUse: true }))
      }
    })

    it('returns hourlyHeatmap data with hour and dayOfWeek', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 10, _cappedDurationSum: 10000, _validDurationCount: 5, _visitedPaths: ['/'] }],
        [], [], [], [],
        [
          { hour: 9, dayOfWeek: 2, count: 25 },
          { hour: 10, dayOfWeek: 2, count: 30 },
          { hour: 14, dayOfWeek: 4, count: 15 }
        ],
        []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '30d' })

      expect(result.hourlyHeatmap).toHaveLength(3)
      expect(result.hourlyHeatmap[0]).toEqual({ hour: 9, dayOfWeek: 2, count: 25 })
      expect(result.hourlyHeatmap[1].hour).toBe(10)
    })

    it('returns pageTrend with date × pageName visits', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 10, _cappedDurationSum: 10000, _validDurationCount: 5, _visitedPaths: ['/'] }],
        [], [], [], [],
        [],
        [
          { _id: { date: '2026-03-18', path: '/' }, visits: 30 },
          { _id: { date: '2026-03-18', path: '/clients' }, visits: 10 },
          { _id: { date: '2026-03-19', path: '/' }, visits: 25 },
          { _id: { date: '2026-03-19', path: '/settings' }, visits: 5 }
        ]
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '7d' })

      expect(result.pageTrend).toHaveLength(2)
      expect(result.pageTrend[0].date).toBe('2026-03-18')
      expect(result.pageTrend[0]['Overview']).toBe(30)
      expect(result.pageTrend[0]['ARSAgent List']).toBe(10)
      expect(result.pageTrend[1].date).toBe('2026-03-19')
      expect(result.pageTrend[1]['Overview']).toBe(25)
      expect(result.pageTrend[1]['Settings']).toBe(5)
    })

    it('heatmap pipeline groups by hour and dayOfWeek with KST timezone', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)
      mockPipelines(wmColl,
        [{ _users: [], totalVisits: 0, _cappedDurationSum: 0, _validDurationCount: 0, _visitedPaths: [] }],
        [], [], [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d' })

      // Pipeline 6 = heatmap (index 5)
      const heatmapPipeline = wmColl.aggregate.mock.calls[7][0]
      const groupStage = heatmapPipeline.find(s => s.$group)
      expect(groupStage.$group._id.hour.$hour.timezone).toBe('+09:00')
      expect(groupStage.$group._id.dayOfWeek.$dayOfWeek.timezone).toBe('+09:00')
    })

    it('pageTrend pipeline uses path normalization and groups by path', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)
      mockPipelines(wmColl,
        [{ _users: [], totalVisits: 0, _cappedDurationSum: 0, _validDurationCount: 0, _visitedPaths: [] }],
        [], [], [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d' })

      // Pipeline 7 = pageTrend (index 6)
      const pageTrendPipeline = wmColl.aggregate.mock.calls[8][0]
      const hasNormalization = pageTrendPipeline.some(s => s.$addFields && s.$addFields._normalizedPath)
      expect(hasNormalization).toBe(true)
      const groupStage = pageTrendPipeline.find(s => s.$group)
      expect(groupStage.$group._id.path).toBe('$_normalizedPath')
    })

    it('noLimit=true returns only recentVisits (skips heavy pipelines)', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      // includeAdmin=true → admin 쿼리 건너뜀, noLimit=true → early return
      // nameList 조회용 mock
      userColl._toArrayFn.mockResolvedValueOnce([{ singleid: 'u1', name: 'User1' }])

      wmColl._toArrayFn
        .mockResolvedValueOnce([
          { userId: 'u1', pagePath: '/', pageName: 'Overview', enterTime: new Date('2026-03-20'), durationMs: 5000 }
        ])

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '30d', noLimit: true, includeAdmin: true })

      // Should only have recentVisits, everything else empty/default
      expect(result.recentVisits).toHaveLength(1)
      expect(result.recentVisits[0].userId).toBe('u1')
      expect(result.recentVisits[0].name).toBe('User1')
      // Only 1 aggregate call (recent pipeline only)
      expect(wmColl.aggregate).toHaveBeenCalledTimes(1)
      // userColl: 1 call for nameList (no admin filter, no userProcessMap)
      expect(userColl.aggregate).toHaveBeenCalledTimes(1)
    })

    it('noLimit=true with includeAdmin=false still applies admin filter to recent', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      // M3: admin/name 통합 1회 조회 — singleid + name + authorityManager
      userColl._toArrayFn.mockResolvedValueOnce([
        { singleid: 'admin1', name: 'Admin', authorityManager: 1 },
        { singleid: 'user1', name: 'User1' }
      ])

      wmColl._toArrayFn.mockResolvedValueOnce([])

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d', noLimit: true, includeAdmin: false })

      // M3: admin filter + nameList가 1번의 통합 쿼리로 합쳐짐 (이중 쿼리 제거)
      expect(userColl.aggregate).toHaveBeenCalledTimes(1)
      // Only 1 aggregate call for recent
      expect(wmColl.aggregate).toHaveBeenCalledTimes(1)
      const recentPipeline = wmColl.aggregate.mock.calls[0][0]
      const matchStage = recentPipeline.find(s => s.$match)
      expect(matchStage.$match.userId).toEqual({ $nin: ['admin1'] })
    })

    it('pageReachRate calculates visited/total * 100', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      // 3 visited paths out of TOTAL_PAGES
      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 30, _cappedDurationSum: 100000, _validDurationCount: 10, _visitedPaths: ['/', '/clients', '/users'] }],
        [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '30d' })

      // TOTAL_PAGES should be the length of PAGE_MAP
      expect(result.kpi.totalPages).toBeGreaterThan(0)
      expect(result.kpi.pageReachRate).toBeCloseTo((3 / result.kpi.totalPages) * 100, 1)
    })

    it('weekly durationTrend uses average mode (not sum)', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      // period='all' → granularity='weekly' → rollupWeekly 호출
      // durationTrend에 같은 주(월요일 기준)에 3일치 데이터 제공
      // 각 일별 Overview 평균: 60000, 90000, 120000 → 평균 = 90000
      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 10, _cappedDurationSum: 10000, _validDurationCount: 5, _visitedPaths: ['/'] }],
        [], [], [], [],
        [],  // heatmap
        [],  // pageTrend
        [],  // groupTrend
        [],  // concurrentLogs
        [    // durationTrend — 03-17(화), 03-18(수), 03-19(목) = 같은 주
          { _id: { date: '2026-03-17', path: '/' }, avgDurationMs: 60000 },
          { _id: { date: '2026-03-18', path: '/' }, avgDurationMs: 90000 },
          { _id: { date: '2026-03-19', path: '/' }, avgDurationMs: 120000 }
        ]
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: 'all' })

      // 3일이 같은 주로 묶임 → 평균 = (60000+90000+120000)/3 = 90000
      expect(result.durationTrend).toHaveLength(1)
      expect(result.durationTrend[0]['Overview']).toBe(90000)
    })

    it('concurrent.average is total session time / period duration', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)

      // 3 sessions: each 1 hour (3600000ms)
      // Total session time = 3h = 10800000ms
      // Period = 7d → 604800000ms
      // Average = 10800000 / 604800000 ≈ 0.0179 → rounds to 0
      // Use bigger sessions: 3 sessions of 24h = 72h
      // Average = 259200000 / 604800000 ≈ 0.4286 → 0.4
      // Even bigger: 10 sessions of 24h each
      // Average = 864000000 / 604800000 ≈ 1.4286 → 1.4
      const now = new Date()
      const baseTime = new Date(now.getTime() - 5 * 86400000) // 5 days ago
      const concurrentLogs = []
      for (let i = 0; i < 10; i++) {
        const enter = new Date(baseTime.getTime() + i * 3600000)
        concurrentLogs.push({
          enterTime: enter,
          leaveTime: new Date(enter.getTime() + 86400000) // 24h sessions
        })
      }

      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 10, _cappedDurationSum: 10000, _validDurationCount: 5, _visitedPaths: ['/'] }],
        [], [], [], [],
        [], [], [],
        concurrentLogs
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      const result = await service.getWebManagerStats({ period: '7d' })

      // average should be totalSessionMs / periodDurationMs
      // 10 sessions × 24h = 240h = 864000000ms
      // period = 7d = 604800000ms
      // average ≈ 1.4
      expect(result.concurrent.average).toBeGreaterThan(1)
      expect(result.concurrent.average).toBeLessThan(2)
      // peak should still work
      expect(result.concurrent.peak).toBeGreaterThan(0)
    })

    it('recentMode=user groups by userId and returns latest visit per user', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)
      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 10, _cappedDurationSum: 10000, _validDurationCount: 5, _visitedPaths: ['/'] }],
        [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d', recentMode: 'user' })

      // recent pipeline (index 5) should have $group by userId
      const recentPipeline = wmColl.aggregate.mock.calls[5][0]
      const groupStage = recentPipeline.find(s => s.$group)
      expect(groupStage).toBeDefined()
      expect(groupStage.$group._id).toBe('$userId')
    })

    it('recentMode=detail (default) uses standard pipeline without $group', async () => {
      const wmColl = createMockCollection()
      const userColl = createMockCollection()

      mockUserColl(userColl)
      mockPipelines(wmColl,
        [{ _users: ['u1'], totalVisits: 10, _cappedDurationSum: 10000, _validDurationCount: 5, _visitedPaths: ['/'] }],
        [], [], [], []
      )

      _setDeps({
        webManagerDb: createMockDb({ 'WEBMANAGER_LOG': wmColl }),
        earsDb: createMockDb({ 'ARS_USER_INFO': userColl })
      })

      await service.getWebManagerStats({ period: '30d' })

      // recent pipeline (index 5) should NOT have $group
      const recentPipeline = wmColl.aggregate.mock.calls[5][0]
      const groupStage = recentPipeline.find(s => s.$group)
      expect(groupStage).toBeUndefined()
    })
  })
})
