/**
 * WebManager Log Model - Unified logging system
 *
 * 모든 로그를 통합 관리하는 모델:
 * - audit: 데이터 변경 이력
 * - error: 서버 에러/예외
 * - auth: 인증/권한 관련
 * - batch: Cron/Backfill 배치 실행 이력
 * - access: 페이지 접근 이력
 * - eqp-redis: EQP_INFO Redis 동기화 실패 기록
 */

const mongoose = require('mongoose')
const { webManagerConnection } = require('../db/connection')
const { createLogger } = require('../logger')

// ============================================
// 민감 필드 & 보존 정책
// ============================================

const GLOBAL_SENSITIVE_FIELDS = ['password', 'currentPassword', 'newPassword', 'token', 'refreshToken']

const RETENTION_DAYS = {
  audit: parseInt(process.env.AUDIT_RETENTION_DAYS, 10) || 730,
  auth: parseInt(process.env.AUTH_RETENTION_DAYS, 10) || 365,
  error: parseInt(process.env.ERROR_RETENTION_DAYS, 10) || 90,
  batch: parseInt(process.env.BATCH_RETENTION_DAYS, 10) || 365,
  access: parseInt(process.env.ACCESS_RETENTION_DAYS, 10) || 90,
  'eqp-redis': parseInt(process.env.EQP_REDIS_RETENTION_DAYS, 10) || 365
}

function getExpireAt(category) {
  const days = RETENTION_DAYS[category]
  if (!days) return undefined
  const expireAt = new Date()
  expireAt.setDate(expireAt.getDate() + days)
  return expireAt
}

const webmanagerLogSchema = new mongoose.Schema({
  // 공통 필드
  category: {
    type: String,
    required: true,
    enum: ['audit', 'error', 'auth', 'batch', 'access', 'eqp-redis'],
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  userId: {
    type: String,
    default: 'system',
    index: true
  },

  // audit 전용 필드
  collectionName: {
    type: String,
    index: true
  },
  documentId: {
    type: String,
    index: true
  },
  action: {
    type: String,
    enum: ['create', 'update', 'delete', 'upload', 'save', 'deploy', 'start', 'stop', 'restart', 'kill', 'approve', 'download', 'backup', 'restore'],
    index: true
  },
  changes: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  previousData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // error 전용 필드
  errorType: {
    type: String,
    index: true
  },
  errorMessage: {
    type: String
  },
  errorStack: {
    type: String
  },
  requestInfo: {
    method: String,
    url: String,
    body: mongoose.Schema.Types.Mixed
  },

  // batch 전용 필드
  batchAction: {
    type: String,
    enum: ['cron_completed', 'cron_skipped', 'cron_failed', 'backfill_started', 'backfill_completed', 'backfill_cancelled', 'auto_backfill_completed'],
    index: true
  },
  batchPeriod: {
    type: String,
    enum: ['hourly', 'daily']
  },
  batchParams: {
    type: mongoose.Schema.Types.Mixed
  },
  batchResult: {
    type: mongoose.Schema.Types.Mixed
  },

  // auth 전용 필드
  authAction: {
    type: String,
    enum: ['login', 'logout', 'login_failed', 'signup', 'password_reset_request', 'password_changed', 'password_reset_verified', 'permission_denied'],
    index: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },

  // audit action log 전용 필드 (CRUD가 아닌 액션)
  targetType: {
    type: String
  },
  targetId: {
    type: String
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },

  // eqp-redis 전용 필드
  syncOperation: { type: String, enum: ['create', 'update', 'delete'] },
  syncEqpId: { type: String, index: true },
  syncError: { type: String },

  // access 전용 필드
  pagePath: {
    type: String,
    index: true
  },
  pageName: {
    type: String
  },
  enterTime: {
    type: Date
  },
  leaveTime: {
    type: Date
  },
  durationMs: {
    type: Number
  },

  // TTL 지원
  expireAt: {
    type: Date
  }
}, {
  collection: 'WEBMANAGER_LOG',
  timestamps: false
})

// Compound indexes for common queries
webmanagerLogSchema.index({ category: 1, timestamp: -1 })
webmanagerLogSchema.index({ category: 1, userId: 1, timestamp: -1 })

// audit 관련 인덱스
webmanagerLogSchema.index({ collectionName: 1, documentId: 1 })
webmanagerLogSchema.index({ collectionName: 1, timestamp: -1 })

// error 관련 인덱스
webmanagerLogSchema.index({ category: 1, errorType: 1, timestamp: -1 })

// auth 관련 인덱스
webmanagerLogSchema.index({ category: 1, authAction: 1, timestamp: -1 })

// batch 관련 인덱스
webmanagerLogSchema.index({ category: 1, batchAction: 1, timestamp: -1 })

// access 관련 인덱스
webmanagerLogSchema.index({ category: 1, pagePath: 1, timestamp: -1 })

// TTL 인덱스 (expireAt 기반 자동 삭제)
webmanagerLogSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 })

const WebManagerLog = webManagerConnection.model('WebManagerLog', webmanagerLogSchema)

// ============================================
// Audit Log Functions (기존 기능 유지)
// ============================================

