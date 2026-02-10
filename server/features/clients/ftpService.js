const ftp = require('basic-ftp')
const { Readable, Writable } = require('stream')
const { createConnection, createSocksConnection } = require('../../shared/utils/socksHelper')
const { parsePasvResponse } = require('basic-ftp/dist/transfer')
const Client = require('./model')
const configSettingsService = require('./configSettingsService')

const FTP_PORT = parseInt(process.env.FTP_PORT) || 21
const FTP_USER = process.env.FTP_USER || 'ftpuser'
const FTP_PASS = process.env.FTP_PASS || 'ftppassword'
const FTP_TIMEOUT = parseInt(process.env.FTP_TIMEOUT) || 30000

/**
 * Get config file settings for an agentGroup
 * Reads from DB first, falls back to .env
 * @param {string} [agentGroup] - Agent group identifier
 * @returns {Promise<Array<{fileId: string, name: string, path: string}>>}
 */
async function getConfigSettings(agentGroup) {
  return configSettingsService.getByAgentGroup(agentGroup)
}

/**
 * Get client IP info from DB
 */
async function getClientIpInfo(eqpId) {
  const client = await Client.findOne({ eqpId }).select('ipAddr ipAddrL eqpModel agentPorts').lean()
  if (!client) {
    throw new Error(`Client not found: ${eqpId}`)
  }
  return {
    ipAddr: client.ipAddr,
    ipAddrL: client.ipAddrL || null,
    eqpModel: client.eqpModel,
    agentPorts: client.agentPorts || null
  }
}

/**
 * Connect to FTP server on a client machine
 * Uses direct connection or SOCKS tunnel depending on ipAddrL
 * @param {string} eqpId - Equipment ID
 * @returns {Promise<{client: ftp.Client, ipInfo: object}>}
 */
async function connectFtp(eqpId) {
  const ipInfo = await getClientIpInfo(eqpId)
  const ftpClient = new ftp.Client(FTP_TIMEOUT)

  // Resolve per-client ports with defaults
  const ftpPort = ipInfo.agentPorts?.ftp || FTP_PORT
  const socksPort = ipInfo.agentPorts?.socks || null
  const ftpHost = ipInfo.ipAddrL || ipInfo.ipAddr

  if (ipInfo.ipAddrL) {
    // SOCKS tunnel: create tunnel socket first, then use it for FTP
    const tunnelSocket = await createConnection(ipInfo.ipAddr, ipInfo.ipAddrL, ftpPort, socksPort)

    // Inject the tunnel socket into basic-ftp
    // basic-ftp uses ftp.socket internally for the control connection
    ftpClient.ftp.socket = tunnelSocket
    ftpClient.ftp.dataSocket = undefined

    // Manually trigger the greeting handling
    await ftpClient.ftp.handle(undefined, (res, task) => {
      if (res instanceof Error) {
        task.reject(res)
      } else if (res.code === 220) {
        task.resolve(res)
      }
    })

    // Login after establishing connection
    await ftpClient.login(FTP_USER, FTP_PASS)
    // Override prepareTransfer to route PASV data connections through SOCKS tunnel
    ftpClient.prepareTransfer = async (ftp) => {
      const res = await ftp.request('PASV')
      const target = parsePasvResponse(res.message)
      if (!target) throw new Error("Can't parse PASV response: " + res.message)
      const dataSocket = await createSocksConnection(
        ipInfo.ipAddr,
        ipInfo.ipAddrL,
        target.port,
        socksPort
      )
      ftp.dataSocket = dataSocket
      return res
    }
  } else {
    // Direct connection
    await ftpClient.access({
      host: ftpHost,
      port: ftpPort,
      user: FTP_USER,
      password: FTP_PASS,
      secure: false
    })
  }

  return { client: ftpClient, ipInfo }
}

/**
 * Read a config file content via FTP
 * @param {string} eqpId - Equipment ID
 * @param {string} remotePath - Remote file path
 * @returns {Promise<string>} File content
 */
async function readConfigFile(eqpId, remotePath) {
  const { client: ftpClient } = await connectFtp(eqpId)

  try {
    const chunks = []
    const writable = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk)
        callback()
      }
    })

    await ftpClient.downloadTo(writable, remotePath)
    return Buffer.concat(chunks).toString('utf-8')
  } finally {
    ftpClient.close()
  }
}

/**
 * Write content to a config file via FTP
 * @param {string} eqpId - Equipment ID
 * @param {string} remotePath - Remote file path
 * @param {string} content - File content to write
 */
