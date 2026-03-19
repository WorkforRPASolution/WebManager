/**
 * Recovery Summary — Index Manager
 * EQP_AUTO_RECOVERY index verification and Summary collection index initialization.
 */

const { getEarsDb, getCronRunLog } = require('./recoveryDeps')

let indexReady = false

async function checkEarIndexes() {
  try {
    const earsDb = getEarsDb()
    const indexes = await earsDb.collection('EQP_AUTO_RECOVERY').indexes()
    const hasCreateDateIndex = indexes.some(idx => {
      const keys = Object.keys(idx.key || {})
      return keys.includes('create_date')
    })

    indexReady = hasCreateDateIndex
    if (!hasCreateDateIndex) {
      console.error('[RecoverySummary] CRITICAL: EQP_AUTO_RECOVERY collection is missing a create_date index. Cron and backfill are DISABLED until the index is created.')
    } else {
      console.log('[RecoverySummary] EQP_AUTO_RECOVERY create_date index verified')
    }
    return hasCreateDateIndex
  } catch (err) {
    console.error('[RecoverySummary] Failed to check EQP_AUTO_RECOVERY indexes:', err)
    indexReady = false
    return false
  }
}

function isIndexReady() {
  return indexReady
}

function _setIndexReady(val) {
  indexReady = val
}

function _resetIndexReady() {
  indexReady = false
}

async function initializeRecoverySummary() {
  try {
    const earsDb = getEarsDb()

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

    const CronRunLog = getCronRunLog()
    await CronRunLog.collection.createIndex(
      { jobName: 1, period: 1, bucket: 1 },
      { unique: true }
    )

    await CronRunLog.collection.createIndex(
      { completedAt: 1 },
      { expireAfterSeconds: 7776000 }
    )

    await checkEarIndexes()

    console.log('[RecoverySummary] Indexes initialized')
  } catch (err) {
    console.error('[RecoverySummary] Index initialization error:', err)
  }
}

module.exports = {
  checkEarIndexes,
  isIndexReady,
  initializeRecoverySummary,
  _setIndexReady,
  _resetIndexReady
}
