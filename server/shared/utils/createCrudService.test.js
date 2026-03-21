import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── businessRules 글로벌 레지스트리 오염 방지 ──
vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(), error: vi.fn(), warn: vi.fn()
  })
}))

// webmanagerLogModel은 createCrudService.js에서 require하지만,
// _deps를 통해 주입하므로 실제 DB 연결 불필요 → mock 처리
vi.mock('../models/webmanagerLogModel', () => ({
  createAuditLog: vi.fn(),
  calculateChanges: vi.fn(() => ({})),
  redactSensitiveFields: vi.fn((d) => d),
  GLOBAL_SENSITIVE_FIELDS: []
}))

// ── Mock Helpers ──

function createMockDeps() {
  const auditLogs = []
  return {
    auditLogs,
    deps: {
      createAuditLog: vi.fn(async (params) => { auditLogs.push(params); return {} }),
      calculateChanges: vi.fn((oldData, newData, options) => {
        const changes = {}
        const sensitive = [...(options?.sensitiveFields || [])]
        const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})])
        for (const key of allKeys) {
          if (key === '_id' || key === '__v') continue
          if (JSON.stringify(oldData?.[key]) !== JSON.stringify(newData?.[key])) {
            changes[key] = sensitive.includes(key)
              ? { from: '[REDACTED]', to: '[REDACTED]' }
              : { from: oldData?.[key], to: newData?.[key] }
          }
        }
        return changes
      }),
      redactSensitiveFields: vi.fn((data, extra = []) => {
        if (!data) return data
        const result = { ...data }
        for (const f of extra) { if (f in result) result[f] = '[REDACTED]' }
        return result
      })
    }
  }
}

function createMockModel(opts = {}) {
  const { insertResult = [], modifiedCount = 1, deletedCount = 1 } = opts
  return {
    insertMany: vi.fn().mockResolvedValue(
      insertResult.map(doc => ({ ...doc, toObject: () => ({ ...doc }) }))
    ),
    findById: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    find: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount })
  }
}

async function flushAuditLogs() {
  await new Promise(r => setTimeout(r, 20))
}

let createCrudService

beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()

  const br = await import('./businessRules.js')
  br._clearAllCollections()

  const mod = await import('./createCrudService.js')
  createCrudService = mod.createCrudService
})

// ============================================
// Tests
// ============================================

