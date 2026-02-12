/**
 * Log Controller
 * Handles log settings, file operations, tail streaming, and basePath detection
 */

const logService = require('./logService')
const logSettingsService = require('./logSettingsService')
const controlService = require('./controlService')
const { ApiError } = require('../../shared/middleware/errorHandler')
const { setupSSE } = require('../../shared/utils/sseHelper')

/**
 * GET /api/clients/log-settings/:agentGroup
 */
async function getLogSettings(req, res) {
  const { agentGroup } = req.params
  const doc = await logSettingsService.getDocument(agentGroup)
  res.json(doc || { agentGroup, logSources: [] })
}

/**
 * PUT /api/clients/log-settings/:agentGroup
 */
async function saveLogSettings(req, res) {
  const { agentGroup } = req.params
  const { logSources } = req.body

  if (!logSources || !Array.isArray(logSources)) {
    throw ApiError.badRequest('logSources array is required')
  }

  for (const s of logSources) {
    if (!s.name || !s.name.trim()) throw ApiError.badRequest('Log source name is required')
    if (!s.path || !s.path.trim()) throw ApiError.badRequest('Log source path is required')
    if (!s.keyword || !s.keyword.trim()) throw ApiError.badRequest('Log source keyword is required')
  }

  const updatedBy = req.user?.username || 'unknown'
  const result = await logSettingsService.saveLogSettings(agentGroup, logSources, updatedBy)
  res.json(result)
}

/**
 * GET /api/clients/:id/log-files
 */
async function getLogFileList(req, res) {
  const { id } = req.params
  const { agentGroup } = req.query

  if (!agentGroup) throw ApiError.badRequest('agentGroup is required')

  try {
    const files = await logService.getLogFileList(id, agentGroup)
    res.json(files)
  } catch (error) {
    throw ApiError.internal(`Failed to get log files: ${error.message}`)
  }
}

/**
 * GET /api/clients/:id/log-content
 */
async function getLogFileContent(req, res) {
  const { id } = req.params
  const { path: filePath } = req.query

  if (!filePath) throw ApiError.badRequest('path query parameter is required')

  try {
    const content = await logService.getLogFileContent(id, filePath)
    res.json({ content })
  } catch (error) {
    throw ApiError.internal(`Failed to read log file: ${error.message}`)
  }
}

/**
 * DELETE /api/clients/:id/log-files
 */
async function deleteLogFiles(req, res) {
  const { id } = req.params
  const { paths } = req.body

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    throw ApiError.badRequest('paths array is required')
  }

  try {
    const results = await logService.deleteLogFiles(id, paths)
    res.json({ results })
  } catch (error) {
    throw ApiError.internal(`Failed to delete log files: ${error.message}`)
  }
}

/**
 * POST /api/clients/log-tail-stream
 */
async function handleLogTailStream(req, res) {
  const { targets } = req.body

  if (!targets || !Array.isArray(targets) || targets.length === 0) {
    throw ApiError.badRequest('targets array is required')
  }

  const sse = setupSSE(res)
  const abortController = new AbortController()
  res.on('close', () => { abortController.abort() })

  try {
    await logService.tailLogStream(targets, (data) => {
      if (!abortController.signal.aborted) {
        sse.send(data)
      }
    }, abortController.signal)
  } catch (error) {
    if (!abortController.signal.aborted) {
      sse.send({ error: error.message })
    }
  }

  sse.end()
}

/**
 * POST /api/clients/:id/detect-base-path
 */
async function detectClientBasePath(req, res) {
  const { id } = req.params
  const agentGroup = req.body.agentGroup || req.query.agentGroup
  if (!agentGroup) throw ApiError.badRequest('agentGroup is required')

  try {
    const basePath = await controlService.detectBasePath(id, agentGroup)
    res.json({ basePath })
  } catch (error) {
    throw ApiError.internal(`Failed to detect base path: ${error.message}`)
  }
}

module.exports = {
  getLogSettings,
  saveLogSettings,
  getLogFileList,
  getLogFileContent,
  deleteLogFiles,
  handleLogTailStream,
  detectClientBasePath
}
