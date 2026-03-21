/**
 * CRUD Service Factory
 *
 * 모든 CRUD 서비스가 이 팩토리를 통해 생성됨.
 * - audit 로깅 자동 처리 (fire-and-forget)
 * - 민감 필드 자동 redact
 * - 대용량 문서 skipFullDataInAudit 지원
 * - autoSetters, validators, hooks 확장 포인트
 *
 * 사용법:
 *   const crud = createCrudService(Model, 'COLLECTION_NAME', {
 *     documentIdField: 'eqpId',
 *     sensitiveFields: ['password'],
 *     skipFullDataInAudit: false,
 *     autoSetters: [{ name, priority, apply }],
 *     validators: [{ name, priority, validate }],
 *     hooks: { beforeCreate: fn, afterCreate: fn, ... }
 *   })
 *
 *   // 반환: { create, update, remove, rules }
 */

const logModel = require('../models/webmanagerLogModel')
const { createRulesContext } = require('./businessRules')
const { createLogger } = require('../logger')
const log = createLogger('audit')

/**
 * CRUD 서비스 팩토리
 *
 * @param {Object} Model - Mongoose 모델
 * @param {string} collectionName - 컬렉션 이름
 * @param {Object} options - 옵션
 * @param {Object} options._deps - 테스트용 의존성 주입 (internal)
 * @returns {{ create, update, remove, rules }}
 */