/**
 * Create an audit log entry
 * @param {Object} params - Log parameters
 */
const auditLog = createLogger('audit')
const errorLog = createLogger('error')
const authLog = createLogger('auth')
const batchLog = createLogger('batch')

async function createAuditLog({
  collectionName,
  documentId,
  action,
  changes = {},
  previousData = null,
  newData = null,
  userId = 'system'
}) {
  auditLog.info(`${action} ${collectionName} ${documentId} by ${userId}`)

  const log = new WebManagerLog({
    category: 'audit',
    collectionName,
    documentId,
    action,
    changes,
    previousData,
    newData,
    userId,
    timestamp: new Date(),
    expireAt: getExpireAt('audit')
  })

  return await log.save()
}

/**
 * Create an action log entry (non-CRUD operations like start/stop/deploy)
 * @param {Object} params - Action log parameters
 */
async function createActionLog({
  action,
  collectionName = null,
  targetType,
  targetId,
  details = null,
  userId = 'system'
}) {
  auditLog.info(`${action} ${targetType} ${targetId} by ${userId}`)

  const log = new WebManagerLog({
    category: 'audit',
    action,
    collectionName,
    targetType,
    targetId,
    details,
    userId,
    timestamp: new Date(),
    expireAt: getExpireAt('audit')
  })

  return await log.save()
}

/**
 * Get audit logs for a document
 */
async function getAuditLogs(collectionName, documentId, options = {}) {
  const query = { category: 'audit', collectionName, documentId }
  const { limit = 50, skip = 0 } = options

  return await WebManagerLog.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean()
}

/**
 * Get recent audit logs for a collection
 */
async function getRecentAuditLogs(collectionName, options = {}) {
  const query = { category: 'audit', collectionName }
  const { limit = 100, skip = 0, action, userId, startDate, endDate } = options

  if (action) query.action = action
  if (userId) query.userId = userId
  if (startDate || endDate) {
    query.timestamp = {}
    if (startDate) query.timestamp.$gte = new Date(startDate)
    if (endDate) query.timestamp.$lte = new Date(endDate)
  }

  return await WebManagerLog.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean()
}

/**
 * Calculate changes between two objects
 * @param {Object} oldData - Previous document
 * @param {Object} newData - New document
 * @param {Object} options - Options
 * @param {string[]} options.sensitiveFields - Additional sensitive fields to redact
 */
function calculateChanges(oldData, newData, options = {}) {
  const { sensitiveFields = [] } = options
  const allSensitive = [...GLOBAL_SENSITIVE_FIELDS, ...sensitiveFields]
  const changes = {}

  const allKeys = new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {})
  ])

  for (const key of allKeys) {
    if (key === '_id' || key === '__v') continue

    const oldVal = oldData?.[key]
    const newVal = newData?.[key]

    const oldStr = JSON.stringify(oldVal)
    const newStr = JSON.stringify(newVal)

    if (oldStr !== newStr) {
      if (allSensitive.includes(key)) {
        changes[key] = { from: '[REDACTED]', to: '[REDACTED]' }
      } else {
        changes[key] = { from: oldVal, to: newVal }
      }
    }
  }

  return changes
}

/**
 * Redact sensitive fields from a data object
 * @param {Object} data - Data to redact
 * @param {string[]} extraSensitiveFields - Additional sensitive fields
 * @returns {Object|null} - Redacted copy (or null if input is null)
 */
function redactSensitiveFields(data, extraSensitiveFields = []) {
  if (!data) return data
  const allSensitive = [...GLOBAL_SENSITIVE_FIELDS, ...extraSensitiveFields]
  const result = { ...data }
  for (const field of allSensitive) {
    if (field in result) {
      result[field] = '[REDACTED]'
    }
  }
  return result
}

// ============================================
// Error Log Functions (신규)
// ============================================

/**
 * Create an error log entry
 * @param {Object} params - Error log parameters
 */
async function createErrorLog({
  errorType,
  errorMessage,
  errorStack = null,
  requestInfo = null,
  userId = 'system'
}) {
  errorLog.error(`[${errorType}] ${errorMessage}`)

  const log = new WebManagerLog({
    category: 'error',
    errorType,
    errorMessage,
    errorStack,
    requestInfo,
    userId,
    timestamp: new Date(),
    expireAt: getExpireAt('error')
  })

  return await log.save()
}

/**
 * Get recent error logs
 */
async function getRecentErrorLogs(options = {}) {
  const query = { category: 'error' }
  const { limit = 100, skip = 0, errorType, startDate, endDate } = options

  if (errorType) query.errorType = errorType
  if (startDate || endDate) {
    query.timestamp = {}
    if (startDate) query.timestamp.$gte = new Date(startDate)
    if (endDate) query.timestamp.$lte = new Date(endDate)
  }

  return await WebManagerLog.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean()
}

// ============================================
// Auth Log Functions (신규)
// ============================================

/**
 * Create an auth log entry
 * @param {Object} params - Auth log parameters
 */
