import { describe, it, expect, beforeEach } from 'vitest'
import {
  filterProfilesByClientOs,
  generateUniqueName,
  createTaskSnapshot,
  createProfileSnapshot,
  createTaskFromSnapshot,
  createProfileFromSnapshot
} from '../updateProfileUtils'

describe('filterProfilesByClientOs', () => {
  const profiles = [
    { profileId: 'p1', name: 'Win v2', osVer: 'Windows 10', version: '2.0' },
    { profileId: 'p2', name: 'Lin v2', osVer: 'Ubuntu 20.04', version: '2.0' },
    { profileId: 'p3', name: 'All OS', osVer: '', version: '1.0' },
  ]

  it('클라이언트 OS와 일치하는 프로필 + osVer 비어있는 프로필', () => {
    const result = filterProfilesByClientOs(profiles, ['Windows 10'])
    expect(result).toHaveLength(2) // p1 + p3
    expect(result.map(p => p.profileId)).toEqual(['p1', 'p3'])
  })

  it('여러 OS의 클라이언트 → 해당 OS 프로필 모두 포함', () => {
    const result = filterProfilesByClientOs(profiles, ['Windows 10', 'Ubuntu 20.04'])
    expect(result).toHaveLength(3) // p1 + p2 + p3
  })

  it('매칭 없음 → osVer 비어있는 것만', () => {
    const result = filterProfilesByClientOs(profiles, ['CentOS 7'])
    expect(result).toHaveLength(1) // p3만
    expect(result[0].profileId).toBe('p3')
  })

  it('클라이언트 OS 비어있음 → 전체 프로필', () => {
    const result = filterProfilesByClientOs(profiles, [])
    expect(result).toHaveLength(3) // 전부
  })

  it('프로필 없음 → 빈 배열', () => {
    const result = filterProfilesByClientOs([], ['Windows 10'])
    expect(result).toHaveLength(0)
  })
})

// --- generateUniqueName ---

describe('generateUniqueName', () => {
  it('U1: 충돌 없음 → Name (copy)', () => {
    expect(generateUniqueName('Profile A', ['Profile B'])).toBe('Profile A (copy)')
  })

  it('U2: (copy) 존재 → Name (copy 2)', () => {
    expect(generateUniqueName('Profile A', ['Profile A (copy)'])).toBe('Profile A (copy 2)')
  })

  it('U3: (copy) + (copy 2) 존재 → (copy 3)', () => {
    expect(generateUniqueName('Profile A', ['Profile A (copy)', 'Profile A (copy 2)']))
      .toBe('Profile A (copy 3)')
  })

  it('U4: 빈 existingNames → Name (copy)', () => {
    expect(generateUniqueName('Test', [])).toBe('Test (copy)')
  })

  it('U5: baseName 빈 문자열 → (copy)', () => {
    expect(generateUniqueName('', [])).toBe(' (copy)')
  })
})

// --- createTaskSnapshot ---

describe('createTaskSnapshot', () => {
  it('T1: copy 타입 → sourcePath/targetPath 보존', () => {
    const task = { _key: 'k_0', taskId: 'task_abc', type: 'copy', name: 'Binary',
      sourcePath: 'release/bin', targetPath: 'bin', description: 'desc',
      stopOnFail: true, commandLine: '', _argsText: '', timeout: 30,
      _nameError: 'err', _sourcePathError: null, _targetPathError: null, _commandLineError: null }
    const snap = createTaskSnapshot(task)
    expect(snap.type).toBe('copy')
    expect(snap.sourcePath).toBe('release/bin')
    expect(snap.targetPath).toBe('bin')
    expect(snap.stopOnFail).toBe(true)
  })

  it('T2: exec 타입 → commandLine/_argsText/timeout 보존', () => {
    const task = { _key: 'k_1', taskId: 'task_def', type: 'exec', name: 'Stop',
      sourcePath: '', targetPath: '', description: '',
      stopOnFail: false, commandLine: 'net stop svc', _argsText: '/y /force', timeout: 60,
      _nameError: null, _sourcePathError: null, _targetPathError: null, _commandLineError: null }
    const snap = createTaskSnapshot(task)
    expect(snap.commandLine).toBe('net stop svc')
    expect(snap._argsText).toBe('/y /force')
    expect(snap.timeout).toBe(60)
  })

  it('T3: _key, taskId, _*Error 필드 미포함', () => {
    const task = { _key: 'k_0', taskId: 'task_abc', type: 'copy', name: 'X',
      sourcePath: '', targetPath: '', description: '', stopOnFail: false,
      commandLine: '', _argsText: '', timeout: 30,
      _nameError: 'err!', _sourcePathError: 'err2', _targetPathError: null, _commandLineError: null }
    const snap = createTaskSnapshot(task)
    expect(snap).not.toHaveProperty('_key')
    expect(snap).not.toHaveProperty('taskId')
    expect(snap).not.toHaveProperty('_nameError')
    expect(snap).not.toHaveProperty('_sourcePathError')
  })

  it('T4: 누락 필드 기본값 적용', () => {
    const task = { type: 'copy', name: 'Minimal' }
    const snap = createTaskSnapshot(task)
    expect(snap.sourcePath).toBe('')
    expect(snap.timeout).toBe(30)
    expect(snap.stopOnFail).toBe(false)
  })
})

// --- createProfileSnapshot ---

