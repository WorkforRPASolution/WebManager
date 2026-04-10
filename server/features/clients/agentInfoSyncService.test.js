import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncOnCreate, syncOnUpdate, syncOnDelete, _setDeps } from './agentInfoSyncService.js'

// Long duck-type 매처 (bson ESM/CJS 중복 대응)
function longVal(n) {
  return expect.objectContaining({ low: n, high: 0 })
}

// ── Mock Model ──

function createMockModel() {
  return {
    bulkWrite: vi.fn().mockResolvedValue({ modifiedCount: 0, upsertedCount: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 })
  }
}

function createMockLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}

describe('agentInfoSyncService', () => {
  let mockModel, mockLog

  beforeEach(() => {
    vi.clearAllMocks()
    mockModel = createMockModel()
    mockLog = createMockLog()
    _setDeps({ Model: mockModel, log: mockLog })
  })

  // ── syncOnCreate ──

  describe('syncOnCreate', () => {
    it('upserts AGENT_INFO for each created doc', async () => {
      const docs = [
        { eqpId: 'EQP_001', ipAddr: '10.0.0.1' },
        { eqpId: 'EQP_002', ipAddr: '10.0.0.2' }
      ]

      const result = await syncOnCreate(docs)

      expect(mockModel.bulkWrite).toHaveBeenCalledTimes(1)
      const ops = mockModel.bulkWrite.mock.calls[0][0]
      expect(ops).toHaveLength(2)

      // 첫 번째 op: eqpId 필터, IpAddr $set, 기본값 $setOnInsert
      expect(ops[0]).toEqual({
        updateOne: {
          filter: { eqpId: 'EQP_001' },
          update: {
            $set: { IpAddr: '10.0.0.1' },
            $setOnInsert: {
              arsagent: longVal(0),
              resourceagent: longVal(1),
              aimmagent: longVal(0),
              arsagentJava: longVal(1)
            }
          },
          upsert: true
        }
      })

      expect(ops[1].updateOne.filter).toEqual({ eqpId: 'EQP_002' })
      expect(ops[1].updateOne.update.$set.IpAddr).toBe('10.0.0.2')

      expect(result.synced).toBe(2)
      expect(result.failed).toBe(0)
    })

    it('returns early for empty array', async () => {
      const result = await syncOnCreate([])

      expect(mockModel.bulkWrite).not.toHaveBeenCalled()
      expect(result.synced).toBe(0)
    })

    it('handles bulkWrite error gracefully', async () => {
      mockModel.bulkWrite.mockRejectedValue(new Error('bulk fail'))

      const docs = [{ eqpId: 'EQP_001', ipAddr: '10.0.0.1' }]
      const result = await syncOnCreate(docs)

      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('bulk fail')
      expect(mockLog.error).toHaveBeenCalled()
    })
  })

  // ── syncOnUpdate ──

  describe('syncOnUpdate', () => {
    it('updates IpAddr when ipAddr changed', async () => {
      const prevDocs = [{ eqpId: 'EQP_001', ipAddr: '10.0.0.1' }]
      const newDocs = [{ eqpId: 'EQP_001', ipAddr: '10.0.0.99' }]

      const result = await syncOnUpdate(prevDocs, newDocs)

      expect(mockModel.bulkWrite).toHaveBeenCalledTimes(1)
      const ops = mockModel.bulkWrite.mock.calls[0][0]
      expect(ops).toHaveLength(1)
      expect(ops[0]).toEqual({
        updateOne: {
          filter: { eqpId: 'EQP_001' },
          update: { $set: { IpAddr: '10.0.0.99' } },
          upsert: true
        }
      })
      expect(result.synced).toBe(1)
    })

    it('handles eqpId change (delete old + upsert new)', async () => {
      const prevDocs = [{ eqpId: 'OLD_001', ipAddr: '10.0.0.1' }]
      const newDocs = [{ eqpId: 'NEW_001', ipAddr: '10.0.0.1' }]

      const result = await syncOnUpdate(prevDocs, newDocs)

      // deleteMany로 old eqpId 삭제
      expect(mockModel.deleteMany).toHaveBeenCalledWith({
        eqpId: { $in: ['OLD_001'] }
      })

      // bulkWrite로 new eqpId upsert
      expect(mockModel.bulkWrite).toHaveBeenCalledTimes(1)
      const ops = mockModel.bulkWrite.mock.calls[0][0]
      expect(ops).toHaveLength(1)
      expect(ops[0].updateOne.filter).toEqual({ eqpId: 'NEW_001' })
      expect(ops[0].updateOne.update.$set.IpAddr).toBe('10.0.0.1')
      expect(ops[0].updateOne.update.$setOnInsert).toBeDefined()
      expect(result.synced).toBe(1)
    })

    it('skips when neither eqpId nor ipAddr changed', async () => {
      const prevDocs = [{ eqpId: 'EQP_001', ipAddr: '10.0.0.1' }]
      const newDocs = [{ eqpId: 'EQP_001', ipAddr: '10.0.0.1' }]

      const result = await syncOnUpdate(prevDocs, newDocs)

      expect(mockModel.bulkWrite).not.toHaveBeenCalled()
      expect(mockModel.deleteMany).not.toHaveBeenCalled()
      expect(result.synced).toBe(0)
    })

    it('handles mixed changes in batch', async () => {
      const prevDocs = [
        { eqpId: 'EQP_001', ipAddr: '10.0.0.1' },
        { eqpId: 'EQP_002', ipAddr: '10.0.0.2' },
        { eqpId: 'OLD_003', ipAddr: '10.0.0.3' }
      ]
      const newDocs = [
        { eqpId: 'EQP_001', ipAddr: '10.0.0.1' },  // no change → skip
        { eqpId: 'EQP_002', ipAddr: '10.0.0.99' },  // ipAddr changed
        { eqpId: 'NEW_003', ipAddr: '10.0.0.3' }    // eqpId changed
      ]

      const result = await syncOnUpdate(prevDocs, newDocs)

      // OLD_003 삭제
      expect(mockModel.deleteMany).toHaveBeenCalledWith({
        eqpId: { $in: ['OLD_003'] }
      })

      // 2건 upsert (EQP_002 ipAddr 변경 + NEW_003 eqpId 변경)
      const ops = mockModel.bulkWrite.mock.calls[0][0]
      expect(ops).toHaveLength(2)
      expect(result.synced).toBe(2)
    })

    it('returns early for empty arrays', async () => {
      const result = await syncOnUpdate([], [])

      expect(mockModel.bulkWrite).not.toHaveBeenCalled()
      expect(result.synced).toBe(0)
    })

    it('handles error gracefully', async () => {
      mockModel.bulkWrite.mockRejectedValue(new Error('update fail'))

      const prevDocs = [{ eqpId: 'EQP_001', ipAddr: '10.0.0.1' }]
      const newDocs = [{ eqpId: 'EQP_001', ipAddr: '10.0.0.99' }]

      const result = await syncOnUpdate(prevDocs, newDocs)

      expect(result.failed).toBeGreaterThan(0)
      expect(mockLog.error).toHaveBeenCalled()
    })
  })

  // ── syncOnDelete ──

  describe('syncOnDelete', () => {
    it('deletes AGENT_INFO by eqpId list', async () => {
      mockModel.deleteMany.mockResolvedValue({ deletedCount: 2 })

      const docs = [
        { eqpId: 'EQP_001', ipAddr: '10.0.0.1' },
        { eqpId: 'EQP_002', ipAddr: '10.0.0.2' }
      ]

      const result = await syncOnDelete(docs)

      expect(mockModel.deleteMany).toHaveBeenCalledWith({
        eqpId: { $in: ['EQP_001', 'EQP_002'] }
      })
      expect(result.synced).toBe(2)
      expect(result.failed).toBe(0)
    })

    it('returns early for empty array', async () => {
      const result = await syncOnDelete([])

      expect(mockModel.deleteMany).not.toHaveBeenCalled()
      expect(result.synced).toBe(0)
    })

    it('handles deleteMany error gracefully', async () => {
      mockModel.deleteMany.mockRejectedValue(new Error('delete fail'))

      const docs = [{ eqpId: 'EQP_001', ipAddr: '10.0.0.1' }]
      const result = await syncOnDelete(docs)

      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(mockLog.error).toHaveBeenCalled()
    })
  })
})
