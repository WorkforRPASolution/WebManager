import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildAgentRunningKey,
  buildAgentHealthKey,
  parseAliveValue,
  formatUptime,
  getBatchAliveStatus,
  _setDeps,
} from './agentAliveService.js'

// --- buildAgentRunningKey ---
describe('buildAgentRunningKey', () => {
  it('creates key in format AgentRunning:process-model-eqpId', () => {
    expect(buildAgentRunningKey('ARS', 'M1', 'EQP01'))
      .toBe('AgentRunning:ARS-M1-EQP01')
  })
})

// --- buildAgentHealthKey ---
describe('buildAgentHealthKey', () => {
  it('creates key in format AgentHealth:process-model-eqpId', () => {
    expect(buildAgentHealthKey('ARS', 'M1', 'EQP01'))
      .toBe('AgentHealth:ARS-M1-EQP01')
  })
})

// --- parseAliveValue ---
describe('parseAliveValue', () => {
  it('returns not alive for null', () => {
    const result = parseAliveValue(null)
    expect(result.alive).toBe(false)
    expect(result.uptimeSeconds).toBeNull()
  })

  it('parses pure number string (current format)', () => {
    const result = parseAliveValue('3600')
    expect(result.alive).toBe(true)
    expect(result.uptimeSeconds).toBe(3600)
    expect(result.health).toBe('OK')
  })

  it('parses OK:seconds format (future)', () => {
    const result = parseAliveValue('OK:7200')
    expect(result.alive).toBe(true)
    expect(result.uptimeSeconds).toBe(7200)
    expect(result.health).toBe('OK')
  })

  it('parses WARN:seconds:reason format (future)', () => {
    const result = parseAliveValue('WARN:1800:deadlock')
    expect(result.alive).toBe(true)
    expect(result.uptimeSeconds).toBe(1800)
    expect(result.health).toBe('WARN')
    expect(result.reason).toBe('deadlock')
  })

  it('returns not alive for empty string', () => {
    const result = parseAliveValue('')
    expect(result.alive).toBe(false)
  })
})

// --- formatUptime ---
describe('formatUptime', () => {
  it('formats seconds only', () => {
    expect(formatUptime(45)).toBe('45s')
  })

  it('formats minutes and seconds', () => {
    expect(formatUptime(125)).toBe('2m 5s')
  })

  it('formats hours and minutes', () => {
    expect(formatUptime(3661)).toBe('1h 1m')
  })

  it('formats days and hours', () => {
    expect(formatUptime(86400)).toBe('1d 0h')
  })

  it('formats multiple days', () => {
    expect(formatUptime(90061)).toBe('1d 1h')
  })

  it('returns null for null input', () => {
    expect(formatUptime(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(formatUptime(undefined)).toBeNull()
  })
})

// --- getBatchAliveStatus ---
describe('getBatchAliveStatus', () => {
  const mockRedis = { mget: vi.fn() }
  const mockClientModel = {
    find: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    _setDeps({ redisClient: mockRedis, ClientModel: mockClientModel })
  })

  it('returns redisUnavailable when redis is null', async () => {
    _setDeps({ redisClient: null, ClientModel: mockClientModel })
    const result = await getBatchAliveStatus(['EQP01'])
    expect(result.EQP01.alive).toBeNull()
    expect(result.EQP01.redisUnavailable).toBe(true)
  })

  it('maps eqpIds to alive statuses via mget (both health and running keys)', async () => {
    mockClientModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
          { eqpId: 'EQP02', process: 'ARS', eqpModel: 'M2' },
        ])
      })
    })
    // mget returns: [health1, health2, running1, running2]
    // AgentHealth keys return null (no ResourceAgent), AgentRunning keys have values
    mockRedis.mget.mockResolvedValue([null, null, '3600', null])

    const result = await getBatchAliveStatus(['EQP01', 'EQP02'])

    expect(mockRedis.mget).toHaveBeenCalledWith(
      'AgentHealth:ARS-M1-EQP01',
      'AgentHealth:ARS-M2-EQP02',
      'AgentRunning:ARS-M1-EQP01',
      'AgentRunning:ARS-M2-EQP02'
    )
    expect(result.EQP01.alive).toBe(true)
    expect(result.EQP01.uptimeSeconds).toBe(3600)
    expect(result.EQP01.uptimeFormatted).toBe('1h 0m')
    expect(result.EQP02.alive).toBe(false)
  })

  it('uses AgentHealth value when only AgentHealth key exists (ResourceAgent)', async () => {
    mockClientModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
        ])
      })
    })
    // AgentHealth has value, AgentRunning is null
    mockRedis.mget.mockResolvedValue(['OK:7200', null])

    const result = await getBatchAliveStatus(['EQP01'])

    expect(result.EQP01.alive).toBe(true)
    expect(result.EQP01.uptimeSeconds).toBe(7200)
    expect(result.EQP01.health).toBe('OK')
  })

  it('falls back to AgentRunning when AgentHealth key is absent (legacy ARSAgent)', async () => {
    mockClientModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
        ])
      })
    })
    // AgentHealth is null, AgentRunning has value
    mockRedis.mget.mockResolvedValue([null, '3600'])

    const result = await getBatchAliveStatus(['EQP01'])

    expect(result.EQP01.alive).toBe(true)
    expect(result.EQP01.uptimeSeconds).toBe(3600)
    expect(result.EQP01.health).toBe('OK')
  })

  it('prefers AgentHealth over AgentRunning when both exist', async () => {
    mockClientModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
        ])
      })
    })
    // Both have values: AgentHealth='WARN:1800:high_cpu', AgentRunning='3600'
    mockRedis.mget.mockResolvedValue(['WARN:1800:high_cpu', '3600'])

    const result = await getBatchAliveStatus(['EQP01'])

    expect(result.EQP01.alive).toBe(true)
    expect(result.EQP01.uptimeSeconds).toBe(1800)
    expect(result.EQP01.health).toBe('WARN')
    expect(result.EQP01.reason).toBe('high_cpu')
  })

  it('handles empty eqpIds array', async () => {
    const result = await getBatchAliveStatus([])
    expect(result).toEqual({})
  })
})
