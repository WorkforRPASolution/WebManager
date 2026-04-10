/**
 * Recovery Category Service
 * CRUD for RECOVERY_CATEGORY_MAP (scCategory → categoryName).
 * Also queries SC_PROPERTY for distinct scCategory values.
 */

const RecoveryCategoryMap = require('./recoveryCategoryModel')
const { earsConnection } = require('../../shared/db/connection')
const { createActionLog } = require('../../shared/models/webmanagerLogModel')
const { createLogger } = require('../../shared/logger')
const { toLong } = require('../../shared/utils/mongoLong')
const log = createLogger('recovery')

// ── Dependency Injection (for testing) ──

let deps = {}
function _setDeps(overrides) { deps = { ...deps, ...overrides } }
function getEarsDb() { return deps.earsDb || earsConnection.db }
function getModel() { return deps.Model || RecoveryCategoryMap }

// ── Initialization ──

async function initializeRecoveryCategoryMap() {
  try {
    await RecoveryCategoryMap.collection.createIndex(
      { scCategory: 1 },
      { unique: true }
    )
    log.info('[RecoveryCategoryMap] Index initialized')
  } catch (err) {
    log.error(`[RecoveryCategoryMap] Index initialization error: ${err.message}`)
  }
}

// ── CRUD ──

async function getAll() {
  const Model = getModel()
  return await Model.find({}).sort({ scCategory: 1 }).lean()
}

async function upsertCategories(items, userId = 'system') {
  const Model = getModel()
  const results = []

  for (const item of items) {
    const { scCategory: rawCat, categoryName, description } = item
    const scCategory = toLong(Number(rawCat))
    const prev = await Model.findOne({ scCategory }).lean()

    const doc = await Model.findOneAndUpdate(
      { scCategory },
      { $set: { scCategory, categoryName, description: description || '', updatedBy: userId, updatedAt: new Date() } },
      { upsert: true, returnDocument: 'after', lean: true }
    )
    results.push(doc)

    const action = prev ? 'update' : 'create'
    createActionLog({
      action,
      collectionName: 'RECOVERY_CATEGORY_MAP',
      targetType: 'categoryMap',
      targetId: String(scCategory),
      details: prev
        ? { from: { categoryName: prev.categoryName }, to: { categoryName } }
        : { categoryName },
      userId
    }).catch(() => {})
  }

  return results
}

async function deleteCategories(scCategories, userId = 'system') {
  const Model = getModel()
  const longCats = scCategories.map(c => toLong(Number(c)))

  const docs = await Model.find({ scCategory: { $in: longCats } }).lean()
  if (docs.length === 0) return { deletedCount: 0 }

  const result = await Model.deleteMany({ scCategory: { $in: longCats } })

  for (const doc of docs) {
    createActionLog({
      action: 'delete',
      collectionName: 'RECOVERY_CATEGORY_MAP',
      targetType: 'categoryMap',
      targetId: String(doc.scCategory),
      details: { categoryName: doc.categoryName },
      userId
    }).catch(() => {})
  }

  return { deletedCount: result.deletedCount }
}

// ── SC_PROPERTY Queries ──

async function getDistinctScCategories() {
  const db = getEarsDb()
  const coll = db.collection('SC_PROPERTY')
  return await coll.distinct('scCategory', { scCategory: { $exists: true, $ne: null } })
}

module.exports = {
  initializeRecoveryCategoryMap,
  getAll,
  upsertCategories,
  deleteCategories,
  getDistinctScCategories,
  _setDeps
}
