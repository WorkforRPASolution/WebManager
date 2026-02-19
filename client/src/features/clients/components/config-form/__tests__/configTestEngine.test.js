import { describe, it, expect } from 'vitest'
import {
  jodaSubdirFormat,
  testAccessLogPath,
  timestampFormatToRegex,
  testTriggerPattern,
  parseDurationMs,
  testTriggerWithFiles,
  convertSyntaxToRegex,
  parseParams,
  evaluateParams,
  testMultilineBlocks,
  testExtractAppend
} from '../configTestEngine'

// ===========================================================================
// testAccessLogPath
// ===========================================================================

describe('testAccessLogPath', () => {
  const defaultSource = {
    directory: 'D:\\Testlog\\',
    prefix: 'TestLog',
    suffix: '.log',
    exclude_suffix: ['.bak']
  }

  it('1. Full match - all steps passed', () => {
    const result = testAccessLogPath(defaultSource, 'D:\\Testlog\\TestLog_20260214.log')
    expect(result.matched).toBe(true)
    expect(result.steps.every((s) => s.passed)).toBe(true)
    expect(result.steps.length).toBeGreaterThanOrEqual(3) // directory, prefix, suffix, wildcard, exclude
  })

  it('2. Directory mismatch', () => {
    const result = testAccessLogPath(defaultSource, 'C:\\Other\\test.log')
    expect(result.matched).toBe(false)
    expect(result.steps[0].passed).toBe(false)
    expect(result.steps[0].label).toBe('디렉토리')
  })

  it('3. Prefix mismatch', () => {
    const result = testAccessLogPath(defaultSource, 'D:\\Testlog\\ErrorLog_20260214.log')
    expect(result.matched).toBe(false)
    const prefixStep = result.steps.find((s) => s.label === 'Prefix')
    expect(prefixStep).toBeDefined()
    expect(prefixStep.passed).toBe(false)
  })

  it('4. Suffix mismatch', () => {
    const result = testAccessLogPath(defaultSource, 'D:\\Testlog\\TestLog_20260214.txt')
    expect(result.matched).toBe(false)
    const suffixStep = result.steps.find((s) => s.label === 'Suffix')
    expect(suffixStep).toBeDefined()
    expect(suffixStep.passed).toBe(false)
  })

  it('5. Excluded file (.bak)', () => {
    // Use a source where suffix is broad enough to also match .bak,
    // so the exclude_suffix step is the one that rejects it.
    const sourceWithBakSuffix = {
      directory: 'D:\\Testlog\\',
      prefix: 'TestLog',
      suffix: '',
      exclude_suffix: ['.bak']
    }
    const result = testAccessLogPath(sourceWithBakSuffix, 'D:\\Testlog\\TestLog_20260214.bak')
    expect(result.matched).toBe(false)
    const excludeStep = result.steps.find((s) => s.label === '제외 대상')
    expect(excludeStep).toBeDefined()
    expect(excludeStep.passed).toBe(false)
  })

  it('6. Forward slash paths', () => {
    const result = testAccessLogPath(defaultSource, 'D:/Testlog/TestLog.log')
    expect(result.matched).toBe(true)
  })

  it('7. Wildcard match', () => {
    const source = { directory: '', prefix: 'app', wildcard: '2026', suffix: '.log' }
    const result = testAccessLogPath(source, 'app_20260214.log')
    expect(result.matched).toBe(true)
    const wcStep = result.steps.find((s) => s.label === 'Wildcard')
    expect(wcStep).toBeDefined()
    expect(wcStep.passed).toBe(true)
  })

  it('8. Wildcard mismatch', () => {
    const source = { directory: '', prefix: 'app', wildcard: '2026', suffix: '.log' }
    const result = testAccessLogPath(source, 'app_20250101.log')
    expect(result.matched).toBe(false)
    const wcStep = result.steps.find((s) => s.label === 'Wildcard')
    expect(wcStep).toBeDefined()
    expect(wcStep.passed).toBe(false)
  })

  it('9. No prefix/suffix/wildcard - fails with filename filter validation', () => {
    const source = { directory: 'D:\\Testlog\\', prefix: '', suffix: '' }
    const result = testAccessLogPath(source, 'D:\\Testlog\\anything.xyz')
    expect(result.matched).toBe(false)
    const filterStep = result.steps.find((s) => s.label === '파일명 필터')
    expect(filterStep).toBeDefined()
    expect(filterStep.passed).toBe(false)
  })

  it('10. Date subdir format - filePath includes subdirectory', () => {
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
    const source = {
      directory: 'D:\\Testlog\\',
      prefix: 'TestLog',
      suffix: '.log',
      date_subdir_format: 'yyyyMMdd'
    }
    const result = testAccessLogPath(source, `D:\\Testlog\\${dateStr}\\TestLog_001.log`)
    expect(result.matched).toBe(true)
  })

  it('11. Directory trailing slash - both with and without trailing backslash', () => {
    const sourceWith = { directory: 'D:\\Testlog\\', prefix: 'TestLog', suffix: '.log' }
    const sourceWithout = { directory: 'D:\\Testlog', prefix: 'TestLog', suffix: '.log' }
    const filePath = 'D:\\Testlog\\TestLog.log'

    const r1 = testAccessLogPath(sourceWith, filePath)
    const r2 = testAccessLogPath(sourceWithout, filePath)
    expect(r1.matched).toBe(true)
    expect(r2.matched).toBe(true)
  })

  it('12. Double backslash normalization', () => {
    const source = { directory: 'D:\\\\Testlog', prefix: 'TestLog', suffix: '.log' }
    const result = testAccessLogPath(source, 'D:\\\\Testlog\\TestLog.log')
    expect(result.matched).toBe(true)
  })

  it('13. Double forward slash normalization', () => {
    const source = { directory: 'D://Testlog', prefix: 'TestLog', suffix: '.log' }
    const result = testAccessLogPath(source, 'D://Testlog//TestLog.log')
    expect(result.matched).toBe(true)
  })

  it('14. Mixed separators normalization', () => {
    const source = { directory: 'D:\\Testlog', prefix: 'TestLog', suffix: '.log' }
    const result = testAccessLogPath(source, 'D://Testlog/TestLog.log')
    expect(result.matched).toBe(true)
  })

  it('15. Directory-only path without trailing slash - directory step passes', () => {
    const source = { directory: 'D:\\EARS\\Log', prefix: 'TestLog', suffix: '.log' }
    const result = testAccessLogPath(source, 'D:\\EARS\\Log')
    // Directory step should pass (path matches the directory itself)
    const dirStep = result.steps.find((s) => s.label === '디렉토리')
    expect(dirStep).toBeDefined()
    expect(dirStep.passed).toBe(true)
    // Overall match is false because there's no filename for prefix/suffix
    expect(result.matched).toBe(false)
  })

  it('16. Directory-only path with trailing slash - directory step passes', () => {
    const source = { directory: 'D:\\EARS\\Log', prefix: 'TestLog', suffix: '.log' }
    const result = testAccessLogPath(source, 'D:\\EARS\\Log\\')
    // Directory step should pass
    const dirStep = result.steps.find((s) => s.label === '디렉토리')
    expect(dirStep).toBeDefined()
    expect(dirStep.passed).toBe(true)
    // Overall match is false because there's no filename for prefix/suffix
    expect(result.matched).toBe(false)
  })

  it('17. Wildcard with no suffix - should fail when wildcard not in filename', () => {
    const source = {
      directory: 'D:\\EARS\\Log\\',
      prefix: 'Log_',
      wildcard: '_20',
      suffix: ''
    }
    const result = testAccessLogPath(source, 'D:\\EARS\\Log\\Log_.txt')
    expect(result.matched).toBe(false)
    const wcStep = result.steps.find((s) => s.label === 'Wildcard')
    expect(wcStep).toBeDefined()
    expect(wcStep.passed).toBe(false)
  })

  it('18. Wildcard with no suffix - should pass when wildcard is in filename', () => {
    const source = {
      directory: 'D:\\EARS\\Log\\',
      prefix: 'Log_',
      wildcard: '_20',
      suffix: ''
    }
    const result = testAccessLogPath(source, 'D:\\EARS\\Log\\Log_abc_20.txt')
    expect(result.matched).toBe(true)
    const wcStep = result.steps.find((s) => s.label === 'Wildcard')
    expect(wcStep).toBeDefined()
    expect(wcStep.passed).toBe(true)
  })

  it('19. Wildcard searches entire filename - prefix overlap case', () => {
    const source = {
      directory: 'D:\\EARS\\Log\\',
      prefix: 'Log_',
      wildcard: '_',
      suffix: ''
    }
    const result = testAccessLogPath(source, 'D:\\EARS\\Log\\Log_.txt')
    expect(result.matched).toBe(true)
    const wcStep = result.steps.find((s) => s.label === 'Wildcard')
    expect(wcStep).toBeDefined()
    expect(wcStep.passed).toBe(true)
  })

  it('20. Filename filter - no prefix/suffix/wildcard returns false with 파일명 필터 step', () => {
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: '',
      suffix: '',
      wildcard: ''
    }
    const result = testAccessLogPath(source, 'D:\\EARS\\Log\\test.txt')
    expect(result.matched).toBe(false)
    const filterStep = result.steps.find((s) => s.label === '파일명 필터')
    expect(filterStep).toBeDefined()
    expect(filterStep.passed).toBe(false)
  })

  it('28. Prefix with Joda tokens - resolves to current date and matches', () => {
    const now = new Date()
    const y = String(now.getFullYear())
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dateStr = y + m + d
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: 'Log_yyyyMMdd',
      suffix: '.txt'
    }
    const result = testAccessLogPath(source, `D:\\EARS\\Log\\Log_${dateStr}.txt`)
    expect(result.matched).toBe(true)
    const prefixStep = result.steps.find((s) => s.label === 'Prefix')
    expect(prefixStep).toBeDefined()
    expect(prefixStep.passed).toBe(true)
    expect(prefixStep.detail).toContain(`Log_${dateStr}`)
    expect(prefixStep.detail).toContain('원본: "Log_yyyyMMdd"')
  })

  it('29. Prefix with Joda tokens - does NOT match wrong date', () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86400000)
    const y = String(yesterday.getFullYear())
    const m = String(yesterday.getMonth() + 1).padStart(2, '0')
    const d = String(yesterday.getDate()).padStart(2, '0')
    const dateStr = y + m + d
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: 'Log_yyyyMMdd',
      suffix: '.txt'
    }
    const result = testAccessLogPath(source, `D:\\EARS\\Log\\Log_${dateStr}.txt`)
    expect(result.matched).toBe(false)
    const prefixStep = result.steps.find((s) => s.label === 'Prefix')
    expect(prefixStep).toBeDefined()
    expect(prefixStep.passed).toBe(false)
    expect(prefixStep.detail).toContain('파일명')
    expect(prefixStep.detail).toContain('현재 날짜 기준 예상 접두사')
  })

  it('30. Suffix with Joda tokens - resolves to current date and matches', () => {
    const now = new Date()
    const y = String(now.getFullYear())
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dateStr = y + m + d
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: 'Log',
      suffix: '_yyyyMMdd.txt'
    }
    const result = testAccessLogPath(source, `D:\\EARS\\Log\\Log_${dateStr}.txt`)
    expect(result.matched).toBe(true)
    const suffixStep = result.steps.find((s) => s.label === 'Suffix')
    expect(suffixStep).toBeDefined()
    expect(suffixStep.passed).toBe(true)
    expect(suffixStep.detail).toContain(`_${dateStr}.txt`)
    expect(suffixStep.detail).toContain('원본: "_yyyyMMdd.txt"')
  })

  it('31. Plain prefix (no Joda tokens) - no 원본 annotation', () => {
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: 'TestLog',
      suffix: '.log'
    }
    const result = testAccessLogPath(source, 'D:\\EARS\\Log\\TestLog_001.log')
    expect(result.matched).toBe(true)
    const prefixStep = result.steps.find((s) => s.label === 'Prefix')
    expect(prefixStep).toBeDefined()
    expect(prefixStep.passed).toBe(true)
    expect(prefixStep.detail).not.toContain('원본')
  })
})


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
// testAccessLogPath - date_subdir_format
// ===========================================================================

