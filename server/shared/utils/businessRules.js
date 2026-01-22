/**
 * Business Rules Framework
 *
 * 모든 컬렉션에서 사용할 수 있는 범용 비즈니스 규칙 프레임워크.
 *
 * 기능:
 * - 필드 자동 설정 (autoSetters)
 * - 필드 간 관계 검증 (relationValidators)
 * - 생명주기 훅 (before/after create/update/delete)
 * - 감사 로그 (자동)
 *
 * 사용법:
 *   const rules = createRulesContext('EQP_INFO', { documentIdField: 'eqpId' })
 *   rules.registerRule('autoSetters', { name: 'setDate', apply: ... })
 */

const { createAuditLog, calculateChanges } = require('../models/webmanagerLogModel')

// ============================================
// Global Registry (컬렉션별 규칙 저장소)
// ============================================

const collectionRules = new Map()

/**
 * 컬렉션별 규칙 저장소 초기화
 */
function initCollectionRules(collectionName) {
  if (!collectionRules.has(collectionName)) {
    collectionRules.set(collectionName, {
      autoSetters: [],
      relationValidators: [],
      beforeCreate: [],
      afterCreate: [],
      beforeUpdate: [],
      afterUpdate: [],
      beforeDelete: [],
      afterDelete: []
    })
  }
  return collectionRules.get(collectionName)
}

// ============================================
// Rules Context Factory
// ============================================

/**
 * 컬렉션별 비즈니스 규칙 컨텍스트 생성
 *
 * @param {string} collectionName - 컬렉션 이름 (예: 'EQP_INFO', 'EMAIL_TEMPLATE')
 * @param {Object} options - 옵션
 * @param {string} options.documentIdField - 문서 ID 필드명 (기본: '_id')
 * @param {boolean} options.enableAuditLog - 감사 로그 활성화 (기본: true)
 * @returns {Object} - 규칙 컨텍스트 객체
 */
function createRulesContext(collectionName, options = {}) {
  const {
    documentIdField = '_id',
    enableAuditLog = true
  } = options

  const rules = initCollectionRules(collectionName)

  // 감사 로그 훅 등록 (최초 1회)
  if (enableAuditLog && !rules._auditLogRegistered) {
    registerAuditLogHooks(collectionName, documentIdField, rules)
    rules._auditLogRegistered = true
  }

  return {
    collectionName,
    documentIdField,

    // 규칙 등록/해제
    registerRule: (type, rule) => registerRule(rules, type, rule),
    unregisterRule: (type, name) => unregisterRule(rules, type, name),
    getRules: (type) => getRules(rules, type),
    clearRules: () => clearRules(rules, collectionName, documentIdField, enableAuditLog),

    // 규칙 실행
    applyAutoSetters: (data, context) => applyAutoSetters(rules, data, context),
    applyAutoSettersBatch: (dataArray, context) => applyAutoSettersBatch(rules, dataArray, context),
    validateRelations: (data, context) => validateRelations(rules, data, context),
    validateRelationsBatch: (dataArray, context) => validateRelationsBatch(rules, dataArray, context),
    executeHooks: (hookType, data, context) => executeHooks(rules, hookType, data, context)
  }
}

// ============================================
// Rule Registration
// ============================================

/**
 * 규칙 등록
 */
function registerRule(rules, type, rule) {
  if (!rules[type]) {
    throw new Error(`Unknown rule type: ${type}`)
  }

  const ruleWithDefaults = {
    priority: 100,
    enabled: true,
    ...rule
  }

  const existingIndex = rules[type].findIndex(r => r.name === rule.name)
  if (existingIndex >= 0) {
    rules[type][existingIndex] = ruleWithDefaults
  } else {
    rules[type].push(ruleWithDefaults)
  }

  rules[type].sort((a, b) => a.priority - b.priority)
}

/**
 * 규칙 해제
 */
function unregisterRule(rules, type, name) {
  if (!rules[type]) return
  rules[type] = rules[type].filter(r => r.name !== name)
}

/**
 * 규칙 조회
 */
function getRules(rules, type) {
  return rules[type] || []
}

/**
 * 규칙 초기화
 */
function clearRules(rules, collectionName, documentIdField, enableAuditLog) {
  for (const type of Object.keys(rules)) {
    if (type.startsWith('_')) continue
    rules[type] = []
  }
  rules._auditLogRegistered = false
  if (enableAuditLog) {
    registerAuditLogHooks(collectionName, documentIdField, rules)
    rules._auditLogRegistered = true
  }
}

