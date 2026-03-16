import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getResourceAgentStatus, getResourceAgentVersionDistribution, _setDeps } from './service.js'

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
 * @param {Array} mgetResult - AgentHealth MGET 결과
 * @param {Array} metaResults - ResourceAgentMetaInfo pipeline HMGET 결과
 */
function createMockRedis(mgetResult = [], metaResults = []) {
  const pipelineCalls = []
  return {
    mget: vi.fn().mockResolvedValue(mgetResult),
    pipeline: vi.fn().mockReturnValue({
      hmget: vi.fn((...args) => pipelineCalls.push(args)),
      exec: vi.fn().mockResolvedValue(metaResults.map(r => [null, r]))
    }),
    _pipelineCalls: pipelineCalls
  }
}

const mockClients = [
  { process: 'CVD', eqpModel: 'M1', eqpId: 'CVD-M1-001' },
  { process: 'CVD', eqpModel: 'M1', eqpId: 'CVD-M1-002' },
  { process: 'CVD', eqpModel: 'M2', eqpId: 'CVD-M2-001' },
  { process: 'ETCH', eqpModel: 'E1', eqpId: 'ETCH-E1-001' },
  { process: 'ETCH', eqpModel: 'E1', eqpId: 'ETCH-E1-002' },
]

// ===================================================
// ResourceAgent Status Tests (5상태: OK/WARN/SHUTDOWN/Stopped/NeverStarted)
// ===================================================
describe('dashboard service - getResourceAgentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. 5상태 분류: OK + WARN + SHUTDOWN + Stopped + NeverStarted', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-002' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-003' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-004' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-005' },
    ]
    const mockModel = createMockClientModel(clients)
    // EQP-001: OK:3600, EQP-002: WARN:1800:high_cpu, EQP-003: SHUTDOWN:900, EQP-004: null(not running), EQP-005: null(not running)
    // ResourceAgentMetaInfo hmget: CVD-M1 → [EQP-004 있음(Stopped), EQP-005 없음(NeverStarted)]
    const mockRedis = createMockRedis(
      ['OK:3600', 'WARN:1800:high_cpu', 'SHUTDOWN:900', null, null],
      [['1.0.0:7180', null]]  // CVD-M1 hash: EQP-004 has value, EQP-005 doesn't
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getResourceAgentStatus({})

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toEqual({
      process: 'CVD',
      agentCount: 5,
      okCount: 1,
      warnCount: 1,
      shutdownCount: 1,
      stoppedCount: 1,
    })
    expect(result.redisAvailable).toBe(true)
  })

  it('2. process 필터 → 해당 process만 반환', async () => {
    const cvdClients = mockClients.filter(c => c.process === 'CVD')
    const mockModel = createMockClientModel(cvdClients)
    const mockRedis = createMockRedis(
      ['OK:100', 'WARN:200:reason', null],
      [[null]]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getResourceAgentStatus({ process: 'CVD' })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].process).toBe('CVD')
    expect(result.data[0].agentCount).toBe(3)
    expect(result.data[0].okCount).toBe(1)
    expect(result.data[0].warnCount).toBe(1)
    expect(mockModel.find).toHaveBeenCalledWith({ process: 'CVD' })
  })

  it('3. groupByModel: true → Process+Model 그룹핑', async () => {
    const mockModel = createMockClientModel(mockClients)
    // CVD-M1-001: OK, CVD-M1-002: WARN, CVD-M2-001: SHUTDOWN, ETCH-E1-001: OK, ETCH-E1-002: null
    const mockRedis = createMockRedis(
      ['OK:100', 'WARN:200:x', 'SHUTDOWN:300', 'OK:400', null],
      [[null]]  // ETCH-E1: EQP-002 no MetaInfo → NeverStarted
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getResourceAgentStatus({ groupByModel: true })

    expect(result.data).toHaveLength(3)
    expect(result.data[0]).toEqual({ process: 'CVD', eqpModel: 'M1', agentCount: 2, okCount: 1, warnCount: 1, shutdownCount: 0, stoppedCount: 0 })
    expect(result.data[1]).toEqual({ process: 'CVD', eqpModel: 'M2', agentCount: 1, okCount: 0, warnCount: 0, shutdownCount: 1, stoppedCount: 0 })
    expect(result.data[2]).toEqual({ process: 'ETCH', eqpModel: 'E1', agentCount: 2, okCount: 1, warnCount: 0, shutdownCount: 0, stoppedCount: 0 })
  })

  it('4. Redis 미연결 → 모든 카운트 0, redisAvailable: false', async () => {
    const mockModel = createMockClientModel(mockClients)
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: false })

    const result = await getResourceAgentStatus({})

    expect(result.redisAvailable).toBe(false)
    expect(result.data.every(d =>
      d.okCount === 0 && d.warnCount === 0 && d.shutdownCount === 0 && d.stoppedCount === 0
    )).toBe(true)
  })

  it('5. 빈 클라이언트 → data: []', async () => {
    const mockModel = createMockClientModel([])
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: true })

    const result = await getResourceAgentStatus({})

    expect(result.data).toEqual([])
    expect(result.details).toEqual([])
  })

  it('6. details 배열 → 설비별 5상태 포함', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-002' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-003' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-004' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-005' },
    ]
    const mockModel = createMockClientModel(clients)
    const mockRedis = createMockRedis(
      ['OK:3600', 'WARN:100:high_cpu', 'SHUTDOWN:50', null, null],
      [['1.0:7180', null]]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getResourceAgentStatus({})

    expect(result.details).toHaveLength(5)
    expect(result.details).toEqual(expect.arrayContaining([
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001', status: 'OK' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-002', status: 'WARN' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-003', status: 'SHUTDOWN' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-004', status: 'Stopped' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-005', status: 'Never Started' },
    ]))
  })

  it('7. Redis 미연결 시 details 모두 status: Unknown', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001' },
    ]
    const mockModel = createMockClientModel(clients)
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: false })

    const result = await getResourceAgentStatus({})

    expect(result.details).toEqual([
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001', status: 'Unknown' },
    ])
  })

  it('8. details 정렬 → process → eqpModel → eqpId', async () => {
    const clients = [
      { process: 'ETCH', eqpModel: 'E1', eqpId: 'ETCH-E1-002' },
      { process: 'CVD', eqpModel: 'M2', eqpId: 'CVD-M2-001' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'CVD-M1-001' },
    ]
    const mockModel = createMockClientModel(clients)
    const mockRedis = createMockRedis(
      ['OK:100', 'OK:200', 'OK:300'],
      []
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getResourceAgentStatus({})

    expect(result.details[0].eqpId).toBe('CVD-M1-001')
    expect(result.details[1].eqpId).toBe('CVD-M2-001')
    expect(result.details[2].eqpId).toBe('ETCH-E1-002')
  })

  it('9. AgentHealth 키 사용 (resource_agent agentGroup)', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001' },
    ]
    const mockModel = createMockClientModel(clients)
    const mockRedis = createMockRedis(['OK:3600'], [])
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    await getResourceAgentStatus({})

    // AgentHealth:resource_agent:CVD-M1-EQP-001 키를 사용해야 함
    expect(mockRedis.mget).toHaveBeenCalledWith(['AgentHealth:resource_agent:CVD-M1-EQP-001'])
  })
})