describe('testAccessLogPath - date_subdir_format validation', () => {
  it('21. Path with date_subdir_format matching', () => {
    const now = new Date()
    const y = String(now.getFullYear())
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: 'Log_',
      suffix: '.txt',
      date_subdir_format: "'\\\\'yyyy'\\\\'MM'\\\\'dd"
    }
    const input = `D:\\EARS\\Log\\${y}\\${m}\\${d}\\Log_test.txt`
    const result = testAccessLogPath(source, input)
    expect(result.matched).toBe(true)
    const subdirStep = result.steps.find((s) => s.label === '날짜 서브디렉토리')
    expect(subdirStep).toBeDefined()
    expect(subdirStep.passed).toBe(true)
  })

  it('22. Path with date_subdir_format NOT matching', () => {
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: 'Log_',
      suffix: '.txt',
      date_subdir_format: "'\\'yyyy'\\'MM'\\'dd"
    }
    const result = testAccessLogPath(source, 'D:\\EARS\\Log\\abc\\def\\ghi\\Log_test.txt')
    expect(result.matched).toBe(false)
    const subdirStep = result.steps.find((s) => s.label === '날짜 서브디렉토리')
    expect(subdirStep).toBeDefined()
    expect(subdirStep.passed).toBe(false)
  })

  it('23. Path with date_subdir_format but no subdirectory (remaining treated as subdir)', () => {
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: 'Log_',
      suffix: '.txt',
      date_subdir_format: "'\\\\'yyyy'\\\\'MM'\\\\'dd"
    }
    // remaining = 'Log_test.txt' — no slash, treated as subdirectory part, won't match date format
    const result = testAccessLogPath(source, 'D:\\EARS\\Log\\Log_test.txt')
    expect(result.matched).toBe(false)
    const subdirStep = result.steps.find((s) => s.label === '날짜 서브디렉토리')
    expect(subdirStep).toBeDefined()
    expect(subdirStep.passed).toBe(false)
    expect(subdirStep.detail).toContain('서브디렉토리 없음')
  })

  it('24. Simple date_subdir_format yyyyMMdd matching', () => {
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
    const source = {
      directory: 'D:\\Testlog\\',
      prefix: 'TestLog',
      suffix: '.log',
      date_subdir_format: 'yyyyMMdd'
    }
    const result = testAccessLogPath(source, `D:\\Testlog\\${dateStr}\\TestLog_001.log`)
    expect(result.matched).toBe(true)
    const subdirStep = result.steps.find((s) => s.label === '날짜 서브디렉토리')
    expect(subdirStep).toBeDefined()
    expect(subdirStep.passed).toBe(true)
  })

  it('25. Simple date_subdir_format yyyyMMdd NOT matching', () => {
    const source = {
      directory: 'D:\\Testlog\\',
      prefix: 'TestLog',
      suffix: '.log',
      date_subdir_format: 'yyyyMMdd'
    }
    const result = testAccessLogPath(source, 'D:\\Testlog\\baddate\\TestLog_001.log')
    expect(result.matched).toBe(false)
    const subdirStep = result.steps.find((s) => s.label === '날짜 서브디렉토리')
    expect(subdirStep).toBeDefined()
    expect(subdirStep.passed).toBe(false)
  })

  it('26. Date subdir only (no filename) - remaining has no slash, matches date format', () => {
    const y = String(new Date().getFullYear())
    const source = {
      directory: 'D:\\EARS\\Log',
      date_subdir_format: 'yyyy',
      prefix: 'Log_',
      suffix: '.txt'
    }
    const result = testAccessLogPath(source, `D:\\EARS\\Log\\${y}`)
    expect(result.matched).toBe(false) // fails at prefix (fileName is empty)
    const subdirStep = result.steps.find((s) => s.label === '날짜 서브디렉토리')
    expect(subdirStep).toBeDefined()
    expect(subdirStep.passed).toBe(true) // date subdir matches current year
    const prefixStep = result.steps.find((s) => s.label === 'Prefix')
    expect(prefixStep).toBeDefined()
    expect(prefixStep.passed).toBe(false) // empty fileName doesn't start with 'Log_'
  })

  it('27. Empty remaining with date_subdir_format - shows 서브디렉토리 없음', () => {
    // input equals directory exactly -> remaining is empty -> '서브디렉토리 없음'
    const source = {
      directory: 'D:\\EARS\\Log',
      date_subdir_format: 'yyyy',
      prefix: 'Log_',
      suffix: '.txt'
    }
    const result = testAccessLogPath(source, 'D:\\EARS\\Log')
    expect(result.matched).toBe(false)
    const subdirStep = result.steps.find((s) => s.label === '날짜 서브디렉토리')
    expect(subdirStep).toBeDefined()
    expect(subdirStep.passed).toBe(false)
    expect(subdirStep.detail).toContain('서브디렉토리 없음')
  })

  it('32. No date_subdir_format - unexpected subdirectory should fail', () => {
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: 'Log_',
      suffix: '.txt',
      date_subdir_format: ''
    }
    const result = testAccessLogPath(source, 'D:\\EARS\\Log\\subdir\\Log_test.txt')
    expect(result.matched).toBe(false)
    const subdirStep = result.steps.find((s) => s.label === '서브디렉토리')
    expect(subdirStep).toBeDefined()
    expect(subdirStep.passed).toBe(false)
    expect(subdirStep.detail).toContain('subdir')
  })

  it('33. No date_subdir_format (undefined) - unexpected subdirectory should fail', () => {
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: 'Log_',
      suffix: '.txt'
    }
    const result = testAccessLogPath(source, 'D:\\EARS\\Log\\subdir\\Log_test.txt')
    expect(result.matched).toBe(false)
    const subdirStep = result.steps.find((s) => s.label === '서브디렉토리')
    expect(subdirStep).toBeDefined()
    expect(subdirStep.passed).toBe(false)
  })

  it('34. date_subdir_format set but file directly in directory (no subdir) - shows 서브디렉토리 없음', () => {
    const now = new Date()
    const y = String(now.getFullYear())
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dateStr = y + m + d
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: `Log_${dateStr}`,
      suffix: '.txt',
      date_subdir_format: "'\\\\'yyyy"
    }
    // File is directly in directory — no year subdirectory
    const result = testAccessLogPath(source, `D:\\EARS\\Log\\Log_${dateStr}.txt`)
    expect(result.matched).toBe(false)
    const subdirStep = result.steps.find((s) => s.label === '날짜 서브디렉토리')
    expect(subdirStep).toBeDefined()
    expect(subdirStep.passed).toBe(false)
    expect(subdirStep.detail).toContain('서브디렉토리 없음')
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


// ===========================================================================
// testTriggerPattern
// ===========================================================================

describe('testTriggerPattern', () => {
  it('1. Single step, single regex match', () => {
    const trigger = {
      recipe: [{ type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' }]
    }
    const logText = 'INFO ok\nERROR fail\nINFO ok'
    const result = testTriggerPattern(trigger, logText, null)

    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[0].matchCount).toBe(1)
    expect(result.steps[0].matches[0].lineNum).toBe(2)
    expect(result.finalResult.triggered).toBe(true)
  })

  it('2. Single step, no match', () => {
    const trigger = {
      recipe: [{ type: 'regex', trigger: [{ syntax: '.*CRITICAL.*' }], times: 1, next: '' }]
    }
    const logText = 'INFO ok\nERROR fail'
    const result = testTriggerPattern(trigger, logText, null)

    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].fired).toBe(false)
    expect(result.steps[0].matchCount).toBe(0)
    expect(result.finalResult.triggered).toBe(false)
  })

  it('3. Delay type matches like regex', () => {
    const trigger = {
      recipe: [{ type: 'delay', trigger: [{ syntax: '.*CANCEL.*' }], times: 1, next: '' }]
    }
    const logText = 'CANCEL the operation'
    const result = testTriggerPattern(trigger, logText, null)

    expect(result.steps[0].fired).toBe(true)
    expect(result.finalResult.triggered).toBe(true)
  })

  it('4. Delay step fired → chain resets to step 0', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: 'Step_2' },
        { name: 'Step_2', type: 'delay', trigger: [{ syntax: '.*CANCEL.*' }], times: 1, duration: '10 minutes', next: '@script', script: { name: 'alert.sh' } }
      ]
    }
    // ERROR fires step 1, then CANCEL fires step 2 (delay) → chain resets
    const logText = 'ERROR occurred\nCANCEL the alert'
    const result = testTriggerPattern(trigger, logText, null)

    // Step 2 should have resetChain = true
    const delayStep = result.steps.find(s => s.type === 'delay')
    expect(delayStep).toBeDefined()
    expect(delayStep.fired).toBe(true)
    expect(delayStep.resetChain).toBe(true)
    expect(delayStep.nextAction).toBe('→ 체인 리셋')
  })

  it('4b. Delay step not fired (timeout) → proceeds to next step', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: 'Step_2' },
        { name: 'Step_2', type: 'delay', trigger: [{ syntax: '.*CANCEL.*' }], times: 1, next: 'Step_3' },
        { name: 'Step_3', type: 'regex', trigger: [{ syntax: '.*CRITICAL.*' }], times: 1, next: '@script', script: { name: 'alert.sh' } }
      ]
    }
    // ERROR fires step 1, no CANCEL → delay times out → proceeds to step 3, CRITICAL fires
    const logText = 'ERROR occurred\nCRITICAL failure'
    const result = testTriggerPattern(trigger, logText, null)

    expect(result.steps.length).toBeGreaterThanOrEqual(2)
    // The delay step should not have fired
    const delayStep = result.steps.find(s => s.type === 'delay')
    expect(delayStep).toBeDefined()
    expect(delayStep.fired).toBe(false)
    // Step 3 should have fired
    const step3 = result.steps.find(s => s.name === 'Step_3')
    expect(step3).toBeDefined()
    expect(step3.fired).toBe(true)
    expect(result.finalResult.triggered).toBe(true)
  })

  it('4c. Delay chain reset — infinite loop guard (max 100)', () => {
    // This trigger would loop forever: ERROR → delay(always matches) → reset
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*' }], times: 1, next: 'Step_2' },
        { name: 'Step_2', type: 'delay', trigger: [{ syntax: '.*' }], times: 1, next: '' }
      ]
    }
    // Many lines that always match → should stop after max resets
    const logText = Array.from({ length: 300 }, (_, i) => `line ${i}`).join('\n')
    
    expect(() => {
      const result = testTriggerPattern(trigger, logText, null)
      // Should terminate without hanging
      expect(result.steps.length).toBeGreaterThan(0)
    }).not.toThrow()
  })

  it('5. Multi-step chain - both steps fire', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: 'Step_2' },
        { name: 'Step_2', type: 'regex', trigger: [{ syntax: '.*CRITICAL.*' }], times: 1, next: '' }
      ]
    }
    const logText = 'ERROR first\nCRITICAL second'
    const result = testTriggerPattern(trigger, logText, null)

    expect(result.steps).toHaveLength(2)
    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[1].fired).toBe(true)
    expect(result.finalResult.triggered).toBe(true)
  })

  it('6. Multi-step chain - partial (Step 1 fires, Step 2 does not)', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: 'Step_2' },
        { name: 'Step_2', type: 'regex', trigger: [{ syntax: '.*CRITICAL.*' }], times: 1, next: '' }
      ]
    }
    const logText = 'ERROR first\nINFO ok'
    const result = testTriggerPattern(trigger, logText, null)

    expect(result.steps).toHaveLength(2)
    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[1].fired).toBe(false)
    expect(result.finalResult.triggered).toBe(false)
  })

  it('7. Times > 1 - not enough matches vs. enough matches', () => {
    const trigger = {
      recipe: [{ type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 3, next: '' }]
    }

    // Only 2 ERRORs -> not fired
    const r1 = testTriggerPattern(trigger, 'ERROR one\nERROR two', null)
    expect(r1.steps[0].fired).toBe(false)
    expect(r1.steps[0].matchCount).toBe(2)

    // 3 ERRORs -> fired
    const r2 = testTriggerPattern(trigger, 'ERROR one\nERROR two\nERROR three', null)
    expect(r2.steps[0].fired).toBe(true)
    expect(r2.steps[0].matchCount).toBe(3)
    expect(r2.finalResult.triggered).toBe(true)
  })

  it('8. Duration check with timestamp - within window fires, outside window does not', () => {
    const trigger = {
      recipe: [{
        type: 'regex',
        trigger: [{ syntax: '.*ERROR.*' }],
        times: 2,
        duration: '10 minutes',
        next: ''
      }]
    }
    const tsFormat = 'yyyy-MM-dd HH:mm:ss'

    // 2 ERRORs within 10 minutes -> fired
    const logWithin = '2026-02-14 10:00:00 ERROR first\n2026-02-14 10:05:00 ERROR second'
    const rWithin = testTriggerPattern(trigger, logWithin, tsFormat)
    expect(rWithin.steps[0].fired).toBe(true)
    expect(rWithin.steps[0].durationCheck.passed).toBe(true)

    // 2 ERRORs more than 10 minutes apart (no third match to slide into window) -> not fired
    const logOutside = '2026-02-14 10:00:00 ERROR first\n2026-02-14 10:15:00 ERROR second'
    const rOutside = testTriggerPattern(trigger, logOutside, tsFormat)
    expect(rOutside.steps[0].fired).toBe(false)
  })

  it('9. Duration check without timestamp format - fires immediately when times met', () => {
    const trigger = {
      recipe: [{
        type: 'regex',
        trigger: [{ syntax: '.*ERROR.*' }],
        times: 2,
        duration: '10 minutes',
        next: ''
      }]
    }
    // No timestamp format -> duration ignored, fires when count reached
    const logText = 'ERROR first\nERROR second'
    const result = testTriggerPattern(trigger, logText, null)
    expect(result.steps[0].fired).toBe(true)
  })

  it('10. Script next action', () => {
    const trigger = {
      recipe: [{
        type: 'regex',
        trigger: [{ syntax: '.*ERROR.*' }],
        times: 1,
        next: '@script',
        script: { name: 'Test.scala', arg: 'a1' }
      }]
    }
    const result = testTriggerPattern(trigger, 'ERROR', null)
    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[0].nextAction).toContain('Test.scala')
    expect(result.finalResult.triggered).toBe(true)
  })

  it('11. Trigger items as plain strings (not objects)', () => {
    const trigger = {
      recipe: [{ type: 'regex', trigger: ['.*ERROR.*'], times: 1, next: '' }]
    }
    const result = testTriggerPattern(trigger, 'ERROR here', null)
    expect(result.steps[0].fired).toBe(true)
  })

  it('12. Invalid regex - should not throw, reports no matches', () => {
    const trigger = {
      recipe: [{ type: 'regex', trigger: ['[invalid'], times: 1, next: '' }]
    }
    expect(() => {
      const result = testTriggerPattern(trigger, 'some text', null)
      expect(result.steps[0].fired).toBe(false)
      expect(result.steps[0].matchCount).toBe(0)
    }).not.toThrow()
  })

  it('13. Multiple patterns in one step', () => {
    const trigger = {
      recipe: [{
        type: 'regex',
        trigger: [{ syntax: '.*ERROR.*' }, { syntax: '.*FAIL.*' }],
        times: 1,
        next: ''
      }]
    }

    // First pattern matches
    const r1 = testTriggerPattern(trigger, 'ERROR msg', null)
    expect(r1.steps[0].fired).toBe(true)
    expect(r1.steps[0].matches[0].pattern).toContain('ERROR')

    // Second pattern matches
    const r2 = testTriggerPattern(trigger, 'FAIL msg', null)
    expect(r2.steps[0].fired).toBe(true)
    expect(r2.steps[0].matches[0].pattern).toContain('FAIL')
  })

  it('14. Empty recipe - no steps, not triggered', () => {
    const trigger = { recipe: [] }
    const result = testTriggerPattern(trigger, 'some log text', null)
    expect(result.steps).toHaveLength(0)
    expect(result.finalResult.triggered).toBe(false)
  })

  it('15. @recovery next action label', () => {
    const trigger = {
      recipe: [{
        type: 'regex',
        trigger: [{ syntax: '.*ERROR.*' }],
        times: 1,
        next: '@recovery'
      }]
    }
    const result = testTriggerPattern(trigger, 'ERROR', null)
    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[0].nextAction).toContain('시나리오 실행')
    expect(result.finalResult.triggered).toBe(true)
  })

  it('16. @notify next action label', () => {
    const trigger = {
      recipe: [{
        type: 'regex',
        trigger: [{ syntax: '.*ERROR.*' }],
        times: 1,
        next: '@notify'
      }]
    }
    const result = testTriggerPattern(trigger, 'ERROR', null)
    expect(result.steps[0].nextAction).toContain('메일 발송')
    expect(result.finalResult.triggered).toBe(true)
  })

  it('17. @popup next action label', () => {
    const trigger = {
      recipe: [{
        type: 'regex',
        trigger: [{ syntax: '.*ERROR.*' }],
        times: 1,
        next: '@popup'
      }]
    }
    const result = testTriggerPattern(trigger, 'ERROR', null)
    expect(result.steps[0].nextAction).toContain('PopUp 실행')
    expect(result.finalResult.triggered).toBe(true)
  })
})


