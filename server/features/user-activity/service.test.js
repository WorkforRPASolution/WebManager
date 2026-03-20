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
    it('returns correct KPI structure (3 fields)', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 150, activeUsers: 87, totalAccessNum: 6345 }],
        [{ singleid: 'user1', name: '홍길동', accessnum: 350, _procs: ['DIFF'], latestExecution: '2026-03-15T10:00:00.000+09:00' }],
        [{ singleid: 'user1', name: '홍길동', accessnum: 350, _procs: ['DIFF'], latestExecution: '2026-03-15T10:00:00.000+09:00' }],
        [{ _id: 'DIFF', totalUsers: 30, activeUsers: 20 }]
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      const result = await service.getToolUsage({ period: 'all' })

      expect(result.kpi).toEqual({
        totalUsers: 150, activeUsers: 87, usageRate: 58, periodLabel: '전체'
      })
      expect(result.topUsers).toHaveLength(1)
      expect(result.topUsers[0].process).toBe('DIFF')
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
    })

    it('applies process filter using _procs field', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 30, activeUsers: 20, totalAccessNum: 600 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: '7d', process: 'DIFF' })

      const calls = coll.aggregate.mock.calls
      expect(calls).toHaveLength(4)
      for (const [pipeline] of calls) {
        const matchStage = pipeline.find(s => s.$match)
        expect(matchStage.$match._procs).toBe('DIFF')
      }
    })

    it('multi-process filter produces $in on _procs', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 50, activeUsers: 30, totalAccessNum: 500 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: 'all', process: 'DIFF,ETCH' })

      const calls = coll.aggregate.mock.calls
      const kpiMatch = calls[0][0].find(s => s.$match)
      expect(kpiMatch.$match._procs).toEqual({ $in: ['DIFF', 'ETCH'] })
    })

    it('all pipelines have NORMALIZE_PROCESSES_STAGE as first step', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 10, activeUsers: 5, totalAccessNum: 100 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: 'all' })

      const calls = coll.aggregate.mock.calls
      for (const [pipeline] of calls) {
        const firstStage = pipeline[0]
        expect(firstStage.$addFields).toBeDefined()
        expect(firstStage.$addFields._procs).toBeDefined()
      }
    })

    it('period=7d applies latestExecution filter to all pipelines', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 50, activeUsers: 15, totalAccessNum: 300 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: '7d' })

      const calls = coll.aggregate.mock.calls

      // KPI: $cond with latestExecution
      expect(JSON.stringify(calls[0][0])).toContain('latestExecution')
      // Top10: $match.latestExecution.$gte
      const topMatch = calls[1][0].find(s => s.$match)
      expect(topMatch.$match.latestExecution.$gte).toBeDefined()
      // Recent: $match.latestExecution
      const recentMatch = calls[2][0].find(s => s.$match)
      expect(recentMatch.$match.latestExecution).toBeDefined()
      // Process: $cond with latestExecution
      expect(JSON.stringify(calls[3][0])).toContain('latestExecution')
    })

    it('period=all does not filter by latestExecution', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 100, activeUsers: 80, totalAccessNum: 5000 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: 'all' })

      const topMatch = coll.aggregate.mock.calls[1][0].find(s => s.$match)
      expect(topMatch.$match.latestExecution).toBeUndefined()
    })

    it('custom period uses startDate only', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 60, activeUsers: 40, totalAccessNum: 1200 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: 'custom', startDate: '2026-03-01' })

      const kpiStr = JSON.stringify(coll.aggregate.mock.calls[0][0])
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

    it('does not filter by accountStatus', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 50, activeUsers: 30, totalAccessNum: 300 }], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: 'all' })

      for (const [pipeline] of coll.aggregate.mock.calls) {
        const matchStage = pipeline.find(s => s.$match)
        expect(matchStage.$match.accountStatus).toBeUndefined()
      }
    })

    it('recentUsers sorts valid latestExecution before null/empty (period=all)', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 3, activeUsers: 3, totalAccessNum: 30 }],
        [],
        [
          { singleid: 'u1', name: 'A', accessnum: 5, _procs: ['DIFF'], latestExecution: '2026-03-20T10:00:00.000+09:00' },
          { singleid: 'u2', name: 'B', accessnum: 3, _procs: ['ETCH'], latestExecution: '' }
        ],
        []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      const result = await service.getToolUsage({ period: 'all' })

      const recentPipeline = coll.aggregate.mock.calls[2][0]
      const addFieldsStages = recentPipeline.filter(s => s.$addFields)
      // First $addFields = normalize, second = _hasExecution
      const hasExecutionStage = addFieldsStages.find(s => s.$addFields._hasExecution)
      expect(hasExecutionStage).toBeDefined()

      const sortStage = recentPipeline.find(s => s.$sort)
      expect(sortStage.$sort._hasExecution).toBe(-1)
      expect(result.recentUsers[0].singleid).toBe('u1')
    })

    it('recentUsers with period skips _hasExecution', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 10, activeUsers: 5, totalAccessNum: 100 }],
        [],
        [{ singleid: 'u1', name: 'A', accessnum: 5, _procs: ['DIFF'], latestExecution: '2026-03-20T10:00:00.000+09:00' }],
        []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: '7d' })

      const recentPipeline = coll.aggregate.mock.calls[2][0]
      const hasExecutionStage = recentPipeline.filter(s => s.$addFields).find(s => s.$addFields._hasExecution)
      expect(hasExecutionStage).toBeUndefined()
    })

    it('processSummary uses $unwind on _procs (normalized)', async () => {
      const coll = createMockCollection()
      mockFourPipelines(coll,
        [{ totalUsers: 10, activeUsers: 5, totalAccessNum: 100 }], [], [],
        [{ _id: 'CVD', totalUsers: 5, activeUsers: 3 }, { _id: 'ETCH', totalUsers: 5, activeUsers: 2 }]
      )
      _setDeps({ earsDb: createMockEarsDb({ 'ARS_USER_INFO': coll }) })

      await service.getToolUsage({ period: 'all' })

      const processPipeline = coll.aggregate.mock.calls[3][0]
      const unwindStage = processPipeline.find(s => s.$unwind)
      expect(unwindStage.$unwind).toBe('$_procs')
    })
  })
})
