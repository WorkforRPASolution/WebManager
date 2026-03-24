import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock webmanagerLogModel before import
vi.mock('../../shared/models/webmanagerLogModel', () => ({
  createEqpRedisSyncLog: vi.fn().mockResolvedValue({})
}))

vi.mock('../../shared/db/redisConnection', () => ({
  getEqpRedisClient: vi.fn(),
  isEqpRedisAvailable: vi.fn()
}))

vi.mock('../../shared/utils/businessRules', () => ({
  createRulesContext: vi.fn(() => ({
    registerRule: vi.fn()
  }))
}))

const {
  // Layer 1
  normalizeIpAddrL, buildHashField, buildHashValue, parseIndex,
  buildModifyMessage, buildDeleteMessage,
  // Layer 2
  syncOneCreate, syncOneUpdate, syncOneDelete,
  // Layer 3
  syncAfterCreate, syncAfterUpdate, syncAfterDelete,
  // Utils
  withRetry, registerHooks,
  // DI
  _setDeps,
} = await import('./eqpInfoRedisSync.js')

// createEqpRedisSyncLog is injected via _setDeps (mockCreateSyncLog)

// Shared mocks
const mockRedis = {
  incr: vi.fn(),
  hset: vi.fn(),
  hget: vi.fn(),
  hdel: vi.fn(),
  publish: vi.fn(),
}

const mockCreateSyncLog = vi.fn().mockResolvedValue({})

beforeEach(() => {
  vi.clearAllMocks()
  mockRedis.incr.mockResolvedValue(1)
  mockRedis.hset.mockResolvedValue(1)
  mockRedis.hget.mockResolvedValue(null)
  mockRedis.hdel.mockResolvedValue(1)
  mockRedis.publish.mockResolvedValue(1)
  mockCreateSyncLog.mockResolvedValue({})
  _setDeps({
    redisClient: mockRedis,
    isEqpRedisAvailable: () => true,
    createEqpRedisSyncLog: mockCreateSyncLog,
  })
})

// ============================================
// A. Layer 1: Serialization (11 tests)
// ============================================

describe('Layer 1: Serialization', () => {
  describe('normalizeIpAddrL', () => {
    it('should return "_" for null', () => {
      expect(normalizeIpAddrL(null)).toBe('_')
    })
    it('should return "_" for empty string', () => {
      expect(normalizeIpAddrL('')).toBe('_')
    })
    it('should return "_" for whitespace only', () => {
      expect(normalizeIpAddrL(' ')).toBe('_')
    })
    it('should return trimmed value for valid IP', () => {
      expect(normalizeIpAddrL('10.0.0.1')).toBe('10.0.0.1')
    })
  })

  describe('buildHashField', () => {
    it('should combine ipAddr and normalized ipAddrL', () => {
      expect(buildHashField({ ipAddr: '192.168.1.1', ipAddrL: '10.0.0.1' }))
        .toBe('192.168.1.1:10.0.0.1')
    })
    it('should use "_" when ipAddrL is empty', () => {
      expect(buildHashField({ ipAddr: '192.168.1.1', ipAddrL: '' }))
        .toBe('192.168.1.1:_')
    })
  })

  describe('buildHashValue', () => {
    it('should build 6-field colon-separated value', () => {
      const doc = { process: 'ETCH', eqpModel: 'M1', eqpId: 'EQP001', line: 'L1', lineDesc: 'Line One' }
      expect(buildHashValue(doc, 42)).toBe('ETCH:M1:EQP001:L1:Line One:42')
    })
    it('should handle lineDesc with colons', () => {
      const doc = { process: 'ETCH', eqpModel: 'M1', eqpId: 'EQP001', line: 'L1', lineDesc: 'A:B:C' }
      expect(buildHashValue(doc, 10)).toBe('ETCH:M1:EQP001:L1:A:B:C:10')
    })
  })

  describe('parseIndex', () => {
    it('should extract last number after colon', () => {
      expect(parseIndex('ETCH:M1:EQP001:L1:Line One:42')).toBe(42)
    })
    it('should handle lineDesc with colons (extract last number)', () => {
      expect(parseIndex('ETCH:M1:EQP001:L1:A:B:C:10')).toBe(10)
    })
    it('should return NaN for invalid value', () => {
      expect(parseIndex(null)).toBeNaN()
      expect(parseIndex('')).toBeNaN()
      expect(parseIndex('no-number-at-end')).toBeNaN()
    })
  })

  describe('buildModifyMessage', () => {
    it('should build ipAddr:ipAddrL:eqpId format', () => {
      const doc = { ipAddr: '192.168.1.1', ipAddrL: '10.0.0.1', eqpId: 'EQP001' }
      expect(buildModifyMessage(doc)).toBe('192.168.1.1:10.0.0.1:EQP001')
    })
  })

  describe('buildDeleteMessage', () => {
    it('should return eqpId only', () => {
      expect(buildDeleteMessage({ eqpId: 'EQP001' })).toBe('EQP001')
    })
  })
})

