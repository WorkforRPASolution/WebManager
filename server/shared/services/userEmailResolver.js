/**
 * User Email Resolver — email lookup abstraction
 *
 * 호출자는 resolveEmail(singleid)만 사용.
 * Phase 2 전환 시 이 파일만 수정 (_resolveFromDB → _resolveFromEARS).
 */

const { User } = require('../../features/users/model')

// --- DI for testing ---
let _User = User

function _setDeps(deps) {
  if (deps.User) _User = deps.User
}

// --- Source: DB direct lookup (Phase 1) ---
async function _resolveFromDB(singleid) {
  const user = await _User.findOne({ singleid }).select('email').lean()
  return user?.email || null
}

// TODO [Phase 2] EARSInterfaceServer HTTP POST 조회로 전환
// async function _resolveFromEARS(singleid) {
//   const url = process.env.EARS_INTERFACE_URL
//   const response = await fetch(`${url}/api/user/email`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ singleid })
//   })
//   if (!response.ok) return null
//   const data = await response.json()
//   return data.email || null
// }
// 전환: resolveEmail() 내 _resolveFromDB → _resolveFromEARS, .env에 EARS_INTERFACE_URL 추가

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
