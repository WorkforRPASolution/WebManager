import { describe, it, expect } from 'vitest'
import { describeTrigger } from '../description'

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
