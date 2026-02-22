import { describe, it, expect } from 'vitest'
import { describeAccessLog } from '../description'

// ---------------------------------------------------------------------------
// describeAccessLog
// ---------------------------------------------------------------------------
describe('describeAccessLog', () => {
  it('full config — all fields populated', () => {
    const source = {
      name: 'LogReadInfo',
      directory: '/var/log/app',
      prefix: 'access',
      suffix: '.log',
      wildcard: '*.log.*',
      log_type: 'date_single',
      date_subdir_format: 'yyyyMMdd',
      charset: 'EUC-KR',
      access_interval: '10 seconds',
      batch_count: 5000,
      back: true,
      end: true,
      reopen: true,
      exclude_suffix: ['.bak', '.tmp'],
    }

    const result = describeAccessLog(source)

    // glob-like file pattern
    expect(result).toContain('감시 파일: /var/log/app/<yyyyMMdd>/access**.log.**.log')
    // exclude suffix
    expect(result).toContain('(제외: .bak, .tmp)')
    // reading settings pipe-separated
    expect(result).toContain('읽기:')
    expect(result).toContain('EUC-KR')
    expect(result).toContain('10초 간격')
    expect(result).toContain('파일 재열기')
    // batch count for upload-like
    expect(result).toContain('배치 5,000줄')
    // start behavior
    expect(result).toContain('시작:')
    expect(result).toContain('마지막 위치부터 이어 읽기')
    expect(result).toContain('파일 끝부터 시작')
  })

  it('minimal config — only directory', () => {
    const source = { directory: '/logs' }
    const result = describeAccessLog(source)

    // glob pattern: directory + wildcard
    expect(result).toContain('감시 파일: /logs/*')
    // no 읽기 line if no settings
    expect(result).not.toContain('읽기:')
    // no 시작 line if no back/end
    expect(result).not.toContain('시작:')
  })

  // --- File pattern combinations ---
  describe('file pattern combinations', () => {
    it('prefix + suffix → prefix*suffix', () => {
      const result = describeAccessLog({ directory: '/d', prefix: 'app', suffix: '.log' })
      expect(result).toContain('감시 파일: /d/app*.log')
    })

    it('prefix only → prefix*', () => {
      const result = describeAccessLog({ directory: '/d', prefix: 'app' })
      expect(result).toContain('감시 파일: /d/app*')
    })

    it('suffix only → *.suffix', () => {
      const result = describeAccessLog({ directory: '/d', suffix: '.txt' })
      expect(result).toContain('감시 파일: /d/*.txt')
    })

    it('neither prefix nor suffix → *', () => {
      const result = describeAccessLog({ directory: '/d' })
      expect(result).toContain('감시 파일: /d/*')
    })

    it('wildcard + suffix → *wildcard*suffix', () => {
      const result = describeAccessLog({ directory: '/d', wildcard: 'system', suffix: '.txt' })
      expect(result).toContain('감시 파일: /d/*system*.txt')
    })

    it('wildcard only → *wildcard*', () => {
      const result = describeAccessLog({ directory: '/d', wildcard: 'system' })
      expect(result).toContain('감시 파일: /d/*system*')
    })

    it('prefix + wildcard + suffix → prefix*wildcard*suffix', () => {
      const result = describeAccessLog({ directory: '/d', prefix: 'Log_', wildcard: 'sys', suffix: '.txt' })
      expect(result).toContain('감시 파일: /d/Log_*sys*.txt')
    })

    it('no wildcard, no suffix, no prefix → no wildcard note', () => {
      const result = describeAccessLog({ directory: '/d' })
      expect(result).not.toContain('와일드카드')
    })
  })

  // --- date_subdir_format ---
  describe('date_subdir_format', () => {
    it('when present, appears in glob pattern', () => {
      const result = describeAccessLog({
        directory: '/d',
        date_subdir_format: 'yyyy/MM/dd',
        prefix: 'app',
      })
      expect(result).toContain('감시 파일: /d/<yyyy/MM/dd>/app*')
    })

    it('when absent, no subdir in pattern', () => {
      const result = describeAccessLog({ directory: '/d', prefix: 'app' })
      expect(result).toContain('감시 파일: /d/app*')
      expect(result).not.toContain('<')
    })

    it('windows path with date_subdir_format', () => {
      const result = describeAccessLog({
        directory: 'D:\\EARS\\Log',
        date_subdir_format: "'\\\\'yyyy",
        prefix: 'Log_',
        suffix: '.txt',
      })
      expect(result).toContain("감시 파일: D:\\EARS\\Log\\<'\\\\'yyyy>\\Log_*.txt")
    })
  })

  // --- Behavior options (now under 시작:) ---
  describe('behavior options', () => {
    it('back=true → "마지막 위치부터 이어 읽기"', () => {
      const result = describeAccessLog({ directory: '/d', back: true })
      expect(result).toContain('시작: 마지막 위치부터 이어 읽기')
    })

    it('back=false → "처음부터 읽기"', () => {
      const result = describeAccessLog({ directory: '/d', back: false })
      expect(result).toContain('시작: 처음부터 읽기')
    })

    it('end=true → "파일 끝부터 시작"', () => {
      const result = describeAccessLog({ directory: '/d', end: true })
      expect(result).toContain('파일 끝부터 시작')
    })

    it('reopen=true → "파일 재열기" in 읽기 line', () => {
      const result = describeAccessLog({ directory: '/d', reopen: true })
      expect(result).toContain('읽기:')
      expect(result).toContain('파일 재열기')
    })

    it('no behavior flags → no 시작 line', () => {
      const result = describeAccessLog({ directory: '/d' })
      expect(result).not.toContain('시작:')
      expect(result).not.toContain('마지막')
      expect(result).not.toContain('처음부터')
      expect(result).not.toContain('끝부터')
    })

    it('back + end combined → pipe-separated', () => {
      const result = describeAccessLog({ directory: '/d', back: true, end: true })
      expect(result).toContain('시작: 마지막 위치부터 이어 읽기 | 파일 끝부터 시작')
    })
  })

  // --- Exclude suffix ---
  describe('exclude suffix', () => {
    it('[".bak", ".tmp"] appears after file pattern', () => {
      const result = describeAccessLog({
        directory: '/d',
        exclude_suffix: ['.bak', '.tmp'],
      })
      expect(result).toContain('(제외: .bak, .tmp)')
    })

    it('empty exclude_suffix array → no exclude text', () => {
      const result = describeAccessLog({
        directory: '/d',
        exclude_suffix: [],
      })
      expect(result).not.toContain('제외')
    })
  })

  // --- Interval parsing ---
  describe('interval parsing', () => {
    it('"10 seconds" → "10초"', () => {
      const result = describeAccessLog({ directory: '/d', access_interval: '10 seconds' })
      expect(result).toContain('10초 간격')
    })

    it('"1 minutes" → "1분"', () => {
      const result = describeAccessLog({ directory: '/d', access_interval: '1 minutes' })
      expect(result).toContain('1분 간격')
    })

    it('"2 hours" → "2시간"', () => {
      const result = describeAccessLog({ directory: '/d', access_interval: '2 hours' })
      expect(result).toContain('2시간 간격')
    })

    it('singular unit "1 second" → "1초"', () => {
      const result = describeAccessLog({ directory: '/d', access_interval: '1 second' })
      expect(result).toContain('1초 간격')
    })

    it('unparseable string passes through as-is', () => {
      const result = describeAccessLog({ directory: '/d', access_interval: 'fast' })
      expect(result).toContain('fast 간격')
    })

    it('missing interval → no interval in output', () => {
      const result = describeAccessLog({ directory: '/d' })
      expect(result).not.toContain('간격')
    })
  })

  // --- Multiline description ---
  describe('multiline settings', () => {
    it('startPattern + endPattern + count + priority', () => {
      const result = describeAccessLog({
        directory: '/d',
        log_type: 'normal_multiline',
        start_pattern: '.*START.*',
        end_pattern: '.*END.*',
        line_count: 10,
        priority: 'pattern'
      })
      expect(result).toContain('다중 라인:')
      expect(result).toContain('".*START.*" ~ ".*END.*" 블록 수집')
      expect(result).toContain('최대 10줄')
      expect(result).toContain('패턴 우선')
    })

    it('startPattern only → "부터 블록 수집"', () => {
      const result = describeAccessLog({
        directory: '/d',
        start_pattern: '.*BEGIN.*',
      })
      expect(result).toContain('".*BEGIN.*"부터 블록 수집')
    })

    it('endPattern only → "까지 블록 수집"', () => {
      const result = describeAccessLog({
        directory: '/d',
        end_pattern: '.*FINISH.*',
      })
      expect(result).toContain('".*FINISH.*"까지 블록 수집')
    })

    it('count with priority=count → "라인 수 우선"', () => {
      const result = describeAccessLog({
        directory: '/d',
        start_pattern: 'S',
        line_count: 5,
        priority: 'count'
      })
      expect(result).toContain('최대 5줄, 라인 수 우선')
    })

    it('no multiline fields → no multiline line', () => {
      const result = describeAccessLog({ directory: '/d', log_type: 'normal_single' })
      expect(result).not.toContain('다중 라인')
    })

    it('blank line before multiline section', () => {
      const result = describeAccessLog({
        directory: '/d',
        start_pattern: 'S',
        end_pattern: 'E',
      })
      const lines = result.split('\n')
      const mlIndex = lines.findIndex(l => l.startsWith('다중 라인:'))
      expect(mlIndex).toBeGreaterThan(0)
      expect(lines[mlIndex - 1]).toBe('')
    })
  })

  // --- Extract-append description ---
  describe('extract-append settings', () => {
    it('pathPattern + appendFormat + appendPos=0', () => {
      const result = describeAccessLog({
        directory: '/d',
        log_type: 'normal_single_extract_append',
        pathPattern: '.*Log\\([0-9]+).*',
        appendFormat: '@1-@2 ',
        appendPos: 0
      })
      expect(result).toContain('추출-삽입:')
      expect(result).toContain('".*Log\\([0-9]+).*" → "@1-@2 "')
      expect(result).toContain('(로그 앞)')
    })

    it('appendPos non-zero → "위치: N"', () => {
      const result = describeAccessLog({
        directory: '/d',
        pathPattern: 'pat',
        appendFormat: 'fmt',
        appendPos: 5
      })
      expect(result).toContain('(위치: 5)')
    })

    it('no pathPattern → no extract line', () => {
      const result = describeAccessLog({ directory: '/d', log_type: 'normal_single' })
      expect(result).not.toContain('추출-삽입')
    })

    it('blank line before extract-append section', () => {
      const result = describeAccessLog({
        directory: '/d',
        pathPattern: 'pat',
        appendFormat: 'fmt',
        appendPos: 0
      })
      const lines = result.split('\n')
      const eaIndex = lines.findIndex(l => l.startsWith('추출-삽입:'))
      expect(eaIndex).toBeGreaterThan(0)
      expect(lines[eaIndex - 1]).toBe('')
    })
  })

  // --- Log time filter description ---
  describe('log time filter', () => {
    it('log_time_pattern + log_time_format → "시간 필터" line', () => {
      const result = describeAccessLog({
        directory: '/d',
        log_time_pattern: '[0-9]{2}:[0-9]{2}:[0-9]{2}',
        log_time_format: 'HH:mm:ss'
      })
      expect(result).toContain('시간 필터:')
      expect(result).toContain('[0-9]{2}:[0-9]{2}:[0-9]{2}')
      expect(result).toContain('HH:mm:ss')
    })

    it('log_time_pattern only → shows pattern without format', () => {
      const result = describeAccessLog({
        directory: '/d',
        log_time_pattern: '\\d{2}:\\d{2}:\\d{2}'
      })
      expect(result).toContain('시간 필터:')
      expect(result).toContain('\\d{2}:\\d{2}:\\d{2}')
    })

    it('no log_time fields → no 시간 필터 line', () => {
      const result = describeAccessLog({ directory: '/d' })
      expect(result).not.toContain('시간 필터')
    })
  })

  // --- Line group description ---
  describe('line group', () => {
    it('line_group_count → "라인 그룹" line', () => {
      const result = describeAccessLog({
        directory: '/d',
        line_group_count: 3
      })
      expect(result).toContain('라인 그룹:')
      expect(result).toContain('3줄')
      expect(result).toContain('<<EOL>>')
    })

    it('line_group_count + line_group_pattern → shows pattern', () => {
      const result = describeAccessLog({
        directory: '/d',
        line_group_count: 5,
        line_group_pattern: '.*ERROR.*'
      })
      expect(result).toContain('라인 그룹:')
      expect(result).toContain('5줄')
      expect(result).toContain('대상: ".*ERROR.*"')
    })

    it('no line_group fields → no 라인 그룹 line', () => {
      const result = describeAccessLog({ directory: '/d' })
      expect(result).not.toContain('라인 그룹')
    })
  })

  // --- Purpose display ---
  describe('purpose display', () => {
    it('trigger source name shows [Log Trigger 용]', () => {
      const result = describeAccessLog({ name: '__LogReadInfo__', directory: '/d' })
      expect(result).toContain('[Log Trigger 용]')
    })

    it('upload source name shows [Log Upload 용]', () => {
      const result = describeAccessLog({ name: 'UploadLog', directory: '/d' })
      expect(result).toContain('[Log Upload 용]')
    })

    it('no name → no purpose tag', () => {
      const result = describeAccessLog({ directory: '/d' })
      expect(result).not.toContain('[Log')
    })
  })

  // --- Reading settings line ---
  describe('reading settings', () => {
    it('charset + interval + reopen → pipe-separated', () => {
      const result = describeAccessLog({
        directory: '/d',
        charset: 'UTF-8',
        access_interval: '15 seconds',
        reopen: true,
      })
      expect(result).toContain('읽기: UTF-8 | 15초 간격 | 파일 재열기')
    })

    it('charset only', () => {
      const result = describeAccessLog({ directory: '/d', charset: 'EUC-KR' })
      expect(result).toContain('읽기: EUC-KR')
    })

    it('batch_count and batch_timeout shown for upload source', () => {
      const result = describeAccessLog({
        name: 'LogReadInfo',
        directory: '/d',
        batch_count: 1000,
        batch_timeout: '30 seconds',
      })
      expect(result).toContain('배치 1,000줄')
      expect(result).toContain('배치 타임아웃 30초')
    })

    it('batch_count and batch_timeout hidden for trigger source', () => {
      const result = describeAccessLog({
        name: '__LogReadInfo__',
        directory: '/d',
        batch_count: 1000,
        batch_timeout: '30 seconds',
      })
      expect(result).not.toContain('배치')
    })
  })
})
