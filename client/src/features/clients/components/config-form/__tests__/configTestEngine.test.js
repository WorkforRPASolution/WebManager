import { describe, it, expect } from 'vitest'
import {
  testAccessLogPath,
  timestampFormatToRegex,
  testTriggerPattern,
  parseDurationMs,
  testTriggerWithFiles
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

  it('9. No prefix/suffix - matches any file in directory', () => {
    const source = { directory: 'D:\\Testlog\\', prefix: '', suffix: '' }
    const result = testAccessLogPath(source, 'D:\\Testlog\\anything.xyz')
    expect(result.matched).toBe(true)
  })

  it('10. Date subdir format - filePath includes subdirectory', () => {
    const source = {
      directory: 'D:\\Testlog\\',
      prefix: 'TestLog',
      suffix: '.log',
      date_subdir_format: 'yyyyMMdd'
    }
    const result = testAccessLogPath(source, 'D:\\Testlog\\20260214\\TestLog_001.log')
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

  it('3. Keyword type (case-insensitive)', () => {
    const trigger = {
      recipe: [{ type: 'keyword', trigger: ['error'], times: 1, next: '' }]
    }
    const logText = 'This has an ERROR message'
    const result = testTriggerPattern(trigger, logText, null)

    expect(result.steps[0].fired).toBe(true)
    expect(result.finalResult.triggered).toBe(true)
  })

  it('4. Exact type (case-sensitive)', () => {
    const trigger = {
      recipe: [{ type: 'exact', trigger: ['EXACT_MATCH'], times: 1, next: '' }]
    }

    // Exact match
    const r1 = testTriggerPattern(trigger, 'EXACT_MATCH', null)
    expect(r1.steps[0].fired).toBe(true)
    expect(r1.finalResult.triggered).toBe(true)

    // Case mismatch - should NOT fire
    const r2 = testTriggerPattern(trigger, 'exact_match', null)
    expect(r2.steps[0].fired).toBe(false)
    expect(r2.finalResult.triggered).toBe(false)
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
