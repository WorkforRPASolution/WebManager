/**
 * EmailRecipients service - Database operations and business logic
 */

const EmailRecipients = require('./model')
const { parsePaginationParams } = require('../../shared/utils/pagination')
const { validateBatchCreate, validateUpdate } = require('./validation')

/**
 * Parse comma-separated filter values
 */
function parseCommaSeparated(value) {
  if (!value) return null
  const values = value.split(',').map(v => v.trim()).filter(v => v)
  if (values.length === 0) return null
  if (values.length === 1) return values[0]
  return { $in: values }
}

/**
 * Build query from filter parameters
 */
function buildQuery(filters) {
  const query = {}

  if (filters.app) {
    const appFilter = parseCommaSeparated(filters.app)
    if (appFilter) query.app = appFilter
  }

  if (filters.process) {
    const processFilter = parseCommaSeparated(filters.process)
    if (processFilter) query.process = processFilter
  }

  // 키워드 검색 시 process 권한 필터링 (userProcesses가 전달된 경우)
  // process 필터가 이미 설정된 경우에는 적용하지 않음
  if (filters.userProcesses && Array.isArray(filters.userProcesses) && filters.userProcesses.length > 0 && !filters.process) {
    query.process = { $in: filters.userProcesses }
  }

  if (filters.model) {
    const modelFilter = parseCommaSeparated(filters.model)
    if (modelFilter) query.model = modelFilter
  }

  if (filters.code) {
    const codeFilter = parseCommaSeparated(filters.code)
    if (codeFilter) query.code = codeFilter
  }

  if (filters.emailCategory) {
    // Keyword search with regex
    query.emailCategory = { $regex: filters.emailCategory, $options: 'i' }
  }

  return query
}

// ============================================
// Service Methods
// ============================================

/**
 * Get distinct app list
 */
async function getApps() {
  const apps = await EmailRecipients.distinct('app')
  return apps.sort()
}

/**
 * Get distinct process list (optionally filtered by app)
 */
async function getProcesses(appFilter) {
  const query = {}
  if (appFilter) {
    const filter = parseCommaSeparated(appFilter)
    if (filter) query.app = filter
  }
  const processes = await EmailRecipients.distinct('process', query)
  return processes.sort()
}

/**
 * Get distinct model list (optionally filtered by app, process, or userProcesses)
 * @param {string} appFilter - Comma-separated app filter
 * @param {string} processFilter - Comma-separated process filter (explicit selection)
 * @param {string[]} userProcesses - User's process permissions (for filtering when no explicit selection)
 */
async function getModels(appFilter, processFilter, userProcesses) {
  const query = {}
  if (appFilter) {
    const filter = parseCommaSeparated(appFilter)
    if (filter) query.app = filter
  }
  if (processFilter) {
    const filter = parseCommaSeparated(processFilter)
    if (filter) query.process = filter
  } else if (userProcesses && userProcesses.length > 0) {
    // Process 선택 없이 조회 시 사용자 권한으로 필터링
    query.process = { $in: userProcesses }
  }
  const models = await EmailRecipients.distinct('model', query)
  return models.sort()
}

/**
 * Get distinct code list (optionally filtered by app, process, model, or userProcesses)
 * @param {string} appFilter - Comma-separated app filter
 * @param {string} processFilter - Comma-separated process filter (explicit selection)
 * @param {string} modelFilter - Comma-separated model filter
 * @param {string[]} userProcesses - User's process permissions (for filtering when no explicit selection)
 */
async function getCodes(appFilter, processFilter, modelFilter, userProcesses) {
  const query = {}
  if (appFilter) {
    const filter = parseCommaSeparated(appFilter)
    if (filter) query.app = filter
  }
  if (processFilter) {
    const filter = parseCommaSeparated(processFilter)
    if (filter) query.process = filter
  } else if (userProcesses && userProcesses.length > 0) {
    // Process 선택 없이 조회 시 사용자 권한으로 필터링
    query.process = { $in: userProcesses }
  }
  if (modelFilter) {
    const filter = parseCommaSeparated(modelFilter)
    if (filter) query.model = filter
  }
  const codes = await EmailRecipients.distinct('code', query)
  return codes.sort()
}

