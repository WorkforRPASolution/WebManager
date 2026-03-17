/**
 * Recovery Summary Batch Service
 *
 * Aggregates EQP_AUTO_RECOVERY documents into summary collections
 * on hourly and daily schedules using MongoDB aggregation pipelines.
 */

const cron = require('node-cron')
const { earsConnection } = require('../../shared/db/connection')
const CronRunLogModel = require('./cronRunLogModel')
const { computeHourlyBoundaries, computeDailyBoundaries } = require('./dateUtils')

// ── Pipeline Configuration ──

const PIPELINE_CONFIGS = {
  scenario: { collection: 'RECOVERY_SUMMARY_BY_SCENARIO', groupField: 'ears_code' },
  equipment: { collection: 'RECOVERY_SUMMARY_BY_EQUIPMENT', groupField: 'eqpid' },
  trigger: { collection: 'RECOVERY_SUMMARY_BY_TRIGGER', groupField: 'trigger_by' }
}

// ── Dependency Injection (for testing) ──

let deps = {
  earsDb: null,
  CronRunLog: CronRunLogModel
}

function _setDeps(overrides) {
  deps = { ...deps, ...overrides }
}

function getEarsDb() {
  return deps.earsDb || earsConnection.db
}

function getCronRunLog() {
  return deps.CronRunLog
}

// ── Pipeline Builder ──

/**
 * Build MongoDB aggregation pipeline for a given config key.
 */
function buildPipeline(configKey, period, bucketStart, dateGte, dateLt) {
  const config = PIPELINE_CONFIGS[configKey]
  if (!config) throw new Error(`Unknown pipeline config: ${configKey}`)

  const { collection: targetCollection, groupField } = config

  // Stage 1: $match — filter by create_date range and valid status
  const matchStage = {
    $match: {
      create_date: { $gte: dateGte, $lt: dateLt },
      status: { $ne: null }
    }
  }

  // Stage 2: First $group — by (line, process, model, groupField, status) with count
  const firstGroupId = {
    line: '$line',
    process: '$process',
    model: '$model',
    [groupField]: `$${groupField}`,
    status: '$status'
  }
  const firstGroupStage = {
    $group: {
      _id: firstGroupId,
      count: { $sum: 1 }
    }
  }

  // Stage 3: Second $group — by (line, process, model, groupField) with total and status_pairs
  const secondGroupId = {
    line: '$_id.line',
    process: '$_id.process',
    model: '$_id.model',
    [groupField]: `$_id.${groupField}`
  }
  const secondGroupStage = {
    $group: {
      _id: secondGroupId,
      total: { $sum: '$count' },
      status_pairs: { $push: { k: '$_id.status', v: '$count' } }
    }
  }

  // Stage 4: $addFields — set dimension fields, period, bucket, status_counts
  const addFieldsStage = {
    $addFields: {
      period,
      bucket: bucketStart,
      line: '$_id.line',
      process: '$_id.process',
      model: '$_id.model',
      [groupField]: `$_id.${groupField}`,
      status_counts: { $arrayToObject: '$status_pairs' },
      updated_at: '$$NOW'
    }
  }

  // Stage 5: $unset — remove helper fields
  const unsetStage = {
    $unset: ['_id', 'status_pairs']
  }

  // Stage 6: $merge — upsert into target collection
  const mergeOn = ['period', 'bucket', 'line', 'process', 'model', groupField]
  const mergeStage = {
    $merge: {
      into: targetCollection,
      on: mergeOn,
      whenMatched: 'replace',
      whenNotMatched: 'insert'
    }
  }

  return [matchStage, firstGroupStage, secondGroupStage, addFieldsStage, unsetStage, mergeStage]
}

// ── Batch Execution ──

let isRunning = false

/**
 * Run the aggregation batch for a given period ('hourly' or 'daily').
 */
