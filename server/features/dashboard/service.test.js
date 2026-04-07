import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAgentStatus,
  getAgentVersionDistribution,
  getResourceAgentStatus,
  getResourceAgentVersionDistribution,
  getDashboardSummary,
  _setDeps
} from './service.js'

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
// get/set/eval은 apiCache.getWithCache용 — 기본값은 cache MISS 경로 (set='OK', get=null)
// 캐시 HIT를 시뮬레이션하려면 mockRedis.get.mockResolvedValueOnce(JSON.stringify(value)) 사용
function createMockRedis(mgetResult, metaResults = []) {
  const pipelineCalls = []
  return {
    mget: vi.fn().mockResolvedValue(mgetResult),
    pipeline: vi.fn().mockReturnValue({
      hmget: vi.fn((...args) => pipelineCalls.push(args)),
      exec: vi.fn().mockResolvedValue(metaResults.map(r => [null, r]))
    }),
    // ── apiCache 레이어 mock (default: MISS 경로) ──
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    eval: vi.fn().mockResolvedValue(1),
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

  it('11. details 배열 반환 → 설비별 process, eqpModel, eqpId, status 포함', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-002' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-003' },
    ]
    const mockModel = createMockClientModel(clients)
    // EQP-001: running, EQP-002: not running, EQP-003: not running
    // MetaInfo: EQP-002 있음(Stopped), EQP-003 없음(NeverStarted)
    const mockRedis = createMockRedis(
      ['3600', null, null],
      [['6.8.5', null]]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentStatus({ includeDetails: true })

    expect(result.details).toBeDefined()
    expect(result.details).toHaveLength(3)
    expect(result.details).toEqual(expect.arrayContaining([
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001', status: 'Running' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-002', status: 'Stopped' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-003', status: 'Never Started' },
    ]))
  })

  it('12. Redis 미연결 시 details 모두 status: Unknown', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001' },
    ]
    const mockModel = createMockClientModel(clients)
    _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: false })

    const result = await getAgentStatus({ includeDetails: true })

    expect(result.details).toEqual([
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001', status: 'Unknown' },
    ])
  })

  it('13. details 정렬 → process → eqpModel → eqpId', async () => {
    const clients = [
      { process: 'ETCH', eqpModel: 'E1', eqpId: 'ETCH-E1-002' },
      { process: 'CVD', eqpModel: 'M2', eqpId: 'CVD-M2-001' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'CVD-M1-001' },
    ]
    const mockModel = createMockClientModel(clients)
    const mockRedis = createMockRedis(
      [null, null, null],
      [[null], [null], [null]]
    )
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentStatus({ includeDetails: true })

    expect(result.details[0].eqpId).toBe('CVD-M1-001')
    expect(result.details[1].eqpId).toBe('CVD-M2-001')
    expect(result.details[2].eqpId).toBe('ETCH-E1-002')
  })

  it('14. includeDetails 미전달 시 details는 undefined', async () => {
    const clients = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001' },
    ]
    const mockModel = createMockClientModel(clients)
    const mockRedis = createMockRedis(['3600'], [])
    _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

    const result = await getAgentStatus({})

    expect(result.details).toBeUndefined()
    expect(result.data).toBeDefined()
  })
})

// ====================================================================
// I10: Dashboard 캐시 레이어 회귀 테스트
//
// 회귀 방지: createMockRedis에 get/set/eval가 없으면 apiCache.getWithCache가
// 첫 번째 redis.get 호출에서 throw → catch → computeFn 직접 호출 (graceful 폴백)
// 경로로 silent bypass된다. 캐시 적용 여부에 관계없이 테스트가 통과해버린다.
//
// 아래 테스트들은 캐시 HIT/MISS/bypass(includeDetails) 경로가 실제로 동작하는지
// 명시적으로 검증한다.
// ====================================================================

