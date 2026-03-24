/**
 * Log Service - Log file operations and tail streaming
 */

const { AvroRpcClient } = require('../../shared/avro/avroClient')
const Client = require('./model')
const { detectBasePath } = require('./controlService')
const logSettingsService = require('./logSettingsService')
const strategyRegistry = require('./strategies')
const { listLogFiles, readLogFile, downloadLogFileToStream, deleteLogFile } = require('./ftpService')
const path = require('path')
const crypto = require('crypto')
const { createLogger } = require('../../shared/logger')
const log = createLogger('clients')

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
      log.warn(`getLogFileList: failed to list files for source ${source.sourceId} (${source.path}) on ${eqpId}: ${err.message}`)
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
async function getLogFileContent(eqpId, filePath, agentGroup) {
  let encoding = 'utf-8'
  if (agentGroup) {
    const logSources = await logSettingsService.getByAgentGroup(agentGroup)
    const match = logSources.find(s => filePath.includes(s.path))
    if (match?.encoding) encoding = match.encoding
  }
  const content = await readLogFile(eqpId, filePath, LOG_MAX_FILE_SIZE, encoding)
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
      log.warn(`deleteLogFiles: failed to delete ${filePath} on ${eqpId}: ${err.message}`)
      results.push({ path: filePath, success: false, error: err.message })
    }
  }

  return results
}

/**
 * Download a single log file to HTTP response
 * @param {string} eqpId - Equipment ID
 * @param {string} filePath - Remote file path
 * @param {import('express').Response} res - Express response
 */
async function downloadLogFile(eqpId, filePath, res) {
  const fileName = path.basename(filePath)

  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  res.setHeader('Content-Type', 'application/octet-stream')

  await downloadLogFileToStream(eqpId, filePath, res)
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
    const client = await Client.findOne({ eqpId }).select('ipAddr ipAddrL agentPorts basePath serviceType').lean()
    if (!client) {
      onData({ eqpId, filePath, error: `Client not found: ${eqpId}` })
      return
    }

    let previousHash = null
    let currentBasePath = client.basePath || ''
    let basePathRetried = false

    // basePath 없으면 tail 시작 전 자동 감지 시도
    if (!currentBasePath) {
      try {
        const detected = await detectBasePath(eqpId)
        if (detected) {
          currentBasePath = detected
          onData({ eqpId, filePath, info: `basePath auto-detected: ${detected}` })
        }
      } catch (e) {
        log.warn(`tailLogStream: basePath pre-detect failed for ${eqpId}: ${e.message}`)
        onData({ eqpId, filePath, info: `basePath 자동 감지 실패: ${e.message}` })
      }
    }

    while (!signal.aborted) {
      let rpcClient = null
      try {
        rpcClient = new AvroRpcClient(client.ipAddr, client.ipAddrL, client.agentPorts)
        await rpcClient.connect()

        const relPath = filePath.startsWith('/') ? filePath.substring(1) : filePath
        const fullPath = currentBasePath ? `${currentBasePath}/${relPath}` : relPath
        const strategy = client.serviceType
          ? strategyRegistry.get(agentGroup, client.serviceType)
          : strategyRegistry.getDefault(agentGroup)
        
        let commandLine, args
        if (strategy && strategy.getTailCommand) {
          const tailCmd = strategy.getTailCommand(fullPath, LOG_TAIL_BATCH_LINES, currentBasePath)
          commandLine = tailCmd.commandLine
          args = tailCmd.args
        } else {
          // fallback: Linux tail
          commandLine = 'tail'
          args = ['-n', String(LOG_TAIL_BATCH_LINES), fullPath]
        }
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
              const newBasePath = await detectBasePath(eqpId)
              if (newBasePath && newBasePath !== currentBasePath) {
                currentBasePath = newBasePath
                onData({ eqpId, filePath, info: `basePath updated to ${newBasePath}, retrying...` })
                continue // retry immediately with new basePath
              }
            } catch (detectErr) {
              log.warn(`tailLogStream: basePath detect failed for ${eqpId}: ${detectErr.message}`)
            }
          }
          onData({ eqpId, filePath, error: errMsg })
        }
      } catch (err) {
        log.warn(`tailLogStream: RPC poll error for ${eqpId} (${filePath}): ${err.message}`)
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
  downloadLogFile,
  tailLogStream
}