// ============================================
// Rule Execution
// ============================================

/**
 * 자동 설정 적용 (단일)
 */
function applyAutoSetters(rules, data, context = {}) {
  let result = { ...data }

  for (const rule of rules.autoSetters) {
    if (!rule.enabled) continue
    try {
      result = rule.apply(result, context)
    } catch (error) {
      console.error(`Auto-setter '${rule.name}' failed:`, error.message)
    }
  }

  return result
}

/**
 * 자동 설정 적용 (배치)
 */
function applyAutoSettersBatch(rules, dataArray, context = {}) {
  return dataArray.map(data => applyAutoSetters(rules, data, context))
}

/**
 * 관계 검증 (단일)
 */
function validateRelations(rules, data, context = {}) {
  const errors = []

  for (const rule of rules.relationValidators) {
    if (!rule.enabled) continue
    try {
      const error = rule.validate(data, context)
      if (error) {
        errors.push({
          rule: rule.name,
          ...error
        })
      }
    } catch (err) {
      console.error(`Relation validator '${rule.name}' failed:`, err.message)
    }
  }

  return errors
}

/**
 * 관계 검증 (배치)
 */
function validateRelationsBatch(rules, dataArray, context = {}) {
  const results = []

  for (let i = 0; i < dataArray.length; i++) {
    const errors = validateRelations(rules, dataArray[i], context)
    if (errors.length > 0) {
      results.push({ index: i, errors })
    }
  }

  return results
}

/**
 * 훅 실행
 */
async function executeHooks(rules, hookType, data, context = {}) {
  if (!rules[hookType]) return

  for (const rule of rules[hookType]) {
    if (!rule.enabled) continue
    try {
      await rule.execute(data, context)
    } catch (error) {
      console.error(`Hook '${rule.name}' (${hookType}) failed:`, error.message)
      if (rule.critical) throw error
    }
  }
}

// ============================================
// Default Audit Log Hooks
// ============================================

/**
 * 감사 로그 훅 등록
 */
function registerAuditLogHooks(collectionName, documentIdField, rules) {
  // After Create
  registerRule(rules, 'afterCreate', {
    name: '_auditLogCreate',
    priority: 1000,
    execute: async (data, context) => {
      const items = Array.isArray(data) ? data : [data]

      for (const item of items) {
        const docId = item[documentIdField] || item._id?.toString()
        if (!docId) continue

        await createAuditLog({
          collectionName,
          documentId: docId,
          action: 'create',
          newData: item,
          userId: context.user?.singleid || context.user?.id || 'system'
        })
      }
    }
  })

  // After Update
  registerRule(rules, 'afterUpdate', {
    name: '_auditLogUpdate',
    priority: 1000,
    execute: async (data, context) => {
      const { previousData, newData } = context

      if (!previousData || !newData) return

      const items = Array.isArray(newData) ? newData : [newData]
      const prevItems = Array.isArray(previousData) ? previousData : [previousData]

      for (let i = 0; i < items.length; i++) {
        const prev = prevItems[i]
        const curr = items[i]

        if (!prev || !curr) continue

        const changes = calculateChanges(prev, curr)

        if (Object.keys(changes).length > 0) {
          const docId = curr[documentIdField] || curr._id?.toString()

          await createAuditLog({
            collectionName,
            documentId: docId,
            action: 'update',
            changes,
            previousData: prev,
            newData: curr,
            userId: context.user?.singleid || context.user?.id || 'system'
          })
        }
      }
    }
  })

  // After Delete
  registerRule(rules, 'afterDelete', {
    name: '_auditLogDelete',
    priority: 1000,
    execute: async (data, context) => {
      const { deletedData } = context

      if (!deletedData) return

      const items = Array.isArray(deletedData) ? deletedData : [deletedData]

      for (const item of items) {
        if (!item) continue

        const docId = item[documentIdField] || item._id?.toString()

        await createAuditLog({
          collectionName,
          documentId: docId,
          action: 'delete',
          previousData: item,
          userId: context.user?.singleid || context.user?.id || 'system'
        })
      }
    }
  })
}

// ============================================
// Exports
// ============================================

module.exports = {
  createRulesContext,
  // 유틸리티 (테스트/디버깅용)
  _collectionRules: collectionRules,
  _clearAllCollections: () => collectionRules.clear()
}
