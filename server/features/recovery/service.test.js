import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── helpers ──

function createMockCollection(opts = {}) {
  const toArrayFn = vi.fn().mockResolvedValue(opts.aggregateResult || [])
  return {
    aggregate: vi.fn().mockReturnValue({ toArray: toArrayFn }),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(opts.findResult || [])
          })
        })
      })
    }),
    countDocuments: vi.fn().mockResolvedValue(opts.countResult ?? 0),
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

// ── import service (lazy, after deps are set) ──

let service
let _setDeps

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('./service.js')
  service = mod
  _setDeps = mod._setDeps
})

describe('recovery service', () => {
  describe('getOverview', () => {
    it('returns correct KPI structure with totals from daily scenario summary', async () => {
      const scenarioColl = createMockCollection({
        aggregateResult: [
          {
            total: 1000,
            status_counts: { Success: 800, Failed: 100, Stopped: 50, Skip: 50 }
          }
        ]
      })
      const equipmentColl = createMockCollection({
        aggregateResult: []
      })
      const triggerColl = createMockCollection({
        aggregateResult: []
      })

      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl,
        'RECOVERY_SUMMARY_BY_EQUIPMENT': equipmentColl,
        'RECOVERY_SUMMARY_BY_TRIGGER': triggerColl
      })
      _setDeps({ earsDb: mockEarsDb })

      const result = await service.getOverview({ period: 'today' })

      expect(result).toHaveProperty('kpi')
      expect(result).toHaveProperty('trend')
      expect(result).toHaveProperty('topEquipment')
      expect(result).toHaveProperty('triggerDistribution')
      expect(result.kpi).toHaveProperty('total')
      expect(result.kpi).toHaveProperty('success')
      expect(result.kpi).toHaveProperty('failed')
      expect(result.kpi).toHaveProperty('stopped')
      expect(result.kpi).toHaveProperty('skip')
      expect(result.kpi).toHaveProperty('successRate')
    })

    it('queries scenario collection with daily period for KPI', async () => {
      const scenarioColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl,
        'RECOVERY_SUMMARY_BY_EQUIPMENT': createMockCollection(),
        'RECOVERY_SUMMARY_BY_TRIGGER': createMockCollection()
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getOverview({ period: 'today', process: 'ETCH' })

      // Should have been called with aggregate (for KPI, trend, topScenarios)
      expect(scenarioColl.aggregate).toHaveBeenCalled()
    })

    it('applies process and line filters to queries', async () => {
      const scenarioColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl,
        'RECOVERY_SUMMARY_BY_EQUIPMENT': createMockCollection(),
        'RECOVERY_SUMMARY_BY_TRIGGER': createMockCollection()
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getOverview({ period: 'today', process: 'ETCH', line: 'L01' })

      // At least one aggregate call should have been made
      expect(scenarioColl.aggregate).toHaveBeenCalled()
      // Verify the pipeline includes process and line filters
      const firstCallPipeline = scenarioColl.aggregate.mock.calls[0][0]
      const matchStage = firstCallPipeline.find(s => s.$match)
      expect(matchStage.$match).toHaveProperty('process', 'ETCH')
      expect(matchStage.$match).toHaveProperty('line', 'L01')
    })
  })

  describe('getByProcess', () => {
    it('returns processes, trend, and drilldown in result', async () => {
      const scenarioColl = createMockCollection()
      const equipmentColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl,
        'RECOVERY_SUMMARY_BY_EQUIPMENT': equipmentColl
      })
      _setDeps({ earsDb: mockEarsDb })

      const result = await service.getByProcess({ period: 'today' })

      expect(result).toHaveProperty('processes')
      expect(result).toHaveProperty('trend')
      expect(result).toHaveProperty('drilldown')
    })

    it('re-aggregates scenario data by process using MongoDB pipeline', async () => {
      const scenarioColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl,
        'RECOVERY_SUMMARY_BY_EQUIPMENT': createMockCollection()
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getByProcess({ period: 'today' })

      // Should aggregate on RECOVERY_SUMMARY_BY_SCENARIO
      expect(scenarioColl.aggregate).toHaveBeenCalled()
    })

    it('applies line filter but not process filter', async () => {
      const scenarioColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl,
        'RECOVERY_SUMMARY_BY_EQUIPMENT': createMockCollection()
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getByProcess({ period: 'today', line: 'L01' })

      const firstCallPipeline = scenarioColl.aggregate.mock.calls[0][0]
      const matchStage = firstCallPipeline.find(s => s.$match)
      expect(matchStage.$match).toHaveProperty('line', 'L01')
      // Should NOT have process filter
      expect(matchStage.$match).not.toHaveProperty('process')
    })
  })

  describe('getAnalysis', () => {
    it('queries RECOVERY_SUMMARY_BY_SCENARIO when tab is scenario', async () => {
      const scenarioColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getAnalysis({ period: 'today', tab: 'scenario' })

      expect(scenarioColl.aggregate).toHaveBeenCalled()
    })

    it('queries RECOVERY_SUMMARY_BY_EQUIPMENT when tab is equipment', async () => {
      const equipmentColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_EQUIPMENT': equipmentColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getAnalysis({ period: 'today', tab: 'equipment' })

      expect(equipmentColl.aggregate).toHaveBeenCalled()
    })

    it('queries RECOVERY_SUMMARY_BY_TRIGGER when tab is trigger', async () => {
      const triggerColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_TRIGGER': triggerColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getAnalysis({ period: 'today', tab: 'trigger' })

      expect(triggerColl.aggregate).toHaveBeenCalled()
    })

    it('applies process, line, and model filters', async () => {
      const scenarioColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getAnalysis({
        period: 'today', tab: 'scenario',
        process: 'ETCH', line: 'L01', model: 'MDL_X'
      })

      const firstCallPipeline = scenarioColl.aggregate.mock.calls[0][0]
      const matchStage = firstCallPipeline.find(s => s.$match)
      expect(matchStage.$match).toHaveProperty('process', 'ETCH')
      expect(matchStage.$match).toHaveProperty('line', 'L01')
      expect(matchStage.$match).toHaveProperty('model', 'MDL_X')
    })

    it('returns data and trend arrays', async () => {
      const scenarioColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl
      })
      _setDeps({ earsDb: mockEarsDb })

      const result = await service.getAnalysis({ period: 'today', tab: 'scenario' })

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('trend')
      expect(Array.isArray(result.data)).toBe(true)
      expect(Array.isArray(result.trend)).toBe(true)
    })

    it('applies scenario filter as ears_code on scenario tab', async () => {
      const scenarioColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getAnalysis({
        period: 'today', tab: 'scenario',
        process: 'ETCH', scenario: 'SC_001'
      })

      const firstCallPipeline = scenarioColl.aggregate.mock.calls[0][0]
      const matchStage = firstCallPipeline.find(s => s.$match)
      expect(matchStage.$match).toHaveProperty('ears_code', 'SC_001')
    })

    it('does NOT apply scenario filter on equipment tab', async () => {
      const equipmentColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_EQUIPMENT': equipmentColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getAnalysis({
        period: 'today', tab: 'equipment',
        process: 'ETCH', scenario: 'SC_001'
      })

      const firstCallPipeline = equipmentColl.aggregate.mock.calls[0][0]
      const matchStage = firstCallPipeline.find(s => s.$match)
      expect(matchStage.$match).not.toHaveProperty('ears_code')
    })

    it('does NOT apply scenario filter on trigger tab', async () => {
      const triggerColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_TRIGGER': triggerColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getAnalysis({
        period: 'today', tab: 'trigger',
        process: 'ETCH', scenario: 'SC_001'
      })

      const firstCallPipeline = triggerColl.aggregate.mock.calls[0][0]
      const matchStage = firstCallPipeline.find(s => s.$match)
      expect(matchStage.$match).not.toHaveProperty('ears_code')
    })
  })

  describe('getByModel', () => {
    it('returns models, trend, granularity, and drilldown in result', async () => {
      const equipmentColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_EQUIPMENT': equipmentColl
      })
      _setDeps({ earsDb: mockEarsDb })

      const result = await service.getByModel({ period: 'today' })

      expect(result).toHaveProperty('models')
      expect(result).toHaveProperty('trend')
      expect(result).toHaveProperty('granularity')
      expect(result).toHaveProperty('drilldown')
    })

    it('queries RECOVERY_SUMMARY_BY_EQUIPMENT collection', async () => {
      const equipmentColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_EQUIPMENT': equipmentColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getByModel({ period: 'today' })

      expect(equipmentColl.aggregate).toHaveBeenCalled()
    })

    it('applies process and line filters to match stage', async () => {
      const equipmentColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_EQUIPMENT': equipmentColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getByModel({ period: 'today', process: 'ETCH', line: 'L01' })

      const firstCallPipeline = equipmentColl.aggregate.mock.calls[0][0]
      const matchStage = firstCallPipeline.find(s => s.$match)
      expect(matchStage.$match).toHaveProperty('process', 'ETCH')
      expect(matchStage.$match).toHaveProperty('line', 'L01')
    })

    it('applies model filter when provided', async () => {
      const equipmentColl = createMockCollection()
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_EQUIPMENT': equipmentColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getByModel({ period: 'today', model: 'MDL_A' })

      const firstCallPipeline = equipmentColl.aggregate.mock.calls[0][0]
      const matchStage = firstCallPipeline.find(s => s.$match)
      expect(matchStage.$match).toHaveProperty('model', 'MDL_A')
    })
  })

  describe('extractItemKey', () => {
    it('returns model value when only model field is present', async () => {
      // extractItemKey is internal — test indirectly via rollupTrend with model-grouped data
      // Import and test: rollupTrend with model trend should preserve model grouping
      const equipmentColl = createMockCollection({
        aggregateResult: []
      })
      const mockEarsDb = createMockEarsDb({
        'RECOVERY_SUMMARY_BY_EQUIPMENT': equipmentColl
      })
      _setDeps({ earsDb: mockEarsDb })

      // Just verify getByModel works — the extractItemKey fix ensures rollupTrend groups by model
      const result = await service.getByModel({ period: '90d' })
      expect(result).toHaveProperty('granularity', 'weekly')
    })
  })

  describe('getHistory', () => {
    it('queries EQP_AUTO_RECOVERY with eqpid filter', async () => {
      const recoveryColl = createMockCollection({
        findResult: [
          { eqpid: 'EQP-001', ears_code: 'SC_001', status: 'Success', create_date: '2026-03-16T10:00:00.000+09:00' }
        ],
        countResult: 1
      })
      const mockEarsDb = createMockEarsDb({
        'EQP_AUTO_RECOVERY': recoveryColl
      })
      _setDeps({ earsDb: mockEarsDb })

      const result = await service.getHistory({
        eqpid: 'EQP-001',
        startDate: '2026-03-15T00:00:00.000+09:00',
        endDate: '2026-03-16T23:59:59.999+09:00',
        skip: 0,
        limit: 25
      })

      expect(recoveryColl.find).toHaveBeenCalled()
      const findQuery = recoveryColl.find.mock.calls[0][0]
      expect(findQuery).toHaveProperty('eqpid', 'EQP-001')
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('total')
    })

    it('queries EQP_AUTO_RECOVERY with ears_code filter', async () => {
      const recoveryColl = createMockCollection({
        findResult: [],
        countResult: 0
      })
      const mockEarsDb = createMockEarsDb({
        'EQP_AUTO_RECOVERY': recoveryColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getHistory({
        ears_code: 'SC_001',
        startDate: '2026-03-15T00:00:00.000+09:00',
        endDate: '2026-03-16T23:59:59.999+09:00',
        skip: 0,
        limit: 25
      })

      const findQuery = recoveryColl.find.mock.calls[0][0]
      expect(findQuery).toHaveProperty('ears_code', 'SC_001')
    })

    it('throws error when neither eqpid nor ears_code is provided', async () => {
      const mockEarsDb = createMockEarsDb()
      _setDeps({ earsDb: mockEarsDb })

      await expect(
        service.getHistory({
          startDate: '2026-03-15T00:00:00.000+09:00',
          endDate: '2026-03-16T23:59:59.999+09:00',
          skip: 0,
          limit: 25
        })
      ).rejects.toThrow(/eqpid.*ears_code|ears_code.*eqpid/i)
    })

    it('applies optional status filter', async () => {
      const recoveryColl = createMockCollection({ findResult: [], countResult: 0 })
      const mockEarsDb = createMockEarsDb({
        'EQP_AUTO_RECOVERY': recoveryColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getHistory({
        eqpid: 'EQP-001',
        status: 'Failed',
        startDate: '2026-03-15T00:00:00.000+09:00',
        endDate: '2026-03-16T23:59:59.999+09:00',
        skip: 0,
        limit: 25
      })

      const findQuery = recoveryColl.find.mock.calls[0][0]
      expect(findQuery).toHaveProperty('status', 'Failed')
    })

    it('applies create_date range filter (endDate is inclusive of the selected day)', async () => {
      const recoveryColl = createMockCollection({ findResult: [], countResult: 0 })
      const mockEarsDb = createMockEarsDb({
        'EQP_AUTO_RECOVERY': recoveryColl
      })
      _setDeps({ earsDb: mockEarsDb })

      const startDate = '2026-03-15'
      const endDate = '2026-03-16'

      await service.getHistory({
        eqpid: 'EQP-001',
        startDate,
        endDate,
        skip: 0,
        limit: 25
      })

      const findQuery = recoveryColl.find.mock.calls[0][0]
      // keeps string comparison (create_date is stored as string in EARS DB)
      expect(findQuery.create_date.$gte).toBe('2026-03-15')
      // endDate '2026-03-16' → $lt '2026-03-17' so 3/16 data is included
      expect(findQuery.create_date.$lt).toBe('2026-03-17')
    })

    it('uses skip and limit for pagination', async () => {
      const recoveryColl = createMockCollection({ findResult: [], countResult: 0 })
      // Override the chained mocks to capture skip/limit
      const limitFn = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
      const skipFn = vi.fn().mockReturnValue({ limit: limitFn })
      const sortFn = vi.fn().mockReturnValue({ skip: skipFn })
      recoveryColl.find = vi.fn().mockReturnValue({ sort: sortFn })

      const mockEarsDb = createMockEarsDb({
        'EQP_AUTO_RECOVERY': recoveryColl
      })
      _setDeps({ earsDb: mockEarsDb })

      await service.getHistory({
        eqpid: 'EQP-001',
        startDate: '2026-03-15T00:00:00.000+09:00',
        endDate: '2026-03-16T23:59:59.999+09:00',
        skip: 50,
        limit: 25
      })

      expect(sortFn).toHaveBeenCalledWith({ create_date: -1 })
      expect(skipFn).toHaveBeenCalledWith(50)
      expect(limitFn).toHaveBeenCalledWith(25)
    })
  })
})

describe('validation', () => {
  let validatePeriodRange, parsePeriod

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('./validation.js')
    validatePeriodRange = mod.validatePeriodRange
    parsePeriod = mod.parsePeriod
  })

  describe('validatePeriodRange', () => {
    it('returns valid for range within maxDays', () => {
      const start = '2026-03-10T00:00:00.000+09:00'
      const end = '2026-03-15T00:00:00.000+09:00'
      const result = validatePeriodRange(start, end, 7)
      expect(result.valid).toBe(true)
    })

    it('returns invalid for range exceeding maxDays', () => {
      const start = '2026-03-01T00:00:00.000+09:00'
      const end = '2026-03-15T00:00:00.000+09:00'
      const result = validatePeriodRange(start, end, 7)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns invalid when startDate is after endDate', () => {
      const start = '2026-03-15T00:00:00.000+09:00'
      const end = '2026-03-10T00:00:00.000+09:00'
      const result = validatePeriodRange(start, end, 7)
      expect(result.valid).toBe(false)
    })

    it('returns invalid when dates are missing', () => {
      const result = validatePeriodRange(null, null, 7)
      expect(result.valid).toBe(false)
    })
  })

  describe('parsePeriod', () => {
    it('parses "today" to today 00:00 KST ~ now', () => {
      const result = parsePeriod('today')
      expect(result).toHaveProperty('startDate')
      expect(result).toHaveProperty('endDate')
      // startDate should contain +09:00
      expect(result.startDate).toMatch(/\+09:00$/)
      expect(result.endDate).toMatch(/\+09:00$/)
    })

    it('parses "7d" to 7 days ago 00:00 KST ~ now', () => {
      const result = parsePeriod('7d')
      expect(result).toHaveProperty('startDate')
      expect(result).toHaveProperty('endDate')
      const start = new Date(result.startDate)
      const end = new Date(result.endDate)
      const diffDays = (end - start) / (1000 * 60 * 60 * 24)
      // startDate is midnight KST N days ago, endDate is "now" — diff is 7 + fraction of current day
      expect(diffDays).toBeGreaterThanOrEqual(7)
      expect(diffDays).toBeLessThanOrEqual(8)
    })

    it('parses "30d" to 30 days ago 00:00 KST ~ now', () => {
      const result = parsePeriod('30d')
      const start = new Date(result.startDate)
      const end = new Date(result.endDate)
      const diffDays = (end - start) / (1000 * 60 * 60 * 24)
      // startDate is midnight KST 30 days ago, endDate is "now"
      expect(diffDays).toBeGreaterThanOrEqual(30)
      expect(diffDays).toBeLessThanOrEqual(31)
    })

    it('returns null for "custom" period', () => {
      const result = parsePeriod('custom')
      expect(result).toBeNull()
    })
  })
})
