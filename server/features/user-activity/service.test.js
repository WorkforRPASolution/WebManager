import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── helpers ──

function createMockCollection(opts = {}) {
  const toArrayFn = vi.fn().mockResolvedValue(opts.aggregateResult || [])
  return {
    aggregate: vi.fn().mockReturnValue({ toArray: toArrayFn }),
    _toArrayFn: toArrayFn
  }
}

function createMockEarsDb(collectionOverrides = {}) {
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

/** Create mock with 4 pipeline results */
function mockFourPipelines(coll, kpi, top, recent, process) {
  coll._toArrayFn
    .mockResolvedValueOnce(kpi)
    .mockResolvedValueOnce(top)
    .mockResolvedValueOnce(recent)
    .mockResolvedValueOnce(process)
}

let service, _setDeps

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('./service.js')
  service = mod
  _setDeps = mod._setDeps
})

describe('user-activity service', () => {
  describe('getToolUsage', () => {
    it('returns correct KPI structure (3 fields, no periodActiveUsers)', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 150, activeUsers: 87, totalAccessNum: 6345 }],
        [{ singleid: 'user1', name: '홍길동', accessnum: 350, processes: ['DIFF'], latestExecution: '2026-03-15T10:00:00.000+09:00' }],
        [{ singleid: 'user1', name: '홍길동', accessnum: 350, processes: ['DIFF'], latestExecution: '2026-03-15T10:00:00.000+09:00' }],
        [{ _id: 'DIFF', totalUsers: 30, activeUsers: 20 }]
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      const result = await service.getToolUsage({ period: 'all' })

      expect(result.kpi).toEqual({
        totalUsers: 150,
        activeUsers: 87,
        usageRate: 58,
        periodLabel: '전체'
      })
      expect(result).not.toHaveProperty('kpi.periodActiveUsers')
      expect(result.topUsers).toHaveLength(1)
      expect(result.recentUsers).toHaveLength(1)
      expect(result.processSummary).toHaveLength(1)
      expect(result.processSummary[0].usageRate).toBeCloseTo(66.7, 1)
    })

    it('returns zero usageRate when totalUsers is 0', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 0, activeUsers: 0, totalAccessNum: 0 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      const result = await service.getToolUsage({ period: 'all' })

      expect(result.kpi.usageRate).toBe(0)
      expect(result.topUsers).toHaveLength(0)
      expect(result.recentUsers).toHaveLength(0)
    })

    it('applies process filter to all 4 pipelines', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 30, activeUsers: 20, totalAccessNum: 600 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: '7d', process: 'DIFF' })

      const calls = coll.aggregate.mock.calls
      expect(calls).toHaveLength(4)
      // All pipelines should have process in $match
      for (const [pipeline] of calls) {
        const matchStage = pipeline.find(s => s.$match)
        expect(matchStage.$match.processes).toBe('DIFF')
      }
    })

    it('multi-process filter produces $in operator', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 50, activeUsers: 30, totalAccessNum: 500 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: 'all', process: 'DIFF,ETCH' })

      const calls = coll.aggregate.mock.calls
      const kpiMatch = calls[0][0].find(s => s.$match)
      expect(kpiMatch.$match.processes).toEqual({ $in: ['DIFF', 'ETCH'] })
    })

    it('period=7d applies latestExecution filter to all pipelines', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 50, activeUsers: 15, totalAccessNum: 300 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: '7d' })

      const calls = coll.aggregate.mock.calls

      // KPI pipeline: activeUsers uses $cond with latestExecution
      const kpiPipeline = calls[0][0]
      const kpiStr = JSON.stringify(kpiPipeline)
      expect(kpiStr).toContain('latestExecution')

      // Top10 pipeline: $match includes latestExecution $gte
      const topMatch = calls[1][0].find(s => s.$match)
      expect(topMatch.$match.latestExecution).toBeDefined()
      expect(topMatch.$match.latestExecution.$gte).toBeDefined()

      // Recent pipeline: $match includes latestExecution $gte
      const recentMatch = calls[2][0].find(s => s.$match)
      expect(recentMatch.$match.latestExecution).toBeDefined()

      // Process pipeline: uses $cond with latestExecution
      const processStr = JSON.stringify(calls[3][0])
      expect(processStr).toContain('latestExecution')
    })

    it('period=all does not filter by latestExecution in top/recent pipelines', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 100, activeUsers: 80, totalAccessNum: 5000 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: 'all' })

      const calls = coll.aggregate.mock.calls
      // Top10: no latestExecution in $match
      const topMatch = calls[1][0].find(s => s.$match)
      expect(topMatch.$match.latestExecution).toBeUndefined()
    })

    it('custom period uses startDate only (end is now)', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 60, activeUsers: 40, totalAccessNum: 1200 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: 'custom', startDate: '2026-03-01' })

      const calls = coll.aggregate.mock.calls
      const kpiStr = JSON.stringify(calls[0][0])
      expect(kpiStr).toContain('2026-03-01')
      expect(kpiStr).not.toContain('$lt')
    })

    it('returns period label correctly', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 10, activeUsers: 5, totalAccessNum: 100 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      const result = await service.getToolUsage({ period: '30d' })
      expect(result.kpi.periodLabel).toBe('최근 30일')
    })

    it('filters only active account users', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 50, activeUsers: 30, totalAccessNum: 300 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: 'all' })

      const calls = coll.aggregate.mock.calls
      for (const [pipeline] of calls) {
        const matchStage = pipeline.find(s => s.$match)
        expect(matchStage.$match.accountStatus).toBeUndefined()
      }
    })

    it('recentUsers sorts valid latestExecution before null/empty (period=all)', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 3, activeUsers: 3, totalAccessNum: 30 }],
        [],
        // recent pipeline returns in order
        [
          { singleid: 'u1', name: 'A', accessnum: 5, processes: ['DIFF'], latestExecution: '2026-03-20T10:00:00.000+09:00' },
          { singleid: 'u2', name: 'B', accessnum: 3, processes: ['ETCH'], latestExecution: '' },
          { singleid: 'u3', name: 'C', accessnum: 8, processes: ['CVD'], latestExecution: null }
        ],
        []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      const result = await service.getToolUsage({ period: 'all' })

      // Verify pipeline has _hasExecution sort for period=all
      const calls = coll.aggregate.mock.calls
      const recentPipeline = calls[2][0]
      const addFieldsStage = recentPipeline.find(s => s.$addFields)
      expect(addFieldsStage).toBeDefined()
      expect(addFieldsStage.$addFields._hasExecution).toBeDefined()
      const sortStage = recentPipeline.find(s => s.$sort)
      expect(sortStage.$sort._hasExecution).toBe(-1)
      expect(sortStage.$sort.latestExecution).toBe(-1)

      // Result reflects the mock order
      expect(result.recentUsers[0].singleid).toBe('u1')
    })

    it('recentUsers with period skips _hasExecution (all have valid dates)', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 10, activeUsers: 5, totalAccessNum: 100 }],
        [],
        [{ singleid: 'u1', name: 'A', accessnum: 5, processes: ['DIFF'], latestExecution: '2026-03-20T10:00:00.000+09:00' }],
        []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: '7d' })

      const calls = coll.aggregate.mock.calls
      const recentPipeline = calls[2][0]
      // No _hasExecution needed — $match already filters by latestExecution
      const addFieldsStage = recentPipeline.find(s => s.$addFields)
      expect(addFieldsStage).toBeUndefined()
    })
  })
})
