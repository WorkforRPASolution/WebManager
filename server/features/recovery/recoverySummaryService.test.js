import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildPipeline,
  runBatch,
  initializeRecoverySummary,
  getLastCronRun,
  _setDeps,
  PIPELINE_CONFIGS
} from './recoverySummaryService.js'

// ── helpers ──

function createMockCollection(opts = {}) {
  const toArrayFn = vi.fn().mockResolvedValue(opts.aggregateResult || [])
  return {
    aggregate: vi.fn().mockReturnValue({ toArray: toArrayFn }),
    countDocuments: vi.fn().mockResolvedValue(opts.countResult ?? 0),
    createIndex: vi.fn().mockResolvedValue('ok'),
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

function createMockCronRunLog() {
  const saveFn = vi.fn().mockResolvedValue({})
  const instanceData = {}
  // Must be a regular function (not arrow) so it can be called with `new`
  const MockModel = vi.fn(function (data) {
    Object.assign(instanceData, data)
    Object.assign(this, data)
    this.save = saveFn
  })
  MockModel.findOne = vi.fn().mockReturnValue({
    sort: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    })
  })
  MockModel.collection = {
    createIndex: vi.fn().mockResolvedValue('ok')
  }
  MockModel._saveFn = saveFn
  MockModel._instanceData = instanceData
  return MockModel
}

