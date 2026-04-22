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

export function createProfileFromSnapshot(snapshot, existingNames, getNextKey) {
  return {
    _key: getNextKey(), profileId: null,
    _dirty: true,          // pasted profiles start dirty — user clicks Save Profile to POST
    _saveError: null,
    name: generateUniqueName(snapshot.name, existingNames),
    osVer: snapshot.osVer, version: snapshot.version, _nameError: null,
    tasks: snapshot.tasks.map(t => createTaskFromSnapshot(t, [], getNextKey)),
    source: { ...snapshot.source }
  }
}
