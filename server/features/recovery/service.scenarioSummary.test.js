import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── helpers ──

function createMockAggregateCollection(results) {
  const toArrayFn = vi.fn().mockResolvedValue(results)
  return {
    aggregate: vi.fn().mockReturnValue({ toArray: toArrayFn }),
    _toArrayFn: toArrayFn
  }
}

function createMockEarsDb(collectionOverrides = {}) {
  return {
    collection: vi.fn((name) => collectionOverrides[name] || createMockAggregateCollection([]))
  }
}

let service
let _setDeps

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('./service.js')
  service = mod
  _setDeps = mod._setDeps
})

describe('getScenarioSummary', () => {
  it('집계 결과를 data/total 구조로 반환한다', async () => {
    const facetResult = [{
      data: [
        {
          process: 'CVD',
          model: 'M1',
          ears_code: 'SC001',
          total: 100,
          success: 90,
          fail: 10,
          scCategory: 2,
          categoryName: 'Vacuum',
          lastModifier: 'alice (2026-04-15 10:23)'
        }
      ],
      total: [{ count: 1 }]
    }]

    const scenarioColl = createMockAggregateCollection(facetResult)
    _setDeps({ earsDb: createMockEarsDb({ 'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl }) })

    const result = await service.getScenarioSummary({ period: '30d' }, { skip: 0, limit: 50 })

    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('total')
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.data[0]).toMatchObject({
      process: 'CVD',
      model: 'M1',
      ears_code: 'SC001',
      total: 100,
      success: 90,
      fail: 10,
      categoryName: 'Vacuum',
      lastModifier: 'alice (2026-04-15 10:23)'
    })
  })

  it('total 배열이 비어있으면 total=0을 반환한다', async () => {
    const facetResult = [{ data: [], total: [] }]
    const scenarioColl = createMockAggregateCollection(facetResult)
    _setDeps({ earsDb: createMockEarsDb({ 'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl }) })

    const result = await service.getScenarioSummary({ period: '7d' }, { skip: 0, limit: 50 })

    expect(result.data).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('집계 결과가 빈 배열이면 data=[], total=0을 반환한다', async () => {
    const scenarioColl = createMockAggregateCollection([])
    _setDeps({ earsDb: createMockEarsDb({ 'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl }) })

    const result = await service.getScenarioSummary({ period: '30d' }, { skip: 0, limit: 50 })

    expect(result.data).toEqual([])
    expect(result.total).toBe(0)
  })

  it('process 필터가 전달되면 aggregate에 전달된 파이프라인에 process $match가 포함된다', async () => {
    const facetResult = [{ data: [], total: [] }]
    const scenarioColl = createMockAggregateCollection(facetResult)
    _setDeps({ earsDb: createMockEarsDb({ 'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl }) })

    await service.getScenarioSummary({ period: '30d', process: 'CVD' }, { skip: 0, limit: 50 })

    const pipeline = scenarioColl.aggregate.mock.calls[0][0]
    const matchStage = pipeline.find(s => s.$match)
    expect(matchStage).toBeDefined()
    expect(matchStage.$match.process).toBe('CVD')
  })

  it('process가 쉼표 구분 다중값이면 $in 조건으로 변환된다', async () => {
    const facetResult = [{ data: [], total: [] }]
    const scenarioColl = createMockAggregateCollection(facetResult)
    _setDeps({ earsDb: createMockEarsDb({ 'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl }) })

    await service.getScenarioSummary({ period: '30d', process: 'CVD,PVD' }, { skip: 0, limit: 50 })

    const pipeline = scenarioColl.aggregate.mock.calls[0][0]
    const matchStage = pipeline.find(s => s.$match)
    expect(matchStage.$match.process).toEqual({ $in: ['CVD', 'PVD'] })
  })

  it('skip/limit이 파이프라인 $facet data 분기에 반영된다', async () => {
    const facetResult = [{ data: [], total: [] }]
    const scenarioColl = createMockAggregateCollection(facetResult)
    _setDeps({ earsDb: createMockEarsDb({ 'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl }) })

    await service.getScenarioSummary({ period: '30d' }, { skip: 25, limit: 25 })

    const pipeline = scenarioColl.aggregate.mock.calls[0][0]
    const facetStage = pipeline.find(s => s.$facet)
    expect(facetStage).toBeDefined()

    const dataStages = facetStage.$facet.data
    const skipStage = dataStages.find(s => s.$skip !== undefined)
    const limitStage = dataStages.find(s => s.$limit !== undefined)
    expect(skipStage.$skip).toBe(25)
    expect(limitStage.$limit).toBe(25)
  })

  it('파이프라인에 $sort {process:1, model:1, ears_code:1} 스테이지가 포함된다', async () => {
    const facetResult = [{ data: [], total: [] }]
    const scenarioColl = createMockAggregateCollection(facetResult)
    _setDeps({ earsDb: createMockEarsDb({ 'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl }) })

    await service.getScenarioSummary({ period: '30d' }, { skip: 0, limit: 50 })

    const pipeline = scenarioColl.aggregate.mock.calls[0][0]
    const sortStage = pipeline.find(s => s.$sort)
    expect(sortStage).toBeDefined()
    // $group 이후 정렬은 _id 내부 필드로 참조
    expect(sortStage.$sort).toEqual({ '_id.process': 1, '_id.model': 1, '_id.ears_code': 1 })
  })

  it('파이프라인에 SC_PROPERTY $lookup 스테이지가 포함된다', async () => {
    const facetResult = [{ data: [], total: [] }]
    const scenarioColl = createMockAggregateCollection(facetResult)
    _setDeps({ earsDb: createMockEarsDb({ 'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl }) })

    await service.getScenarioSummary({ period: '30d' }, { skip: 0, limit: 50 })

    const pipeline = scenarioColl.aggregate.mock.calls[0][0]
    const facetStage = pipeline.find(s => s.$facet)
    const dataStages = facetStage.$facet.data
    const scLookup = dataStages.find(s => s.$lookup && s.$lookup.from === 'SC_PROPERTY')
    expect(scLookup).toBeDefined()
    // $group 이후 ears_code는 _id.ears_code 안에 있음
    expect(scLookup.$lookup.localField).toBe('_id.ears_code')
    expect(scLookup.$lookup.foreignField).toBe('scname')
  })

  it('파이프라인에 RECOVERY_CATEGORY_MAP $lookup 스테이지가 포함된다', async () => {
    const facetResult = [{ data: [], total: [] }]
    const scenarioColl = createMockAggregateCollection(facetResult)
    _setDeps({ earsDb: createMockEarsDb({ 'RECOVERY_SUMMARY_BY_SCENARIO': scenarioColl }) })

    await service.getScenarioSummary({ period: '30d' }, { skip: 0, limit: 50 })

    const pipeline = scenarioColl.aggregate.mock.calls[0][0]
    const facetStage = pipeline.find(s => s.$facet)
    const dataStages = facetStage.$facet.data
    const catLookup = dataStages.find(s => s.$lookup && s.$lookup.from === 'RECOVERY_CATEGORY_MAP')
    expect(catLookup).toBeDefined()
  })
})
