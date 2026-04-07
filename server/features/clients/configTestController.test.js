import { describe, it, expect } from 'vitest'
import { filterByPattern, isAbsolutePath, resolveJodaTokens } from './configTestController'

describe('filterByPattern', () => {
  const files = [
    { name: 'TestLog_20260219.log', size: 100 },
    { name: 'TestLog_20260218.log.bak', size: 200 },
    { name: 'AppLog_20260219.log', size: 300 },
    { name: 'TestLog_20260219.txt', size: 400 },
  ]

  it('prefix 필터', () => {
    const result = filterByPattern(files, { prefix: 'TestLog', suffix: '', exclude_suffix: [] })
    expect(result).toHaveLength(3)
  })

  it('suffix 필터', () => {
    const result = filterByPattern(files, { prefix: '', suffix: '.log', exclude_suffix: [] })
    expect(result).toHaveLength(2)
  })

  it('exclude_suffix 필터', () => {
    const result = filterByPattern(files, { prefix: 'TestLog', suffix: '', exclude_suffix: ['.bak'] })
    expect(result).toHaveLength(2)
  })

  it('prefix + suffix 복합', () => {
    const result = filterByPattern(files, { prefix: 'TestLog', suffix: '.log', exclude_suffix: ['.bak'] })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('TestLog_20260219.log')
  })

  it('빈 조건 — 전체 반환', () => {
    const result = filterByPattern(files, { prefix: '', suffix: '', exclude_suffix: [] })
    expect(result).toHaveLength(4)
  })

  it('wildcard 필터', () => {
    const result = filterByPattern(files, { prefix: '', suffix: '', wildcard: '0219', exclude_suffix: [] })
    expect(result).toHaveLength(3)
    expect(result.every(f => f.name.includes('0219'))).toBe(true)
  })

  it('wildcard 필터 — 매칭 없음', () => {
    const result = filterByPattern(files, { prefix: '', suffix: '', wildcard: '0220', exclude_suffix: [] })
    expect(result).toHaveLength(0)
  })

  it('prefix + wildcard + suffix 복합', () => {
    const result = filterByPattern(files, { prefix: 'TestLog', suffix: '.log', wildcard: '0219', exclude_suffix: [] })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('TestLog_20260219.log')
  })
})

describe('resolveJodaTokens', () => {
  it('yyyy/MM/dd 토큰을 현재 날짜로 치환한다', () => {
    const now = new Date()
    const y = now.getFullYear().toString()
    const m = (now.getMonth() + 1).toString().padStart(2, '0')
    const d = now.getDate().toString().padStart(2, '0')
    expect(resolveJodaTokens('TestLog_yyyyMMdd')).toBe(`TestLog_${y}${m}${d}`)
  })

  it('토큰이 없으면 원본 그대로 반환', () => {
    expect(resolveJodaTokens('TestLog_')).toBe('TestLog_')
  })

  it('빈 문자열/null 처리', () => {
    expect(resolveJodaTokens('')).toBe('')
    expect(resolveJodaTokens(null)).toBe(null)
  })
})

describe('isAbsolutePath', () => {
  it('Windows 절대경로', () => {
    expect(isAbsolutePath('D:\\Testlog')).toBe(true)
    expect(isAbsolutePath('C:/Users/test')).toBe(true)
  })
  it('Linux 절대경로', () => {
    expect(isAbsolutePath('/var/log/ars')).toBe(true)
  })
  it('상대경로', () => {
    expect(isAbsolutePath('logs/access')).toBe(false)
    expect(isAbsolutePath('TestLog')).toBe(false)
  })
})

// ── jodaFormat (server-side mirror of client formatUtils.jodaSubdirFormat) ──
describe('formatJoda', () => {
  const { formatJoda } = require('../../shared/utils/jodaFormat')
  const FIXED_DATE = new Date(2026, 3, 14, 15, 30, 45) // 2026-04-14 15:30:45 (local)

  it('yyyy/MM/dd 포맷', () => {
    expect(formatJoda('yyyy/MM/dd', FIXED_DATE)).toBe('2026/04/14')
  })

  it('yyyy-MM-dd 포맷 (literal -)', () => {
    expect(formatJoda('yyyy-MM-dd', FIXED_DATE)).toBe('2026-04-14')
  })

  it('yyyyMMdd (no separator)', () => {
    expect(formatJoda('yyyyMMdd', FIXED_DATE)).toBe('20260414')
  })

  it('quoted literal', () => {
    expect(formatJoda("yyyy'-'MM'-'dd", FIXED_DATE)).toBe('2026-04-14')
  })

  it('HH/mm/ss 시간 토큰', () => {
    expect(formatJoda('HH:mm:ss', FIXED_DATE)).toBe('15:30:45')
  })

  it('mm 분이 MM 월과 충돌하지 않음 (case-sensitive)', () => {
    expect(formatJoda('yyyyMMdd_HHmmss', FIXED_DATE)).toBe('20260414_153045')
  })

  it('빈 문자열/null', () => {
    expect(formatJoda('')).toBe('')
    expect(formatJoda(null)).toBe('')
  })
})
