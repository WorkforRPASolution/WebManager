/**
 * Update Settings Service - CRUD and initialization
 */

const UpdateSettings = require('./updateSettingsModel')

async function initializeUpdateSettings() {
  await UpdateSettings.createIndexes()
  console.log('  + UPDATE_SETTINGS collection ready')
}

async function getDocument(agentGroup) {
  return UpdateSettings.findOne({ agentGroup }).lean()
}

async function saveUpdateSettings(agentGroup, packages, source, updatedBy = 'system') {
  const packagesWithIds = packages.map((p, i) => ({
    packageId: p.packageId || `pkg_${i + 1}`,
    name: p.name.trim(),
    targetPath: p.targetPath.trim(),
    targetType: p.targetType || 'file',
    description: (p.description || '').trim()
  }))

  return UpdateSettings.findOneAndUpdate(
    { agentGroup },
    { $set: { packages: packagesWithIds, source, updatedBy } },
    { new: true, upsert: true }
  ).lean()
}

module.exports = {
  initializeUpdateSettings,
  getDocument,
  saveUpdateSettings
}