// ============================================
// B. Layer 2: Single-doc Operations (10 tests)
// ============================================

describe('Layer 2: Single-doc Operations', () => {
  const doc = {
    ipAddr: '192.168.1.1', ipAddrL: '10.0.0.1',
    process: 'ETCH', eqpModel: 'M1', eqpId: 'EQP001',
    line: 'L1', lineDesc: 'Line One'
  }

  describe('syncOneCreate', () => {
    it('should INCR + HSET x2 + PUBLISH in correct order', async () => {
      mockRedis.incr.mockResolvedValue(5)
      await syncOneCreate(mockRedis, doc)

      expect(mockRedis.incr).toHaveBeenCalledWith('EQP_INFO_lastnum')
      expect(mockRedis.hset).toHaveBeenCalledWith('EQP_INFO', '192.168.1.1:10.0.0.1', 'ETCH:M1:EQP001:L1:Line One:5')
      expect(mockRedis.hset).toHaveBeenCalledWith('EQP_INFO_LINE', 'EQP001', 'L1')
      expect(mockRedis.publish).toHaveBeenCalledWith('EQP_INFO_MODIFY', '192.168.1.1:10.0.0.1:EQP001')
    })

    it('should throw on Redis error', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis down'))
      await expect(syncOneCreate(mockRedis, doc)).rejects.toThrow('Redis down')
    })
  })

  describe('syncOneUpdate', () => {
    const prevDoc = { ...doc }
    const newDoc = { ...doc, lineDesc: 'Updated Line' }

    it('should HGET existing + HSET without HDEL when IP unchanged', async () => {
      mockRedis.hget.mockResolvedValue('ETCH:M1:EQP001:L1:Line One:5')
      await syncOneUpdate(mockRedis, prevDoc, newDoc)

      expect(mockRedis.hdel).not.toHaveBeenCalledWith('EQP_INFO', expect.anything())
      expect(mockRedis.hget).toHaveBeenCalledWith('EQP_INFO', '192.168.1.1:10.0.0.1')
      expect(mockRedis.hset).toHaveBeenCalledWith('EQP_INFO', '192.168.1.1:10.0.0.1', 'ETCH:M1:EQP001:L1:Updated Line:5')
      expect(mockRedis.publish).toHaveBeenCalledWith('EQP_INFO_MODIFY', '192.168.1.1:10.0.0.1:EQP001')
    })

    it('should HDEL old + HSET new when ipAddr changes', async () => {
      const newDocIp = { ...newDoc, ipAddr: '10.10.10.10' }
      mockRedis.hget.mockResolvedValue(null)
      mockRedis.incr.mockResolvedValue(99)

      await syncOneUpdate(mockRedis, prevDoc, newDocIp)

      expect(mockRedis.hdel).toHaveBeenCalledWith('EQP_INFO', '192.168.1.1:10.0.0.1')
      expect(mockRedis.hset).toHaveBeenCalledWith('EQP_INFO', '10.10.10.10:10.0.0.1', expect.stringContaining(':99'))
    })

    it('should handle ipAddrL change (value to empty)', async () => {
      const newDocNoL = { ...newDoc, ipAddrL: '' }
      mockRedis.hget.mockResolvedValue(null)
      mockRedis.incr.mockResolvedValue(7)

      await syncOneUpdate(mockRedis, prevDoc, newDocNoL)

      expect(mockRedis.hdel).toHaveBeenCalledWith('EQP_INFO', '192.168.1.1:10.0.0.1')
      expect(mockRedis.hset).toHaveBeenCalledWith('EQP_INFO', '192.168.1.1:_', expect.stringContaining(':7'))
    })

    it('should handle ipAddrL change (empty to value)', async () => {
      const prevNoL = { ...prevDoc, ipAddrL: '' }
      mockRedis.hget.mockResolvedValue(null)
      mockRedis.incr.mockResolvedValue(8)

      await syncOneUpdate(mockRedis, prevNoL, newDoc)

      expect(mockRedis.hdel).toHaveBeenCalledWith('EQP_INFO', '192.168.1.1:_')
      expect(mockRedis.hset).toHaveBeenCalledWith('EQP_INFO', '192.168.1.1:10.0.0.1', expect.stringContaining(':8'))
    })

    it('should replace EQP_INFO_LINE key when eqpId changes', async () => {
      const newDocEqpId = { ...newDoc, eqpId: 'EQP002' }
      mockRedis.hget.mockResolvedValue('ETCH:M1:EQP001:L1:Line One:5')

      await syncOneUpdate(mockRedis, prevDoc, newDocEqpId)

      expect(mockRedis.hdel).toHaveBeenCalledWith('EQP_INFO_LINE', 'EQP001')
      expect(mockRedis.hset).toHaveBeenCalledWith('EQP_INFO_LINE', 'EQP002', 'L1')
    })

    it('should reuse existing index from hash value', async () => {
      mockRedis.hget.mockResolvedValue('ETCH:M1:EQP001:L1:Line One:42')
      await syncOneUpdate(mockRedis, prevDoc, newDoc)

      expect(mockRedis.incr).not.toHaveBeenCalled()
      expect(mockRedis.hset).toHaveBeenCalledWith('EQP_INFO', expect.anything(), expect.stringContaining(':42'))
    })

    it('should INCR when no existing entry', async () => {
      mockRedis.hget.mockResolvedValue(null)
      mockRedis.incr.mockResolvedValue(100)

      await syncOneUpdate(mockRedis, prevDoc, newDoc)

      expect(mockRedis.incr).toHaveBeenCalledWith('EQP_INFO_lastnum')
      expect(mockRedis.hset).toHaveBeenCalledWith('EQP_INFO', expect.anything(), expect.stringContaining(':100'))
    })
  })

  describe('syncOneDelete', () => {
    it('should HDEL x2 + PUBLISH in correct order', async () => {
      await syncOneDelete(mockRedis, doc)

      expect(mockRedis.hdel).toHaveBeenCalledWith('EQP_INFO', '192.168.1.1:10.0.0.1')
      expect(mockRedis.hdel).toHaveBeenCalledWith('EQP_INFO_LINE', 'EQP001')
      expect(mockRedis.publish).toHaveBeenCalledWith('EQP_INFO_DELETE', 'EQP001')
    })

    it('should throw on Redis error', async () => {
      mockRedis.hdel.mockRejectedValue(new Error('Redis down'))
      await expect(syncOneDelete(mockRedis, doc)).rejects.toThrow('Redis down')
    })
  })
})

