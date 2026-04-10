/**
 * AGENT_INFO Sync Service
 * EQP_INFO CRUD 시 AGENT_INFO의 eqpId/IpAddr을 자동 동기화
 * agent 플래그(arsagent 등)는 Akka 서버가 관리하므로 $setOnInsert로만 기본값 설정
 */

const AgentInfo = require('./agentInfoModel')
const { createLogger } = require('../../shared/logger')
const { toLong } = require('../../shared/utils/mongoLong')

// ── Dependency Injection (for testing) ──

let deps = {}
function _setDeps(overrides) { deps = { ...overrides } }
function getModel() { return deps.Model || AgentInfo }
function getLog() { return deps.log || createLogger('clients') }

// ── Default agent flags ──

const AGENT_DEFAULTS = {
  arsagent: toLong(0),
  resourceagent: toLong(1),
  aimmagent: toLong(0),
  arsagentJava: toLong(1)
}

// ── Sync result helper ──

function makeResult(synced = 0, failed = 0, errors = []) {
  return { synced, failed, errors }
}

// ── Sync on Create ──

async function syncOnCreate(createdDocs) {
  const log = getLog()
  if (!createdDocs || createdDocs.length === 0) return makeResult()

  const Model = getModel()
  const ops = createdDocs.map(doc => ({
    updateOne: {
      filter: { eqpId: doc.eqpId },
      update: {
        $set: { IpAddr: doc.ipAddr },
        $setOnInsert: { ...AGENT_DEFAULTS }
      },
      upsert: true
    }
  }))

  try {
    await Model.bulkWrite(ops, { ordered: false })
    log.info(`[AGENT_INFO sync] Created/upserted ${ops.length} docs`)
    return makeResult(ops.length)
  } catch (err) {
    log.error(`[AGENT_INFO sync] Create failed: ${err.message}`)
    return makeResult(0, ops.length, [err.message])
  }
}

// ── Sync on Update ──

async function syncOnUpdate(prevDocs, newDocs) {
  const log = getLog()
  if (!prevDocs || prevDocs.length === 0) return makeResult()

  const Model = getModel()
  const opsToUpsert = []
  const eqpIdsToDelete = []

  for (let i = 0; i < prevDocs.length; i++) {
    const prev = prevDocs[i]
    const curr = newDocs[i]
    if (!prev || !curr) continue

    const eqpIdChanged = prev.eqpId !== curr.eqpId
    const ipAddrChanged = prev.ipAddr !== curr.ipAddr

    if (!eqpIdChanged && !ipAddrChanged) continue

    if (eqpIdChanged) {
      eqpIdsToDelete.push(prev.eqpId)
      // eqpId 변경 시 새 eqpId로 upsert (기존 있으면 IP만 갱신, 없으면 기본값으로 생성)
      opsToUpsert.push({
        updateOne: {
          filter: { eqpId: curr.eqpId },
          update: {
            $set: { IpAddr: curr.ipAddr },
            $setOnInsert: { ...AGENT_DEFAULTS }
          },
          upsert: true
        }
      })
    } else {
      // ipAddr만 변경
      opsToUpsert.push({
        updateOne: {
          filter: { eqpId: curr.eqpId },
          update: { $set: { IpAddr: curr.ipAddr } },
          upsert: true
        }
      })
    }
  }

  if (opsToUpsert.length === 0 && eqpIdsToDelete.length === 0) {
    return makeResult()
  }

  try {
    // 기존 eqpId 삭제 (eqpId 변경된 경우)
    if (eqpIdsToDelete.length > 0) {
      await Model.deleteMany({ eqpId: { $in: eqpIdsToDelete } })
    }

    // upsert 실행
    if (opsToUpsert.length > 0) {
      await Model.bulkWrite(opsToUpsert, { ordered: false })
    }

    log.info(`[AGENT_INFO sync] Updated ${opsToUpsert.length} docs (deleted ${eqpIdsToDelete.length} old eqpIds)`)
    return makeResult(opsToUpsert.length)
  } catch (err) {
    log.error(`[AGENT_INFO sync] Update failed: ${err.message}`)
    return makeResult(0, opsToUpsert.length, [err.message])
  }
}

// ── Sync on Delete ──

async function syncOnDelete(deletedDocs) {
  const log = getLog()
  if (!deletedDocs || deletedDocs.length === 0) return makeResult()

  const Model = getModel()
  const eqpIds = deletedDocs.map(d => d.eqpId).filter(Boolean)
  if (eqpIds.length === 0) return makeResult()

  try {
    const result = await Model.deleteMany({ eqpId: { $in: eqpIds } })
    log.info(`[AGENT_INFO sync] Deleted ${result.deletedCount} docs`)
    return makeResult(result.deletedCount)
  } catch (err) {
    log.error(`[AGENT_INFO sync] Delete failed: ${err.message}`)
    return makeResult(0, eqpIds.length, [err.message])
  }
}

module.exports = {
  syncOnCreate,
  syncOnUpdate,
  syncOnDelete,
  _setDeps
}
