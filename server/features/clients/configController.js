/**
 * Config Management Controller
 * Handles config file operations: settings, read, write, deploy
 */

const service = require('./service')
const ftpService = require('./ftpService')
const configSettingsService = require('./configSettingsService')
const { ApiError } = require('../../shared/middleware/errorHandler')
const { setupSSE } = require('../../shared/utils/sseHelper')

/**
 * GET /api/clients/config/settings
 */
async function getConfigSettings(req, res) {
  const { agentGroup } = req.query
  const settings = await ftpService.getConfigSettings(agentGroup)
  res.json(settings)
}

/**
 * GET /api/clients/by-model
 */
async function getClientsByModel(req, res) {
  const { eqpModel, excludeEqpId } = req.query

  if (!eqpModel) {
    throw ApiError.badRequest('eqpModel is required')
  }

  const clients = await service.getClientsByModel(eqpModel, excludeEqpId)
  res.json(clients)
}

/**
 * GET /api/clients/:id/config
 */
async function getClientConfigs(req, res) {
  const { id } = req.params
  const { agentGroup } = req.query

  try {
    const configs = await ftpService.readAllConfigs(id, agentGroup)
    res.json(configs)
  } catch (error) {
    throw ApiError.internal(`Failed to read configs: ${error.message}`)
  }
}

/**
 * PUT /api/clients/:id/config/:fileId
 */
async function updateClientConfig(req, res) {
  const { id, fileId } = req.params
  const { content, agentGroup } = req.body

  if (content === undefined || content === null) {
    throw ApiError.badRequest('content is required')
  }

  const configs = await ftpService.getConfigSettings(agentGroup)
  const config = configs.find(c => c.fileId === fileId)
  if (!config) {
    throw ApiError.notFound(`Config file not found: ${fileId}`)
  }

  try {
    await ftpService.writeConfigFile(id, config.path, content)
    res.json({ success: true, message: 'Config saved successfully' })
  } catch (error) {
    throw ApiError.internal(`Failed to save config: ${error.message}`)
  }
}

/**
 * POST /api/clients/config/deploy
 */
async function deployConfig(req, res) {
  const { sourceEqpId, fileId, targetEqpIds, mode, selectedKeys, agentGroup } = req.body

  if (!sourceEqpId || !fileId || !targetEqpIds || !Array.isArray(targetEqpIds) || targetEqpIds.length === 0) {
    throw ApiError.badRequest('sourceEqpId, fileId, and targetEqpIds are required')
  }

  const configs = await ftpService.getConfigSettings(agentGroup)
  const config = configs.find(c => c.fileId === fileId)
  if (!config) {
    throw ApiError.notFound(`Config file not found: ${fileId}`)
  }

  const sse = setupSSE(res)

  try {
    const sourceContent = await ftpService.readConfigFile(sourceEqpId, config.path)

    const onProgress = (progress) => {
      sse.send(progress)
    }

    let results
    if (mode === 'selective' && selectedKeys && selectedKeys.length > 0) {
      const sourceConfig = JSON.parse(sourceContent)
      results = await ftpService.deployConfigSelective(
        sourceConfig, selectedKeys, targetEqpIds, config.path, onProgress
      )
    } else {
      results = await ftpService.deployConfig(
        sourceContent, targetEqpIds, config.path, onProgress
      )
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    sse.send({
      done: true,
      total: targetEqpIds.length,
      success: successCount,
      failed: failCount,
      results
    })
  } catch (error) {
    sse.send({ done: true, error: error.message })
  }

  sse.end()
}

/**
 * GET /api/clients/config/settings/:agentGroup
 */
async function getConfigSettingsDocument(req, res) {
  const { agentGroup } = req.params
  const doc = await configSettingsService.getDocument(agentGroup)
  res.json(doc || { agentGroup, configFiles: [] })
}

/**
 * PUT /api/clients/config/settings/:agentGroup
 */
async function saveConfigSettingsDocument(req, res) {
  const { agentGroup } = req.params
  const { configFiles } = req.body

  if (!configFiles || !Array.isArray(configFiles)) {
    throw ApiError.badRequest('configFiles array is required')
  }

  for (const f of configFiles) {
    if (!f.name || !f.name.trim()) throw ApiError.badRequest('Config file name is required')
    if (!f.path || !f.path.trim()) throw ApiError.badRequest('Config file path is required')
  }

  const updatedBy = req.user?.username || 'unknown'
  const doc = await configSettingsService.saveConfigSettings(agentGroup, configFiles, updatedBy)
  res.json(doc)
}

module.exports = {
  getConfigSettings,
  getClientsByModel,
  getClientConfigs,
  updateClientConfig,
  deployConfig,
  getConfigSettingsDocument,
  saveConfigSettingsDocument
}