async function writeConfigFile(eqpId, remotePath, content) {
  const { client: ftpClient } = await connectFtp(eqpId)

  try {
    const readable = Readable.from(Buffer.from(content, 'utf-8'))
    await ftpClient.uploadFrom(readable, remotePath)
  } finally {
    ftpClient.close()
  }
}

/**
 * Read all config files for a client
 * @param {string} eqpId - Equipment ID
 * @returns {Promise<Array<{fileId: string, name: string, path: string, content: string|null, error: string|null}>>}
 */
async function readAllConfigs(eqpId, agentGroup) {
  const configs = await getConfigSettings(agentGroup)
  const { client: ftpClient } = await connectFtp(eqpId)

  try {
    const results = []

    for (const config of configs) {
      try {
        const chunks = []
        const writable = new Writable({
          write(chunk, encoding, callback) {
            chunks.push(chunk)
            callback()
          }
        })

        await ftpClient.downloadTo(writable, config.path)
        const content = Buffer.concat(chunks).toString('utf-8')

        results.push({
          fileId: config.fileId,
          name: config.name,
          path: config.path,
          content,
          error: null
        })
      } catch (err) {
        const isNotFound = err.code === 550 || err.message?.includes('No such file')
        if (isNotFound) {
          results.push({
            fileId: config.fileId,
            name: config.name,
            path: config.path,
            content: '',
            error: null,
            missing: true
          })
        } else {
          results.push({
            fileId: config.fileId,
            name: config.name,
            path: config.path,
            content: null,
            error: err.message
          })
        }
      }
    }

    return results
  } finally {
    ftpClient.close()
  }
}

/**
 * Deploy config to multiple clients with progress callback
 * @param {string} content - Config content to deploy
 * @param {string[]} targetEqpIds - Target client IDs
 * @param {string} remotePath - Remote file path
 * @param {function} onProgress - Progress callback ({completed, total, current, status, error})
 * @param {number} concurrency - Max concurrent deployments
 */
async function deployConfig(content, targetEqpIds, remotePath, onProgress, concurrency = 5) {
  const total = targetEqpIds.length
  let completed = 0

  // Simple promise pool for concurrency control
  const pool = []
  const results = []

  for (const eqpId of targetEqpIds) {
    const task = (async () => {
      try {
        await writeConfigFile(eqpId, remotePath, content)
        completed++
        results.push({ eqpId, success: true })
        if (onProgress) {
          onProgress({ completed, total, current: eqpId, status: 'success', error: null })
        }
      } catch (err) {
        completed++
        results.push({ eqpId, success: false, error: err.message })
        if (onProgress) {
          onProgress({ completed, total, current: eqpId, status: 'error', error: err.message })
        }
      }
    })()

    pool.push(task)

    // Wait when pool reaches concurrency limit
    if (pool.length >= concurrency) {
      await Promise.race(pool)
      // Remove settled promises
      for (let i = pool.length - 1; i >= 0; i--) {
        const settled = await Promise.race([pool[i].then(() => true), Promise.resolve(false)])
        if (settled) pool.splice(i, 1)
      }
    }
  }

  // Wait for remaining tasks
  await Promise.all(pool)

  return results
}

/**
 * Deploy config with selective JSON merge
 * @param {object} sourceConfig - Source config JSON object
 * @param {string[]} selectedKeys - Top-level keys to merge (dot notation for nested)
 * @param {string[]} targetEqpIds - Target client IDs
 * @param {string} remotePath - Remote file path
 * @param {function} onProgress - Progress callback
 * @param {number} concurrency - Max concurrent deployments
 */
async function deployConfigSelective(sourceConfig, selectedKeys, targetEqpIds, remotePath, onProgress, concurrency = 5) {
  const total = targetEqpIds.length
  let completed = 0
  const results = []
  const pool = []

  for (const eqpId of targetEqpIds) {
    const task = (async () => {
      try {
        // Read target's current config
        const currentContent = await readConfigFile(eqpId, remotePath)
        const currentConfig = JSON.parse(currentContent)

        // Merge selected keys from source into target
        const merged = mergeSelectedKeys(currentConfig, sourceConfig, selectedKeys)
        const newContent = JSON.stringify(merged, null, 2)

        // Write merged config
        await writeConfigFile(eqpId, remotePath, newContent)

        completed++
        results.push({ eqpId, success: true })
        if (onProgress) {
          onProgress({ completed, total, current: eqpId, status: 'success', error: null })
        }
      } catch (err) {
        completed++
        results.push({ eqpId, success: false, error: err.message })
        if (onProgress) {
          onProgress({ completed, total, current: eqpId, status: 'error', error: err.message })
        }
      }
    })()

    pool.push(task)

    if (pool.length >= concurrency) {
      await Promise.race(pool)
      for (let i = pool.length - 1; i >= 0; i--) {
        const settled = await Promise.race([pool[i].then(() => true), Promise.resolve(false)])
        if (settled) pool.splice(i, 1)
      }
    }
  }

  await Promise.all(pool)
  return results
}