// ===========================================================================
// testTriggerWithFiles
// ===========================================================================

describe('testTriggerWithFiles', () => {
  it('1. Single file - matches include fileName', () => {
    const trigger = {
      recipe: [{ type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' }]
    }
    const files = [{ name: 'app.log', content: 'INFO ok\nERROR fail\nINFO ok' }]
    const result = testTriggerWithFiles(trigger, files, null)

    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[0].matches[0].fileName).toBe('app.log')
    expect(result.steps[0].matches[0].lineNum).toBe(2) // local line number in app.log
  })

  it('2. Multiple files - match points to correct file and lineNum', () => {
    const trigger = {
      recipe: [{ type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' }]
    }
    const files = [
      { name: 'a.log', content: 'INFO ok' },
      { name: 'b.log', content: 'ERROR fail' }
    ]
    const result = testTriggerWithFiles(trigger, files, null)

    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[0].matches[0].fileName).toBe('b.log')
    expect(result.steps[0].matches[0].lineNum).toBe(1) // line 1 of b.log
  })

  it('3. Line number mapping - globalLineNum spans across files', () => {
    const trigger = {
      recipe: [{ type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 2, next: '' }]
    }
    const files = [
      { name: 'a.log', content: 'ERROR first\nINFO ok' },  // lines 1-2 global
      { name: 'b.log', content: 'INFO ok\nERROR second' }  // lines 3-4 global
    ]
    const result = testTriggerWithFiles(trigger, files, null)

    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[0].matches).toHaveLength(2)

    // First match: a.log, local line 1, global line 1
    expect(result.steps[0].matches[0].fileName).toBe('a.log')
    expect(result.steps[0].matches[0].lineNum).toBe(1)
    expect(result.steps[0].matches[0].globalLineNum).toBe(1)

    // Second match: b.log, local line 2, global line 4
    expect(result.steps[0].matches[1].fileName).toBe('b.log')
    expect(result.steps[0].matches[1].lineNum).toBe(2)
    expect(result.steps[0].matches[1].globalLineNum).toBe(4)
  })
})


// ===========================================================================
// testTriggerPattern - multi-step duration (chained step)
// ===========================================================================

describe('testTriggerPattern - multi-step duration', () => {
  it('multi-step duration measures from previous step completion', () => {
    const trigger = {
      source: '',
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*Start Log.*' }], duration: '1 minutes', times: 2, next: 'Step_2' },
        { name: 'Step_2', type: 'regex', trigger: [{ syntax: 'Start2 Log' }], duration: '10 seconds', times: 1, next: '@notify' }
      ],
      limitation: { times: 1, duration: '1 minutes' }
    }
    const logText = `2026-02-11 05:46:49 INFO  Step1 Start Log
2026-02-11 05:47:48 INFO  Start2 Log
2026-02-11 05:47:49 INFO  Start Log
2026-02-11 05:48:50 INFO  Start2 Log`
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    // Step_1 should fire (2 matches within 1 minute)
    expect(result.steps[0].fired).toBe(true)
    // Step_2 should NOT fire (61 seconds from Step_1 completion exceeds 10 seconds)
    expect(result.steps[1].fired).toBe(false)
    expect(result.steps[1].durationCheck.passed).toBe(false)
  })

  it('multi-step duration passes when within limit', () => {
    const trigger = {
      source: '',
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*Start Log.*' }], duration: '1 minutes', times: 1, next: 'Step_2' },
        { name: 'Step_2', type: 'regex', trigger: [{ syntax: 'Start2 Log' }], duration: '30 seconds', times: 1, next: '@notify' }
      ],
      limitation: { times: 1, duration: '5 minutes' }
    }
    const logText = `2026-02-11 05:46:49 INFO  Start Log
2026-02-11 05:47:00 INFO  Start2 Log`
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[1].fired).toBe(true)
    expect(result.steps[1].durationCheck.passed).toBe(true)
  })
})