describe('createCrudService', () => {
  describe('factory setup', () => {
    it('returns create, update, remove, rules', () => {
      const { deps } = createMockDeps()
      const crud = createCrudService(createMockModel(), 'TEST', { _deps: deps })
      expect(crud).toHaveProperty('create')
      expect(crud).toHaveProperty('update')
      expect(crud).toHaveProperty('remove')
      expect(crud).toHaveProperty('rules')
    })

    it('registers custom autoSetters that transform data', async () => {
      const { deps } = createMockDeps()
      const docs = [{ _id: 'id1', name: 'test', upper: 'TEST' }]
      const Model = createMockModel({ insertResult: docs })

      const crud = createCrudService(Model, 'TEST', {
        _deps: deps,
        autoSetters: [{
          name: 'toUpper', priority: 10,
          apply: (data) => ({ ...data, upper: data.name?.toUpperCase() })
        }]
      })

      await crud.create([{ name: 'test' }], { user: { singleid: 'admin' } })
      const insertedData = Model.insertMany.mock.calls[0][0]
      expect(insertedData[0]).toHaveProperty('upper', 'TEST')
    })

    it('registers custom hooks that are executed', async () => {
      const hookFn = vi.fn()
      const { deps } = createMockDeps()
      const Model = createMockModel({ insertResult: [{ _id: 'id1' }] })

      const crud = createCrudService(Model, 'TEST', {
        _deps: deps,
        hooks: { afterCreate: hookFn }
      })

      await crud.create([{ name: 'A' }], { user: { singleid: 'admin' } })
      expect(hookFn).toHaveBeenCalled()
    })
  })

  describe('create()', () => {
    it('inserts valid items and returns created count', async () => {
      const { deps } = createMockDeps()
      const docs = [{ _id: 'id1', name: 'A' }, { _id: 'id2', name: 'B' }]
      const Model = createMockModel({ insertResult: docs })
      const crud = createCrudService(Model, 'TEST', { _deps: deps })

      const result = await crud.create([{ name: 'A' }, { name: 'B' }], { user: { singleid: 'admin' } })
      expect(result.created).toBe(2)
      expect(result.errors).toHaveLength(0)
      expect(Model.insertMany).toHaveBeenCalledTimes(1)
    })

    it('logs audit for each created document', async () => {
      const { deps, auditLogs } = createMockDeps()
      const docs = [{ _id: 'id1', eqpId: 'EQ001', name: 'A' }]
      const Model = createMockModel({ insertResult: docs })
      const crud = createCrudService(Model, 'EQP_INFO', { documentIdField: 'eqpId', _deps: deps })

      await crud.create([{ eqpId: 'EQ001', name: 'A' }], { user: { singleid: 'admin' } })
      await flushAuditLogs()

      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0]).toMatchObject({
        collectionName: 'EQP_INFO',
        documentId: 'EQ001',
        action: 'create',
        userId: 'admin'
      })
    })

    it('returns created=0 when no valid items', async () => {
      const { deps } = createMockDeps()
      const Model = createMockModel({ insertResult: [] })
      const crud = createCrudService(Model, 'TEST', { _deps: deps })

      const result = await crud.create([], { user: { singleid: 'admin' } })
      expect(result.created).toBe(0)
      expect(Model.insertMany).not.toHaveBeenCalled()
    })
  })

  describe('update()', () => {
    it('updates documents and returns updated count', async () => {
      const { deps } = createMockDeps()
      const existingDoc = { _id: 'id1', name: 'Old' }
      const updatedDoc = { _id: 'id1', name: 'New' }

      const Model = createMockModel({ modifiedCount: 1 })
      Model.findById = vi.fn()
        .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(existingDoc) })
        .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(updatedDoc) })

      const crud = createCrudService(Model, 'TEST', { _deps: deps })
      const result = await crud.update([{ _id: 'id1', name: 'New' }], { user: { singleid: 'admin' } })
      expect(result.updated).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('logs audit with changes on update', async () => {
      const { deps, auditLogs } = createMockDeps()
      const existingDoc = { _id: 'id1', name: 'Old' }
      const updatedDoc = { _id: 'id1', name: 'New' }

      const Model = createMockModel({ modifiedCount: 1 })
      Model.findById = vi.fn()
        .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(existingDoc) })
        .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(updatedDoc) })

      const crud = createCrudService(Model, 'TEST', { _deps: deps })
      await crud.update([{ _id: 'id1', name: 'New' }], { user: { singleid: 'admin' } })
      await flushAuditLogs()

      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0]).toMatchObject({ collectionName: 'TEST', action: 'update', userId: 'admin' })
      expect(auditLogs[0].changes).toHaveProperty('name')
      expect(auditLogs[0].changes.name).toEqual({ from: 'Old', to: 'New' })
    })

    it('redacts sensitive fields in update changes', async () => {
      const { deps, auditLogs } = createMockDeps()
      const existingDoc = { _id: 'id1', name: 'Old', secret: 'abc' }
      const updatedDoc = { _id: 'id1', name: 'New', secret: 'xyz' }

      const Model = createMockModel({ modifiedCount: 1 })
      Model.findById = vi.fn()
        .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(existingDoc) })
        .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(updatedDoc) })

      const crud = createCrudService(Model, 'TEST', { sensitiveFields: ['secret'], _deps: deps })
      await crud.update([{ _id: 'id1', name: 'New', secret: 'xyz' }], { user: { singleid: 'admin' } })
      await flushAuditLogs()

      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0].changes.secret).toEqual({ from: '[REDACTED]', to: '[REDACTED]' })
      expect(auditLogs[0].changes.name).toEqual({ from: 'Old', to: 'New' })
    })

    it('errors when _id is missing', async () => {
      const { deps } = createMockDeps()
      const crud = createCrudService(createMockModel(), 'TEST', { _deps: deps })

      const result = await crud.update([{ name: 'New' }], { user: { singleid: 'admin' } })
      expect(result.updated).toBe(0)
      expect(result.errors[0]).toEqual({ rowIndex: 0, field: '_id', message: '_id is required for update' })
    })

    it('errors when document not found', async () => {
      const { deps } = createMockDeps()
      const Model = createMockModel()
      Model.findById = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })

      const crud = createCrudService(Model, 'TEST', { _deps: deps })
      const result = await crud.update([{ _id: 'nonexistent', name: 'New' }], { user: { singleid: 'admin' } })
      expect(result.updated).toBe(0)
      expect(result.errors[0].message).toBe('Document not found')
    })

    it('skips audit if no changes detected', async () => {
      const { deps, auditLogs } = createMockDeps()
      const doc = { _id: 'id1', name: 'Same' }

      const Model = createMockModel({ modifiedCount: 1 })
      Model.findById = vi.fn()
        .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(doc) })
        .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(doc) })

      const crud = createCrudService(Model, 'TEST', { _deps: deps })
      await crud.update([{ _id: 'id1', name: 'Same' }], { user: { singleid: 'admin' } })
      await flushAuditLogs()

      expect(auditLogs).toHaveLength(0)
    })
  })

  describe('remove()', () => {
    it('deletes documents and returns deleted count', async () => {
      const { deps } = createMockDeps()
      const docs = [{ _id: 'id1', name: 'A' }, { _id: 'id2', name: 'B' }]
      const Model = createMockModel({ deletedCount: 2 })
      Model.find = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(docs) })

      const crud = createCrudService(Model, 'TEST', { _deps: deps })
      const result = await crud.remove(['id1', 'id2'], { user: { singleid: 'admin' } })
      expect(result.deleted).toBe(2)
    })

    it('logs audit for each deleted document', async () => {
      const { deps, auditLogs } = createMockDeps()
      const docs = [{ _id: 'id1', eqpId: 'EQ001' }, { _id: 'id2', eqpId: 'EQ002' }]
      const Model = createMockModel({ deletedCount: 2 })
      Model.find = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(docs) })

      const crud = createCrudService(Model, 'EQP_INFO', { documentIdField: 'eqpId', _deps: deps })
      await crud.remove(['id1', 'id2'], { user: { singleid: 'admin' } })
      await flushAuditLogs()

      expect(auditLogs).toHaveLength(2)
      expect(auditLogs[0]).toMatchObject({ collectionName: 'EQP_INFO', documentId: 'EQ001', action: 'delete', userId: 'admin' })
      expect(auditLogs[1]).toMatchObject({ documentId: 'EQ002' })
    })

    it('skips afterDelete hooks when nothing deleted', async () => {
      const { deps } = createMockDeps()
      const hookFn = vi.fn()
      const Model = createMockModel({ deletedCount: 0 })
      Model.find = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) })

      const crud = createCrudService(Model, 'TEST', { _deps: deps, hooks: { afterDelete: hookFn } })
      await crud.remove(['nonexistent'], { user: { singleid: 'admin' } })
      expect(hookFn).not.toHaveBeenCalled()
    })
  })

  describe('skipFullDataInAudit', () => {
    it('omits previousData and newData when enabled', async () => {
      const { deps, auditLogs } = createMockDeps()
      const docs = [{ _id: 'id1', html: '<big>content</big>' }]
      const Model = createMockModel({ insertResult: docs })

      const crud = createCrudService(Model, 'EMAIL_TEMPLATE', { skipFullDataInAudit: true, _deps: deps })
      await crud.create([{ html: '<big>content</big>' }], { user: { singleid: 'admin' } })
      await flushAuditLogs()

      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0].newData).toBeNull()
      expect(auditLogs[0].previousData).toBeNull()
    })
  })

  describe('userId resolution', () => {
    it('uses singleid from context.user', async () => {
      const { deps, auditLogs } = createMockDeps()
      const Model = createMockModel({ insertResult: [{ _id: 'id1' }] })
      const crud = createCrudService(Model, 'TEST', { _deps: deps })

      await crud.create([{ name: 'A' }], { user: { singleid: 'john', id: 'abc123' } })
      await flushAuditLogs()
      expect(auditLogs[0].userId).toBe('john')
    })

    it('falls back to id when singleid is missing', async () => {
      const { deps, auditLogs } = createMockDeps()
      const Model = createMockModel({ insertResult: [{ _id: 'id1' }] })
      const crud = createCrudService(Model, 'TEST', { _deps: deps })

      await crud.create([{ name: 'A' }], { user: { id: 'abc123' } })
      await flushAuditLogs()
      expect(auditLogs[0].userId).toBe('abc123')
    })

    it('defaults to "system" when no user', async () => {
      const { deps, auditLogs } = createMockDeps()
      const Model = createMockModel({ insertResult: [{ _id: 'id1' }] })
      const crud = createCrudService(Model, 'TEST', { _deps: deps })

      await crud.create([{ name: 'A' }], {})
      await flushAuditLogs()
      expect(auditLogs[0].userId).toBe('system')
    })
  })

  describe('audit failure does not block business logic', () => {
    it('create succeeds even if audit fails', async () => {
      const deps = {
        createAuditLog: vi.fn().mockRejectedValue(new Error('DB down')),
        calculateChanges: vi.fn(() => ({})),
        redactSensitiveFields: vi.fn((d) => d)
      }
      const Model = createMockModel({ insertResult: [{ _id: 'id1' }] })
      const crud = createCrudService(Model, 'TEST', { _deps: deps })

      const result = await crud.create([{ name: 'A' }], { user: { singleid: 'admin' } })
      await flushAuditLogs()
      expect(result.created).toBe(1)
    })
  })

  describe('sensitiveFields redaction', () => {
    it('redacts sensitive fields in create audit data', async () => {
      const { deps, auditLogs } = createMockDeps()
      const docs = [{ _id: 'id1', name: 'john', password: 'secret123' }]
      const Model = createMockModel({ insertResult: docs })

      const crud = createCrudService(Model, 'USER', { sensitiveFields: ['password'], _deps: deps })
      await crud.create([{ name: 'john', password: 'secret123' }], { user: { singleid: 'admin' } })
      await flushAuditLogs()

      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0].newData.password).toBe('[REDACTED]')
      expect(auditLogs[0].newData.name).toBe('john')
    })

    it('redacts sensitive fields in delete audit data', async () => {
      const { deps, auditLogs } = createMockDeps()
      const docs = [{ _id: 'id1', name: 'john', password: 'hashed' }]
      const Model = createMockModel({ deletedCount: 1 })
      Model.find = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(docs) })

      const crud = createCrudService(Model, 'USER', { sensitiveFields: ['password'], _deps: deps })
      await crud.remove(['id1'], { user: { singleid: 'admin' } })
      await flushAuditLogs()

      expect(auditLogs[0].previousData.password).toBe('[REDACTED]')
      expect(auditLogs[0].previousData.name).toBe('john')
    })
  })
})