/**
 * Get email recipients list with pagination
 */
async function getEmailRecipientsPaginated(filters, paginationQuery) {
  const query = buildQuery(filters)
  const { page, pageSize, skip, limit } = parsePaginationParams(paginationQuery)

  const [items, total] = await Promise.all([
    EmailRecipients.find(query)
      .sort({ app: 1, line: 1, process: 1, model: 1, code: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    EmailRecipients.countDocuments(query)
  ])

  return {
    data: items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

/**
 * Create multiple email recipients records
 * @param {Array} itemsData - Array of email recipients data
 * @param {Object} context - Execution context (user, etc.)
 */
async function createEmailRecipients(itemsData, context = {}) {
  const errors = []

  // Get existing keys for uniqueness validation
  const existingItems = await EmailRecipients.find({}, 'app line process model code').lean()
  const existingKeys = existingItems.map(item =>
    `${item.app}|${item.line}|${item.process}|${item.model}|${item.code}`.toLowerCase()
  )

  // Validate format and uniqueness
  const { valid, errors: validationErrors } = validateBatchCreate(itemsData, existingKeys)

  for (const err of validationErrors) {
    errors.push({
      rowIndex: err.rowIndex,
      field: err.field,
      message: err.message
    })
  }

  // Insert valid items
  let created = 0
  if (valid.length > 0) {
    const insertedDocs = await EmailRecipients.insertMany(valid)
    created = insertedDocs.length
  }

  return { created, errors }
}

/**
 * Update multiple email recipients records
 * @param {Array} itemsData - Array of email recipients data (with _id)
 * @param {Object} context - Execution context (user, etc.)
 */
async function updateEmailRecipients(itemsData, context = {}) {
  const errors = []
  let updated = 0

  // Get all items' data for uniqueness validation
  const allItems = await EmailRecipients.find({}).lean()
  const itemsById = new Map(allItems.map(item => [item._id.toString(), item]))

  for (let i = 0; i < itemsData.length; i++) {
    const itemData = itemsData[i]
    const { _id, ...updateData } = itemData

    if (!_id) {
      errors.push({ rowIndex: i, field: '_id', message: '_id is required for update' })
      continue
    }

    // Get existing document
    const existingDoc = itemsById.get(_id)
    if (!existingDoc) {
      errors.push({ rowIndex: i, field: '_id', message: 'Document not found' })
      continue
    }

    // Get other items (excluding current one) for uniqueness validation
    const otherItems = allItems.filter(item => item._id.toString() !== _id)
    const existingKeys = otherItems.map(item =>
      `${item.app}|${item.line}|${item.process}|${item.model}|${item.code}`.toLowerCase()
    )

    // Validate format and uniqueness
    const validation = validateUpdate(updateData, existingKeys)

    if (!validation.valid) {
      for (const [field, message] of Object.entries(validation.errors)) {
        errors.push({ rowIndex: i, field, message })
      }
      continue
    }

    // Perform update
    const result = await EmailRecipients.updateOne({ _id }, { $set: updateData })
    if (result.modifiedCount > 0) {
      updated++
    }
  }

  return { updated, errors }
}

/**
 * Delete multiple email recipients records
 * @param {Array} ids - Array of _id values to delete
 * @param {Object} context - Execution context (user, etc.)
 */
async function deleteEmailRecipients(ids, context = {}) {
  const result = await EmailRecipients.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

module.exports = {
  getApps,
  getProcesses,
  getModels,
  getCodes,
  getEmailRecipientsPaginated,
  createEmailRecipients,
  updateEmailRecipients,
  deleteEmailRecipients
}
