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
const { createLogger } = require('../../shared/logger')
const log = createLogger('clients')

const LOG_MAX_FILE_SIZE = parseInt(process.env.LOG_MAX_FILE_SIZE) || 10485760 // 10MB
const LOG_TAIL_INTERVAL = parseInt(process.env.LOG_TAIL_INTERVAL) || 3000
const LOG_TAIL_BATCH_LINES = parseInt(process.env.LOG_TAIL_BATCH_LINES) || 50
const LOG_TAIL_RPC_TIMEOUT = parseInt(process.env.LOG_TAIL_RPC_TIMEOUT) || 10000
const LOG_MAX_CONCURRENT_TAILS = parseInt(process.env.LOG_MAX_CONCURRENT_TAILS) || 5

// 테스트 DI: 내부 의존성 교체
let _AvroRpcClient = AvroRpcClient
let _ClientModel = Client
let _detectBasePath = detectBasePath
let _strategyRegistry = strategyRegistry
let _sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function _setDeps(deps) {
  if (deps.AvroRpcClient) _AvroRpcClient = deps.AvroRpcClient
  if (deps.ClientModel) _ClientModel = deps.ClientModel
  if (deps.detectBasePath) _detectBasePath = deps.detectBasePath
  if (deps.strategyRegistry) _strategyRegistry = deps.strategyRegistry
  if (deps.sleep) _sleep = deps.sleep
}

const OFFSET_HEADER = '@WINTAIL:'

function parseOffsetHeader(output) {
  if (!output || !output.startsWith(OFFSET_HEADER)) return null
  const nlIdx = output.indexOf('\n')
  const sizeStr = nlIdx === -1
    ? output.substring(OFFSET_HEADER.length)
    : output.substring(OFFSET_HEADER.length, nlIdx)
  const offset = parseInt(sizeStr, 10)
  if (isNaN(offset)) return null
  return { offset, content: nlIdx === -1 ? '' : output.substring(nlIdx + 1) }
}

function isRotationSignal(response) {
  return !response.success && /exit value:\s*2/i.test(response.error || '')
}

// NOTE: Pod별 인메모리 카운터 — 멀티 Pod 환경에서 전역이 아닌 Pod당 제한.
// Log tail SSE는 sticky session으로 같은 Pod에 고정되므로, Pod당 리소스
// 보호 목적상 의도된 동작. 전역 제한이 필요하면 Redis 카운터로 전환 필요.
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
 * Extract only new lines by finding the overlap between previous and current tail results.
 * Uses suffix-prefix matching: finds the longest suffix of previousLines that matches
 * a prefix of currentLines, then returns the remaining (new) lines.
 *
 * Note: If a rotated log starts with lines identical to the old file's tail,
 * this may falsely detect overlap. This is rare in practice.
 *
 * @param {string[]|null} previousLines - Lines from the previous poll cycle
 * @param {string[]} currentLines - Lines from the current poll cycle
 * @returns {string[]} Only the new lines not present in the previous result
 */