async function runBatch(period) {
  if (isRunning) {
    console.log(`[RecoverySummary] Skipping ${period} batch — previous run still in progress`)
    return
  }

  isRunning = true
  const startedAt = new Date()
  const pipelineResults = {}
  const docsInBucket = {}
  const errors = []

  try {
    const earsDb = getEarsDb()

    // Compute time boundaries
    const boundaries = period === 'hourly'
      ? computeHourlyBoundaries(startedAt)
      : computeDailyBoundaries(startedAt)

    const { bucketStart, dateGte, dateLt } = boundaries

    console.log(`[RecoverySummary] Starting ${period} batch: ${dateGte} ~ ${dateLt}`)

    // Run 3 pipelines sequentially
    for (const [configKey, config] of Object.entries(PIPELINE_CONFIGS)) {
      try {
        const pipeline = buildPipeline(configKey, period, bucketStart, dateGte, dateLt)
        await earsDb.collection('EQP_AUTO_RECOVERY')
          .aggregate(pipeline, { allowDiskUse: true })
          .toArray()

        // Count docs in the target summary collection for this bucket
        const count = await earsDb.collection(config.collection)
          .countDocuments({ period, bucket: bucketStart })

        pipelineResults[configKey] = 'success'
        docsInBucket[configKey] = count
        console.log(`[RecoverySummary]   ${configKey}: success (${count} docs)`)
      } catch (err) {
        pipelineResults[configKey] = `failed: ${err.message}`
        docsInBucket[configKey] = 0
        errors.push({ configKey, error: err.message })
        console.error(`[RecoverySummary]   ${configKey}: failed — ${err.message}`)
      }
    }

    // Determine overall status
    const successCount = Object.values(pipelineResults).filter(r => r === 'success').length
    let status
    if (successCount === 3) status = 'success'
    else if (successCount === 0) status = 'failed'
    else status = 'partial'

    // Log to CRON_RUN_LOG
    const CronRunLog = getCronRunLog()
    const logEntry = new CronRunLog({
      jobName: 'recoverySummary',
      period,
      bucket: bucketStart,
      status,
      startedAt,
      completedAt: new Date(),
      pipelineResults,
      docsInBucket,
      errorMessage: errors.length > 0 ? errors : undefined
    })
    await logEntry.save()

    console.log(`[RecoverySummary] ${period} batch completed: ${status}`)
  } catch (err) {
    console.error(`[RecoverySummary] ${period} batch fatal error:`, err.message)
  } finally {
    isRunning = false
  }
}

// ── Index Initialization ──

/**
 * Create unique indexes on the 3 Summary collections (EARS DB)
 * and CRON_RUN_LOG indexes.
 */
async function initializeRecoverySummary() {
  try {
    const earsDb = getEarsDb()

    // Summary collection indexes
    await earsDb.collection('RECOVERY_SUMMARY_BY_SCENARIO').createIndex(
      { period: 1, bucket: 1, line: 1, process: 1, model: 1, ears_code: 1 },
      { unique: true }
    )

    await earsDb.collection('RECOVERY_SUMMARY_BY_EQUIPMENT').createIndex(
      { period: 1, bucket: 1, line: 1, process: 1, model: 1, eqpid: 1 },
      { unique: true }
    )

    await earsDb.collection('RECOVERY_SUMMARY_BY_TRIGGER').createIndex(
      { period: 1, bucket: 1, line: 1, process: 1, model: 1, trigger_by: 1 },
      { unique: true }
    )

    // CRON_RUN_LOG indexes
    const CronRunLog = getCronRunLog()
    await CronRunLog.collection.createIndex(
      { jobName: 1, period: 1, bucket: 1 },
      { unique: true }
    )

    console.log('[RecoverySummary] Indexes initialized')
  } catch (err) {
    console.error('[RecoverySummary] Index initialization error:', err.message)
  }
}

// ── Cron Jobs ──

let cronTasks = []

/**
 * Start cron jobs for hourly and daily aggregation.
 */
function startCronJobs() {
  // Hourly at :05
  const hourlyTask = cron.schedule('5 * * * *', () => {
    runBatch('hourly').catch(err => console.error('[RecoverySummary] Hourly cron error:', err))
  }, { timezone: 'Asia/Seoul' })

  // Daily at 00:10
  const dailyTask = cron.schedule('10 0 * * *', () => {
    runBatch('daily').catch(err => console.error('[RecoverySummary] Daily cron error:', err))
  }, { timezone: 'Asia/Seoul' })

  cronTasks = [hourlyTask, dailyTask]
  console.log('[RecoverySummary] Cron jobs started (hourly :05, daily 00:10 KST)')
}

/**
 * Stop all scheduled cron tasks.
 */
function stopCronJobs() {
  for (const task of cronTasks) {
    task.stop()
  }
  cronTasks = []
  console.log('[RecoverySummary] Cron jobs stopped')
}

// ── Query Helpers ──

/**
 * Get the last successful (or partial) cron run for a given period.
 */
async function getLastCronRun(period) {
  const CronRunLog = getCronRunLog()
  return CronRunLog.findOne({
    jobName: 'recoverySummary',
    period,
    status: { $in: ['success', 'partial'] }
  })
    .sort({ bucket: -1 })
    .lean()
}

module.exports = {
  PIPELINE_CONFIGS,
  buildPipeline,
  runBatch,
  initializeRecoverySummary,
  startCronJobs,
  stopCronJobs,
  getLastCronRun,
  _setDeps
}
