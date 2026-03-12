/**
 * Config Compare Controller
 * Handles N-way config comparison with SSE streaming
 */

let configCompareService = require('./configCompareService')
const { ApiError } = require('../../shared/middleware/errorHandler')
let _setupSSE = require('../../shared/utils/sseHelper').setupSSE

/** @internal Replace dependencies for testing */
function _setDeps(deps) {
  if (deps.configCompareService) configCompareService = deps.configCompareService
  if (deps.setupSSE) _setupSSE = deps.setupSSE
}

const MAX_COMPARE_CLIENTS = 25

/**
 * POST /api/clients/config/compare (SSE)
 * Body: { eqpIds: string[], agentGroup: string }
 */
async function handleCompareConfigs(req, res) {
  const { eqpIds, agentGroup } = req.body

  if (!eqpIds || !Array.isArray(eqpIds) || eqpIds.length === 0) {
    throw ApiError.badRequest('eqpIds array is required')
  }
  if (!agentGroup) {
    throw ApiError.badRequest('agentGroup is required')
  }
  if (eqpIds.length < 2) {
    throw ApiError.badRequest('eqpIds must contain at least 2 items')
  }
  if (eqpIds.length > MAX_COMPARE_CLIENTS) {
    throw ApiError.badRequest(`eqpIds must contain maximum ${MAX_COMPARE_CLIENTS} items`)
  }

  const sse = _setupSSE(res)

  let loaded = 0
  let failed = 0

  try {
    await configCompareService.compareConfigs(eqpIds, agentGroup, (progress) => {
      if (!sse.isAborted()) {
        sse.send(progress)
      }
      if (progress.status === 'loaded') loaded++
      else if (progress.status === 'error') failed++
    })

    if (!sse.isAborted()) {
      sse.send({
        done: true,
        type: 'done',
        total: eqpIds.length,
        loaded,
        failed
      })
    }
  } catch (error) {
    if (!sse.isAborted()) {
      sse.send({ done: true, type: 'done', error: error.message })
    }
  }

  sse.end()
}

module.exports = {
  handleCompareConfigs,
  _setDeps
}
