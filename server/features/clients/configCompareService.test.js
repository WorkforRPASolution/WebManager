import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compareConfigs, _setDeps } from './configCompareService.js'

const mockReadAllConfigs = vi.fn()
const mockRunConcurrently = vi.fn()

_setDeps({
  ftpService: { readAllConfigs: mockReadAllConfigs },
  runConcurrently: mockRunConcurrently
})

beforeEach(() => {
  vi.clearAllMocks()
  // 기본: runConcurrently는 handler를 순차 실행
  mockRunConcurrently.mockImplementation(async (items, handler, _concurrency) => {
    for (const item of items) {
      await handler(item)
    }
  })
})

describe('compareConfigs', () => {
  it('throws on empty eqpIds', async () => {
    await expect(compareConfigs([], 'arsAgent', vi.fn()))
      .rejects.toThrow('eqpIds must contain at least 2')
  })

  it('throws on single eqpId', async () => {
    await expect(compareConfigs(['EQP001'], 'arsAgent', vi.fn()))
      .rejects.toThrow('eqpIds must contain at least 2')
  })

  it('loads configs for each eqpId and calls onProgress', async () => {
    const configs = [
      { fileId: 'app', name: 'app.json', path: '/conf/app.json', content: '{"host":"0.0.0.0"}', error: null }
    ]
    mockReadAllConfigs.mockResolvedValue(configs)

    const onProgress = vi.fn()
    await compareConfigs(['EQP001', 'EQP002'], 'arsAgent', onProgress)

    expect(mockRunConcurrently).toHaveBeenCalledWith(
      ['EQP001', 'EQP002'],
      expect.any(Function),
      5
    )
    expect(mockReadAllConfigs).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'progress',
        eqpId: 'EQP001',
        status: 'loaded',
        configs: expect.any(Array)
      })
    )
  })

  it('reports error for failed FTP and continues others', async () => {
    mockReadAllConfigs
      .mockResolvedValueOnce([{ fileId: 'app', content: '{}', error: null }])
      .mockRejectedValueOnce(new Error('FTP timeout'))

    const onProgress = vi.fn()
    await compareConfigs(['EQP001', 'EQP002'], 'arsAgent', onProgress)

    // EQP001 성공
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ eqpId: 'EQP001', status: 'loaded' })
    )
    // EQP002 에러
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ eqpId: 'EQP002', status: 'error', error: 'FTP timeout' })
    )
  })

  it('passes concurrency=5 to runConcurrently', async () => {
    mockReadAllConfigs.mockResolvedValue([])

    await compareConfigs(['EQP001', 'EQP002'], 'arsAgent', vi.fn())

    expect(mockRunConcurrently).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Function),
      5
    )
  })
})
