/**
 * WebManager Log Model - Unified logging system
 *
 * 모든 로그를 통합 관리하는 모델:
 * - audit: 데이터 변경 이력
 * - error: 서버 에러/예외
 * - auth: 인증/권한 관련
 */

const mongoose = require('mongoose')

const webmanagerLogSchema = new mongoose.Schema({
  // 공통 필드
  category: {
    type: String,
    required: true,
    enum: ['audit', 'error', 'auth'],
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
    enum: ['create', 'update', 'delete'],
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

  // auth 전용 필드
  authAction: {
    type: String,
    enum: ['login', 'logout', 'login_failed', 'signup', 'password_reset_request', 'password_changed', 'permission_denied'],
    index: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
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

const WebManagerLog = mongoose.model('WebManagerLog', webmanagerLogSchema)

// ============================================
// Audit Log Functions (기존 기능 유지)
// ============================================

/**
 * Create an audit log entry
 * @param {Object} params - Log parameters
 */
async function createAuditLog({
  collectionName,
  documentId,
  action,
  changes = {},
  previousData = null,
  newData = null,
  userId = 'system'
}) {
  const log = new WebManagerLog({
    category: 'audit',
    collectionName,
    documentId,
    action,
    changes,
    previousData,
    newData,
    userId,
    timestamp: new Date()
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
 */
function calculateChanges(oldData, newData) {
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
      changes[key] = {
        from: oldVal,
        to: newVal
      }
    }
  }

  return changes
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
  const log = new WebManagerLog({
    category: 'error',
    errorType,
    errorMessage,
    errorStack,
    requestInfo,
    userId,
    timestamp: new Date()
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
  userAgent = null
}) {
  const log = new WebManagerLog({
    category: 'auth',
    authAction,
    userId,
    ipAddress,
    userAgent,
    timestamp: new Date()
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

module.exports = {
  WebManagerLog,
  // Audit functions (기존)
  createAuditLog,
  getAuditLogs,
  getRecentAuditLogs,
  calculateChanges,
  // Error functions (신규)
  createErrorLog,
  getRecentErrorLogs,
  // Auth functions (신규)
  createAuthLog,
  getRecentAuthLogs,
  // 통합 조회
  getAllLogs
}
