/**
 * EQP_INFO Redis Sync Module
 *
 * MongoDB EQP_INFO CRUD 후 Redis DB 10에 동기화한다.
 * InterfaceServer와 동일한 Redis 키 구조를 유지한다.
 *
 * 3-Layer 구조:
 * - Layer 1: Serialization (순수 함수, I/O 없음)
 * - Layer 2: Single-doc Redis Operations
 * - Layer 3: Batch Orchestration + 에러 핸들링
 */

const { getEqpRedisClient, isEqpRedisAvailable } = require('../../shared/db/redisConnection')
const { createEqpRedisSyncLog } = require('../../shared/models/webmanagerLogModel')
const { createRulesContext } = require('../../shared/utils/businessRules')
const { createLogger } = require('../../shared/logger')

const log = createLogger('eqp-redis')

// ============================================
// DI (테스트용)
// ============================================

let deps = {}
function _setDeps(d) { deps = d }
function getClient() { return deps.redisClient !== undefined ? deps.redisClient : getEqpRedisClient() }
function isAvailable() { return deps.isEqpRedisAvailable !== undefined ? deps.isEqpRedisAvailable() : isEqpRedisAvailable() }
function getSyncLogger() { return deps.createEqpRedisSyncLog || createEqpRedisSyncLog }

// ============================================
// Layer 1: Serialization (순수 함수)
// ============================================

function normalizeIpAddrL(ipAddrL) {
  if (!ipAddrL || !ipAddrL.trim()) return '_'
  return ipAddrL.trim()
}

function buildHashField(doc) {
  return `${doc.ipAddr}:${normalizeIpAddrL(doc.ipAddrL)}`
}

function buildHashValue(doc, index) {
  return `${doc.process}:${doc.eqpModel}:${doc.eqpId}:${doc.line}:${doc.lineDesc}:${index}`
}

function parseIndex(hashValue) {
  if (!hashValue) return NaN
  const match = hashValue.match(/:(\d+)$/)
  return match ? parseInt(match[1], 10) : NaN
}

function buildModifyMessage(doc) {
  return `${doc.ipAddr}:${doc.ipAddrL || ''}:${doc.eqpId}`
}

function buildDeleteMessage(doc) {
  return doc.eqpId
}

// ============================================
// Layer 2: Single-doc Redis Operations
// ============================================

async function syncOneCreate(redis, doc) {
  const field = buildHashField(doc)
  const index = await redis.incr('EQP_INFO_lastnum')
  const value = buildHashValue(doc, index)
  await redis.hset('EQP_INFO', field, value)
  await redis.hset('EQP_INFO_LINE', doc.eqpId, doc.line)
  await redis.publish('EQP_INFO_MODIFY', buildModifyMessage(doc))
}

async function syncOneUpdate(redis, prevDoc, newDoc) {
  const oldField = buildHashField(prevDoc)
  const newField = buildHashField(newDoc)
  const fieldChanged = oldField !== newField

  if (fieldChanged) {
    await redis.hdel('EQP_INFO', oldField)
  }

  const existing = await redis.hget('EQP_INFO', newField)
  let index = parseIndex(existing)
  if (isNaN(index)) {
    index = await redis.incr('EQP_INFO_lastnum')
  }

  await redis.hset('EQP_INFO', newField, buildHashValue(newDoc, index))

  if (prevDoc.eqpId !== newDoc.eqpId) {
    await redis.hdel('EQP_INFO_LINE', prevDoc.eqpId)
  }
  await redis.hset('EQP_INFO_LINE', newDoc.eqpId, newDoc.line)

  await redis.publish('EQP_INFO_MODIFY', buildModifyMessage(newDoc))
}

async function syncOneDelete(redis, doc) {
  const field = buildHashField(doc)
  await redis.hdel('EQP_INFO', field)
  await redis.hdel('EQP_INFO_LINE', doc.eqpId)
  await redis.publish('EQP_INFO_DELETE', buildDeleteMessage(doc))
}

// ============================================
// withRetry (1회 즉시 재시도)
// ============================================

async function withRetry(fn, label) {
  try {
    return await fn()
  } catch (err1) {
    log.warn(`${label}: first attempt failed (${err1.message}), retrying...`)
    try {
      return await fn()
    } catch (err2) {
      log.error(`${label}: retry also failed (${err2.message})`)
      throw err2
    }
  }
}

// ============================================
// Layer 3: Batch Orchestration
// ============================================

