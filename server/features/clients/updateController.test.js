/**
 * updateController — profile-based validation tests (TDD)
 *
 * Uses _setDeps() dependency injection pattern (same as updateService).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need to import after setting up, but the controller uses require() internally.
// We'll add _setDeps to the controller so we can inject mock services.
import {
  getUpdateSettings,
  saveUpdateSettings,
  deployUpdate,
  _setDeps
} from './updateController.js'

// --- Mock dependencies ---
const mockGetDocument = vi.fn()
const mockSaveUpdateSettings = vi.fn()
const mockDeployUpdate = vi.fn()

_setDeps({
  updateSettingsService: {
    getDocument: mockGetDocument,
    saveUpdateSettings: mockSaveUpdateSettings
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

/** Helper: create a mock Express request */
function mockReq(overrides = {}) {
  return {
    params: {},
    body: {},
    user: { singleid: 'tester' },
    ...overrides
  }
}

/** Helper: create a mock Express response */
function mockRes() {
  const res = {
    _status: 200,
    _json: null,
    _headers: {},
    json: vi.fn((data) => { res._json = data }),
    status: vi.fn((code) => { res._status = code; return res }),
    setHeader: vi.fn((k, v) => { res._headers[k] = v }),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn()
  }
  return res
}

describe('updateController validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -----------------------------------------------------------
  // getUpdateSettings
  // -----------------------------------------------------------
  describe('getUpdateSettings', () => {
    it('returns document when found', async () => {
      const doc = { agentGroup: 'ars', profiles: [{ name: 'P1' }] }
      mockGetDocument.mockResolvedValue(doc)

      const req = mockReq({ params: { agentGroup: 'ars' } })
      const res = mockRes()

      await getUpdateSettings(req, res)

      expect(mockGetDocument).toHaveBeenCalledWith('ars')
      expect(res.json).toHaveBeenCalledWith(doc)
    })

    it('returns fallback with empty profiles array when document is null', async () => {
      mockGetDocument.mockResolvedValue(null)

      const req = mockReq({ params: { agentGroup: 'ars' } })
      const res = mockRes()

      await getUpdateSettings(req, res)

      expect(res.json).toHaveBeenCalledWith({ agentGroup: 'ars', profiles: [] })
    })
  })

  // -----------------------------------------------------------
  // saveUpdateSettings
  // -----------------------------------------------------------
  describe('saveUpdateSettings', () => {
    it('throws 400 when profiles is not an array', async () => {
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: { profiles: 'not-array' }
      })
      const res = mockRes()

      await expect(saveUpdateSettings(req, res)).rejects.toThrow('profiles must be an array')
    })

    it('throws 400 when profiles is missing', async () => {
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: {}
      })
      const res = mockRes()

      await expect(saveUpdateSettings(req, res)).rejects.toThrow('profiles must be an array')
    })

    it('throws 400 when a profile has no name', async () => {
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: { profiles: [{ name: '' }] }
      })
      const res = mockRes()

      await expect(saveUpdateSettings(req, res)).rejects.toThrow('Each profile must have a name')
    })

    it('throws 400 when a profile name is whitespace only', async () => {
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: { profiles: [{ name: '   ' }] }
      })
      const res = mockRes()

      await expect(saveUpdateSettings(req, res)).rejects.toThrow('Each profile must have a name')
    })

    it('throws 400 when a task has no name', async () => {
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: {
          profiles: [{
            name: 'Profile1',
            tasks: [{ name: '', sourcePath: 'bin/a.exe', targetPath: 'bin/a.exe' }]
          }]
        }
      })
      const res = mockRes()

      await expect(saveUpdateSettings(req, res)).rejects.toThrow('Each task requires a name')
    })

    it('throws 400 when a copy task has no sourcePath', async () => {
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: {
          profiles: [{
            name: 'Profile1',
            tasks: [{ name: 'T1', type: 'copy', sourcePath: '', targetPath: 'bin/a.exe' }]
          }]
        }
      })
      const res = mockRes()

      await expect(saveUpdateSettings(req, res)).rejects.toThrow('Copy task requires sourcePath and targetPath')
    })

    it('throws 400 when a copy task has no targetPath', async () => {
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: {
          profiles: [{
            name: 'Profile1',
            tasks: [{ name: 'T1', type: 'copy', sourcePath: 'bin/a.exe', targetPath: '' }]
          }]
        }
      })
      const res = mockRes()

      await expect(saveUpdateSettings(req, res)).rejects.toThrow('Copy task requires sourcePath and targetPath')
    })

    it('throws 400 when an exec task has no commandLine', async () => {
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: {
          profiles: [{
            name: 'Profile1',
            tasks: [{ name: 'T1', type: 'exec', commandLine: '' }]
          }]
        }
      })
      const res = mockRes()

      await expect(saveUpdateSettings(req, res)).rejects.toThrow('Exec task requires commandLine')
    })

    it('exec task with valid commandLine passes validation', async () => {
      mockSaveUpdateSettings.mockResolvedValue({ agentGroup: 'ars', profiles: [] })

      const profiles = [{
        name: 'P1',
        tasks: [{ name: 'Stop', type: 'exec', commandLine: 'net stop svc', args: ['stop', 'svc'], timeout: 30000 }]
      }]
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: { profiles }
      })
      const res = mockRes()

      await saveUpdateSettings(req, res)

      expect(mockSaveUpdateSettings).toHaveBeenCalled()
    })

    it('calls service with valid profiles containing tasks', async () => {
      const savedDoc = { agentGroup: 'ars', profiles: [{ name: 'P1', tasks: [] }] }
      mockSaveUpdateSettings.mockResolvedValue(savedDoc)

      const profiles = [
        { name: 'P1', tasks: [{ name: 'T1', sourcePath: 'release/bin/a.exe', targetPath: 'bin/a.exe' }] }
      ]
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: { profiles }
      })
      const res = mockRes()

      await saveUpdateSettings(req, res)

      expect(mockSaveUpdateSettings).toHaveBeenCalledWith('ars', profiles, 'tester')
      expect(res.json).toHaveBeenCalledWith(savedDoc)
    })

    it('uses "unknown" as updatedBy when no user is present', async () => {
      mockSaveUpdateSettings.mockResolvedValue({})

      const profiles = [{ name: 'P1', tasks: [] }]
      const req = mockReq({
        params: { agentGroup: 'ars' },
        body: { profiles },
        user: undefined
      })
      const res = mockRes()

      await saveUpdateSettings(req, res)

      expect(mockSaveUpdateSettings).toHaveBeenCalledWith('ars', profiles, 'unknown')
    })
  })

  // -----------------------------------------------------------
  // deployUpdate
  // -----------------------------------------------------------
  describe('deployUpdate', () => {
    it('throws 400 when agentGroup is missing', async () => {
      const req = mockReq({
        body: { profileId: 'prof_1', taskIds: ['t1'], targetEqpIds: ['e1'] }
      })
      const res = mockRes()

      await expect(deployUpdate(req, res)).rejects.toThrow('agentGroup is required')
    })

    it('throws 400 when profileId is missing', async () => {
      const req = mockReq({
        body: { agentGroup: 'ars', taskIds: ['t1'], targetEqpIds: ['e1'] }
      })
      const res = mockRes()

      await expect(deployUpdate(req, res)).rejects.toThrow('profileId is required')
    })

    it('throws 400 when taskIds is missing', async () => {
      const req = mockReq({
        body: { agentGroup: 'ars', profileId: 'prof_1', targetEqpIds: ['e1'] }
      })
      const res = mockRes()

      await expect(deployUpdate(req, res)).rejects.toThrow('taskIds array is required')
    })

    it('throws 400 when targetEqpIds is empty', async () => {
      const req = mockReq({
        body: { agentGroup: 'ars', profileId: 'prof_1', taskIds: ['t1'], targetEqpIds: [] }
      })
      const res = mockRes()

      await expect(deployUpdate(req, res)).rejects.toThrow('targetEqpIds array is required')
    })

    it('starts SSE and calls updateService.deployUpdate with taskIds', async () => {
      const deployResult = { total: 1, success: 1, failed: 0 }
      mockDeployUpdate.mockResolvedValue(deployResult)

      const req = mockReq({
        body: {
          agentGroup: 'ars',
          profileId: 'prof_1',
          taskIds: ['task_1'],
          targetEqpIds: ['EQP_01']
        }
      })
      const res = mockRes()

      await deployUpdate(req, res)

      expect(mockDeployUpdate).toHaveBeenCalledWith(
        'ars',
        'prof_1',
        ['task_1'],
        ['EQP_01'],
        expect.any(Function)  // onProgress callback
      )
    })
  })
})
