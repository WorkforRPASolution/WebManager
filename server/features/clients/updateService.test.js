/**
 * updateService — deployUpdate profile lookup tests (TDD)
 *
 * Uses _setDeps() dependency injection (same pattern as updateSettingsService._setModel).
 * vi.mock() does not intercept CJS require() in this project.
 */

import { Readable } from 'stream'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deployUpdate, testSourceConnection, _setDeps } from './updateService.js'

/** Helper: create a minimal readable stream for mock getFileStream */
function mockStream() {
  return Readable.from(Buffer.from('mock'))
}

// --- Mock dependencies ---
const mockGetProfile = vi.fn()
const mockCreateUpdateSource = vi.fn()
const mockUploadStreamToFile = vi.fn()
const mockExecuteRaw = vi.fn()
const mockResolveCommandPath = vi.fn(async (eqpId, cmd) => cmd)
const mockEnsureBasePaths = vi.fn(async () => {})

_setDeps({
  updateSettingsService: { getProfile: mockGetProfile },
  createUpdateSource: mockCreateUpdateSource,
  ftpService: { uploadStreamToFile: mockUploadStreamToFile },
  controlService: { executeRaw: mockExecuteRaw, resolveCommandPath: mockResolveCommandPath, ensureBasePaths: mockEnsureBasePaths }
})

