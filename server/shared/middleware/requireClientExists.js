/**
 * Client existence check middleware
 *
 * Replaces the repeated pattern in controller.js:
 *   const exists = await service.clientExists(id)
 *   if (!exists) throw ApiError.notFound('Client not found')
 *
 * Usage in routes.js:
 *   router.get('/:id/status', authenticate, requireClientExists(), asyncHandler(controller.getClientStatus))
 */

const service = require('../../features/clients/service')
const { ApiError } = require('./errorHandler')

/**
 * Express middleware that checks if a client exists by req.params.id.
 * Throws ApiError.notFound if not found.
 */
function requireClientExists() {
  return async (req, res, next) => {
    const { id } = req.params
    if (!id) return next()

    try {
      const exists = await service.clientExists(id)
      if (!exists) {
        return next(ApiError.notFound('Client not found'))
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}

module.exports = { requireClientExists }
