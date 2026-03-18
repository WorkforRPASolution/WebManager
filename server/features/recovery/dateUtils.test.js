import { describe, it, expect } from 'vitest'
import {
  computeHourlyBoundaries,
  computeDailyBoundaries,
  computeBoundariesForBucket,
  generateExpectedBuckets,
  floorToKSTBucket,
  formatKST
} from './dateUtils.js'

describe('dateUtils', () => {
  describe('formatKST', () => {
    it('converts a JS Date to KST ISO 8601 string', () => {
      // 2026-03-15 10:30:45.123 KST = 2026-03-15 01:30:45.123 UTC
      const date = new Date('2026-03-15T01:30:45.123Z')
      expect(formatKST(date)).toBe('2026-03-15T10:30:45.123+09:00')
    })

    it('handles midnight UTC (09:00 KST)', () => {
      const date = new Date('2026-03-15T00:00:00.000Z')
      expect(formatKST(date)).toBe('2026-03-15T09:00:00.000+09:00')
    })

    it('handles 15:00 UTC (next day 00:00 KST)', () => {
      const date = new Date('2026-03-15T15:00:00.000Z')
      expect(formatKST(date)).toBe('2026-03-16T00:00:00.000+09:00')
    })

    it('handles single-digit months and days with zero padding', () => {
      const date = new Date('2026-01-05T00:05:03.007Z')
      expect(formatKST(date)).toBe('2026-01-05T09:05:03.007+09:00')
    })
  })

  describe('computeHourlyBoundaries', () => {
    it('at 10:05 KST returns bucket 09:00, range 09:00~10:00', () => {
      // 10:05 KST = 01:05 UTC
      const now = new Date('2026-03-15T01:05:00.000Z')
      const result = computeHourlyBoundaries(now)

      // bucketStart: 09:00 KST = 00:00 UTC
      expect(result.bucketStart).toEqual(new Date('2026-03-15T00:00:00.000Z'))
      expect(result.dateGte).toBe('2026-03-15T09:00:00.000+09:00')
      expect(result.dateLt).toBe('2026-03-15T10:00:00.000+09:00')
    })

    it('at 00:05 KST returns bucket 23:00 of previous day', () => {
      // 00:05 KST on 2026-03-16 = 15:05 UTC on 2026-03-15
      const now = new Date('2026-03-15T15:05:00.000Z')
      const result = computeHourlyBoundaries(now)

      // Previous completed hour: 23:00 KST on 2026-03-15 = 14:00 UTC on 2026-03-15
      expect(result.bucketStart).toEqual(new Date('2026-03-15T14:00:00.000Z'))
      expect(result.dateGte).toBe('2026-03-15T23:00:00.000+09:00')
      expect(result.dateLt).toBe('2026-03-16T00:00:00.000+09:00')
    })

    it('at 01:30 KST returns bucket 00:00', () => {
      // 01:30 KST = 16:30 UTC previous day
      const now = new Date('2026-03-14T16:30:00.000Z')
      const result = computeHourlyBoundaries(now)

      // Previous completed hour: 00:00 KST on 2026-03-15 = 15:00 UTC on 2026-03-14
      expect(result.bucketStart).toEqual(new Date('2026-03-14T15:00:00.000Z'))
      expect(result.dateGte).toBe('2026-03-15T00:00:00.000+09:00')
      expect(result.dateLt).toBe('2026-03-15T01:00:00.000+09:00')
    })

    it('with settling=3 at 13:05 KST returns bucket for 10:00 KST', () => {
      // 13:05 KST = 04:05 UTC
      const now = new Date('2026-03-15T04:05:00.000Z')
      const result = computeHourlyBoundaries(now, 3)

      // now - 3h = 10:05 KST → floor to 10:00 KST → prev completed = 09:00 KST
      // 09:00 KST = 00:00 UTC
      expect(result.bucketStart).toEqual(new Date('2026-03-15T00:00:00.000Z'))
      expect(result.dateGte).toBe('2026-03-15T09:00:00.000+09:00')
      expect(result.dateLt).toBe('2026-03-15T10:00:00.000+09:00')
    })
  })

  describe('computeDailyBoundaries', () => {
    it('at 00:10 KST returns previous day boundaries', () => {
      // 00:10 KST on 2026-03-16 = 15:10 UTC on 2026-03-15
      const now = new Date('2026-03-15T15:10:00.000Z')
      const result = computeDailyBoundaries(now)

      // Previous completed day: 2026-03-15 KST full day
      // bucket: 2026-03-15 00:00 KST = 2026-03-14 15:00 UTC
      expect(result.bucketStart).toEqual(new Date('2026-03-14T15:00:00.000Z'))
      expect(result.dateGte).toBe('2026-03-15T00:00:00.000+09:00')
      expect(result.dateLt).toBe('2026-03-16T00:00:00.000+09:00')
    })

    it('at first day of month (2026-04-01 00:10 KST)', () => {
      // 00:10 KST on 2026-04-01 = 15:10 UTC on 2026-03-31
      const now = new Date('2026-03-31T15:10:00.000Z')
      const result = computeDailyBoundaries(now)

      // Previous completed day: 2026-03-31 KST
      // bucket: 2026-03-31 00:00 KST = 2026-03-30 15:00 UTC
      expect(result.bucketStart).toEqual(new Date('2026-03-30T15:00:00.000Z'))
      expect(result.dateGte).toBe('2026-03-31T00:00:00.000+09:00')
      expect(result.dateLt).toBe('2026-04-01T00:00:00.000+09:00')
    })

    it('at 14:00 KST returns previous day (yesterday)', () => {
      // 14:00 KST on 2026-03-16 = 05:00 UTC on 2026-03-16
      const now = new Date('2026-03-16T05:00:00.000Z')
      const result = computeDailyBoundaries(now)

      // Previous completed day: 2026-03-15 KST
      // bucket: 2026-03-15 00:00 KST = 2026-03-14 15:00 UTC
      expect(result.bucketStart).toEqual(new Date('2026-03-14T15:00:00.000Z'))
      expect(result.dateGte).toBe('2026-03-15T00:00:00.000+09:00')
      expect(result.dateLt).toBe('2026-03-16T00:00:00.000+09:00')
    })
  })

  describe('computeBoundariesForBucket', () => {
    it('hourly bucket 09:00 KST → dateGte=09:00, dateLt=10:00', () => {
      // 09:00 KST = 00:00 UTC
      const bucketDate = new Date('2026-03-15T00:00:00.000Z')
      const result = computeBoundariesForBucket('hourly', bucketDate)

      expect(result.bucketStart).toEqual(bucketDate)
      expect(result.dateGte).toBe('2026-03-15T09:00:00.000+09:00')
      expect(result.dateLt).toBe('2026-03-15T10:00:00.000+09:00')
    })

    it('daily bucket 2026-03-15 00:00 KST → dateGte=03/15 00:00, dateLt=03/16 00:00', () => {
      // 03/15 00:00 KST = 03/14 15:00 UTC
      const bucketDate = new Date('2026-03-14T15:00:00.000Z')
      const result = computeBoundariesForBucket('daily', bucketDate)

      expect(result.bucketStart).toEqual(bucketDate)
      expect(result.dateGte).toBe('2026-03-15T00:00:00.000+09:00')
      expect(result.dateLt).toBe('2026-03-16T00:00:00.000+09:00')
    })
  })

  describe('generateExpectedBuckets', () => {
    it('hourly 3시간 범위 → 3개 bucket', () => {
      // 09:00~12:00 KST → buckets: 09:00, 10:00, 11:00
      const start = new Date('2026-03-15T00:00:00.000Z') // 09:00 KST
      const end = new Date('2026-03-15T03:00:00.000Z')   // 12:00 KST
      const buckets = generateExpectedBuckets('hourly', start, end)

      expect(buckets).toHaveLength(3)
      expect(buckets[0]).toEqual(new Date('2026-03-15T00:00:00.000Z'))
      expect(buckets[1]).toEqual(new Date('2026-03-15T01:00:00.000Z'))
      expect(buckets[2]).toEqual(new Date('2026-03-15T02:00:00.000Z'))
    })

    it('daily 3일 범위 → 3개 bucket', () => {
      // 03/15~03/18 KST midnight
      const start = new Date('2026-03-14T15:00:00.000Z') // 03/15 00:00 KST
      const end = new Date('2026-03-17T15:00:00.000Z')   // 03/18 00:00 KST
      const buckets = generateExpectedBuckets('daily', start, end)

      expect(buckets).toHaveLength(3)
      expect(buckets[0]).toEqual(new Date('2026-03-14T15:00:00.000Z'))
      expect(buckets[1]).toEqual(new Date('2026-03-15T15:00:00.000Z'))
      expect(buckets[2]).toEqual(new Date('2026-03-16T15:00:00.000Z'))
    })

    it('빈 범위 (start === end) → 빈 배열', () => {
      const start = new Date('2026-03-15T00:00:00.000Z')
      const buckets = generateExpectedBuckets('hourly', start, start)
      expect(buckets).toEqual([])
    })

    it('daily 연도 경계 통과 (12/30~1/2) → 3개 bucket', () => {
      // 12/30 00:00 KST = 12/29 15:00 UTC
      const start = new Date('2025-12-29T15:00:00.000Z')
      // 01/02 00:00 KST = 01/01 15:00 UTC
      const end = new Date('2026-01-01T15:00:00.000Z')
      const buckets = generateExpectedBuckets('daily', start, end)

      expect(buckets).toHaveLength(3)
      // 12/30, 12/31, 01/01
      expect(buckets[0]).toEqual(new Date('2025-12-29T15:00:00.000Z'))
      expect(buckets[1]).toEqual(new Date('2025-12-30T15:00:00.000Z'))
      expect(buckets[2]).toEqual(new Date('2025-12-31T15:00:00.000Z'))
    })
  })

  describe('floorToKSTBucket', () => {
    it('hourly: 10:45 KST → 10:00 KST', () => {
      // 10:45 KST = 01:45 UTC
      const date = new Date('2026-03-15T01:45:00.000Z')
      const result = floorToKSTBucket('hourly', date)

      // 10:00 KST = 01:00 UTC
      expect(result).toEqual(new Date('2026-03-15T01:00:00.000Z'))
    })

    it('daily: 10:45 KST → 00:00 KST', () => {
      // 10:45 KST = 01:45 UTC
      const date = new Date('2026-03-15T01:45:00.000Z')
      const result = floorToKSTBucket('daily', date)

      // 03/15 00:00 KST = 03/14 15:00 UTC
      expect(result).toEqual(new Date('2026-03-14T15:00:00.000Z'))
    })

    it('hourly: 정각 10:00:00.000 → 10:00 KST (경계값)', () => {
      // 10:00 KST = 01:00 UTC
      const date = new Date('2026-03-15T01:00:00.000Z')
      const result = floorToKSTBucket('hourly', date)

      expect(result).toEqual(new Date('2026-03-15T01:00:00.000Z'))
    })
  })
})
