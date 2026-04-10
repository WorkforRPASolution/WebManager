/**
 * Recovery Summary Batch Service — Facade
 *
 * Re-exports all public API from focused modules:
 * - recoveryDeps.js: dependency injection
 * - batchRunner.js: pipeline building, batch execution, gap detection
 * - backfillManager.js: manual backfill state management
 * - cronScheduler.js: cron job scheduling, distribution queries
 * - indexManager.js: index verification and initialization
 */

const { _setDeps, getDeps } = require('./recoveryDeps')
const { validateBackfillRange } = require('./validation')

const {
  PIPELINE_CONFIGS,
  buildPipeline,
  buildCategoryPipeline,
  runPipelinesForBucket,
  runBatch,
  detectGaps,
  runBackfillCheck,
  _resetIsRunning
} = require('./batchRunner')

const {
  getCompletedBucketSet,
  getPartialBucketSet,
  runManualBackfill,
  getBackfillState,
  cancelBackfill,
  _getBackfillPromise,
  _resetBackfill
} = require('./backfillManager')

const {
  startCronJobs,
  stopCronJobs,
  getCronRunDistribution,
  getLastCronRun
} = require('./cronScheduler')

const {
  checkEarIndexes,
  isIndexReady,
  initializeRecoverySummary,
  _setIndexReady,
  _resetIndexReady
} = require('./indexManager')

function _resetState() {
  _resetBackfill()
  _resetIsRunning()
  _resetIndexReady()
}

function _getSettlingHours() {
  return getDeps().settlingHours
}

module.exports = {
  PIPELINE_CONFIGS,
  buildPipeline,
  buildCategoryPipeline,
  runPipelinesForBucket,
  runBatch,
  detectGaps,
  runBackfillCheck,
  runManualBackfill,
  getBackfillState,
  cancelBackfill,
  getCompletedBucketSet,
  getPartialBucketSet,
  validateBackfillRange,
  checkEarIndexes,
  isIndexReady,
  initializeRecoverySummary,
  startCronJobs,
  stopCronJobs,
  getCronRunDistribution,
  getLastCronRun,
  _setDeps,
  _getBackfillPromise,
  _resetState,
  _setIndexReady,
  _getSettlingHours
}
