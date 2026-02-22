import { describe, it, expect } from 'vitest'
import {
  testTriggerPattern,
  testTriggerWithFiles,
  convertSyntaxToRegex,
  parseParams,
  evaluateParams,
  substituteMultiCaptures
} from '../testEngine'

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

  it('syntax uses Java String.matches() full-match — partial pattern should NOT match', () => {
    // Java: "ERROR occurred".matches(".*ERROR") === false (doesn't end with "ERROR")
    const trigger = {
      recipe: [{ type: 'regex', trigger: [{ syntax: '.*ERROR' }], times: 1, next: '' }]
    }
    const logText = 'ERROR occurred'
    const result = testTriggerPattern(trigger, logText, null)
    expect(result.steps[0].fired).toBe(false)
    expect(result.steps[0].matchCount).toBe(0)
  })

  it('syntax full-match — ".*ERROR.*" matches "ERROR occurred"', () => {
    const trigger = {
      recipe: [{ type: 'regex', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' }]
    }
    const logText = 'ERROR occurred'
    const result = testTriggerPattern(trigger, logText, null)
    expect(result.steps[0].fired).toBe(true)
    expect(result.steps[0].matchCount).toBe(1)
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
        { name: 'Step_2', type: 'regex', trigger: [{ syntax: '.*Start2 Log.*' }], duration: '10 seconds', times: 1, next: '@notify' }
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
        { name: 'Step_2', type: 'regex', trigger: [{ syntax: '.*Start2 Log.*' }], duration: '30 seconds', times: 1, next: '@notify' }
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
// substituteMultiCaptures
// ===========================================================================

describe('substituteMultiCaptures', () => {
  it('replaces @<<name>>@ with captured value', () => {
    const result = substituteMultiCaptures('.* error reset. code: @<<code>>@.*', { code: '1234' })
    expect(result).toBe('.* error reset. code: 1234.*')
  })

  it('escapes special regex characters in captured values', () => {
    const result = substituteMultiCaptures('.* version: @<<ver>>@.*', { ver: '1.2+3' })
    expect(result).toBe('.* version: 1\\.2\\+3.*')
  })

  it('leaves undefined variables unchanged', () => {
    const result = substituteMultiCaptures('.* code: @<<code>>@ type: @<<type>>@', { code: '1234' })
    expect(result).toBe('.* code: 1234 type: @<<type>>@')
  })

  it('returns pattern unchanged when no @<<>>@ references', () => {
    const result = substituteMultiCaptures('.* error occur.*', { code: '1234' })
    expect(result).toBe('.* error occur.*')
  })

  it('handles multiple replacements', () => {
    const result = substituteMultiCaptures('@<<a>>@ and @<<b>>@ end', { a: 'X', b: 'Y' })
    expect(result).toBe('X and Y end')
  })

  it('returns empty string for null/undefined input', () => {
    expect(substituteMultiCaptures(null, {})).toBe('')
    expect(substituteMultiCaptures(undefined, {})).toBe('')
  })
})


// ===========================================================================
// executeMultiChain
// ===========================================================================

describe('executeMultiChain', () => {
  const tsFormat = 'HH:mm:ss'

  // Helper to build a MULTI trigger config
  function makeMultiTrigger(steps) {
    return {
      recipe: steps,
      class: 'MULTI'
    }
  }

  it('creates instance on step_01 match with capture', () => {
    const trigger = makeMultiTrigger([
      { name: 'step_01', type: 'regex', trigger: ['.* error occur. code: (<<code>>[_A-Za-z0-9]+)'], times: 1, next: 'step_02' },
      { name: 'step_02', type: 'delay', trigger: ['.* error reset. code: @<<code>>@.*'], duration: '10 minutes', times: 1, next: '@notify' }
    ])
    const logText = '14:10:00 error occur. code: 1234'
    const result = testTriggerPattern(trigger, logText, tsFormat)
    expect(result.isMulti).toBe(true)
    expect(result.multiInstances.length).toBe(1)
    expect(result.multiInstances[0].capturedGroups.code).toBe('1234')
    expect(result.multiInstances[0].status).toBe('active') // only step_01 matched, waiting on step_02
  })

  it('tracks independent instances for different captured values', () => {
    const trigger = makeMultiTrigger([
      { name: 'step_01', type: 'regex', trigger: ['.* error occur. code: (<<code>>[_A-Za-z0-9]+)'], times: 1, next: 'step_02' },
      { name: 'step_02', type: 'delay', trigger: ['.* error reset. code: @<<code>>@.*'], duration: '10 minutes', times: 1, next: '@notify' }
    ])
    const logText = [
      '14:10:00 error occur. code: 1234',
      '14:11:00 error occur. code: 4567'
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, tsFormat)
    expect(result.isMulti).toBe(true)
    expect(result.multiInstances.length).toBe(2)
    expect(result.multiInstances[0].capturedKey).toBe('1234')
    expect(result.multiInstances[1].capturedKey).toBe('4567')
  })

  it('cancels instance when delay pattern matches within duration', () => {
    const trigger = makeMultiTrigger([
      { name: 'step_01', type: 'regex', trigger: ['.* error occur. code: (<<code>>[_A-Za-z0-9]+)'], times: 1, next: 'step_02' },
      { name: 'step_02', type: 'delay', trigger: ['.* error reset. code: @<<code>>@.*'], duration: '10 minutes', times: 1, next: '@notify' }
    ])
    const logText = [
      '14:10:00 error occur. code: 4567',
      '14:13:00 error reset. code: 4567'
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, tsFormat)
    expect(result.isMulti).toBe(true)
    const inst = result.multiInstances.find(i => i.capturedKey === '4567')
    expect(inst.status).toBe('cancelled')
  })

  it('fires instance when delay times out (EOF)', () => {
    const trigger = makeMultiTrigger([
      { name: 'step_01', type: 'regex', trigger: ['.* error occur. code: (<<code>>[_A-Za-z0-9]+)'], times: 1, next: 'step_02' },
      { name: 'step_02', type: 'delay', trigger: ['.* error reset. code: @<<code>>@.*'], duration: '10 minutes', times: 1, next: '@notify' }
    ])
    const logText = [
      '14:10:00 error occur. code: 1234',
      '14:21:00 some unrelated log'
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, tsFormat)
    expect(result.isMulti).toBe(true)
    const inst = result.multiInstances.find(i => i.capturedKey === '1234')
    expect(inst.status).toBe('fired')
  })

  it('unrelated code reset does not affect other instances', () => {
    const trigger = makeMultiTrigger([
      { name: 'step_01', type: 'regex', trigger: ['.* error occur. code: (<<code>>[_A-Za-z0-9]+)'], times: 1, next: 'step_02' },
      { name: 'step_02', type: 'delay', trigger: ['.* error reset. code: @<<code>>@.*'], duration: '10 minutes', times: 1, next: '@notify' }
    ])
    const logText = [
      '14:10:00 error occur. code: 1234',
      '14:11:00 error occur. code: 4567',
      '14:12:00 error reset. code: 7890',
      '14:21:00 some unrelated log'
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, tsFormat)
    // 7890 was never created, so it's ignored
    // 1234 and 4567 should both timeout (fired) since 7890 doesn't match either
    const inst1234 = result.multiInstances.find(i => i.capturedKey === '1234')
    const inst4567 = result.multiInstances.find(i => i.capturedKey === '4567')
    expect(inst1234.status).toBe('fired')
    expect(inst4567.status).toBe('fired')
  })

  it('full docs scenario: 1234 fired, 4567 cancelled', () => {
    const trigger = makeMultiTrigger([
      { name: 'step_01', type: 'regex', trigger: ['.* error occur. code: (<<code>>[_A-Za-z0-9]+)'], times: 1, next: 'step_02' },
      { name: 'step_02', type: 'delay', trigger: ['.* error reset. code: @<<code>>@.*'], duration: '10 minutes', times: 1, next: '@notify' }
    ])
    const logText = [
      '14:10:00 error occur. code: 1234',
      '14:11:00 error occur. code: 4567',
      '14:12:00 error reset. code: 7890',
      '14:13:00 error reset. code: 4567',
      '14:21:00 some unrelated log'
    ].join('\n')
    const result = testTriggerPattern(trigger, logText, tsFormat)
    expect(result.isMulti).toBe(true)

    const inst1234 = result.multiInstances.find(i => i.capturedKey === '1234')
    const inst4567 = result.multiInstances.find(i => i.capturedKey === '4567')

    expect(inst1234.status).toBe('fired')
    expect(inst4567.status).toBe('cancelled')

    expect(result.multiSummary.totalCreated).toBe(2)
    expect(result.multiSummary.fired).toBe(1)
    expect(result.multiSummary.cancelled).toBe(1)
    expect(result.finalResult.triggered).toBe(true)
  })

  it('class absent or none uses existing behavior (not MULTI)', () => {
    const triggerNoClass = {
      recipe: [
        { name: 'step_01', type: 'regex', trigger: ['.*ERROR.*'], times: 1, next: '@notify' }
      ]
    }
    const logText = '14:10:00 ERROR something happened'
    const result = testTriggerPattern(triggerNoClass, logText, tsFormat)
    expect(result.isMulti).toBeUndefined()
    expect(result.multiInstances).toBeUndefined()
    expect(result.finalResult.triggered).toBe(true)
  })

  it('max instances capped at 20', () => {
    const trigger = makeMultiTrigger([
      { name: 'step_01', type: 'regex', trigger: ['.* code: (<<code>>[_A-Za-z0-9]+)'], times: 1, next: 'step_02' },
      { name: 'step_02', type: 'delay', trigger: ['.* reset: @<<code>>@.*'], duration: '10 minutes', times: 1, next: '@notify' }
    ])
    const lines = []
    for (let i = 0; i < 25; i++) {
      lines.push(`14:10:${String(i).padStart(2,'0')} code: ID_${i}`)
    }
    const result = testTriggerPattern(trigger, lines.join('\n'), tsFormat)
    expect(result.isMulti).toBe(true)
    expect(result.multiInstances.length).toBeLessThanOrEqual(20)
  })
})