async function createAuthLog({
  authAction,
  userId = 'system',
  ipAddress = null,
  userAgent = null,
  details = null
}) {
  authLog.info(`${authAction} user=${userId} ip=${ipAddress || '-'}`)

  const log = new WebManagerLog({
    category: 'auth',
    authAction,
    userId,
    ipAddress,
    userAgent,
    ...(details && { details }),
    timestamp: new Date(),
    expireAt: getExpireAt('auth')
  })

  return await log.save()
}

/**
 * Get recent auth logs
 */
async function getRecentAuthLogs(options = {}) {
  const query = { category: 'auth' }
  const { limit = 100, skip = 0, authAction, userId, startDate, endDate } = options

  if (authAction) query.authAction = authAction
  if (userId) query.userId = userId
  if (startDate || endDate) {
    query.timestamp = {}
    if (startDate) query.timestamp.$gte = new Date(startDate)
    if (endDate) query.timestamp.$lte = new Date(endDate)
  }

  return await WebManagerLog.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean()
}

// ============================================
// Batch Log Functions (Cron/Backfill 실행 이력)
// ============================================

/**
 * Create a batch log entry
 * @param {Object} params - Batch log parameters
 */
async function createBatchLog({
  batchAction,
  batchPeriod = null,
  batchParams = null,
  batchResult = null,
  userId = 'system'
}) {
  batchLog.info(`${batchAction} period=${batchPeriod || '-'}`)

  const log = new WebManagerLog({
    category: 'batch',
    batchAction,
    batchPeriod,
    batchParams,
    batchResult,
    userId,
    timestamp: new Date(),
    expireAt: getExpireAt('batch')
  })

  return await log.save()
}

/**
 * Get recent batch logs
 */
async function getRecentBatchLogs(options = {}) {
  const query = { category: 'batch' }
  const { limit = 100, skip = 0, batchAction, batchPeriod, userId, startDate, endDate } = options

  if (batchAction) query.batchAction = batchAction
  if (batchPeriod) query.batchPeriod = batchPeriod
  if (userId) query.userId = userId
  if (startDate || endDate) {
    query.timestamp = {}
    if (startDate) query.timestamp.$gte = new Date(startDate)
    if (endDate) query.timestamp.$lte = new Date(endDate)
  }

  return await WebManagerLog.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean()
}

// ============================================
// 통합 조회 Functions
// ============================================

/**
 * Get all logs with optional filtering
 */
async function getAllLogs(options = {}) {
  const query = {}
  const { limit = 100, skip = 0, category, userId, startDate, endDate } = options

  if (category) query.category = category
  if (userId) query.userId = userId
  if (startDate || endDate) {
    query.timestamp = {}
    if (startDate) query.timestamp.$gte = new Date(startDate)
    if (endDate) query.timestamp.$lte = new Date(endDate)
  }

  return await WebManagerLog.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean()
}

/**
 * Fire-and-forget audit helper factory
 * 반복되는 auditLog 래퍼 패턴을 제거하기 위한 유틸
 *
 * @param {string} collectionName - 컬렉션 이름
 * @param {Object} options
 * @param {string[]} options.sensitiveFields - 민감 필드 목록
 * @param {Object} options.log - winston 로거 (fallback 기록용)
 * @returns {Function} auditLog(action, docId, context, extra)
 */
function makeAuditHelper(collectionName, options = {}) {
  const { sensitiveFields: sf = [], log: logger = auditLog } = options

  return function logAudit(action, docId, context, extra = {}) {
    const userId = context?.user?.singleid || context?.user?.id || 'system'
    const prevData = extra.previousData ? redactSensitiveFields(extra.previousData, sf) : null
    const newDataVal = extra.newData ? redactSensitiveFields(extra.newData, sf) : null
    createAuditLog({
      collectionName,
      documentId: String(docId),
      action,
      changes: extra.changes || {},
      previousData: prevData,
      newData: newDataVal,
      userId
    }).catch(err => logger.error(`Audit log failed for ${action} ${collectionName}: ${err.message}`))
  }
}

// ============================================
// EQP Redis Sync Log Functions
// ============================================

const eqpRedisLog = createLogger('eqp-redis')

async function createEqpRedisSyncLog({ operation, eqpId, error, userId = 'system' }) {
  eqpRedisLog.warn(`sync failed: ${operation} ${eqpId} — ${error}`)
  return await new WebManagerLog({
    category: 'eqp-redis',
    syncOperation: operation,
    syncEqpId: eqpId,
    syncError: error,
    userId,
    timestamp: new Date(),
    expireAt: getExpireAt('eqp-redis')
  }).save()
}

module.exports = {
  WebManagerLog,
  // Audit functions
  createAuditLog,
  createActionLog,
  makeAuditHelper,
  getAuditLogs,
  getRecentAuditLogs,
  calculateChanges,
  redactSensitiveFields,
  GLOBAL_SENSITIVE_FIELDS,
  // Error functions
  createErrorLog,
  getRecentErrorLogs,
  // Auth functions
  createAuthLog,
  getRecentAuthLogs,
  // Batch functions
  createBatchLog,
  getRecentBatchLogs,
  // 통합 조회
  getAllLogs,
  // TTL 유틸
  getExpireAt,
  // EQP Redis Sync
  createEqpRedisSyncLog
}
