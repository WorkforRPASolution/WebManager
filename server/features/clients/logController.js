/**
 * Log Controller
 * Handles log settings, file operations, tail streaming, and basePath detection
 */

const logService = require('./logService')
const logSettingsService = require('./logSettingsService')
const controlService = require('./controlService')
const { ApiError } = require('../../shared/middleware/errorHandler')
const { createActionLog } = require('../../shared/models/webmanagerLogModel')
const { setupSSE } = require('../../shared/utils/sseHelper')
const { createLogger } = require('../../shared/logger')
const log = createLogger('clients')

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

  const updatedBy = req.user?.singleid || 'unknown'
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
  const { path: filePath, agentGroup } = req.query

  if (!filePath) throw ApiError.badRequest('path query parameter is required')

  try {
    const content = await logService.getLogFileContent(id, filePath, agentGroup)
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

    // Audit logging (fire-and-forget)
    createActionLog({
      action: 'delete',
      targetType: 'log_file',
      targetId: id,
      details: { paths, results },
      userId: req.user?.singleid || 'system'
    }).catch(() => {})

    res.json({ results })
  } catch (error) {
    throw ApiError.internal(`Failed to delete log files: ${error.message}`)
  }
}

/**
 * POST /api/clients/:id/log-files/download
 */
async function downloadLogFile(req, res) {
  const { id } = req.params
  const { paths } = req.body

  if (!paths || !Array.isArray(paths) || paths.length !== 1) {
    throw ApiError.badRequest('paths array with exactly one path is required')
  }

  try {
    // Audit logging (fire-and-forget)
    createActionLog({
      action: 'download',
      targetType: 'log_file',
      targetId: id,
      details: { path: paths[0] },
      userId: req.user?.singleid || 'system'
    }).catch(() => {})

    await logService.downloadLogFile(id, paths[0], res)
  } catch (error) {
    if (!res.headersSent) {
      throw ApiError.internal(`Failed to download log file: ${error.message}`)
    }
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
    log.error(`[tailLogStream] Error tailing logs: ${error.message}`)
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
  // agentGroup은 더 이상 사용하지 않지만 호환성을 위해 수용

  try {
    const basePath = await controlService.detectBasePath(id)
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
  downloadLogFile,
  handleLogTailStream,
  detectClientBasePath
}
