/**
 * Recovery Summary — Dependency Injection Container
 */

const { earsConnection } = require('../../shared/db/connection')
const { getRedisClient, isRedisAvailable } = require('../../shared/db/redisConnection')
const { getPodId } = require('../../shared/utils/podIdentity')
const CronRunLogModel = require('./cronRunLogModel')
const { createBatchLog } = require('../../shared/models/webmanagerLogModel')

const SETTLING_HOURS = parseInt(process.env.RECOVERY_SETTLING_HOURS || '3', 10)
const AUTO_BACKFILL_LIMIT = parseInt(process.env.RECOVERY_AUTO_BACKFILL_LIMIT || '6', 10)
const DEFAULT_THROTTLE_MS = parseInt(process.env.RECOVERY_BACKFILL_THROTTLE_MS || '1000', 10)

let deps = {
  earsDb: null,
  CronRunLog: CronRunLogModel,
  createBatchLog,
  settlingHours: SETTLING_HOURS,
  autoBackfillLimit: AUTO_BACKFILL_LIMIT,
  defaultThrottleMs: DEFAULT_THROTTLE_MS,
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  getRedisClient,
  isRedisAvailable,
  getPodId
}

function _setDeps(overrides) {
  deps = { ...deps, ...overrides }
}

function getDeps() { return deps }
function getEarsDb() { return deps.earsDb || earsConnection.db }
function getCronRunLog() { return deps.CronRunLog }
function getRedis() { return deps.getRedisClient ? deps.getRedisClient() : null }
function isRedisUp() { return deps.isRedisAvailable ? deps.isRedisAvailable() : false }
function getPod() { return deps.getPodId ? deps.getPodId() : 'unknown' }

module.exports = { _setDeps, getDeps, getEarsDb, getCronRunLog, getRedis, isRedisUp, getPod }
