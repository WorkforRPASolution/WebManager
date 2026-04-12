/**
 * Recovery Summary — Cron Scheduler
 */

const cron = require('node-cron')
const { createLogger } = require('../../shared/logger')
const log = createLogger('recovery')
const {
  generateExpectedBuckets,
  floorToKSTBucket,
  computeGroupKey,
  computeCronDistributionRange
} = require('./dateUtils')
const { getDeps, getCronRunLog } = require('./recoveryDeps')
const { runBatch, getPipelineKeys, getMissingOrFailedPipelines } = require('./batchRunner')

let cronTasks = []

function startCronJobs() {
  const deps = getDeps()
  const settlingHours = deps.settlingHours

  const hourlyTask = cron.schedule('5 * * * *', () => {
    runBatch('hourly').catch(err => log.error(`[RecoverySummary] Hourly cron error: ${err.message}`))
  }, { timezone: 'Asia/Seoul' })

  const dailyCron = `10 ${settlingHours} * * *`
  const dailyTask = cron.schedule(dailyCron, () => {
    runBatch('daily').catch(err => log.error(`[RecoverySummary] Daily cron error: ${err.message}`))
  }, { timezone: 'Asia/Seoul' })

  cronTasks = [hourlyTask, dailyTask]
  log.info(`[RecoverySummary] Cron jobs started (hourly :05, daily ${String(settlingHours).padStart(2, '0')}:10 KST)`)
}

function stopCronJobs() {
  for (const task of cronTasks) {
    task.stop()
  }
  cronTasks = []
  log.info('[RecoverySummary] Cron jobs stopped')
}

const PERIOD_GRANULARITY = { today: 'hourly', '7d': 'daily', '30d': 'daily', '90d': 'weekly' }

async function getCronRunDistribution(period, _nowOrOptions) {
  const deps = getDeps()
  const CronRunLog = getCronRunLog()

  let startDate, endDate, granularity, now

  if (_nowOrOptions && !(_nowOrOptions instanceof Date) && _nowOrOptions.startDate) {
    // Custom date range from shifted period navigation
    granularity = PERIOD_GRANULARITY[period] || 'daily'
    startDate = floorToKSTBucket('daily', new Date(_nowOrOptions.startDate + 'T00:00:00+09:00'))
    now = new Date(_nowOrOptions.endDate + 'T00:00:00+09:00')
    endDate = now
  } else {
    now = _nowOrOptions || new Date()
    ;({ startDate, endDate, granularity } = computeCronDistributionRange(period, now))
  }

  const settledEnd = new Date(now.getTime() - deps.settlingHours * 60 * 60 * 1000)
  const hourlyEnd = floorToKSTBucket('hourly', settledEnd)
  const dailyEnd = floorToKSTBucket('daily', settledEnd)

  const expectedHourly = generateExpectedBuckets('hourly', startDate, hourlyEnd)
  const expectedDaily = generateExpectedBuckets('daily', startDate, dailyEnd)

  const logs = await CronRunLog.find({
    jobName: 'recoverySummary',
    bucket: { $gte: startDate, $lt: endDate },
    status: { $in: ['success', 'partial', 'failed'] }
  }).select('bucket period status pipelineResults').lean()

  const existingSet = new Set(logs.map(l => `${l.period}:${l.bucket.getTime()}`))
  const requiredKeys = getPipelineKeys()

  const groups = new Map()
  function ensureGroup(key) {
    if (!groups.has(key)) {
      groups.set(key, { bucket: new Date(key), success: 0, partial: 0, failed: 0, incomplete: 0, pending: 0, total: 0 })
    }
    return groups.get(key)
  }

  for (const log of logs) {
    const key = computeGroupKey(log.bucket.getTime(), granularity)
    const entry = ensureGroup(key)

    let effectiveStatus = log.status
    if (log.status === 'success') {
      const missing = getMissingOrFailedPipelines(log.pipelineResults, requiredKeys)
      if (missing.length > 0) effectiveStatus = 'incomplete'
    }

    entry[effectiveStatus] = (entry[effectiveStatus] || 0) + 1
    entry.total += 1
  }

  for (const bucket of expectedHourly) {
    if (!existingSet.has(`hourly:${bucket.getTime()}`)) {
      const key = computeGroupKey(bucket.getTime(), granularity)
      const entry = ensureGroup(key)
      entry.pending++
      entry.total++
    }
  }
  for (const bucket of expectedDaily) {
    if (!existingSet.has(`daily:${bucket.getTime()}`)) {
      const key = computeGroupKey(bucket.getTime(), granularity)
      const entry = ensureGroup(key)
      entry.pending++
      entry.total++
    }
  }

  const data = Array.from(groups.values()).sort((a, b) => a.bucket.getTime() - b.bucket.getTime())

  return { granularity, data }
}

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
  startCronJobs,
  stopCronJobs,
  getCronRunDistribution,
  getLastCronRun
}