/**
 * Merge selected keys from source into target (deep merge)
 * Array elements selected by index are union-merged (values added, not replaced by position).
 * Selecting the array key itself replaces the entire array.
 * @param {object} target - Target config
 * @param {object} source - Source config
 * @param {string[]} keys - Dot-notation keys to merge (e.g. ['database', 'server.port', 'processes.2'])
 * @returns {object} Merged config
 */
function mergeSelectedKeys(target, source, keys) {
  const result = JSON.parse(JSON.stringify(target))

  // Separate array element keys from regular keys
  // Array element keys: parent is an array in source and last segment is numeric index
  const arrayUnions = new Map() // parentPath -> [source values]
  const regularKeys = []

  for (const key of keys) {
    const parts = key.split('.')
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1]
      const index = parseInt(lastPart)
      if (!isNaN(index)) {
        // Check if parent in source is actually an array
        let parent = source
        for (let i = 0; i < parts.length - 1; i++) {
          if (parent && typeof parent === 'object' && parts[i] in parent) {
            parent = parent[parts[i]]
          } else {
            parent = null
            break
          }
        }
        if (parent && Array.isArray(parent) && index < parent.length) {
          const parentPath = parts.slice(0, -1).join('.')
          if (!arrayUnions.has(parentPath)) {
            arrayUnions.set(parentPath, [])
          }
          arrayUnions.get(parentPath).push(parent[index])
          continue
        }
      }
    }
    regularKeys.push(key)
  }

  // Process regular keys (object properties, whole arrays)
  for (const key of regularKeys) {
    const parts = key.split('.')
    let srcVal = source
    let valid = true

    for (const part of parts) {
      if (srcVal && typeof srcVal === 'object' && part in srcVal) {
        srcVal = srcVal[part]
      } else {
        valid = false
        break
      }
    }

    if (!valid) continue

    // Set the value at the key path in result
    let ref = result
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in ref) || typeof ref[parts[i]] !== 'object') {
        ref[parts[i]] = {}
      }
      ref = ref[parts[i]]
    }

    const lastKey = parts[parts.length - 1]
    if (typeof srcVal === 'object' && srcVal !== null && !Array.isArray(srcVal) &&
        typeof ref[lastKey] === 'object' && ref[lastKey] !== null && !Array.isArray(ref[lastKey])) {
      // Deep merge objects
      ref[lastKey] = deepMerge(ref[lastKey], srcVal)
    } else {
      ref[lastKey] = JSON.parse(JSON.stringify(srcVal))
    }
  }

  // Process array union merges: add selected source values to target array
  for (const [parentPath, sourceValues] of arrayUnions) {
    const parts = parentPath.split('.')
    let ref = result
    for (const part of parts) {
      if (ref && typeof ref === 'object' && part in ref) {
        ref = ref[part]
      } else {
        ref = null
        break
      }
    }

    if (ref && Array.isArray(ref)) {
      // Union: add source values not already present in target
      for (const val of sourceValues) {
        const valStr = JSON.stringify(val)
        if (!ref.some(v => JSON.stringify(v) === valStr)) {
          ref.push(JSON.parse(JSON.stringify(val)))
        }
      }
    } else {
      // Target doesn't have this array yet — create it
      let parent = result
      for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in parent) || typeof parent[parts[i]] !== 'object') {
          parent[parts[i]] = {}
        }
        parent = parent[parts[i]]
      }
      parent[parts[parts.length - 1]] = sourceValues.map(v => JSON.parse(JSON.stringify(v)))
    }
  }

  return result
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const result = { ...target }
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key]) &&
        typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], source[key])
    } else {
      result[key] = JSON.parse(JSON.stringify(source[key]))
    }
  }
  return result
}

module.exports = {
  getConfigSettings,
  connectFtp,
  readConfigFile,
  writeConfigFile,
  readAllConfigs,
  deployConfig,
  deployConfigSelective,
  mergeSelectedKeys
}