describe('createProfileSnapshot', () => {
  const makeTask = (name, type = 'copy') => ({
    _key: 'k_0', taskId: 'task_x', type, name,
    sourcePath: 'src', targetPath: 'tgt', description: 'd',
    stopOnFail: false, commandLine: 'cmd', _argsText: 'a b', timeout: 30,
    _nameError: null, _sourcePathError: null, _targetPathError: null, _commandLineError: null
  })

  it('P1: 태스크 2개 → 각각 클린 스냅샷', () => {
    const profile = {
      _key: 'k_0', profileId: 'prof_1', name: 'Win', osVer: 'W10', version: '2.0',
      _nameError: null,
      tasks: [makeTask('A'), makeTask('B', 'exec')],
      source: { type: 'local', localPath: '/opt' }
    }
    const snap = createProfileSnapshot(profile)
    expect(snap.tasks).toHaveLength(2)
    expect(snap.tasks[0].name).toBe('A')
    expect(snap.tasks[1].name).toBe('B')
    expect(snap.tasks[0]).not.toHaveProperty('_key')
  })

  it('P2: source 독립 복사', () => {
    const profile = {
      _key: 'k_0', profileId: 'prof_1', name: 'FTP', osVer: '', version: '1.0',
      _nameError: null, tasks: [],
      source: { type: 'ftp', ftpHost: 'host', ftpPort: 21, ftpUser: 'u', ftpPass: 'p', ftpBasePath: '/' }
    }
    const snap = createProfileSnapshot(profile)
    profile.source.ftpHost = 'changed'
    expect(snap.source.ftpHost).toBe('host')
  })

  it('P3: 태스크 0개 → tasks: []', () => {
    const profile = {
      _key: 'k_0', profileId: 'prof_1', name: 'Empty', osVer: '', version: '',
      _nameError: null, tasks: [],
      source: { type: 'local', localPath: '' }
    }
    const snap = createProfileSnapshot(profile)
    expect(snap.tasks).toEqual([])
  })
})

// --- createTaskFromSnapshot ---

describe('createTaskFromSnapshot', () => {
  const snap = { type: 'exec', name: 'Stop Agent', sourcePath: '', targetPath: '',
    description: 'stop svc', stopOnFail: true, commandLine: 'net stop', _argsText: '/y', timeout: 60 }
  let keyN = 0
  const getKey = () => `k_${keyN++}`

  beforeEach(() => { keyN = 100 })

  it('F1: existingNames에 동명 → 유니크 이름', () => {
    const task = createTaskFromSnapshot(snap, ['Stop Agent'], getKey)
    expect(task.name).toBe('Stop Agent (copy)')
  })

  it('F2: existingNames 빈 배열 → 원본 이름 유지', () => {
    const task = createTaskFromSnapshot(snap, [], getKey)
    expect(task.name).toBe('Stop Agent')
  })

  it('F3: 새 _key + taskId: null', () => {
    const task = createTaskFromSnapshot(snap, [], getKey)
    expect(task._key).toMatch(/^k_\d+$/)
    expect(task.taskId).toBeNull()
  })

  it('F4: 모든 _*Error null', () => {
    const task = createTaskFromSnapshot(snap, [], getKey)
    expect(task._nameError).toBeNull()
    expect(task._sourcePathError).toBeNull()
    expect(task._targetPathError).toBeNull()
    expect(task._commandLineError).toBeNull()
  })
})

// --- createProfileFromSnapshot ---

describe('createProfileFromSnapshot', () => {
  const taskSnap = { type: 'copy', name: 'Binary', sourcePath: 'src', targetPath: 'tgt',
    description: '', stopOnFail: false, commandLine: '', _argsText: '', timeout: 30 }
  const profSnap = { name: 'Windows', osVer: 'W10', version: '2.0',
    tasks: [taskSnap, { ...taskSnap, name: 'Config' }],
    source: { type: 'ftp', ftpHost: 'h', ftpPort: 21, ftpUser: 'u', ftpPass: 'p', ftpBasePath: '/' } }
  let keyN = 0
  const getKey = () => `k_${keyN++}`

  beforeEach(() => { keyN = 200 })

  it('G1: 프로필명 유니크 + 태스크명 원본 유지', () => {
    const p = createProfileFromSnapshot(profSnap, ['Windows'], getKey)
    expect(p.name).toBe('Windows (copy)')
    expect(p.tasks[0].name).toBe('Binary')
    expect(p.tasks[1].name).toBe('Config')
  })

  it('G2: 태스크 각각 새 _key, taskId: null', () => {
    const p = createProfileFromSnapshot(profSnap, [], getKey)
    expect(p.tasks).toHaveLength(2)
    expect(p.tasks[0]._key).not.toBe(p.tasks[1]._key)
    expect(p.tasks[0].taskId).toBeNull()
    expect(p.tasks[1].taskId).toBeNull()
  })

  it('G3: profileId: null + _nameError: null', () => {
    const p = createProfileFromSnapshot(profSnap, [], getKey)
    expect(p.profileId).toBeNull()
    expect(p._nameError).toBeNull()
  })

  it('G4: source 독립 복사', () => {
    const p = createProfileFromSnapshot(profSnap, [], getKey)
    profSnap.source.ftpHost = 'changed'
    expect(p.source.ftpHost).toBe('h')
    profSnap.source.ftpHost = 'h' // restore
  })

  it('G5: 반복 호출 → (copy), (copy 2)', () => {
    const existing = ['Windows']
    const p1 = createProfileFromSnapshot(profSnap, existing, getKey)
    existing.push(p1.name)
    const p2 = createProfileFromSnapshot(profSnap, existing, getKey)
    expect(p1.name).toBe('Windows (copy)')
    expect(p2.name).toBe('Windows (copy 2)')
  })
})
