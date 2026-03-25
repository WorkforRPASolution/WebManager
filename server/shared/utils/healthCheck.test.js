import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getHealthStatus, _setDeps } from './healthCheck.js'

describe('getHealthStatus', () => {
  let mockDeps

  beforeEach(() => {
    mockDeps = {
      earsReadyState: () => 1,      // 1 = connected
      wmReadyState: () => 1,        // 1 = connected
      isRedisAvailable: () => true,
      isEqpRedisAvailable: () => true,
      getEqpRedisClient: () => ({
        hlen: vi.fn()
          .mockResolvedValueOnce(15234)   // EQP_INFO
          .mockResolvedValueOnce(15234),  // EQP_INFO_LINE
        get: vi.fn().mockResolvedValue('15300')  // EQP_INFO_lastnum
      })
    }
    _setDeps(mockDeps)
  })

  it('all healthy → status ok', async () => {
    const result = await getHealthStatus()

    expect(result.status).toBe('ok')
    expect(result.timestamp).toBeDefined()
    expect(result.components.mongodb.status).toBe('ok')
    expect(result.components.redis_db0.status).toBe('ok')
    expect(result.components.redis_db10_eqp.status).toBe('ok')
  })

  it('Redis DB 0 down → status degraded', async () => {
    mockDeps.isRedisAvailable = () => false
    mockDeps.redisClientExists = () => true  // client exists but not ready

    const result = await getHealthStatus()

    expect(result.status).toBe('degraded')
    expect(result.components.mongodb.status).toBe('ok')
    expect(result.components.redis_db0.status).toBe('down')
  })

  it('Redis DB 10 down → status degraded', async () => {
    mockDeps.isEqpRedisAvailable = () => false
    // Client exists but not ready → down (not disabled)
    mockDeps.eqpRedisClientExists = () => true
    mockDeps.getEqpRedisClient = () => ({ status: 'reconnecting' })

    const result = await getHealthStatus()

    expect(result.status).toBe('degraded')
    expect(result.components.redis_db10_eqp.status).toBe('down')
  })

  it('MongoDB down → status down (EARS down)', async () => {
    mockDeps.earsReadyState = () => 0

    const result = await getHealthStatus()

    expect(result.status).toBe('down')
    expect(result.components.mongodb.status).toBe('down')
    expect(result.components.mongodb.ears).toBe('down')
    expect(result.components.mongodb.webManager).toBe('ok')
  })

  it('MongoDB down → status down (WEB_MANAGER down)', async () => {
    mockDeps.wmReadyState = () => 0

    const result = await getHealthStatus()

    expect(result.status).toBe('down')
    expect(result.components.mongodb.status).toBe('down')
    expect(result.components.mongodb.ears).toBe('ok')
    expect(result.components.mongodb.webManager).toBe('down')
  })

  it('includes EQP key counts when DB 10 available', async () => {
    const result = await getHealthStatus()

    expect(result.components.redis_db10_eqp.eqpInfoCount).toBe(15234)
    expect(result.components.redis_db10_eqp.eqpInfoLineCount).toBe(15234)
    expect(result.components.redis_db10_eqp.lastnum).toBe(15300)
  })

  it('Redis disabled → disabled status', async () => {
    mockDeps.isRedisAvailable = () => false
    mockDeps.isEqpRedisAvailable = () => false
    mockDeps.getEqpRedisClient = () => null
    // Simulate no REDIS_URL set scenario: both return false but not "down"
    // disabled = client is null (never connected)
    mockDeps.redisClientExists = () => false
    mockDeps.eqpRedisClientExists = () => false

    const result = await getHealthStatus()

    expect(result.components.redis_db0.status).toBe('disabled')
    expect(result.components.redis_db10_eqp.status).toBe('disabled')
    // When both Redis disabled but MongoDB up → ok (Redis is optional)
    expect(result.status).toBe('ok')
  })
})
