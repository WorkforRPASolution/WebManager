/**
 * MongoDB query builder utility
 * Helps construct consistent queries with filtering
 */

/**
 * Build a MongoDB filter query from request parameters
 * @param {Object} params - Query parameters
 * @param {Object} fieldMappings - Mapping of param names to DB field names and types
 * @returns {Object} - MongoDB query object
 */
function buildFilterQuery(params, fieldMappings) {
  const query = {}

  for (const [paramName, config] of Object.entries(fieldMappings)) {
    const value = params[paramName]

    if (value === undefined || value === null || value === '') {
      continue
    }

    const fieldName = config.field || paramName
    const type = config.type || 'string'

    switch (type) {
      case 'string':
        query[fieldName] = value
        break

      case 'regex':
        query[fieldName] = { $regex: value, $options: config.options || 'i' }
        break

      case 'number':
        query[fieldName] = Number(value)
        break

      case 'boolean':
        query[fieldName] = value === 'true' || value === true
        break

      case 'array':
        query[fieldName] = { $in: Array.isArray(value) ? value : [value] }
        break

      case 'range':
        if (config.min !== undefined || config.max !== undefined) {
          query[fieldName] = {}
          if (config.min !== undefined) query[fieldName].$gte = config.min
          if (config.max !== undefined) query[fieldName].$lte = config.max
        }
        break

      case 'date':
        query[fieldName] = new Date(value)
        break

      case 'dateRange':
        query[fieldName] = {}
        if (params[`${paramName}From`]) {
          query[fieldName].$gte = new Date(params[`${paramName}From`])
        }
        if (params[`${paramName}To`]) {
          query[fieldName].$lte = new Date(params[`${paramName}To`])
        }
        if (Object.keys(query[fieldName]).length === 0) {
          delete query[fieldName]
        }
        break

      default:
        query[fieldName] = value
    }
  }

  return query
}

/**
 * Build a text search query
 * @param {string} searchText - Text to search for
 * @param {Array<string>} fields - Fields to search in
 * @returns {Object|null} - MongoDB $or query or null
 */
function buildTextSearchQuery(searchText, fields) {
  if (!searchText || !fields || fields.length === 0) {
    return null
  }

  return {
    $or: fields.map(field => ({
      [field]: { $regex: searchText, $options: 'i' }
    }))
  }
}

/**
 * Merge multiple query conditions
 * @param  {...Object} queries - Query objects to merge
 * @returns {Object} - Merged query object
 */
function mergeQueries(...queries) {
  const merged = {}

  for (const query of queries) {
    if (!query) continue

    for (const [key, value] of Object.entries(query)) {
      if (key === '$or' || key === '$and') {
        if (!merged[key]) merged[key] = []
        merged[key] = merged[key].concat(value)
      } else {
        merged[key] = value
      }
    }
  }

  return merged
}

/**
 * Build a sort object from request parameters
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - 'asc' or 'desc'
 * @param {Object} defaultSort - Default sort if not provided
 * @returns {Object} - MongoDB sort object
 */
function buildSortQuery(sortBy, sortOrder = 'asc', defaultSort = { createdAt: -1 }) {
  if (!sortBy) {
    return defaultSort
  }

  return {
    [sortBy]: sortOrder.toLowerCase() === 'desc' ? -1 : 1
  }
}

/**
 * Check for duplicates in a collection
 * @param {Model} Model - Mongoose model
 * @param {Object} conditions - Conditions to check
 * @param {string} excludeId - ID to exclude from check (for updates)
 * @returns {Promise<Object|null>} - Duplicate document or null
 */
async function checkDuplicate(Model, conditions, excludeId = null) {
  const query = { ...conditions }

  if (excludeId) {
    query._id = { $ne: excludeId }
  }

  return Model.findOne(query).lean()
}

/**
 * Get distinct values with optional filter
 * @param {Model} Model - Mongoose model
 * @param {string} field - Field to get distinct values from
 * @param {Object} filter - Optional filter query
 * @returns {Promise<Array>} - Array of distinct values
 */
async function getDistinctValues(Model, field, filter = {}) {
  return Model.distinct(field, filter)
}

module.exports = {
  buildFilterQuery,
  buildTextSearchQuery,
  mergeQueries,
  buildSortQuery,
  checkDuplicate,
  getDistinctValues
}
