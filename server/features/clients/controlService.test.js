/**
 * controlService — UNREACHABLE status detection tests (TDD)
 *
 * Uses _setDeps() dependency injection (same pattern as updateService).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeAction, isConnectionError, _setDeps } from './controlService.js'

// --- Mock dependencies ---
const mockFindOne = vi.fn()
const mockStrategyGet = vi.fn()
const mockStrategyGetDefault = vi.fn()
const mockExecuteRaw = vi.fn()

_setDeps({
  Client: { findOne: mockFindOne },
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
