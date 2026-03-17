import { describe, it, expect } from 'vitest'
import { computeHourlyBoundaries, computeDailyBoundaries, formatKST } from './dateUtils.js'

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
})
