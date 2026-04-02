import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAgentVersionDistribution, _setDeps } from './service.js'

function createMockClientModel(clients) {
  return {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(clients)
      })
    })
  }
}

/**
 * Mock Redis 생성
 * @param {Array} mgetResult - AgentRunning MGET 결과 (runningOnly용)
 * @param {Array} metaResults - AgentMetaInfo pipeline HMGET 결과
 */
function createMockRedis(mgetResult = [], metaResults = []) {
  return {
    mget: vi.fn().mockResolvedValue(mgetResult),
    pipeline: vi.fn().mockReturnValue({
      hmget: vi.fn(),
      exec: vi.fn().mockResolvedValue(metaResults.map(r => [null, r]))
    })
  }
}

const mockClients = [
  { process: 'CVD', eqpModel: 'M1', eqpId: 'CVD-M1-001', agentVersion: { arsAgent: '7.0.0.0' } },
  { process: 'CVD', eqpModel: 'M1', eqpId: 'CVD-M1-002', agentVersion: { arsAgent: '6.8.5.24' } },
  { process: 'CVD', eqpModel: 'M2', eqpId: 'CVD-M2-001', agentVersion: { arsAgent: null } },
  { process: 'ETCH', eqpModel: 'E1', eqpId: 'ETCH-E1-001', agentVersion: { arsAgent: '7.0.0.0' } },
  { process: 'ETCH', eqpModel: 'E1', eqpId: 'ETCH-E1-002', agentVersion: { arsAgent: null } },
]

