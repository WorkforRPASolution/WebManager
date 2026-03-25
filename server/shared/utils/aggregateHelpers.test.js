import { describe, it, expect, vi } from 'vitest'

// Dynamic import for CJS module
const { distinctWithCount } = await import('./aggregateHelpers.js')

describe('distinctWithCount', () => {
  function createMockModel(resolvedValue) {
    return { aggregate: vi.fn().mockResolvedValue(resolvedValue) }
  }

  it('groups and counts by field', async () => {
    const mockModel = createMockModel([
      { value: 'A', count: 3 },
      { value: 'B', count: 1 }
    ])

    const result = await distinctWithCount(mockModel, 'process')

    expect(result).toEqual([
      { value: 'A', count: 3 },
      { value: 'B', count: 1 }
    ])

    const pipeline = mockModel.aggregate.mock.calls[0][0]
    expect(pipeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ $group: { _id: '$process', count: { $sum: 1 } } }),
      expect.objectContaining({ $project: { _id: 0, value: '$_id', count: 1 } }),
      expect.objectContaining({ $sort: { value: 1 } })
    ]))
  })

  it('excludes null and empty string values by default', async () => {
    const mockModel = createMockModel([])

    await distinctWithCount(mockModel, 'process')

    const pipeline = mockModel.aggregate.mock.calls[0][0]
    const matchStage = pipeline.find(s => s.$match)
    expect(matchStage.$match.process).toEqual({ $nin: [null, ''] })
  })

  it('applies filter query to $match stage', async () => {
    const mockModel = createMockModel([])

    await distinctWithCount(mockModel, 'eqpModel', { process: 'CVD' })

    const pipeline = mockModel.aggregate.mock.calls[0][0]
    const matchStage = pipeline.find(s => s.$match)
    expect(matchStage.$match.process).toBe('CVD')
    expect(matchStage.$match.eqpModel).toEqual({ $nin: [null, ''] })
  })

  it('preserves $in operator in query', async () => {
    const mockModel = createMockModel([])

    await distinctWithCount(mockModel, 'eqpModel', { process: { $in: ['CVD', 'PHOTO'] } })

    const pipeline = mockModel.aggregate.mock.calls[0][0]
    const matchStage = pipeline.find(s => s.$match)
    expect(matchStage.$match.process).toEqual({ $in: ['CVD', 'PHOTO'] })
    expect(matchStage.$match.eqpModel).toEqual({ $nin: [null, ''] })
  })

  it('does not override field when it already has a filter', async () => {
    const mockModel = createMockModel([])

    await distinctWithCount(mockModel, 'process', { process: 'CVD' })

    const pipeline = mockModel.aggregate.mock.calls[0][0]
    const matchStage = pipeline.find(s => s.$match)
    // process already has a specific value, $nin should NOT be added
    expect(matchStage.$match.process).toBe('CVD')
  })

  it('returns empty array for empty collection', async () => {
    const mockModel = createMockModel([])

    const result = await distinctWithCount(mockModel, 'process')

    expect(result).toEqual([])
  })

  it('handles $regex in query', async () => {
    const mockModel = createMockModel([])
    const regex = { $regex: /^CVD/i }

    await distinctWithCount(mockModel, 'eqpModel', { process: regex })

    const pipeline = mockModel.aggregate.mock.calls[0][0]
    const matchStage = pipeline.find(s => s.$match)
    expect(matchStage.$match.process).toBe(regex)
  })
})
