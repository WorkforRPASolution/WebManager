/**
 * Config Settings Service - CRUD and initialization
 */

const ConfigSettings = require('./configSettingsModel')

/**
 * Initialize config settings from .env on first startup
 * Seeds ars_agent entry from CONFIG_FILE_* env vars
 */
async function initializeConfigSettings() {
  const count = await ConfigSettings.countDocuments()
  if (count === 0) {
    const configs = []
    for (let i = 1; i <= 20; i++) {
      const name = process.env[`CONFIG_FILE_${i}_NAME`]
      const path = process.env[`CONFIG_FILE_${i}_PATH`]
      if (name && path) {
        configs.push({ fileId: `config_${i}`, name, path })
      }
    }
    if (configs.length > 0) {
      await ConfigSettings.create({
        agentGroup: 'ars_agent',
        configFiles: configs,
        updatedBy: 'system'
      })
      console.log(`  + Seeded CONFIG_SETTINGS for ars_agent with ${configs.length} file(s)`)
    }
  }
}

/**
 * Get config files for an agentGroup
 * Falls back to .env if not found in DB
 */
async function getByAgentGroup(agentGroup) {
  if (agentGroup) {
    const doc = await ConfigSettings.findOne({ agentGroup }).lean()
    if (doc) return doc.configFiles
  }
  // Fallback to .env for backward compatibility
  const configs = []
  for (let i = 1; i <= 20; i++) {
    const name = process.env[`CONFIG_FILE_${i}_NAME`]
    const path = process.env[`CONFIG_FILE_${i}_PATH`]
    if (name && path) {
      configs.push({ fileId: `config_${i}`, name, path })
    }
  }
  return configs
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
