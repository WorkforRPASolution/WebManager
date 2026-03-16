import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAgentStatus, _setDeps } from './service.js'

function createMockClientModel(clients) {
  return {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(clients)
      })
    })
  }
}

// pipeline mock: hmget 호출을 기록하고 exec 시 결과 반환
function createMockRedis(mgetResult, metaResults = []) {
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

describe('dashboard service - getAgentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. 필터 없이 호출 → 모든 Process별 집계 반환 (stoppedCount 포함)', async () => {
    const mockModel = createMockClientModel(mockClients)
    // MetaInfo: CVD-M1 hash에 001만 있음, CVD-M2 hash에 001 없음, ETCH-E1 hash에 001 있음 002 없음
    const mockRedis = createMockRedis(
      [null, null, null, null, null],
      [['6.8.5:7180', null], [null], ['1.0:7180', null]]  // CVD-M1(2), CVD-M2(1), ETCH-E1(2)
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentStatus({})

    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toEqual({ process: 'CVD', agentCount: 3, runningCount: 0, stoppedCount: 1 })
    expect(result.data[1]).toEqual({ process: 'ETCH', agentCount: 2, runningCount: 0, stoppedCount: 1 })
    expect(result.redisAvailable).toBe(true)
    expect(mockModel.find).toHaveBeenCalledWith({})
  })

  it('2. process 필터 → 해당 process만 반환', async () => {
    const cvdClients = mockClients.filter(c => c.process === 'CVD')
    const mockModel = createMockClientModel(cvdClients)
    const mockRedis = createMockRedis(
      [null, null, null],
      [[null, null], [null]]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentStatus({ process: 'CVD' })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].process).toBe('CVD')
    expect(result.data[0].agentCount).toBe(3)
    expect(result.data[0].stoppedCount).toBe(0)
    expect(mockModel.find).toHaveBeenCalledWith({ process: 'CVD' })
  })

  it('3. groupByModel: true → Process+Model 그룹핑 (stoppedCount 포함)', async () => {
    const mockModel = createMockClientModel(mockClients)
    const mockRedis = createMockRedis(
      [null, null, null, null, null],
      [['6.8.5', null], [null], [null, null]]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentStatus({ groupByModel: true })

    expect(result.data).toHaveLength(3)
    expect(result.data[0]).toEqual({ process: 'CVD', eqpModel: 'M1', agentCount: 2, runningCount: 0, stoppedCount: 1 })
    expect(result.data[1]).toEqual({ process: 'CVD', eqpModel: 'M2', agentCount: 1, runningCount: 0, stoppedCount: 0 })
    expect(result.data[2]).toEqual({ process: 'ETCH', eqpModel: 'E1', agentCount: 2, runningCount: 0, stoppedCount: 0 })
  })

  it('4. process + groupByModel + eqpModel → 특정 모델만', async () => {
    const filtered = mockClients.filter(c => c.process === 'CVD' && c.eqpModel === 'M1')
    const mockModel = createMockClientModel(filtered)
    const mockRedis = createMockRedis(
      [null, null],
      [[null, null]]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentStatus({ process: 'CVD', groupByModel: true, eqpModel: 'M1' })

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toEqual({ process: 'CVD', eqpModel: 'M1', agentCount: 2, runningCount: 0, stoppedCount: 0 })
    expect(mockModel.find).toHaveBeenCalledWith({ process: 'CVD', eqpModel: 'M1' })
  })

  it('5. Redis 미연결 → runningCount/stoppedCount 0, redisAvailable: false', async () => {
    const mockModel = createMockClientModel(mockClients)
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: false })

    const result = await getAgentStatus({})

    expect(result.redisAvailable).toBe(false)
    expect(result.data.every(d => d.runningCount === 0 && d.stoppedCount === 0)).toBe(true)
  })

  it('6. Redis alive 판정 → runningCount/stoppedCount 정확 집계', async () => {
    const mockModel = createMockClientModel(mockClients)
    // CVD-M1-001: alive(3600), CVD-M1-002: dead(null), CVD-M2-001: alive(OK:1800),
    // ETCH-E1-001: alive(100), ETCH-E1-002: dead(null)
    // not-running: CVD-M1-002 (idx 1), ETCH-E1-002 (idx 4)
    // MetaInfo hmget: CVD-M1 → [CVD-M1-002 있음], ETCH-E1 → [ETCH-E1-002 없음]
    const mockRedis = createMockRedis(
      ['3600', null, 'OK:1800', '100', null],
      [['6.8.5'], [null]]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentStatus({})

    // CVD: 3 agents, 2 running, 1 stopped (CVD-M1-002 has MetaInfo but not running)
    expect(result.data[0]).toEqual({ process: 'CVD', agentCount: 3, runningCount: 2, stoppedCount: 1 })
    // ETCH: 2 agents, 1 running, 0 stopped (ETCH-E1-002 has no MetaInfo → never started)
    expect(result.data[1]).toEqual({ process: 'ETCH', agentCount: 2, runningCount: 1, stoppedCount: 0 })
  })

  it('7. 빈 클라이언트 → data: []', async () => {
    const mockModel = createMockClientModel([])
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: true })

    const result = await getAgentStatus({})

    expect(result.data).toEqual([])
  })

  it('8. 다중 process 필터 (쉼표 구분) → $in 쿼리', async () => {
    const filtered = mockClients.filter(c => ['CVD', 'ETCH'].includes(c.process))
    const mockModel = createMockClientModel(filtered)
    const mockRedis = createMockRedis(
      [null, null, null, null, null],
      [['6.8.5', null], [null], [null, null]]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentStatus({ process: 'CVD,ETCH' })

    expect(result.data).toHaveLength(2)
    expect(mockModel.find).toHaveBeenCalledWith({ process: { $in: ['CVD', 'ETCH'] } })
  })

  it('9. 다중 eqpModel 필터 (쉼표 구분) → $in 쿼리', async () => {
    const filtered = mockClients.filter(c => ['M1', 'E1'].includes(c.eqpModel))
    const mockModel = createMockClientModel(filtered)
    const mockRedis = createMockRedis(
      [null, null, null, null],
      [['6.8.5', null], [null, null]]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentStatus({ groupByModel: true, eqpModel: 'M1,E1' })

    expect(result.data).toHaveLength(2)
    expect(mockModel.find).toHaveBeenCalledWith({ eqpModel: { $in: ['M1', 'E1'] } })
  })

  it('10. 3상태 구분: Running + Stopped(MetaInfo有) + NeverStarted(MetaInfo無)', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-002' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-003' },
    ]
    const mockModel = createMockClientModel(clients)
    // EQP-001: running, EQP-002: not running, EQP-003: not running
    // not-running: EQP-002 (idx 1), EQP-003 (idx 2)
    // MetaInfo hmget CVD-M1 → [EQP-002 있음, EQP-003 없음]
    const mockRedis = createMockRedis(
      ['3600', null, null],
      [['6.8.5', null]]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentStatus({})

    expect(result.data[0]).toEqual({
      process: 'CVD',
      agentCount: 3,
      runningCount: 1,
      stoppedCount: 1,   // EQP-002: MetaInfo 있지만 not running
      // neverStarted = agentCount - runningCount - stoppedCount = 1
    })
  })
})
