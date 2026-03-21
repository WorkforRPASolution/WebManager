/**
 * Log Settings Service - CRUD and initialization
 */

const LogSettings = require('./logSettingsModel')
const { createAuditLog, calculateChanges } = require('../../shared/models/webmanagerLogModel')
const { createLogger } = require('../../shared/logger')
const log = createLogger('clients')

const DEFAULT_LOG_SETTINGS = [
  {
    agentGroup: 'ars_agent',
    logSources: [
      { sourceId: 'log_1', name: 'Agent Log', path: 'log/ARSAgent', keyword: 'arsagent' }
    ]
  },
  {
    agentGroup: 'resource_agent',
    logSources: [
      { sourceId: 'log_1', name: 'Agent Log', path: 'log/ResourceAgent', keyword: 'resourceagent' }
    ]
  }
]

/**
 * Initialize log settings collection with defaults
 */
async function initializeLogSettings() {
  await LogSettings.createIndexes()

  for (const defaults of DEFAULT_LOG_SETTINGS) {
    await LogSettings.findOneAndUpdate(
      { agentGroup: defaults.agentGroup },
      { $setOnInsert: { logSources: defaults.logSources, updatedBy: 'system' } },
      { upsert: true }
    )
  }

  log.info('  + LOG_SETTINGS collection ready')
}

/**
 * Get log sources for an agentGroup
 * Returns empty array if not found
 */
async function getByAgentGroup(agentGroup) {
  if (agentGroup) {
    const doc = await LogSettings.findOne({ agentGroup }).lean()
    if (doc) return doc.logSources
  }
  return []
}

/**
 * Get full settings document for management UI
 */
async function getDocument(agentGroup) {
  return LogSettings.findOne({ agentGroup }).lean()
}

/**
 * Save log settings for an agentGroup (upsert)
 */
async function saveLogSettings(agentGroup, logSources, updatedBy = 'system') {
  // Get previous state for audit
  const previousDoc = await LogSettings.findOne({ agentGroup }).lean()

  const sourcesWithIds = logSources.map((s, i) => ({
    sourceId: s.sourceId || `log_${i + 1}`,
    name: s.name.trim(),
    path: s.path.trim(),
    keyword: s.keyword.trim(),
    encoding: (s.encoding || 'utf-8').trim().toLowerCase()
  }))

  const result = await LogSettings.findOneAndUpdate(
    { agentGroup },
    { $set: { logSources: sourcesWithIds, updatedBy } },
    { returnDocument: 'after', upsert: true }
  ).lean()

  // Audit logging (fire-and-forget)
  const changes = calculateChanges(
    { logSources: previousDoc?.logSources || [] },
    { logSources: sourcesWithIds }
  )
  if (Object.keys(changes).length > 0) {
    createAuditLog({
      collectionName: 'LOG_SETTINGS',
      documentId: agentGroup,
      action: 'update',
      changes,
      userId: updatedBy
    }).catch(err => log.error(`Audit log failed: ${err.message}`))
  }

  return result
}

module.exports = {
  initializeLogSettings,
  getByAgentGroup,
  getDocument,
  saveLogSettings
}
