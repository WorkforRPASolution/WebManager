import { describe, it, expect } from 'vitest'
import { describeAccessLog, describeTrigger } from '../configDescription'

// ---------------------------------------------------------------------------
// describeAccessLog
// ---------------------------------------------------------------------------
describe('describeAccessLog', () => {
  it('full config — all fields populated', () => {
    const source = {
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

    // directory
    expect(result).toContain('/var/log/app 디렉토리')
    // prefix + suffix pattern
    expect(result).toContain('"access"로 시작하고')
    expect(result).toContain('".log"로 끝나는')
    // wildcard
    expect(result).toContain('(와일드카드: "*.log.*")')
    // log type Korean + raw key
    expect(result).toContain('날짜별 단일 라인')
    expect(result).toContain('(date_single)')
    // date_subdir_format
    expect(result).toContain('날짜 하위 디렉토리: yyyyMMdd')
    // charset
    expect(result).toContain('EUC-KR 인코딩')
    // interval parsed to Korean
    expect(result).toContain('10초 간격')
    // batch count with locale comma
    expect(result).toContain('5,000줄')
    // back=true
    expect(result).toContain('마지막 위치부터 이어')
    // end=true
    expect(result).toContain('끝부터 읽기')
    // reopen=true
    expect(result).toContain('다시 엽니다')
    // exclude suffix
    expect(result).toContain('.bak, .tmp 파일은 제외')
  })

  it('minimal config — only directory', () => {
    const source = { directory: '/logs' }
    const result = describeAccessLog(source)

    // should produce valid multi-line description
    expect(result).toContain('/logs 디렉토리')
    expect(result).toContain('모든 파일을')
    // charset defaults to UTF-8
    expect(result).toContain('UTF-8 인코딩')
    // batch_count defaults to 0
    expect(result).toContain('0줄')
    // unknown log type
    expect(result).toContain('알 수 없는 방식')
  })

  // --- File pattern combinations ---
  describe('file pattern combinations', () => {
    it('prefix only → "로 시작하는"', () => {
      const result = describeAccessLog({ directory: '/d', prefix: 'app' })
      expect(result).toContain('"app"로 시작하고')
      expect(result).not.toContain('로 끝나는')
    })

    it('suffix only → "로 끝나는"', () => {
      const result = describeAccessLog({ directory: '/d', suffix: '.txt' })
      expect(result).toContain('".txt"로 끝나는')
      expect(result).not.toContain('로 시작하고')
    })

    it('neither prefix nor suffix → "모든 파일"', () => {
      const result = describeAccessLog({ directory: '/d' })
      expect(result).toContain('모든 파일을')
    })

    it('wildcard present → "(와일드카드: ...)"', () => {
      const result = describeAccessLog({ directory: '/d', wildcard: '*.csv' })
      expect(result).toContain('(와일드카드: "*.csv")')
    })

    it('no wildcard → no wildcard note', () => {
      const result = describeAccessLog({ directory: '/d', prefix: 'x' })
      expect(result).not.toContain('와일드카드')
    })
  })

  // --- Log types ---
  describe('log types', () => {
    const cases = [
      ['normal_single', '일반 단일 라인'],
      ['date_single', '날짜별 단일 라인'],
      ['date_prefix_single', '날짜접두사 단일 라인'],
      ['normal_single_extract_append', '일반 단일 라인 + 추출-삽입'],
      ['date_single_extract_append', '날짜별 단일 라인 + 추출-삽입'],
      ['date_prefix_single_extract_append', '날짜접두사 단일 라인 + 추출-삽입'],
      ['normal_multiline', '일반 다중 라인'],
      ['date_multiline', '날짜별 다중 라인'],
      ['normal_multiline_extract_append', '일반 다중 라인 + 추출-삽입'],
      ['date_multiline_extract_append', '날짜별 다중 라인 + 추출-삽입'],
    ]

    it.each(cases)('%s → %s', (type, label) => {
      const result = describeAccessLog({ directory: '/d', log_type: type })
      expect(result).toContain(label)
      expect(result).toContain(`(${type})`)
    })

    it('unknown log type falls back to raw value', () => {
      const result = describeAccessLog({ directory: '/d', log_type: 'custom_type' })
      expect(result).toContain('custom_type')
      expect(result).toContain('(custom_type) 방식')
    })

    it('missing log type → "알 수 없는 방식"', () => {
      const result = describeAccessLog({ directory: '/d' })
      expect(result).toContain('알 수 없는 방식')
    })
  })

  // --- date_subdir_format ---
  describe('date_subdir_format', () => {
    it('when present, appears in description', () => {
      const result = describeAccessLog({
        directory: '/d',
        log_type: 'date_single',
        date_subdir_format: 'yyyy/MM/dd',
      })
      expect(result).toContain('날짜 하위 디렉토리: yyyy/MM/dd')
    })

    it('when absent, no subdir text', () => {
      const result = describeAccessLog({ directory: '/d', log_type: 'normal_single' })
      expect(result).not.toContain('날짜 하위 디렉토리')
    })
  })

  // --- Behavior options ---
  describe('behavior options', () => {
    it('back=true → "마지막 위치부터 이어"', () => {
      const result = describeAccessLog({ directory: '/d', back: true })
      expect(result).toContain('마지막 위치부터 이어 읽습니다')
    })

    it('back=false → "처음부터 다시"', () => {
      const result = describeAccessLog({ directory: '/d', back: false })
      expect(result).toContain('처음부터 다시 읽습니다')
    })

    it('end=true → "끝부터 읽기"', () => {
      const result = describeAccessLog({ directory: '/d', end: true })
      expect(result).toContain('끝부터 읽기 시작합니다')
    })

    it('reopen=true → "다시 엽니다"', () => {
      const result = describeAccessLog({ directory: '/d', reopen: true })
      expect(result).toContain('매 주기마다 파일을 다시 엽니다')
    })

    it('no behavior flags → no behavior line', () => {
      const result = describeAccessLog({ directory: '/d' })
      expect(result).not.toContain('재시작')
      expect(result).not.toContain('다시 엽니다')
      expect(result).not.toContain('끝부터')
    })
  })

  // --- Exclude suffix ---
  describe('exclude suffix', () => {
    it('[".bak", ".tmp"] appears in description', () => {
      const result = describeAccessLog({
        directory: '/d',
        back: true,
        exclude_suffix: ['.bak', '.tmp'],
      })
      expect(result).toContain('.bak, .tmp 파일은 제외')
    })

    it('exclude suffix without behavior flags — standalone line', () => {
      const result = describeAccessLog({
        directory: '/d',
        exclude_suffix: ['.old'],
      })
      expect(result).toContain('.old 파일은 제외')
    })

    it('empty exclude_suffix array → no exclude text', () => {
      const result = describeAccessLog({
        directory: '/d',
        back: true,
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

    it('missing interval → "?"', () => {
      const result = describeAccessLog({ directory: '/d' })
      expect(result).toContain('? 간격')
    })
  })

  // --- Multiline description ---
  describe('multiline settings', () => {
    it('startPattern + endPattern + count + priority', () => {
      const result = describeAccessLog({
        directory: '/d',
        log_type: 'normal_multiline',
        startPattern: '.*START.*',
        endPattern: '.*END.*',
        count: 10,
        priority: 'pattern'
      })
      expect(result).toContain('멀티라인 설정')
      expect(result).toContain('".*START.*"')
      expect(result).toContain('".*END.*"')
      expect(result).toContain('10줄')
      expect(result).toContain('패턴')
    })

    it('no multiline fields → no multiline line', () => {
      const result = describeAccessLog({ directory: '/d', log_type: 'normal_single' })
      expect(result).not.toContain('멀티라인')
    })
  })

  // --- Extract-append description ---
  describe('extract-append settings', () => {
    it('extractPattern + appendFormat + appendPos', () => {
      const result = describeAccessLog({
        directory: '/d',
        log_type: 'normal_single_extract_append',
        extractPattern: '.*Log\\([0-9]+).*',
        appendFormat: '@1-@2 ',
        appendPos: 0
      })
      expect(result).toContain('추출-삽입 설정')
      expect(result).toContain('".*Log\\([0-9]+).*"')
      expect(result).toContain('"@1-@2 "')
      expect(result).toContain('로그 앞')
    })

    it('no extractPattern → no extract line', () => {
      const result = describeAccessLog({ directory: '/d', log_type: 'normal_single' })
      expect(result).not.toContain('추출-삽입')
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

  // --- New next actions ---
  describe('new next actions', () => {
    it('@recovery → "복구 실행"', () => {
      const trigger = {
        source: 'src',
        recipe: [{ type: 'regex', trigger: ['x'], next: '@recovery' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('복구 실행')
    })

    it('@notify → "알림 전송"', () => {
      const trigger = {
        source: 'src',
        recipe: [{ type: 'regex', trigger: ['x'], next: '@notify' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('알림 전송')
    })

    it('@popup → "팝업 표시"', () => {
      const trigger = {
        source: 'src',
        recipe: [{ type: 'regex', trigger: ['x'], next: '@popup' }],
      }
      const result = describeTrigger(trigger)
      expect(result).toContain('팝업 표시')
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
      expect(result).toContain('팝업 표시')
      expect(result).toContain('no-email: success;fail')
    })
  })
})
