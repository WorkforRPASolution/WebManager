/**
 * Update Controller
 * Handles software update settings and deployment
 */

const updateSettingsService = require('./updateSettingsService')
const updateService = require('./updateService')
const { ApiError } = require('../../shared/middleware/errorHandler')
const { setupSSE } = require('../../shared/utils/sseHelper')

/**
 * GET /api/clients/update-settings/:agentGroup
 */
async function getUpdateSettings(req, res) {
  const { agentGroup } = req.params
  const doc = await updateSettingsService.getDocument(agentGroup)
  res.json(doc || { agentGroup, packages: [], source: {} })
}

/**
 * PUT /api/clients/update-settings/:agentGroup
 */
async function saveUpdateSettings(req, res) {
  const { agentGroup } = req.params
  const { packages, source } = req.body

  if (!packages || !Array.isArray(packages)) {
    throw ApiError.badRequest('packages array is required')
  }

  for (const p of packages) {
    if (!p.name || !p.name.trim()) throw ApiError.badRequest('Package name is required')
    if (!p.targetPath || !p.targetPath.trim()) throw ApiError.badRequest('Package targetPath is required')
  }

  const updatedBy = req.user?.username || 'unknown'
  const doc = await updateSettingsService.saveUpdateSettings(agentGroup, packages, source || {}, updatedBy)
  res.json(doc)
}

/**
 * POST /api/clients/update-source/list
 */
async function listUpdateSourceFiles(req, res) {
  const { source, relativePath } = req.body

  if (!source || !source.type) {
    throw ApiError.badRequest('source with type is required')
  }

  try {
    const files = await updateService.listSourceFiles(source, relativePath)
    res.json(files)
  } catch (error) {
    throw ApiError.internal(`Failed to list source files: ${error.message}`)
  }
}

/**
 * POST /api/clients/update/deploy
 */
async function deployUpdate(req, res) {
  const { agentGroup, packageIds, targetEqpIds } = req.body

  if (!agentGroup) throw ApiError.badRequest('agentGroup is required')
  if (!packageIds || !Array.isArray(packageIds) || packageIds.length === 0) {
    throw ApiError.badRequest('packageIds array is required')
  }
  if (!targetEqpIds || !Array.isArray(targetEqpIds) || targetEqpIds.length === 0) {
    throw ApiError.badRequest('targetEqpIds array is required')
  }

  const sse = setupSSE(res)

  try {
    const result = await updateService.deployUpdate(agentGroup, packageIds, targetEqpIds, (progress) => {
      sse.send(progress)
    })
    if (!sse.isAborted()) {
      sse.send({ done: true, ...result })
    }
  } catch (error) {
    if (!sse.isAborted()) {
      sse.send({ done: true, error: error.message })
    }
  }

  sse.end()
}

module.exports = {
  getUpdateSettings,
  saveUpdateSettings,
  listUpdateSourceFiles,
  deployUpdate
}