describe('updateService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default passthrough (clearAllMocks does not reset mockResolvedValue)
    mockResolveCommandPath.mockImplementation(async (eqpId, cmd) => cmd)
    mockEnsureBasePaths.mockImplementation(async () => {})

    // Restore deps (some tests override ftpService)
    _setDeps({
      updateSettingsService: { getProfile: mockGetProfile },
      createUpdateSource: mockCreateUpdateSource,
      ftpService: { uploadStreamToFile: mockUploadStreamToFile },
      controlService: { executeRaw: mockExecuteRaw, resolveCommandPath: mockResolveCommandPath, ensureBasePaths: mockEnsureBasePaths }
    })

    // Default: createUpdateSource returns a source with required methods
    mockCreateUpdateSource.mockReturnValue({
      getFileStream: vi.fn(async () => mockStream()),
      listFiles: vi.fn(async () => []),
      listFilesRecursive: vi.fn(async () => []),
      close: vi.fn(async () => {})
    })
  })

  describe('deployUpdate — profile lookup', () => {
    it('profileId에 해당하는 프로필이 없으면 에러', async () => {
      mockGetProfile.mockResolvedValue(null)

      await expect(
        deployUpdate('ars', 'prof_999', ['task_1'], ['EQP_01'], null)
      ).rejects.toThrow('Profile not found: prof_999')
    })

    it('프로필의 tasks에서 taskIds로 필터링', async () => {
      const profile = {
        profileId: 'prof_1',
        name: 'Test Profile',
        tasks: [
          { taskId: 'task_1', type: 'copy', name: 'T1', sourcePath: 'bin/a.exe', targetPath: 'bin/a.exe' },
          { taskId: 'task_2', type: 'copy', name: 'T2', sourcePath: 'bin/b.exe', targetPath: 'bin/b.exe' },
          { taskId: 'task_3', type: 'copy', name: 'T3', sourcePath: 'bin/c.exe', targetPath: 'bin/c.exe' }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)

      const result = await deployUpdate('ars', 'prof_1', ['task_1', 'task_3'], ['EQP_01'], null)

      // Should have 2 tasks * 1 eqpId = 2 total
      expect(result.total).toBe(2)
      expect(mockGetProfile).toHaveBeenCalledWith('ars', 'prof_1')
    })
  })

  describe('deployUpdate — sourcePath/targetPath separation', () => {
    it('single file: sourcePath로 소스 캐시, targetPath로 FTP 업로드', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'copy', name: 'Agent', sourcePath: 'release/bin/agent.jar', targetPath: 'bin/agent.jar' }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockUploadStreamToFile.mockResolvedValue()

      const progressEvents = []
      await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01'], (p) => progressEvents.push(p))

      // FTP upload should use targetPath, not sourcePath
      expect(mockUploadStreamToFile).toHaveBeenCalledWith(
        'EQP_01',
        expect.anything(),
        '/bin/agent.jar'
      )

      expect(progressEvents[0].taskId).toBe('task_1')
      expect(progressEvents[0].status).toBe('success')
    })

    it('directory: sourcePath 하위 파일들을 targetPath 하위로 매핑하여 업로드', async () => {
      const mockSource = {
        getFileStream: vi.fn(async () => mockStream()),
        listFiles: vi.fn(async () => []),
        listFilesRecursive: vi.fn(async (dir) => {
          if (dir === 'release/config/') {
            return [
              { relativePath: 'release/config/a.json' },
              { relativePath: 'release/config/sub/b.json' }
            ]
          }
          return []
        }),
        close: vi.fn(async () => {})
      }
      mockCreateUpdateSource.mockReturnValue(mockSource)

      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'copy', name: 'Config', sourcePath: 'release/config/', targetPath: 'opt/config/' }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockUploadStreamToFile.mockResolvedValue()

      await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01'], null)

      // Should strip sourcePath prefix and prepend targetPath
      const uploadCalls = mockUploadStreamToFile.mock.calls
      const uploadedPaths = uploadCalls.map(c => c[2])
      expect(uploadedPaths).toContain('/opt/config/a.json')
      expect(uploadedPaths).toContain('/opt/config/sub/b.json')
    })

    it('directory: targetPath에 trailing /가 없어도 정상 동작', async () => {
      const mockSource = {
        getFileStream: vi.fn(async () => mockStream()),
        listFiles: vi.fn(async () => []),
        listFilesRecursive: vi.fn(async (dir) => {
          if (dir === 'release/config/') {
            return [{ relativePath: 'release/config/a.json' }]
          }
          return []
        }),
        close: vi.fn(async () => {})
      }
      mockCreateUpdateSource.mockReturnValue(mockSource)

      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'copy', name: 'Config', sourcePath: 'release/config/', targetPath: 'opt/config' }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockUploadStreamToFile.mockResolvedValue()

      await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01'], null)

      const uploadedPaths = mockUploadStreamToFile.mock.calls.map(c => c[2])
      expect(uploadedPaths).toContain('/opt/config/a.json')
    })

    it('targetPath에 leading /가 있어도 이중 슬래시 없이 동작', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'copy', name: 'Agent', sourcePath: 'release/bin/agent.jar', targetPath: '/bin/agent.jar' }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockUploadStreamToFile.mockResolvedValue()

      await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01'], null)

      const uploadedPath = mockUploadStreamToFile.mock.calls[0][2]
      expect(uploadedPath).toBe('/bin/agent.jar')
    })
  })

  describe('deployUpdate — directory partial upload error', () => {
    it('directory 업로드 중 실패 시 진행 상황을 에러 메시지에 포함', async () => {
      let uploadCount = 0
      const mockFtpUpload = vi.fn(async () => {
        uploadCount++
        if (uploadCount === 3) throw new Error('connection lost')
      })

      _setDeps({
        ftpService: { uploadStreamToFile: mockFtpUpload }
      })

      const mockSource = {
        getFileStream: vi.fn(async () => mockStream()),
        listFiles: vi.fn(async () => []),
        listFilesRecursive: vi.fn(async (dir) => {
          if (dir === 'release/config/') {
            return [
              { relativePath: 'release/config/a.json' },
              { relativePath: 'release/config/b.json' },
              { relativePath: 'release/config/c.json' },
              { relativePath: 'release/config/d.json' },
              { relativePath: 'release/config/e.json' }
            ]
          }
          return []
        }),
        close: vi.fn(async () => {})
      }
      mockCreateUpdateSource.mockReturnValue(mockSource)

      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'copy', name: 'Config', sourcePath: 'release/config/', targetPath: 'opt/config/' }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)

      const progressEvents = []
      await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01'], (p) => progressEvents.push(p))

      // Should have one error event
      const errorEvent = progressEvents.find(p => p.status === 'error')
      expect(errorEvent).toBeTruthy()
      expect(errorEvent.error).toMatch(/2\/5/)
      expect(errorEvent.error).toMatch(/connection lost/)
    })
  })

  describe('deployUpdate — exec task', () => {
    it('exec 태스크 성공: executeRaw 호출 + progress success', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'exec', name: 'Stop Agent', commandLine: 'net stop resourceagent', args: [], timeout: 30000 }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockExecuteRaw.mockResolvedValue({ success: true, output: 'stopped', error: null })

      const progressEvents = []
      const result = await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01'], (p) => progressEvents.push(p))

      expect(mockExecuteRaw).toHaveBeenCalledWith('EQP_01', 'net stop resourceagent', [], 30000)
      expect(progressEvents).toHaveLength(1)
      expect(progressEvents[0].status).toBe('success')
      expect(result.total).toBe(1)
      expect(result.success).toBe(1)
    })

    it('exec 태스크 실패: RPC error → progress error', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'exec', name: 'Stop Agent', commandLine: 'net stop resourceagent', args: [], timeout: 30000 }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockExecuteRaw.mockResolvedValue({ success: false, output: '', error: 'service not found' })

      const progressEvents = []
      const result = await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01'], (p) => progressEvents.push(p))

      expect(progressEvents[0].status).toBe('error')
      expect(progressEvents[0].error).toMatch(/service not found/)
      expect(result.failed).toBe(1)
    })

    it('cacheSourceFiles: exec 태스크는 소스 캐시에서 스킵', async () => {
      const mockSource = {
        getFileStream: vi.fn(async () => mockStream()),
        listFiles: vi.fn(async () => []),
        listFilesRecursive: vi.fn(async () => []),
        close: vi.fn(async () => {})
      }
      mockCreateUpdateSource.mockReturnValue(mockSource)

      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'exec', name: 'Stop', commandLine: 'net stop svc', args: [], timeout: 10000 },
          { taskId: 'task_2', type: 'copy', name: 'Binary', sourcePath: 'bin/a.exe', targetPath: 'bin/a.exe' }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockUploadStreamToFile.mockResolvedValue()
      mockExecuteRaw.mockResolvedValue({ success: true, output: '', error: null })

      await deployUpdate('ars', 'prof_1', ['task_1', 'task_2'], ['EQP_01'], null)

      // getFileStream should only be called for copy task (task_2), not exec task (task_1)
      expect(mockSource.getFileStream).toHaveBeenCalledTimes(1)
    })
  })

  describe('deployUpdate — exec relative path resolution', () => {
    it('상대경로(./): resolveCommandPath로 절대경로 변환 후 executeRaw 호출', async () => {
      mockResolveCommandPath.mockResolvedValue('C:/ARS/bin/install.bat')

      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'exec', name: 'Install', commandLine: './bin/install.bat', args: [], timeout: 30000 }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockExecuteRaw.mockResolvedValue({ success: true, output: 'ok', error: null })

      await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01'], null)

      expect(mockResolveCommandPath).toHaveBeenCalledWith('EQP_01', './bin/install.bat')
      expect(mockExecuteRaw).toHaveBeenCalledWith('EQP_01', 'C:/ARS/bin/install.bat', [], 30000)
    })

    it('절대경로: resolveCommandPath가 그대로 반환, executeRaw에 전달', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'exec', name: 'Kill', commandLine: 'C:/Windows/taskkill.exe', args: ['/f'], timeout: 30000 }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockExecuteRaw.mockResolvedValue({ success: true, output: 'ok', error: null })

      await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01'], null)

      expect(mockResolveCommandPath).toHaveBeenCalledWith('EQP_01', 'C:/Windows/taskkill.exe')
      expect(mockExecuteRaw).toHaveBeenCalledWith('EQP_01', 'C:/Windows/taskkill.exe', ['/f'], 30000)
    })

    it('경로 없는 명령어(net 등): resolveCommandPath가 그대로 반환', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'exec', name: 'Stop', commandLine: 'net', args: ['stop', 'svc'], timeout: 30000 }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockExecuteRaw.mockResolvedValue({ success: true, output: 'ok', error: null })

      await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01'], null)

      expect(mockResolveCommandPath).toHaveBeenCalledWith('EQP_01', 'net')
      expect(mockExecuteRaw).toHaveBeenCalledWith('EQP_01', 'net', ['stop', 'svc'], 30000)
    })
  })

  describe('deployUpdate — stopOnFail', () => {
    it('stopOnFail=true: 선행 실패 → 후속 태스크 skipped', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'exec', name: 'Stop', commandLine: 'net stop svc', stopOnFail: true, args: [], timeout: 10000 },
          { taskId: 'task_2', type: 'copy', name: 'Binary', sourcePath: 'bin/a.exe', targetPath: 'bin/a.exe' }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockExecuteRaw.mockResolvedValue({ success: false, output: '', error: 'failed' })
      mockUploadStreamToFile.mockResolvedValue()

      const progressEvents = []
      await deployUpdate('ars', 'prof_1', ['task_1', 'task_2'], ['EQP_01'], (p) => progressEvents.push(p))

      expect(progressEvents).toHaveLength(2)
      expect(progressEvents[0].status).toBe('error')
      expect(progressEvents[0].taskId).toBe('task_1')
      expect(progressEvents[1].status).toBe('skipped')
      expect(progressEvents[1].taskId).toBe('task_2')
      // copy task should NOT have been executed
      expect(mockUploadStreamToFile).not.toHaveBeenCalled()
    })

    it('stopOnFail=false: 선행 실패 → 후속 태스크 정상 실행', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'exec', name: 'Stop', commandLine: 'net stop svc', stopOnFail: false, args: [], timeout: 10000 },
          { taskId: 'task_2', type: 'copy', name: 'Binary', sourcePath: 'bin/a.exe', targetPath: 'bin/a.exe' }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockExecuteRaw.mockResolvedValue({ success: false, output: '', error: 'failed' })
      mockUploadStreamToFile.mockResolvedValue()

      const progressEvents = []
      await deployUpdate('ars', 'prof_1', ['task_1', 'task_2'], ['EQP_01'], (p) => progressEvents.push(p))

      expect(progressEvents).toHaveLength(2)
      expect(progressEvents[0].status).toBe('error')
      expect(progressEvents[1].status).toBe('success')
      // copy task SHOULD have been executed
      expect(mockUploadStreamToFile).toHaveBeenCalled()
    })

    it('eqpId별 독립: EQP_01 실패해도 EQP_02는 정상 진행', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'exec', name: 'Stop', commandLine: 'net stop svc', stopOnFail: true, args: [], timeout: 10000 },
          { taskId: 'task_2', type: 'copy', name: 'Binary', sourcePath: 'bin/a.exe', targetPath: 'bin/a.exe' }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      // EQP_01 fails, EQP_02 succeeds
      mockExecuteRaw.mockImplementation(async (eqpId) => {
        if (eqpId === 'EQP_01') return { success: false, output: '', error: 'failed' }
        return { success: true, output: 'ok', error: null }
      })
      mockUploadStreamToFile.mockResolvedValue()

      const progressEvents = []
      await deployUpdate('ars', 'prof_1', ['task_1', 'task_2'], ['EQP_01', 'EQP_02'], (p) => progressEvents.push(p))

      // EQP_01: task_1 error, task_2 skipped
      const eqp01Events = progressEvents.filter(p => p.eqpId === 'EQP_01')
      expect(eqp01Events).toHaveLength(2)
      expect(eqp01Events[0].status).toBe('error')
      expect(eqp01Events[1].status).toBe('skipped')

      // EQP_02: both tasks succeed
      const eqp02Events = progressEvents.filter(p => p.eqpId === 'EQP_02')
      expect(eqp02Events).toHaveLength(2)
      expect(eqp02Events[0].status).toBe('success')
      expect(eqp02Events[1].status).toBe('success')
    })
  })

  describe('deployUpdate — sequential execution per eqpId', () => {
    it('같은 eqpId 내 태스크가 순차 실행됨', async () => {
      const executionOrder = []
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'exec', name: 'Stop', commandLine: 'net stop svc', args: [], timeout: 10000 },
          { taskId: 'task_2', type: 'copy', name: 'Binary', sourcePath: 'bin/a.exe', targetPath: 'bin/a.exe' },
          { taskId: 'task_3', type: 'exec', name: 'Start', commandLine: 'net start svc', args: [], timeout: 10000 }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockExecuteRaw.mockImplementation(async (eqpId, cmd) => {
        executionOrder.push(`${eqpId}:exec:${cmd}`)
        return { success: true, output: 'ok', error: null }
      })
      mockUploadStreamToFile.mockImplementation(async (eqpId) => {
        executionOrder.push(`${eqpId}:copy`)
      })

      await deployUpdate('ars', 'prof_1', ['task_1', 'task_2', 'task_3'], ['EQP_01'], null)

      // Tasks must be in order for EQP_01
      expect(executionOrder).toEqual([
        'EQP_01:exec:net stop svc',
        'EQP_01:copy',
        'EQP_01:exec:net start svc'
      ])
    })
  })

  describe('deployUpdate — basePath 사전 해석', () => {
    it('exec 태스크(상대경로) 포함 → ensureBasePaths 호출', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'exec', name: 'Install', commandLine: '.\\install.bat', args: [], timeout: 30000 }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockExecuteRaw.mockResolvedValue({ success: true, output: 'ok', error: null })

      await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01', 'EQP_02'], null)

      expect(mockEnsureBasePaths).toHaveBeenCalledWith(['EQP_01', 'EQP_02'])
    })

    it('exec 태스크(절대경로) → ensureBasePaths 미호출', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'exec', name: 'Kill', commandLine: 'C:/EEG/install.bat', args: [], timeout: 30000 }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockExecuteRaw.mockResolvedValue({ success: true, output: 'ok', error: null })

      await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01'], null)

      expect(mockEnsureBasePaths).not.toHaveBeenCalled()
    })

    it('copy 태스크만 → ensureBasePaths 미호출', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'copy', name: 'Binary', sourcePath: 'bin/a.exe', targetPath: 'bin/a.exe' }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockUploadStreamToFile.mockResolvedValue()

      await deployUpdate('ars', 'prof_1', ['task_1'], ['EQP_01'], null)

      expect(mockEnsureBasePaths).not.toHaveBeenCalled()
    })

    it('exec + copy 혼합, exec에 상대경로 → ensureBasePaths 호출', async () => {
      const profile = {
        profileId: 'prof_1',
        tasks: [
          { taskId: 'task_1', type: 'copy', name: 'Binary', sourcePath: 'bin/a.exe', targetPath: 'bin/a.exe' },
          { taskId: 'task_2', type: 'exec', name: 'Cleanup', commandLine: './cleanup.sh', args: [], timeout: 30000 }
        ],
        source: { type: 'local', localPath: '/tmp/src' }
      }
      mockGetProfile.mockResolvedValue(profile)
      mockUploadStreamToFile.mockResolvedValue()
      mockExecuteRaw.mockResolvedValue({ success: true, output: 'ok', error: null })

      await deployUpdate('ars', 'prof_1', ['task_1', 'task_2'], ['EQP_01'], null)

      expect(mockEnsureBasePaths).toHaveBeenCalledWith(['EQP_01'])
    })
  })

  describe('testSourceConnection', () => {
    it('성공 시 ok: true와 파일 수를 반환', async () => {
      const mockSource = {
        listFiles: vi.fn(async () => [{ name: 'a.txt' }, { name: 'b/' }]),
        close: vi.fn(async () => {})
      }
      mockCreateUpdateSource.mockReturnValue(mockSource)

      const result = await testSourceConnection({ type: 'ftp', ftpHost: 'localhost' })

      expect(result.ok).toBe(true)
      expect(result.message).toMatch(/2/)
      expect(mockSource.close).toHaveBeenCalled()
    })

    it('연결 실패 시 ok: false와 에러 메시지를 반환', async () => {
      mockCreateUpdateSource.mockReturnValue({
        listFiles: vi.fn(async () => { throw new Error('ECONNREFUSED') }),
        close: vi.fn(async () => {})
      })

      const result = await testSourceConnection({ type: 'ftp', ftpHost: 'bad-host' })

      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/ECONNREFUSED/)
    })

    it('close 실패해도 결과를 정상 반환', async () => {
      mockCreateUpdateSource.mockReturnValue({
        listFiles: vi.fn(async () => []),
        close: vi.fn(async () => { throw new Error('close error') })
      })

      const result = await testSourceConnection({ type: 'ftp', ftpHost: 'localhost' })

      expect(result.ok).toBe(true)
    })
  })
})
