import { describe, it, expect } from 'vitest'
import { describeAccessLog, describeTrigger } from '../configDescription'

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

// ---------------------------------------------------------------------------
// describeTrigger
// ---------------------------------------------------------------------------
describe('describeTrigger', () => {
  it('full trigger with 2-step recipe + limitation', () => {
    const trigger = {
      source: 'AppLog',
      recipe: [
        {
          type: 'regex',
          trigger: [{ syntax: 'ERROR.*' }],
          times: 1,
          next: 'Step_2',
        },
        {
          type: 'regex',
          trigger: [{ syntax: 'CRITICAL' }],
          duration: '30 seconds',
          times: 2,
          next: '@script',
          script: {
            name: 'alert.sh',
            arg: '--level critical',
            timeout: '10 seconds',
          },
        },
      ],
      limitation: {
        times: 1,
        duration: '1 minutes',
      },
    }

    const result = describeTrigger(trigger)

    // source name
    expect(result).toContain('"AppLog" 로그 소스')
    // step 1
    expect(result).toContain('Step 1:')
    expect(result).toContain('정규식')
    expect(result).toContain('"ERROR.*"')
    expect(result).toContain('1회 매칭되면')
    expect(result).toContain('Step_2로 이동')
    // step 2
    expect(result).toContain('Step 2:')
    expect(result).toContain('"CRITICAL"')
    expect(result).toContain('30초 내 2회 매칭되면')
    expect(result).toContain('alert.sh 실행')
    // script details
    expect(result).toContain('인자: --level critical')
    expect(result).toContain('타임아웃: 10초')
    // limitation
    expect(result).toContain('제한: 1분 내 최대 1회만 발동')
  })

  it('single step trigger — delay type resets chain', () => {
    const trigger = {
      source: 'SysLog',
      recipe: [
        {
          type: 'delay',
          trigger: ['WARN'],
          times: 3,
          next: '',
        },
      ],
    }

    const result = describeTrigger(trigger)

    expect(result).toContain('"SysLog"')
    expect(result).toContain('지연(취소)')
    expect(result).toContain('"WARN"')
    expect(result).toContain('3회 매칭되면')
    expect(result).toContain('체인 리셋')
  })

  // --- Step types ---
  describe('step types', () => {
    const types = [
      ['regex', '정규식'],
      ['delay', '지연(취소)'],
    ]

    it.each(types)('%s → %s', (type, label) => {
      const trigger = {
        source: 'src',
        recipe: [{ type, trigger: ['x'], next: '' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain(label)
    })

    it('unknown type falls back to raw value', () => {
      const trigger = {
        source: 'src',
        recipe: [{ type: 'fuzzy', trigger: ['x'], next: '' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('fuzzy')
    })
  })

  // --- Pattern display ---
  describe('pattern display', () => {
    it('single pattern → quoted', () => {
      const trigger = {
        source: 'src',
        recipe: [{ type: 'regex', trigger: ['abc'], next: '' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('"abc"')
    })

    it('3 patterns → all listed', () => {
      const trigger = {
        source: 'src',
        recipe: [{ type: 'regex', trigger: ['a', 'b', 'c'], next: '' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('"a"')
      expect(result).toContain('"b"')
      expect(result).toContain('"c"')
    })

    it('4+ patterns → first 2 + "외 N개"', () => {
      const trigger = {
        source: 'src',
        recipe: [
          { type: 'regex', trigger: ['p1', 'p2', 'p3', 'p4', 'p5'], next: '' },
        ],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('"p1"')
      expect(result).toContain('"p2"')
      expect(result).toContain('외 3개')
      expect(result).not.toContain('"p3"')
    })
  })

  // --- Next action variations ---
  describe('next action variations', () => {
    it('next = step name → "로 이동"', () => {
      const trigger = {
        source: 'src',
        recipe: [{ type: 'regex', trigger: ['x'], next: 'Step_2' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('Step_2로 이동')
    })

    it('next = @script → "실행" with script name', () => {
      const trigger = {
        source: 'src',
        recipe: [
          {
            type: 'regex',
            trigger: ['x'],
            next: '@script',
            script: { name: 'run.sh' },
          },
        ],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('run.sh 실행')
    })

    it('next = "" → "체인 종료"', () => {
      const trigger = {
        source: 'src',
        recipe: [{ type: 'regex', trigger: ['x'], next: '' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('체인 종료')
    })
  })

  // --- Trigger items format ---
  describe('trigger items format', () => {
    it('{ syntax: "..." } objects work', () => {
      const trigger = {
        source: 'src',
        recipe: [
          { type: 'regex', trigger: [{ syntax: 'OBJ_PATTERN' }], next: '' },
        ],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('"OBJ_PATTERN"')
    })

    it('plain strings work', () => {
      const trigger = {
        source: 'src',
        recipe: [
          { type: 'regex', trigger: ['STR_PATTERN'], next: '' },
        ],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('"STR_PATTERN"')
    })

    it('mixed objects and strings work', () => {
      const trigger = {
        source: 'src',
        recipe: [
          {
            type: 'regex',
            trigger: [{ syntax: 'obj1' }, 'str2', { syntax: 'obj3' }],
            next: '',
          },
        ],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('"obj1"')
      expect(result).toContain('"str2"')
      expect(result).toContain('"obj3"')
    })
  })

  // --- Script details ---
  describe('script details', () => {
    it('arg and timeout appear when present', () => {
      const trigger = {
        source: 'src',
        recipe: [
          {
            type: 'regex',
            trigger: ['x'],
            next: '@script',
            script: { name: 's.sh', arg: '-v', timeout: '30 seconds' },
          },
        ],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('인자: -v')
      expect(result).toContain('타임아웃: 30초')
    })

    it('script with only name — no detail line', () => {
      const trigger = {
        source: 'src',
        recipe: [
          {
            type: 'regex',
            trigger: ['x'],
            next: '@script',
            script: { name: 'simple.sh' },
          },
        ],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('simple.sh 실행')
      expect(result).not.toContain('인자:')
      expect(result).not.toContain('타임아웃:')
    })

    it('script with only arg — no timeout', () => {
      const trigger = {
        source: 'src',
        recipe: [
          {
            type: 'regex',
            trigger: ['x'],
            next: '@script',
            script: { name: 's.sh', arg: '--dry-run' },
          },
        ],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('인자: --dry-run')
      expect(result).not.toContain('타임아웃')
    })
  })

  // --- Limitation ---
  describe('limitation', () => {
    it('times + duration in Korean', () => {
      const trigger = {
        source: 'src',
        recipe: [],
        limitation: { times: 5, duration: '10 minutes' },
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('제한: 10분 내 최대 5회만 발동')
    })

    it('times only (no duration)', () => {
      const trigger = {
        source: 'src',
        recipe: [],
        limitation: { times: 3 },
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('제한: 최대 3회만 발동')
    })

    it('no limitation → no limitation line', () => {
      const trigger = {
        source: 'src',
        recipe: [{ type: 'regex', trigger: ['x'], next: '' }],
      }
      const result = describeTrigger(trigger)
      expect(result).not.toContain('제한')
    })
  })

  // --- Empty recipe ---
  it('empty recipe array → source line only (+ possible limitation)', () => {
    const trigger = {
      source: 'EmptyRecipe',
      recipe: [],
    }
    const result = describeTrigger(trigger)
    expect(result).toContain('"EmptyRecipe" 로그 소스를 감시합니다.')
    // No step lines
    expect(result).not.toContain('Step')
  })

  // --- Edge case: trigger with no source ---
  it('trigger with no source → empty string in source line', () => {
    const trigger = {
      recipe: [{ type: 'regex', trigger: ['x'], next: '' }],
    }
    const result = describeTrigger(trigger)
    // source is undefined → split produces empty → single source path with ""
    expect(result).toContain('"" 로그 소스')
  })

  // --- Multi-source ---
  describe('multi-source', () => {
    it('comma-separated sources → N개 소스 감시', () => {
      const trigger = {
        source: '__LogA__,__LogB__,__LogC__',
        recipe: [{ type: 'regex', trigger: ['x'], next: '' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('3개 로그 소스')
      expect(result).toContain('__LogA__')
      expect(result).toContain('__LogB__')
      expect(result).toContain('__LogC__')
    })

    it('single source → normal display', () => {
      const trigger = {
        source: '__Log__',
        recipe: [{ type: 'regex', trigger: ['x'], next: '' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('"__Log__" 로그 소스를 감시합니다.')
    })
  })

  // ===========================================================================
  // describeTrigger — MULTI class
  // ===========================================================================

  describe('describeTrigger — MULTI class', () => {
    it('includes 다중 인스턴스 description for class=MULTI', () => {
      const trigger = {
        source: '__TestLog__',
        class: 'MULTI',
        recipe: [
          { name: 'step_01', type: 'regex', trigger: ['.* error occur. code: (<<code>>[_A-Za-z0-9]+)'], times: 1, next: 'step_02' },
          { name: 'step_02', type: 'delay', trigger: ['.* error reset. code: @<<code>>@.*'], duration: '10 minutes', times: 1, next: '@notify' }
        ]
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('다중 인스턴스')
      expect(result).toContain('MULTI')
    })

    it('does not include MULTI description when class is absent', () => {
      const trigger = {
        source: '__TestLog__',
        recipe: [
          { name: 'step_01', type: 'regex', trigger: ['.*ERROR.*'], times: 1, next: '@notify' }
        ]
      }
      const result = describeTrigger(trigger)
      expect(result).not.toContain('다중 인스턴스')
      expect(result).not.toContain('MULTI')
    })

    it('does not include MULTI description when class is none', () => {
      const trigger = {
        source: '__TestLog__',
        class: 'none',
        recipe: [
          { name: 'step_01', type: 'regex', trigger: ['.*ERROR.*'], times: 1, next: '@notify' }
        ]
      }
      const result = describeTrigger(trigger)
      expect(result).not.toContain('다중 인스턴스')
    })
  })

  // --- New next actions ---
  describe('new next actions', () => {
    it('@recovery → "시나리오 실행"', () => {
      const trigger = {
        source: 'src',
        recipe: [{ type: 'regex', trigger: ['x'], next: '@recovery' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('시나리오 실행')
    })

    it('@notify → "메일 발송"', () => {
      const trigger = {
        source: 'src',
        recipe: [{ type: 'regex', trigger: ['x'], next: '@notify' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('메일 발송')
    })

    it('@popup → "PopUp 실행"', () => {
      const trigger = {
        source: 'src',
        recipe: [{ type: 'regex', trigger: ['x'], next: '@popup' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('PopUp 실행')
    })

    it('@popup with detail.no-email → shows no-email value', () => {
      const trigger = {
        source: 'src',
        recipe: [{
          type: 'regex',
          trigger: ['x'],
          next: '@popup',
          detail: { 'no-email': 'success;fail' }
        }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('PopUp 실행')
      expect(result).toContain('no-email: success;fail')
    })
  })
})
