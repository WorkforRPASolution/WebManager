/**
 * User Email Resolver — email lookup abstraction
 *
 * 호출자는 resolveEmail(singleid)만 사용.
 * DB에서 사용자 이메일을 조회한다. EARS InterfaceServer는 이름 기반 검색만
 * 지원하므로 singleid→email 자동 조회에는 사용할 수 없다.
 * EARS 이름 검색은 earsService.searchUsers()로 별도 제공.
 */

const { User } = require('../../features/users/model')

// --- DI for testing ---
let _User = User

function _setDeps(deps) {
  if (deps.User) _User = deps.User
}

// --- Source: DB direct lookup ---
async function _resolveFromDB(singleid) {
  const user = await _User.findOne({ singleid }).select('email').lean()
  return user?.email || null
}

// --- Public interface ---
async function resolveEmail(singleid) {
  if (!singleid) return null
  try {
    return await _resolveFromDB(singleid)
  } catch (err) {
    console.error(`[UserEmailResolver] Failed to resolve email for ${singleid}:`, err.message)
    return null
  }
}

module.exports = { resolveEmail, _setDeps }