// ===========================================================================
// testTriggerPattern - limitation validation
// ===========================================================================

describe('testTriggerPattern - limitation', () => {
  it('allows firings within limitation', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '@notify' }
      ],
      limitation: { times: 3, duration: '5 minutes' }
    }
    const logText = [
      '2026-02-11 10:00:00 ERROR one',
      '2026-02-11 10:01:00 ERROR two',
      '2026-02-11 10:02:00 ERROR three',
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    expect(result.limitation).toBeTruthy()
    expect(result.limitation.totalFirings).toBe(3)
    expect(result.limitation.allowedFirings).toBe(3)
    expect(result.limitation.suppressedFirings).toBe(0)
    expect(result.finalResult.triggered).toBe(true)
    expect(result.firings).toHaveLength(3)
    expect(result.firings.every(f => !f.suppressed)).toBe(true)
  })

  it('suppresses firings exceeding limitation.times', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '@notify' }
      ],
      limitation: { times: 1, duration: '1 minutes' }
    }
    const logText = [
      '2026-02-11 10:00:00 ERROR one',
      '2026-02-11 10:00:30 ERROR two',   // within 1 min of first -> suppressed
      '2026-02-11 10:01:30 ERROR three',  // >1 min from first -> allowed again
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    expect(result.limitation.totalFirings).toBe(3)
    expect(result.limitation.allowedFirings).toBe(2)  // first + third
    expect(result.limitation.suppressedFirings).toBe(1) // second
    expect(result.finalResult.triggered).toBe(true)
    // Check individual firings
    expect(result.firings[0].suppressed).toBe(false)
    expect(result.firings[1].suppressed).toBe(true)
    expect(result.firings[2].suppressed).toBe(false)
  })

  it('no limitation when not configured', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '@notify' }
      ]
    }
    const logText = '2026-02-11 10:00:00 ERROR one'
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    expect(result.limitation).toBeNull()
  })

  it('limitation with multi-step chain', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*START.*' }], times: 1, next: 'Step_2' },
        { name: 'Step_2', type: 'regex', trigger: [{ syntax: '.*END.*' }], times: 1, duration: '30 seconds', next: '@notify' }
      ],
      limitation: { times: 1, duration: '2 minutes' }
    }
    const logText = [
      '2026-02-11 10:00:00 START a',
      '2026-02-11 10:00:05 END a',
      '2026-02-11 10:00:30 START b',
      '2026-02-11 10:00:35 END b',  // within 2 min of first -> suppressed
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    expect(result.limitation.totalFirings).toBe(2)
    expect(result.limitation.allowedFirings).toBe(1)
    expect(result.limitation.suppressedFirings).toBe(1)
    expect(result.firings[0].suppressed).toBe(false)
    expect(result.firings[1].suppressed).toBe(true)
  })

  it('backward compatibility: steps field shows first firing steps', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '@notify' }
      ],
      limitation: { times: 2, duration: '5 minutes' }
    }
    const logText = [
      '2026-02-11 10:00:00 ERROR one',
      '2026-02-11 10:01:00 ERROR two',
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    // steps should be first firing's steps
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].name).toBe('Step_1')
    expect(result.steps[0].fired).toBe(true)
  })

  it('limitation.durationFormatted returns Korean formatted string', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '@notify' }
      ],
      limitation: { times: 1, duration: '5 minutes' }
    }
    const logText = '2026-02-11 10:00:00 ERROR one'
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    expect(result.limitation.durationFormatted).toBe('5분')
    expect(result.limitation.times).toBe(1)
    expect(result.limitation.duration).toBe('5 minutes')
  })

  it('all suppressed: triggered is false', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '@notify' }
      ],
      limitation: { times: 0, duration: '10 minutes' }
    }
    const logText = '2026-02-11 10:00:00 ERROR one'
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    // times=0 means all firings are suppressed
    expect(result.limitation.totalFirings).toBe(1)
    expect(result.limitation.suppressedFirings).toBe(1)
    expect(result.limitation.allowedFirings).toBe(0)
    expect(result.finalResult.triggered).toBe(false)
  })

  it('limitation with no matches - incomplete firing', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*CRITICAL.*' }], times: 1, next: '@notify' }
      ],
      limitation: { times: 1, duration: '5 minutes' }
    }
    const logText = '2026-02-11 10:00:00 INFO nothing here'
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    expect(result.limitation.totalFirings).toBe(0)
    expect(result.limitation.allowedFirings).toBe(0)
    expect(result.limitation.suppressedFirings).toBe(0)
    expect(result.finalResult.triggered).toBe(false)
  })

  it('limitation message includes suppression info', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '@notify' }
      ],
      limitation: { times: 1, duration: '1 minutes' }
    }
    const logText = [
      '2026-02-11 10:00:00 ERROR one',
      '2026-02-11 10:00:30 ERROR two',
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    expect(result.finalResult.message).toContain('감지')
    expect(result.finalResult.message).toContain('발동')
    expect(result.finalResult.message).toContain('억제')
    expect(result.finalResult.message).toContain('1분')
    expect(result.finalResult.message).toContain('최대 1회')
  })

  it('limitation message shows "제한 내" when no suppressions', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '@notify' }
      ],
      limitation: { times: 5, duration: '10 minutes' }
    }
    const logText = '2026-02-11 10:00:00 ERROR one'
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    expect(result.finalResult.message).toContain('제한 내')
  })
})