async function logSyncFailure(operation, eqpId, error, context) {
  const userId = context?.user?.singleid || context?.user?.id || 'system'
  await getSyncLogger()({ operation, eqpId, error, userId })
}

async function syncAfterCreate(docs, context) {
  if (!isAvailable()) {
    context.syncStatus = {
      synced: 0, failed: docs.length,
      failedEqpIds: docs.map(d => d.eqpId),
      redisUnavailable: true
    }
    log.warn(`EQP Redis unavailable — ${docs.length} create(s) not synced`)
    return
  }
  const redis = getClient()
  let synced = 0, failed = 0
  const failedEqpIds = []
  for (const doc of docs) {
    try {
      await withRetry(() => syncOneCreate(redis, doc), `syncCreate ${doc.eqpId}`)
      synced++
    } catch (err) {
      failed++
      failedEqpIds.push(doc.eqpId)
      await logSyncFailure('create', doc.eqpId, err.message, context).catch(() => {})
    }
  }
  context.syncStatus = { synced, failed, failedEqpIds }
}

async function syncAfterUpdate(data, context) {
  const { previousData = [], newData = [] } = context
  if (!isAvailable()) {
    context.syncStatus = {
      synced: 0, failed: newData.length,
      failedEqpIds: newData.map(d => d.eqpId),
      redisUnavailable: true
    }
    log.warn(`EQP Redis unavailable — ${newData.length} update(s) not synced`)
    return
  }
  const redis = getClient()
  let synced = 0, failed = 0
  const failedEqpIds = []
  for (let i = 0; i < newData.length; i++) {
    const prevDoc = previousData[i]
    const newDoc = newData[i]
    if (!prevDoc || !newDoc) continue
    try {
      await withRetry(() => syncOneUpdate(redis, prevDoc, newDoc), `syncUpdate ${newDoc.eqpId}`)
      synced++
    } catch (err) {
      failed++
      failedEqpIds.push(newDoc.eqpId)
      await logSyncFailure('update', newDoc.eqpId, err.message, context).catch(() => {})
    }
  }
  context.syncStatus = { synced, failed, failedEqpIds }
}

async function syncAfterDelete(_, context) {
  const { deletedData = [] } = context
  if (!isAvailable()) {
    context.syncStatus = {
      synced: 0, failed: deletedData.length,
      failedEqpIds: deletedData.map(d => d.eqpId),
      redisUnavailable: true
    }
    log.warn(`EQP Redis unavailable — ${deletedData.length} delete(s) not synced`)
    return
  }
  const redis = getClient()
  let synced = 0, failed = 0
  const failedEqpIds = []
  for (const doc of deletedData) {
    try {
      await withRetry(() => syncOneDelete(redis, doc), `syncDelete ${doc.eqpId}`)
      synced++
    } catch (err) {
      failed++
      failedEqpIds.push(doc.eqpId)
      await logSyncFailure('delete', doc.eqpId, err.message, context).catch(() => {})
    }
  }
  context.syncStatus = { synced, failed, failedEqpIds }
}

// ============================================
// Hook Registration
// ============================================

function registerHooks(rulesCtx) {
  rulesCtx.registerRule('afterCreate', {
    name: '_eqpRedisSync', priority: 500,
    execute: async (data, context) => {
      const docs = Array.isArray(data) ? data : [data]
      await syncAfterCreate(docs, context)
    }
  })
  rulesCtx.registerRule('afterUpdate', {
    name: '_eqpRedisSync', priority: 500,
    execute: async (data, context) => {
      await syncAfterUpdate(data, context)
    }
  })
  rulesCtx.registerRule('afterDelete', {
    name: '_eqpRedisSync', priority: 500,
    execute: async (data, context) => {
      await syncAfterDelete(data, context)
    }
  })
}

function registerEqpRedisHooks() {
  const rules = createRulesContext('EQP_INFO', { enableAuditLog: false })
  registerHooks(rules)
}

// ============================================
// Exports
// ============================================

module.exports = {
  // Layer 1 (테스트 + 재사용)
  normalizeIpAddrL, buildHashField, buildHashValue, parseIndex,
  buildModifyMessage, buildDeleteMessage,
  // Layer 2 (테스트용)
  syncOneCreate, syncOneUpdate, syncOneDelete,
  // Layer 3 (테스트용)
  syncAfterCreate, syncAfterUpdate, syncAfterDelete,
  // Hook 등록
  registerHooks, registerEqpRedisHooks,
  // DI + Utils
  _setDeps, withRetry,
}
