import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleCompareConfigs, _setDeps } from './configCompareController.js'

const mockCompareConfigs = vi.fn()

// Mock SSE
function makeMockSSE() {
  const events = []
  return {
    send: (data) => events.push(data),
    end: vi.fn(),
    isAborted: () => false,
    _events: events
  }
}

let lastSSE
_setDeps({
  configCompareService: { compareConfigs: mockCompareConfigs },
  setupSSE: () => {
    lastSSE = makeMockSSE()
    return lastSSE
  }
})

function mockReq(overrides = {}) {
  return {
    body: {},
    user: { username: 'tester' },
    ...overrides
  }
}

function mockRes() {
  return {
    _status: 200,
    _headers: {},
    status: vi.fn(function(code) { this._status = code; return this }),
    json: vi.fn(),
    setHeader: vi.fn((k, v) => {}),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleCompareConfigs', () => {
  it('throws 400 when eqpIds missing', async () => {
    const req = mockReq({ body: { agentGroup: 'arsAgent' } })
    const res = mockRes()
    await expect(handleCompareConfigs(req, res)).rejects.toThrow('eqpIds array is required')
  })

  it('throws 400 when agentGroup missing', async () => {
    const req = mockReq({ body: { eqpIds: ['EQP001', 'EQP002'] } })
    const res = mockRes()
    await expect(handleCompareConfigs(req, res)).rejects.toThrow('agentGroup is required')
  })

  it('throws 400 when eqpIds has < 2 items', async () => {
    const req = mockReq({ body: { eqpIds: ['EQP001'], agentGroup: 'arsAgent' } })
    const res = mockRes()
    await expect(handleCompareConfigs(req, res)).rejects.toThrow('at least 2')
  })

  it('throws 400 when eqpIds has > 25 items', async () => {
    const ids = Array.from({ length: 26 }, (_, i) => `EQP${String(i).padStart(3, '0')}`)
    const req = mockReq({ body: { eqpIds: ids, agentGroup: 'arsAgent' } })
    const res = mockRes()
    await expect(handleCompareConfigs(req, res)).rejects.toThrow('maximum 25')
  })

  it('calls compareConfigs and sends done event on success', async () => {
    mockCompareConfigs.mockImplementation(async (eqpIds, agentGroup, onProgress) => {
      onProgress({ type: 'progress', eqpId: 'EQP001', status: 'loaded' })
      onProgress({ type: 'progress', eqpId: 'EQP002', status: 'loaded' })
    })

    const req = mockReq({ body: { eqpIds: ['EQP001', 'EQP002'], agentGroup: 'arsAgent' } })
    const res = mockRes()
    await handleCompareConfigs(req, res)

    expect(mockCompareConfigs).toHaveBeenCalledWith(
      ['EQP001', 'EQP002'],
      'arsAgent',
      expect.any(Function)
    )
    // SSE events: 2 progress + 1 done
    expect(lastSSE._events).toHaveLength(3)
    expect(lastSSE._events[2]).toMatchObject({ done: true, type: 'done', total: 2, loaded: 2, failed: 0 })
    expect(lastSSE.end).toHaveBeenCalled()
  })

  it('sends done event with error count when some fail', async () => {
    mockCompareConfigs.mockImplementation(async (eqpIds, agentGroup, onProgress) => {
      onProgress({ type: 'progress', eqpId: 'EQP001', status: 'loaded' })
      onProgress({ type: 'progress', eqpId: 'EQP002', status: 'error', error: 'FTP fail' })
    })

    const req = mockReq({ body: { eqpIds: ['EQP001', 'EQP002'], agentGroup: 'arsAgent' } })
    const res = mockRes()
    await handleCompareConfigs(req, res)

    const doneEvent = lastSSE._events[2]
    expect(doneEvent).toMatchObject({ done: true, type: 'done', total: 2, loaded: 1, failed: 1 })
  })
})
