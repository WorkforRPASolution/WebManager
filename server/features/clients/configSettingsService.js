/**
 * Config Settings Service - CRUD and initialization
 */

const ConfigSettings = require('./configSettingsModel')
const { createAuditLog, calculateChanges } = require('../../shared/models/webmanagerLogModel')
const { createLogger } = require('../../shared/logger')
const log = createLogger('clients')

/**
 * Initialize config settings collection and indexes
 */
async function initializeConfigSettings() {
  // Ensure collection and indexes exist (model registration handles this)
  await ConfigSettings.createIndexes()
  log.info('  + CONFIG_SETTINGS collection ready')
}

/**
 * Get config files for an agentGroup
 * Returns empty array if not found in DB
 */
async function getByAgentGroup(agentGroup) {
  if (agentGroup) {
    const doc = await ConfigSettings.findOne({ agentGroup }).lean()
    if (doc) return doc.configFiles
  }
  return []
}

/**
 * Get full settings document for management UI
 */
async function getDocument(agentGroup) {
  return ConfigSettings.findOne({ agentGroup }).lean()
}

/**
 * Save config settings for an agentGroup (upsert)
 */
async function saveConfigSettings(agentGroup, configFiles, updatedBy = 'system') {
  // Get previous state for audit
  const previousDoc = await ConfigSettings.findOne({ agentGroup }).lean()

  const filesWithIds = configFiles.map((f, i) => ({
    fileId: f.fileId || `config_${i + 1}`,
    name: f.name.trim(),
    path: f.path.trim()
  }))

  const result = await ConfigSettings.findOneAndUpdate(
    { agentGroup },
    { $set: { configFiles: filesWithIds, updatedBy } },
    { returnDocument: 'after', upsert: true }
  ).lean()

  // Audit logging (fire-and-forget)
  const changes = calculateChanges(
    { configFiles: previousDoc?.configFiles || [] },
    { configFiles: filesWithIds }
  )
  if (Object.keys(changes).length > 0) {
    createAuditLog({
      collectionName: 'CONFIG_SETTINGS',
      documentId: agentGroup,
      action: 'update',
      changes,
      userId: updatedBy
    }).catch(err => log.error(`Audit log failed: ${err.message}`))
  }

  return result
}

module.exports = {
  initializeConfigSettings,
  getByAgentGroup,
  getDocument,
  saveConfigSettings
}