// ===========================================================================
// testTriggerPattern - delay step with timestamps
// ===========================================================================

describe('testTriggerPattern - delay step with timestamps', () => {
  it('delay resets chain when pattern matches within duration', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: 'Delay_1' },
        { name: 'Delay_1', type: 'delay', trigger: [{ syntax: '.*RECOVERY.*' }], duration: '30 seconds', times: 1, next: '@notify' },
      ],
      limitation: null
    }
    const logText = [
      '2026-02-11 10:00:00 ERROR occurred',
      '2026-02-11 10:00:10 RECOVERY done',  // within 30s -> reset
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    const delayStep = result.steps.find(s => s.name === 'Delay_1')
    expect(delayStep.fired).toBe(true)
    expect(delayStep.cancelled).toBe(true)
    expect(delayStep.resetChain).toBe(true)
    expect(delayStep.nextAction).toBe('→ 체인 리셋')
    expect(delayStep.durationCheck.passed).toBe(true)
  })

  it('delay times out when pattern matches AFTER duration', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: 'Delay_1' },
        { name: 'Delay_1', type: 'delay', trigger: [{ syntax: '.*RECOVERY.*' }], duration: '30 seconds', times: 1, next: '@notify' },
      ]
    }
    const logText = [
      '2026-02-11 10:00:00 ERROR occurred',
      '2026-02-11 10:00:40 some other log',   // 40s > 30s, no pattern match but time exceeded
      '2026-02-11 10:01:00 RECOVERY done',     // 60s, pattern matches but too late
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    // Delay should timeout (not fired), and chain should proceed to @notify
    const delayStep = result.steps.find(s => s.name === 'Delay_1')
    expect(delayStep.fired).toBe(false)
    expect(delayStep.cancelled).toBe(false)
    expect(delayStep.timedOut).toBe(true)
    expect(delayStep.nextAction).toBe('→ 메일 발송')
    expect(result.finalResult.triggered).toBe(true) // timeout means proceed = triggered
  })

  it('delay times out when no more log lines (no timestamps)', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: 'Delay_1' },
        { name: 'Delay_1', type: 'delay', trigger: [{ syntax: '.*RECOVERY.*' }], duration: '30 seconds', times: 1, next: '@notify' },
      ]
    }
    const logText = [
      '2026-02-11 10:00:00 ERROR occurred',
      '2026-02-11 10:00:05 nothing relevant',  // no match, within duration, no more lines
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    const delayStep = result.steps.find(s => s.name === 'Delay_1')
    expect(delayStep.fired).toBe(false)
    expect(delayStep.cancelled).toBe(false)
    expect(delayStep.timedOut).toBe(true)
    expect(delayStep.nextAction).toBe('→ 메일 발송')
    // Chain proceeds through timeout -> @notify
    expect(result.finalResult.triggered).toBe(true)
  })

  it('delay duration check uses previous step timestamp as reference', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: 'Delay_1' },
        { name: 'Delay_1', type: 'delay', trigger: [{ syntax: '.*CANCEL.*' }], duration: '10 seconds', times: 1, next: '@notify' },
      ]
    }
    const logText = [
      '2026-02-11 10:00:00 ERROR occurred',
      '2026-02-11 10:00:15 CANCEL request',  // 15s > 10s from Step_1 -> timeout, not reset
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    const delayStep = result.steps.find(s => s.name === 'Delay_1')
    expect(delayStep.fired).toBe(false)  // pattern matched but AFTER duration
    expect(delayStep.cancelled).toBe(false)
    expect(delayStep.timedOut).toBe(true)
    expect(delayStep.nextAction).toBe('→ 메일 발송')
    expect(result.finalResult.triggered).toBe(true)
  })

  it('delay timeout firingTimestamp is prevStep + duration', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: 'Delay_1' },
        { name: 'Delay_1', type: 'delay', trigger: [{ syntax: '.*CANCEL.*' }], duration: '10 seconds', times: 1, next: '@notify' },
      ]
    }
    const logText = [
      '2026-02-11 10:00:00 ERROR occurred',
      '2026-02-11 10:00:05 nothing relevant',
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    expect(result.finalResult.triggered).toBe(true)
    // Firing timestamp should be 10:00:00 + 10s = 10:00:10 (not 10:00:00)
    const ts = result.firings[0]?.firingTimestamp
    expect(ts).toBeTruthy()
    expect(ts.getMinutes()).toBe(0)
    expect(ts.getSeconds()).toBe(10)  // 00 + 10 seconds
  })

  it('delay cancellation has cancelled=true and fired=true', () => {
    const trigger = {
      recipe: [
        { name: 'Step_1', type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: 'Delay_1' },
        { name: 'Delay_1', type: 'delay', trigger: [{ syntax: '.*RECOVERY.*' }], duration: '30 seconds', times: 1, next: '@notify' },
      ]
    }
    const logText = [
      '2026-02-11 10:00:00 ERROR occurred',
      '2026-02-11 10:00:10 RECOVERY done',
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')
    const delayStep = result.steps.find(s => s.name === 'Delay_1')
    expect(delayStep.fired).toBe(true)
    expect(delayStep.cancelled).toBe(true)
    expect(delayStep.timedOut).toBe(false)
    expect(delayStep.nextAction).toBe('→ 체인 리셋')
  })
})

