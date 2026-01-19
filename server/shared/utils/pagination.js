/**
 * Pagination utility for consistent pagination handling
 */

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100
const MIN_PAGE_SIZE = 1

/**
 * Parse and validate pagination parameters from request query
 * @param {Object} query - Request query object
 * @param {Object} options - Custom options
 * @returns {Object} - Parsed pagination options
 */
function parsePaginationParams(query, options = {}) {
  const {
    defaultPageSize = DEFAULT_PAGE_SIZE,
    maxPageSize = MAX_PAGE_SIZE,
    minPageSize = MIN_PAGE_SIZE
  } = options

  let page = parseInt(query.page, 10) || DEFAULT_PAGE
  let pageSize = parseInt(query.pageSize, 10) || defaultPageSize

  // Ensure page is at least 1
  page = Math.max(DEFAULT_PAGE, page)

  // Ensure pageSize is within bounds
  pageSize = Math.max(minPageSize, Math.min(maxPageSize, pageSize))

  const skip = (page - 1) * pageSize

  return {
    page,
    pageSize,
    skip,
    limit: pageSize
  }
}

/**
 * Calculate pagination metadata
 * @param {number} total - Total number of items
 * @param {number} page - Current page
 * @param {number} pageSize - Items per page
 * @returns {Object} - Pagination metadata
 */
function getPaginationMeta(total, page, pageSize) {
  const totalPages = Math.ceil(total / pageSize) || 1
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  return {
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage,
    hasPrevPage
  }
}

/**
 * Create a paginated response object
 * @param {Array} data - Array of items
 * @param {number} total - Total number of items
 * @param {number} page - Current page
 * @param {number} pageSize - Items per page
 * @returns {Object} - Paginated response
 */
function createPaginatedResponse(data, total, page, pageSize) {
  return {
    data,
    pagination: getPaginationMeta(total, page, pageSize)
  }
}

/**
 * Express middleware for parsing pagination params
 * Attaches pagination object to req.pagination
 */
function paginationMiddleware(options = {}) {
  return (req, res, next) => {
    req.pagination = parsePaginationParams(req.query, options)
    next()
  }
}

module.exports = {
  parsePaginationParams,
  getPaginationMeta,
  createPaginatedResponse,
  paginationMiddleware,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
}
