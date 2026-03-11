import { describe, it, expect } from 'vitest'
import { parseRedisUrl } from './redisConnection.js'

describe('parseRedisUrl', () => {
  describe('Sentinel 형식 ({host:port},...#masterName)', () => {
    it('3개 sentinel + master name 파싱', () => {
      const url = '{redis-node-0.redis-headless:26379},{redis-node-1.redis-headless:26379},{redis-node-2.redis-headless:26379}#mymaster'
      const result = parseRedisUrl(url)

      expect(result).toEqual({
        mode: 'sentinel',
        sentinels: [
          { host: 'redis-node-0.redis-headless', port: 26379 },
          { host: 'redis-node-1.redis-headless', port: 26379 },
          { host: 'redis-node-2.redis-headless', port: 26379 },
        ],
        name: 'mymaster',
      })
    })

    it('1개 sentinel도 파싱 가능', () => {
      const url = '{10.0.0.1:6379}#master1'
      const result = parseRedisUrl(url)

      expect(result).toEqual({
        mode: 'sentinel',
        sentinels: [{ host: '10.0.0.1', port: 6379 }],
        name: 'master1',
      })
    })

    it('포트 없으면 기본 26379 적용', () => {
      const url = '{sentinel1},{sentinel2}#mymaster'
      const result = parseRedisUrl(url)

      expect(result).toEqual({
        mode: 'sentinel',
        sentinels: [
          { host: 'sentinel1', port: 26379 },
          { host: 'sentinel2', port: 26379 },
        ],
        name: 'mymaster',
      })
    })
  })

  describe('단순 Redis URL 형식', () => {
    it('redis:// URL은 단순 모드 반환', () => {
      const url = 'redis://localhost:6379/0'
      const result = parseRedisUrl(url)

      expect(result).toEqual({
        mode: 'simple',
        url: 'redis://localhost:6379/0',
      })
    })

    it('인증 포함 URL도 단순 모드', () => {
      const url = 'redis://:password@host:6379/0'
      const result = parseRedisUrl(url)

      expect(result).toEqual({
        mode: 'simple',
        url: 'redis://:password@host:6379/0',
      })
    })
  })

  describe('엣지 케이스', () => {
    it('빈 문자열은 null 반환', () => {
      expect(parseRedisUrl('')).toBeNull()
    })

    it('null/undefined는 null 반환', () => {
      expect(parseRedisUrl(null)).toBeNull()
      expect(parseRedisUrl(undefined)).toBeNull()
    })
  })
})
