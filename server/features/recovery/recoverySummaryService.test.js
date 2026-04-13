import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  buildPipeline,
  buildCategoryPipeline,
  runBatch,
  runPipelinesForBucket,
  detectGaps,
  runBackfillCheck,
  runManualBackfill,
  getBackfillState,
  cancelBackfill,
  getCompletedBucketSet,
  getPartialBucketSet,
  getIncompleteBucketSet,
  validateBackfillRange,
  initializeRecoverySummary,
  getLastCronRun,
  getPipelineKeys,
  getMissingOrFailedPipelines,
  getSummaryBucketSet,
  getOrphanedBuckets,
  _setDeps,
  _getBackfillPromise,
  _resetState,
  _setIndexReady,
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
  // findOne supports `.lean()`, `.sort().lean()`, and `.select().lean()` chains
  const leanNull = vi.fn().mockResolvedValue(null)
  MockModel.findOne = vi.fn().mockReturnValue({
    sort: vi.fn().mockReturnValue({ lean: leanNull }),
    select: vi.fn().mockReturnValue({ lean: leanNull }),
    lean: leanNull
  })
  MockModel.findOneAndUpdate = vi.fn().mockResolvedValue({})
  MockModel.find = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue([])
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
    _resetState()
    _setIndexReady(true)
  })

  describe('PIPELINE_CONFIGS', () => {
    it('has four configs: scenario, equipment, trigger, category', () => {
      expect(Object.keys(PIPELINE_CONFIGS)).toEqual(['scenario', 'equipment', 'trigger', 'category'])
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

    it('category config targets RECOVERY_SUMMARY_BY_CATEGORY with $lookup', () => {
      expect(PIPELINE_CONFIGS.category).toEqual({
        collection: 'RECOVERY_SUMMARY_BY_CATEGORY',
        groupField: 'scCategory',
        needsLookup: true
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

  describe('buildCategoryPipeline', () => {
    const bucketStart = new Date('2026-03-15T00:00:00.000Z')
    const dateGte = '2026-03-15T09:00:00.000+09:00'
    const dateLt = '2026-03-15T10:00:00.000+09:00'

    it('builds pipeline with 9 stages including $lookup and $unset', () => {
      const pipeline = buildCategoryPipeline('hourly', bucketStart, dateGte, dateLt)

      expect(pipeline).toHaveLength(9)
      expect(pipeline[0]).toHaveProperty('$match')
      expect(pipeline[1]).toHaveProperty('$lookup')
      expect(pipeline[2]).toHaveProperty('$addFields')   // scCategory 추출
      expect(pipeline[3]).toHaveProperty('$unset', '_scProp')
      expect(pipeline[4]).toHaveProperty('$group')         // 1차 group
      expect(pipeline[5]).toHaveProperty('$group')         // 2차 group
      expect(pipeline[6]).toHaveProperty('$addFields')     // period, bucket 등
      expect(pipeline[7]).toHaveProperty('$unset')         // _id, status_pairs
      expect(pipeline[8]).toHaveProperty('$merge')
    })

    it('$lookup joins SC_PROPERTY on ears_code → scname', () => {
      const pipeline = buildCategoryPipeline('hourly', bucketStart, dateGte, dateLt)
      const lookup = pipeline[1].$lookup

      expect(lookup.from).toBe('SC_PROPERTY')
      expect(lookup.localField).toBe('ears_code')
      expect(lookup.foreignField).toBe('scname')
      expect(lookup.as).toBe('_scProp')
    })

    it('extracts scCategory with $ifNull defaulting to -1 (Uncategorized)', () => {
      const pipeline = buildCategoryPipeline('hourly', bucketStart, dateGte, dateLt)
      const addFields = pipeline[2].$addFields

      expect(addFields.scCategory.$ifNull[1]).toBe(-1)
      expect(addFields.scCategory.$ifNull[0]).toEqual({ $arrayElemAt: ['$_scProp.scCategory', 0] })
    })

    it('$merge targets RECOVERY_SUMMARY_BY_CATEGORY with scCategory in on-fields', () => {
      const pipeline = buildCategoryPipeline('hourly', bucketStart, dateGte, dateLt)
      const merge = pipeline[8].$merge

      expect(merge.into).toBe('RECOVERY_SUMMARY_BY_CATEGORY')
      expect(merge.on).toContain('scCategory')
      expect(merge.whenMatched).toBe('replace')
    })

    it('first $group groups by scCategory (not ears_code)', () => {
      const pipeline = buildCategoryPipeline('hourly', bucketStart, dateGte, dateLt)
      const group = pipeline[4].$group

      expect(group._id).toHaveProperty('scCategory')
      expect(group._id).not.toHaveProperty('ears_code')
      expect(group._id).toHaveProperty('status')
      expect(group.count).toEqual({ $sum: 1 })
    })
  })

  describe('runPipelinesForBucket', () => {
    it('runs 4 pipelines and returns status success when all succeed', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      const bucketStart = new Date('2026-03-15T00:00:00.000Z')
      const result = await runPipelinesForBucket(
        'hourly', bucketStart,
        '2026-03-15T09:00:00.000+09:00',
        '2026-03-15T10:00:00.000+09:00'
      )

      expect(result.status).toBe('success')
      expect(mockEarsDb.collection('EQP_AUTO_RECOVERY').aggregate).toHaveBeenCalledTimes(4)
      expect(mockCronRunLog.findOneAndUpdate).toHaveBeenCalledTimes(1)
    })

    it('records source in CRON_RUN_LOG', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      const bucketStart = new Date('2026-03-15T00:00:00.000Z')
      await runPipelinesForBucket(
        'hourly', bucketStart,
        '2026-03-15T09:00:00.000+09:00',
        '2026-03-15T10:00:00.000+09:00',
        { source: 'autoBackfill' }
      )

      const updateCall = mockCronRunLog.findOneAndUpdate.mock.calls[0]
      expect(updateCall[1].$set.source).toBe('autoBackfill')
    })

    it('same bucket called twice — upsert keeps 1 record (idempotent)', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      const bucketStart = new Date('2026-03-15T00:00:00.000Z')
      const args = ['hourly', bucketStart, '2026-03-15T09:00:00.000+09:00', '2026-03-15T10:00:00.000+09:00']

      await runPipelinesForBucket(...args)
      await runPipelinesForBucket(...args)

      // Both calls use findOneAndUpdate with upsert — same filter key
      expect(mockCronRunLog.findOneAndUpdate).toHaveBeenCalledTimes(2)
      const filter1 = mockCronRunLog.findOneAndUpdate.mock.calls[0][0]
      const filter2 = mockCronRunLog.findOneAndUpdate.mock.calls[1][0]
      expect(filter1).toEqual(filter2)

      // CRITICAL: verify upsert:true option is passed (prevents insert+insert race)
      const opts1 = mockCronRunLog.findOneAndUpdate.mock.calls[0][2]
      const opts2 = mockCronRunLog.findOneAndUpdate.mock.calls[1][2]
      expect(opts1).toEqual(expect.objectContaining({ upsert: true }))
      expect(opts2).toEqual(expect.objectContaining({ upsert: true }))
    })

    it('findOneAndUpdate uses correct unique filter key (jobName + period + bucket)', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      const bucketStart = new Date('2026-03-15T00:00:00.000Z')
      await runPipelinesForBucket(
        'hourly', bucketStart,
        '2026-03-15T09:00:00.000+09:00',
        '2026-03-15T10:00:00.000+09:00'
      )

      const filter = mockCronRunLog.findOneAndUpdate.mock.calls[0][0]
      // Must match unique index { jobName: 1, period: 1, bucket: 1 }
      expect(filter).toEqual({
        jobName: 'recoverySummary',
        period: 'hourly',
        bucket: bucketStart
      })
    })

    it('different sources for same bucket overwrite — last writer wins', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      const bucketStart = new Date('2026-03-15T00:00:00.000Z')
      const baseArgs = ['hourly', bucketStart, '2026-03-15T09:00:00.000+09:00', '2026-03-15T10:00:00.000+09:00']

      // Cron writes first
      await runPipelinesForBucket(...baseArgs, { source: 'cron' })
      // Then manual backfill overwrites
      await runPipelinesForBucket(...baseArgs, { source: 'manualBackfill' })

      // Same filter used, last $set.source wins
      const set1 = mockCronRunLog.findOneAndUpdate.mock.calls[0][1].$set
      const set2 = mockCronRunLog.findOneAndUpdate.mock.calls[1][1].$set
      expect(set1.source).toBe('cron')
      expect(set2.source).toBe('manualBackfill')
      // Both use $set (not $setOnInsert) — meaning second call fully replaces
      expect(mockCronRunLog.findOneAndUpdate.mock.calls[1][1]).toHaveProperty('$set')
      expect(mockCronRunLog.findOneAndUpdate.mock.calls[1][1]).not.toHaveProperty('$setOnInsert')
    })

    it('$merge pipeline uses whenMatched:replace — Summary data is idempotent', () => {
      const bucketStart = new Date('2026-03-15T00:00:00.000Z')
      for (const configKey of ['scenario', 'equipment', 'trigger']) {
        const pipeline = buildPipeline(configKey, 'hourly', bucketStart, 'gte', 'lt')
        const mergeStage = pipeline[5].$merge
        expect(mergeStage.whenMatched).toBe('replace')
        expect(mergeStage.whenNotMatched).toBe('insert')
      }
    })

    it('returns partial when 1 of 3 pipelines fails', async () => {
      const failingCollection = createMockCollection()
      let callCount = 0
      failingCollection.aggregate.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return { toArray: vi.fn().mockRejectedValue(new Error('scenario pipeline failed')) }
        }
        return { toArray: vi.fn().mockResolvedValue([]) }
      })

      const mockEarsDb = createMockEarsDb({ 'EQP_AUTO_RECOVERY': failingCollection })
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      const result = await runPipelinesForBucket(
        'hourly',
        new Date('2026-03-15T00:00:00.000Z'),
        '2026-03-15T09:00:00.000+09:00',
        '2026-03-15T10:00:00.000+09:00'
      )

      expect(result.status).toBe('partial')
      expect(result.errors).toHaveLength(1)
    })

    // ── docsMatched: 원본 건수 기록 ──

    it('D1: stores docsMatched=0 when EQP_AUTO_RECOVERY has no matching documents', async () => {
      const earCollection = createMockCollection({ countResult: 0 })
      const mockEarsDb = createMockEarsDb({ 'EQP_AUTO_RECOVERY': earCollection })
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      await runPipelinesForBucket(
        'hourly', new Date('2026-03-15T00:00:00.000Z'),
        '2026-03-15T09:00:00.000+09:00', '2026-03-15T10:00:00.000+09:00'
      )

      const $set = mockCronRunLog.findOneAndUpdate.mock.calls[0][1].$set
      expect($set.docsMatched).toBe(0)
    })

    it('D2: stores docsMatched=150 when EQP_AUTO_RECOVERY has 150 matching documents', async () => {
      const earCollection = createMockCollection({ countResult: 150 })
      const mockEarsDb = createMockEarsDb({ 'EQP_AUTO_RECOVERY': earCollection })
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      await runPipelinesForBucket(
        'hourly', new Date('2026-03-15T00:00:00.000Z'),
        '2026-03-15T09:00:00.000+09:00', '2026-03-15T10:00:00.000+09:00'
      )

      const $set = mockCronRunLog.findOneAndUpdate.mock.calls[0][1].$set
      expect($set.docsMatched).toBe(150)
    })

    it('D3: countDocuments failure does not prevent pipeline execution — docsMatched=undefined', async () => {
      const earCollection = createMockCollection()
      earCollection.countDocuments.mockRejectedValue(new Error('timeout'))
      const mockEarsDb = createMockEarsDb({ 'EQP_AUTO_RECOVERY': earCollection })
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      const result = await runPipelinesForBucket(
        'hourly', new Date('2026-03-15T00:00:00.000Z'),
        '2026-03-15T09:00:00.000+09:00', '2026-03-15T10:00:00.000+09:00'
      )

      // pipelines still run
      expect(result.status).toBe('success')
      expect(earCollection.aggregate).toHaveBeenCalledTimes(4)
      // docsMatched is undefined
      const $set = mockCronRunLog.findOneAndUpdate.mock.calls[0][1].$set
      expect($set.docsMatched).toBeUndefined()
    })

    it('D4: selective execution (pipelineKeys) also stores docsMatched', async () => {
      const earCollection = createMockCollection({ countResult: 42 })
      const mockEarsDb = createMockEarsDb({ 'EQP_AUTO_RECOVERY': earCollection })
      const mockCronRunLog = createMockCronRunLog()
      // selective execution needs existing doc for findOneAndUpdate to return
      mockCronRunLog.findOneAndUpdate.mockResolvedValue({
        pipelineResults: new Map([
          ['scenario', 'success'], ['equipment', 'success'],
          ['trigger', 'success'], ['category', 'success']
        ])
      })
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

      await runPipelinesForBucket(
        'hourly', new Date('2026-03-15T00:00:00.000Z'),
        '2026-03-15T09:00:00.000+09:00', '2026-03-15T10:00:00.000+09:00',
        { pipelineKeys: ['trigger'] }
      )

      // selective path: first findOneAndUpdate is the merge call
      const firstCall = mockCronRunLog.findOneAndUpdate.mock.calls[0][1].$set
      expect(firstCall.docsMatched).toBe(42)
    })
  })

  describe('runBatch', () => {
    it('runs 3 pipelines and logs success when all succeed', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog, settlingHours: 0, autoBackfillLimit: 0 })

      await runBatch('hourly')

      // Should have called aggregate on EQP_AUTO_RECOVERY 4 times (scenario, equipment, trigger, category)
      const eqpColl = mockEarsDb.collection('EQP_AUTO_RECOVERY')
      expect(eqpColl.aggregate).toHaveBeenCalledTimes(4)

      // findOneAndUpdate should be called (from runPipelinesForBucket)
      expect(mockCronRunLog.findOneAndUpdate).toHaveBeenCalled()
      const updateCall = mockCronRunLog.findOneAndUpdate.mock.calls[0]
      expect(updateCall[1].$set.status).toBe('success')
      expect(updateCall[1].$set.source).toBe('cron')
    })

    it('logs partial when 1 of 3 pipelines fails', async () => {
      const failingCollection = createMockCollection()
      let callCount = 0
      failingCollection.aggregate.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return { toArray: vi.fn().mockRejectedValue(new Error('scenario pipeline failed')) }
        }
        return { toArray: vi.fn().mockResolvedValue([]) }
      })

      const mockEarsDb = createMockEarsDb({ 'EQP_AUTO_RECOVERY': failingCollection })
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog, settlingHours: 0, autoBackfillLimit: 0 })

      await runBatch('hourly')

      const updateCall = mockCronRunLog.findOneAndUpdate.mock.calls[0]
      expect(updateCall[1].$set.status).toBe('partial')
    })

    it('logs failed when all 3 pipelines fail', async () => {
      const failingCollection = createMockCollection()
      failingCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockRejectedValue(new Error('all failed'))
      })

      const mockEarsDb = createMockEarsDb({ 'EQP_AUTO_RECOVERY': failingCollection })
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog, settlingHours: 0, autoBackfillLimit: 0 })

      await runBatch('hourly')

      const updateCall = mockCronRunLog.findOneAndUpdate.mock.calls[0]
      expect(updateCall[1].$set.status).toBe('failed')
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
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog, settlingHours: 0, autoBackfillLimit: 0 })

      // Start two batch runs simultaneously
      const run1 = runBatch('hourly')
      const run2 = runBatch('hourly')

      await Promise.all([run1, run2])

      // Only one should have called findOneAndUpdate (the other should be skipped)
      expect(mockCronRunLog.findOneAndUpdate).toHaveBeenCalledTimes(1)
    })

    it('logs cron_failed batchAction when fatal error occurs in runBatch', async () => {
      const mockCronRunLog = createMockCronRunLog()
      // Make findOneAndUpdate throw to trigger the fatal catch block in runBatch
      mockCronRunLog.findOneAndUpdate.mockRejectedValue(new Error('DB connection lost'))

      const mockEarsDb = createMockEarsDb()
      const mockBatchLog = vi.fn().mockReturnValue(Promise.resolve())
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog, settlingHours: 0, autoBackfillLimit: 0, createBatchLog: mockBatchLog })

      await runBatch('hourly')

      // Should have called createBatchLog with cron_failed
      const cronFailedCall = mockBatchLog.mock.calls.find(
        call => call[0]?.batchAction === 'cron_failed'
      )
      expect(cronFailedCall).toBeDefined()
      expect(cronFailedCall[0].batchPeriod).toBe('hourly')
    })

    it('uses allowDiskUse option', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog, settlingHours: 0, autoBackfillLimit: 0 })

      await runBatch('daily')

      const eqpColl = mockEarsDb.collection('EQP_AUTO_RECOVERY')
      // Check that aggregate was called with allowDiskUse + maxTimeMS options
      for (const call of eqpColl.aggregate.mock.calls) {
        expect(call[1]).toEqual({ allowDiskUse: true, maxTimeMS: 55000 })
      }
    })
  })

  describe('detectGaps', () => {
    const fullPR = { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }

    it('returns empty array when no gaps', async () => {
      const mockCronRunLog = createMockCronRunLog()

      // Use a small window so we can precisely provide all expected buckets
      // Mock find to return whatever buckets detectGaps expects in a 3h window
      mockCronRunLog.find.mockImplementation((query) => {
        // Generate all buckets in the queried range to simulate "all completed"
        const start = query.bucket.$gte.getTime()
        const end = query.bucket.$lt.getTime()
        const allBuckets = []
        for (let t = start; t < end; t += 60 * 60 * 1000) {
          allBuckets.push({ bucket: new Date(t), pipelineResults: fullPR })
        }
        return {
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(allBuckets)
          })
        }
      })

      _setDeps({ earsDb: createMockEarsDb(), CronRunLog: mockCronRunLog, settlingHours: 3 })

      const gaps = await detectGaps('hourly', { scanWindowHours: 3 })
      expect(gaps).toEqual([])
    })

    it('returns missing buckets oldest first', async () => {
      const mockCronRunLog = createMockCronRunLog()
      // Return only some buckets as completed — gaps exist
      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([])
        })
      })

      _setDeps({
        earsDb: createMockEarsDb(),
        CronRunLog: mockCronRunLog,
        settlingHours: 0
      })

      const gaps = await detectGaps('hourly', { scanWindowHours: 3 })
      // Should have 3 gaps (3 hours window)
      expect(gaps.length).toBe(3)
      // Oldest first
      expect(gaps[0].getTime()).toBeLessThan(gaps[1].getTime())
      expect(gaps[1].getTime()).toBeLessThan(gaps[2].getTime())
    })

    it('applies settling time — scanEnd = now - settlingHours', async () => {
      const mockCronRunLog = createMockCronRunLog()
      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([])
        })
      })

      _setDeps({
        earsDb: createMockEarsDb(),
        CronRunLog: mockCronRunLog,
        settlingHours: 5
      })

      await detectGaps('hourly', { scanWindowHours: 2 })

      // Verify the find query uses correct date range
      const findCall = mockCronRunLog.find.mock.calls[0][0]
      expect(findCall.bucket.$gte).toBeDefined()
      expect(findCall.bucket.$lt).toBeDefined()
      // The range should be 2 hours wide, offset by settling
      const rangeMs = findCall.bucket.$lt.getTime() - findCall.bucket.$gte.getTime()
      expect(rangeMs).toBe(2 * 60 * 60 * 1000)
    })

    it('respects custom scanWindowHours', async () => {
      const mockCronRunLog = createMockCronRunLog()
      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([])
        })
      })

      _setDeps({
        earsDb: createMockEarsDb(),
        CronRunLog: mockCronRunLog,
        settlingHours: 0
      })

      const gaps = await detectGaps('hourly', { scanWindowHours: 5 })
      expect(gaps.length).toBe(5)
    })

    it('treats bucket with missing pipeline keys as gap (pipeline-aware)', async () => {
      const mockCronRunLog = createMockCronRunLog()

      mockCronRunLog.find.mockImplementation((query) => {
        const start = query.bucket.$gte.getTime()
        const end = query.bucket.$lt.getTime()
        const allBuckets = []
        for (let t = start; t < end; t += 60 * 60 * 1000) {
          // All buckets have only 3 keys — category missing
          allBuckets.push({
            bucket: new Date(t),
            pipelineResults: { scenario: 'success', equipment: 'success', trigger: 'success' }
          })
        }
        return {
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(allBuckets)
          })
        }
      })

      _setDeps({ earsDb: createMockEarsDb(), CronRunLog: mockCronRunLog, settlingHours: 3 })

      const gaps = await detectGaps('hourly', { scanWindowHours: 3 })
      // All 3 buckets should be gaps because category key is missing
      expect(gaps.length).toBe(3)
    })
  })

  describe('runBackfillCheck', () => {
    it('does nothing when no gaps', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()

      // Return all buckets within queried range as completed
      mockCronRunLog.find.mockImplementation((query) => {
        const start = query.bucket.$gte.getTime()
        const end = query.bucket.$lt.getTime()
        const allBuckets = []
        for (let t = start; t < end; t += 60 * 60 * 1000) {
          allBuckets.push({ bucket: new Date(t) })
        }
        return {
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(allBuckets)
          })
        }
      })

      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog, settlingHours: 3 })

      await runBackfillCheck('hourly')

      // No additional pipelines should have been run (findOneAndUpdate not called)
      expect(mockCronRunLog.findOneAndUpdate).not.toHaveBeenCalled()
    })

    it('processes up to autoBackfillLimit gaps', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      // Return empty — all buckets are gaps
      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([])
        })
      })

      const sleepFn = vi.fn().mockResolvedValue(undefined)
      _setDeps({
        earsDb: mockEarsDb,
        CronRunLog: mockCronRunLog,
        settlingHours: 0,
        autoBackfillLimit: 6,
        defaultThrottleMs: 100,
        sleep: sleepFn
      })

      await runBackfillCheck('hourly')

      // Should process exactly 6 buckets
      expect(mockCronRunLog.findOneAndUpdate).toHaveBeenCalledTimes(6)
      // Sleep called between buckets (5 times for 6 buckets)
      expect(sleepFn).toHaveBeenCalledTimes(5)
      expect(sleepFn).toHaveBeenCalledWith(100)
    })

    it('throttles between bucket processing', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([])
        })
      })

      const sleepFn = vi.fn().mockResolvedValue(undefined)
      _setDeps({
        earsDb: mockEarsDb,
        CronRunLog: mockCronRunLog,
        settlingHours: 0,
        autoBackfillLimit: 3,
        defaultThrottleMs: 500,
        sleep: sleepFn
      })

      await runBackfillCheck('hourly')

      // 3 buckets → 2 throttle calls
      expect(sleepFn).toHaveBeenCalledTimes(2)
      expect(sleepFn).toHaveBeenCalledWith(500)
    })
  })

  describe('runManualBackfill', () => {
    it('transitions status: idle → running → completed', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      _setDeps({
        earsDb: mockEarsDb,
        CronRunLog: mockCronRunLog,
        settlingHours: 0,
        sleep: vi.fn().mockResolvedValue(undefined)
      })

      expect((await getBackfillState()).status).toBe('idle')

      await runManualBackfill(
        new Date('2026-03-15T00:00:00.000Z'),
        new Date('2026-03-15T03:00:00.000Z'),
        { skipDaily: true, throttleMs: 0 }
      )

      // Wait for background processing
      await _getBackfillPromise()

      const state = await getBackfillState()
      expect(state.status).toBe('completed')
      expect(state.total).toBe(3) // 3 hourly buckets
    })

    it('skips already completed buckets', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()

      // First call (getCompletedBucketSet) returns 1 completed bucket (all pipeline keys present)
      const completedBucket = new Date('2026-03-15T00:00:00.000Z')
      const fullPR = { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }
      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([{ bucket: completedBucket, pipelineResults: fullPR }])
        })
      })

      _setDeps({
        earsDb: mockEarsDb,
        CronRunLog: mockCronRunLog,
        settlingHours: 0,
        sleep: vi.fn().mockResolvedValue(undefined)
      })

      await runManualBackfill(
        new Date('2026-03-15T00:00:00.000Z'),
        new Date('2026-03-15T03:00:00.000Z'),
        { skipDaily: true, throttleMs: 0 }
      )

      await _getBackfillPromise()

      const state = await getBackfillState()
      expect(state.skipped).toBe(1)
      // 2 actually processed via pipeline (3 total - 1 skipped)
      expect(mockCronRunLog.findOneAndUpdate).toHaveBeenCalledTimes(2)
    })

    it('cancellation stops processing at next bucket', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()

      let callCount = 0
      const sleepFn = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          // Cancel after first bucket processing
          await cancelBackfill()
        }
      })

      _setDeps({
        earsDb: mockEarsDb,
        CronRunLog: mockCronRunLog,
        settlingHours: 0,
        sleep: sleepFn
      })

      await runManualBackfill(
        new Date('2026-03-15T00:00:00.000Z'),
        new Date('2026-03-15T05:00:00.000Z'),
        { skipDaily: true, throttleMs: 100 }
      )

      await _getBackfillPromise()

      const state = await getBackfillState()
      expect(state.status).toBe('cancelled')
      // Should have processed fewer than 5 buckets
      expect(mockCronRunLog.findOneAndUpdate.mock.calls.length).toBeLessThan(5)
    })

    it('continues on individual bucket errors', async () => {
      const mockEarsDb = createMockEarsDb()
      const failingCollection = createMockCollection()
      let aggCallCount = 0
      failingCollection.aggregate.mockImplementation(() => {
        aggCallCount++
        // Fail on 2nd bucket's pipelines (calls 4,5,6)
        if (aggCallCount >= 4 && aggCallCount <= 6) {
          return { toArray: vi.fn().mockRejectedValue(new Error('pipeline error')) }
        }
        return { toArray: vi.fn().mockResolvedValue([]) }
      })
      mockEarsDb.collection.mockImplementation((name) => {
        if (name === 'EQP_AUTO_RECOVERY') return failingCollection
        return createMockCollection()
      })

      const mockCronRunLog = createMockCronRunLog()
      _setDeps({
        earsDb: mockEarsDb,
        CronRunLog: mockCronRunLog,
        settlingHours: 0,
        sleep: vi.fn().mockResolvedValue(undefined)
      })

      await runManualBackfill(
        new Date('2026-03-15T00:00:00.000Z'),
        new Date('2026-03-15T03:00:00.000Z'),
        { skipDaily: true, throttleMs: 0 }
      )

      await _getBackfillPromise()

      const state = await getBackfillState()
      expect(state.status).toBe('completed')
      // All 3 buckets processed (even the failed one)
      expect(mockCronRunLog.findOneAndUpdate).toHaveBeenCalledTimes(3)
    })

    it('caps errors array at 100', async () => {
      const mockEarsDb = createMockEarsDb()
      const failingCollection = createMockCollection()
      failingCollection.aggregate.mockReturnValue({
        toArray: vi.fn().mockRejectedValue(new Error('always fail'))
      })
      mockEarsDb.collection.mockImplementation((name) => {
        if (name === 'EQP_AUTO_RECOVERY') return failingCollection
        return createMockCollection()
      })

      const mockCronRunLog = createMockCronRunLog()
      // findOneAndUpdate will throw to trigger the error path in processBackfill
      // Actually, runPipelinesForBucket catches individual pipeline errors and
      // returns status:failed, so we need to make findOneAndUpdate throw
      mockCronRunLog.findOneAndUpdate.mockRejectedValue(new Error('db write fail'))

      // Generate 110 hourly buckets
      const start = new Date('2026-03-01T00:00:00.000Z')
      const end = new Date(start.getTime() + 110 * 60 * 60 * 1000)

      _setDeps({
        earsDb: mockEarsDb,
        CronRunLog: mockCronRunLog,
        settlingHours: 0,
        sleep: vi.fn().mockResolvedValue(undefined)
      })

      await runManualBackfill(start, end, { skipDaily: true, throttleMs: 0 })
      await _getBackfillPromise()

      const state = await getBackfillState()
      expect(state.errors.length).toBeLessThanOrEqual(100)
    })

    it('throws if already running', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      // Make processing slow
      const sleepFn = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 500)))
      _setDeps({
        earsDb: mockEarsDb,
        CronRunLog: mockCronRunLog,
        settlingHours: 0,
        sleep: sleepFn
      })

      await runManualBackfill(
        new Date('2026-03-15T00:00:00.000Z'),
        new Date('2026-03-15T03:00:00.000Z'),
        { skipDaily: true }
      )

      // Try to start another while running
      await expect(runManualBackfill(
        new Date('2026-03-15T00:00:00.000Z'),
        new Date('2026-03-15T03:00:00.000Z'),
        { skipDaily: true }
      )).rejects.toThrow('Backfill already in progress')

      // Clean up
      await cancelBackfill()
      await _getBackfillPromise()
    })

    it('with retryPartial=true, processes only partial and incomplete buckets, skips pending and complete', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()

      const fullPR = { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }
      const successBucket = new Date('2026-03-14T15:00:00.000Z')
      const partialBucket = new Date('2026-03-15T15:00:00.000Z')
      // pendingBucket = 2026-03-16T15:00:00.000Z (no log entry)

      mockCronRunLog.find = vi.fn().mockImplementation((query) => {
        let result
        if (query.status === 'partial') {
          result = [{ bucket: partialBucket, pipelineResults: { scenario: 'success', equipment: 'success', trigger: 'failed: timeout', category: 'success' } }]
        } else if (query.status?.$in) {
          result = [
            { bucket: successBucket, pipelineResults: fullPR },
            { bucket: partialBucket, pipelineResults: { scenario: 'success', equipment: 'success', trigger: 'failed: timeout', category: 'success' } }
          ]
        } else {
          result = []
        }
        return {
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(result)
          })
        }
      })

      _setDeps({
        earsDb: mockEarsDb,
        CronRunLog: mockCronRunLog,
        settlingHours: 0,
        sleep: vi.fn()
      })

      const start = new Date('2026-03-14T15:00:00.000Z')
      const end = new Date('2026-03-17T15:00:00.000Z')

      await runManualBackfill(start, end, {
        skipHourly: true,
        retryPartial: true,
        throttleMs: 0
      })

      await _getBackfillPromise()

      const state = await getBackfillState()
      expect(state.status).toBe('completed')
      expect(state.total).toBe(3)
      expect(state.skipped).toBe(2)
    })

    // ── processBackfill verify ──

    it('P1: verify=true reprocesses orphanedLog buckets (removes from completedSet)', async () => {
      const mockEarsDb = createMockEarsDb()
      // distinct for getSummaryBucketSet: return empty (no SUMMARY data)
      for (const config of Object.values(PIPELINE_CONFIGS)) {
        mockEarsDb._collections[config.collection] = {
          ...createMockCollection(),
          distinct: vi.fn().mockResolvedValue([])
        }
      }

      const mockCronRunLog = createMockCronRunLog()
      const completedBucket = new Date('2026-03-15T00:00:00.000Z')
      const fullPR = { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }

      // CRON_RUN_LOG.find: used by both getCompletedBucketSet and getOrphanedBuckets
      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { bucket: completedBucket, pipelineResults: fullPR, docsMatched: 100 }
          ])
        })
      })

      _setDeps({
        earsDb: mockEarsDb,
        CronRunLog: mockCronRunLog,
        settlingHours: 0,
        sleep: vi.fn().mockResolvedValue(undefined)
      })

      await runManualBackfill(
        new Date('2026-03-15T00:00:00.000Z'),
        new Date('2026-03-15T03:00:00.000Z'),
        { skipDaily: true, throttleMs: 0, verify: true }
      )
      await _getBackfillPromise()

      const state = await getBackfillState()
      // Without verify: orphanedLog bucket would be skipped (it's in completedSet)
      // With verify: orphanedLog (docsMatched=100 + no SUMMARY) → removed from completedSet → processed
      // 3 hourly buckets total, 0 skipped (the completed bucket was orphanedLog → reprocessed)
      expect(state.skipped).toBe(0)
      expect(state.total).toBe(3)
    })

    it('P2: verify=false does not call getOrphanedBuckets (existing behavior)', async () => {
      const mockEarsDb = createMockEarsDb()
      const mockCronRunLog = createMockCronRunLog()
      const completedBucket = new Date('2026-03-15T00:00:00.000Z')
      const fullPR = { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }

      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { bucket: completedBucket, pipelineResults: fullPR }
          ])
        })
      })

      _setDeps({
        earsDb: mockEarsDb,
        CronRunLog: mockCronRunLog,
        settlingHours: 0,
        sleep: vi.fn().mockResolvedValue(undefined)
      })

      await runManualBackfill(
        new Date('2026-03-15T00:00:00.000Z'),
        new Date('2026-03-15T03:00:00.000Z'),
        { skipDaily: true, throttleMs: 0 }  // verify=false (default)
      )
      await _getBackfillPromise()

      const state = await getBackfillState()
      // completedBucket is skipped as usual
      expect(state.skipped).toBe(1)
      expect(state.total).toBe(3)
      // No distinct calls to SUMMARY collections
      for (const config of Object.values(PIPELINE_CONFIGS)) {
        const coll = mockEarsDb._collections[config.collection]
        if (coll?.distinct) {
          expect(coll.distinct).not.toHaveBeenCalled()
        }
      }
    })

    it('P3: verify=true + retryPartial=true includes orphanedLog in processing', async () => {
      const mockEarsDb = createMockEarsDb()
      for (const config of Object.values(PIPELINE_CONFIGS)) {
        mockEarsDb._collections[config.collection] = {
          ...createMockCollection(),
          distinct: vi.fn().mockResolvedValue([])
        }
      }

      const mockCronRunLog = createMockCronRunLog()
      const completedBucket = new Date('2026-03-15T00:00:00.000Z')
      const fullPR = { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }

      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { bucket: completedBucket, pipelineResults: fullPR, docsMatched: 50 }
          ])
        })
      })

      _setDeps({
        earsDb: mockEarsDb,
        CronRunLog: mockCronRunLog,
        settlingHours: 0,
        sleep: vi.fn().mockResolvedValue(undefined)
      })

      await runManualBackfill(
        new Date('2026-03-15T00:00:00.000Z'),
        new Date('2026-03-15T03:00:00.000Z'),
        { skipDaily: true, throttleMs: 0, retryPartial: true, verify: true }
      )
      await _getBackfillPromise()

      const state = await getBackfillState()
      // retryPartial path: normally only partial/incomplete processed
      // verify=true: orphanedLog (docsMatched=50 + no SUMMARY) also processed
      // The orphanedLog bucket should NOT be skipped
      expect(state.total).toBe(3) // 3 expected buckets
      // 2 are skipped (not partial, not incomplete, not orphanedLog)
      // 1 is orphanedLog → processed
      expect(state.skipped).toBe(2)
    })
  })

  describe('getCompletedBucketSet', () => {
    const fullPR = { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }

    it('queries by jobName only (source-agnostic)', async () => {
      const mockCronRunLog = createMockCronRunLog()
      const completedBuckets = [
        { bucket: new Date('2026-03-15T00:00:00.000Z'), pipelineResults: fullPR },
        { bucket: new Date('2026-03-15T01:00:00.000Z'), pipelineResults: fullPR }
      ]
      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(completedBuckets)
        })
      })

      _setDeps({ earsDb: createMockEarsDb(), CronRunLog: mockCronRunLog })

      const result = await getCompletedBucketSet(
        'hourly',
        new Date('2026-03-15T00:00:00.000Z'),
        new Date('2026-03-15T03:00:00.000Z')
      )

      expect(result).toBeInstanceOf(Set)
      expect(result.size).toBe(2)

      // Verify query does NOT include source filter
      const findCall = mockCronRunLog.find.mock.calls[0][0]
      expect(findCall.jobName).toBe('recoverySummary')
      expect(findCall).not.toHaveProperty('source')
    })

    it('with retryPartial=true, excludes partial from completed set', async () => {
      const mockCronRunLog = createMockCronRunLog()
      mockCronRunLog.find = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { bucket: new Date('2026-03-16T15:00:00.000Z'), pipelineResults: fullPR }
          ])
        })
      })
      _setDeps({ CronRunLog: mockCronRunLog })

      const start = new Date('2026-03-16T15:00:00.000Z')
      const end = new Date('2026-03-18T15:00:00.000Z')
      await getCompletedBucketSet('daily', start, end, { retryPartial: true })

      expect(mockCronRunLog.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: { $in: ['success'] }
        })
      )
    })

    it('excludes buckets missing pipeline keys (pipeline-aware)', async () => {
      const mockCronRunLog = createMockCronRunLog()
      const bucket1 = new Date('2026-04-10T00:00:00Z')
      const bucket2 = new Date('2026-04-10T01:00:00Z')
      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { bucket: bucket1, pipelineResults: { scenario: 'success', equipment: 'success', trigger: 'success' } },
            { bucket: bucket2, pipelineResults: fullPR }
          ])
        })
      })
      _setDeps({ CronRunLog: mockCronRunLog })

      const result = await getCompletedBucketSet('hourly', new Date('2026-04-10T00:00:00Z'), new Date('2026-04-11T00:00:00Z'))

      expect(result.has(bucket1.getTime())).toBe(false)
      expect(result.has(bucket2.getTime())).toBe(true)
    })
  })

  describe('getPartialBucketSet', () => {
    it('returns only partial bucket timestamps', async () => {
      const mockCronRunLog = createMockCronRunLog()
      const partialBucket = new Date('2026-03-16T15:00:00.000Z')
      mockCronRunLog.find = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { bucket: partialBucket }
          ])
        })
      })
      _setDeps({ CronRunLog: mockCronRunLog })

      const start = new Date('2026-03-16T15:00:00.000Z')
      const end = new Date('2026-03-18T15:00:00.000Z')
      const result = await getPartialBucketSet('daily', start, end)

      expect(result).toBeInstanceOf(Set)
      expect(result.has(partialBucket.getTime())).toBe(true)
      expect(mockCronRunLog.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'partial'
        })
      )
    })
  })

  describe('validateBackfillRange', () => {
    it('valid 1-year range', () => {
      const result = validateBackfillRange(
        '2025-03-15T00:00:00.000Z',
        '2026-03-15T00:00:00.000Z'
      )
      expect(result.valid).toBe(true)
    })

    it('invalid 3-year range', () => {
      const result = validateBackfillRange(
        '2023-03-15T00:00:00.000Z',
        '2026-03-15T00:00:00.000Z'
      )
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/730/)
    })

    it('invalid: start >= end', () => {
      const result = validateBackfillRange(
        '2026-03-15T00:00:00.000Z',
        '2026-03-14T00:00:00.000Z'
      )
      expect(result.valid).toBe(false)
    })

    it('invalid: missing dates', () => {
      expect(validateBackfillRange(null, null).valid).toBe(false)
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

  // ═══════════════════════════════════════════════════════
  // 데이터 중복 방지 (Data Duplication Prevention)
  // ═══════════════════════════════════════════════════════

  describe('data duplication prevention', () => {
    describe('CRON_RUN_LOG uniqueness', () => {
      it('findOneAndUpdate always passes upsert:true option', async () => {
        const mockEarsDb = createMockEarsDb()
        const mockCronRunLog = createMockCronRunLog()
        _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

        await runPipelinesForBucket(
          'hourly',
          new Date('2026-03-15T00:00:00.000Z'),
          '2026-03-15T09:00:00.000+09:00',
          '2026-03-15T10:00:00.000+09:00'
        )

        const opts = mockCronRunLog.findOneAndUpdate.mock.calls[0][2]
        expect(opts.upsert).toBe(true)
      })

      it('filter key matches unique index shape (jobName + period + bucket)', async () => {
        const mockEarsDb = createMockEarsDb()
        const mockCronRunLog = createMockCronRunLog()
        _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

        const bucket = new Date('2026-03-15T00:00:00.000Z')
        await runPipelinesForBucket('daily', bucket, 'gte', 'lt')

        const filter = mockCronRunLog.findOneAndUpdate.mock.calls[0][0]
        expect(Object.keys(filter).sort()).toEqual(['bucket', 'jobName', 'period'])
        expect(filter.jobName).toBe('recoverySummary')
        expect(filter.period).toBe('daily')
        expect(filter.bucket).toBe(bucket)
      })

      it('uses $set (not $setOnInsert) — second upsert fully replaces first', async () => {
        const mockEarsDb = createMockEarsDb()
        const mockCronRunLog = createMockCronRunLog()
        _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

        const bucket = new Date('2026-03-15T00:00:00.000Z')
        await runPipelinesForBucket('hourly', bucket, 'gte', 'lt', { source: 'cron' })
        await runPipelinesForBucket('hourly', bucket, 'gte', 'lt', { source: 'manualBackfill' })

        // Both use $set — meaning full overwrite, not insert-only
        for (const call of mockCronRunLog.findOneAndUpdate.mock.calls) {
          expect(call[1]).toHaveProperty('$set')
          expect(call[1]).not.toHaveProperty('$setOnInsert')
          // $set includes all important fields
          const $set = call[1].$set
          expect($set).toHaveProperty('status')
          expect($set).toHaveProperty('source')
          expect($set).toHaveProperty('pipelineResults')
          expect($set).toHaveProperty('completedAt')
        }
      })

      it('initializeRecoverySummary creates unique index on CRON_RUN_LOG', async () => {
        const mockEarsDb = createMockEarsDb()
        const mockCronRunLog = createMockCronRunLog()
        _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

        await initializeRecoverySummary()

        expect(mockCronRunLog.collection.createIndex).toHaveBeenCalledWith(
          { jobName: 1, period: 1, bucket: 1 },
          { unique: true }
        )
      })
    })

    describe('Summary collection uniqueness', () => {
      it('all 3 pipelines use $merge with whenMatched:replace + whenNotMatched:insert', () => {
        const bucket = new Date('2026-03-15T00:00:00.000Z')
        for (const configKey of Object.keys(PIPELINE_CONFIGS)) {
          const pipeline = buildPipeline(configKey, 'hourly', bucket, 'gte', 'lt')
          const merge = pipeline[5].$merge
          expect(merge.whenMatched).toBe('replace')
          expect(merge.whenNotMatched).toBe('insert')
        }
      })

      it('$merge on-fields match unique index for each collection', () => {
        const bucket = new Date('2026-03-15T00:00:00.000Z')
        // scenario: period + bucket + line + process + model + ears_code
        const scenarioPipeline = buildPipeline('scenario', 'hourly', bucket, 'gte', 'lt')
        expect(scenarioPipeline[5].$merge.on).toEqual(['period', 'bucket', 'line', 'process', 'model', 'ears_code'])

        // equipment: period + bucket + line + process + model + eqpid
        const equipmentPipeline = buildPipeline('equipment', 'hourly', bucket, 'gte', 'lt')
        expect(equipmentPipeline[5].$merge.on).toEqual(['period', 'bucket', 'line', 'process', 'model', 'eqpid'])

        // trigger: period + bucket + line + process + model + trigger_by
        const triggerPipeline = buildPipeline('trigger', 'hourly', bucket, 'gte', 'lt')
        expect(triggerPipeline[5].$merge.on).toEqual(['period', 'bucket', 'line', 'process', 'model', 'trigger_by'])
      })

      it('initializeRecoverySummary creates matching unique indexes on all 3 collections', async () => {
        const mockEarsDb = createMockEarsDb()
        const mockCronRunLog = createMockCronRunLog()
        _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

        await initializeRecoverySummary()

        // Verify each collection's unique index matches its $merge on-fields
        const scenarios = mockEarsDb.collection('RECOVERY_SUMMARY_BY_SCENARIO')
        const indexKeys = scenarios.createIndex.mock.calls[0][0]
        expect(Object.keys(indexKeys)).toEqual(['period', 'bucket', 'line', 'process', 'model', 'ears_code'])
        expect(scenarios.createIndex.mock.calls[0][1]).toEqual({ unique: true })

        const equip = mockEarsDb.collection('RECOVERY_SUMMARY_BY_EQUIPMENT')
        expect(Object.keys(equip.createIndex.mock.calls[0][0])).toEqual(['period', 'bucket', 'line', 'process', 'model', 'eqpid'])

        const trigger = mockEarsDb.collection('RECOVERY_SUMMARY_BY_TRIGGER')
        expect(Object.keys(trigger.createIndex.mock.calls[0][0])).toEqual(['period', 'bucket', 'line', 'process', 'model', 'trigger_by'])
      })
    })

    describe('settling time separation — cron vs backfill non-overlap', () => {
      it('manual backfill clamps endDate to now - settlingHours', async () => {
        const mockEarsDb = createMockEarsDb()
        const mockCronRunLog = createMockCronRunLog()
        _setDeps({
          earsDb: mockEarsDb,
          CronRunLog: mockCronRunLog,
          settlingHours: 3,
          sleep: vi.fn().mockResolvedValue(undefined)
        })

        // Try to backfill up to "now" — should be clamped to now-3h
        const now = new Date()
        const futureEnd = new Date(now.getTime() + 60 * 60 * 1000) // 1h in the future
        const start = new Date(now.getTime() - 10 * 60 * 60 * 1000) // 10h ago

        await runManualBackfill(start, futureEnd, { skipDaily: true, throttleMs: 0 })
        await _getBackfillPromise()

        // All processed buckets should be <= now - 3h
        const maxAllowedTime = now.getTime() - 3 * 60 * 60 * 1000
        for (const call of mockCronRunLog.findOneAndUpdate.mock.calls) {
          const bucketTime = call[0].bucket.getTime()
          expect(bucketTime).toBeLessThanOrEqual(maxAllowedTime)
        }
      })

      it('detectGaps scanEnd respects settlingHours — does not detect recent buckets as gaps', async () => {
        const mockCronRunLog = createMockCronRunLog()
        mockCronRunLog.find.mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([])
          })
        })

        _setDeps({
          earsDb: createMockEarsDb(),
          CronRunLog: mockCronRunLog,
          settlingHours: 5
        })

        const gaps = await detectGaps('hourly', { scanWindowHours: 3 })

        // All gaps should be older than now - 5h
        const maxGapTime = Date.now() - 5 * 60 * 60 * 1000
        for (const gap of gaps) {
          expect(gap.getTime()).toBeLessThanOrEqual(maxGapTime)
        }
      })

      it('runBatch(hourly) applies settling when computing boundaries', async () => {
        const mockEarsDb = createMockEarsDb()
        const mockCronRunLog = createMockCronRunLog()
        _setDeps({
          earsDb: mockEarsDb,
          CronRunLog: mockCronRunLog,
          settlingHours: 3,
          autoBackfillLimit: 0
        })

        await runBatch('hourly')

        // The bucket should be ~4 hours ago (settling=3 + 1 for "previous completed")
        // We can verify by checking the bucket in findOneAndUpdate filter
        const filter = mockCronRunLog.findOneAndUpdate.mock.calls[0][0]
        const bucketTime = filter.bucket.getTime()
        const now = Date.now()
        // Bucket should be at least 3 hours old
        expect(now - bucketTime).toBeGreaterThanOrEqual(3 * 60 * 60 * 1000)
      })
    })

    describe('concurrent cron + manual backfill safety', () => {
      it('runPipelinesForBucket is safe when called concurrently for same bucket', async () => {
        const mockEarsDb = createMockEarsDb()
        const mockCronRunLog = createMockCronRunLog()
        _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

        const bucket = new Date('2026-03-15T00:00:00.000Z')
        const args = ['hourly', bucket, '2026-03-15T09:00:00.000+09:00', '2026-03-15T10:00:00.000+09:00']

        // Simulate cron and manual backfill hitting the same bucket concurrently
        const [r1, r2] = await Promise.all([
          runPipelinesForBucket(...args, { source: 'cron' }),
          runPipelinesForBucket(...args, { source: 'manualBackfill' })
        ])

        // Both succeed (neither throws)
        expect(r1.status).toBe('success')
        expect(r2.status).toBe('success')

        // Both called findOneAndUpdate with same filter (upsert ensures no duplicate)
        expect(mockCronRunLog.findOneAndUpdate).toHaveBeenCalledTimes(2)
        const filter1 = mockCronRunLog.findOneAndUpdate.mock.calls[0][0]
        const filter2 = mockCronRunLog.findOneAndUpdate.mock.calls[1][0]
        expect(filter1).toEqual(filter2)

        // Both have upsert: true
        expect(mockCronRunLog.findOneAndUpdate.mock.calls[0][2].upsert).toBe(true)
        expect(mockCronRunLog.findOneAndUpdate.mock.calls[1][2].upsert).toBe(true)
      })

      it('manual backfill skips buckets already completed by cron', async () => {
        const mockEarsDb = createMockEarsDb()
        const mockCronRunLog = createMockCronRunLog()

        // Simulate: buckets 00:00 and 01:00 already completed by cron (all pipeline keys)
        const fullPR = { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }
        const cronBuckets = [
          { bucket: new Date('2026-03-15T00:00:00.000Z'), pipelineResults: fullPR },
          { bucket: new Date('2026-03-15T01:00:00.000Z'), pipelineResults: fullPR }
        ]
        mockCronRunLog.find.mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(cronBuckets)
          })
        })

        _setDeps({
          earsDb: mockEarsDb,
          CronRunLog: mockCronRunLog,
          settlingHours: 0,
          sleep: vi.fn().mockResolvedValue(undefined)
        })

        // Manual backfill for 00:00~04:00 (4 buckets)
        await runManualBackfill(
          new Date('2026-03-15T00:00:00.000Z'),
          new Date('2026-03-15T04:00:00.000Z'),
          { skipDaily: true, throttleMs: 0 }
        )
        await _getBackfillPromise()

        const state = await getBackfillState()
        expect(state.skipped).toBe(2)  // 00:00 and 01:00 skipped
        // Only 02:00 and 03:00 processed
        expect(mockCronRunLog.findOneAndUpdate).toHaveBeenCalledTimes(2)

        // Verify processed buckets are the non-completed ones
        const processedBuckets = mockCronRunLog.findOneAndUpdate.mock.calls
          .map(c => c[0].bucket.getTime())
        expect(processedBuckets).not.toContain(new Date('2026-03-15T00:00:00.000Z').getTime())
        expect(processedBuckets).not.toContain(new Date('2026-03-15T01:00:00.000Z').getTime())
      })

      it('getCompletedBucketSet only considers success/partial — failed/running are re-processable', async () => {
        const mockCronRunLog = createMockCronRunLog()
        // Simulate: bucket with 'failed' status — should NOT be in completed set
        mockCronRunLog.find.mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([])  // empty because status filter excludes failed
          })
        })

        _setDeps({ earsDb: createMockEarsDb(), CronRunLog: mockCronRunLog })

        const result = await getCompletedBucketSet(
          'hourly',
          new Date('2026-03-15T00:00:00.000Z'),
          new Date('2026-03-15T03:00:00.000Z')
        )

        // Verify status filter
        const findCall = mockCronRunLog.find.mock.calls[0][0]
        expect(findCall.status).toEqual({ $in: ['success', 'partial'] })

        // Set should be empty (failed buckets not counted as completed)
        expect(result.size).toBe(0)
      })

      it('auto-backfill source is recorded — distinguishable from cron in logs', async () => {
        const mockEarsDb = createMockEarsDb()
        const mockCronRunLog = createMockCronRunLog()
        mockCronRunLog.find.mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([])
          })
        })

        const sleepFn = vi.fn().mockResolvedValue(undefined)
        _setDeps({
          earsDb: mockEarsDb,
          CronRunLog: mockCronRunLog,
          settlingHours: 0,
          autoBackfillLimit: 2,
          defaultThrottleMs: 0,
          sleep: sleepFn
        })

        await runBackfillCheck('hourly')

        // All auto-backfill writes should have source: 'autoBackfill'
        for (const call of mockCronRunLog.findOneAndUpdate.mock.calls) {
          expect(call[1].$set.source).toBe('autoBackfill')
        }
      })
    })

    describe('hourly/daily bucket isolation', () => {
      it('hourly and daily buckets for same time have different period keys — no cross-contamination', async () => {
        const mockEarsDb = createMockEarsDb()
        const mockCronRunLog = createMockCronRunLog()
        _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })

        const bucket = new Date('2026-03-15T00:00:00.000Z')

        await runPipelinesForBucket('hourly', bucket, 'gte', 'lt')
        await runPipelinesForBucket('daily', bucket, 'gte', 'lt')

        // Two distinct records (different period in filter)
        expect(mockCronRunLog.findOneAndUpdate).toHaveBeenCalledTimes(2)
        const filter1 = mockCronRunLog.findOneAndUpdate.mock.calls[0][0]
        const filter2 = mockCronRunLog.findOneAndUpdate.mock.calls[1][0]
        expect(filter1.period).toBe('hourly')
        expect(filter2.period).toBe('daily')
        // Same bucket but different period = different unique keys
        expect(filter1).not.toEqual(filter2)
      })
    })
  })

  // ═══════════════════════════════════════════════════════
  // 시뮬레이션 통합 테스트 (B1~B4)
  // Stateful mock — findOneAndUpdate로 쓴 데이터를 find에서 읽을 수 있음
  // ═══════════════════════════════════════════════════════

  describe('simulation integration tests (B1~B4)', () => {
    /**
     * Stateful CronRunLog mock: 실제 DB처럼 데이터 저장/조회 가능
     */
    function createStatefulCronRunLog() {
      // In-memory store: key = `${jobName}|${period}|${bucket.getTime()}`
      const store = new Map()

      function makeKey(jobName, period, bucket) {
        const t = bucket instanceof Date ? bucket.getTime() : new Date(bucket).getTime()
        return `${jobName}|${period}|${t}`
      }

      const MockModel = vi.fn(function (data) {
        Object.assign(this, data)
        this.save = vi.fn().mockImplementation(async () => {
          const key = makeKey(data.jobName, data.period, data.bucket)
          store.set(key, { ...data })
        })
      })

      MockModel.findOneAndUpdate = vi.fn().mockImplementation(async (filter, update, opts) => {
        const key = makeKey(filter.jobName, filter.period, filter.bucket)
        const existing = store.get(key) || {}
        const merged = { ...existing, ...filter, ...update.$set }
        store.set(key, merged)
        return merged
      })

      MockModel.find = vi.fn().mockImplementation((query) => {
        const results = []
        for (const doc of store.values()) {
          // Match query conditions
          if (query.jobName && doc.jobName !== query.jobName) continue
          if (query.period && doc.period !== query.period) continue

          // bucket range filter
          if (query.bucket) {
            const docTime = doc.bucket instanceof Date ? doc.bucket.getTime() : new Date(doc.bucket).getTime()
            if (query.bucket.$gte) {
              const gte = query.bucket.$gte instanceof Date ? query.bucket.$gte.getTime() : new Date(query.bucket.$gte).getTime()
              if (docTime < gte) continue
            }
            if (query.bucket.$lt) {
              const lt = query.bucket.$lt instanceof Date ? query.bucket.$lt.getTime() : new Date(query.bucket.$lt).getTime()
              if (docTime >= lt) continue
            }
            if (query.bucket.$lte) {
              const lte = query.bucket.$lte instanceof Date ? query.bucket.$lte.getTime() : new Date(query.bucket.$lte).getTime()
              if (docTime > lte) continue
            }
          }

          // status filter
          if (query.status?.$in) {
            if (!query.status.$in.includes(doc.status)) continue
          }

          results.push({ ...doc, bucket: doc.bucket instanceof Date ? doc.bucket : new Date(doc.bucket) })
        }
        return {
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(results)
          })
        }
      })

      // findOne — 사전 체크: 같은 {jobName, period, bucket}이 success/partial이면 반환
      // (.lean(), .sort().lean(), .select().lean() 체인 모두 지원)
      MockModel.findOne = vi.fn().mockImplementation((query) => {
        let hit = null
        if (query?.jobName && query?.period && query?.bucket) {
          const key = makeKey(query.jobName, query.period, query.bucket)
          const doc = store.get(key)
          if (doc && (!query.status?.$in || query.status.$in.includes(doc.status))) {
            hit = doc
          }
        }
        const leanFn = vi.fn().mockResolvedValue(hit)
        return {
          lean: leanFn,
          sort: vi.fn().mockReturnValue({ lean: leanFn }),
          select: vi.fn().mockReturnValue({ lean: leanFn })
        }
      })

      MockModel.collection = {
        createIndex: vi.fn().mockResolvedValue('ok')
      }

      MockModel._store = store
      MockModel._makeKey = makeKey
      return MockModel
    }

    describe('B1: Settling Time — cron이 settling 이전 bucket만 처리', () => {
      it('settling=3일 때 runBatch가 now-4h bucket을 처리하고 CRON_RUN_LOG에 정확히 1건', async () => {
        const mockEarsDb = createMockEarsDb()
        const statefulLog = createStatefulCronRunLog()

        _setDeps({
          earsDb: mockEarsDb,
          CronRunLog: statefulLog,
          settlingHours: 3,
          autoBackfillLimit: 0,  // auto-backfill 비활성화 — B1은 cron만 테스트
          sleep: vi.fn().mockResolvedValue(undefined)
        })

        await runBatch('hourly')

        // CRON_RUN_LOG에 정확히 1건
        expect(statefulLog._store.size).toBe(1)

        // 저장된 레코드 확인
        const record = [...statefulLog._store.values()][0]
        expect(record.jobName).toBe('recoverySummary')
        expect(record.period).toBe('hourly')
        expect(record.status).toBe('success')
        expect(record.source).toBe('cron')

        // bucket 시간: now - (settling + 1) 시간대
        // settling=3 → computeHourlyBoundaries(now, 3) → now-3h의 이전 완료 시간
        const bucketTime = record.bucket instanceof Date ? record.bucket.getTime() : new Date(record.bucket).getTime()
        const now = Date.now()
        const minAge = 3 * 60 * 60 * 1000  // 최소 3시간 전
        expect(now - bucketTime).toBeGreaterThanOrEqual(minAge)
      })
    })

    describe('B2: 자동 Backfill gap 복구 — 누락 bucket 자동 채움', () => {
      it('scanWindow 내 4개 gap을 삭제하면 auto-backfill이 채우고, 재실행 시 gap 0개', async () => {
        // 시간 고정 — detectGaps 내부의 new Date()와 setup의 시간이 동일
        const frozenNow = new Date('2026-03-17T12:00:00.000Z')
        vi.useFakeTimers({ now: frozenNow })

        try {
          const mockEarsDb = createMockEarsDb()
          const statefulLog = createStatefulCronRunLog()

          const settling = 2
          const hour = 60 * 60 * 1000
          const scanEnd = new Date(frozenNow.getTime() - settling * hour)
          const scanStart = new Date(scanEnd.getTime() - 48 * hour)

          const { generateExpectedBuckets } = await import('./dateUtils.js')
          const expected = generateExpectedBuckets('hourly', scanStart, scanEnd)

          for (const b of expected) {
            const key = statefulLog._makeKey('recoverySummary', 'hourly', b)
            statefulLog._store.set(key, {
              jobName: 'recoverySummary', period: 'hourly',
              bucket: b, status: 'success', source: 'cron',
              pipelineResults: { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }
            })
          }

          // 중간 4개 삭제 → gap
          const gapBuckets = [expected[10], expected[11], expected[20], expected[21]]
          for (const b of gapBuckets) {
            statefulLog._store.delete(statefulLog._makeKey('recoverySummary', 'hourly', b))
          }

          _setDeps({
            earsDb: mockEarsDb,
            CronRunLog: statefulLog,
            settlingHours: settling,
            autoBackfillLimit: 10,
            defaultThrottleMs: 0,
            sleep: vi.fn().mockResolvedValue(undefined)
          })

          await runBackfillCheck('hourly')

          const autoRecords = [...statefulLog._store.values()].filter(
            r => r.source === 'autoBackfill' && r.period === 'hourly'
          )
          expect(autoRecords.length).toBe(4)

          const gapsAfter = await detectGaps('hourly')
          expect(gapsAfter.length).toBe(0)
        } finally {
          vi.useRealTimers()
        }
      })
    })

    describe('B3: 자동 Backfill limit — 10개 gap 중 6개만 처리', () => {
      it('limit=6이면 10개 gap 중 6개만 처리, 재실행 시 나머지 4개', async () => {
        const frozenNow = new Date('2026-03-17T12:00:00.000Z')
        vi.useFakeTimers({ now: frozenNow })

        try {
          const mockEarsDb = createMockEarsDb()
          const statefulLog = createStatefulCronRunLog()

          const settling = 2
          const hour = 60 * 60 * 1000
          const scanEnd = new Date(frozenNow.getTime() - settling * hour)
          const scanStart = new Date(scanEnd.getTime() - 48 * hour)

          const { generateExpectedBuckets } = await import('./dateUtils.js')
          const expected = generateExpectedBuckets('hourly', scanStart, scanEnd)

          for (const b of expected) {
            const key = statefulLog._makeKey('recoverySummary', 'hourly', b)
            statefulLog._store.set(key, {
              jobName: 'recoverySummary', period: 'hourly',
              bucket: b, status: 'success', source: 'cron',
              pipelineResults: { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }
            })
          }

          const gapIndices = [5, 6, 7, 8, 15, 16, 17, 25, 26, 30]
          for (const i of gapIndices) {
            statefulLog._store.delete(statefulLog._makeKey('recoverySummary', 'hourly', expected[i]))
          }

          _setDeps({
            earsDb: mockEarsDb,
            CronRunLog: statefulLog,
            settlingHours: settling,
            autoBackfillLimit: 6,
            defaultThrottleMs: 0,
            sleep: vi.fn().mockResolvedValue(undefined)
          })

          // 첫 번째 — 6개만 처리
          await runBackfillCheck('hourly')

          const afterFirst = [...statefulLog._store.values()].filter(
            r => r.source === 'autoBackfill' && r.period === 'hourly'
          )
          expect(afterFirst.length).toBe(6)

          // 재실행 — 나머지 4개
          await runBackfillCheck('hourly')

          const afterSecond = [...statefulLog._store.values()].filter(
            r => r.source === 'autoBackfill' && r.period === 'hourly'
          )
          expect(afterSecond.length).toBe(10)

          // 세 번째 — gap 0개
          const sizeBefore = statefulLog._store.size
          await runBackfillCheck('hourly')
          expect(statefulLog._store.size).toBe(sizeBefore)
        } finally {
          vi.useRealTimers()
        }
      })
    })

    describe('B4: Throttle — sleep 호출 횟수/인자 검증', () => {
      it('auto-backfill 3건 처리 시 sleep 2회 호출, 올바른 ms', async () => {
        const mockEarsDb = createMockEarsDb()
        const statefulLog = createStatefulCronRunLog()
        const sleepFn = vi.fn().mockResolvedValue(undefined)

        _setDeps({
          earsDb: mockEarsDb,
          CronRunLog: statefulLog,
          settlingHours: 0,
          autoBackfillLimit: 3,
          defaultThrottleMs: 750,
          sleep: sleepFn
        })

        await runBackfillCheck('hourly')

        // 3 buckets → sleep 2 times between them
        expect(sleepFn).toHaveBeenCalledTimes(2)
        for (const call of sleepFn.mock.calls) {
          expect(call[0]).toBe(750)
        }
      })

      it('manual backfill throttleMs=500, 4건 처리 시 sleep 3회(500ms)', async () => {
        const mockEarsDb = createMockEarsDb()
        const statefulLog = createStatefulCronRunLog()
        const sleepFn = vi.fn().mockResolvedValue(undefined)

        _setDeps({
          earsDb: mockEarsDb,
          CronRunLog: statefulLog,
          settlingHours: 0,
          sleep: sleepFn
        })

        await runManualBackfill(
          new Date('2026-03-15T00:00:00.000Z'),
          new Date('2026-03-15T04:00:00.000Z'),
          { skipDaily: true, throttleMs: 500 }
        )
        await _getBackfillPromise()

        // 4 hourly buckets → 3 throttle calls
        expect(sleepFn).toHaveBeenCalledTimes(3)
        for (const call of sleepFn.mock.calls) {
          expect(call[0]).toBe(500)
        }
      })

      it('throttleMs=0일 때 sleep 호출 안 함', async () => {
        const mockEarsDb = createMockEarsDb()
        const statefulLog = createStatefulCronRunLog()
        const sleepFn = vi.fn().mockResolvedValue(undefined)

        _setDeps({
          earsDb: mockEarsDb,
          CronRunLog: statefulLog,
          settlingHours: 0,
          sleep: sleepFn
        })

        await runManualBackfill(
          new Date('2026-03-15T00:00:00.000Z'),
          new Date('2026-03-15T03:00:00.000Z'),
          { skipDaily: true, throttleMs: 0 }
        )
        await _getBackfillPromise()

        expect(sleepFn).not.toHaveBeenCalled()
      })
    })

    describe('B-extra: 중복 레코드 절대 발생하지 않는 end-to-end 검증', () => {
      it('cron → auto-backfill → manual-backfill 순차 실행 시 같은 bucket에 레코드 1건만', async () => {
        const mockEarsDb = createMockEarsDb()
        const statefulLog = createStatefulCronRunLog()

        _setDeps({
          earsDb: mockEarsDb,
          CronRunLog: statefulLog,
          settlingHours: 0,
          autoBackfillLimit: 0,  // auto-backfill 비활성화
          sleep: vi.fn().mockResolvedValue(undefined)
        })

        // Step 1: cron이 hourly batch 실행
        await runBatch('hourly')
        const afterCron = statefulLog._store.size
        expect(afterCron).toBe(1)

        // cron이 처리한 bucket 확인
        const cronRecord = [...statefulLog._store.values()][0]
        const cronBucket = cronRecord.bucket

        // Step 2: 같은 bucket에 대해 runPipelinesForBucket(autoBackfill) 호출
        const { computeBoundariesForBucket } = await import('./dateUtils.js')
        const boundaries = computeBoundariesForBucket('hourly', cronBucket instanceof Date ? cronBucket : new Date(cronBucket))
        await runPipelinesForBucket('hourly', boundaries.bucketStart, boundaries.dateGte, boundaries.dateLt, { source: 'autoBackfill' })

        // store 크기 변화 없음 — upsert이므로 같은 key 덮어쓰기
        expect(statefulLog._store.size).toBe(afterCron)

        // source가 autoBackfill로 변경됨 (last writer wins)
        const updatedRecord = [...statefulLog._store.values()][0]
        expect(updatedRecord.source).toBe('autoBackfill')

        // Step 3: manual backfill이 같은 bucket 처리
        await runPipelinesForBucket('hourly', boundaries.bucketStart, boundaries.dateGte, boundaries.dateLt, { source: 'manualBackfill' })

        // 여전히 1건
        expect(statefulLog._store.size).toBe(afterCron)
        const finalRecord = [...statefulLog._store.values()][0]
        expect(finalRecord.source).toBe('manualBackfill')
      })

      it('manual backfill이 cron 완료 bucket을 skip — 재처리 없음', async () => {
        const mockEarsDb = createMockEarsDb()
        const statefulLog = createStatefulCronRunLog()

        // 5개 bucket 중 3개를 cron이 미리 처리
        const hour = 60 * 60 * 1000
        const base = new Date('2026-03-15T00:00:00.000Z')
        const fullPR = { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }
        for (let i = 0; i < 3; i++) {
          const b = new Date(base.getTime() + i * hour)
          const key = statefulLog._makeKey('recoverySummary', 'hourly', b)
          statefulLog._store.set(key, {
            jobName: 'recoverySummary', period: 'hourly',
            bucket: b, status: 'success', source: 'cron',
            pipelineResults: fullPR
          })
        }

        _setDeps({
          earsDb: mockEarsDb,
          CronRunLog: statefulLog,
          settlingHours: 0,
          sleep: vi.fn().mockResolvedValue(undefined)
        })

        // manual backfill for 5 buckets (00:00~05:00)
        await runManualBackfill(base, new Date(base.getTime() + 5 * hour), { skipDaily: true, throttleMs: 0 })
        await _getBackfillPromise()

        const state = await getBackfillState()
        expect(state.skipped).toBe(3)  // 3개 skip
        expect(state.total).toBe(5)    // 총 5개

        // store에는 5건 (3 cron + 2 manual)
        const allRecords = [...statefulLog._store.values()].filter(r => r.period === 'hourly')
        expect(allRecords.length).toBe(5)

        // cron이 처리한 3개의 source는 여전히 'cron' (manual이 건드리지 않음)
        const cronRecords = allRecords.filter(r => r.source === 'cron')
        expect(cronRecords.length).toBe(3)

        // manual이 처리한 2개의 source는 'manualBackfill'
        const manualRecords = allRecords.filter(r => r.source === 'manualBackfill')
        expect(manualRecords.length).toBe(2)

        // 중복 bucket 없음
        const bucketTimes = allRecords.map(r => (r.bucket instanceof Date ? r.bucket.getTime() : new Date(r.bucket).getTime()))
        const uniqueBuckets = new Set(bucketTimes)
        expect(uniqueBuckets.size).toBe(5)
      })

      it('failed bucket은 재처리 대상 — manual backfill이 성공으로 갱신', async () => {
        const mockEarsDb = createMockEarsDb()
        const statefulLog = createStatefulCronRunLog()

        const hour = 60 * 60 * 1000
        const base = new Date('2026-03-15T00:00:00.000Z')

        // 3개 bucket: 1개 success, 1개 failed, 1개 미존재
        const b0 = base
        const b1 = new Date(base.getTime() + hour)
        const b2 = new Date(base.getTime() + 2 * hour)

        const fullPR = { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }
        statefulLog._store.set(statefulLog._makeKey('recoverySummary', 'hourly', b0), {
          jobName: 'recoverySummary', period: 'hourly',
          bucket: b0, status: 'success', source: 'cron',
          pipelineResults: fullPR
        })
        statefulLog._store.set(statefulLog._makeKey('recoverySummary', 'hourly', b1), {
          jobName: 'recoverySummary', period: 'hourly',
          bucket: b1, status: 'failed', source: 'cron'
        })
        // b2 — no record

        _setDeps({
          earsDb: mockEarsDb,
          CronRunLog: statefulLog,
          settlingHours: 0,
          sleep: vi.fn().mockResolvedValue(undefined)
        })

        // manual backfill for 3 buckets
        await runManualBackfill(base, new Date(base.getTime() + 3 * hour), { skipDaily: true, throttleMs: 0 })
        await _getBackfillPromise()

        const state = await getBackfillState()
        // b0 = success → skipped
        // b1 = failed → NOT in completed set → processed
        // b2 = missing → processed
        expect(state.skipped).toBe(1)

        // b1 should now be success (overwritten by manual backfill)
        const b1Key = statefulLog._makeKey('recoverySummary', 'hourly', b1)
        const b1Record = statefulLog._store.get(b1Key)
        expect(b1Record.status).toBe('success')
        expect(b1Record.source).toBe('manualBackfill')

        // b2 should also be success
        const b2Key = statefulLog._makeKey('recoverySummary', 'hourly', b2)
        const b2Record = statefulLog._store.get(b2Key)
        expect(b2Record.status).toBe('success')
        expect(b2Record.source).toBe('manualBackfill')

        // b0 should remain unchanged (cron source)
        const b0Key = statefulLog._makeKey('recoverySummary', 'hourly', b0)
        const b0Record = statefulLog._store.get(b0Key)
        expect(b0Record.source).toBe('cron')

        // 총 3건, 중복 없음
        const hourlyRecords = [...statefulLog._store.values()].filter(r => r.period === 'hourly')
        expect(hourlyRecords.length).toBe(3)
      })
    })
  })

  // ══════════════════════════════════════════════
  // Pipeline-aware backfill helpers (Issue 1 & 2)
  // ══════════════════════════════════════════════

  describe('getPipelineKeys', () => {
    it('returns all PIPELINE_CONFIGS keys', () => {
      expect(getPipelineKeys()).toEqual(['scenario', 'equipment', 'trigger', 'category'])
    })
  })

  describe('getMissingOrFailedPipelines', () => {
    const allKeys = ['scenario', 'equipment', 'trigger', 'category']

    it('returns all keys when pipelineResults is null', () => {
      expect(getMissingOrFailedPipelines(null, allKeys)).toEqual(allKeys)
    })

    it('returns all keys when pipelineResults is undefined', () => {
      expect(getMissingOrFailedPipelines(undefined, allKeys)).toEqual(allKeys)
    })

    it('returns only missing key when 3 are success and 1 is absent', () => {
      const pr = { scenario: 'success', equipment: 'success', trigger: 'success' }
      expect(getMissingOrFailedPipelines(pr, allKeys)).toEqual(['category'])
    })

    it('returns only failed key when 3 are success and 1 is failed', () => {
      const pr = { scenario: 'success', equipment: 'success', trigger: 'failed: timeout', category: 'success' }
      expect(getMissingOrFailedPipelines(pr, allKeys)).toEqual(['trigger'])
    })

    it('returns empty array when all keys are success', () => {
      const pr = { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }
      expect(getMissingOrFailedPipelines(pr, allKeys)).toEqual([])
    })

    it('returns both missing and failed keys', () => {
      const pr = { scenario: 'success', trigger: 'failed: error' }
      expect(getMissingOrFailedPipelines(pr, allKeys)).toEqual(['equipment', 'trigger', 'category'])
    })

    it('handles Mongoose Map objects', () => {
      const map = new Map([['scenario', 'success'], ['equipment', 'success'], ['trigger', 'success']])
      expect(getMissingOrFailedPipelines(map, allKeys)).toEqual(['category'])
    })
  })

  describe('getIncompleteBucketSet', () => {
    it('returns buckets where status is success but missing pipeline keys', async () => {
      const mockCronRunLog = createMockCronRunLog()
      const bucket1 = new Date('2026-04-10T00:00:00Z')
      const bucket2 = new Date('2026-04-10T01:00:00Z')
      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { bucket: bucket1, status: 'success', pipelineResults: { scenario: 'success', equipment: 'success', trigger: 'success' } },
            { bucket: bucket2, status: 'success', pipelineResults: { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' } }
          ])
        })
      })
      _setDeps({ CronRunLog: mockCronRunLog, earsDb: createMockEarsDb(), settlingHours: 6, sleep: vi.fn(), defaultThrottleMs: 0, autoBackfillLimit: 6, createBatchLog: vi.fn().mockResolvedValue({}) })

      const result = await getIncompleteBucketSet('hourly', new Date('2026-04-10T00:00:00Z'), new Date('2026-04-11T00:00:00Z'))

      expect(result.has(bucket1.getTime())).toBe(true)
      expect(result.has(bucket2.getTime())).toBe(false)
    })

    it('does not include buckets where all 4 keys are present', async () => {
      const mockCronRunLog = createMockCronRunLog()
      const bucket = new Date('2026-04-10T00:00:00Z')
      mockCronRunLog.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { bucket, status: 'success', pipelineResults: { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' } }
          ])
        })
      })
      _setDeps({ CronRunLog: mockCronRunLog, earsDb: createMockEarsDb(), settlingHours: 6, sleep: vi.fn(), defaultThrottleMs: 0, autoBackfillLimit: 6, createBatchLog: vi.fn().mockResolvedValue({}) })

      const result = await getIncompleteBucketSet('hourly', new Date('2026-04-10T00:00:00Z'), new Date('2026-04-11T00:00:00Z'))

      expect(result.size).toBe(0)
    })
  })

  // ── verify: getSummaryBucketSet ──

  describe('getSummaryBucketSet', () => {
    const start = new Date('2026-04-10T00:00:00Z')
    const end = new Date('2026-04-11T00:00:00Z')
    const bucketA = new Date('2026-04-10T01:00:00Z')
    const bucketB = new Date('2026-04-10T02:00:00Z')
    const bucketC = new Date('2026-04-10T03:00:00Z')

    function createDistinctMockEarsDb(distinctResults = {}) {
      const collections = {}
      return {
        collection: vi.fn((name) => {
          if (!collections[name]) {
            collections[name] = {
              ...createMockCollection(),
              distinct: vi.fn().mockResolvedValue(distinctResults[name] || [])
            }
          }
          return collections[name]
        }),
        _collections: collections
      }
    }

    it('S1: returns union of bucket timestamps from all 4 SUMMARY collections', async () => {
      const mockEarsDb = createDistinctMockEarsDb({
        'RECOVERY_SUMMARY_BY_SCENARIO': [bucketA],
        'RECOVERY_SUMMARY_BY_EQUIPMENT': [bucketB],
        'RECOVERY_SUMMARY_BY_TRIGGER': [bucketC],
        'RECOVERY_SUMMARY_BY_CATEGORY': []
      })
      _setDeps({ earsDb: mockEarsDb, CronRunLog: createMockCronRunLog() })

      const result = await getSummaryBucketSet('hourly', start, end)

      expect(result).toBeInstanceOf(Set)
      expect(result.size).toBe(3)
      expect(result.has(bucketA.getTime())).toBe(true)
      expect(result.has(bucketB.getTime())).toBe(true)
      expect(result.has(bucketC.getTime())).toBe(true)
    })

    it('S2: returns empty Set when all collections are empty', async () => {
      const mockEarsDb = createDistinctMockEarsDb({})
      _setDeps({ earsDb: mockEarsDb, CronRunLog: createMockCronRunLog() })

      const result = await getSummaryBucketSet('hourly', start, end)

      expect(result.size).toBe(0)
    })

    it('S3: deduplicates overlapping buckets across collections', async () => {
      const mockEarsDb = createDistinctMockEarsDb({
        'RECOVERY_SUMMARY_BY_SCENARIO': [bucketA, bucketB],
        'RECOVERY_SUMMARY_BY_EQUIPMENT': [bucketA, bucketB],
        'RECOVERY_SUMMARY_BY_TRIGGER': [bucketA],
        'RECOVERY_SUMMARY_BY_CATEGORY': [bucketA, bucketB]
      })
      _setDeps({ earsDb: mockEarsDb, CronRunLog: createMockCronRunLog() })

      const result = await getSummaryBucketSet('hourly', start, end)

      expect(result.size).toBe(2)
    })

    it('S4: passes correct filter { period, bucket: { $gte, $lt } } to distinct', async () => {
      const mockEarsDb = createDistinctMockEarsDb({})
      _setDeps({ earsDb: mockEarsDb, CronRunLog: createMockCronRunLog() })

      await getSummaryBucketSet('daily', start, end)

      for (const config of Object.values(PIPELINE_CONFIGS)) {
        const coll = mockEarsDb.collection(config.collection)
        expect(coll.distinct).toHaveBeenCalledWith('bucket', {
          period: 'daily',
          bucket: { $gte: start, $lt: end }
        })
      }
    })
  })

  // ── verify: getOrphanedBuckets ──

  describe('getOrphanedBuckets', () => {
    const start = new Date('2026-04-10T00:00:00Z')
    const end = new Date('2026-04-11T00:00:00Z')
    const bucketA = new Date('2026-04-10T01:00:00Z')
    const bucketB = new Date('2026-04-10T02:00:00Z')
    const bucketC = new Date('2026-04-10T03:00:00Z')

    function setupOrphanedTest({ cronLogs = [], distinctResults = {} } = {}) {
      const mockCronRunLog = createMockCronRunLog()
      mockCronRunLog.find = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(cronLogs)
        })
      })

      const collections = {}
      const mockEarsDb = {
        collection: vi.fn((name) => {
          if (!collections[name]) {
            collections[name] = {
              ...createMockCollection(),
              distinct: vi.fn().mockResolvedValue(distinctResults[name] || [])
            }
          }
          return collections[name]
        }),
        _collections: collections
      }

      _setDeps({ earsDb: mockEarsDb, CronRunLog: mockCronRunLog })
      return { mockEarsDb, mockCronRunLog }
    }

    function allSuccessPR() {
      return { scenario: 'success', equipment: 'success', trigger: 'success', category: 'success' }
    }

    it('O1: orphanedLog — CRON success + SUMMARY absent + docsMatched=100', async () => {
      setupOrphanedTest({
        cronLogs: [
          { bucket: bucketA, pipelineResults: allSuccessPR(), docsMatched: 100 }
        ],
        distinctResults: {} // SUMMARY에 데이터 없음
      })

      const result = await getOrphanedBuckets('hourly', start, end)

      expect(result.orphanedLogSet.has(bucketA.getTime())).toBe(true)
      expect(result.emptyBucketSet.size).toBe(0)
    })

    it('O2: emptyBucket — CRON success + SUMMARY absent + docsMatched=0', async () => {
      setupOrphanedTest({
        cronLogs: [
          { bucket: bucketA, pipelineResults: allSuccessPR(), docsMatched: 0 }
        ],
        distinctResults: {}
      })

      const result = await getOrphanedBuckets('hourly', start, end)

      expect(result.emptyBucketSet.has(bucketA.getTime())).toBe(true)
      expect(result.orphanedLogSet.size).toBe(0)
    })

    it('O3: verified — CRON success + SUMMARY present → neither set', async () => {
      setupOrphanedTest({
        cronLogs: [
          { bucket: bucketA, pipelineResults: allSuccessPR(), docsMatched: 50 }
        ],
        distinctResults: {
          'RECOVERY_SUMMARY_BY_SCENARIO': [bucketA]
        }
      })

      const result = await getOrphanedBuckets('hourly', start, end)

      expect(result.orphanedLogSet.size).toBe(0)
      expect(result.emptyBucketSet.size).toBe(0)
    })

    it('O4: legacy docsMatched=null → treated as orphanedLog (conservative)', async () => {
      setupOrphanedTest({
        cronLogs: [
          { bucket: bucketA, pipelineResults: allSuccessPR(), docsMatched: null }
        ],
        distinctResults: {}
      })

      const result = await getOrphanedBuckets('hourly', start, end)

      expect(result.orphanedLogSet.has(bucketA.getTime())).toBe(true)
    })

    it('O5: partial CRON status excluded from orphan detection', async () => {
      setupOrphanedTest({
        cronLogs: [
          { bucket: bucketA, pipelineResults: { scenario: 'success', equipment: 'failed: err', trigger: 'success', category: 'success' }, docsMatched: 50 }
        ],
        distinctResults: {}
      })

      const result = await getOrphanedBuckets('hourly', start, end)

      // partial이므로 completedMap에 포함 안 됨 → orphan 대상 아님
      expect(result.orphanedLogSet.size).toBe(0)
      expect(result.emptyBucketSet.size).toBe(0)
    })
  })
})
