import { describe, it, expect } from 'vitest'
import { formatJoda, resolveJodaTokens } from './jodaFormat.js'

const FIXED = new Date(2026, 4, 4, 13, 14, 15) // 2026-05-04 13:14:15 local

describe('formatJoda', () => {
  it('replaces tokens', () => {
    expect(formatJoda('yyyyMMdd', FIXED)).toBe('20260504')
    expect(formatJoda('yyyy-MM-dd HH:mm:ss', FIXED)).toBe('2026-05-04 13:14:15')
  })

  it('treats single-quoted text as literal', () => {
    expect(formatJoda("'PARAMS'", FIXED)).toBe('PARAMS')
    expect(formatJoda("'PARAMS_'yyyyMMdd", FIXED)).toBe('PARAMS_20260504')
  })

})

describe('resolveJodaTokens', () => {
  it('returns input as-is when no tokens and no quotes', () => {
    expect(resolveJodaTokens('PARAMS', FIXED)).toBe('PARAMS')
    expect(resolveJodaTokens('log_', FIXED)).toBe('log_')
  })

  it('resolves date tokens', () => {
    expect(resolveJodaTokens('log_yyyyMMdd', FIXED)).toBe('log_20260504')
  })

  it('strips single quotes when quote-only literal is provided (regression)', () => {
    // Bug: hasTokens shortcut skipped Joda parser when only quotes were present,
    // returning "'PARAMETER'" instead of "PARAMETER" — file PARAMETER_xxx.txt
    // would then not match.
    expect(resolveJodaTokens("'PARAMETER'", FIXED)).toBe('PARAMETER')
    expect(resolveJodaTokens("'PARAMS'", FIXED)).toBe('PARAMS')
  })

  it('handles mixed quotes and tokens', () => {
    expect(resolveJodaTokens("'log_'yyyyMMdd'.txt'", FIXED)).toBe('log_20260504.txt')
  })

  it('returns empty for empty/null input', () => {
    expect(resolveJodaTokens('', FIXED)).toBe('')
    expect(resolveJodaTokens(null, FIXED)).toBe(null)
  })
})
