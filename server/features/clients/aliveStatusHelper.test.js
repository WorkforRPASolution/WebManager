import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAliveStatusWithVersions, _setDeps } from './aliveStatusHelper.js'

describe('getAliveStatusWithVersions', () => {
  const mockGetBatchAliveStatus = vi.fn()
  const mockGetBatchAgentVersions = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    _setDeps({
      getBatchAliveStatus: mockGetBatchAliveStatus,
      getBatchAgentVersions: mockGetBatchAgentVersions,
    })
  })

  it('merges alive statuses with agent versions', async () => {
    mockGetBatchAliveStatus.mockResolvedValue({
      EQP01: { alive: true, uptimeSeconds: 3600 },
      EQP02: { alive: false },
    })
    mockGetBatchAgentVersions.mockResolvedValue({
      EQP01: { arsAgent: '1.0', resourceAgent: '2.0' },
    })

    const result = await getAliveStatusWithVersions(['EQP01', 'EQP02'], 'ars_agent')

    expect(result.EQP01.alive).toBe(true)
    expect(result.EQP01.agentVersion).toEqual({ arsAgent: '1.0', resourceAgent: '2.0' })
    expect(result.EQP02.agentVersion).toEqual({ arsAgent: null, resourceAgent: null })
  })

  it('calls both services in parallel with correct args', async () => {
    mockGetBatchAliveStatus.mockResolvedValue({})
    mockGetBatchAgentVersions.mockResolvedValue({})

    await getAliveStatusWithVersions(['EQP01'], 'resource_agent')

    expect(mockGetBatchAliveStatus).toHaveBeenCalledWith(['EQP01'], 'resource_agent')
    expect(mockGetBatchAgentVersions).toHaveBeenCalledWith(['EQP01'])
  })

  it('defaults version to null object when not found', async () => {
    mockGetBatchAliveStatus.mockResolvedValue({
      EQP01: { alive: true },
    })
    mockGetBatchAgentVersions.mockResolvedValue({})

    const result = await getAliveStatusWithVersions(['EQP01'], 'ars_agent')
    expect(result.EQP01.agentVersion).toEqual({ arsAgent: null, resourceAgent: null })
  })
})
