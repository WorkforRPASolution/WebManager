import { describe, it, expect } from 'vitest'
import {
  testAccessLogPath,
  testMultilineBlocks,
  testExtractAppend,
  testLogTimeFilter,
  testLineGroup,
  previewToken
} from '../testEngine'

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

  it('28. Prefix with Joda tokens - resolves to current date and matches (date_prefix mode)', () => {
    const now = new Date()
    const y = String(now.getFullYear())
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dateStr = y + m + d
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: 'Log_yyyyMMdd',
      suffix: '.txt',
      log_type: 'date_prefix_single'
    }
    const result = testAccessLogPath(source, `D:\\EARS\\Log\\Log_${dateStr}.txt`)
    expect(result.matched).toBe(true)
    const prefixStep = result.steps.find((s) => s.label === 'Prefix')
    expect(prefixStep).toBeDefined()
    expect(prefixStep.passed).toBe(true)
    expect(prefixStep.detail).toContain(`Log_${dateStr}`)
    expect(prefixStep.detail).toContain('원본: "Log_yyyyMMdd"')
  })

  it('29. Prefix with Joda tokens - does NOT match wrong date (date_prefix mode)', () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86400000)
    const y = String(yesterday.getFullYear())
    const m = String(yesterday.getMonth() + 1).padStart(2, '0')
    const d = String(yesterday.getDate()).padStart(2, '0')
    const dateStr = y + m + d
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: 'Log_yyyyMMdd',
      suffix: '.txt',
      log_type: 'date_prefix_single'
    }
    const result = testAccessLogPath(source, `D:\\EARS\\Log\\Log_${dateStr}.txt`)
    expect(result.matched).toBe(false)
    const prefixStep = result.steps.find((s) => s.label === 'Prefix')
    expect(prefixStep).toBeDefined()
    expect(prefixStep.passed).toBe(false)
    expect(prefixStep.detail).toContain('파일명')
    expect(prefixStep.detail).toContain('현재 날짜 기준 예상 접두사')
  })

  it('30. Suffix with Joda tokens - resolves to current date and matches (date_suffix mode)', () => {
    const now = new Date()
    const y = String(now.getFullYear())
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dateStr = y + m + d
    const source = {
      directory: 'D:\\EARS\\Log',
      prefix: 'Log',
      suffix: '_yyyyMMdd.txt',
      log_type: 'date_suffix_single'
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
// testAccessLogPath - dateAxis 모드 게이팅 (Agent 동작과 정합화)
// ===========================================================================

describe('testAccessLogPath — dateAxis 모드 게이팅', () => {
  const now = new Date()
  const y = String(now.getFullYear())
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const todayStr = y + m + d

  it('M1: prefix 토큰은 dateAxis=date_prefix 에서만 해석된다 (normal 에서는 리터럴)', () => {
    const sourceNormal = {
      directory: 'D:\\Log',
      prefix: 'yyyyMMdd_log',
      suffix: '.txt',
      log_type: 'normal_single'
    }
    // normal 모드 — 'yyyyMMdd_log' 리터럴 매칭 시도
    const literal = testAccessLogPath(sourceNormal, 'D:\\Log\\yyyyMMdd_log.txt')
    expect(literal.matched).toBe(true)

    // 같은 prefix 인데 오늘 날짜로 치환된 파일 → normal 에서는 매칭 안 됨
    const resolved = testAccessLogPath(sourceNormal, `D:\\Log\\${todayStr}_log.txt`)
    expect(resolved.matched).toBe(false)
  })

  it('M1b: prefix 토큰은 dateAxis=date_prefix 에서 해석된다', () => {
    const source = {
      directory: 'D:\\Log',
      prefix: 'yyyyMMdd_log',
      suffix: '.txt',
      log_type: 'date_prefix_single'
    }
    const result = testAccessLogPath(source, `D:\\Log\\${todayStr}_log.txt`)
    expect(result.matched).toBe(true)
    const prefixStep = result.steps.find(s => s.label === 'Prefix')
    expect(prefixStep.detail).toContain('원본: "yyyyMMdd_log"')
  })

  it('M2: suffix 토큰은 dateAxis=date_suffix 에서만 해석된다 (normal 에서는 리터럴)', () => {
    const sourceNormal = {
      directory: 'D:\\Log',
      prefix: 'app',
      suffix: '_HHmm.txt',
      log_type: 'normal_single'
    }
    // normal — 리터럴 '_HHmm.txt' 매칭
    const literal = testAccessLogPath(sourceNormal, 'D:\\Log\\app_HHmm.txt')
    expect(literal.matched).toBe(true)

    // date_suffix — 토큰 해석으로 _<HH><mm>.txt
    const sourceDS = { ...sourceNormal, log_type: 'date_suffix_single' }
    const literalInDS = testAccessLogPath(sourceDS, 'D:\\Log\\app_HHmm.txt')
    expect(literalInDS.matched).toBe(false)
  })

  it('M3: wildcard 는 모든 dateAxis 에서 리터럴 (ss/MM 약어 안전)', () => {
    // ss 약어를 wildcard 에 넣고 date_suffix 모드에서도 리터럴 유지되는지
    const source = {
      directory: 'D:\\Log',
      prefix: 'app',
      wildcard: 'ss_data',
      suffix: '.log',
      log_type: 'date_suffix_single'
    }
    // 리터럴 'ss_data' 가 파일명에 있는 경우만 매칭
    const literal = testAccessLogPath(source, 'D:\\Log\\app_ss_data_x.log')
    expect(literal.matched).toBe(true)
    const wcStep = literal.steps.find(s => s.label === 'Wildcard')
    // 리터럴이므로 detail 에 "현재 날짜 기준 예상" 노출 안 됨
    expect(wcStep.detail).not.toContain('현재 날짜 기준')
    expect(wcStep.detail).not.toContain('원본')
  })

  it('M4: date_subdir_format 은 값이 있으면 항상 해석된다 (UI 가 dateAxis 게이팅)', () => {
    // log_type=date_single → dateAxis=date
    const source = {
      directory: 'D:\\Log',
      prefix: 'TestLog',
      suffix: '.log',
      date_subdir_format: 'yyyyMMdd',
      log_type: 'date_single'
    }
    const result = testAccessLogPath(source, `D:\\Log\\${todayStr}\\TestLog_001.log`)
    expect(result.matched).toBe(true)
  })

  it('M5: dateAxis=normal 인 prefix 의 detail 에 "현재 날짜 기준" 안 나옴', () => {
    const source = {
      directory: 'D:\\Log',
      prefix: 'yyyy_log',  // 토큰 포함이지만 normal 모드라 리터럴
      suffix: '.txt',
      log_type: 'normal_single'
    }
    const result = testAccessLogPath(source, 'D:\\Log\\yyyy_log_x.txt')
    expect(result.matched).toBe(true)
    const prefixStep = result.steps.find(s => s.label === 'Prefix')
    expect(prefixStep.detail).not.toContain('현재 날짜 기준')
    expect(prefixStep.detail).not.toContain('원본')
  })
})


// ===========================================================================
// Joda 인용 이스케이프 (B)
// ===========================================================================

describe('Joda 인용 이스케이프', () => {
  it("Q1: prefix=\"'yyyy'_log\" + date_prefix → 리터럴 yyyy_log", () => {
    const source = {
      directory: 'D:\\Log',
      prefix: "'yyyy'_log",
      suffix: '.txt',
      log_type: 'date_prefix_single'
    }
    const result = testAccessLogPath(source, 'D:\\Log\\yyyy_log_x.txt')
    expect(result.matched).toBe(true)
  })

  it('Q2: suffix 인용 + 토큰 혼합 (date_suffix)', () => {
    const now = new Date()
    const mm = String(now.getMinutes()).padStart(2, '0')
    const source = {
      directory: 'D:\\Log',
      prefix: 'app',
      suffix: "_'HH'mm.txt",
      log_type: 'date_suffix_single'
    }
    const result = testAccessLogPath(source, `D:\\Log\\app_HH${mm}.txt`)
    expect(result.matched).toBe(true)
  })

  it("Q3: quoted section 안의 '' 는 따옴표 한 글자 (Joda 표준)", () => {
    // 표준 Joda: 'a''b' = quoted section "a'b". '' 단독은 빈 quoted section.
    const resolved = previewToken("'a''b'yyyy", 'prefix', 'date_prefix')
    const y = String(new Date().getFullYear())
    expect(resolved).toBe(`a'b${y}`)
  })

  it("Q4: 토큰 없이 쿼트로만 감싼 literal 도 쿼트가 벗겨져야 함 (Joda 표준)", () => {
    // 'PARAMS' → PARAMS (quote 가 literal marker 로 처리되어 벗겨짐)
    expect(previewToken("'PARAMS'", 'prefix', 'date_prefix')).toBe('PARAMS')

    // 실제 매칭 시나리오: prefix="'PARAMS'" 이면 파일명 PARAMS_xxx.txt 가 매칭돼야 함
    const source = {
      directory: 'D:\\Log',
      prefix: "'PARAMS'",
      suffix: '.txt',
      log_type: 'date_prefix_single'
    }
    const result = testAccessLogPath(source, 'D:\\Log\\PARAMS_xxx.txt')
    expect(result.matched).toBe(true)
  })

  it("Q5: input trim — trailing whitespace 가 매칭에 영향 없어야 함 (server-side 와 정합)", () => {
    // 사용자가 prefix 에 'PARAMS ' 처럼 trailing space 를 실수로 넣어도
    // server 의 trim 동작과 일치해야 함
    const source = {
      directory: 'D:\\Log ',  // trailing space
      prefix: 'PARAMS ',
      suffix: '.txt ',
      log_type: 'normal_single'
    }
    const result = testAccessLogPath(source, 'D:\\Log\\PARAMS_xxx.txt')
    expect(result.matched).toBe(true)
  })
})


// ===========================================================================
// previewToken export
// ===========================================================================

describe('previewToken (UI 미리보기 진입점)', () => {
  it('PT1: 게이팅으로 막힌 fieldRole 은 원본 반환', () => {
    expect(previewToken('yyyy_log', 'prefix', 'normal')).toBe('yyyy_log')
    expect(previewToken('yyyy_log', 'wildcard', 'date_prefix')).toBe('yyyy_log')
    expect(previewToken('_HHmm.txt', 'suffix', 'normal')).toBe('_HHmm.txt')
  })

  it('PT2: 게이팅 통과 + 토큰 검출 시 치환', () => {
    const y = String(new Date().getFullYear())
    expect(previewToken('Log_yyyy', 'prefix', 'date_prefix')).toBe(`Log_${y}`)
  })

  it('PT3: 토큰 없으면 원본 반환 (빈 문자열, 일반 문자열)', () => {
    expect(previewToken('', 'prefix', 'date_prefix')).toBe('')
    expect(previewToken('plain_prefix', 'prefix', 'date_prefix')).toBe('plain_prefix')
  })

  it('PT4: 알 수 없는 fieldRole 은 안전하게 원본 반환', () => {
    expect(previewToken('yyyy', 'unknown', 'date_prefix')).toBe('yyyy')
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

  it('17. start/end_pattern use full-match (Java String.matches / Scala .r match)', () => {
    // "BEGIN block" does NOT fully match "BEGIN" (no trailing .*)
    const source = { start_pattern: 'BEGIN', end_pattern: 'END', line_count: 100, priority: 'count' }
    const text = 'BEGIN block\nBEGIN\ncontent\nEND block\nEND'
    const result = testMultilineBlocks(source, text)
    // Only exact "BEGIN" (line 2) matches start, exact "END" (line 5) matches end
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].startLine).toBe(2)
    expect(result.blocks[0].endLine).toBe(5)
    // "BEGIN block" (line 1) is outside block → skipped
    expect(result.skippedLines.some(s => s.text === 'BEGIN block')).toBe(true)
    // "END block" (line 4) is inside block → content (not skipped)
    expect(result.blocks[0].lines.some(l => l.text === 'END block')).toBe(true)
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

  it('10. pathPattern uses full-match (Java String.matches / Scala .r match)', () => {
    // "C:\Log\app.log" does NOT fully match "\\Log\\" (partial pattern)
    const source = {
      pathPattern: '\\\\Log\\\\(\\w+)',
      appendPos: 0,
      appendFormat: '@1 '
    }
    const result = testExtractAppend(source, 'C:\\Log\\app.log', 'line')
    // Partial pattern doesn't cover full path → no match
    expect(result.extraction.matched).toBe(false)
    expect(result.lines[0].result).toBe('line')
  })

  it('11. pathPattern full-match with .* anchors works', () => {
    const source = {
      pathPattern: '.*\\\\Log\\\\(\\w+)\\.log',
      appendPos: 0,
      appendFormat: '@1 '
    }
    const result = testExtractAppend(source, 'C:\\Log\\app.log', 'line')
    expect(result.extraction.matched).toBe(true)
    expect(result.lines[0].result).toBe('app line')
  })

  it('12. auto-escapes backslashes in pathPattern for Windows paths', () => {
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


// ===========================================================================
// testLogTimeFilter
// ===========================================================================

describe('testLogTimeFilter', () => {
  it('basic extraction — HH:mm:ss pattern', () => {
    const source = {
      log_time_pattern: '(\\d{2}:\\d{2}:\\d{2})',
      log_time_format: 'HH:mm:ss'
    }
    const text = '10:00:00 INFO Start\n10:01:00 INFO Process\n10:02:00 INFO End'
    const result = testLogTimeFilter(source, text)
    expect(result.lines).toHaveLength(3)
    expect(result.lines.every(l => l.status === 'pass')).toBe(true)
    expect(result.summary.total).toBe(3)
    expect(result.summary.passed).toBe(3)
    expect(result.summary.skipped).toBe(0)
  })

  it('reverse order — later lines skipped', () => {
    const source = {
      log_time_pattern: '(\\d{2}:\\d{2}:\\d{2})',
      log_time_format: 'HH:mm:ss'
    }
    const text = '10:02:00 INFO Late\n10:01:00 INFO Mid\n10:00:00 INFO Early'
    const result = testLogTimeFilter(source, text)
    expect(result.lines[0].status).toBe('pass')
    expect(result.lines[1].status).toBe('skip')
    expect(result.lines[2].status).toBe('skip')
    expect(result.summary.passed).toBe(1)
    expect(result.summary.skipped).toBe(2)
  })

  it('same time — passes (>=)', () => {
    const source = {
      log_time_pattern: '(\\d{2}:\\d{2}:\\d{2})',
      log_time_format: 'HH:mm:ss'
    }
    const text = '10:00:00 A\n10:00:00 B\n10:00:00 C'
    const result = testLogTimeFilter(source, text)
    expect(result.lines.every(l => l.status === 'pass')).toBe(true)
  })

  it('no match — status is no-match (passes through)', () => {
    const source = {
      log_time_pattern: '(\\d{2}:\\d{2}:\\d{2})',
      log_time_format: 'HH:mm:ss'
    }
    const text = 'No timestamp here\n10:00:00 Valid\nAnother no match'
    const result = testLogTimeFilter(source, text)
    expect(result.lines[0].status).toBe('no-match')
    expect(result.lines[1].status).toBe('pass')
    expect(result.lines[2].status).toBe('no-match')
    expect(result.summary.noTimestamp).toBe(2)
  })

  it('full datetime format', () => {
    const source = {
      log_time_pattern: '(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2})',
      log_time_format: 'yyyy-MM-dd HH:mm:ss'
    }
    const text = '2026-02-20 10:00:00 INFO Start\n2026-02-20 10:01:00 INFO Next\n2026-02-19 23:59:00 INFO Old'
    const result = testLogTimeFilter(source, text)
    expect(result.lines[0].status).toBe('pass')
    expect(result.lines[1].status).toBe('pass')
    expect(result.lines[2].status).toBe('skip')
  })

  it('missing log_time_pattern → error', () => {
    const source = {}
    const text = 'some log line'
    const result = testLogTimeFilter(source, text)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('invalid regex pattern → error', () => {
    const source = {
      log_time_pattern: '([invalid',
      log_time_format: 'HH:mm:ss'
    }
    const text = '10:00:00 test'
    const result = testLogTimeFilter(source, text)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

// ===========================================================================
// testLineGroup
// ===========================================================================

describe('testLineGroup', () => {
  it('basic grouping — count=3, 6 lines → 2 groups', () => {
    const source = { line_group_count: 3 }
    const text = 'line1\nline2\nline3\nline4\nline5\nline6'
    const result = testLineGroup(source, text)
    expect(result.groups).toHaveLength(2)
    expect(result.groups[0].lines).toHaveLength(3)
    expect(result.groups[1].lines).toHaveLength(3)
    expect(result.summary.groupCount).toBe(2)
  })

  it('<<EOL>> concatenation', () => {
    const source = { line_group_count: 2 }
    const text = 'A\nB\nC\nD'
    const result = testLineGroup(source, text)
    expect(result.groups[0].groupedText).toBe('A<<EOL>>B')
    expect(result.groups[1].groupedText).toBe('C<<EOL>>D')
  })

  it('pattern filter — only matching lines grouped', () => {
    const source = { line_group_count: 2, line_group_pattern: '.*ERROR.*' }
    const text = 'ERROR one\nINFO two\nERROR three\nINFO four\nERROR five'
    const result = testLineGroup(source, text)
    // ERROR one + ERROR three = group 1, ERROR five is incomplete
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].groupedText).toBe('ERROR one<<EOL>>ERROR three')
    expect(result.ungrouped).toHaveLength(2) // INFO two, INFO four
    expect(result.summary.incompleteGroup).toBe(true) // ERROR five remaining
  })

  it('incomplete group — 5 lines / count=3 → 1 group + 1 incomplete', () => {
    const source = { line_group_count: 3 }
    const text = 'A\nB\nC\nD\nE'
    const result = testLineGroup(source, text)
    expect(result.groups).toHaveLength(1) // first 3
    expect(result.summary.incompleteGroup).toBe(true)
    expect(result.summary.totalLines).toBe(5)
  })

  it('no pattern — all lines are group targets', () => {
    const source = { line_group_count: 2 }
    const text = 'A\nB\nC'
    const result = testLineGroup(source, text)
    expect(result.groups).toHaveLength(1) // A+B
    expect(result.ungrouped).toHaveLength(0)
    expect(result.summary.incompleteGroup).toBe(true) // C is incomplete
  })

  it('count=1 — each line is its own group', () => {
    const source = { line_group_count: 1 }
    const text = 'A\nB\nC'
    const result = testLineGroup(source, text)
    expect(result.groups).toHaveLength(3)
    expect(result.groups[0].groupedText).toBe('A')
    expect(result.groups[1].groupedText).toBe('B')
    expect(result.groups[2].groupedText).toBe('C')
    expect(result.summary.incompleteGroup).toBe(false)
  })

  it('empty input — 0 groups', () => {
    const source = { line_group_count: 3 }
    const text = ''
    const result = testLineGroup(source, text)
    expect(result.groups).toHaveLength(0)
    expect(result.summary.groupCount).toBe(0)
  })

  it('pattern uses Java String.matches() full-match semantics (implicit ^...$)', () => {
    // Java: "line 1".matches(".*line") === false (full-match: doesn't end with "line")
    const source = { line_group_count: 3, line_group_pattern: '.*line' }
    const text = 'line 1\nline 2\nline 3\nline 4'
    const result = testLineGroup(source, text)
    // None of "line 1", "line 2", etc. fully match ".*line" — all go to ungrouped
    expect(result.groups).toHaveLength(0)
    expect(result.ungrouped).toHaveLength(4)
  })

  it('pattern full-match — ".*ERROR.*" matches "ERROR one" (full-match OK)', () => {
    // Java: "ERROR one".matches(".*ERROR.*") === true
    const source = { line_group_count: 2, line_group_pattern: '.*ERROR.*' }
    const text = 'ERROR one\nINFO two\nERROR three'
    const result = testLineGroup(source, text)
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].groupedText).toBe('ERROR one<<EOL>>ERROR three')
    expect(result.ungrouped).toHaveLength(1) // INFO two
  })

  it('invalid pattern → error', () => {
    const source = { line_group_count: 2, line_group_pattern: '([invalid' }
    const text = 'line1\nline2'
    const result = testLineGroup(source, text)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
