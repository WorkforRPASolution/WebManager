/**
 * updateSettingsService — per-profile CRUD tests (TDD)
 *
 * Tests service functions with a mock model injected via _setModel().
 * Schema: 1 document = 1 profile, composite key (agentGroup, profileId).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  cleanProfile,
  sanitizeSource,
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  initializeUpdateSettings,
  _setModel
} from './updateSettingsService.js'

// Mock model
const mockModel = {
  createIndexes: vi.fn(),
  countDocuments: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  findOneAndDelete: vi.fn(),
  create: vi.fn()
}

_setModel(mockModel)

function chainLean(resolvedValue) {
  return { lean: vi.fn().mockResolvedValue(resolvedValue) }
}

// ─── cleanProfile ───────────────────────────────────────────────

describe('cleanProfile', () => {
  it('auto-generates profileId with prof_ prefix when missing', () => {
    const result = cleanProfile({ name: 'Test' })
    expect(result.profileId).toMatch(/^prof_[0-9a-f]+$/)
  })

  it('keeps existing profileId', () => {
    const result = cleanProfile({ profileId: 'prof_abc', name: 'Test' })
    expect(result.profileId).toBe('prof_abc')
  })

  it('auto-generates taskId with task_ prefix when missing', () => {
    const result = cleanProfile({
      name: 'Test',
      tasks: [{ name: 't1', sourcePath: 'bin/app.exe', targetPath: 'bin/app.exe' }]
    })
    expect(result.tasks[0].taskId).toMatch(/^task_[0-9a-f]+$/)
  })

  it('keeps existing taskId', () => {
    const result = cleanProfile({
      name: 'Test',
      tasks: [{ taskId: 'task_abc', name: 't1', sourcePath: 'a', targetPath: 'b' }]
    })
    expect(result.tasks[0].taskId).toBe('task_abc')
  })

  it('defaults task type to copy', () => {
    const result = cleanProfile({
      name: 'Test',
      tasks: [{ name: 't1', sourcePath: 'a', targetPath: 'b' }]
    })
    expect(result.tasks[0].type).toBe('copy')
  })

  it('maps task sourcePath and targetPath independently', () => {
    const result = cleanProfile({
      name: 'Test',
      tasks: [{ name: 't1', sourcePath: '  release/bin/app.exe  ', targetPath: '  bin/app.exe  ' }]
    })
    expect(result.tasks[0].sourcePath).toBe('release/bin/app.exe')
    expect(result.tasks[0].targetPath).toBe('bin/app.exe')
  })

  it('trims name/osVer/version', () => {
    const result = cleanProfile({ name: '  Spaced  ', osVer: '  Win10  ', version: '  1.0  ' })
    expect(result.name).toBe('Spaced')
    expect(result.osVer).toBe('Win10')
    expect(result.version).toBe('1.0')
  })

  it('defaults osVer, version to empty string', () => {
    const result = cleanProfile({ name: 'Test' })
    expect(result.osVer).toBe('')
    expect(result.version).toBe('')
  })

  it('defaults tasks to empty array', () => {
    const result = cleanProfile({ name: 'Test' })
    expect(result.tasks).toEqual([])
  })

  it('defaults source to { type: "local" }', () => {
    const result = cleanProfile({ name: 'Test' })
    expect(result.source).toEqual({ type: 'local' })
  })

  it('sanitizes source — keeps only local fields for type=local', () => {
    const result = cleanProfile({
      name: 'Test',
      source: { type: 'local', localPath: '/opt', ftpHost: 'stale', minioEndpoint: 'stale' }
    })
    expect(result.source).toEqual({ type: 'local', localPath: '/opt' })
  })

  it('sanitizes source — keeps only ftp fields for type=ftp', () => {
    const result = cleanProfile({
      name: 'Test',
      source: { type: 'ftp', ftpHost: 'ftp.example.com', ftpPort: 2121, localPath: 'stale' }
    })
    expect(result.source).toEqual({
      type: 'ftp', ftpHost: 'ftp.example.com', ftpPort: 2121, ftpUser: '', ftpPass: '', ftpBasePath: ''
    })
  })

  it('sanitizes source — keeps only minio fields for type=minio', () => {
    const result = cleanProfile({
      name: 'Test',
      source: { type: 'minio', minioEndpoint: 'minio.local', minioBucket: 'test', ftpHost: 'stale' }
    })
    expect(result.source.type).toBe('minio')
    expect(result.source.minioEndpoint).toBe('minio.local')
    expect(result.source.ftpHost).toBeUndefined()
  })
})

// ─── sanitizeSource ─────────────────────────────────────────────

describe('sanitizeSource', () => {
  it('returns { type: "local" } for null/undefined/empty', () => {
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

  it('ftp: keeps ftp fields with defaults', () => {
    const result = sanitizeSource({ type: 'ftp', ftpHost: 'host.com' })
    expect(result).toEqual({
      type: 'ftp', ftpHost: 'host.com', ftpPort: 21, ftpUser: '', ftpPass: '', ftpBasePath: ''
    })
  })

  it('minio: keeps minio fields with defaults', () => {
    const result = sanitizeSource({ type: 'minio', minioEndpoint: 'minio.local' })
    expect(result.minioPort).toBe(9000)
    expect(result.minioUseSSL).toBe(false)
  })
})

// ─── listProfiles ───────────────────────────────────────────────

describe('listProfiles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all profiles for agentGroup', async () => {
    const docs = [
      { agentGroup: 'EQP', profileId: 'prof_1', name: 'P1' },
      { agentGroup: 'EQP', profileId: 'prof_2', name: 'P2' }
    ]
    mockModel.find.mockReturnValue(chainLean(docs))

    const result = await listProfiles('EQP')
    expect(mockModel.find).toHaveBeenCalledWith({ agentGroup: 'EQP' })
    expect(result).toEqual(docs)
  })

  it('returns empty array when no profiles exist', async () => {
    mockModel.find.mockReturnValue(chainLean([]))
    const result = await listProfiles('EQP')
    expect(result).toEqual([])
  })
})

// ─── getProfile ──────────────────────────────────────────────────

describe('getProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns matching profile when found', async () => {
    const doc = { agentGroup: 'EQP', profileId: 'prof_2', name: 'Win11' }
    mockModel.findOne.mockReturnValue(chainLean(doc))

    const result = await getProfile('EQP', 'prof_2')
    expect(mockModel.findOne).toHaveBeenCalledWith({ agentGroup: 'EQP', profileId: 'prof_2' })
    expect(result).toEqual(doc)
  })

  it('returns null when not found', async () => {
    mockModel.findOne.mockReturnValue(chainLean(null))
    const result = await getProfile('EQP', 'prof_none')
    expect(result).toBeNull()
  })
})

// ─── createProfile ──────────────────────────────────────────────

describe('createProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates profile with cleaned data and audit log', async () => {
    const created = {
      agentGroup: 'EQP',
      profileId: 'prof_abc',
      name: 'New',
      osVer: '',
      version: '',
      tasks: [],
      source: { type: 'local' }
    }
    mockModel.create.mockResolvedValue({ ...created, toObject: () => created })

    const result = await createProfile('EQP', { profileId: 'prof_abc', name: 'New' }, 'admin')

    expect(mockModel.create).toHaveBeenCalledWith(expect.objectContaining({
      agentGroup: 'EQP',
      profileId: 'prof_abc',
      name: 'New',
      updatedBy: 'admin'
    }))
    expect(result.profileId).toBe('prof_abc')
  })

  it('auto-generates profileId when not provided', async () => {
    const returned = { agentGroup: 'EQP', profileId: 'prof_xyz', name: 'Auto', tasks: [] }
    mockModel.create.mockImplementation(async (data) => ({ ...data, toObject: () => data }))

    const result = await createProfile('EQP', { name: 'Auto' }, 'admin')
    expect(result.profileId).toMatch(/^prof_[0-9a-f]+$/)
  })

  it('defaults updatedBy to system', async () => {
    mockModel.create.mockImplementation(async (data) => ({ ...data, toObject: () => data }))
    await createProfile('EQP', { profileId: 'prof_1', name: 'x' })
    const call = mockModel.create.mock.calls[0][0]
    expect(call.updatedBy).toBe('system')
  })
})

// ─── updateProfile ──────────────────────────────────────────────

describe('updateProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates existing profile and returns latest', async () => {
    const previous = { agentGroup: 'EQP', profileId: 'prof_1', name: 'Old', tasks: [] }
    const updated = { agentGroup: 'EQP', profileId: 'prof_1', name: 'New', tasks: [] }

    mockModel.findOne.mockReturnValue(chainLean(previous))
    mockModel.findOneAndUpdate.mockReturnValue(chainLean(updated))

    const result = await updateProfile('EQP', 'prof_1', { name: 'New' }, 'admin')

    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      { agentGroup: 'EQP', profileId: 'prof_1' },
      expect.objectContaining({ $set: expect.objectContaining({ name: 'New', updatedBy: 'admin' }) }),
      { returnDocument: 'after' }
    )
    expect(result).toEqual(updated)
  })

  it('returns null when target profile does not exist', async () => {
    mockModel.findOne.mockReturnValue(chainLean(null))
    const result = await updateProfile('EQP', 'prof_missing', { name: 'x' }, 'admin')
    expect(result).toBeNull()
    expect(mockModel.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('ignores profileId in payload — path param is authoritative', async () => {
    const previous = { agentGroup: 'EQP', profileId: 'prof_1', name: 'Old', tasks: [] }
    const updated = { agentGroup: 'EQP', profileId: 'prof_1', name: 'New', tasks: [] }
    mockModel.findOne.mockReturnValue(chainLean(previous))
    mockModel.findOneAndUpdate.mockReturnValue(chainLean(updated))

    await updateProfile('EQP', 'prof_1', { profileId: 'prof_MALICIOUS', name: 'New' }, 'admin')

    const call = mockModel.findOneAndUpdate.mock.calls[0]
    expect(call[1].$set.profileId).toBe('prof_1')
  })
})

// ─── deleteProfile ──────────────────────────────────────────────

describe('deleteProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes and returns previous document', async () => {
    const previous = { agentGroup: 'EQP', profileId: 'prof_1', name: 'X' }
    mockModel.findOneAndDelete.mockReturnValue(chainLean(previous))

    const result = await deleteProfile('EQP', 'prof_1', 'admin')

    expect(mockModel.findOneAndDelete).toHaveBeenCalledWith({ agentGroup: 'EQP', profileId: 'prof_1' })
    expect(result).toEqual(previous)
  })

  it('returns null when not found', async () => {
    mockModel.findOneAndDelete.mockReturnValue(chainLean(null))
    const result = await deleteProfile('EQP', 'prof_missing', 'admin')
    expect(result).toBeNull()
  })
})

// ─── initializeUpdateSettings (boot guard) ──────────────────────

describe('initializeUpdateSettings — boot guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('succeeds when no legacy documents exist', async () => {
    mockModel.createIndexes.mockResolvedValue()
    mockModel.countDocuments.mockResolvedValue(0)

    await expect(initializeUpdateSettings()).resolves.toBeUndefined()
    expect(mockModel.countDocuments).toHaveBeenCalledWith({ profiles: { $exists: true } })
  })

  it('throws when legacy documents are present', async () => {
    mockModel.createIndexes.mockResolvedValue()
    mockModel.countDocuments.mockResolvedValue(3)

    await expect(initializeUpdateSettings()).rejects.toThrow('UPDATE_SETTINGS migration required')
  })
})
