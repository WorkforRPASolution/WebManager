/**
 * updateSettingsService - TDD tests
 *
 * Tests service functions with a mock model injected via _setModel().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  cleanProfiles,
  sanitizeSource,
  saveUpdateSettings,
  getProfile,
  getDocument,
  initializeUpdateSettings,
  _setModel
} from './updateSettingsService.js'

// Mock model object
const mockModel = {
  createIndexes: vi.fn(),
  findOneAndUpdate: vi.fn(),
  findOne: vi.fn(),
  find: vi.fn(),
  updateOne: vi.fn()
}

// Inject mock model before all tests
_setModel(mockModel)

// Helper: returns chainable .lean()
function chainLean(resolvedValue) {
  return { lean: vi.fn().mockResolvedValue(resolvedValue) }
}

// ─── cleanProfiles ───────────────────────────────────────────────

describe('cleanProfiles', () => {
  it('auto-generates profileId with prof_ prefix when missing', () => {
    const result = cleanProfiles([{ name: 'Test' }])
    expect(result).toHaveLength(1)
    expect(result[0].profileId).toMatch(/^prof_[0-9a-f]+$/)
  })

  it('keeps existing profileId', () => {
    const result = cleanProfiles([{ profileId: 'prof_abc', name: 'Test' }])
    expect(result[0].profileId).toBe('prof_abc')
  })

  it('auto-generates taskId with task_ prefix when missing', () => {
    const result = cleanProfiles([{
      name: 'Test',
      tasks: [{ name: 't1', sourcePath: 'bin/app.exe', targetPath: 'bin/app.exe' }]
    }])
    expect(result[0].tasks[0].taskId).toMatch(/^task_[0-9a-f]+$/)
  })

  it('keeps existing taskId', () => {
    const result = cleanProfiles([{
      name: 'Test',
      tasks: [{ taskId: 'task_abc', name: 't1', sourcePath: 'a', targetPath: 'b' }]
    }])
    expect(result[0].tasks[0].taskId).toBe('task_abc')
  })

  it('defaults task type to copy', () => {
    const result = cleanProfiles([{
      name: 'Test',
      tasks: [{ name: 't1', sourcePath: 'a', targetPath: 'b' }]
    }])
    expect(result[0].tasks[0].type).toBe('copy')
  })

  it('maps task sourcePath and targetPath independently', () => {
    const result = cleanProfiles([{
      name: 'Test',
      tasks: [{ name: 't1', sourcePath: '  release/bin/app.exe  ', targetPath: '  bin/app.exe  ' }]
    }])
    expect(result[0].tasks[0].sourcePath).toBe('release/bin/app.exe')
    expect(result[0].tasks[0].targetPath).toBe('bin/app.exe')
  })

  it('trims name', () => {
    const result = cleanProfiles([{ name: '  Spaced  ' }])
    expect(result[0].name).toBe('Spaced')
  })

  it('trims osVer and version', () => {
    const result = cleanProfiles([{ name: 'Test', osVer: '  Win10  ', version: '  1.0  ' }])
    expect(result[0].osVer).toBe('Win10')
    expect(result[0].version).toBe('1.0')
  })

  it('defaults osVer, version to empty string', () => {
    const result = cleanProfiles([{ name: 'Test' }])
    expect(result[0].osVer).toBe('')
    expect(result[0].version).toBe('')
  })

  it('defaults tasks to empty array', () => {
    const result = cleanProfiles([{ name: 'Test' }])
    expect(result[0].tasks).toEqual([])
  })

  it('defaults source to { type: "local" }', () => {
    const result = cleanProfiles([{ name: 'Test' }])
    expect(result[0].source).toEqual({ type: 'local' })
  })

  it('sanitizes source — keeps only local fields for type=local', () => {
    const result = cleanProfiles([{
      name: 'Test',
      source: { type: 'local', localPath: '/opt', ftpHost: 'stale', minioEndpoint: 'stale' }
    }])
    expect(result[0].source).toEqual({ type: 'local', localPath: '/opt' })
    expect(result[0].source.ftpHost).toBeUndefined()
    expect(result[0].source.minioEndpoint).toBeUndefined()
  })

  it('sanitizes source — keeps only ftp fields for type=ftp', () => {
    const result = cleanProfiles([{
      name: 'Test',
      source: { type: 'ftp', ftpHost: 'ftp.example.com', ftpPort: 2121, localPath: 'stale' }
    }])
    expect(result[0].source).toEqual({
      type: 'ftp', ftpHost: 'ftp.example.com', ftpPort: 2121, ftpUser: '', ftpPass: '', ftpBasePath: ''
    })
    expect(result[0].source.localPath).toBeUndefined()
  })

  it('sanitizes source — keeps only minio fields for type=minio', () => {
    const result = cleanProfiles([{
      name: 'Test',
      source: { type: 'minio', minioEndpoint: 'minio.local', minioBucket: 'test', ftpHost: 'stale' }
    }])
    expect(result[0].source.type).toBe('minio')
    expect(result[0].source.minioEndpoint).toBe('minio.local')
    expect(result[0].source.minioBucket).toBe('test')
    expect(result[0].source.ftpHost).toBeUndefined()
    expect(result[0].source.localPath).toBeUndefined()
  })
})

// ─── sanitizeSource ─────────────────────────────────────────────

describe('sanitizeSource', () => {
  it('returns { type: "local" } for null/undefined', () => {
    expect(sanitizeSource(null)).toEqual({ type: 'local' })
    expect(sanitizeSource(undefined)).toEqual({ type: 'local' })
    expect(sanitizeSource({})).toEqual({ type: 'local' })
  })

  it('local: only keeps localPath', () => {
    const result = sanitizeSource({
      type: 'local', localPath: '/opt', ftpHost: 'stale', minioEndpoint: 'stale'
    })
    expect(result).toEqual({ type: 'local', localPath: '/opt' })
  })

  it('ftp: keeps ftp fields with defaults for missing values', () => {
    const result = sanitizeSource({ type: 'ftp', ftpHost: 'host.com' })
    expect(result).toEqual({
      type: 'ftp', ftpHost: 'host.com', ftpPort: 21, ftpUser: '', ftpPass: '', ftpBasePath: ''
    })
  })

  it('ftp: preserves custom port', () => {
    const result = sanitizeSource({ type: 'ftp', ftpHost: 'h', ftpPort: 2121 })
    expect(result.ftpPort).toBe(2121)
  })

  it('minio: keeps minio fields with defaults for missing values', () => {
    const result = sanitizeSource({ type: 'minio', minioEndpoint: 'minio.local' })
    expect(result).toEqual({
      type: 'minio', minioEndpoint: 'minio.local', minioPort: 9000,
      minioBucket: '', minioAccessKey: '', minioSecretKey: '', minioUseSSL: false, minioBasePath: ''
    })
  })

  it('minio: preserves custom values', () => {
    const result = sanitizeSource({
      type: 'minio', minioEndpoint: 'host', minioPort: 443,
      minioBucket: 'bkt', minioAccessKey: 'ak', minioSecretKey: 'sk', minioUseSSL: true, minioBasePath: '/prefix'
    })
    expect(result.minioPort).toBe(443)
    expect(result.minioUseSSL).toBe(true)
    expect(result.minioBasePath).toBe('/prefix')
  })
})

// ─── saveUpdateSettings ──────────────────────────────────────────

describe('saveUpdateSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls findOneAndUpdate with $set profiles and $unset packages+source', async () => {
    const profiles = [{ profileId: 'prof_1', name: 'Default', packages: [], source: {} }]
    const expected = { agentGroup: 'EQP', profiles, updatedBy: 'admin' }

    mockModel.findOneAndUpdate.mockReturnValue(chainLean(expected))

    const result = await saveUpdateSettings('EQP', profiles, 'admin')

    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      { agentGroup: 'EQP' },
      {
        $set: { profiles: expect.any(Array), updatedBy: 'admin' },
        $unset: { packages: 1, source: 1 }
      },
      { new: true, upsert: true }
    )
    expect(result).toEqual(expected)
  })

  it('defaults updatedBy to system', async () => {
    mockModel.findOneAndUpdate.mockReturnValue(chainLean({}))

    await saveUpdateSettings('EQP', [])

    const call = mockModel.findOneAndUpdate.mock.calls[0]
    expect(call[1].$set.updatedBy).toBe('system')
  })
})

// ─── getProfile ──────────────────────────────────────────────────

describe('getProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns matching profile when found', async () => {
    const doc = {
      agentGroup: 'EQP',
      profiles: [
        { profileId: 'prof_1', name: 'Default' },
        { profileId: 'prof_2', name: 'Win11' }
      ]
    }
    mockModel.findOne.mockReturnValue(chainLean(doc))

    const result = await getProfile('EQP', 'prof_2')
    expect(result).toEqual({ profileId: 'prof_2', name: 'Win11' })
  })

  it('returns null when profileId not found', async () => {
    const doc = {
      agentGroup: 'EQP',
      profiles: [{ profileId: 'prof_1', name: 'Default' }]
    }
    mockModel.findOne.mockReturnValue(chainLean(doc))

    const result = await getProfile('EQP', 'prof_nonexistent')
    expect(result).toBeNull()
  })

  it('returns null when document does not exist', async () => {
    mockModel.findOne.mockReturnValue(chainLean(null))

    const result = await getProfile('EQP', 'prof_1')
    expect(result).toBeNull()
  })
})

// ─── migrateToProfiles (inside initializeUpdateSettings) ─────────

describe('initializeUpdateSettings - migration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('migrates legacy documents with packages to profiles with tasks', async () => {
    const legacyDoc = {
      _id: 'id_1',
      agentGroup: 'EQP',
      packages: [{ packageId: 'pkg_1', name: 'app.exe', targetPath: '/bin', targetType: 'file' }],
      source: { type: 'local', localPath: '/src' }
    }

    mockModel.createIndexes.mockResolvedValue()
    // First find: legacy migration, Second find: Migration B, Third find: source cleanup
    mockModel.find
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([legacyDoc]) })
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })
    mockModel.updateOne.mockResolvedValue()

    await initializeUpdateSettings()

    expect(mockModel.find).toHaveBeenCalledWith({
      packages: { $exists: true, $ne: [] },
      $or: [{ profiles: { $exists: false } }, { profiles: { $size: 0 } }]
    })

    const updateCall = mockModel.updateOne.mock.calls[0]
    expect(updateCall[0]).toEqual({ _id: 'id_1' })
    const migratedProfile = updateCall[1].$set.profiles[0]
    expect(migratedProfile.profileId).toBe('prof_default')
    expect(migratedProfile.tasks).toEqual([
      { taskId: 'task_1', type: 'copy', name: 'app.exe', sourcePath: '/bin', targetPath: '/bin' }
    ])
    expect(migratedProfile.packages).toBeUndefined()
  })

  it('skips migration when no legacy documents found', async () => {
    mockModel.createIndexes.mockResolvedValue()
    mockModel.find
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })  // legacy
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })  // Migration B
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })  // source cleanup

    await initializeUpdateSettings()

    expect(mockModel.updateOne).not.toHaveBeenCalled()
  })

  it('cleans source fields in existing profiles', async () => {
    const dirtyDoc = {
      _id: 'id_2',
      profiles: [{
        profileId: 'prof_1',
        tasks: [],
        source: { type: 'local', localPath: '/opt', ftpHost: '', ftpPort: 21, minioEndpoint: '' }
      }]
    }

    mockModel.createIndexes.mockResolvedValue()
    mockModel.find
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })         // legacy migration
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })         // Migration B
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([dirtyDoc]) }) // source cleanup
    mockModel.updateOne.mockResolvedValue()

    await initializeUpdateSettings()

    // Should clean source: remove ftpHost, ftpPort, minioEndpoint
    const updateCall = mockModel.updateOne.mock.calls[0]
    expect(updateCall[0]).toEqual({ _id: 'id_2' })
    const cleanedSource = updateCall[1].$set.profiles[0].source
    expect(cleanedSource).toEqual({ type: 'local', localPath: '/opt' })
    expect(cleanedSource.ftpHost).toBeUndefined()
  })

  it('Migration B: converts profiles.packages[] to profiles.tasks[]', async () => {
    const docWithPackages = {
      _id: 'id_3',
      profiles: [{
        profileId: 'prof_1',
        name: 'Default',
        packages: [
          { packageId: 'pkg_1', name: 'Agent', targetPath: 'bin/agent.jar', targetType: 'file' },
          { packageId: 'pkg_2', name: 'Config', targetPath: 'config/', targetType: 'directory', description: 'Config files' }
        ],
        source: { type: 'local', localPath: '/opt' }
      }]
    }

    mockModel.createIndexes.mockResolvedValue()
    mockModel.find
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })               // legacy
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([docWithPackages]) }) // Migration B
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([]) })               // source cleanup
    mockModel.updateOne.mockResolvedValue()

    await initializeUpdateSettings()

    const updateCall = mockModel.updateOne.mock.calls[0]
    expect(updateCall[0]).toEqual({ _id: 'id_3' })
    const migratedTasks = updateCall[1].$set.profiles[0].tasks
    expect(migratedTasks).toEqual([
      { taskId: 'task_1', type: 'copy', name: 'Agent', sourcePath: 'bin/agent.jar', targetPath: 'bin/agent.jar' },
      { taskId: 'task_2', type: 'copy', name: 'Config', sourcePath: 'config/', targetPath: 'config/', description: 'Config files' }
    ])
    expect(updateCall[1].$set.profiles[0].packages).toBeUndefined()
  })
})
