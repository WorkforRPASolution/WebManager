/**
 * updateController — per-profile CRUD tests (TDD)
 *
 * Uses _setDeps() dependency injection to replace services.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listUpdateSettings,
  createProfile,
  updateProfile,
  deleteProfile,
  deployUpdate,
  _setDeps
} from './updateController.js'

// --- Mock dependencies ---
const mockListProfiles = vi.fn()
const mockCreateProfile = vi.fn()
const mockUpdateProfile = vi.fn()
const mockDeleteProfile = vi.fn()
const mockDeployUpdate = vi.fn()

_setDeps({
  updateSettingsService: {
    listProfiles: mockListProfiles,
    createProfile: mockCreateProfile,
    updateProfile: mockUpdateProfile,
    deleteProfile: mockDeleteProfile
  },
  updateService: {
    deployUpdate: mockDeployUpdate
  },
  setupSSE: (res) => {
    const events = []
    return {
      send: (data) => events.push(data),
      end: () => {},
      isAborted: () => false,
      _events: events
    }
  }
})

function mockReq(overrides = {}) {
  return {
    params: {},
    body: {},
    user: { singleid: 'tester' },
    ...overrides
  }
}

function mockRes() {
  const res = {
    _status: 200,
    _json: null,
    json: vi.fn((data) => { res._json = data }),
    status: vi.fn((code) => { res._status = code; return res }),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn()
  }
  return res
}

describe('updateController', () => {
  beforeEach(() => vi.clearAllMocks())

  // -----------------------------------------------------------
  describe('listUpdateSettings', () => {
    it('returns { agentGroup, profiles } with profiles from service', async () => {
      const profiles = [{ profileId: 'p1', name: 'P1' }]
      mockListProfiles.mockResolvedValue(profiles)

      const req = mockReq({ params: { agentGroup: 'ars' } })
      const res = mockRes()

      await listUpdateSettings(req, res)

      expect(mockListProfiles).toHaveBeenCalledWith('ars')
      expect(res.json).toHaveBeenCalledWith({ agentGroup: 'ars', profiles })
    })

    it('returns empty profiles array when none exist', async () => {
      mockListProfiles.mockResolvedValue([])
      const req = mockReq({ params: { agentGroup: 'ars' } })
      const res = mockRes()

      await listUpdateSettings(req, res)
      expect(res.json).toHaveBeenCalledWith({ agentGroup: 'ars', profiles: [] })
    })
  })

  // -----------------------------------------------------------
  describe('createProfile', () => {
    it('throws 400 when name is missing', async () => {
      const req = mockReq({ params: { agentGroup: 'ars' }, body: { tasks: [] } })
      const res = mockRes()
      await expect(createProfile(req, res)).rejects.toThrow('profile must have a name')
    })

    it('throws 400 when name is whitespace', async () => {
      const req = mockReq({ params: { agentGroup: 'ars' }, body: { name: '   ' } })
      const res = mockRes()
      await expect(createProfile(req, res)).rejects.toThrow('profile must have a name')
    })

    it('throws 400 when copy task lacks sourcePath', async () => {
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: { name: 'P', tasks: [{ name: 't', type: 'copy', sourcePath: '', targetPath: 'b' }] }
      })
      await expect(createProfile(req, mockRes())).rejects.toThrow('Copy task requires sourcePath and targetPath')
    })

    it('throws 400 when exec task lacks commandLine', async () => {
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: { name: 'P', tasks: [{ name: 't', type: 'exec', commandLine: '' }] }
      })
      await expect(createProfile(req, mockRes())).rejects.toThrow('Exec task requires commandLine')
    })

    it('calls service and returns 201 with created profile', async () => {
      const profileBody = { name: 'P1', tasks: [{ name: 'T1', sourcePath: 'a', targetPath: 'b' }] }
      const saved = { agentGroup: 'ars', profileId: 'prof_new', ...profileBody }
      mockCreateProfile.mockResolvedValue(saved)

      const req = mockReq({ params: { agentGroup: 'ars' }, body: profileBody })
      const res = mockRes()

      await createProfile(req, res)

      expect(mockCreateProfile).toHaveBeenCalledWith('ars', profileBody, 'tester')
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(saved)
    })

    it('uses "unknown" as updatedBy when no user is present', async () => {
      mockCreateProfile.mockResolvedValue({})
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: { name: 'P1' },
        user: undefined
      })
      await createProfile(req, mockRes())
      expect(mockCreateProfile).toHaveBeenCalledWith('ars', { name: 'P1' }, 'unknown')
    })

    it('propagates 409 ApiError from service when duplicate', async () => {
      const conflictErr = Object.assign(
        new Error('Profile already exists: name="X" osVer="Win11" version="1.0"'),
        { statusCode: 409, code: 'PROFILE_DUPLICATE' }
      )
      mockCreateProfile.mockRejectedValue(conflictErr)

      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: { name: 'X', osVer: 'Win11', version: '1.0' }
      })
      await expect(createProfile(req, mockRes())).rejects.toMatchObject({
        statusCode: 409, code: 'PROFILE_DUPLICATE'
      })
    })
  })

  // -----------------------------------------------------------
  describe('updateProfile', () => {
    it('throws 404 when profile does not exist', async () => {
      mockUpdateProfile.mockResolvedValue(null)
      const req = mockReq({
        params: { agentGroup: 'ars', profileId: 'prof_none' },
        body: { name: 'P' }
      })
      await expect(updateProfile(req, mockRes())).rejects.toThrow('Profile not found: prof_none')
    })

    it('updates and returns profile', async () => {
      const body = { name: 'Updated', tasks: [] }
      const saved = { agentGroup: 'ars', profileId: 'p1', ...body }
      mockUpdateProfile.mockResolvedValue(saved)

      const req = mockReq({ params: { agentGroup: 'ars', profileId: 'p1' }, body })
      const res = mockRes()

      await updateProfile(req, res)

      expect(mockUpdateProfile).toHaveBeenCalledWith('ars', 'p1', body, 'tester')
      expect(res.json).toHaveBeenCalledWith(saved)
    })

    it('validates exec task requires commandLine', async () => {
      const req = mockReq({
        params: { agentGroup: 'ars', profileId: 'p1' },
        body: { name: 'P', tasks: [{ name: 't', type: 'exec', commandLine: '' }] }
      })
      await expect(updateProfile(req, mockRes())).rejects.toThrow('Exec task requires commandLine')
    })

    it('propagates 409 ApiError from service when duplicate', async () => {
      const conflictErr = Object.assign(
        new Error('Profile already exists'),
        { statusCode: 409, code: 'PROFILE_DUPLICATE' }
      )
      mockUpdateProfile.mockRejectedValue(conflictErr)

      const req = mockReq({
        params: { agentGroup: 'ars', profileId: 'p1' },
        body: { name: 'X', osVer: 'Win11', version: '1.0' }
      })
      await expect(updateProfile(req, mockRes())).rejects.toMatchObject({
        statusCode: 409, code: 'PROFILE_DUPLICATE'
      })
    })
  })

  // -----------------------------------------------------------
  describe('deleteProfile', () => {
    it('returns 204 on success', async () => {
      mockDeleteProfile.mockResolvedValue({ agentGroup: 'ars', profileId: 'p1' })
      const req = mockReq({ params: { agentGroup: 'ars', profileId: 'p1' } })
      const res = mockRes()

      await deleteProfile(req, res)

      expect(mockDeleteProfile).toHaveBeenCalledWith('ars', 'p1', 'tester')
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.end).toHaveBeenCalled()
    })

    it('throws 404 when profile not found', async () => {
      mockDeleteProfile.mockResolvedValue(null)
      const req = mockReq({ params: { agentGroup: 'ars', profileId: 'nope' } })
      await expect(deleteProfile(req, mockRes())).rejects.toThrow('Profile not found: nope')
    })
  })

  // -----------------------------------------------------------
  describe('deployUpdate', () => {
    it('throws 400 when agentGroup is missing', async () => {
      const req = mockReq({ body: { profileId: 'p1', taskIds: ['t1'], targetEqpIds: ['e1'] } })
      await expect(deployUpdate(req, mockRes())).rejects.toThrow('agentGroup is required')
    })

    it('throws 400 when profileId is missing', async () => {
      const req = mockReq({ body: { agentGroup: 'ars', taskIds: ['t1'], targetEqpIds: ['e1'] } })
      await expect(deployUpdate(req, mockRes())).rejects.toThrow('profileId is required')
    })

    it('throws 400 when taskIds is empty', async () => {
      const req = mockReq({ body: { agentGroup: 'ars', profileId: 'p1', taskIds: [], targetEqpIds: ['e1'] } })
      await expect(deployUpdate(req, mockRes())).rejects.toThrow('taskIds array is required')
    })

    it('throws 400 when targetEqpIds is empty', async () => {
      const req = mockReq({ body: { agentGroup: 'ars', profileId: 'p1', taskIds: ['t1'], targetEqpIds: [] } })
      await expect(deployUpdate(req, mockRes())).rejects.toThrow('targetEqpIds array is required')
    })
  })
})
