import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAll,
  upsertCategories,
  deleteCategories,
  getDistinctScCategories,
  _setDeps
} from './recoveryCategoryService.js'

// Long duck-type 매처 (bson ESM/CJS 중복 대응)
function longVal(n) {
  return expect.objectContaining({ low: n, high: 0 })
}

// ── Mock Model ──

function createMockModel() {
  const docs = []
  return {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(docs)
      }),
      lean: vi.fn().mockResolvedValue(docs)
    }),
    findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    findOneAndUpdate: vi.fn().mockResolvedValue({ scCategory: 1, categoryName: 'PM' }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    _docs: docs
  }
}

function createMockEarsDb() {
  const distinctResult = [1, 2, 3]
  return {
    collection: vi.fn().mockReturnValue({
      distinct: vi.fn().mockResolvedValue(distinctResult)
    })
  }
}

// ── Mock audit log ──
vi.mock('../../shared/models/webmanagerLogModel', () => ({
  createActionLog: vi.fn().mockResolvedValue({})
}))

describe('recoveryCategoryService', () => {
  let mockModel, mockEarsDb

  beforeEach(() => {
    vi.clearAllMocks()
    mockModel = createMockModel()
    mockEarsDb = createMockEarsDb()
    _setDeps({ Model: mockModel, earsDb: mockEarsDb })
  })

  describe('getAll', () => {
    it('returns sorted list of category mappings', async () => {
      const result = await getAll()

      expect(mockModel.find).toHaveBeenCalledWith({})
      expect(result).toEqual([])
    })
  })

  describe('upsertCategories', () => {
    it('creates new category mapping when not exists', async () => {
      mockModel.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })

      const items = [{ scCategory: 1, categoryName: 'PM', description: 'Preventive Maintenance' }]
      const result = await upsertCategories(items, 'admin')

      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { scCategory: longVal(1) },
        expect.objectContaining({
          $set: expect.objectContaining({ scCategory: longVal(1), categoryName: 'PM', updatedBy: 'admin' })
        }),
        expect.objectContaining({ upsert: true })
      )
      expect(result).toHaveLength(1)
    })

    it('updates existing category mapping', async () => {
      mockModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ scCategory: 1, categoryName: 'Old Name' })
      })

      const items = [{ scCategory: 1, categoryName: 'New Name' }]
      await upsertCategories(items, 'admin')

      expect(mockModel.findOneAndUpdate).toHaveBeenCalled()
    })

    it('handles multiple items', async () => {
      mockModel.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })

      const items = [
        { scCategory: 1, categoryName: 'PM' },
        { scCategory: 2, categoryName: 'Vision' }
      ]
      const result = await upsertCategories(items, 'admin')

      expect(mockModel.findOneAndUpdate).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
    })
  })

  describe('deleteCategories', () => {
    it('deletes categories by scCategory list', async () => {
      mockModel.find.mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ scCategory: 1, categoryName: 'PM' }])
      })

      const result = await deleteCategories([1], 'admin')

      expect(mockModel.deleteMany).toHaveBeenCalledWith({ scCategory: { $in: [longVal(1)] } })
      expect(result.deletedCount).toBe(1)
    })

    it('returns 0 deletedCount when no matching docs', async () => {
      mockModel.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) })

      const result = await deleteCategories([999], 'admin')

      expect(result.deletedCount).toBe(0)
      expect(mockModel.deleteMany).not.toHaveBeenCalled()
    })
  })

  describe('getDistinctScCategories', () => {
    it('queries SC_PROPERTY for distinct scCategory values', async () => {
      const result = await getDistinctScCategories()

      expect(mockEarsDb.collection).toHaveBeenCalledWith('SC_PROPERTY')
      expect(result).toEqual([1, 2, 3])
    })
  })
})