// ============================================
// C. Layer 3: Batch Orchestration (10 tests)
// ============================================

describe('Layer 3: Batch Orchestration', () => {
  const docs = [
    { ipAddr: '1.1.1.1', ipAddrL: '', process: 'P1', eqpModel: 'M1', eqpId: 'A', line: 'L1', lineDesc: '' },
    { ipAddr: '2.2.2.2', ipAddrL: '', process: 'P1', eqpModel: 'M1', eqpId: 'B', line: 'L1', lineDesc: '' },
    { ipAddr: '3.3.3.3', ipAddrL: '', process: 'P1', eqpModel: 'M1', eqpId: 'C', line: 'L1', lineDesc: '' },
  ]

  describe('syncAfterCreate', () => {
    it('should set syncStatus with all synced on success', async () => {
      const context = {}
      await syncAfterCreate(docs, context)

      expect(context.syncStatus).toEqual({ synced: 3, failed: 0, failedEqpIds: [] })
    })

    it('should set redisUnavailable when Redis is not connected', async () => {
      _setDeps({ redisClient: null, isEqpRedisAvailable: () => false })
      const context = {}
      await syncAfterCreate(docs, context)

      expect(context.syncStatus).toEqual({
        synced: 0, failed: 3,
        failedEqpIds: ['A', 'B', 'C'],
        redisUnavailable: true
      })
      // Should NOT call createEqpRedisSyncLog when Redis unavailable
      expect(mockCreateSyncLog).not.toHaveBeenCalled()
    })

    it('should handle partial failures with correct counts', async () => {
      let callCount = 0
      mockRedis.incr.mockImplementation(() => {
        callCount++
        // Fail on calls 2 and 3 (first attempt + retry for 2nd doc)
        if (callCount >= 2 && callCount <= 3) return Promise.reject(new Error('fail'))
        return Promise.resolve(callCount)
      })
      const context = {}
      await syncAfterCreate(docs, context)

      expect(context.syncStatus.synced).toBe(2)
      expect(context.syncStatus.failed).toBe(1)
      expect(context.syncStatus.failedEqpIds).toEqual(['B'])
    })

    it('should succeed after 1 retry (first attempt fails, retry succeeds)', async () => {
      let firstCall = true
      mockRedis.incr.mockImplementation(() => {
        if (firstCall) {
          firstCall = false
          return Promise.reject(new Error('transient'))
        }
        return Promise.resolve(1)
      })
      const context = {}
      // Single doc to test retry
      await syncAfterCreate([docs[0]], context)

      expect(context.syncStatus).toEqual({ synced: 1, failed: 0, failedEqpIds: [] })
    })
  })

  describe('syncAfterUpdate', () => {
    it('should match previousData[i] with newData[i]', async () => {
      const prev = [
        { ...docs[0], lineDesc: 'old' },
        { ...docs[1], lineDesc: 'old2' },
      ]
      const updated = [
        { ...docs[0], lineDesc: 'new' },
        { ...docs[1], lineDesc: 'new2' },
      ]
      mockRedis.hget.mockResolvedValue('P1:M1:A:L1:old:1')

      const context = { previousData: prev, newData: updated }
      await syncAfterUpdate(updated, context)

      expect(context.syncStatus).toEqual({ synced: 2, failed: 0, failedEqpIds: [] })
      expect(mockRedis.hset).toHaveBeenCalledTimes(4) // 2 docs x (EQP_INFO + EQP_INFO_LINE)
    })

    it('should set redisUnavailable when Redis is not connected', async () => {
      _setDeps({ redisClient: null, isEqpRedisAvailable: () => false })
      const context = { previousData: [docs[0]], newData: [docs[0]] }
      await syncAfterUpdate([docs[0]], context)

      expect(context.syncStatus.redisUnavailable).toBe(true)
    })

    it('should handle partial update failures', async () => {
      const prev = [docs[0], docs[1]]
      const updated = [docs[0], docs[1]]
      let callIdx = 0
      mockRedis.hget.mockImplementation(() => {
        callIdx++
        // Fail on calls 2 and 3 (first attempt + retry for 2nd doc)
        if (callIdx >= 2 && callIdx <= 3) return Promise.reject(new Error('fail'))
        return Promise.resolve('P1:M1:A:L1::1')
      })

      const context = { previousData: prev, newData: updated }
      await syncAfterUpdate(updated, context)

      expect(context.syncStatus.synced).toBe(1)
      expect(context.syncStatus.failed).toBe(1)
    })
  })

  describe('syncAfterDelete', () => {
    it('should use context.deletedData', async () => {
      const context = { deletedData: docs }
      await syncAfterDelete(null, context)

      expect(mockRedis.hdel).toHaveBeenCalledTimes(6) // 3 docs x (EQP_INFO + EQP_INFO_LINE)
      expect(mockRedis.publish).toHaveBeenCalledTimes(3)
    })

    it('should set syncStatus on full success', async () => {
      const context = { deletedData: [docs[0], docs[1]] }
      await syncAfterDelete(null, context)

      expect(context.syncStatus).toEqual({ synced: 2, failed: 0, failedEqpIds: [] })
    })
  })

  describe('failure logging', () => {
    it('should call createEqpRedisSyncLog on sync failure', async () => {
      mockRedis.incr.mockRejectedValue(new Error('fail'))
      const context = { user: { singleid: 'testuser' } }
      await syncAfterCreate([docs[0]], context)

      expect(mockCreateSyncLog).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'create',
          eqpId: 'A',
          error: expect.any(String),
          userId: 'testuser'
        })
      )
    })

    it('should NOT call createEqpRedisSyncLog when Redis unavailable', async () => {
      _setDeps({ redisClient: null, isEqpRedisAvailable: () => false, createEqpRedisSyncLog: mockCreateSyncLog })
      const context = {}
      await syncAfterCreate([docs[0]], context)

      expect(mockCreateSyncLog).not.toHaveBeenCalled()
    })
  })
})

// ============================================
// D. withRetry (2 tests)
// ============================================

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, 'test')
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry once and return retry result', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValueOnce('retry ok')
    const result = await withRetry(fn, 'test')
    expect(result).toBe('retry ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should throw after both attempts fail', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
    await expect(withRetry(fn, 'test')).rejects.toThrow('fail2')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

// ============================================
// E. Hook Registration (2 tests)
// ============================================

describe('registerHooks', () => {
  it('should register afterCreate/afterUpdate/afterDelete hooks', () => {
    const mockRulesCtx = { registerRule: vi.fn() }
    registerHooks(mockRulesCtx)

    expect(mockRulesCtx.registerRule).toHaveBeenCalledTimes(3)
    const calls = mockRulesCtx.registerRule.mock.calls
    expect(calls[0][0]).toBe('afterCreate')
    expect(calls[1][0]).toBe('afterUpdate')
    expect(calls[2][0]).toBe('afterDelete')
  })

  it('should register hooks with priority 500', () => {
    const mockRulesCtx = { registerRule: vi.fn() }
    registerHooks(mockRulesCtx)

    for (const call of mockRulesCtx.registerRule.mock.calls) {
      expect(call[1].priority).toBe(500)
    }
  })
})