// ===========================================================================
// convertSyntaxToRegex
// ===========================================================================

describe('convertSyntaxToRegex', () => {
  it('converts <<name>> to named capture group', () => {
    expect(convertSyntaxToRegex('.*ERROR.*<<code>>')).toBe('.*ERROR.*(?<code>[^\\s]+)')
  })

  it('converts (<<name>pattern) to named capture group with pattern', () => {
    expect(convertSyntaxToRegex('.*value: (<<val>[\\d.]+)')).toBe('.*value: (?<val>[\\d.]+)')
  })

  it('handles multiple named captures', () => {
    const result = convertSyntaxToRegex('<<host>> <<code>> <<msg>>')
    expect(result).toBe('(?<host>[^\\s]+) (?<code>[^\\s]+) (?<msg>[^\\s]+)')
  })

  it('returns syntax unchanged when no <<>> patterns', () => {
    expect(convertSyntaxToRegex('.*ERROR.*')).toBe('.*ERROR.*')
  })

  it('handles null/empty input', () => {
    expect(convertSyntaxToRegex(null)).toBe(null)
    expect(convertSyntaxToRegex('')).toBe('')
  })
})

// ===========================================================================
// parseParams
// ===========================================================================

describe('parseParams', () => {
  it('parses single condition', () => {
    const result = parseParams('ParamComparisionMatcher1@9.5,GTE,value')
    expect(result).toEqual([{ compareValue: 9.5, op: 'gte', varName: 'value' }])
  })

  it('parses multiple conditions', () => {
    const result = parseParams('ParamComparisionMatcher2@100,GT,count;50,LTE,rate')
    expect(result).toEqual([
      { compareValue: 100, op: 'gt', varName: 'count' },
      { compareValue: 50, op: 'lte', varName: 'rate' }
    ])
  })

  it('returns null for null/empty input', () => {
    expect(parseParams(null)).toBe(null)
    expect(parseParams('')).toBe(null)
    expect(parseParams(undefined)).toBe(null)
  })

  it('returns null for invalid format', () => {
    expect(parseParams('InvalidFormat')).toBe(null)
    expect(parseParams('Matcher1:9.5gte@value')).toBe(null)
  })

  it('parses integer compare values', () => {
    const result = parseParams('ParamComparisionMatcher1@100,EQ,code')
    expect(result).toEqual([{ compareValue: 100, op: 'eq', varName: 'code' }])
  })

  it('returns null for old format (ParameterMatcher)', () => {
    const result = parseParams('ParameterMatcher1:9.5gte@value')
    expect(result).toBeNull()
  })

})

// ===========================================================================
// evaluateParams
// ===========================================================================

describe('evaluateParams', () => {
  it('returns true for null/empty conditions', () => {
    expect(evaluateParams(null, {})).toBe(true)
    expect(evaluateParams([], {})).toBe(true)
  })

  it('eq: passes when equal', () => {
    const cond = [{ compareValue: 10, op: 'eq', varName: 'x' }]
    expect(evaluateParams(cond, { x: '10' })).toBe(true)
    expect(evaluateParams(cond, { x: '11' })).toBe(false)
  })

  it('neq: passes when not equal', () => {
    const cond = [{ compareValue: 10, op: 'neq', varName: 'x' }]
    expect(evaluateParams(cond, { x: '11' })).toBe(true)
    expect(evaluateParams(cond, { x: '10' })).toBe(false)
  })

  it('gt: passes when greater', () => {
    const cond = [{ compareValue: 9.5, op: 'gt', varName: 'val' }]
    expect(evaluateParams(cond, { val: '10' })).toBe(true)
    expect(evaluateParams(cond, { val: '9.5' })).toBe(false)
    expect(evaluateParams(cond, { val: '9' })).toBe(false)
  })

  it('gte: passes when greater or equal', () => {
    const cond = [{ compareValue: 9.5, op: 'gte', varName: 'val' }]
    expect(evaluateParams(cond, { val: '9.5' })).toBe(true)
    expect(evaluateParams(cond, { val: '10' })).toBe(true)
    expect(evaluateParams(cond, { val: '9' })).toBe(false)
  })

  it('lt: passes when less', () => {
    const cond = [{ compareValue: 5, op: 'lt', varName: 'val' }]
    expect(evaluateParams(cond, { val: '4' })).toBe(true)
    expect(evaluateParams(cond, { val: '5' })).toBe(false)
  })

  it('lte: passes when less or equal', () => {
    const cond = [{ compareValue: 5, op: 'lte', varName: 'val' }]
    expect(evaluateParams(cond, { val: '5' })).toBe(true)
    expect(evaluateParams(cond, { val: '4' })).toBe(true)
    expect(evaluateParams(cond, { val: '6' })).toBe(false)
  })

  it('fails when variable not in groups', () => {
    const cond = [{ compareValue: 10, op: 'eq', varName: 'missing' }]
    expect(evaluateParams(cond, { x: '10' })).toBe(false)
  })

  it('fails when variable is not a number', () => {
    const cond = [{ compareValue: 10, op: 'eq', varName: 'x' }]
    expect(evaluateParams(cond, { x: 'abc' })).toBe(false)
  })

  it('ALL conditions must pass (AND logic)', () => {
    const cond = [
      { compareValue: 10, op: 'gte', varName: 'a' },
      { compareValue: 5, op: 'lt', varName: 'b' }
    ]
    expect(evaluateParams(cond, { a: '10', b: '3' })).toBe(true)
    expect(evaluateParams(cond, { a: '10', b: '5' })).toBe(false)
    expect(evaluateParams(cond, { a: '9', b: '3' })).toBe(false)
  })
})

