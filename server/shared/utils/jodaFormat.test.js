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

describe('resolveJodaTokens (legacy: no fieldRole)', () => {
  it('returns input as-is when no tokens and no quotes', () => {
    expect(resolveJodaTokens('PARAMS', FIXED)).toBe('PARAMS')
  })

  it('resolves date tokens', () => {
    expect(resolveJodaTokens('log_yyyyMMdd', FIXED)).toBe('log_20260504')
  })

  it('returns empty for empty/null input', () => {
    expect(resolveJodaTokens('', FIXED)).toBe('')
    expect(resolveJodaTokens(null, FIXED)).toBe(null)
  })
})

describe('resolveJodaTokens with dateAxis gating', () => {
  it('prefix: resolves only when dateAxis === date_prefix', () => {
    expect(resolveJodaTokens("'PARAMETER'", FIXED, { fieldRole: 'prefix', dateAxis: 'date_prefix' })).toBe('PARAMETER')
    expect(resolveJodaTokens('log_yyyyMMdd', FIXED, { fieldRole: 'prefix', dateAxis: 'date_prefix' })).toBe('log_20260504')
  })

  it('prefix: returns as-is in normal mode (regression — no quote stripping)', () => {
    // Bug: 'X' 형태가 normal 모드에서도 strip 되어 PARAMETER 가 되면 안 됨
    expect(resolveJodaTokens("'PARAMETER'", FIXED, { fieldRole: 'prefix', dateAxis: 'normal' })).toBe("'PARAMETER'")
    expect(resolveJodaTokens('log_yyyyMMdd', FIXED, { fieldRole: 'prefix', dateAxis: 'normal' })).toBe('log_yyyyMMdd')
    expect(resolveJodaTokens("'PARAMETER'", FIXED, { fieldRole: 'prefix', dateAxis: 'date_suffix' })).toBe("'PARAMETER'")
  })

  it('suffix: resolves only when dateAxis === date_suffix', () => {
    expect(resolveJodaTokens("'.log'", FIXED, { fieldRole: 'suffix', dateAxis: 'date_suffix' })).toBe('.log')
    expect(resolveJodaTokens("'.log'", FIXED, { fieldRole: 'suffix', dateAxis: 'normal' })).toBe("'.log'")
    expect(resolveJodaTokens("'.log'", FIXED, { fieldRole: 'suffix', dateAxis: 'date_prefix' })).toBe("'.log'")
  })

  it('wildcard: never resolves regardless of dateAxis', () => {
    expect(resolveJodaTokens('yyyyMMdd', FIXED, { fieldRole: 'wildcard', dateAxis: 'date_prefix' })).toBe('yyyyMMdd')
    expect(resolveJodaTokens("'X'", FIXED, { fieldRole: 'wildcard', dateAxis: 'date_suffix' })).toBe("'X'")
  })
})
