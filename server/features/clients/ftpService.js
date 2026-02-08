const ftp = require('basic-ftp')
const { Readable, Writable } = require('stream')
const { createConnection } = require('../../shared/utils/socksHelper')
const Client = require('./model')

const FTP_PORT = parseInt(process.env.FTP_PORT) || 21
const FTP_USER = process.env.FTP_USER || 'ftpuser'
const FTP_PASS = process.env.FTP_PASS || 'ftppassword'
const FTP_TIMEOUT = parseInt(process.env.FTP_TIMEOUT) || 30000

/**
 * Load config file settings from environment variables
 * @returns {Array<{fileId: string, name: string, path: string}>}
 */
function getConfigSettings() {
  const configs = []
  for (let i = 1; i <= 4; i++) {
    const name = process.env[`CONFIG_FILE_${i}_NAME`]
    const path = process.env[`CONFIG_FILE_${i}_PATH`]
    if (name && path) {
      configs.push({ fileId: `config_${i}`, name, path })
    }
  }
  return configs
}

/**
 * Get client IP info from DB
 */
async function getClientIpInfo(eqpId) {
  const client = await Client.findOne({ eqpId }).select('ipAddr ipAddrL eqpModel').lean()
  if (!client) {
    throw new Error(`Client not found: ${eqpId}`)
  }
  return {
    ipAddr: client.ipAddr,
    ipAddrL: client.ipAddrL || null,
    eqpModel: client.eqpModel
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

  // Determine target host for FTP
  const ftpHost = ipInfo.ipAddrL || ipInfo.ipAddr

  if (ipInfo.ipAddrL) {
    // SOCKS tunnel: create tunnel socket first, then use it for FTP
    const tunnelSocket = await createConnection(ipInfo.ipAddr, ipInfo.ipAddrL, FTP_PORT)

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
    await ftpClient.usePasv()
  } else {
    // Direct connection
    await ftpClient.access({
      host: ftpHost,
      port: FTP_PORT,
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
async function readAllConfigs(eqpId) {
  const configs = getConfigSettings()
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
        results.push({
          fileId: config.fileId,
          name: config.name,
          path: config.path,
          content: null,
          error: err.message
        })
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
 * @param {object} target - Target config
 * @param {object} source - Source config
 * @param {string[]} keys - Dot-notation keys to merge (e.g. ['database', 'server.port'])
 * @returns {object} Merged config
 */
function mergeSelectedKeys(target, source, keys) {
  const result = JSON.parse(JSON.stringify(target))

  for (const key of keys) {
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
