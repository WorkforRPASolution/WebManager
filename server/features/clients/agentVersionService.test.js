import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseAgentMetaInfoVersion,
  buildAgentMetaInfoKey,
  buildResourceAgentMetaInfoKey,
  getBatchAgentVersions,
  _setDeps,
} from './agentVersionService.js'

// --- parseAgentMetaInfoVersion ---
describe('parseAgentMetaInfoVersion', () => {
  it('extracts version from colon-separated value', () => {
    expect(parseAgentMetaInfoVersion('6.8.5.24:7180:EQP001:192.168.1.10:1'))
      .toBe('6.8.5.24')
  })

  it('returns null for null', () => {
    expect(parseAgentMetaInfoVersion(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(parseAgentMetaInfoVersion(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseAgentMetaInfoVersion('')).toBeNull()
  })

  it('returns full value if no colons (version only)', () => {
    expect(parseAgentMetaInfoVersion('7.0.0.0')).toBe('7.0.0.0')
  })
})

// --- buildAgentMetaInfoKey ---
describe('buildAgentMetaInfoKey', () => {
  it('creates key in format AgentMetaInfo:process-model', () => {
    expect(buildAgentMetaInfoKey('LINE01', 'MODEL_A'))
      .toBe('AgentMetaInfo:LINE01-MODEL_A')
  })
})

// --- buildResourceAgentMetaInfoKey ---
describe('buildResourceAgentMetaInfoKey', () => {
  it('creates key in format ResourceAgentMetaInfo:process-model', () => {
    expect(buildResourceAgentMetaInfoKey('LINE01', 'MODEL_A'))
      .toBe('ResourceAgentMetaInfo:LINE01-MODEL_A')
  })
})

// --- getBatchAgentVersions ---
describe('getBatchAgentVersions', () => {
  const mockPipeline = {
    hmget: vi.fn().mockReturnThis(),
    exec: vi.fn(),
  }
  const mockRedisClient = {
    pipeline: vi.fn(() => mockPipeline),
  }
  const mockClientModel = { find: vi.fn() }

  function setupMockFind(clients) {
    mockClientModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(clients),
      }),
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    _setDeps({ redisClient: mockRedisClient, ClientModel: mockClientModel })
  })

  it('returns version from MongoDB when agentVersion.arsAgent exists (still queries Redis for resourceAgent)', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1',
        agentVersion: { arsAgent: '7.0.0.0' } },
    ])
    // resGroups: ResourceAgentMetaInfo:ARS-M1 → ['EQP01']
    mockPipeline.exec.mockResolvedValue([[null, [null]]])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(mockPipeline.hmget).toHaveBeenCalledTimes(1)
    expect(mockPipeline.hmget).toHaveBeenCalledWith('ResourceAgentMetaInfo:ARS-M1', 'EQP01')
    expect(result.EQP01.arsAgent).toBe('7.0.0.0')
  })

  it('falls back to Redis when MongoDB has no arsAgent version', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1', agentVersion: {} },
    ])
    // arsGroups: AgentMetaInfo:ARS-M1 → ['EQP01']
    // resGroups: ResourceAgentMetaInfo:ARS-M1 → ['EQP01']
    mockPipeline.exec.mockResolvedValue([
      [null, ['6.8.5.24:7180:EQP01:192.168.1.10:1']],
      [null, [null]],
    ])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(mockPipeline.hmget).toHaveBeenCalledWith('AgentMetaInfo:ARS-M1', 'EQP01')
    expect(result.EQP01.arsAgent).toBe('6.8.5.24')
  })

  it('falls back to Redis when agentVersion field is missing entirely', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
    ])
    mockPipeline.exec.mockResolvedValue([
      [null, ['6.8.5.24:7180:EQP01:192.168.1.10:1']],
      [null, [null]],
    ])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(result.EQP01.arsAgent).toBe('6.8.5.24')
  })

  it('returns null when neither MongoDB nor Redis has version', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
    ])
    mockPipeline.exec.mockResolvedValue([[null, [null]], [null, [null]]])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(result.EQP01.arsAgent).toBeNull()
    expect(result.EQP01.resourceAgent).toBeNull()
  })

  it('returns resourceAgent from MongoDB', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1',
        agentVersion: { arsAgent: '7.0.0.0', resourceAgent: '1.2.0' } },
    ])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(result.EQP01.arsAgent).toBe('7.0.0.0')
    expect(result.EQP01.resourceAgent).toBe('1.2.0')
  })

  it('handles redisClient unavailable gracefully', async () => {
    _setDeps({ redisClient: null, ClientModel: mockClientModel })
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
    ])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(result.EQP01.arsAgent).toBeNull()
    expect(result.EQP01.resourceAgent).toBeNull()
  })

  it('handles empty eqpIds', async () => {
    const result = await getBatchAgentVersions([])
    expect(result).toEqual({})
  })

  it('handles unknown eqpId not in MongoDB', async () => {
    setupMockFind([])

    const result = await getBatchAgentVersions(['UNKNOWN'])

    expect(result.UNKNOWN.arsAgent).toBeNull()
    expect(result.UNKNOWN.resourceAgent).toBeNull()
  })

  it('only queries Redis for clients missing versions in MongoDB (batch)', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1',
        agentVersion: { arsAgent: '7.0.0.0' } },
      { eqpId: 'EQP02', process: 'ARS', eqpModel: 'M2' },
    ])
    // arsGroups: AgentMetaInfo:ARS-M2 → ['EQP02']
    // resGroups: ResourceAgentMetaInfo:ARS-M1 → ['EQP01'], ResourceAgentMetaInfo:ARS-M2 → ['EQP02']
    mockPipeline.exec.mockResolvedValue([
      [null, ['6.5.0.0:7180:EQP02:10.0.0.1:1']],
      [null, [null]],
      [null, [null]],
    ])

    const result = await getBatchAgentVersions(['EQP01', 'EQP02'])

    // 1 ars group + 2 res groups = 3 HMGET
    expect(mockPipeline.hmget).toHaveBeenCalledTimes(3)
    expect(mockPipeline.hmget).toHaveBeenCalledWith('AgentMetaInfo:ARS-M2', 'EQP02')
    expect(result.EQP01.arsAgent).toBe('7.0.0.0')
    expect(result.EQP02.arsAgent).toBe('6.5.0.0')
  })

  it('handles Redis pipeline error gracefully', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
    ])
    mockPipeline.exec.mockResolvedValue([
      [new Error('Redis error'), null],
      [new Error('Redis error'), null],
    ])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(result.EQP01.arsAgent).toBeNull()
    expect(result.EQP01.resourceAgent).toBeNull()
  })

  // --- resourceAgent Redis fallback ---
  it('falls back to Redis for resourceAgent when MongoDB has no resourceAgent', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1',
        agentVersion: { arsAgent: '7.0.0.0' } },
    ])
    // resGroups: ResourceAgentMetaInfo:ARS-M1 → ['EQP01']
    mockPipeline.exec.mockResolvedValue([[null, ['1.3.0']]])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(mockPipeline.hmget).toHaveBeenCalledWith('ResourceAgentMetaInfo:ARS-M1', 'EQP01')
    expect(result.EQP01.arsAgent).toBe('7.0.0.0')
    expect(result.EQP01.resourceAgent).toBe('1.3.0')
  })

  it('falls back to Redis for both arsAgent and resourceAgent', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
    ])
    // arsGroups: AgentMetaInfo:ARS-M1 → ['EQP01']
    // resGroups: ResourceAgentMetaInfo:ARS-M1 → ['EQP01']
    mockPipeline.exec.mockResolvedValue([
      [null, ['6.8.5.24:7180:EQP01:192.168.1.10:1']],
      [null, ['1.3.0']],
    ])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(mockPipeline.hmget).toHaveBeenCalledWith('AgentMetaInfo:ARS-M1', 'EQP01')
    expect(mockPipeline.hmget).toHaveBeenCalledWith('ResourceAgentMetaInfo:ARS-M1', 'EQP01')
    expect(result.EQP01.arsAgent).toBe('6.8.5.24')
    expect(result.EQP01.resourceAgent).toBe('1.3.0')
  })

  it('skips Redis for resourceAgent when MongoDB already has it', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1',
        agentVersion: { arsAgent: '7.0.0.0', resourceAgent: '1.2.0' } },
    ])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(mockRedisClient.pipeline).not.toHaveBeenCalled()
    expect(result.EQP01.resourceAgent).toBe('1.2.0')
  })

  it('returns null resourceAgent when neither MongoDB nor Redis has it', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1',
        agentVersion: { arsAgent: '7.0.0.0' } },
    ])
    // resGroups: ResourceAgentMetaInfo:ARS-M1 → ['EQP01']
    mockPipeline.exec.mockResolvedValue([[null, [null]]])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(result.EQP01.resourceAgent).toBeNull()
  })

  it('batch: selective Redis queries for both agent types', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1',
        agentVersion: { arsAgent: '7.0.0.0', resourceAgent: '1.2.0' } },
      { eqpId: 'EQP02', process: 'ARS', eqpModel: 'M2',
        agentVersion: { arsAgent: '7.1.0.0' } },
      { eqpId: 'EQP03', process: 'ARS', eqpModel: 'M1' },
    ])
    // arsGroups: AgentMetaInfo:ARS-M1 → ['EQP03']
    // resGroups: ResourceAgentMetaInfo:ARS-M2 → ['EQP02'], ResourceAgentMetaInfo:ARS-M1 → ['EQP03']
    mockPipeline.exec.mockResolvedValue([
      [null, ['6.8.0.0:7180:EQP03:10.0.0.3:1']],
      [null, ['1.4.0']],
      [null, ['1.5.0']],
    ])

    const result = await getBatchAgentVersions(['EQP01', 'EQP02', 'EQP03'])

    // EQP01: both from MongoDB — no Redis
    expect(result.EQP01.arsAgent).toBe('7.0.0.0')
    expect(result.EQP01.resourceAgent).toBe('1.2.0')
    // EQP02: arsAgent from MongoDB, resourceAgent from Redis
    expect(result.EQP02.arsAgent).toBe('7.1.0.0')
    expect(result.EQP02.resourceAgent).toBe('1.4.0')
    // EQP03: both from Redis
    expect(result.EQP03.arsAgent).toBe('6.8.0.0')
    expect(result.EQP03.resourceAgent).toBe('1.5.0')
    // 3 HMGET calls: 1 arsGroup + 2 resGroups
    expect(mockPipeline.hmget).toHaveBeenCalledTimes(3)
  })

  // --- HMGET grouping optimization ---
  it('groups same-model clients into single HMGET call', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
      { eqpId: 'EQP02', process: 'ARS', eqpModel: 'M1' },
      { eqpId: 'EQP03', process: 'ARS', eqpModel: 'M1' },
    ])
    // arsGroups: AgentMetaInfo:ARS-M1 → ['EQP01', 'EQP02', 'EQP03']
    // resGroups: ResourceAgentMetaInfo:ARS-M1 → ['EQP01', 'EQP02', 'EQP03']
    // 2 HMGET instead of 6 HGET
    mockPipeline.exec.mockResolvedValue([
      [null, ['6.1.0.0:x', '6.2.0.0:x', null]],
      [null, ['1.1.0', null, '1.3.0']],
    ])

    const result = await getBatchAgentVersions(['EQP01', 'EQP02', 'EQP03'])

    expect(mockPipeline.hmget).toHaveBeenCalledTimes(2)
    expect(mockPipeline.hmget).toHaveBeenCalledWith(
      'AgentMetaInfo:ARS-M1', 'EQP01', 'EQP02', 'EQP03'
    )
    expect(mockPipeline.hmget).toHaveBeenCalledWith(
      'ResourceAgentMetaInfo:ARS-M1', 'EQP01', 'EQP02', 'EQP03'
    )
    expect(result.EQP01.arsAgent).toBe('6.1.0.0')
    expect(result.EQP02.arsAgent).toBe('6.2.0.0')
    expect(result.EQP03.arsAgent).toBeNull()
    expect(result.EQP01.resourceAgent).toBe('1.1.0')
    expect(result.EQP02.resourceAgent).toBeNull()
    expect(result.EQP03.resourceAgent).toBe('1.3.0')
  })

  it('groups by process-model key across mixed models', async () => {
    setupMockFind([
      { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
      { eqpId: 'EQP02', process: 'ARS', eqpModel: 'M1' },
      { eqpId: 'EQP03', process: 'ARS', eqpModel: 'M2' },
    ])
    // arsGroups: ARS-M1 → ['EQP01','EQP02'], ARS-M2 → ['EQP03'] = 2 HMGET
    // resGroups: ARS-M1 → ['EQP01','EQP02'], ARS-M2 → ['EQP03'] = 2 HMGET
    // Total: 4 HMGET instead of 6 HGET
    mockPipeline.exec.mockResolvedValue([
      [null, ['6.1.0.0:x', '6.2.0.0:x']],
      [null, ['6.3.0.0:x']],
      [null, ['1.1.0', '1.2.0']],
      [null, ['1.3.0']],
    ])

    const result = await getBatchAgentVersions(['EQP01', 'EQP02', 'EQP03'])

    expect(mockPipeline.hmget).toHaveBeenCalledTimes(4)
    expect(mockPipeline.hmget).toHaveBeenCalledWith('AgentMetaInfo:ARS-M1', 'EQP01', 'EQP02')
    expect(mockPipeline.hmget).toHaveBeenCalledWith('AgentMetaInfo:ARS-M2', 'EQP03')
    expect(mockPipeline.hmget).toHaveBeenCalledWith('ResourceAgentMetaInfo:ARS-M1', 'EQP01', 'EQP02')
    expect(mockPipeline.hmget).toHaveBeenCalledWith('ResourceAgentMetaInfo:ARS-M2', 'EQP03')
    expect(result.EQP01.arsAgent).toBe('6.1.0.0')
    expect(result.EQP02.arsAgent).toBe('6.2.0.0')
    expect(result.EQP03.arsAgent).toBe('6.3.0.0')
    expect(result.EQP01.resourceAgent).toBe('1.1.0')
    expect(result.EQP02.resourceAgent).toBe('1.2.0')
    expect(result.EQP03.resourceAgent).toBe('1.3.0')
  })
})