// ===========================================================================
// testTriggerPattern with params
// ===========================================================================

describe('testTriggerPattern - params conditions', () => {
  it('matches when params condition passes', () => {
    const trigger = {
      source: 'test',
      recipe: [{
        name: 'Step_1', type: 'regex',
        trigger: [{ syntax: '.*Warning value: (<<value>[\\d.]+)', params: 'ParamComparisionMatcher1@9.5,GTE,value' }],
        times: 1, next: '@recovery'
      }]
    }
    const logText = '2026-01-01 10:00:00 Warning value: 10.0'
    const result = testTriggerPattern(trigger, logText)
    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[0].matches[0].groups.value).toBe('10.0')
    expect(result.steps[0].matches[0].paramsResult.passed).toBe(true)
  })

  it('does NOT match when params condition fails', () => {
    const trigger = {
      source: 'test',
      recipe: [{
        name: 'Step_1', type: 'regex',
        trigger: [{ syntax: '.*Warning value: (<<value>[\\d.]+)', params: 'ParamComparisionMatcher1@9.5,GTE,value' }],
        times: 1, next: '@recovery'
      }]
    }
    const logText = '2026-01-01 10:00:00 Warning value: 5.0'
    const result = testTriggerPattern(trigger, logText)
    expect(result.steps[0].fired).toBe(false)
    expect(result.steps[0].matchCount).toBe(0)
  })

  it('works with <<name>> standalone syntax', () => {
    const trigger = {
      source: 'test',
      recipe: [{
        name: 'Step_1', type: 'regex',
        trigger: [{ syntax: '.*ERROR <<code>>', params: 'ParamComparisionMatcher1@500,GTE,code' }],
        times: 1, next: '@recovery'
      }]
    }
    const logText = 'ERROR 503'
    const result = testTriggerPattern(trigger, logText)
    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[0].matches[0].groups.code).toBe('503')
  })

  it('trigger without params still works (backward compatibility)', () => {
    const trigger = {
      source: 'test',
      recipe: [{
        name: 'Step_1', type: 'regex',
        trigger: [{ syntax: '.*ERROR.*' }],
        times: 1, next: '@recovery'
      }]
    }
    const logText = 'ERROR something'
    const result = testTriggerPattern(trigger, logText)
    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[0].matches[0].paramsResult).toBe(null)
  })

  it('params condition failure does not increment match count for times requirement', () => {
    const trigger = {
      source: 'test',
      recipe: [{
        name: 'Step_1', type: 'regex',
        trigger: [{ syntax: '.*value=(<<val>[\\d.]+)', params: 'ParamComparisionMatcher1@100,GTE,val' }],
        times: 2, next: '@recovery'
      }]
    }
    // Only 1 line passes params (200 >= 100), the other doesn't (50 < 100)
    const logText = 'value=50\nvalue=200\nvalue=150'
    const result = testTriggerPattern(trigger, logText)
    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[0].matchCount).toBe(2)
    // The matched values should be 200 and 150 (both >= 100)
    expect(result.steps[0].matches[0].groups.val).toBe('200')
    expect(result.steps[0].matches[1].groups.val).toBe('150')
  })

  it('paramsResult contains detailed evaluation info', () => {
    const trigger = {
      source: 'test',
      recipe: [{
        name: 'Step_1', type: 'regex',
        trigger: [{ syntax: '.*val=(<<val>[\\d.]+)', params: 'ParamComparisionMatcher1@10,GTE,val' }],
        times: 1, next: '@recovery'
      }]
    }
    const logText = 'val=15.5'
    const result = testTriggerPattern(trigger, logText)
    const pr = result.steps[0].matches[0].paramsResult
    expect(pr.passed).toBe(true)
    expect(pr.details).toHaveLength(1)
    expect(pr.details[0].varName).toBe('val')
    expect(pr.details[0].extractedValue).toBe(15.5)
    expect(pr.details[0].op).toBe('gte')
    expect(pr.details[0].compareValue).toBe(10)
    expect(pr.details[0].passed).toBe(true)
  })
})

// ===========================================================================
// testMultilineBlocks
// ===========================================================================

describe('testMultilineBlocks', () => {
  it('1. startPattern + endPattern → single block', () => {
    const source = { start_pattern: '.*BEGIN.*', end_pattern: '.*END.*', line_count: 100, priority: 'count' }
    const text = 'skip line\nBEGIN block\ncontent 1\ncontent 2\nEND block\nskip after'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].startLine).toBe(2)
    expect(result.blocks[0].endLine).toBe(5)
    expect(result.blocks[0].terminatedBy).toBe('endPattern')
    expect(result.blocks[0].lineCount).toBe(4)
    expect(result.blocks[0].lines[0].role).toBe('start')
    expect(result.blocks[0].lines[3].role).toBe('end')
    expect(result.skippedLines).toHaveLength(2)
  })

  it('2. count only termination (priority=count)', () => {
    const source = { start_pattern: '.*START.*', line_count: 3, priority: 'count' }
    const text = 'START here\nline 2\nline 3\nline 4'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].lineCount).toBe(3)
    expect(result.blocks[0].terminatedBy).toBe('count')
    expect(result.blocks[0].lines).toHaveLength(3)
  })

  it('3. endPattern termination (priority=pattern)', () => {
    const source = { start_pattern: '.*START.*', end_pattern: '.*STOP.*', line_count: 10, priority: 'pattern' }
    const text = 'START here\nline 2\nSTOP here\nline 4'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].terminatedBy).toBe('endPattern')
    expect(result.blocks[0].lineCount).toBe(3)
  })

  it('4. multiple blocks', () => {
    const source = { start_pattern: '.*BEGIN.*', end_pattern: '.*END.*', line_count: 100, priority: 'count' }
    const text = 'BEGIN 1\ncontent\nEND 1\nskip\nBEGIN 2\nEND 2'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(2)
    expect(result.blocks[0].blockNum).toBe(1)
    expect(result.blocks[1].blockNum).toBe(2)
  })

  it('5. nested startPattern with count priority → treated as content', () => {
    const source = { start_pattern: '.*START.*', end_pattern: '.*END.*', line_count: 100, priority: 'count' }
    const text = 'START block 1\ncontent\nSTART block 2\ncontent 2\nEND block 2'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].lineCount).toBe(5)
    expect(result.blocks[0].terminatedBy).toBe('endPattern')
    // start_pattern line treated as content in count priority
    expect(result.blocks[0].lines[2].role).toBe('content')
  })

  it('6. EOF termination', () => {
    const source = { start_pattern: '.*START.*', end_pattern: '.*END.*', line_count: 100, priority: 'count' }
    const text = 'START block\ncontent 1\ncontent 2'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].terminatedBy).toBe('eof')
  })

  it('7. no match → all skipped', () => {
    const source = { start_pattern: '.*NEVER.*', end_pattern: '.*END.*', line_count: 100, priority: 'count' }
    const text = 'line 1\nline 2\nline 3'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(0)
    expect(result.skippedLines).toHaveLength(3)
    expect(result.summary.blockCount).toBe(0)
    expect(result.summary.skippedCount).toBe(3)
  })

  it('8. empty input', () => {
    const source = { start_pattern: '.*START.*', line_count: 5, priority: 'count' }
    const result = testMultilineBlocks(source, '')
    expect(result.blocks).toHaveLength(0)
    expect(result.summary.totalLines).toBe(1) // empty string splits to ['']
  })

  it('9. invalid regex → errors array', () => {
    const source = { start_pattern: '[invalid', end_pattern: '.*END.*', line_count: 5, priority: 'count' }
    const text = 'line 1\nline 2'
    const result = testMultilineBlocks(source, text)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('start_pattern')
    expect(result.blocks).toHaveLength(0)
  })

  it('10. count=1: block start does not immediately check count', () => {
    const source = { start_pattern: '.*START.*', end_pattern: '.*END.*', line_count: 1, priority: 'count' }
    const text = 'START and END same line\nother line'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(1)
    // line_count=1 but block starts with lineCount=1, next line triggers count
    expect(result.blocks[0].lineCount).toBe(2)
    expect(result.blocks[0].terminatedBy).toBe('count')
  })

  it('11. pattern priority: endPattern before count → endPattern wins', () => {
    const source = { start_pattern: '.*START.*', end_pattern: '.*END.*', line_count: 10, priority: 'pattern' }
    const text = 'START block\ncontent\nEND here\nmore lines\nmore lines'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].terminatedBy).toBe('endPattern')
    expect(result.blocks[0].lineCount).toBe(3)
  })

  it('12. endPattern only (no startPattern) → no blocks', () => {
    const source = { end_pattern: '.*END.*', line_count: 5, priority: 'count' }
    const text = 'line 1\nEND here\nline 3'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(0)
    expect(result.skippedLines).toHaveLength(3)
  })

  it('13. line roles verification (start/content/end)', () => {
    const source = { start_pattern: '.*BEGIN.*', end_pattern: '.*END.*', line_count: 100, priority: 'count' }
    const text = 'BEGIN block\nmiddle 1\nmiddle 2\nEND block'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks[0].lines[0].role).toBe('start')
    expect(result.blocks[0].lines[1].role).toBe('content')
    expect(result.blocks[0].lines[2].role).toBe('content')
    expect(result.blocks[0].lines[3].role).toBe('end')
  })

  it('14. empty line terminates block', () => {
    const source = { start_pattern: '.*START.*', end_pattern: '.*END.*', line_count: 100, priority: 'count' }
    const text = 'START block\ncontent 1\n\ncontent after empty'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].lineCount).toBe(3) // START + content + empty
    expect(result.blocks[0].terminatedBy).toBe('emptyLine')
    expect(result.skippedLines).toHaveLength(1) // 'content after empty'
  })

  it('15. start_pattern treated as content in count priority (not new block)', () => {
    const source = { start_pattern: '.*BEGIN.*', line_count: 5, priority: 'count' }
    const text = 'BEGIN first\nBEGIN second\nBEGIN third\ncontent\nmore'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].lineCount).toBe(5)
    expect(result.blocks[0].terminatedBy).toBe('count')
    // All BEGIN lines are content (except the first which is 'start')
    expect(result.blocks[0].lines[0].role).toBe('start')
    expect(result.blocks[0].lines[1].role).toBe('content')
    expect(result.blocks[0].lines[2].role).toBe('content')
  })

  it('16. pattern priority: start_pattern flushes current block and starts new', () => {
    const source = { start_pattern: '.*START.*', end_pattern: '.*END.*', line_count: 100, priority: 'pattern' }
    const text = 'START block 1\ncontent\nSTART block 2\ncontent 2\nEND block 2'
    const result = testMultilineBlocks(source, text)
    expect(result.blocks).toHaveLength(2)
    expect(result.blocks[0].terminatedBy).toBe('startPattern')
    expect(result.blocks[0].lineCount).toBe(2) // START block 1 + content
    expect(result.blocks[1].terminatedBy).toBe('endPattern')
    expect(result.blocks[1].lineCount).toBe(3) // START block 2 + content 2 + END block 2
  })
})


