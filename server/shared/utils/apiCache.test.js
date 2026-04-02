import { describe, it, expect, vi } from 'vitest'

// Mock logger before importing module
vi.mock('../logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  })
}))

const { getWithCache, buildCacheKey, sleep } = await import('./apiCache.js')

// ── Helpers ──

function createMockRedis(getResult = null) {
  return {
    get: vi.fn().mockResolvedValue(getResult),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1)
  }
}

describe('apiCache', () => {
  // ── getWithCache ──

  describe('getWithCache', () => {
    it('캐시 HIT — cached 반환, computeFn 미호출', async () => {
      const cached = { data: [1, 2, 3] }
      const redis = createMockRedis(JSON.stringify(cached))
      const computeFn = vi.fn()

      const result = await getWithCache(redis, 'test:key', computeFn, 15)

      expect(result).toEqual(cached)
      expect(computeFn).not.toHaveBeenCalled()
      expect(redis.get).toHaveBeenCalledWith('test:key')
    })

    it('캐시 MISS — computeFn 호출, 결과 저장 후 반환', async () => {
      const redis = createMockRedis(null)
      redis.set.mockResolvedValueOnce('OK') // lock acquired
      const computed = { data: 'fresh' }
      const computeFn = vi.fn().mockResolvedValue(computed)

      const result = await getWithCache(redis, 'test:key', computeFn, 15)

      expect(result).toEqual(computed)
      expect(computeFn).toHaveBeenCalledOnce()
      expect(redis.set).toHaveBeenCalledWith('wm:lock:test:key', '1', 'NX', 'EX', 10)
      expect(redis.set).toHaveBeenCalledWith('test:key', JSON.stringify(computed), 'EX', 15)
    })

    it('뮤텍스 획득 성공 — lock NX → compute → SET → DEL lock', async () => {
      const redis = createMockRedis(null)
      redis.set.mockResolvedValueOnce('OK') // lock acquired
      const computeFn = vi.fn().mockResolvedValue({ ok: true })

      await getWithCache(redis, 'k', computeFn, 30)

      expect(redis.set).toHaveBeenCalledWith('wm:lock:k', '1', 'NX', 'EX', 10)
      expect(redis.set).toHaveBeenCalledWith('k', JSON.stringify({ ok: true }), 'EX', 30)
      expect(redis.del).toHaveBeenCalledWith('wm:lock:k')
    })

    it('뮤텍스 미획득 + 백오프 재시도 성공 — 대기 후 캐시 HIT', async () => {
      const redis = createMockRedis(null)
      redis.set.mockResolvedValueOnce(null) // lock fails
      // initial GET → null, retry 1 → null, retry 2 → hit
      redis.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify({ from: 'cache' }))

      const computeFn = vi.fn()
      const result = await getWithCache(redis, 'k', computeFn, 15)

      expect(result).toEqual({ from: 'cache' })
      expect(computeFn).not.toHaveBeenCalled()
    })

    it('뮤텍스 미획득 + 모든 재시도 실패 — fallback 직접 계산', async () => {
      const redis = createMockRedis(null)
      redis.set.mockResolvedValueOnce(null) // lock fails
      redis.get.mockResolvedValue(null) // all retries miss

      const computed = { fallback: true }
      const computeFn = vi.fn().mockResolvedValue(computed)

      const result = await getWithCache(redis, 'k', computeFn, 15)

      expect(result).toEqual(computed)
      expect(computeFn).toHaveBeenCalledOnce()
    })

    it('Redis null (unavailable) — computeFn 직접 호출', async () => {
      const computed = { direct: true }
      const computeFn = vi.fn().mockResolvedValue(computed)

      const result = await getWithCache(null, 'k', computeFn, 15)

      expect(result).toEqual(computed)
      expect(computeFn).toHaveBeenCalledOnce()
    })

    it('Redis GET 에러 — computeFn 직접 호출 (graceful)', async () => {
      const redis = createMockRedis()
      redis.get.mockRejectedValueOnce(new Error('Connection refused'))
      const computed = { graceful: true }
      const computeFn = vi.fn().mockResolvedValue(computed)

      const result = await getWithCache(redis, 'k', computeFn, 15)

      expect(result).toEqual(computed)
      expect(computeFn).toHaveBeenCalledOnce()
    })

    it('Redis SET 에러 — 결과 반환 (저장 실패해도 OK)', async () => {
      const redis = createMockRedis(null)
      redis.set
        .mockResolvedValueOnce('OK') // lock acquired
        .mockRejectedValueOnce(new Error('OOM')) // cache SET fails
      const computed = { data: 'ok' }
      const computeFn = vi.fn().mockResolvedValue(computed)

      const result = await getWithCache(redis, 'k', computeFn, 15)

      expect(result).toEqual(computed)
    })

    it('JSON.parse 에러 — miss로 처리, computeFn 호출', async () => {
      const redis = createMockRedis('invalid json{{{')
      const computed = { recomputed: true }
      const computeFn = vi.fn().mockResolvedValue(computed)

      const result = await getWithCache(redis, 'k', computeFn, 15)

      expect(result).toEqual(computed)
      expect(computeFn).toHaveBeenCalledOnce()
    })

    it('lock NX EX 10초 설정 확인 (홀더 크래시 대비)', async () => {
      const redis = createMockRedis(null)
      redis.set.mockResolvedValueOnce('OK')
      const computeFn = vi.fn().mockResolvedValue({})

      await getWithCache(redis, 'k', computeFn, 15)

      expect(redis.set).toHaveBeenCalledWith('wm:lock:k', '1', 'NX', 'EX', 10)
    })

    it('finally DEL 에러 — 원본 computeFn 에러 마스킹되지 않음', async () => {
      const redis = createMockRedis(null)
      redis.set.mockResolvedValueOnce('OK') // lock acquired
      redis.del.mockRejectedValueOnce(new Error('DEL failed'))
      const computeFn = vi.fn().mockRejectedValue(new Error('compute failed'))

      await expect(getWithCache(redis, 'k', computeFn, 15)).rejects.toThrow('compute failed')
    })
  })

  // ── buildCacheKey ──

  describe('buildCacheKey', () => {
    it('파라미터 없음 — wm:cache:{prefix}', () => {
      expect(buildCacheKey('dashboard:summary')).toBe('wm:cache:dashboard:summary')
      expect(buildCacheKey('dashboard:summary', {})).toBe('wm:cache:dashboard:summary')
    })

    it('파라미터 있음 — deterministic hash', () => {
      const key1 = buildCacheKey('test', { process: 'FAB1', groupByModel: true })
      const key2 = buildCacheKey('test', { process: 'FAB1', groupByModel: true })
      expect(key1).toBe(key2)
      expect(key1).toMatch(/^wm:cache:test:[a-f0-9]{32}$/)
    })

    it('쉼표 값 순서 무관 — A,B = B,A 동일 키', () => {
      const key1 = buildCacheKey('test', { process: 'A,B' })
      const key2 = buildCacheKey('test', { process: 'B,A' })
      expect(key1).toBe(key2)
    })

    it('null/undefined 제거', () => {
      const key1 = buildCacheKey('test', { a: null, b: undefined, c: 'val' })
      const key2 = buildCacheKey('test', { c: 'val' })
      expect(key1).toBe(key2)
    })

    it('boolean false 포함 — null/undefined와 구분', () => {
      const key1 = buildCacheKey('test', { groupByModel: false })
      const key2 = buildCacheKey('test', {})
      expect(key1).not.toBe(key2)
    })
  })

  // ── sleep ──

  describe('sleep', () => {
    it('지정 시간만큼 대기', async () => {
      const start = Date.now()
      await sleep(50)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(40)
    })
  })
})