function createCrudService(Model, collectionName, options = {}) {
  const {
    documentIdField = '_id',
    sensitiveFields = [],
    skipFullDataInAudit = false,
    autoSetters = [],
    validators = [],
    hooks = {},
    _deps = {}
  } = options

  // 의존성 (테스트 시 주입 가능)
  const _createAuditLog = _deps.createAuditLog || logModel.createAuditLog
  const _calculateChanges = _deps.calculateChanges || logModel.calculateChanges
  const _redactSensitiveFields = _deps.redactSensitiveFields || logModel.redactSensitiveFields

  // 기존 businessRules의 audit hooks를 비활성화 (우리가 직접 처리)
  const rules = createRulesContext(collectionName, {
    documentIdField,
    enableAuditLog: false
  })

  // 커스텀 autoSetters 등록
  for (const setter of autoSetters) {
    rules.registerRule('autoSetters', setter)
  }

  // 커스텀 validators 등록
  for (const validator of validators) {
    rules.registerRule('relationValidators', validator)
  }

  // 커스텀 hooks 등록
  for (const [hookType, hookConfig] of Object.entries(hooks)) {
    if (typeof hookConfig === 'function') {
      rules.registerRule(hookType, {
        name: `_custom_${hookType}`,
        priority: 500,
        execute: hookConfig
      })
    } else if (hookConfig && typeof hookConfig === 'object') {
      rules.registerRule(hookType, hookConfig)
    }
  }

  // ============================================
  // Audit 헬퍼
  // ============================================

  function getUserId(context) {
    return context.user?.singleid || context.user?.id || 'system'
  }

  function getDocId(item) {
    if (documentIdField === '_id') {
      return item._id?.toString?.() || item._id
    }
    return item[documentIdField] || item._id?.toString?.() || 'unknown'
  }

  function prepareAuditData(data) {
    if (!data) return null
    if (skipFullDataInAudit) return undefined
    return _redactSensitiveFields(data, sensitiveFields)
  }

  async function logAudit(action, item, context, extra = {}) {
    try {
      await _createAuditLog({
        collectionName,
        documentId: String(getDocId(item)),
        action,
        changes: extra.changes || {},
        previousData: prepareAuditData(extra.previousData) ?? null,
        newData: prepareAuditData(extra.newData) ?? null,
        userId: getUserId(context)
      })
    } catch (err) {
      log.error(`Audit log failed for ${action} ${collectionName}: ${err.message}`)
    }
  }

  // ============================================
  // CRUD Operations
  // ============================================

  /**
   * Create multiple documents
   * @param {Array} items - Documents to create
   * @param {Object} context - { user } execution context
   * @returns {{ created: number, errors: Array }}
   */
  async function create(items, context = {}) {
    const errors = []

    // 1. Apply auto-setters
    const processed = rules.applyAutoSettersBatch(items, { ...context, isUpdate: false })

    // 2. Validate relations
    const relationErrors = rules.validateRelationsBatch(processed, context)
    const errorIndices = new Set()
    for (const { index, errors: relErrors } of relationErrors) {
      errorIndices.add(index)
      for (const error of relErrors) {
        errors.push({ rowIndex: index, field: error.field, message: error.message })
      }
    }

    const validItems = processed.filter((_, i) => !errorIndices.has(i))

    // 3. beforeCreate hooks
    await rules.executeHooks('beforeCreate', validItems, context)

    // 4. Insert
    let created = 0
    let insertedDocs = []
    if (validItems.length > 0) {
      insertedDocs = await Model.insertMany(validItems)
      created = insertedDocs.length
    }

    // 5. afterCreate hooks
    const plainDocs = insertedDocs.map(d => (typeof d.toObject === 'function' ? d.toObject() : d))
    if (plainDocs.length > 0) {
      await rules.executeHooks('afterCreate', plainDocs, context)
    }

    // 6. Audit logging (fire-and-forget)
    for (const doc of plainDocs) {
      logAudit('create', doc, context, { newData: doc })
    }

    return { created, errors }
  }

  /**
   * Update multiple documents
   * @param {Array} items - Documents with _id + update fields
   * @param {Object} context - { user } execution context
   * @returns {{ updated: number, errors: Array }}
   */
  async function update(items, context = {}) {
    const errors = []
    let updated = 0

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const { _id, ...updateData } = item

      if (!_id) {
        errors.push({ rowIndex: i, field: '_id', message: '_id is required for update' })
        continue
      }

      // Get existing document
      const existingDoc = await Model.findById(_id).lean()
      if (!existingDoc) {
        errors.push({ rowIndex: i, field: '_id', message: 'Document not found' })
        continue
      }

      // 1. Apply auto-setters
      const processed = rules.applyAutoSetters(updateData, { ...context, isUpdate: true })

      // 2. Validate relations
      const relationErrors = rules.validateRelations({ ...existingDoc, ...processed }, context)
      if (relationErrors.length > 0) {
        for (const error of relationErrors) {
          errors.push({ rowIndex: i, field: error.field, message: error.message })
        }
        continue
      }

      // 3. beforeUpdate hook
      await rules.executeHooks('beforeUpdate', processed, {
        ...context,
        previousData: existingDoc
      })

      // 4. Perform update
      const result = await Model.updateOne({ _id }, { $set: processed })
      if (result.modifiedCount > 0) {
        updated++

        // Get updated document
        const updatedDoc = await Model.findById(_id).lean()
        if (updatedDoc) {
          // 5. afterUpdate hook
          await rules.executeHooks('afterUpdate', updatedDoc, {
            ...context,
            previousData: [existingDoc],
            newData: [updatedDoc]
          })

          // 6. Audit logging (fire-and-forget)
          const changes = _calculateChanges(existingDoc, updatedDoc, { sensitiveFields })
          if (Object.keys(changes).length > 0) {
            logAudit('update', updatedDoc, context, {
              changes,
              previousData: existingDoc,
              newData: updatedDoc
            })
          }
        }
      }
    }

    return { updated, errors }
  }

  /**
   * Remove multiple documents by _id
   * @param {Array} ids - Array of _id values
   * @param {Object} context - { user } execution context
   * @returns {{ deleted: number }}
   */
  async function remove(ids, context = {}) {
    // 1. Get documents before deletion
    const documentsToDelete = await Model.find({ _id: { $in: ids } }).lean()

    // 2. beforeDelete hooks
    await rules.executeHooks('beforeDelete', documentsToDelete, {
      ...context,
      deletedData: documentsToDelete
    })

    // 3. Perform deletion
    const result = await Model.deleteMany({ _id: { $in: ids } })

    // 4. afterDelete hooks
    if (result.deletedCount > 0) {
      await rules.executeHooks('afterDelete', null, {
        ...context,
        deletedData: documentsToDelete
      })
    }

    // 5. Audit logging (fire-and-forget)
    for (const doc of documentsToDelete) {
      logAudit('delete', doc, context, { previousData: doc })
    }

    return { deleted: result.deletedCount }
  }

  return { create, update, remove, rules }
}

module.exports = { createCrudService }
