/**
 * Update Settings Service - CRUD and initialization
 */

const crypto = require('crypto')
let UpdateSettings = require('./updateSettingsModel')
const { createLogger } = require('../../shared/logger')
const log = createLogger('clients')

/** @internal Replace model for testing */
function _setModel(model) { UpdateSettings = model }

/**
 * Strip irrelevant source fields based on type.
 * Only stores fields for the active source type — no empty-string pollution.
 */
function sanitizeSource(source) {
  if (!source || !source.type) return { type: 'local' }
  const clean = { type: source.type }
  switch (source.type) {
    case 'local':
      clean.localPath = source.localPath || ''
      break
    case 'ftp':
      clean.ftpHost = source.ftpHost || ''
      clean.ftpPort = source.ftpPort ?? 21
      clean.ftpUser = source.ftpUser || ''
      clean.ftpPass = source.ftpPass || ''
      clean.ftpBasePath = source.ftpBasePath || ''
      break
    case 'minio':
      clean.minioEndpoint = source.minioEndpoint || ''
      clean.minioPort = source.minioPort ?? 9000
      clean.minioBucket = source.minioBucket || ''
      clean.minioAccessKey = source.minioAccessKey || ''
      clean.minioSecretKey = source.minioSecretKey || ''
      clean.minioUseSSL = source.minioUseSSL ?? false
      clean.minioBasePath = source.minioBasePath || ''
      break
  }
  return clean
}

function cleanProfiles(profiles) {
  return profiles.map(p => ({
    profileId: p.profileId || 'prof_' + crypto.randomUUID().split('-')[0],
    name: (p.name || '').trim(),
    osVer: (p.osVer || '').trim(),
    version: (p.version || '').trim(),
    tasks: (p.tasks || []).map(task => ({
      taskId: task.taskId || 'task_' + crypto.randomUUID().split('-')[0],
      type: task.type || 'copy',
      name: (task.name || '').trim(),
      sourcePath: (task.sourcePath || '').trim(),
      targetPath: (task.targetPath || '').trim(),
      description: (task.description || '').trim(),
      stopOnFail: !!task.stopOnFail,
      commandLine: (task.commandLine || '').trim(),
      ...(Array.isArray(task.args) ? { args: task.args } : {}),
      timeout: task.timeout || 30000
    })),
    source: sanitizeSource(p.source)
  }))
}

async function initializeUpdateSettings() {
  await UpdateSettings.createIndexes()

  // Migration: convert legacy documents (packages without profiles) to profile format
  const legacy = await UpdateSettings.find({
    packages: { $exists: true, $ne: [] },
    $or: [{ profiles: { $exists: false } }, { profiles: { $size: 0 } }]
  }).lean()

  for (const doc of legacy) {
    await UpdateSettings.updateOne(
      { _id: doc._id },
      {
        $set: {
          profiles: [{
            profileId: 'prof_default',
            name: 'Default',
            osVer: '',
            version: '',
            tasks: (doc.packages || []).map(pkg => ({
              taskId: (pkg.packageId || '').replace(/^pkg_/, 'task_'),
              type: 'copy',
              name: pkg.name,
              sourcePath: pkg.targetPath,
              targetPath: pkg.targetPath
            })),
            source: doc.source || {}
          }]
        },
        $unset: { packages: 1, source: 1 }
      }
    )
  }

  if (legacy.length) {
    log.info(`[UpdateSettings] Migrated ${legacy.length} legacy documents to profiles with tasks`)
  }

  // Migration B: convert profiles.packages[] → profiles.tasks[]
  const withPackages = await UpdateSettings.find({
    'profiles.packages': { $exists: true }
  }).lean()

  let migratedBCount = 0
  for (const doc of withPackages) {
    const hasPackages = doc.profiles.some(p => Array.isArray(p.packages) && p.packages.length > 0)
    if (!hasPackages) continue

    const migrated = doc.profiles.map(p => {
      if (!Array.isArray(p.packages) || p.packages.length === 0) return p
      const { packages, ...rest } = p
      return {
        ...rest,
        tasks: packages.map(pkg => ({
          taskId: (pkg.packageId || '').replace(/^pkg_/, 'task_'),
          type: 'copy',
          name: pkg.name,
          sourcePath: pkg.targetPath,
          targetPath: pkg.targetPath,
          ...(pkg.description ? { description: pkg.description } : {})
        }))
      }
    })
    await UpdateSettings.updateOne({ _id: doc._id }, { $set: { profiles: migrated } })
    migratedBCount++
  }
  if (migratedBCount) {
    log.info(`[UpdateSettings] Migration B: converted packages→tasks in ${migratedBCount} documents`)
  }

  // Clean source fields: strip irrelevant fields from existing profiles
  const allDocs = await UpdateSettings.find({ profiles: { $exists: true, $ne: [] } }).lean()
  let cleanedCount = 0
  for (const doc of allDocs) {
    const cleaned = doc.profiles.map(p => ({
      ...p,
      source: sanitizeSource(p.source)
    }))
    const needsUpdate = JSON.stringify(doc.profiles) !== JSON.stringify(cleaned)
    if (needsUpdate) {
      await UpdateSettings.updateOne({ _id: doc._id }, { $set: { profiles: cleaned } })
      cleanedCount++
    }
  }
  if (cleanedCount) {
    log.info(`[UpdateSettings] Cleaned source fields in ${cleanedCount} documents`)
  }

  log.info('  + UPDATE_SETTINGS collection ready')
}

async function getDocument(agentGroup) {
  return UpdateSettings.findOne({ agentGroup }).lean()
}

async function getProfile(agentGroup, profileId) {
  const doc = await UpdateSettings.findOne({ agentGroup }).lean()
  return (doc?.profiles || []).find(p => p.profileId === profileId) || null
}

async function saveUpdateSettings(agentGroup, profiles, updatedBy = 'system') {
  return UpdateSettings.findOneAndUpdate(
    { agentGroup },
    { $set: { profiles: cleanProfiles(profiles), updatedBy }, $unset: { packages: 1, source: 1 } },
    { new: true, upsert: true }
  ).lean()
}

module.exports = {
  initializeUpdateSettings,
  getDocument,
  getProfile,
  saveUpdateSettings,
  cleanProfiles,
  sanitizeSource,
  _setModel
}
