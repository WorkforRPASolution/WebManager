// Source defaults for each update source type. The DB only stores the active
// type's fields, so the modal needs these defaults to render empty inputs when
// switching types. Kept here (single source) so paste/import paths stay in
// sync with the modal.
export const SOURCE_DEFAULTS = {
  local: { localPath: '' },
  ftp:   { ftpHost: '', ftpPort: 21, ftpUser: '', ftpPass: '', ftpBasePath: '' },
  minio: { minioEndpoint: '', minioPort: 9000, minioBucket: '',
           minioAccessKey: '', minioSecretKey: '', minioUseSSL: false, minioBasePath: '' }
}

export function makeDefaultSource(type = 'local') {
  const t = SOURCE_DEFAULTS[type] ? type : 'local'
  return { type: t, ...SOURCE_DEFAULTS[t] }
}

export function filterProfilesByClientOs(profiles, clientOsVersions) {
  if (!clientOsVersions.length) return profiles
  return profiles.filter(p => !p.osVer || clientOsVersions.includes(p.osVer))
}

export function createTaskSnapshot(task) {
  return {
    type: task.type, name: task.name,
    sourcePath: task.sourcePath || '', targetPath: task.targetPath || '',
    description: task.description || '', stopOnFail: !!task.stopOnFail,
    commandLine: task.commandLine || '', _argsText: task._argsText || '',
    timeout: task.timeout || 30
  }
}

export function createProfileSnapshot(profile) {
  return {
    name: profile.name, osVer: profile.osVer, version: profile.version,
    tasks: profile.tasks.map(t => createTaskSnapshot(t)),
    source: { ...profile.source }
  }
}

export function generateUniqueName(baseName, existingNames) {
  let candidate = `${baseName} (copy)`
  if (!existingNames.includes(candidate)) return candidate
  let n = 2
  while (existingNames.includes(`${baseName} (copy ${n})`)) n++
  return `${baseName} (copy ${n})`
}

export function createTaskFromSnapshot(snapshot, existingNames, getNextKey) {
  return {
    _key: getNextKey(), taskId: null,
    type: snapshot.type,
    name: existingNames.length > 0
      ? generateUniqueName(snapshot.name, existingNames) : snapshot.name,
    sourcePath: snapshot.sourcePath, targetPath: snapshot.targetPath,
    description: snapshot.description, stopOnFail: snapshot.stopOnFail,
    commandLine: snapshot.commandLine, _argsText: snapshot._argsText,
    timeout: snapshot.timeout,
    _nameError: null, _sourcePathError: null,
    _targetPathError: null, _commandLineError: null
  }
}

/**
 * Returns true if another profile in the list shares (name, osVer, version)
 * with `profile`. Self-exclusion uses `_key` identity.
 *
 * Mirrors the server-side unique constraint on (agentGroup, name, osVer, version)
 * so the UI catches the collision before a 409 round-trip.
 */
export function hasProfileDuplicate(profile, profiles) {
  const myName = (profile.name || '').trim()
  if (!myName) return false
  const myOsVer = (profile.osVer || '').trim()
  const myVersion = (profile.version || '').trim()
  return profiles.some(p =>
    p._key !== profile._key
    && (p.name || '').trim() === myName
    && (p.osVer || '').trim() === myOsVer
    && (p.version || '').trim() === myVersion
  )
}

export function createProfileFromSnapshot(snapshot, existingNames, getNextKey) {
  const hasSource = !!snapshot.source
  return {
    _key: getNextKey(), profileId: null,
    _dirty: true,          // pasted profiles start dirty — user clicks Save Profile to POST
    _saveError: null,
    name: generateUniqueName(snapshot.name, existingNames),
    osVer: snapshot.osVer, version: snapshot.version, _nameError: null,
    tasks: snapshot.tasks.map(t => createTaskFromSnapshot(t, [], getNextKey)),
    source: hasSource ? { ...snapshot.source } : makeDefaultSource('local'),
    _sourceError: hasSource ? null : 'Source needs to be configured before save'
  }
}

// ─── Clipboard serialization ────────────────────────────────────────────────
//
// Profile copy/paste also writes to the OS clipboard so users can move
// profiles between sessions / WebManager instances. The serialized form drops
// `source` entirely because it carries credentials (ftpPass, minioSecretKey,
// ...). Pasting from the OS clipboard fills source with makeDefaultSource()
// and a `_sourceError` flag so the user is forced to re-enter credentials.
//
// Tasks have no credential fields, so their snapshot is wrapped as-is.
//
// IMPORTANT: if the task schema ever grows credential-bearing fields (e.g.
// per-task auth), serializeTaskForClipboard MUST sanitize them. Profile-level
// "delete source" auto-protects future fields under source; tasks have no
// such umbrella.

const CLIPBOARD_KIND = 'webmanager.update-profile'
const CLIPBOARD_SCHEMA = 1

function ownProp(obj, key) {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, key)
}

export function serializeProfileForClipboard(profile) {
  const snap = createProfileSnapshot(profile)
  delete snap.source
  return JSON.stringify({
    kind: CLIPBOARD_KIND,
    schemaVersion: CLIPBOARD_SCHEMA,
    type: 'profile',
    data: snap
  })
}

export function parseProfileFromClipboard(text) {
  if (typeof text !== 'string' || !text) return null
  let parsed
  try { parsed = JSON.parse(text) } catch { return null }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (!ownProp(parsed, 'kind') || parsed.kind !== CLIPBOARD_KIND) return null
  if (!ownProp(parsed, 'schemaVersion') || parsed.schemaVersion !== CLIPBOARD_SCHEMA) return null
  if (!ownProp(parsed, 'type') || parsed.type !== 'profile') return null
  if (!ownProp(parsed, 'data') || !parsed.data || typeof parsed.data !== 'object') return null
  if (!Array.isArray(parsed.data.tasks)) return null
  return parsed.data
}

export function serializeTaskForClipboard(task) {
  const snap = createTaskSnapshot(task)
  return JSON.stringify({
    kind: CLIPBOARD_KIND,
    schemaVersion: CLIPBOARD_SCHEMA,
    type: 'task',
    data: snap
  })
}

export function parseTaskFromClipboard(text) {
  if (typeof text !== 'string' || !text) return null
  let parsed
  try { parsed = JSON.parse(text) } catch { return null }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (!ownProp(parsed, 'kind') || parsed.kind !== CLIPBOARD_KIND) return null
  if (!ownProp(parsed, 'schemaVersion') || parsed.schemaVersion !== CLIPBOARD_SCHEMA) return null
  if (!ownProp(parsed, 'type') || parsed.type !== 'task') return null
  if (!ownProp(parsed, 'data') || !parsed.data || typeof parsed.data !== 'object') return null
  return parsed.data
}
