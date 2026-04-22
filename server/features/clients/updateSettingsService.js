/**
 * Update Settings Service - per-profile CRUD
 *
 * 1 document = 1 profile in UPDATE_SETTINGS.
 * Composite key: (agentGroup, profileId).
 *
 * Legacy shape detection (profiles[] array per agentGroup) triggers boot abort —
 * run `npm run migrate:update-settings` before starting the server.
 */

const crypto = require('crypto')
let UpdateSettings = require('./updateSettingsModel')
const { createAuditLog, calculateChanges } = require('../../shared/models/webmanagerLogModel')
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

/**
 * Normalize a single profile payload.
 * Auto-generates profileId and taskIds when missing. Trims strings. Sanitizes source.
 */
function cleanProfile(profile) {
  return {
    profileId: profile.profileId || 'prof_' + crypto.randomUUID().split('-')[0],
    name: (profile.name || '').trim(),
    osVer: (profile.osVer || '').trim(),
    version: (profile.version || '').trim(),
    tasks: (profile.tasks || []).map(task => ({
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
    source: sanitizeSource(profile.source)
  }
}

async function initializeUpdateSettings() {
  // Boot guard: abort if any legacy (profiles[]) documents remain.
  // Must run BEFORE createIndexes() because the legacy schema's unique
  // { agentGroup: 1 } index conflicts with the new compound index.
  // Post-rollout, both this guard and scripts/migrate-update-settings.js will be removed.
  const legacyCount = await UpdateSettings.countDocuments({ profiles: { $exists: true } })
  if (legacyCount > 0) {
    log.error(
      `UPDATE_SETTINGS contains ${legacyCount} legacy documents. ` +
      `Run: npm run migrate:update-settings`
    )
    throw new Error('UPDATE_SETTINGS migration required')
  }

  await UpdateSettings.createIndexes()
  log.info('  + UPDATE_SETTINGS collection ready')
}

async function listProfiles(agentGroup) {
  return UpdateSettings.find({ agentGroup }).lean()
}

async function getProfile(agentGroup, profileId) {
  return UpdateSettings.findOne({ agentGroup, profileId }).lean()
}

async function createProfile(agentGroup, data, updatedBy = 'system') {
  const cleaned = cleanProfile(data)
  const doc = await UpdateSettings.create({
    agentGroup,
    ...cleaned,
    updatedBy
  })
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc

  createAuditLog({
    collectionName: 'UPDATE_SETTINGS',
    documentId: `${agentGroup}:${plain.profileId}`,
    action: 'create',
    newData: plain,
    userId: updatedBy
  }).catch(err => log.error(`Audit log failed: ${err.message}`))

  return plain
}

async function updateProfile(agentGroup, profileId, data, updatedBy = 'system') {
  const previous = await UpdateSettings.findOne({ agentGroup, profileId }).lean()
  if (!previous) return null

  // profileId in payload is ignored — path param is authoritative.
  const cleaned = cleanProfile({ ...data, profileId })

  const result = await UpdateSettings.findOneAndUpdate(
    { agentGroup, profileId },
    { $set: { ...cleaned, updatedBy } },
    { returnDocument: 'after' }
  ).lean()

  const changes = calculateChanges(previous, result)
  if (Object.keys(changes).length > 0) {
    createAuditLog({
      collectionName: 'UPDATE_SETTINGS',
      documentId: `${agentGroup}:${profileId}`,
      action: 'update',
      changes,
      previousData: previous,
      newData: result,
      userId: updatedBy
    }).catch(err => log.error(`Audit log failed: ${err.message}`))
  }

  return result
}

async function deleteProfile(agentGroup, profileId, updatedBy = 'system') {
  const previous = await UpdateSettings.findOneAndDelete({ agentGroup, profileId }).lean()
  if (!previous) return null

  createAuditLog({
    collectionName: 'UPDATE_SETTINGS',
    documentId: `${agentGroup}:${profileId}`,
    action: 'delete',
    previousData: previous,
    userId: updatedBy
  }).catch(err => log.error(`Audit log failed: ${err.message}`))

  return previous
}

module.exports = {
  initializeUpdateSettings,
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  cleanProfile,
  sanitizeSource,
  _setModel
}
