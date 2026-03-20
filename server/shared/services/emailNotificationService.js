/**
 * Email Notification Service — transport-abstracted email sending
 *
 * 호출자는 sendEmailTo(to, title, contents)만 사용.
 * Transport 전환 시 이 파일만 수정 (_sendViaRedis → _sendViaHttp).
 */

const { getRedisClient, isRedisAvailable } = require('../db/redisConnection')
const { createLogger } = require('../logger')
const log = createLogger('email')

// --- DI for testing ---
let _getRedisClient = getRedisClient
let _isRedisAvailable = isRedisAvailable

function _setDeps(deps) {
  if (deps.getRedisClient) _getRedisClient = deps.getRedisClient
  if (deps.isRedisAvailable) _isRedisAvailable = deps.isRedisAvailable
}

// --- Transport: Redis PUBLISH (Phase 1) ---
async function _sendViaRedis(to, title, contents) {
  if (!_isRedisAvailable()) {
    log.warn('Redis not available — cannot send email')
    return { sent: false, error: 'Redis not available' }
  }
  const redis = _getRedisClient()
  const channel = `SendEmailTo-${to}`
  const message = `${title}:${contents}`
  const subscribers = await redis.publish(channel, message)
  if (subscribers === 0) {
    log.warn(`No subscribers on channel ${channel} — email not delivered`)
  }
  return { sent: subscribers > 0, subscribers }
}

// TODO [Phase 2] HTTP transport — EmailingAgent HTTP endpoint 전환 시 활성화
// async function _sendViaHttp(to, title, contents) {
//   const url = process.env.EMAILING_AGENT_URL
//   const response = await fetch(`${url}/send`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ to, title, contents })
//   })
//   return { sent: response.ok, status: response.status }
// }
// 전환: sendEmailTo() 내 _sendViaRedis → _sendViaHttp, .env에 EMAILING_AGENT_URL 추가

// --- Public interface ---
async function sendEmailTo(to, title, contents) {
  if (!to) return { sent: false, error: 'No recipient email' }
  try {
    return await _sendViaRedis(to, title, contents)
  } catch (err) {
    log.error(`Failed to send email to ${to}: ${err.message}`)
    return { sent: false, error: err.message }
  }
}

module.exports = { sendEmailTo, _setDeps }