describe('recoverySummaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PIPELINE_CONFIGS', () => {
    it('has three configs: scenario, equipment, trigger', () => {
      expect(Object.keys(PIPELINE_CONFIGS)).toEqual(['scenario', 'equipment', 'trigger'])
    })

    it('scenario config targets RECOVERY_SUMMARY_BY_SCENARIO with groupField ears_code', () => {
      expect(PIPELINE_CONFIGS.scenario).toEqual({
        collection: 'RECOVERY_SUMMARY_BY_SCENARIO',
        groupField: 'ears_code'
      })
    })

    it('equipment config targets RECOVERY_SUMMARY_BY_EQUIPMENT with groupField eqpid', () => {
      expect(PIPELINE_CONFIGS.equipment).toEqual({
        collection: 'RECOVERY_SUMMARY_BY_EQUIPMENT',
        groupField: 'eqpid'
      })
    })

    it('trigger config targets RECOVERY_SUMMARY_BY_TRIGGER with groupField trigger_by', () => {
      expect(PIPELINE_CONFIGS.trigger).toEqual({
        collection: 'RECOVERY_SUMMARY_BY_TRIGGER',
        groupField: 'trigger_by'
      })
    })
  })

  describe('buildPipeline', () => {
    const bucketStart = new Date('2026-03-15T00:00:00.000Z')
    const dateGte = '2026-03-15T09:00:00.000+09:00'
    const dateLt = '2026-03-15T10:00:00.000+09:00'

    it('builds pipeline with 6 stages: $match, $group, $group, $addFields, $unset, $merge', () => {
      const pipeline = buildPipeline('scenario', 'hourly', bucketStart, dateGte, dateLt)

      expect(pipeline).toHaveLength(6)
      expect(pipeline[0]).toHaveProperty('$match')
      expect(pipeline[1]).toHaveProperty('$group')
      expect(pipeline[2]).toHaveProperty('$group')
      expect(pipeline[3]).toHaveProperty('$addFields')
      expect(pipeline[4]).toHaveProperty('$unset')
      expect(pipeline[5]).toHaveProperty('$merge')
    })

    it('$match stage filters by create_date range and non-null status', () => {
      const pipeline = buildPipeline('scenario', 'hourly', bucketStart, dateGte, dateLt)
      const match = pipeline[0].$match

      expect(match.create_date.$gte).toBe(dateGte)
      expect(match.create_date.$lt).toBe(dateLt)
      expect(match.status).toEqual({ $ne: null })
    })

    it('first $group groups by line, process, model, and config groupField', () => {
      const pipeline = buildPipeline('scenario', 'hourly', bucketStart, dateGte, dateLt)
      const group = pipeline[1].$group

      expect(group._id).toHaveProperty('line')
      expect(group._id).toHaveProperty('process')
      expect(group._id).toHaveProperty('model')
      expect(group._id).toHaveProperty('ears_code') // scenario's groupField
      expect(group._id).toHaveProperty('status')
      expect(group.count).toEqual({ $sum: 1 })
    })

    it('equipment pipeline groups by eqpid instead of ears_code', () => {
      const pipeline = buildPipeline('equipment', 'hourly', bucketStart, dateGte, dateLt)
      const group = pipeline[1].$group

      expect(group._id).toHaveProperty('eqpid')
      expect(group._id).not.toHaveProperty('ears_code')
    })

    it('trigger pipeline groups by trigger_by', () => {
      const pipeline = buildPipeline('trigger', 'hourly', bucketStart, dateGte, dateLt)
      const group = pipeline[1].$group

      expect(group._id).toHaveProperty('trigger_by')
      expect(group._id).not.toHaveProperty('ears_code')
    })

    it('second $group aggregates total and pushes status_pairs', () => {
      const pipeline = buildPipeline('scenario', 'hourly', bucketStart, dateGte, dateLt)
      const group2 = pipeline[2].$group

      expect(group2.total).toEqual({ $sum: '$count' })
      expect(group2.status_pairs).toEqual({ $push: { k: '$_id.status', v: '$count' } })
    })

    it('$addFields sets period, bucket, dimension fields, status_counts, updated_at', () => {
      const pipeline = buildPipeline('scenario', 'hourly', bucketStart, dateGte, dateLt)
      const addFields = pipeline[3].$addFields

      expect(addFields.period).toBe('hourly')
      expect(addFields.bucket).toEqual(bucketStart)
      expect(addFields.line).toBe('$_id.line')
      expect(addFields.process).toBe('$_id.process')
      expect(addFields.model).toBe('$_id.model')
      expect(addFields.ears_code).toBe('$_id.ears_code')
      expect(addFields.status_counts).toEqual({ $arrayToObject: '$status_pairs' })
      expect(addFields.updated_at).toBe('$$NOW')
    })

    it('$unset removes _id and status_pairs', () => {
      const pipeline = buildPipeline('scenario', 'hourly', bucketStart, dateGte, dateLt)
      expect(pipeline[4].$unset).toEqual(['_id', 'status_pairs'])
    })

    it('$merge targets correct collection with whenMatched: replace', () => {
      const pipeline = buildPipeline('scenario', 'hourly', bucketStart, dateGte, dateLt)
      const merge = pipeline[5].$merge

      expect(merge.into).toBe('RECOVERY_SUMMARY_BY_SCENARIO')
      expect(merge.whenMatched).toBe('replace')
      expect(merge.on).toContain('period')
      expect(merge.on).toContain('bucket')
      expect(merge.on).toContain('line')
      expect(merge.on).toContain('process')
      expect(merge.on).toContain('model')
      expect(merge.on).toContain('ears_code')
    })

    it('equipment $merge uses eqpid in on-fields', () => {
      const pipeline = buildPipeline('equipment', 'hourly', bucketStart, dateGte, dateLt)
      const merge = pipeline[5].$merge

      expect(merge.into).toBe('RECOVERY_SUMMARY_BY_EQUIPMENT')
      expect(merge.on).toContain('eqpid')
      expect(merge.on).not.toContain('ears_code')
    })
  })

  describe('runBatch', () => {
    it('runs 3 pipelines and logs success when all succeed', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      await runBatch('hourly')

      // Should have called aggregate on EQP_AUTO_RECOVERY 3 times
      const eqpColl = mockEarsDb.collection('EQP_AUTO_RECOVERY')
      expect(eqpColl.aggregate).toHaveBeenCalledTimes(3)

      // Should have called countDocuments on each summary collection
      expect(mockEarsDb.collection('RECOVERY_SUMMARY_BY_SCENARIO').countDocuments).toHaveBeenCalled()
      expect(mockEarsDb.collection('RECOVERY_SUMMARY_BY_EQUIPMENT').countDocuments).toHaveBeenCalled()
      expect(mockEarsDb.collection('RECOVERY_SUMMARY_BY_TRIGGER').countDocuments).toHaveBeenCalled()

      // CronRunLog should be created with status 'success'
      expect(mockCronRunLog).toHaveBeenCalled()
      const logData = mockCronRunLog.mock.calls[0][0]
      expect(logData.status).toBe('success')
      expect(logData.period).toBe('hourly')
      expect(logData.jobName).toBe('recoverySummary')
    })

    it('logs partial when 1 of 3 pipelines fails', async () => {
      const failingCollection = createMockCollection()
      failingCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockRejectedValue(new Error('aggregate failed'))
      })

      const mockEarsDb = createMockEarsDb({
        'EQP_AUTO_RECOVERY': failingCollection
      })
      // Override: first call to aggregate fails, but we need selective failure
      // Let's make the EQP_AUTO_RECOVERY aggregate succeed for 2 out of 3
      let callCount = 0
      failingCollection.aggregate.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return { toArray: vi.fn().mockRejectedValue(new Error('scenario pipeline failed')) }
        }
        return { toArray: vi.fn().mockResolvedValue([]) }
      })

      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      await runBatch('hourly')

      const logData = mockCronRunLog.mock.calls[0][0]
      expect(logData.status).toBe('partial')
      expect(logData.pipelineResults.scenario).toMatch(/failed/i)
    })

    it('logs failed when all 3 pipelines fail', async () => {
      const failingCollection = createMockCollection()
      failingCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockRejectedValue(new Error('all failed'))
      })

      const mockEarsDb = createMockEarsDb({
        'EQP_AUTO_RECOVERY': failingCollection
      })
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      await runBatch('hourly')

      const logData = mockCronRunLog.mock.calls[0][0]
      expect(logData.status).toBe('failed')
    })

    it('prevents concurrent execution via isRunning flag', async () => {
      const mockEarsDb = createMockEarsDb()
      // Make aggregate slow
      const slowCollection = createMockCollection()
      slowCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 100)))
      })
      mockEarsDb.collection.mockReturnValue(slowCollection)

      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      // Start two batch runs simultaneously
      const run1 = runBatch('hourly')
      const run2 = runBatch('hourly')

      await Promise.all([run1, run2])

      // Only one should have created a CronRunLog (the other should be skipped)
      expect(mockCronRunLog).toHaveBeenCalledTimes(1)
    })

    it('uses allowDiskUse option', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      await runBatch('daily')

      const eqpColl = mockEarsDb.collection('EQP_AUTO_RECOVERY')
      // Check that aggregate was called with allowDiskUse option
      for (const call of eqpColl.aggregate.mock.calls) {
        expect(call[1]).toEqual({ allowDiskUse: true })
      }
    })
  })

  describe('initializeRecoverySummary', () => {
    it('creates unique indexes on 3 summary collections and CRON_RUN_LOG', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      await initializeRecoverySummary()

      // Each summary collection should have createIndex called
      const scenarioColl = mockEarsDb.collection('RECOVERY_SUMMARY_BY_SCENARIO')
      expect(scenarioColl.createIndex).toHaveBeenCalledWith(
        { period: 1, bucket: 1, line: 1, process: 1, model: 1, ears_code: 1 },
        { unique: true }
      )

      const equipmentColl = mockEarsDb.collection('RECOVERY_SUMMARY_BY_EQUIPMENT')
      expect(equipmentColl.createIndex).toHaveBeenCalledWith(
        { period: 1, bucket: 1, line: 1, process: 1, model: 1, eqpid: 1 },
        { unique: true }
      )

      const triggerColl = mockEarsDb.collection('RECOVERY_SUMMARY_BY_TRIGGER')
      expect(triggerColl.createIndex).toHaveBeenCalledWith(
        { period: 1, bucket: 1, line: 1, process: 1, model: 1, trigger_by: 1 },
        { unique: true }
      )

      // CRON_RUN_LOG should also have index created
      expect(mockCronRunLog.collection.createIndex).toHaveBeenCalled()
    })
  })

  describe('getLastCronRun', () => {
    it('queries CRON_RUN_LOG for last successful run of given period', async () => {
      const mockCronRunLog = createMockCronRunLog()
      const mockResult = { jobName: 'recoverySummary', period: 'hourly', status: 'success' }
      mockCronRunLog.findOne.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockResult)
        })
      })
      _setDeps({ earsDb: createMockEarsDb(), CronRunLog: mockCronRunLog })

      const result = await getLastCronRun('hourly')

      expect(result).toEqual(mockResult)
      expect(mockCronRunLog.findOne).toHaveBeenCalledWith({
        jobName: 'recoverySummary',
        period: 'hourly',
        status: { $in: ['success', 'partial'] }
      })
    })
  })
})
