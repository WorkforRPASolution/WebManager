/**
 * Log Settings Service - CRUD and initialization
 */

const LogSettings = require('./logSettingsModel')

const DEFAULT_LOG_SETTINGS = [
  {
    agentGroup: 'ars_agent',
    logSources: [
      { sourceId: 'log_1', name: 'Agent Log', path: '/log/ARSAgent', keyword: 'arsagent' }
    ]
  },
  {
    agentGroup: 'resource_agent',
    logSources: [
      { sourceId: 'log_1', name: 'Agent Log', path: '/log/Resource/Agent', keyword: 'resourceagent' }
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

  console.log('  + LOG_SETTINGS collection ready')
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
  const sourcesWithIds = logSources.map((s, i) => ({
    sourceId: s.sourceId || `log_${i + 1}`,
    name: s.name.trim(),
    path: s.path.trim(),
    keyword: s.keyword.trim()
  }))

  return LogSettings.findOneAndUpdate(
    { agentGroup },
    { $set: { logSources: sourcesWithIds, updatedBy } },
    { new: true, upsert: true }
  ).lean()
}

module.exports = {
  initializeLogSettings,
  getByAgentGroup,
  getDocument,
  saveLogSettings
}
