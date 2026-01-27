/**
 * EmailInfo service - Database operations and business logic
 */

const EmailInfo = require('./model')
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

  if (filters.project) {
    const projectFilter = parseCommaSeparated(filters.project)
    if (projectFilter) query.project = projectFilter
  }

  if (filters.category) {
    // Category search with regex
    query.category = { $regex: filters.category, $options: 'i' }
  }

  return query
}

// ============================================
// Service Methods
// ============================================

/**
 * Get distinct project list
 */
async function getProjects() {
  const projects = await EmailInfo.distinct('project')
  return projects.sort()
}

/**
 * Get distinct category list (optionally filtered by project)
 */
async function getCategories(projectFilter) {
  const query = {}
  if (projectFilter) {
    const filter = parseCommaSeparated(projectFilter)
    if (filter) query.project = filter
  }
  const categories = await EmailInfo.distinct('category', query)
  return categories.sort()
}

/**
 * Get email info list with pagination
 */
async function getEmailInfoPaginated(filters, paginationQuery) {
  const query = buildQuery(filters)
  const { page, pageSize, skip, limit } = parsePaginationParams(paginationQuery)

  const [items, total] = await Promise.all([
    EmailInfo.find(query).sort({ project: 1, category: 1 }).skip(skip).limit(limit).lean(),
    EmailInfo.countDocuments(query)
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
 * Create multiple email info records
 * @param {Array} itemsData - Array of email info data
 * @param {Object} context - Execution context (user, etc.)
 */
async function createEmailInfo(itemsData, context = {}) {
  const errors = []

  // Get existing keys for uniqueness validation
  const existingItems = await EmailInfo.find({}, 'project category').lean()
  const existingKeys = existingItems.map(item => `${item.project}|${item.category}`.toLowerCase())

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
    const insertedDocs = await EmailInfo.insertMany(valid)
    created = insertedDocs.length
  }

  return { created, errors }
}

/**
 * Update multiple email info records
 * @param {Array} itemsData - Array of email info data (with _id)
 * @param {Object} context - Execution context (user, etc.)
 */
async function updateEmailInfo(itemsData, context = {}) {
  const errors = []
  let updated = 0

  // Get all items' data for uniqueness validation
  const allItems = await EmailInfo.find({}).lean()
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
    const existingKeys = otherItems.map(item => `${item.project}|${item.category}`.toLowerCase())

    // Validate format and uniqueness
    const validation = validateUpdate(updateData, existingKeys)

    if (!validation.valid) {
      for (const [field, message] of Object.entries(validation.errors)) {
        errors.push({ rowIndex: i, field, message })
      }
      continue
    }

    // Perform update
    const result = await EmailInfo.updateOne({ _id }, { $set: updateData })
    if (result.modifiedCount > 0) {
      updated++
    }
  }

  return { updated, errors }
}

/**
 * Delete multiple email info records
 * @param {Array} ids - Array of _id values to delete
 * @param {Object} context - Execution context (user, etc.)
 */
async function deleteEmailInfo(ids, context = {}) {
  const result = await EmailInfo.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

module.exports = {
  getProjects,
  getCategories,
  getEmailInfoPaginated,
  createEmailInfo,
  updateEmailInfo,
  deleteEmailInfo
}
