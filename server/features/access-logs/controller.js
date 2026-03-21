/**
 * Access Logs Controller
 * Receives page access logs from frontend in batches
 */

const { WebManagerLog, getExpireAt } = require('../../shared/models/webmanagerLogModel')
const { verifyToken } = require('../../shared/utils/jwt')
const { createLogger } = require('../../shared/logger')
const log = createLogger('audit')

/**
 * POST /api/access-logs
 * Batch collect access logs from frontend
 * Body: { logs: [...], token?: string }
 * - token: sendBeacon 폴백 (Authorization 헤더 불가 시)
 */
async function collectAccessLogs(req, res) {
  const { logs, token: bodyToken } = req.body

  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ error: 'logs array is required' })
  }

  // sendBeacon 폴백: body.token으로 사용자 식별
  let user = req.user
  if (!user && bodyToken) {
    const decoded = verifyToken(bodyToken)
    if (decoded) user = decoded
  }

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  // Limit batch size to prevent abuse
  const maxBatch = 50
  const batch = logs.slice(0, maxBatch)

  const userId = user.singleid || user.id || 'system'
  const expireAt = getExpireAt('access')

  const MAX_STR_LEN = 500
  const MAX_DURATION = 86400000 // 24h

  const documents = batch.map(entry => ({
    category: 'access',
    userId,
    pagePath: String(entry.pagePath || '').slice(0, MAX_STR_LEN),
    pageName: String(entry.pageName || '').slice(0, MAX_STR_LEN),
    enterTime: entry.enterTime ? new Date(entry.enterTime) : null,
    leaveTime: entry.leaveTime ? new Date(entry.leaveTime) : null,
    durationMs: Math.max(0, Math.min(Number(entry.durationMs) || 0, MAX_DURATION)),
    timestamp: entry.enterTime ? new Date(entry.enterTime) : new Date(),
    expireAt
  }))

  try {
    await WebManagerLog.insertMany(documents, { ordered: false })
  } catch (err) {
    log.error(`Access log batch insert failed: ${err.message}`)
  }

  res.json({ received: batch.length })
}

module.exports = { collectAccessLogs }
