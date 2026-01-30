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
 * Parse category to extract process (2nd) and model (3rd) parts
 * Category format: "EMAIL-{process}-{model}-{type}" (e.g., "EMAIL-PHOTO-EVT9-ALERT")
 * @param {string} category - The category string
 * @returns {Object} - { process, model } or nulls if not enough parts
 */
function parseCategoryParts(category) {
  if (!category) return { process: null, model: null }
  const parts = category.split('-')
  return {
    process: parts[1] || null,  // 2nd part (index 1)
    model: parts[2] || null     // 3rd part (index 2)
  }
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

  // Process filter: match category where 2nd part matches
  if (filters.process) {
    const processes = filters.process.split(',').map(p => p.trim()).filter(p => p)
    if (processes.length > 0) {
      // Build regex pattern to match process in 2nd position: ^[^-]+-{process}-
      const processPatterns = processes.map(p => `^[^-]+-${p}-`)
      if (processPatterns.length === 1) {
        query.category = { ...query.category, $regex: processPatterns[0], $options: 'i' }
      } else {
        // Multiple processes: use $or
        query.$and = query.$and || []
        query.$and.push({
          $or: processPatterns.map(pattern => ({ category: { $regex: pattern, $options: 'i' } }))
        })
      }
    }
  }

  // Model filter: match category where 3rd part matches
  if (filters.model) {
    const models = filters.model.split(',').map(m => m.trim()).filter(m => m)
    if (models.length > 0) {
      // Build regex pattern to match model in 3rd position: ^[^-]+-[^-]+-{model}-
      const modelPatterns = models.map(m => `^[^-]+-[^-]+-${m}-`)
      query.$and = query.$and || []
      if (modelPatterns.length === 1) {
        query.$and.push({ category: { $regex: modelPatterns[0], $options: 'i' } })
      } else {
        query.$and.push({
          $or: modelPatterns.map(pattern => ({ category: { $regex: pattern, $options: 'i' } }))
        })
      }
    }
  }

  // Category keyword search (existing functionality)
  if (filters.category) {
    // Category search with regex - combine with existing category constraints
    query.$and = query.$and || []
    query.$and.push({ category: { $regex: filters.category, $options: 'i' } })
  }

  // Account keyword search (array field - MongoDB will match if any element matches)
  if (filters.account) {
    query.$and = query.$and || []
    query.$and.push({ account: { $regex: filters.account, $options: 'i' } })
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
 * Get distinct process values extracted from category (2nd part after "-")
 * @param {string} projectFilter - Optional comma-separated project filter
 * @returns {Array} - Sorted array of unique process values
 */
async function getProcessesFromCategory(projectFilter) {
  const query = {}
  if (projectFilter) {
    const filter = parseCommaSeparated(projectFilter)
    if (filter) query.project = filter
  }

  const categories = await EmailInfo.distinct('category', query)
  const processSet = new Set()

  for (const category of categories) {
    const { process } = parseCategoryParts(category)
    if (process) {
      processSet.add(process)
    }
  }

  return Array.from(processSet).sort()
}

/**
 * Get distinct model values extracted from category (3rd part after "-")
 * @param {string} projectFilter - Optional comma-separated project filter
 * @param {string} processFilter - Optional comma-separated process filter
 * @returns {Array} - Sorted array of unique model values
 */
async function getModelsFromCategory(projectFilter, processFilter) {
  const query = {}
  if (projectFilter) {
    const filter = parseCommaSeparated(projectFilter)
    if (filter) query.project = filter
  }

  const categories = await EmailInfo.distinct('category', query)
  const modelSet = new Set()

  // Parse process filter for filtering
  const processValues = processFilter
    ? processFilter.split(',').map(p => p.trim().toUpperCase()).filter(p => p)
    : null

  for (const category of categories) {
    const { process, model } = parseCategoryParts(category)
    if (model) {
      // If process filter is provided, only include models from matching processes
      if (processValues && processValues.length > 0) {
        if (process && processValues.includes(process.toUpperCase())) {
          modelSet.add(model)
        }
      } else {
        modelSet.add(model)
      }
    }
  }

  return Array.from(modelSet).sort()
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

/**
 * Check which categories exist in EMAILINFO collection
 * @param {Array<string>} categories - Categories to check
 * @returns {Object} - { existing: string[], missing: string[] }
 */
async function checkCategories(categories) {
  if (!categories || categories.length === 0) {
    return { existing: [], missing: [] }
  }

  // Get all existing categories
  const existingDocs = await EmailInfo.find({}, 'category').lean()
  const existingSet = new Set(existingDocs.map(d => d.category?.toUpperCase?.() || ''))

  const existing = []
  const missing = []

  for (const cat of categories) {
    if (existingSet.has(cat.toUpperCase())) {
      existing.push(cat)
    } else {
      missing.push(cat)
    }
  }

  return { existing, missing }
}

module.exports = {
  getProjects,
  getCategories,
  getProcessesFromCategory,
  getModelsFromCategory,
  getEmailInfoPaginated,
  createEmailInfo,
  updateEmailInfo,
  deleteEmailInfo,
  checkCategories
}
