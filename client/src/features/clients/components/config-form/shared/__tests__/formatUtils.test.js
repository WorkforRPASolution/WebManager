import { describe, it, expect } from 'vitest'
import { jodaSubdirFormat, timestampFormatToRegex, parseDurationMs } from '../formatUtils'

// ===========================================================================
// jodaSubdirFormat
// ===========================================================================

describe('jodaSubdirFormat', () => {
  it('1. Basic Joda format with backslash-separated date', () => {
    // format: '\' yyyy '\' MM '\' dd  →  \2025\12\25
    const { regex, format: formatDate } = jodaSubdirFormat("'\\'yyyy'\\'MM'\\'dd")
    expect(regex).toBeInstanceOf(RegExp)

    // Should match \2025\12\25
    expect(regex.test('\\2025\\12\\25')).toBe(true)

    // Format function should produce same output
    const date = new Date(2025, 11, 25) // Dec 25, 2025
    expect(formatDate(date)).toBe('\\2025\\12\\25')
  })

  it('2. Simple concatenated format yyyyMMdd', () => {
    const { regex, format: formatDate } = jodaSubdirFormat('yyyyMMdd')
    expect(regex).toBeInstanceOf(RegExp)

    expect(regex.test('20251225')).toBe(true)
    expect(regex.test('abc12345')).toBe(false)

    const date = new Date(2025, 11, 25)
    expect(formatDate(date)).toBe('20251225')
  })

  it('3. Null/empty format returns null regex', () => {
    const { regex, format: formatDate } = jodaSubdirFormat(null)
    expect(regex).toBeNull()
    expect(formatDate(new Date())).toBe('')

    const r2 = jodaSubdirFormat('')
    expect(r2.regex).toBeNull()
  })

  it('4. Format with hours/minutes/seconds', () => {
    const { regex, format: formatDate } = jodaSubdirFormat('yyyy-MM-dd_HH-mm-ss')
    expect(regex).toBeInstanceOf(RegExp)
    expect(regex.test('2025-12-25_13-41-55')).toBe(true)
    expect(regex.test('2025-12-25_99-99-99')).toBe(true) // regex only validates digit count
    expect(regex.test('abcd-ef-gh_ij-kl-mn')).toBe(false)
  })

  it('5. Quoted literal single quote (double single-quote inside quotes)', () => {
    // format: 'hello''world'  →  hello'world
    const { regex, format: formatDate } = jodaSubdirFormat("'hello''world'")
    expect(formatDate(new Date())).toBe("hello'world")
    expect(regex.test("hello'world")).toBe(true)
  })
})


// ===========================================================================
// timestampFormatToRegex
// ===========================================================================

describe('timestampFormatToRegex', () => {
  it('1. Standard format "yyyy-MM-dd HH:mm:ss"', () => {
    const { regex } = timestampFormatToRegex('yyyy-MM-dd HH:mm:ss')
    expect(regex).toBeInstanceOf(RegExp)
    expect('2026-02-14 10:23:45').toMatch(regex)
  })

  it('2. With milliseconds "yyyy-MM-dd HH:mm:ss.SSS"', () => {
    const { regex } = timestampFormatToRegex('yyyy-MM-dd HH:mm:ss.SSS')
    expect('2026-02-14 10:23:45.123').toMatch(regex)
  })

  it('3. Slash format "yyyy/MM/dd HH:mm:ss"', () => {
    const { regex } = timestampFormatToRegex('yyyy/MM/dd HH:mm:ss')
    expect('2026/02/14 10:23:45').toMatch(regex)
  })

  it('4. Bracketed format "[yyyy-MM-dd HH:mm:ss]"', () => {
    const { regex } = timestampFormatToRegex('[yyyy-MM-dd HH:mm:ss]')
    expect('[2026-02-14 10:23:45]').toMatch(regex)
  })

  it('5. Parse function returns correct Date', () => {
    const { regex, parse } = timestampFormatToRegex('yyyy-MM-dd HH:mm:ss')
    const match = '2026-02-14 10:23:45'.match(regex)
    const date = parse(match)
    expect(date).toBeInstanceOf(Date)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(1) // 0-indexed: February = 1
    expect(date.getDate()).toBe(14)
    expect(date.getHours()).toBe(10)
    expect(date.getMinutes()).toBe(23)
    expect(date.getSeconds()).toBe(45)
  })

  it('6. Null format returns { regex: null, parse: fn returning null }', () => {
    const { regex, parse } = timestampFormatToRegex(null)
    expect(regex).toBeNull()
    expect(parse()).toBeNull()
  })
})


// ===========================================================================
// parseDurationMs
// ===========================================================================

describe('parseDurationMs', () => {
  it('1. "10 seconds" -> 10000', () => {
    expect(parseDurationMs('10 seconds')).toBe(10000)
  })

  it('2. "1 minutes" -> 60000', () => {
    expect(parseDurationMs('1 minutes')).toBe(60000)
  })

  it('3. "2 hours" -> 7200000', () => {
    expect(parseDurationMs('2 hours')).toBe(7200000)
  })

  it('4. "30 seconds" -> 30000', () => {
    expect(parseDurationMs('30 seconds')).toBe(30000)
  })

  it('5. empty string -> 0', () => {
    expect(parseDurationMs('')).toBe(0)
  })

  it('6. null -> 0', () => {
    expect(parseDurationMs(null)).toBe(0)
  })

  it('7. "invalid" -> 0', () => {
    expect(parseDurationMs('invalid')).toBe(0)
  })
})
