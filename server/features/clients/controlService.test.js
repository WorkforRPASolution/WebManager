/**
 * controlService — tests (TDD)
 *
 * Uses _setDeps() dependency injection (same pattern as updateService).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeAction, isConnectionError, detectBasePath, ensureBasePaths, resolveCommandPath, _setDeps } from './controlService.js'

// --- Mock dependencies ---
const mockFindOne = vi.fn()
const mockFind = vi.fn()
const mockUpdateOne = vi.fn()
const mockStrategyGet = vi.fn()
const mockStrategyGetDefault = vi.fn()
const mockExecuteRaw = vi.fn()

_setDeps({
  Client: { findOne: mockFindOne, find: mockFind, updateOne: mockUpdateOne },
  strategyRegistry: { get: mockStrategyGet, getDefault: mockStrategyGetDefault },
  executeRawFn: mockExecuteRaw
})

const fakeStrategy = {
  displayType: 'ars_agent',
  actions: { restart: { retries: 3, interval: 100 } },
  getCommand: vi.fn((action) => {
    if (action === 'status') return { commandLine: 'sc', args: ['query', 'ARSAgent'], timeout: 10000 }
    if (action === 'start') return { commandLine: 'net', args: ['start', 'ARSAgent'], timeout: 45000 }
    return null
  }),
  parseResponse: vi.fn((action, rpcResult) => ({
    running: true, state: 'RUNNING', raw: rpcResult.output || ''
  }))
}

function mockClient(overrides = {}) {
  const client = { serviceType: 'win_sc', basePath: '/app', ...overrides }
  mockFindOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(client) }) })
  return client
}

describe('isConnectionError', () => {
  it('should detect ECONNREFUSED', () => {
    expect(isConnectionError(new Error('connect ECONNREFUSED 127.0.0.1:7180'))).toBe(true)
  })

  it('should detect ETIMEDOUT', () => {
    expect(isConnectionError(new Error('connect ETIMEDOUT 10.0.0.1:7180'))).toBe(true)
  })

  it('should detect EHOSTUNREACH', () => {
    expect(isConnectionError(new Error('connect EHOSTUNREACH 10.0.0.1:7180'))).toBe(true)
  })

  it('should detect SOCKS connection failed', () => {
    expect(isConnectionError(new Error('SOCKS connection failed'))).toBe(true)
  })

  it('should detect Connection timeout', () => {
    expect(isConnectionError(new Error('Connection timeout after 10000ms'))).toBe(true)
  })

  it('should NOT detect Client not found', () => {
    expect(isConnectionError(new Error('Client not found: TEST_001'))).toBe(false)
  })

  it('should NOT detect No strategy found', () => {
    expect(isConnectionError(new Error('No strategy found for ars_agent'))).toBe(false)
  })
})

describe('executeAction UNREACHABLE', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStrategyGet.mockReturnValue(fakeStrategy)
  })

  it('should return UNREACHABLE when status + ECONNREFUSED', async () => {
    mockClient()
    mockExecuteRaw.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:7180'))

    const result = await executeAction('TEST_001', 'ars_agent', 'status')

    expect(result.displayType).toBe('ars_agent')
    expect(result.action).toBe('status')
    expect(result.data.running).toBe(false)
    expect(result.data.state).toBe('UNREACHABLE')
    expect(result.data.raw).toContain('ECONNREFUSED')
  })

  it('should return UNREACHABLE when status + ETIMEDOUT', async () => {
    mockClient()
    mockExecuteRaw.mockRejectedValue(new Error('connect ETIMEDOUT 10.0.0.1:7180'))

    const result = await executeAction('TEST_001', 'ars_agent', 'status')

    expect(result.data.state).toBe('UNREACHABLE')
  })

  it('should return UNREACHABLE when status + SOCKS connection failed', async () => {
    mockClient()
    mockExecuteRaw.mockRejectedValue(new Error('SOCKS connection failed'))

    const result = await executeAction('TEST_001', 'ars_agent', 'status')

    expect(result.data.state).toBe('UNREACHABLE')
  })

  it('should throw for start + ECONNREFUSED (not status)', async () => {
    mockClient()
    mockExecuteRaw.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:7180'))

    await expect(executeAction('TEST_001', 'ars_agent', 'start')).rejects.toThrow('ECONNREFUSED')
  })

  it('should throw for status + non-connection error', async () => {
    mockClient()
    mockExecuteRaw.mockRejectedValue(new Error('Some other RPC error'))

    await expect(executeAction('TEST_001', 'ars_agent', 'status')).rejects.toThrow('Some other RPC error')
  })
})

// --- detectBasePath (ManagerAgent 기반) ---

function mockClientForDetect(overrides = {}) {
  const client = { serviceType: 'win_sc', ipAddr: '10.0.0.1', ipAddrL: null, agentPorts: '7180', ...overrides }
  mockFindOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(client) }) })
  return client
}

describe('detectBasePath (ManagerAgent 기반)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateOne.mockResolvedValue({})
  })

  it('Windows: sc qc ManagerAgent → basePath 파싱', async () => {
    mockClientForDetect({ serviceType: 'win_sc' })
    mockExecuteRaw.mockResolvedValue({
      success: true,
      output: '        BINARY_PATH_NAME   : C:\\EEG\\bin\\ManagerAgent.exe',
      error: null
    })

    const result = await detectBasePath('EQP_01')

    expect(result).toBe('C:/EEG')
    expect(mockExecuteRaw).toHaveBeenCalledWith('EQP_01', 'sc', ['qc', 'ManagerAgent'], 10000)
    expect(mockUpdateOne).toHaveBeenCalledWith({ eqpId: 'EQP_01' }, { basePath: 'C:/EEG' })
  })

  it('Linux: systemctl show ManagerAgent → basePath 파싱', async () => {
    mockClientForDetect({ serviceType: 'linux_systemd' })
    mockExecuteRaw.mockResolvedValue({
      success: true,
      output: 'ExecStart={ path=/opt/EEG/bin/ManagerAgent ; argv[]=/opt/EEG/bin/ManagerAgent }',
      error: null
    })

    const result = await detectBasePath('EQP_01')

    expect(result).toBe('/opt/EEG')
    expect(mockExecuteRaw).toHaveBeenCalledWith('EQP_01', 'systemctl', ['show', 'ManagerAgent', '-p', 'ExecStart'], 10000)
  })

  it('Client not found → 에러', async () => {
    mockFindOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(null) }) })

    await expect(detectBasePath('EQP_MISSING')).rejects.toThrow('Client not found: EQP_MISSING')
  })

  it('ManagerAgent 서비스 미등록 → 에러', async () => {
    mockClientForDetect()
    mockExecuteRaw.mockResolvedValue({
      success: false,
      output: '',
      error: 'Process exited with an error: 1 (Exit value:1)'
    })

    await expect(detectBasePath('EQP_01')).rejects.toThrow()
  })

  it('BINARY_PATH_NAME에 /bin/ 없음 → 에러', async () => {
    mockClientForDetect()
    mockExecuteRaw.mockResolvedValue({
      success: true,
      output: '        BINARY_PATH_NAME   : C:\\ManagerAgent.exe',
      error: null
    })

    await expect(detectBasePath('EQP_01')).rejects.toThrow('Cannot extract basePath')
  })

  it('serviceType 미설정 → Windows(기본값) 로직 사용', async () => {
    mockClientForDetect({ serviceType: null })
    mockExecuteRaw.mockResolvedValue({
      success: true,
      output: '        BINARY_PATH_NAME   : C:\\EEG\\bin\\ManagerAgent.exe',
      error: null
    })

    const result = await detectBasePath('EQP_01')

    expect(result).toBe('C:/EEG')
    expect(mockExecuteRaw).toHaveBeenCalledWith('EQP_01', 'sc', ['qc', 'ManagerAgent'], 10000)
  })
})

// --- ensureBasePaths ---

describe('ensureBasePaths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateOne.mockResolvedValue({})
  })

  it('basePath 있는 클라이언트 → 스킵 (RPC 호출 없음)', async () => {
    mockFind.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) })

    await ensureBasePaths(['EQP_01', 'EQP_02'])

    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })

  it('basePath 없는 클라이언트만 감지', async () => {
    mockFind.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([
      { eqpId: 'EQP_02' }, { eqpId: 'EQP_05' }
    ]) }) })
    // detectBasePath 내부에서 findOne + executeRaw 호출
    mockFindOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ serviceType: 'win_sc' }) }) })
    mockExecuteRaw.mockResolvedValue({
      success: true,
      output: '        BINARY_PATH_NAME   : C:\\EEG\\bin\\ManagerAgent.exe',
      error: null
    })

    await ensureBasePaths(['EQP_01', 'EQP_02', 'EQP_05'])

    // executeRaw는 EQP_02, EQP_05에 대해서만 호출
    expect(mockExecuteRaw).toHaveBeenCalledTimes(2)
  })

  it('일부 실패 → warn 로그, 나머지 성공', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFind.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([
      { eqpId: 'EQP_02' }, { eqpId: 'EQP_05' }
    ]) }) })
    mockFindOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ serviceType: 'win_sc' }) }) })
    let callCount = 0
    mockExecuteRaw.mockImplementation(async (eqpId) => {
      callCount++
      if (callCount === 2) return { success: false, output: '', error: 'RPC failed' }
      return { success: true, output: '        BINARY_PATH_NAME   : C:\\EEG\\bin\\ManagerAgent.exe', error: null }
    })

    await ensureBasePaths(['EQP_02', 'EQP_05'])

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ensureBasePaths'))
    warnSpy.mockRestore()
  })

  it('전체 실패 → warn 로그 (throw 하지 않음)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFind.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([
      { eqpId: 'EQP_01' }, { eqpId: 'EQP_02' }
    ]) }) })
    mockFindOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(null) }) })

    // 함수 자체는 throw 하지 않음
    await expect(ensureBasePaths(['EQP_01', 'EQP_02'])).resolves.toBeUndefined()
    warnSpy.mockRestore()
  })
})

// --- resolveCommandPath ---

describe('resolveCommandPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateOne.mockResolvedValue({})
  })

  it('절대경로 → 그대로 반환', async () => {
    const result = await resolveCommandPath('EQP_01', 'C:/EEG/install.bat')

    expect(result).toBe('C:/EEG/install.bat')
    // DB 조회 없음
    expect(mockFindOne).not.toHaveBeenCalled()
  })

  it('상대경로 + DB basePath 있음 → 절대경로 변환', async () => {
    mockFindOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ basePath: 'C:/EEG' }) }) })

    const result = await resolveCommandPath('EQP_01', '.\\install.bat')

    expect(result).toBe('C:/EEG/install.bat')
  })

  it('상대경로 + DB basePath 없음 → detectBasePath 호출', async () => {
    // 1st findOne (resolveCommandPath): basePath 없음
    // 2nd findOne (detectBasePath): serviceType 반환
    mockFindOne
      .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve({ basePath: null }) }) })
      .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve({ serviceType: 'win_sc' }) }) })
    mockExecuteRaw.mockResolvedValue({
      success: true,
      output: '        BINARY_PATH_NAME   : C:\\EEG\\bin\\ManagerAgent.exe',
      error: null
    })

    const result = await resolveCommandPath('EQP_01', '.\\install.bat')

    expect(result).toBe('C:/EEG/install.bat')
  })

  it('상대경로 + detectBasePath 실패 → throw Error', async () => {
    mockFindOne
      .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve({ basePath: null }) }) })
      .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve(null) }) })

    await expect(resolveCommandPath('EQP_01', '.\\install.bat'))
      .rejects.toThrow('basePath를 감지할 수 없습니다')
  })
})
