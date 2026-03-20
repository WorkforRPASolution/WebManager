/**
 * EARS InterfaceServer HTTP Client Service
 *
 * EARS InterfaceServer와 HTTP 통신하여 사용자 검색 등을 수행.
 * Environment: EARS_INTERFACE_URL
 */

const { createLogger } = require('../logger')
const log = createLogger('ears')

// --- DI for testing ---
let _fetch = globalThis.fetch

function _setDeps(deps) {
  if (deps.fetch) _fetch = deps.fetch
}

const TIMEOUT_MS = 10_000

/**
 * EARS InterfaceServer에서 사용자 검색
 * @param {string} name - 검색할 사용자 이름
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
async function searchUsers(name) {
  const baseUrl = process.env.EARS_INTERFACE_URL
  if (!baseUrl) {
    return { success: false, error: 'EARS_INTERFACE_URL is not configured' }
  }

  if (!name) {
    return { success: false, error: 'name is required' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await _fetch(`${baseUrl}/EARS/Interface`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'category': 'sso',
        'function': 'getusers'
      },
      body: JSON.stringify({ Name: name }),
      signal: controller.signal
    })

    if (!response.ok) {
      log.warn(`EARS searchUsers failed: ${response.status} ${response.statusText}`)
      return { success: false, error: `EARS responded with ${response.status} ${response.statusText}` }
    }

    const raw = await response.json()
    const items = Array.isArray(raw) ? raw : (raw.employee || [])
    const data = items.map(item => ({
      cn: item.Cn,
      employeeNumber: item.Employeenumber,
      department: item.Department,
      mail: item.Mail
    }))

    return { success: true, data }
  } catch (err) {
    log.warn(`EARS searchUsers error: ${err.message}`)
    return { success: false, error: err.message }
  } finally {
    clearTimeout(timeout)
  }
}

module.exports = { searchUsers, _setDeps }
