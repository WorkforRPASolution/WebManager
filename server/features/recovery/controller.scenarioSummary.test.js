import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getScenarioSummary, exportScenarioSummary, _setDeps } = require('./controller.js')

// ── helpers ──

function mockReq(query = {}) {
  return { query }
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res },
    json(data) { res.body = data; return res }
  }
  return res
}

const mockService = {
  getScenarioSummary: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  _setDeps({ service: mockService })
})

describe('getScenarioSummary controller', () => {
  it('정상 조회 — paginated response 반환', async () => {
    mockService.getScenarioSummary.mockResolvedValue({
      data: [{ process: 'CVD', model: 'M1', ears_code: 'SC1', total: 10, success: 9, fail: 1 }],
      total: 1
    })

    const req = mockReq({ period: '30d', page: '1', pageSize: '50' })
    const res = mockRes()
    await getScenarioSummary(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('pagination')
    expect(res.body.pagination.total).toBe(1)
    expect(res.body.data).toHaveLength(1)
  })

  it('커스텀 기간 730일 초과 시 400 반환', async () => {
    const req = mockReq({
      period: 'custom',
      startDate: '2020-01-01',
      endDate: '2022-01-01'
    })
    const res = mockRes()
    await getScenarioSummary(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('커스텀 기간 730일 이내 시 서비스 호출', async () => {
    mockService.getScenarioSummary.mockResolvedValue({ data: [], total: 0 })

    const req = mockReq({
      period: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-04-01'
    })
    const res = mockRes()
    await getScenarioSummary(req, res)

    expect(mockService.getScenarioSummary).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(200)
  })

  it('process 쿼리 파라미터가 서비스에 전달된다', async () => {
    mockService.getScenarioSummary.mockResolvedValue({ data: [], total: 0 })

    const req = mockReq({ period: '30d', process: 'CVD,PVD' })
    const res = mockRes()
    await getScenarioSummary(req, res)

    const [filters] = mockService.getScenarioSummary.mock.calls[0]
    expect(filters.process).toBe('CVD,PVD')
  })
})

describe('exportScenarioSummary controller', () => {
  it('정상 export — data/truncated/limit 반환', async () => {
    mockService.getScenarioSummary.mockResolvedValue({
      data: [{ process: 'CVD', total: 10 }],
      total: 1
    })

    const req = mockReq({ period: '30d' })
    const res = mockRes()
    await exportScenarioSummary(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('truncated')
    expect(res.body).toHaveProperty('limit')
    expect(res.body.truncated).toBe(false)
    expect(res.body.limit).toBe(50000)
  })

  it('50,001 rows 반환 시 truncated=true, data는 50,000건', async () => {
    const largeData = Array.from({ length: 50001 }, (_, i) => ({ process: 'P', ears_code: `SC${i}` }))
    mockService.getScenarioSummary.mockResolvedValue({
      data: largeData,
      total: 50001
    })

    const req = mockReq({ period: '30d' })
    const res = mockRes()
    await exportScenarioSummary(req, res)

    expect(res.body.truncated).toBe(true)
    expect(res.body.data).toHaveLength(50000)
  })

  it('커스텀 기간 730일 초과 시 400 반환', async () => {
    const req = mockReq({
      period: 'custom',
      startDate: '2020-01-01',
      endDate: '2022-06-01'
    })
    const res = mockRes()
    await exportScenarioSummary(req, res)

    expect(res.statusCode).toBe(400)
  })
})
