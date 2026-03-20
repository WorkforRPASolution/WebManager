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

/** Create mock with 5 pipeline results */
function mockFivePipelines(coll, scenarioKpi, processSummary, modKpi, topAuthors, recent) {
  coll._toArrayFn
    .mockResolvedValueOnce(scenarioKpi)
    .mockResolvedValueOnce(processSummary)
    .mockResolvedValueOnce(modKpi)
    .mockResolvedValueOnce(topAuthors)
    .mockResolvedValueOnce(recent)
}

let service, _setDeps

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('./scenarioService.js')
  service = mod
  _setDeps = mod._setDeps
})

describe('scenarioService', () => {
  describe('getScenarioStats', () => {
    it('returns correct KPI structure (5 fields)', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 450, activeScenarios: 380 }],
        [{ _id: 'DIFF', total: 50, active: 40, performanceFilled: 30 }],
        [{ modifiedScenarios: ['s1', 's2'], activeAuthors: ['a1', 'a2', 'a3'] }],
        [{ _id: 'youngsoo', modificationCount: 120, scenarios: ['s1', 's2'] }],
        [{ scname: 'SC1', process: 'DIFF', eqpModel: 'M1', _ownerId: 'youngsoo', _ownerTimestamp: '2026-01-25 08:11:33' }]
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      const result = await service.getScenarioStats({ period: 'all' })

      expect(result.kpi).toEqual({
        totalScenarios: 450,
        activeScenarios: 380,
        modifiedScenarios: 2,
        activeAuthors: 3,
        periodLabel: '전체'
      })
      expect(result.processSummary).toHaveLength(1)
      expect(result.topAuthors).toHaveLength(1)
      expect(result.recentModifications).toHaveLength(1)
    })

    it('returns zeros when data is empty', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll, [], [], [], [], [])
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      const result = await service.getScenarioStats({ period: 'all' })

      expect(result.kpi.totalScenarios).toBe(0)
      expect(result.kpi.activeScenarios).toBe(0)
      expect(result.kpi.modifiedScenarios).toBe(0)
      expect(result.kpi.activeAuthors).toBe(0)
    })

    it('applies single process filter ($match.process)', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 50, activeScenarios: 40 }], [], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      await service.getScenarioStats({ period: 'all', process: 'DIFF' })

      const calls = coll.aggregate.mock.calls
      expect(calls).toHaveLength(5)
      for (const [pipeline] of calls) {
        const matchStage = pipeline.find(s => s.$match)
        expect(matchStage.$match.process).toBe('DIFF')
      }
    })

    it('applies multi-process filter ($in)', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 100, activeScenarios: 80 }], [], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      await service.getScenarioStats({ period: 'all', process: 'DIFF,ETCH' })

      const calls = coll.aggregate.mock.calls
      const kpiMatch = calls[0][0].find(s => s.$match)
      expect(kpiMatch.$match.process).toEqual({ $in: ['DIFF', 'ETCH'] })
    })

    it('period=all skips timestamp $match filter on pipelines 3-5', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 10, activeScenarios: 5 }], [], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      await service.getScenarioStats({ period: 'all' })

      // Pipelines 3,4,5 should not have $match with _ownerTimestamp filter
      for (const idx of [2, 3, 4]) {
        const pipeline = coll.aggregate.mock.calls[idx][0]
        const matchStages = pipeline.filter(s => s.$match)
        for (const m of matchStages) {
          expect(m.$match._ownerTimestamp).toBeUndefined()
        }
      }
    })

    it('period=7d applies _ownerTimestamp filter on pipelines 3-5', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 50, activeScenarios: 40 }], [], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      await service.getScenarioStats({ period: '7d' })

      // Pipeline 3 (modKpi)
      const modKpiStr = JSON.stringify(coll.aggregate.mock.calls[2][0])
      expect(modKpiStr).toContain('_ownerTimestamp')
      // Pipeline 4 (topAuthors)
      const topStr = JSON.stringify(coll.aggregate.mock.calls[3][0])
      expect(topStr).toContain('_ownerTimestamp')
      // Pipeline 5 (recent)
      const recentStr = JSON.stringify(coll.aggregate.mock.calls[4][0])
      expect(recentStr).toContain('_ownerTimestamp')
    })

    it('period=custom uses startDate with space-separated format', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 60, activeScenarios: 40 }], [], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      await service.getScenarioStats({ period: 'custom', startDate: '2026-03-01' })

      const modKpiStr = JSON.stringify(coll.aggregate.mock.calls[2][0])
      expect(modKpiStr).toContain('2026-03-01 00:00:00')
    })

    it('returns correct period label', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 10, activeScenarios: 5 }], [], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      const result = await service.getScenarioStats({ period: '30d' })
      expect(result.kpi.periodLabel).toBe('최근 30일')
    })

    it('all 5 pipelines use SC_PROPERTY collection', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 10, activeScenarios: 5 }], [], [], [], []
      )
      const mockDb = createMockEarsDb({ 'SC_PROPERTY': coll })
      _setDeps({ earsDb: mockDb })

      await service.getScenarioStats({ period: 'all' })

      expect(mockDb.collection).toHaveBeenCalledWith('SC_PROPERTY')
      expect(coll.aggregate).toHaveBeenCalledTimes(5)
    })

    it('pipeline 1 (scenarioKpi) has no $unwind', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 10, activeScenarios: 5 }], [], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      await service.getScenarioStats({ period: 'all' })

      const kpiPipeline = coll.aggregate.mock.calls[0][0]
      const hasUnwind = kpiPipeline.some(s => s.$unwind)
      expect(hasUnwind).toBe(false)
    })

    it('pipeline 2 groups by process', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 10, activeScenarios: 5 }],
        [{ _id: 'DIFF', total: 5, active: 3, performanceFilled: 2 }],
        [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      await service.getScenarioStats({ period: 'all' })

      const processPipeline = coll.aggregate.mock.calls[1][0]
      const groupStage = processPipeline.find(s => s.$group)
      expect(groupStage.$group._id).toBe('$process')
    })

    it('pipeline 4 limits to 10', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 10, activeScenarios: 5 }], [], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      await service.getScenarioStats({ period: 'all' })

      const topPipeline = coll.aggregate.mock.calls[3][0]
      const limitStage = topPipeline.find(s => s.$limit)
      expect(limitStage.$limit).toBe(10)
    })

    it('pipeline 5 limits to 30 and sorts desc', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 10, activeScenarios: 5 }], [], [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      await service.getScenarioStats({ period: 'all' })

      const recentPipeline = coll.aggregate.mock.calls[4][0]
      const limitStage = recentPipeline.find(s => s.$limit)
      expect(limitStage.$limit).toBe(30)
      const sortStage = recentPipeline.find(s => s.$sort)
      expect(sortStage.$sort._ownerTimestamp).toBe(-1)
    })

    it('processSummary includes performanceFilled and performanceRate', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 50, activeScenarios: 40 }],
        [{ _id: 'DIFF', total: 50, active: 40, performanceFilled: 30 }],
        [], [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      const result = await service.getScenarioStats({ period: 'all' })

      expect(result.processSummary[0].performanceFilled).toBe(30)
      expect(result.processSummary[0].performanceRate).toBeCloseTo(60, 0)
    })

    it('pipeline 3 uses $addToSet for deduplication (modifiedScenarios, activeAuthors)', async () => {
      const coll = createMockCollection()
      mockFivePipelines(coll,
        [{ totalScenarios: 10, activeScenarios: 5 }], [],
        [{ modifiedScenarios: ['s1', 's2'], activeAuthors: ['a1'] }],
        [], []
      )
      _setDeps({ earsDb: createMockEarsDb({ 'SC_PROPERTY': coll }) })

      await service.getScenarioStats({ period: 'all' })

      const modPipeline = coll.aggregate.mock.calls[2][0]
      const groupStage = modPipeline.find(s => s.$group)
      expect(groupStage.$group.modifiedScenarios.$addToSet).toBeDefined()
      expect(groupStage.$group.activeAuthors.$addToSet).toBeDefined()
    })
  })
})