describe('dashboard service - 캐시 레이어 (I10 회귀)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAgentStatus 캐시', () => {
    it('캐시 HIT — 캐시된 값 반환, ClientModel.find 미호출', async () => {
      const cachedPayload = {
        data: [{ process: 'CVD', agentCount: 5, runningCount: 3, stoppedCount: 1 }],
        details: undefined
      }
      const mockModel = createMockClientModel([])
      const mockRedis = createMockRedis([], [])
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedPayload))
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      const result = await getAgentStatus({})

      expect(result.data).toEqual(cachedPayload.data)
      expect(result.redisAvailable).toBe(true)
      expect(mockModel.find).not.toHaveBeenCalled()
      expect(mockRedis.mget).not.toHaveBeenCalled()
      expect(mockRedis.get).toHaveBeenCalledWith(expect.stringContaining('wm:cache:dashboard:agent-status'))
    })

    it('캐시 MISS — computeFn 실행 후 NX EX TTL=15초로 저장', async () => {
      const mockModel = createMockClientModel(mockClients)
      const mockRedis = createMockRedis(
        [null, null, null, null, null],
        [[null, null], [null], [null, null]]
      )
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      await getAgentStatus({})

      expect(mockModel.find).toHaveBeenCalled()
      // lock acquire (UUID owner, TTL 30s)
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('wm:lock:wm:cache:dashboard:agent-status'),
        expect.any(String),
        'NX', 'EX', 30
      )
      // cache write (TTL 15s, NX)
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('wm:cache:dashboard:agent-status'),
        expect.any(String),
        'EX', 15, 'NX'
      )
      // lock release via Lua eval
      expect(mockRedis.eval).toHaveBeenCalled()
    })

    it('includeDetails=true → 캐시 bypass (cache key 조회 없음)', async () => {
      const mockModel = createMockClientModel(mockClients)
      const mockRedis = createMockRedis(
        [null, null, null, null, null],
        [[null, null], [null], [null, null]]
      )
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      const result = await getAgentStatus({ includeDetails: true })

      expect(result.details).toBeDefined()
      // cache 키 조회 자체가 발생하지 않아야 함
      expect(mockRedis.get).not.toHaveBeenCalled()
      // cache write도 없어야 함
      const cacheWriteCalls = mockRedis.set.mock.calls.filter(c => c[0].startsWith('wm:cache:'))
      expect(cacheWriteCalls).toHaveLength(0)
    })

    it('필터 조합별 캐시 키 분리 — process=CVD vs process=ETCH는 다른 키', async () => {
      const mockModel = createMockClientModel([])
      const mockRedis = createMockRedis([], [])
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      await getAgentStatus({ process: 'CVD' })
      await getAgentStatus({ process: 'ETCH' })

      const cacheGetCalls = mockRedis.get.mock.calls.map(c => c[0])
      expect(cacheGetCalls).toHaveLength(2)
      expect(cacheGetCalls[0]).not.toBe(cacheGetCalls[1])
    })
  })

  describe('getAgentVersionDistribution 캐시', () => {
    it('캐시 HIT — 캐시된 값 반환, ClientModel.find 미호출', async () => {
      const cachedPayload = {
        data: [{ process: 'CVD', agentCount: 3, versionCounts: { '6.8.5': 3 } }],
        allVersions: ['6.8.5']
      }
      const mockModel = createMockClientModel([])
      const mockRedis = createMockRedis([], [])
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedPayload))
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      const result = await getAgentVersionDistribution({})

      expect(result.data).toEqual(cachedPayload.data)
      expect(result.allVersions).toEqual(['6.8.5'])
      expect(mockModel.find).not.toHaveBeenCalled()
    })

    it('캐시 MISS — TTL=30초로 저장', async () => {
      const clients = [{ process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001', agentVersion: { arsAgent: '6.8.5' } }]
      const mockModel = createMockClientModel(clients)
      const mockRedis = createMockRedis([null], [])
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      await getAgentVersionDistribution({})

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('wm:cache:dashboard:agent-version'),
        expect.any(String),
        'EX', 30, 'NX'
      )
    })

    it('includeDetails=true → 캐시 bypass', async () => {
      const clients = [{ process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001', agentVersion: { arsAgent: '6.8.5' } }]
      const mockModel = createMockClientModel(clients)
      const mockRedis = createMockRedis([null], [])
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      await getAgentVersionDistribution({ includeDetails: true })

      expect(mockRedis.get).not.toHaveBeenCalled()
    })
  })

  describe('getResourceAgentStatus 캐시', () => {
    it('캐시 HIT — 캐시된 값 반환', async () => {
      const cachedPayload = {
        data: [{ process: 'CVD', agentCount: 2, okCount: 2, warnCount: 0, shutdownCount: 0, stoppedCount: 0 }]
      }
      const mockModel = createMockClientModel([])
      const mockRedis = createMockRedis([], [])
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedPayload))
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      const result = await getResourceAgentStatus({})

      expect(result.data).toEqual(cachedPayload.data)
      expect(mockModel.find).not.toHaveBeenCalled()
    })

    it('캐시 MISS — TTL=15초로 저장', async () => {
      const clients = [{ process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001' }]
      const mockModel = createMockClientModel(clients)
      const mockRedis = createMockRedis([null], [[null]])
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      await getResourceAgentStatus({})

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('wm:cache:dashboard:resource-agent-status'),
        expect.any(String),
        'EX', 15, 'NX'
      )
    })

    it('includeDetails=true → 캐시 bypass', async () => {
      const clients = [{ process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001' }]
      const mockModel = createMockClientModel(clients)
      const mockRedis = createMockRedis([null], [[null]])
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      await getResourceAgentStatus({ includeDetails: true })

      expect(mockRedis.get).not.toHaveBeenCalled()
    })
  })

  describe('getResourceAgentVersionDistribution 캐시', () => {
    it('캐시 HIT — 캐시된 값 반환', async () => {
      const cachedPayload = {
        data: [{ process: 'CVD', agentCount: 1, versionCounts: { '1.0.0': 1 } }],
        allVersions: ['1.0.0']
      }
      const mockModel = createMockClientModel([])
      const mockRedis = createMockRedis([], [])
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedPayload))
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      const result = await getResourceAgentVersionDistribution({})

      expect(result.data).toEqual(cachedPayload.data)
      expect(mockModel.find).not.toHaveBeenCalled()
    })

    it('캐시 MISS — TTL=30초로 저장', async () => {
      const clients = [{ process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001', agentVersion: { resourceAgent: '1.0.0' } }]
      const mockModel = createMockClientModel(clients)
      const mockRedis = createMockRedis([null], [])
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      await getResourceAgentVersionDistribution({})

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('wm:cache:dashboard:resource-agent-version'),
        expect.any(String),
        'EX', 30, 'NX'
      )
    })
  })

  describe('getDashboardSummary 캐시', () => {
    function createSummaryModel({ total = 10, active = 7, processCounts = [{ _id: 'CVD', count: 6 }, { _id: 'ETCH', count: 4 }] } = {}) {
      return {
        countDocuments: vi.fn()
          .mockResolvedValueOnce(total)   // 1st call: total
          .mockResolvedValueOnce(active), // 2nd call: active
        aggregate: vi.fn().mockResolvedValue(processCounts)
      }
    }

    it('캐시 HIT — DB 쿼리 미호출, mock 값(uptime/errors/networkTraffic)은 항상 새로 생성', async () => {
      const cachedPayload = {
        activeClients: 7,
        totalClients: 10,
        inactiveClients: 3,
        activeRate: '70.0',
        processCounts: [{ process: 'CVD', count: 6 }, { process: 'ETCH', count: 4 }]
      }
      const mockModel = createSummaryModel()
      const mockRedis = createMockRedis([], [])
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedPayload))
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      const result = await getDashboardSummary()

      // DB 쿼리는 캐시 HIT으로 호출되지 않아야 함
      expect(mockModel.countDocuments).not.toHaveBeenCalled()
      expect(mockModel.aggregate).not.toHaveBeenCalled()
      // 캐시 데이터는 그대로 + mock 필드 추가
      expect(result.totalClients).toBe(10)
      expect(result.activeClients).toBe(7)
      expect(result.uptime).toBe('99.9%')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('networkTraffic')
    })

    it('캐시 MISS — DB 쿼리 실행 후 캐시 저장 + mock 값 결합', async () => {
      const mockModel = createSummaryModel({ total: 20, active: 15 })
      const mockRedis = createMockRedis([], [])
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      const result = await getDashboardSummary()

      expect(mockModel.countDocuments).toHaveBeenCalledTimes(2)
      expect(mockModel.aggregate).toHaveBeenCalledTimes(1)
      // cache write
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('wm:cache:dashboard:summary'),
        expect.any(String),
        'EX', 15, 'NX'
      )
      // 결합된 결과
      expect(result.totalClients).toBe(20)
      expect(result.activeClients).toBe(15)
      expect(result.inactiveClients).toBe(5)
      expect(result.uptime).toBe('99.9%')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('networkTraffic')
    })

    it('mock 값(errors)은 매 호출마다 새로 생성됨 — 캐시되지 않음', async () => {
      // 캐시 HIT 경로에서도 mock 값은 매번 생성되는지 검증
      const cachedPayload = {
        activeClients: 1, totalClients: 1, inactiveClients: 0, activeRate: '100.0', processCounts: []
      }
      const mockModel = createSummaryModel()
      const mockRedis = createMockRedis([], [])
      // 두 번 모두 캐시 HIT
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(cachedPayload))
        .mockResolvedValueOnce(JSON.stringify(cachedPayload))
      _setDeps({ ClientModel: mockModel, redisClient: mockRedis, isRedisAvailable: true })

      const r1 = await getDashboardSummary()
      const r2 = await getDashboardSummary()

      // 캐시 데이터는 동일
      expect(r1.totalClients).toBe(r2.totalClients)
      // mock 값은 별도 필드 (errors는 random 0~4 → property 존재 확인)
      expect(r1).toHaveProperty('errors')
      expect(r2).toHaveProperty('errors')
      expect(r1).toHaveProperty('networkTraffic')
      expect(r2).toHaveProperty('networkTraffic')
    })
  })

  describe('Redis 미연결 시 캐시 동작', () => {
    it('redisClient=null — 캐시 우회, computeFn 직접 호출 (graceful)', async () => {
      const mockModel = createMockClientModel(mockClients)
      _setDeps({ ClientModel: mockModel, redisClient: null, isRedisAvailable: false })

      const result = await getAgentStatus({})

      expect(result.data).toBeDefined()
      expect(result.redisAvailable).toBe(false)
    })
  })
})