// ===========================================================================
// testExtractAppend
// ===========================================================================

describe('testExtractAppend', () => {
  it('1. basic extract + appendPos=0 prepend', () => {
    const source = {
      pathPattern: '.*Log\\\\(\\d+)\\\\(\\d+)\\\\.*',
      appendPos: 0,
      appendFormat: '@1-@2 '
    }
    const result = testExtractAppend(source, 'C:\\Log\\1234\\5678\\app.log', 'ERROR something')
    expect(result.extraction.matched).toBe(true)
    expect(result.extraction.groups).toEqual(['1234', '5678'])
    expect(result.formatting.resolved).toBe('1234-5678 ')
    expect(result.lines[0].result).toBe('1234-5678 ERROR something')
  })

  it('2. appendPos large → append (end)', () => {
    const source = {
      pathPattern: '.*\\\\(\\w+)\\.log',
      appendPos: 9999,
      appendFormat: ' [@1]'
    }
    const result = testExtractAppend(source, 'C:\\Log\\myapp.log', 'hello')
    expect(result.lines[0].result).toBe('hello [@1]'.replace('@1', 'myapp'))
    expect(result.lines[0].result).toBe('hello [myapp]')
  })

  it('3. pattern no match → lines unchanged', () => {
    const source = {
      pathPattern: '.*NOMATCH.*',
      appendPos: 0,
      appendFormat: '@1 '
    }
    const result = testExtractAppend(source, 'C:\\Log\\app.log', 'original line')
    expect(result.extraction.matched).toBe(false)
    expect(result.lines[0].result).toBe('original line')
  })

  it('4. invalid regex → error', () => {
    const source = {
      pathPattern: '[invalid',
      appendPos: 0,
      appendFormat: '@1'
    }
    const result = testExtractAppend(source, 'some/path', 'line')
    expect(result.extraction.error).toBeTruthy()
    expect(result.extraction.matched).toBe(false)
  })

  it('5. multiple log lines all transformed', () => {
    const source = {
      pathPattern: '.*\\\\(\\w+)\\.log',
      appendPos: 0,
      appendFormat: '[@1] '
    }
    const result = testExtractAppend(source, 'C:\\Log\\svc.log', 'line1\nline2\nline3')
    expect(result.lines).toHaveLength(3)
    expect(result.lines[0].result).toBe('[svc] line1')
    expect(result.lines[1].result).toBe('[svc] line2')
    expect(result.lines[2].result).toBe('[svc] line3')
    expect(result.summary.totalLines).toBe(3)
  })

  it('6. middle position insert', () => {
    const source = {
      pathPattern: '.*\\\\(\\w+)\\.log',
      appendPos: 5,
      appendFormat: '[@1]'
    }
    const result = testExtractAppend(source, 'C:\\Log\\app.log', 'ABCDEFGHIJ')
    expect(result.lines[0].result).toBe('ABCDE[app]FGHIJ')
  })

  it('7. max 5 capture groups', () => {
    const source = {
      pathPattern: '(a)(b)(c)(d)(e)(f)',
      appendPos: 0,
      appendFormat: '@1@2@3@4@5'
    }
    const result = testExtractAppend(source, 'abcdef', 'X')
    expect(result.extraction.groups).toHaveLength(5) // max 5
    expect(result.extraction.groups).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(result.formatting.resolved).toBe('abcde')
    expect(result.lines[0].result).toBe('abcdeX')
  })

  it('8. empty appendFormat → no change', () => {
    const source = {
      pathPattern: '.*\\\\(\\w+)\\.log',
      appendPos: 0,
      appendFormat: ''
    }
    const result = testExtractAppend(source, 'C:\\Log\\app.log', 'original')
    expect(result.lines[0].result).toBe('original')
  })

  it('9. fewer groups than placeholders → empty string substitution', () => {
    const source = {
      pathPattern: '.*\\\\(\\w+)\\.log',
      appendPos: 0,
      appendFormat: '@1-@2-@3 '
    }
    const result = testExtractAppend(source, 'C:\\Log\\app.log', 'line')
    // Only @1 has value, @2 and @3 become empty
    expect(result.formatting.resolved).toBe('app-- ')
    expect(result.lines[0].result).toBe('app-- line')
  })

  it('10. auto-escapes backslashes in pathPattern for Windows paths', () => {
    const source = {
      pathPattern: '.*\\Log\\Log_([0-9]+)-([0-9]+)-([0-9]+).txt',
      appendPos: 0,
      appendFormat: '@1-@2-@3 '
    }
    const filePath = 'D:\\EARS\\Log\\Log_2025-06-12.txt'
    const logText = 'some log line'
    const result = testExtractAppend(source, filePath, logText)
    expect(result.extraction.matched).toBe(true)
    expect(result.extraction.groups).toEqual(['2025', '06', '12'])
    expect(result.lines[0].result).toBe('2025-06-12 some log line')
  })
})
