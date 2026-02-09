/**
 * Config Settings Service - CRUD and initialization
 */

const ConfigSettings = require('./configSettingsModel')

/**
 * Initialize config settings collection and indexes
 */
async function initializeConfigSettings() {
  // Ensure collection and indexes exist (model registration handles this)
  await ConfigSettings.createIndexes()
  console.log('  + CONFIG_SETTINGS collection ready')
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
  const filesWithIds = configFiles.map((f, i) => ({
    fileId: f.fileId || `config_${i + 1}`,
    name: f.name.trim(),
    path: f.path.trim()
  }))

  return ConfigSettings.findOneAndUpdate(
    { agentGroup },
    { $set: { configFiles: filesWithIds, updatedBy } },
    { new: true, upsert: true }
  ).lean()
}

module.exports = {
  initializeConfigSettings,
  getByAgentGroup,
  getDocument,
  saveConfigSettings
}