// ===================================================
// ResourceAgent Version Distribution Tests
// ===================================================
const mockClientsWithVersion = [
  { process: 'CVD', eqpModel: 'M1', eqpId: 'CVD-M1-001', agentVersion: { resourceAgent: '1.0.0' } },
  { process: 'CVD', eqpModel: 'M1', eqpId: 'CVD-M1-002', agentVersion: { resourceAgent: '1.1.0' } },
  { process: 'CVD', eqpModel: 'M2', eqpId: 'CVD-M2-001', agentVersion: { resourceAgent: null } },
  { process: 'ETCH', eqpModel: 'E1', eqpId: 'ETCH-E1-001', agentVersion: { resourceAgent: '1.0.0' } },
  { process: 'ETCH', eqpModel: 'E1', eqpId: 'ETCH-E1-002', agentVersion: { resourceAgent: null } },
]

describe('dashboard service - getResourceAgentVersionDistribution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. 기본 호출 → Process별 버전 분포 집계 (resourceAgent)', async () => {
    const mockModel = createMockClientModel(mockClientsWithVersion)
    // CVD-M2-001, ETCH-E1-002: MongoDB 버전 없음 → Redis fallback (ResourceAgentMetaInfo)
    const mockRedis = createMockRedis([], [['1.1.0:7180:CVD-M2-001:127.0.0.1:1'], [null]])
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getResourceAgentVersionDistribution({})

    expect(result.data).toHaveLength(2)
    // CVD: 1.0.0(1), 1.1.0(2, 하나는 MongoDB 하나는 Redis)
    expect(result.data[0].process).toBe('CVD')
    expect(result.data[0].agentCount).toBe(3)
    expect(result.data[0].versionCounts).toEqual({ '1.0.0': 1, '1.1.0': 2 })
    // ETCH: 1.0.0(1), Unknown(1)
    expect(result.data[1].process).toBe('ETCH')
    expect(result.data[1].agentCount).toBe(2)
    expect(result.data[1].versionCounts).toEqual({ '1.0.0': 1, 'Unknown': 1 })

    expect(result.allVersions).toEqual(['1.1.0', '1.0.0', 'Unknown'])
    expect(result.redisAvailable).toBe(true)
  })

  it('2. groupByModel: true → Process+Model별 집계', async () => {
    const mockModel = createMockClientModel(mockClientsWithVersion)
    const mockRedis = createMockRedis([], [['1.1.0:7180'], [null]])
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getResourceAgentVersionDistribution({ groupByModel: true })

    expect(result.data).toHaveLength(3)
    expect(result.data[0]).toMatchObject({ process: 'CVD', eqpModel: 'M1', agentCount: 2 })
    expect(result.data[0].versionCounts).toEqual({ '1.0.0': 1, '1.1.0': 1 })
  })

  it('3. runningOnly: true → AgentHealth:resource_agent 키로 필터링', async () => {
    const mockModel = createMockClientModel(mockClientsWithVersion)
    // AgentHealth:resource_agent 키 결과:
    // CVD-M1-001: OK, CVD-M1-002: null, CVD-M2-001: WARN, ETCH-E1-001: null, ETCH-E1-002: OK
    const mockRedis = createMockRedis(
      ['OK:3600', null, 'WARN:100:x', null, 'OK:200'],
      // Redis fallback for running agents without MongoDB version:
      // CVD-M2-001(running, no mongo) → ResourceAgentMetaInfo, ETCH-E1-002(running, no mongo) → ResourceAgentMetaInfo
      [['1.1.0:7180'], ['2.0.0:7180']]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getResourceAgentVersionDistribution({ runningOnly: true })

    expect(result.data).toHaveLength(2)
    // CVD: running만 → CVD-M1-001(1.0.0), CVD-M2-001(1.1.0 from redis)
    expect(result.data[0].process).toBe('CVD')
    expect(result.data[0].agentCount).toBe(2)
    expect(result.data[0].versionCounts).toEqual({ '1.0.0': 1, '1.1.0': 1 })
    // ETCH: running만 → ETCH-E1-002(2.0.0 from redis)
    expect(result.data[1].process).toBe('ETCH')
    expect(result.data[1].agentCount).toBe(1)
    expect(result.data[1].versionCounts).toEqual({ '2.0.0': 1 })
  })

  it('4. Redis 미연결 → MongoDB 버전만 사용', async () => {
    const mockModel = createMockClientModel(mockClientsWithVersion)
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: false })

    const result = await getResourceAgentVersionDistribution({})

    expect(result.redisAvailable).toBe(false)
    expect(result.data[0].versionCounts).toEqual({ '1.0.0': 1, '1.1.0': 1, 'Unknown': 1 })
    expect(result.data[1].versionCounts).toEqual({ '1.0.0': 1, 'Unknown': 1 })
  })

  it('5. runningOnly: true + Redis 미연결 → 빈 결과', async () => {
    const mockModel = createMockClientModel(mockClientsWithVersion)
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: false })

    const result = await getResourceAgentVersionDistribution({ runningOnly: true })

    expect(result.data.every(d => d.agentCount === 0)).toBe(true)
    expect(result.redisAvailable).toBe(false)
  })

  it('6. 빈 클라이언트 → data: [], allVersions: []', async () => {
    const mockModel = createMockClientModel([])
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: true })

    const result = await getResourceAgentVersionDistribution({})

    expect(result.data).toEqual([])
    expect(result.allVersions).toEqual([])
  })

  it('7. details 배열 → 설비별 version 포함', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E1', agentVersion: { resourceAgent: '1.0.0' } },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E2', agentVersion: { resourceAgent: null } },
    ]
    const mockModel = createMockClientModel(clients)
    const mockRedis = createMockRedis([], [['1.1.0:7180']])
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getResourceAgentVersionDistribution({})

    expect(result.details).toHaveLength(2)
    expect(result.details).toEqual(expect.arrayContaining([
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E1', version: '1.0.0' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E2', version: '1.1.0' },
    ]))
  })

  it('8. allVersions 정렬 → 내림차순, Unknown 마지막', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E1', agentVersion: { resourceAgent: '1.0.0' } },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E2', agentVersion: { resourceAgent: '2.0.0' } },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E3', agentVersion: { resourceAgent: '1.5.0' } },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E4', agentVersion: { resourceAgent: null } },
    ]
    const mockModel = createMockClientModel(clients)
    const mockRedis = createMockRedis([], [[null]])
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getResourceAgentVersionDistribution({})

    expect(result.allVersions).toEqual(['2.0.0', '1.5.0', '1.0.0', 'Unknown'])
  })

  it('9. ResourceAgentMetaInfo 키 사용 (AgentMetaInfo가 아님)', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'E1', agentVersion: { resourceAgent: null } },
    ]
    const mockModel = createMockClientModel(clients)
    const mockRedis = createMockRedis([], [['1.0.0:7180']])
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    await getResourceAgentVersionDistribution({})

    // ResourceAgentMetaInfo:CVD-M1 키 사용 확인
    const pipeline = mockRedis.pipeline()
    expect(mockRedis.pipeline).toHaveBeenCalled()
  })
})
