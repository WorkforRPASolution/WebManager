/**
 * Log Service - Log file operations and tail streaming
 */

const { AvroRpcClient } = require('../../shared/avro/avroClient')
const Client = require('./model')
const { detectBasePath } = require('./controlService')
const logSettingsService = require('./logSettingsService')
const { listLogFiles, readLogFile, deleteLogFile } = require('./ftpService')
const crypto = require('crypto')

const LOG_MAX_FILE_SIZE = parseInt(process.env.LOG_MAX_FILE_SIZE) || 10485760 // 10MB
const LOG_TAIL_INTERVAL = parseInt(process.env.LOG_TAIL_INTERVAL) || 3000
const LOG_TAIL_BATCH_LINES = parseInt(process.env.LOG_TAIL_BATCH_LINES) || 50
const LOG_TAIL_RPC_TIMEOUT = parseInt(process.env.LOG_TAIL_RPC_TIMEOUT) || 10000
const LOG_MAX_CONCURRENT_TAILS = parseInt(process.env.LOG_MAX_CONCURRENT_TAILS) || 5

let activeTailCount = 0

/**
 * Get log file list for a client
 * Merges results from all log sources defined in LOG_SETTINGS
 */
async function getLogFileList(eqpId, agentGroup) {
  const logSources = await logSettingsService.getByAgentGroup(agentGroup)
  if (!logSources || logSources.length === 0) {
    return []
  }

  const results = []

  for (const source of logSources) {
    try {
      const files = await listLogFiles(eqpId, source.path, source.keyword)
      for (const file of files) {
        results.push({
          ...file,
          sourceId: source.sourceId,
          sourceName: source.name
        })
      }
    } catch (err) {
      results.push({
        sourceId: source.sourceId,
        sourceName: source.name,
        error: err.message
      })
    }
  }

  return results
}

/**
 * Get log file content via FTP
 * Checks file size before reading
 */
async function getLogFileContent(eqpId, filePath) {
  const content = await readLogFile(eqpId, filePath, LOG_MAX_FILE_SIZE)
  return content
}

/**
 * Delete log files via FTP
 * Returns results array with success/error per file
 */
async function deleteLogFiles(eqpId, filePaths) {
  const results = []

  for (const filePath of filePaths) {
    try {
      await deleteLogFile(eqpId, filePath)
      results.push({ path: filePath, success: true })
    } catch (err) {
      results.push({ path: filePath, success: false, error: err.message })
    }
  }

  return results
}

/**
 * Tail log stream via RPC polling
 * @param {Array<{eqpId, filePath, agentGroup}>} targets - Tail targets
 * @param {function} onData - Callback for new data
 * @param {AbortSignal} signal - Abort signal to stop polling
 */
async function tailLogStream(targets, onData, signal) {
  if (targets.length > LOG_MAX_CONCURRENT_TAILS) {
    throw new Error(`Too many tail targets: ${targets.length} (max ${LOG_MAX_CONCURRENT_TAILS})`)
  }

  if (activeTailCount + targets.length > LOG_MAX_CONCURRENT_TAILS) {
    throw new Error(`Concurrent tail limit reached (active: ${activeTailCount}, max: ${LOG_MAX_CONCURRENT_TAILS})`)
  }

  activeTailCount += targets.length

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  const tailOneTarget = async (target) => {
    const { eqpId, filePath, agentGroup } = target
    const client = await Client.findOne({ eqpId }).select('ipAddr ipAddrL agentPorts basePath').lean()
    if (!client) {
      onData({ eqpId, filePath, error: `Client not found: ${eqpId}` })
      return
    }

    let previousHash = null
    let currentBasePath = client.basePath || ''
    let basePathRetried = false

    while (!signal.aborted) {
      let rpcClient = null
      try {
        rpcClient = new AvroRpcClient(client.ipAddr, client.ipAddrL, client.agentPorts)
        await rpcClient.connect()

        const relPath = filePath.startsWith('/') ? filePath.substring(1) : filePath
        const fullPath = currentBasePath ? `${currentBasePath}/${relPath}` : relPath
        const commandLine = 'tail'
        const args = ['-n', String(LOG_TAIL_BATCH_LINES), fullPath]
        const response = await rpcClient.runCommand(commandLine, args, LOG_TAIL_RPC_TIMEOUT)

        if (response.success && response.output) {
          basePathRetried = false // reset on success
          const currentHash = crypto.createHash('md5').update(response.output).digest('hex')

          if (currentHash !== previousHash) {
            previousHash = currentHash
            const lines = response.output.split('\n').filter(l => l.length > 0)
            onData({
              eqpId,
              filePath,
              lines,
              timestamp: new Date().toISOString()
            })
          }
        } else if (!response.success) {
          const errMsg = response.error || 'RPC tail failed'
          // Auto-detect basePath on file-not-found errors (once per session)
          if (!basePathRetried && /no such file|not found|exit value: 1/i.test(errMsg)) {
            basePathRetried = true
            try {
              const newBasePath = await detectBasePath(eqpId, agentGroup)
              if (newBasePath && newBasePath !== currentBasePath) {
                currentBasePath = newBasePath
                onData({ eqpId, filePath, info: `basePath updated to ${newBasePath}, retrying...` })
                continue // retry immediately with new basePath
              }
            } catch (_) { /* detect failed, fall through to report original error */ }
          }
          onData({ eqpId, filePath, error: errMsg })
        }
      } catch (err) {
        onData({ eqpId, filePath, error: err.message })
      } finally {
        if (rpcClient) rpcClient.disconnect()
      }

      if (!signal.aborted) {
        await sleep(LOG_TAIL_INTERVAL)
      }
    }
  }

  try {
    await Promise.all(targets.map(t => tailOneTarget(t)))
  } finally {
    activeTailCount -= targets.length
  }
}

module.exports = {
  getLogFileList,
  getLogFileContent,
  deleteLogFiles,
  tailLogStream
}
