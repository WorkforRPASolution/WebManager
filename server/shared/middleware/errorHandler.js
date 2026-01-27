/**
 * Centralized error handling middleware
 */

const { createErrorLog } = require('../models/webmanagerLogModel')

/**
 * Custom API error class
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message)
    this.statusCode = statusCode
    this.details = details
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }

  static badRequest(message, details = null) {
    return new ApiError(400, message, details)
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message)
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message)
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message)
  }

  static conflict(message, details = null) {
    return new ApiError(409, message, details)
  }

  static validation(details) {
    return new ApiError(400, 'Validation failed', details)
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message)
  }
}

/**
 * Async handler wrapper to catch async errors
 * @param {Function} fn - Async route handler
 * @returns {Function} - Wrapped handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Not found handler middleware
 */
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`))
}

/**
 * Helper function to save error log to database
 */
async function saveErrorLog(err, req) {
  // Determine error type
  let errorType = 'ServerError'
  if (err.name === 'ValidationError') errorType = 'ValidationError'
  else if (err.code === 11000) errorType = 'DuplicateKeyError'
  else if (err.name === 'CastError') errorType = 'CastError'
  else if (err instanceof ApiError) errorType = 'ApiError'

  // Sanitize request body (remove sensitive fields)
  const sanitizedBody = { ...req.body }
  delete sanitizedBody.password
  delete sanitizedBody.currentPassword
  delete sanitizedBody.newPassword

  await createErrorLog({
    errorType,
    errorMessage: err.message,
    errorStack: process.env.NODE_ENV === 'development' ? err.stack : null,
    requestInfo: {
      method: req.method,
      url: req.originalUrl,
      body: sanitizedBody
    },
    userId: req.user?.singleid || req.user?.id || 'anonymous'
  })
}

/**
 * Global error handler middleware
 */
async function errorHandler(err, req, res, next) {
  // Log error (in production, use proper logging)
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  })

  // Save error log to database (non-blocking)
  saveErrorLog(err, req).catch(logErr => {
    console.error('Failed to save error log:', logErr.message)
  })

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }))
    return res.status(400).json({
      error: 'Validation failed',
      details
    })
  }

  // Handle Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    return res.status(409).json({
      error: 'Duplicate entry',
      details: [{ field, message: `${field} already exists` }]
    })
  }

  // Handle Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
      details: [{ field: err.path, message: 'Invalid ID' }]
    })
  }

  // Handle our custom ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details })
    })
  }

  // Handle unexpected errors
  const statusCode = err.statusCode || 500
  const message = process.env.NODE_ENV === 'development'
    ? err.message
    : 'Internal server error'

  res.status(statusCode).json({ error: message })
}

module.exports = {
  ApiError,
  asyncHandler,
  notFoundHandler,
  errorHandler
}