describe('dashboard service - getAgentVersionDistribution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. 기본 호출 → Process별 버전 분포 집계', async () => {
    const mockModel = createMockClientModel(mockClients)
    // CVD-M2-001, ETCH-E1-002 는 MongoDB 버전 없음 → Redis fallback
    // MetaInfo groups: CVD-M2 → [CVD-M2-001], ETCH-E1 → [ETCH-E1-002]
    const mockRedis = createMockRedis([], [['6.8.5.24:7180:CVD-M2-001:127.0.0.1:1'], [null]])
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentVersionDistribution({})

    expect(result.data).toHaveLength(2)
    // CVD: 7.0.0.0(1), 6.8.5.24(2, 하나는 MongoDB 하나는 Redis)
    expect(result.data[0].process).toBe('CVD')
    expect(result.data[0].agentCount).toBe(3)
    expect(result.data[0].versionCounts).toEqual({ '7.0.0.0': 1, '6.8.5.24': 2 })
    // ETCH: 7.0.0.0(1), Unknown(1, Redis도 없음)
    expect(result.data[1].process).toBe('ETCH')
    expect(result.data[1].agentCount).toBe(2)
    expect(result.data[1].versionCounts).toEqual({ '7.0.0.0': 1, 'Unknown': 1 })

    expect(result.allVersions).toEqual(['7.0.0.0', '6.8.5.24', 'Unknown'])
    expect(result.redisAvailable).toBe(true)
  })

  it('2. groupByModel: true → Process+Model별 집계', async () => {
    const mockModel = createMockClientModel(mockClients)
    const mockRedis = createMockRedis([], [['6.8.5.24:7180'], [null]])
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentVersionDistribution({ groupByModel: true })

    expect(result.data).toHaveLength(3)
    expect(result.data[0]).toMatchObject({ process: 'CVD', eqpModel: 'M1', agentCount: 2 })
    expect(result.data[0].versionCounts).toEqual({ '7.0.0.0': 1, '6.8.5.24': 1 })
    expect(result.data[1]).toMatchObject({ process: 'CVD', eqpModel: 'M2', agentCount: 1 })
    expect(result.data[1].versionCounts).toEqual({ '6.8.5.24': 1 })
    expect(result.data[2]).toMatchObject({ process: 'ETCH', eqpModel: 'E1', agentCount: 2 })
    expect(result.data[2].versionCounts).toEqual({ '7.0.0.0': 1, 'Unknown': 1 })
  })

  it('3. process 필터 → 해당 process만 반환', async () => {
    const cvdClients = mockClients.filter(c => c.process === 'CVD')
    const mockModel = createMockClientModel(cvdClients)
    const mockRedis = createMockRedis([], [['6.8.5.24:7180']])
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentVersionDistribution({ process: 'CVD' })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].process).toBe('CVD')
    expect(result.data[0].agentCount).toBe(3)
    expect(mockModel.find).toHaveBeenCalledWith({ process: 'CVD' })
  })

  it('4. runningOnly: true → Running 에이전트만 집계', async () => {
    const mockModel = createMockClientModel(mockClients)
    // CVD-M1-001: running(3600), CVD-M1-002: not running, CVD-M2-001: running(100),
    // ETCH-E1-001: not running, ETCH-E1-002: running(200)
    const mockRedis = createMockRedis(
      ['3600', null, '100', null, '200'],
      // MetaInfo for running agents only:
      // CVD-M2-001(running but no mongo version) → Redis fallback
      // ETCH-E1-002(running but no mongo version) → Redis fallback
      [['6.8.5.24:7180'], ['7.1.0.0:7180']]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentVersionDistribution({ runningOnly: true })

    expect(result.data).toHaveLength(2)
    // CVD: running만 → CVD-M1-001(7.0.0.0 from mongo), CVD-M2-001(6.8.5.24 from redis)
    expect(result.data[0].process).toBe('CVD')
    expect(result.data[0].agentCount).toBe(2)
    expect(result.data[0].versionCounts).toEqual({ '7.0.0.0': 1, '6.8.5.24': 1 })
    // ETCH: running만 → ETCH-E1-002(7.1.0.0 from redis)
    expect(result.data[1].process).toBe('ETCH')
    expect(result.data[1].agentCount).toBe(1)
    expect(result.data[1].versionCounts).toEqual({ '7.1.0.0': 1 })
  })

  it('5. Redis 미연결 → MongoDB 버전만 사용, 없으면 Unknown', async () => {
    const mockModel = createMockClientModel(mockClients)
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: false })

    const result = await getAgentVersionDistribution({})

    expect(result.redisAvailable).toBe(false)
    // MongoDB 버전만: CVD(7.0.0.0:1, 6.8.5.24:1, Unknown:1), ETCH(7.0.0.0:1, Unknown:1)
    expect(result.data[0].versionCounts).toEqual({ '7.0.0.0': 1, '6.8.5.24': 1, 'Unknown': 1 })
    expect(result.data[1].versionCounts).toEqual({ '7.0.0.0': 1, 'Unknown': 1 })
  })

  it('6. 빈 클라이언트 → data: [], allVersions: []', async () => {
    const mockModel = createMockClientModel([])
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: true })

    const result = await getAgentVersionDistribution({})

    expect(result.data).toEqual([])
    expect(result.allVersions).toEqual([])
  })

  it('7. allVersions 정렬 → 내림차순, Unknown 마지막', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E1', agentVersion: { arsAgent: '6.8.4.0' } },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E2', agentVersion: { arsAgent: '7.0.0.0' } },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E3', agentVersion: { arsAgent: '6.8.5.24' } },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E4', agentVersion: { arsAgent: null } },
    ]
    const mockModel = createMockClientModel(clients)
    const mockRedis = createMockRedis([], [[null]])  // E4 → Redis도 없음 → Unknown
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentVersionDistribution({})

    // 내림차순: 7.0.0.0 > 6.8.5.24 > 6.8.4.0, Unknown 마지막
    expect(result.allVersions).toEqual(['7.0.0.0', '6.8.5.24', '6.8.4.0', 'Unknown'])
  })

  it('8. 모든 에이전트 버전 Unknown → Unknown만 반환', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E1', agentVersion: { arsAgent: null } },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E2', agentVersion: {} },
    ]
    const mockModel = createMockClientModel(clients)
    const mockRedis = createMockRedis([], [[null, null]])
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentVersionDistribution({})

    expect(result.data[0].versionCounts).toEqual({ 'Unknown': 2 })
    expect(result.allVersions).toEqual(['Unknown'])
  })

  it('9. runningOnly: true + Redis 미연결 → 빈 결과', async () => {
    const mockModel = createMockClientModel(mockClients)
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: false })

    const result = await getAgentVersionDistribution({ runningOnly: true })

    // Redis 미연결이면 running 판단 불가 → 모든 agent 제외
    expect(result.data.every(d => d.agentCount === 0)).toBe(true)
    expect(result.redisAvailable).toBe(false)
  })

  it('10. details 배열 반환 → 설비별 process, eqpModel, eqpId, version 포함', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E1', agentVersion: { arsAgent: '7.0.0.0' } },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E2', agentVersion: { arsAgent: null } },
    ]
    const mockModel = createMockClientModel(clients)
    // E2: MongoDB 버전 없음 → Redis fallback → MetaInfo에서 6.8.5.24 획득
    const mockRedis = createMockRedis([], [['6.8.5.24:7180']])
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentVersionDistribution({ includeDetails: true })

    expect(result.details).toBeDefined()
    expect(result.details).toHaveLength(2)
    expect(result.details).toEqual(expect.arrayContaining([
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E1', version: '7.0.0.0' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E2', version: '6.8.5.24' },
    ]))
  })

  it('11. runningOnly: true → details에 running 에이전트만 포함', async () => {
    const mockModel = createMockClientModel(mockClients)
    // CVD-M1-001: running, CVD-M1-002: not, CVD-M2-001: running,
    // ETCH-E1-001: not, ETCH-E1-002: running
    const mockRedis = createMockRedis(
      ['3600', null, '100', null, '200'],
      [['6.8.5.24:7180'], ['7.1.0.0:7180']]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentVersionDistribution({ runningOnly: true, includeDetails: true })

    expect(result.details).toHaveLength(3)
    const eqpIds = result.details.map(d => d.eqpId).sort()
    expect(eqpIds).toEqual(['CVD-M1-001', 'CVD-M2-001', 'ETCH-E1-002'])
  })

  it('12. details 정렬 → process → eqpModel → eqpId', async () => {
    const clients = [
      { process: 'ETCH', eqpModel: 'E1', eqpId: 'ETCH-E1-001', agentVersion: { arsAgent: '7.0.0.0' } },
      { process: 'CVD', eqpModel: 'M2', eqpId: 'CVD-M2-001', agentVersion: { arsAgent: '7.0.0.0' } },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'CVD-M1-001', agentVersion: { arsAgent: '7.0.0.0' } },
    ]
    const mockModel = createMockClientModel(clients)
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: false })

    const result = await getAgentVersionDistribution({ includeDetails: true })

    expect(result.details[0].eqpId).toBe('CVD-M1-001')
    expect(result.details[1].eqpId).toBe('CVD-M2-001')
    expect(result.details[2].eqpId).toBe('ETCH-E1-001')
  })

  it('13. includeDetails 미전달 시 details는 undefined', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E1', agentVersion: { arsAgent: '7.0.0.0' } },
    ]
    const mockModel = createMockClientModel(clients)
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: false })

    const result = await getAgentVersionDistribution({})

    expect(result.details).toBeUndefined()
    expect(result.data).toBeDefined()
  })
})
