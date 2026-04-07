import { describe, it, expect, vi } from 'vitest'

vi.mock('../logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  })
}))

const { tryAcquireLock, releaseLock } = await import('./redisLock.js')

function createMockRedis() {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    eval: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1)
  }
}

describe('redisLock', () => {
  describe('tryAcquireLock', () => {
    it('락 획득 성공 — SET NX OK → true', async () => {
      const redis = createMockRedis()
      redis.set.mockResolvedValue('OK')

      const result = await tryAcquireLock(redis, 'wm:cron:lock:hourly', 'pod-a', 600)

      expect(result).toBe(true)
      expect(redis.set).toHaveBeenCalledWith('wm:cron:lock:hourly', 'pod-a', 'NX', 'EX', 600)
    })

    it('락 미획득 — SET NX null → false', async () => {
      const redis = createMockRedis()
      redis.set.mockResolvedValue(null)

      const result = await tryAcquireLock(redis, 'wm:cron:lock:hourly', 'pod-b', 600)

      expect(result).toBe(false)
    })

    it('Redis null → null (폴백 신호)', async () => {
      const result = await tryAcquireLock(null, 'key', 'owner', 600)
      expect(result).toBeNull()
    })

    it('Redis 에러 → null (graceful)', async () => {
      const redis = createMockRedis()
      redis.set.mockRejectedValue(new Error('Connection refused'))

      const result = await tryAcquireLock(redis, 'key', 'owner', 600)

      expect(result).toBeNull()
    })
  })

  describe('releaseLock', () => {
    it('릴리스 성공 — eval 호출 확인', async () => {
      const redis = createMockRedis()
      redis.eval.mockResolvedValue(1)

      await releaseLock(redis, 'wm:cron:lock:hourly', 'pod-a')

      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('get'"),
        1,
        'wm:cron:lock:hourly',
        'pod-a'
      )
    })

    it('소유자 불일치 — eval 반환 0, warn 로그', async () => {
      const redis = createMockRedis()
      redis.eval.mockResolvedValue(0)

      // Should not throw
      await releaseLock(redis, 'wm:cron:lock:hourly', 'pod-a')

      expect(redis.eval).toHaveBeenCalled()
    })

    it('Redis null — no-op', async () => {
      await releaseLock(null, 'key', 'owner')
      // Should not throw
    })

    it('Redis 에러 — graceful (no throw)', async () => {
      const redis = createMockRedis()
      redis.eval.mockRejectedValue(new Error('Connection closed'))

      await releaseLock(redis, 'key', 'owner')
      // Should not throw
    })
  })
})