function extractNewLines(previousLines, currentLines) {
  if (!previousLines || previousLines.length === 0) return currentLines
  if (currentLines.length === 0) return []

  const maxOverlap = Math.min(previousLines.length, currentLines.length)

  for (let len = maxOverlap; len > 0; len--) {
    let match = true
    for (let i = 0; i < len; i++) {
      if (previousLines[previousLines.length - len + i] !== currentLines[i]) {
        match = false
        break
      }
    }
    if (match) {
      return currentLines.slice(len)
    }
  }

  // No overlap — file rotation or large gap
  return currentLines
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

  const tailOneTarget = async (target) => {
    const { eqpId, filePath, agentGroup } = target
    const client = await _ClientModel.findOne({ eqpId }).select('ipAddr ipAddrL agentPorts basePath serviceType').lean()
    if (!client) {
      onData({ eqpId, filePath, error: `Client not found: ${eqpId}` })
      return
    }

    let previousLines = null
    let currentBasePath = client.basePath || ''
    let basePathRetried = false
    let offset = null           // offset mode: file byte position
    let pendingPartial = ''     // offset mode: incomplete line buffer
    let useOffsetMode = null    // null=unknown, true/false=detected on first response

    // basePath 없으면 tail 시작 전 자동 감지 시도
    if (!currentBasePath) {
      try {
        const detected = await _detectBasePath(eqpId)
        if (detected) {
          currentBasePath = detected
          onData({ eqpId, filePath, info: `basePath auto-detected: ${detected}` })
        }
      } catch (e) {
        log.warn(`tailLogStream: basePath pre-detect failed for ${eqpId}: ${e.message}`)
        onData({ eqpId, filePath, info: `basePath 자동 감지 실패: ${e.message}` })
      }
    }

    // RPC connection reuse — create once, reconnect only on error
    let rpcClient = null

    const connectRpc = async () => {
      rpcClient = new _AvroRpcClient(client.ipAddr, client.ipAddrL, client.agentPorts)
      await rpcClient.connect()
    }

    const disconnectRpc = () => {
      if (rpcClient) {
        try { rpcClient.disconnect() } catch { /* ignore cleanup errors */ }
        rpcClient = null
      }
    }

    try {
      while (!signal.aborted) {
        try {
          if (!rpcClient) await connectRpc()

          const relPath = filePath.startsWith('/') ? filePath.substring(1) : filePath
          const fullPath = currentBasePath ? `${currentBasePath}/${relPath}` : relPath
          const strategy = client.serviceType
            ? _strategyRegistry.get(agentGroup, client.serviceType)
            : _strategyRegistry.getDefault(agentGroup)

          let commandLine, args
          if (strategy && strategy.getTailCommand) {
            const tailCmd = strategy.getTailCommand(fullPath, LOG_TAIL_BATCH_LINES, currentBasePath, offset)
            commandLine = tailCmd.commandLine
            args = tailCmd.args
          } else {
            commandLine = 'tail'
            args = ['-n', String(LOG_TAIL_BATCH_LINES), fullPath]
          }

          const response = await rpcClient.runCommand(commandLine, args, LOG_TAIL_RPC_TIMEOUT)

          // Rotation check (exit code 2) — BEFORE success check since rotation returns success=false
          if (isRotationSignal(response)) {
            offset = null
            pendingPartial = ''
            previousLines = null
            onData({ eqpId, filePath, info: 'File rotation detected, resetting...' })
            continue  // skip to next poll cycle, no sleep needed for reset
          }

          if (response.success) {
            basePathRetried = false
            if (response.output) {
              const parsed = parseOffsetHeader(response.output)

              // Detect mode on first successful response
              if (useOffsetMode === null) {
                useOffsetMode = parsed !== null
              }

              if (useOffsetMode && parsed) {
                // === OFFSET MODE: no extractNewLines needed ===
                const full = pendingPartial + parsed.content
                if (full.length > 0) {
                  const parts = full.split('\n')
                  // If content doesn't end with \n, last part is incomplete
                  if (!full.endsWith('\n')) {
                    pendingPartial = parts.pop()
                  } else {
                    pendingPartial = ''
                  }
                  const lines = parts.map(l => l.replace(/\r$/, '')).filter(l => l.length > 0)
                  if (lines.length > 0) {
                    onData({ eqpId, filePath, lines, timestamp: new Date().toISOString() })
                  }
                } else {
                  pendingPartial = ''  // no content, clear any pending
                }
                offset = parsed.offset
              } else {
                // === LEGACY MODE: existing extractNewLines logic ===
                const allLines = response.output.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.length > 0)
                const lastLineComplete = response.output.endsWith('\n') || response.output.endsWith('\r')
                const currentLines = (!lastLineComplete && allLines.length > 0)
                  ? allLines.slice(0, -1)
                  : allLines
                const newLines = extractNewLines(previousLines, currentLines)
                previousLines = currentLines
                if (newLines.length > 0) {
                  onData({
                    eqpId,
                    filePath,
                    lines: newLines,
                    timestamp: new Date().toISOString()
                  })
                }
              }
            } else {
              if (useOffsetMode !== true) previousLines = null
            }
          } else if (!response.success) {
            const errMsg = response.error || 'RPC tail failed'
            if (!basePathRetried && /no such file|not found|exit value: 1/i.test(errMsg)) {
              basePathRetried = true
              try {
                const newBasePath = await _detectBasePath(eqpId)
                if (newBasePath && newBasePath !== currentBasePath) {
                  currentBasePath = newBasePath
                  onData({ eqpId, filePath, info: `basePath updated to ${newBasePath}, retrying...` })
                  continue
                }
              } catch (detectErr) {
                log.warn(`tailLogStream: basePath detect failed for ${eqpId}: ${detectErr.message}`)
              }
            }
            onData({ eqpId, filePath, error: errMsg })
          }
        } catch (err) {
          disconnectRpc()  // connection broken, will reconnect next cycle
          log.warn(`tailLogStream: RPC poll error for ${eqpId} (${filePath}): ${err.message}`)
          onData({ eqpId, filePath, error: err.message })
        }

        if (!signal.aborted) {
          await _sleep(LOG_TAIL_INTERVAL)
        }
      }
    } finally {
      disconnectRpc()
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
  tailLogStream,
  extractNewLines,
  parseOffsetHeader,
  isRotationSignal,
  _setDeps
}
