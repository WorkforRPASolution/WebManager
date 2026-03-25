import { describe, it, expect } from 'vitest'
import { parsePeriod, validatePeriodRange, validateBackfillRange } from './validation.js'

describe('parsePeriod (validatePeriodParams)', () => {
  it('유효 기간 프리셋 통과', () => {
    for (const period of ['today', '7d', '30d', '90d', '1y']) {
      const result = parsePeriod(period)
      expect(result).not.toBeNull()
      expect(result.startDate).toBeDefined()
      expect(result.endDate).toBeDefined()
    }
  })

  it('custom + 날짜 → 통과', () => {
    const result = parsePeriod('custom', {
      startDate: '2026-03-01T00:00:00+09:00',
      endDate: '2026-03-20T23:59:59+09:00'
    })

    expect(result).not.toBeNull()
    expect(result.startDate).toBe('2026-03-01T00:00:00+09:00')
    expect(result.endDate).toBe('2026-03-20T23:59:59+09:00')
  })

  it('custom + startDate 누락 → null 반환', () => {
    const result = parsePeriod('custom', { endDate: '2026-03-20T23:59:59+09:00' })

    expect(result).toBeNull()
  })

  it('잘못된 period → today 기본값 사용 (null이 아닌 결과 반환)', () => {
    const result = parsePeriod('invalid_period')

    // parsePeriod defaults to today for unknown periods
    expect(result).not.toBeNull()
    expect(result.startDate).toBeDefined()
    expect(result.endDate).toBeDefined()
  })
})

describe('validatePeriodRange', () => {
  it('유효 범위 → 통과', () => {
    const result = validatePeriodRange(
      '2026-03-01T00:00:00Z',
      '2026-03-05T00:00:00Z',
      7
    )
    expect(result.valid).toBe(true)
  })

  it('최대 범위 초과 → 에러', () => {
    const result = validatePeriodRange(
      '2026-03-01T00:00:00Z',
      '2026-03-20T00:00:00Z',
      7
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('7 days')
  })

  it('startDate > endDate → 에러', () => {
    const result = validatePeriodRange(
      '2026-03-20T00:00:00Z',
      '2026-03-01T00:00:00Z',
      7
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('before')
  })

  it('날짜 누락 시 에러', () => {
    const result = validatePeriodRange(null, '2026-03-05T00:00:00Z')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('required')
  })
})

describe('validateBackfillRange', () => {
  it('유효 범위 → 통과', () => {
    const result = validateBackfillRange(
      '2026-01-01T00:00:00Z',
      '2026-03-01T00:00:00Z'
    )
    expect(result.valid).toBe(true)
  })

  it('최대 범위 초과 → 에러', () => {
    const result = validateBackfillRange(
      '2024-01-01T00:00:00Z',
      '2026-03-01T00:00:00Z'
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('730 days')
  })

  it('startDate > endDate → 에러', () => {
    const result = validateBackfillRange(
      '2026-03-20T00:00:00Z',
      '2026-03-01T00:00:00Z'
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('before')
  })

  it('날짜 누락 시 에러', () => {
    const result = validateBackfillRange(null, null)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('required')
  })

  it('잘못된 날짜 형식 → 에러', () => {
    const result = validateBackfillRange('not-a-date', '2026-03-01T00:00:00Z')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid')
  })
})
