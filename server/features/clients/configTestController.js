/**
 * Config Test Controller - handles test-accesslog API
 * Uses RPC (via controlService.listRemoteFiles) instead of FTP for directory listing
 */
const controlService = require('./controlService')
const Client = require('./model')

/**
 * POST /api/clients/:id/test-accesslog
 * Test if files matching an AccessLog source pattern exist on a client
 *
 * Body: { directory, prefix, wildcard, suffix, exclude_suffix, date_subdir_format, agentGroup }
 * Response: { files: [{ name, size, modifiedAt }], total, matched }
 */
async function testAccessLog(req, res) {
  const { id: eqpId } = req.params
  const { directory, prefix, wildcard, suffix, exclude_suffix, date_subdir_format, agentGroup } = req.body

  if (!directory) {
    return res.status(400).json({ error: '디렉토리 경로는 필수입니다' })
  }
  if (!agentGroup) {
    return res.status(400).json({ error: 'agentGroup은 필수입니다' })
  }

  try {
    // Resolve directory: absolute path → use as-is, relative → prepend basePath
    let resolvedDir = directory
    if (!isAbsolutePath(directory)) {
      const client = await Client.findOne({ eqpId }).select('basePath').lean()
      const basePath = client?.basePath || process.env.LOG_REMOTE_BASE_PATH || ''
      if (basePath) {
        resolvedDir = basePath.replace(/[\\\/]+$/, '') + '/' + directory
      }
    }

    // List files via RPC
    const rpcResult = await controlService.listRemoteFiles(eqpId, agentGroup, resolvedDir)

    // Handle directory-not-found (graceful error from strategy)
    if (rpcResult.error) {
      return res.json({ files: [], total: 0, matched: 0, error: rpcResult.error })
    }

    const allFiles = rpcResult.files || []
    const total = allFiles.length

    // Apply pattern filtering
    const config = {
      prefix: prefix || '',
      suffix: suffix || '',
      exclude_suffix: exclude_suffix || []
    }
    const matched = filterByPattern(allFiles, config)

    // Sort by modifiedAt descending
    matched.sort((a, b) => {
      if (!a.modifiedAt || !b.modifiedAt) return 0
      return new Date(b.modifiedAt) - new Date(a.modifiedAt)
    })

    // If date_subdir_format is set, also check date subdirectories
    if (date_subdir_format) {
      const now = new Date()
      const year = now.getFullYear().toString()
      const month = (now.getMonth() + 1).toString().padStart(2, '0')
      const day = now.getDate().toString().padStart(2, '0')

      const candidates = [
        `${resolvedDir}/${year}/${month}/${day}`,
        `${resolvedDir}/${year}${month}${day}`,
        `${resolvedDir}/${year}/${month}`,
      ]

      for (const subDir of candidates) {
        try {
          const subResult = await controlService.listRemoteFiles(eqpId, agentGroup, subDir)
          if (subResult.error) continue
          const subFiles = filterByPattern(subResult.files || [], config)
            .map(f => ({ ...f, subdir: subDir.replace(resolvedDir + '/', '') }))
          if (subFiles.length > 0) {
            matched.push(...subFiles)
            break
          }
        } catch {
          // Subdir doesn't exist or RPC error, try next
        }
      }
    }

    res.json({ files: matched, total, matched: matched.length })
  } catch (err) {
    // RPC connection errors etc.
    res.status(500).json({ error: err.message || '원격 파일 목록 조회 실패' })
  }
}

/**
 * Filter files by prefix, suffix, and exclude_suffix pattern
 * @param {Array<{name: string}>} files - file list
 * @param {Object} config - { prefix, suffix, exclude_suffix }
 * @returns {Array} filtered files
 */
function filterByPattern(files, config) {
  return files.filter(f => {
    if (config.prefix && !f.name.startsWith(config.prefix)) return false
    if (config.suffix && !f.name.endsWith(config.suffix)) return false
    if (config.exclude_suffix && config.exclude_suffix.length > 0) {
      if (config.exclude_suffix.some(es => f.name.endsWith(es))) return false
    }
    return true
  })
}

/**
 * Check if a path is absolute (supports both Windows and Linux paths)
 * @param {string} p - path string
 * @returns {boolean}
 */
function isAbsolutePath(p) {
  if (!p) return false
  if (p.startsWith('/')) return true
  if (/^[A-Za-z]:[\\\/]/.test(p)) return true
  return false
}

module.exports = {
  testAccessLog,
  filterByPattern,
  isAbsolutePath
}
