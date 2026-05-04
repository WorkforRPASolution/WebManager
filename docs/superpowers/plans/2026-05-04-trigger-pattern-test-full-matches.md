# Trigger Pattern Test — Full Matches Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trigger 패턴 매칭 테스트 결과 패널이 매칭된 라인을 1건만 보여주는 UX 문제를 해결한다 — 발동 결과는 그대로 두고 별도 "전체 매칭 분석" 영역에서 모든 매칭을 안전하게 표시.

**Architecture:** 기존 `executeOneChain()` 발동 로직은 변경하지 않는다. 새 함수 `analyzeAllMatches()`로 firing 로직과 분리해 입력 라인 전체를 별도 스캔하고, 그 결과를 `testTriggerPattern`/`testTriggerWithFiles`의 반환 객체에 `fullAnalysis` 필드로 추가한다. UI는 step 카드 헤더에 카운트 배지 + step 카드 하단에 접힘 패널을 추가하며, 페이지네이션과 max-height로 큰 매칭 수에서도 화면이 깨지지 않게 한다.

**Tech Stack:** Vue 3 (Composition API), vitest, Tailwind CSS

**Spec:** [docs/superpowers/specs/2026-05-04-trigger-pattern-test-full-matches-design.md](../specs/2026-05-04-trigger-pattern-test-full-matches-design.md)

---

## File Structure

| 파일 | 역할 | 변경 유형 |
|------|------|----------|
| `client/src/features/clients/components/config-form/trigger/testEngine.js` | 신규 `analyzeAllMatches()` 함수 + `testTriggerPattern`/`testTriggerWithFiles` 반환 객체에 `fullAnalysis` 추가 | 수정 |
| `client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js` | 신규 테스트 케이스 (`describe('analyzeAllMatches')`) | 수정 |
| `client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue` | step 카드 헤더 배지 + "전체 매칭 분석" 패널 + 더 보기 상태 | 수정 |

UI 단위 테스트는 프로젝트에 Vue 컴포넌트 테스트 프레임워크가 셋업되어 있지 않으므로, UI 검증은 마지막 manual smoke test로 처리.

테스트 실행: `cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js --reporter=verbose`

---

## Task 1: analyzeAllMatches — 단일 step, 전체 매칭 카운트와 라인 수집

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/testEngine.js` (신규 export 추가)
- Test: `client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/testEngine.test.js` 파일 끝(`testTriggerWithFiles` describe 블록 다음)에 추가:

```js
// ===========================================================================
// analyzeAllMatches
// ===========================================================================

describe('analyzeAllMatches', () => {
  it('1. Single regex step — counts and collects all matching lines', () => {
    const recipe = [
      { type: 'regex', name: 'step_01', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' }
    ]
    const lines = [
      'INFO ok',
      'ERROR fail one',
      'INFO ok',
      'ERROR fail two',
      'ERROR fail three',
      'INFO ok'
    ]

    const result = analyzeAllMatches(recipe, lines)

    expect(result.stepAnalyses).toHaveLength(1)
    const a = result.stepAnalyses[0]
    expect(a.stepName).toBe('step_01')
    expect(a.stepType).toBe('regex')
    expect(a.totalMatches).toBe(3)
    expect(a.matchedLines).toHaveLength(3)
    expect(a.matchedLines[0]).toMatchObject({ lineNum: 2, line: 'ERROR fail one' })
    expect(a.matchedLines[1]).toMatchObject({ lineNum: 4, line: 'ERROR fail two' })
    expect(a.matchedLines[2]).toMatchObject({ lineNum: 5, line: 'ERROR fail three' })
    expect(a.truncated).toBe(false)
  })
})
```

상단 import에 `analyzeAllMatches` 추가:

```js
import {
  testTriggerPattern,
  testTriggerWithFiles,
  convertSyntaxToRegex,
  parseParams,
  evaluateParams,
  substituteMultiCaptures,
  analyzeAllMatches  // ← 추가
} from '../testEngine'
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL with `analyzeAllMatches is not defined` 또는 `not a function`

- [ ] **Step 3: 최소 구현 작성**

`testEngine.js` 끝(testTriggerWithFiles export 다음)에 추가:

```js
// ---------------------------------------------------------------------------
// 6. analyzeAllMatches — pattern-only scan, separate from firing semantics
// ---------------------------------------------------------------------------

const MAX_COLLECTED_LINES = 1000

/**
 * Scan all input lines and collect every line that matches each non-delay
 * step's trigger patterns. Independent of firing semantics — used to populate
 * the "전체 매칭 분석" panel in the UI.
 *
 * @param {Array} recipe - recipe steps
 * @param {Array<string>} lines - all log lines
 * @returns {{ stepAnalyses: Array }}
 */
export function analyzeAllMatches(recipe, lines) {
  const stepAnalyses = []
  const recipeArr = Array.isArray(recipe) ? recipe : []
  const linesArr = Array.isArray(lines) ? lines : []

  for (let si = 0; si < recipeArr.length; si++) {
    const step = recipeArr[si]
    const stepName = step.name || `Step_${si + 1}`
    const stepType = step.type || 'keyword'
    const triggerItems = Array.isArray(step.trigger) ? step.trigger : []

    let totalMatches = 0
    const matchedLines = []
    let truncated = false

    for (let li = 0; li < linesArr.length; li++) {
      const line = linesArr[li]
      let matchedPattern = null
      for (const item of triggerItems) {
        const r = matchLineWithParams(line, item, stepType)
        if (r.matched) {
          matchedPattern = getTriggerSyntax(item)
          break
        }
      }
      if (matchedPattern) {
        totalMatches++
        if (matchedLines.length < MAX_COLLECTED_LINES) {
          matchedLines.push({
            lineNum: li + 1,
            line,
            pattern: matchedPattern,
            isFiringLine: false
          })
        } else {
          truncated = true
        }
      }
    }

    stepAnalyses.push({
      stepName,
      stepType,
      totalMatches,
      matchedLines,
      truncated
    })
  }

  return { stepAnalyses }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js --reporter=verbose 2>&1 | tail -10
```

Expected: 신규 테스트 1건 PASS, 기존 테스트 모두 PASS (회귀 없음)

- [ ] **Step 5: 커밋**

```bash
git add client/src/features/clients/components/config-form/trigger/testEngine.js client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js
git commit -m "$(cat <<'EOF'
feat: Trigger analyzeAllMatches — 단일 step 전체 매칭 수집

발동 로직과 분리된 별도 스캔 함수. 입력 전체에서 패턴이
매칭되는 모든 라인을 수집(최대 1000건).
EOF
)"
```

---

## Task 2: 1000건 수집 상한 + truncated 플래그

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`describe('analyzeAllMatches', ...)` 안에 추가:

```js
it('2. Collection cap — 1500 matches → matchedLines.length=1000, truncated=true, totalMatches=1500', () => {
  const recipe = [
    { type: 'regex', name: 'step_01', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' }
  ]
  const lines = []
  for (let i = 0; i < 1500; i++) lines.push(`ERROR line ${i}`)

  const result = analyzeAllMatches(recipe, lines)
  const a = result.stepAnalyses[0]
  expect(a.totalMatches).toBe(1500)
  expect(a.matchedLines).toHaveLength(1000)
  expect(a.truncated).toBe(true)
  expect(a.matchedLines[0].line).toBe('ERROR line 0')
  expect(a.matchedLines[999].line).toBe('ERROR line 999')
})
```

- [ ] **Step 2: 테스트 실행 후 통과 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js -t 'Collection cap' --reporter=verbose 2>&1 | tail -10
```

Expected: PASS (Task 1 구현에 이미 cap 로직 포함됨 — 회귀 검증)

- [ ] **Step 3: 커밋**

```bash
git add client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js
git commit -m "test: Trigger analyzeAllMatches 1000건 수집 상한 회귀 테스트"
```

---

## Task 3: delay 타입 step은 분석 대상에서 제외

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/testEngine.js`
- Modify: `client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
it('3. Skips delay-type steps — only regex steps appear in stepAnalyses', () => {
  const recipe = [
    { type: 'regex', name: 'step_01', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' },
    { type: 'delay', name: 'step_02', trigger: [{ syntax: '.*CANCEL.*' }], duration: '10s', next: '' },
    { type: 'regex', name: 'step_03', trigger: [{ syntax: '.*FATAL.*' }], times: 1, next: '' }
  ]
  const lines = ['ERROR a', 'CANCEL b', 'FATAL c']

  const result = analyzeAllMatches(recipe, lines)

  expect(result.stepAnalyses).toHaveLength(2)
  expect(result.stepAnalyses[0].stepName).toBe('step_01')
  expect(result.stepAnalyses[1].stepName).toBe('step_03')
  expect(result.stepAnalyses.find(s => s.stepName === 'step_02')).toBeUndefined()
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js -t 'Skips delay' --reporter=verbose 2>&1 | tail -10
```

Expected: FAIL with `expected length 3 to be 2`

- [ ] **Step 3: delay step 제외 로직 추가**

`testEngine.js`의 `analyzeAllMatches` 함수에서 step 루프 시작부에 추가:

```js
for (let si = 0; si < recipeArr.length; si++) {
  const step = recipeArr[si]
  const stepType = step.type || 'keyword'

  // Skip delay steps — they have different semantics (cancel-on-match within time window)
  if (stepType === 'delay') continue

  const stepName = step.name || `Step_${si + 1}`
  const triggerItems = Array.isArray(step.trigger) ? step.trigger : []
  // ... rest unchanged
```

`stepType` 변수를 step 루프 상단으로 옮기고 `continue` 추가. 기존 `const stepType = step.type || 'keyword'` 라인은 위로 이동했으므로 중복 선언 제거.

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js --reporter=verbose 2>&1 | tail -10
```

Expected: 신규 테스트 PASS, 기존 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add client/src/features/clients/components/config-form/trigger/testEngine.js client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js
git commit -m "feat: Trigger analyzeAllMatches — delay step 제외"
```

---

## Task 4: 다중 step recipe 지원

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js`

- [ ] **Step 1: 테스트 추가 (기존 구현으로 통과해야 함 — 회귀 검증)**

```js
it('4. Multi-step recipe — each step analyzed independently', () => {
  const recipe = [
    { type: 'regex', name: 'first', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' },
    { type: 'regex', name: 'second', trigger: [{ syntax: '.*WARN.*' }], times: 1, next: '' }
  ]
  const lines = ['ERROR a', 'WARN b', 'ERROR c', 'WARN d', 'ERROR e']

  const result = analyzeAllMatches(recipe, lines)
  expect(result.stepAnalyses).toHaveLength(2)
  expect(result.stepAnalyses[0].totalMatches).toBe(3)  // ERROR x3
  expect(result.stepAnalyses[1].totalMatches).toBe(2)  // WARN x2
})
```

- [ ] **Step 2: 테스트 통과 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js -t 'Multi-step recipe' --reporter=verbose 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js
git commit -m "test: Trigger analyzeAllMatches 다중 step 회귀 테스트"
```

---

## Task 5: step 내부 다중 패턴 (trigger 배열 길이 > 1) 지원

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js`

- [ ] **Step 1: 테스트 추가 (기존 구현으로 통과해야 함)**

```js
it('5. Multi-pattern step — any pattern in trigger array contributes a match', () => {
  const recipe = [
    {
      type: 'regex',
      name: 'step_01',
      trigger: [{ syntax: '.*ERROR.*' }, { syntax: '.*FATAL.*' }],
      times: 1,
      next: ''
    }
  ]
  const lines = ['ERROR x', 'INFO y', 'FATAL z', 'WARN w', 'ERROR a']

  const result = analyzeAllMatches(recipe, lines)
  const a = result.stepAnalyses[0]
  expect(a.totalMatches).toBe(3)
  expect(a.matchedLines.map(m => m.lineNum)).toEqual([1, 3, 5])
})
```

- [ ] **Step 2: 테스트 통과 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js -t 'Multi-pattern step' --reporter=verbose 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js
git commit -m "test: Trigger analyzeAllMatches 다중 패턴 step 회귀 테스트"
```

---

## Task 6: testTriggerPattern 결과에 fullAnalysis 통합 (MULTI 제외)

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/testEngine.js`
- Modify: `client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
it('6. testTriggerPattern result includes fullAnalysis (non-MULTI)', () => {
  const trigger = {
    recipe: [{ type: 'regex', name: 'step_01', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' }]
  }
  const logText = 'ERROR a\nINFO b\nERROR c\nERROR d'
  const result = testTriggerPattern(trigger, logText, null)

  expect(result.fullAnalysis).toBeDefined()
  expect(result.fullAnalysis.stepAnalyses).toHaveLength(1)
  expect(result.fullAnalysis.stepAnalyses[0].totalMatches).toBe(3)
})

it('7. testTriggerPattern with MULTI class — no fullAnalysis', () => {
  const trigger = {
    class: 'MULTI',
    recipe: [{ type: 'regex', name: 'step_01', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' }]
  }
  const logText = 'ERROR a\nERROR b'
  const result = testTriggerPattern(trigger, logText, null)

  expect(result.fullAnalysis).toBeUndefined()
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js -t 'fullAnalysis' --reporter=verbose 2>&1 | tail -10
```

Expected: FAIL — `result.fullAnalysis` is undefined

- [ ] **Step 3: testTriggerPattern에 fullAnalysis 통합**

`testEngine.js`에서 다음 두 위치를 수정:

(1) MULTI 분기 — 변경 없음 (fullAnalysis 추가 안 함). 다음 코드 블록(MULTI return)은 그대로 둠:

```js
return {
  steps: [],
  finalResult: { triggered: hasFired, message },
  firings: [],
  limitation: null,
  isMulti: true,
  multiInstances: multiResult.multiInstances,
  multiSummary: multiResult.multiSummary
}
```

(2) limitation 없음 분기 (현재 `return { steps: chainResult.stepResults, ... }`) 직전에 fullAnalysis 계산. 그리고 return 객체에 추가:

```js
// limitation 없음 분기 안 (return 직전):
const fullAnalysis = analyzeAllMatches(recipe, lines)

return {
  steps: chainResult.stepResults,
  finalResult: { triggered: chainResult.allFired, message },
  firings: chainResult.allFired
    ? [{ steps: chainResult.stepResults, fired: true, suppressed: false, firingTimestamp: chainResult.firingTimestamp }]
    : [],
  limitation: null,
  fullAnalysis  // ← 추가
}
```

(3) limitation 있음 분기 (현재 `return { steps: firings.length > 0 ? firings[0].steps : [], ... }`) 직전에도 동일하게:

```js
const fullAnalysis = analyzeAllMatches(recipe, lines)

return {
  steps: firings.length > 0 ? firings[0].steps : [],
  finalResult: { triggered, message },
  firings: firings.map(f => ({ steps: f.steps, fired: f.fired, suppressed: f.suppressed, firingTimestamp: f.firingTimestamp })),
  limitation: { /* 기존 그대로 */ },
  fullAnalysis  // ← 추가
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js --reporter=verbose 2>&1 | tail -10
```

Expected: 모든 테스트 PASS (회귀 없음)

- [ ] **Step 5: 커밋**

```bash
git add client/src/features/clients/components/config-form/trigger/testEngine.js client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js
git commit -m "$(cat <<'EOF'
feat: Trigger testTriggerPattern 결과에 fullAnalysis 통합

limitation on/off 분기 모두에 analyzeAllMatches 결과를
fullAnalysis 필드로 추가. MULTI 클래스는 제외.
EOF
)"
```

---

## Task 7: isFiringLine 마킹 — limitation 없는 경우

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/testEngine.js`
- Modify: `client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
it('8. isFiringLine — non-limitation: only first match line marked', () => {
  const trigger = {
    recipe: [{ type: 'regex', name: 'step_01', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' }]
  }
  const logText = 'ERROR a\nERROR b\nERROR c'
  const result = testTriggerPattern(trigger, logText, null)

  const matchedLines = result.fullAnalysis.stepAnalyses[0].matchedLines
  expect(matchedLines).toHaveLength(3)
  expect(matchedLines[0].isFiringLine).toBe(true)   // line 1 — fired
  expect(matchedLines[1].isFiringLine).toBe(false)
  expect(matchedLines[2].isFiringLine).toBe(false)
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js -t 'non-limitation: only first match' --reporter=verbose 2>&1 | tail -10
```

Expected: FAIL — `expected false to be true`

- [ ] **Step 3: 마킹 헬퍼 + 통합**

`testEngine.js`의 `analyzeAllMatches` 다음에 헬퍼 추가:

```js
/**
 * Mark matchedLines as isFiringLine=true based on firing positions.
 * @param {Object} fullAnalysis - { stepAnalyses }
 * @param {Array} firings - [{ steps: [{ name, matches: [{ lineNum }] }] }]
 */
function markFiringLines(fullAnalysis, firings) {
  if (!fullAnalysis || !Array.isArray(firings)) return
  for (const firing of firings) {
    if (!firing.steps) continue
    for (const stepResult of firing.steps) {
      if (!stepResult.matches || stepResult.matches.length === 0) continue
      const firingLineNum = stepResult.matches[0].globalLineNum || stepResult.matches[0].lineNum
      const analysis = fullAnalysis.stepAnalyses.find(a => a.stepName === stepResult.name)
      if (!analysis) continue
      const target = analysis.matchedLines.find(m => m.lineNum === firingLineNum)
      if (target) target.isFiringLine = true
    }
  }
}
```

`testTriggerPattern`의 두 분기에서 `fullAnalysis` 계산 직후, return 직전에 호출:

```js
// limitation 없음 분기:
const fullAnalysis = analyzeAllMatches(recipe, lines)
const firingsForMark = chainResult.allFired
  ? [{ steps: chainResult.stepResults }]
  : []
markFiringLines(fullAnalysis, firingsForMark)
```

```js
// limitation 있음 분기:
const fullAnalysis = analyzeAllMatches(recipe, lines)
markFiringLines(fullAnalysis, firings)  // firings는 이 분기에 이미 존재
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js --reporter=verbose 2>&1 | tail -10
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add client/src/features/clients/components/config-form/trigger/testEngine.js client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js
git commit -m "feat: Trigger fullAnalysis isFiringLine 마킹 (limitation 미설정)"
```

---

## Task 8: isFiringLine 마킹 — limitation 있는 경우 (다중 firing)

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js`

- [ ] **Step 1: 테스트 추가 (Task 7 구현으로 통과해야 함)**

```js
it('9. isFiringLine — limitation: each firing first match marked', () => {
  const trigger = {
    limitation: { duration: '1h', times: 10 },
    recipe: [{ type: 'regex', name: 'step_01', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' }]
  }
  const logText = [
    '2026-05-04 10:00:00 ERROR one',
    '2026-05-04 10:01:00 ERROR two',
    '2026-05-04 10:02:00 ERROR three'
  ].join('\n')
  const result = testTriggerPattern(trigger, logText, 'yyyy-MM-dd HH:mm:ss')

  const matchedLines = result.fullAnalysis.stepAnalyses[0].matchedLines
  expect(matchedLines).toHaveLength(3)
  // Each line is its own firing → all 3 marked
  expect(matchedLines[0].isFiringLine).toBe(true)
  expect(matchedLines[1].isFiringLine).toBe(true)
  expect(matchedLines[2].isFiringLine).toBe(true)
})
```

- [ ] **Step 2: 테스트 실행 후 통과 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js -t 'limitation: each firing' --reporter=verbose 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js
git commit -m "test: Trigger fullAnalysis limitation 시 다중 firing isFiringLine 회귀 테스트"
```

---

## Task 9: testTriggerWithFiles에 fullAnalysis + fileName 통합

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/testEngine.js`
- Modify: `client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
it('10. testTriggerWithFiles — fullAnalysis matchedLines have fileName + local lineNum', () => {
  const trigger = {
    recipe: [{ type: 'regex', name: 'step_01', trigger: [{ syntax: '.*ERROR.*' }], times: 1, next: '' }]
  }
  const files = [
    { name: 'a.log', content: 'INFO a\nERROR a1' },           // global lines 1-2
    { name: 'b.log', content: 'ERROR b1\nINFO b\nERROR b2' }  // global lines 3-5
  ]
  const result = testTriggerWithFiles(trigger, files, null)

  const matchedLines = result.fullAnalysis.stepAnalyses[0].matchedLines
  expect(matchedLines).toHaveLength(3)
  expect(matchedLines[0]).toMatchObject({ fileName: 'a.log', lineNum: 2, line: 'ERROR a1' })
  expect(matchedLines[1]).toMatchObject({ fileName: 'b.log', lineNum: 1, line: 'ERROR b1' })
  expect(matchedLines[2]).toMatchObject({ fileName: 'b.log', lineNum: 3, line: 'ERROR b2' })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js -t 'testTriggerWithFiles — fullAnalysis' --reporter=verbose 2>&1 | tail -10
```

Expected: FAIL — fileName이 undefined이거나 lineNum이 global

- [ ] **Step 3: testTriggerWithFiles 보강**

`testEngine.js`의 `testTriggerWithFiles` 함수 끝(`return result` 직전)에 추가:

```js
// Augment fullAnalysis matchedLines with file info (mirrors steps[].matches augmentation)
if (result.fullAnalysis && Array.isArray(result.fullAnalysis.stepAnalyses)) {
  for (const analysis of result.fullAnalysis.stepAnalyses) {
    analysis.matchedLines = analysis.matchedLines.map((m) => {
      const globalIdx = m.lineNum - 1
      const fileInfo = lineFileMap[globalIdx] || { fileName: 'unknown', localLineNum: m.lineNum }
      return {
        ...m,
        globalLineNum: m.lineNum,
        lineNum: fileInfo.localLineNum,
        fileName: fileInfo.fileName
      }
    })
  }
}

return result
```

isFiringLine 마킹은 이미 `testTriggerPattern` 단계에서 적용됨 (steps[].matches가 아직 global lineNum이라 markFiringLines가 정상 작동). 그 후 위 augmentation이 lineNum을 local로 바꾸지만 isFiringLine 플래그는 보존.

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js --reporter=verbose 2>&1 | tail -10
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add client/src/features/clients/components/config-form/trigger/testEngine.js client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js
git commit -m "feat: Trigger testTriggerWithFiles fullAnalysis fileName/lineNum 보강"
```

---

## Task 10: UI — Step 카드 헤더에 "총 N줄 매칭" 배지

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue`

- [ ] **Step 1: helper computed + template 추가**

`TriggerTestPanel.vue`의 `<script setup>`에 헬퍼 함수 추가 (다른 helper 근처):

```js
function fullAnalysisFor(stepName) {
  const sas = testResult.value?.fullAnalysis?.stepAnalyses
  if (!Array.isArray(sas)) return null
  return sas.find(a => a.stepName === stepName) || null
}
```

기존 step 카드 헤더 ([TriggerTestPanel.vue:170-178](../../client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue#L170))를 다음과 같이 수정 — 발동 라벨 옆에 배지 추가:

```vue
<div class="flex items-center gap-2 mb-2">
  <span class="font-medium text-gray-700 dark:text-gray-300">
    {{ step.name }} ({{ step.type }}{{ step.required.duration ? ', ' + step.required.duration : '' }}):
  </span>
  <span class="font-medium" :class="stepStatusClass(step)">
    {{ step.matchCount }}/{{ step.required.times }}회 매칭
    {{ stepStatusLabel(step) }}
  </span>
  <!-- 신규: 전체 매칭 카운트 배지 -->
  <span
    v-if="fullAnalysisFor(step.name) && fullAnalysisFor(step.name).totalMatches > 0"
    class="ml-1 inline-flex items-center px-1.5 py-0.5 text-[10px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-600 dark:text-gray-400"
    :title="`패턴 자체는 입력에서 ${fullAnalysisFor(step.name).totalMatches}줄 매칭됨 (발동 조건 충족 후 스캔 중단)`"
  >
    총 {{ fullAnalysisFor(step.name).totalMatches }}줄 매칭{{ fullAnalysisFor(step.name).truncated ? '+' : '' }}
  </span>
  <span v-if="showNextAction(step)" class="text-primary-600 dark:text-primary-400">{{ step.nextAction }}</span>
</div>
```

- [ ] **Step 2: 수동 검증 — 텍스트 입력으로 4줄 매칭**

```bash
cd client && npm run dev
```

브라우저에서 임의 trigger 폼을 열고 "패턴 매칭 테스트" 펼침 → 텍스트 탭에:
```
ERROR one
ERROR two
ERROR three
ERROR four
```
입력 후 패턴이 `.*ERROR.*`인 step에 대해 테스트 실행. 헤더에 `[총 4줄 매칭]` 배지가 보여야 하고, hover 시 툴팁이 나와야 함.

- [ ] **Step 3: 커밋**

```bash
git add client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue
git commit -m "feat(ui): Trigger 테스트 결과 step 헤더에 '총 N줄 매칭' 배지 추가"
```

---

## Task 11: UI — "전체 매칭 분석" 접힘 패널 구조

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue`

- [ ] **Step 1: 패널 상태 + 토글 함수 추가**

`<script setup>`에 추가:

```js
import { ref, computed, reactive } from 'vue'  // reactive 추가

// 전체 매칭 분석 패널 상태: stepName -> { open, visible }
const analysisState = reactive({})

function ensureAnalysisState(stepName) {
  if (!analysisState[stepName]) {
    analysisState[stepName] = { open: false, visible: 10 }
  }
  return analysisState[stepName]
}

function toggleAnalysis(stepName) {
  const s = ensureAnalysisState(stepName)
  s.open = !s.open
}

function showMore(stepName) {
  const s = ensureAnalysisState(stepName)
  s.visible += 10
}
```

`runTextTest` / `runFileTest`에서 새 결과를 set할 때마다 `analysisState`를 비워야 함. 두 함수의 try 시작부에 추가:

```js
for (const k in analysisState) delete analysisState[k]
```

- [ ] **Step 2: step 카드 하단에 패널 템플릿 추가**

`TriggerTestPanel.vue`의 step 카드 닫는 `</div>` ([line ~265](../../client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue#L265)) 직전에 추가:

```vue
<!-- 전체 매칭 분석 패널 -->
<div
  v-if="fullAnalysisFor(step.name) && fullAnalysisFor(step.name).totalMatches > 0"
  class="mt-2 rounded border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg"
>
  <button
    type="button"
    class="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-bg-hover transition"
    @click="toggleAnalysis(step.name)"
  >
    <svg class="w-3 h-3 transition-transform" :class="{ 'rotate-90': ensureAnalysisState(step.name).open }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
    </svg>
    <span>
      <strong>전체 매칭 분석</strong>
      · {{ fullAnalysisFor(step.name).totalMatches }}{{ fullAnalysisFor(step.name).truncated ? '+' : '' }}줄 매칭
      <span class="text-gray-400">(입력 {{ step.testedLineCount || '?' }}줄 중)</span>
    </span>
  </button>
  <!-- 펼침 영역은 다음 task에서 추가 -->
</div>
```

- [ ] **Step 3: 수동 검증**

브라우저 새로고침 후 동일 입력으로 테스트 → step 카드 아래에 접힌 패널이 보이고, 클릭 시 화살표가 회전해야 함 (펼친 영역은 아직 비어있음 — 다음 task).

- [ ] **Step 4: 커밋**

```bash
git add client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue
git commit -m "feat(ui): Trigger '전체 매칭 분석' 접힘 패널 골격"
```

---

## Task 12: UI — 펼친 상태 — 10줄 표시 + 더 보기 버튼 + truncated 안내

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue`

- [ ] **Step 1: 펼침 영역 템플릿 추가**

Task 11에서 추가한 패널의 닫는 `</div>` 직전 (button 다음)에 추가:

```vue
<div v-if="ensureAnalysisState(step.name).open" class="border-t border-gray-200 dark:border-dark-border">
  <div class="max-h-60 overflow-y-auto px-3 py-2 space-y-0.5 font-mono text-xs">
    <div
      v-for="(m, mi) in fullAnalysisFor(step.name).matchedLines.slice(0, ensureAnalysisState(step.name).visible)"
      :key="mi"
      class="flex gap-2"
      :class="m.isFiringLine ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-600 dark:text-gray-400'"
    >
      <span class="text-gray-400 shrink-0">
        {{ m.fileName ? `${m.fileName}:${m.lineNum}` : `Line ${m.lineNum}` }}
      </span>
      <span class="truncate">"{{ m.line }}"</span>
      <span v-if="m.isFiringLine" class="shrink-0 text-[10px]">(발동)</span>
    </div>
    <div
      v-if="fullAnalysisFor(step.name).truncated"
      class="text-[10px] text-amber-600 dark:text-amber-400 pt-1"
    >
      … 외 {{ fullAnalysisFor(step.name).totalMatches - fullAnalysisFor(step.name).matchedLines.length }}+ 매칭됨 (수집 상한 초과)
    </div>
  </div>
  <div
    v-if="ensureAnalysisState(step.name).visible < fullAnalysisFor(step.name).matchedLines.length"
    class="border-t border-gray-200 dark:border-dark-border px-3 py-1.5 text-center"
  >
    <button
      type="button"
      class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
      @click="showMore(step.name)"
    >
      + 더 보기 ({{ ensureAnalysisState(step.name).visible }}/{{ fullAnalysisFor(step.name).matchedLines.length }})
    </button>
  </div>
</div>
```

- [ ] **Step 2: 수동 검증 — 25줄 매칭**

브라우저에서 25줄짜리 입력(예: `ERROR 1` ~ `ERROR 25`)으로 테스트 → 패널 펼치면 10줄만 보이고, "+ 더 보기 (10/25)" 버튼 클릭마다 10줄씩 추가, 25줄 다 보이면 버튼 사라짐. 첫 줄("ERROR 1")이 녹색 + "(발동)" 라벨 표시.

추가로 1500줄 매칭 입력으로 테스트 → 패널 펼치면 10줄 + 더 보기, 끝까지 펼치면 1000줄에서 멈추고 "… 외 500+ 매칭됨 (수집 상한 초과)" 안내가 표시.

- [ ] **Step 3: 커밋**

```bash
git add client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue
git commit -m "$(cat <<'EOF'
feat(ui): Trigger 전체 매칭 분석 패널 펼침 — 10줄 + 더 보기

발동 라인 녹색 강조 + (발동) 라벨, 수집 상한 초과 시 안내,
max-height 240px overflow 적용으로 화면 안전.
EOF
)"
```

---

## Task 13: UI — 적용 제외 케이스 검증 (delay/MULTI/0건)

**Files:**
- Modify: `client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue` (필요 시 미세 조정)

- [ ] **Step 1: 수동 검증 — delay step**

trigger 폼에서 step type을 `delay`로 변경 후 테스트 → 해당 step 카드에 배지/패널 모두 미표시 (현재 구현이 `fullAnalysisFor(step.name)`에 의존하고 delay step은 `analyzeAllMatches`에서 제외되므로 자동 차단). 확인만 필요.

- [ ] **Step 2: 수동 검증 — MULTI 클래스**

trigger의 `class`를 `MULTI`로 설정 후 테스트 → MULTI 인스턴스 카드들만 표시되고 fullAnalysis 영역은 미렌더 (현재 템플릿이 `<template v-else>` 분기에서만 step 카드를 그리고, isMulti 분기는 별도 템플릿이라 자동 차단).

- [ ] **Step 3: 수동 검증 — 0건 매칭**

매칭되지 않는 패턴(예: `.*FATAL.*`)으로 4줄 ERROR 입력 테스트 → step 카드 헤더에 배지 없음, "전체 매칭 분석" 패널 없음. 기존 "입력된 N줄 중 매칭되는 라인이 없습니다" 안내만 표시.

- [ ] **Step 4: 만약 셋 중 하나라도 깨지면 v-if 가드 보강**

위 검증에서 문제가 발견되면 해당 v-if 조건을 더 엄격히 (예: `&& !testResult.isMulti`) 보강. 문제 없으면 코드 변경 없음.

- [ ] **Step 5: 커밋 (코드 변경이 있었던 경우만)**

```bash
git add client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue
git commit -m "fix(ui): Trigger 전체 매칭 분석 — 적용 제외 케이스 가드 보강"
```

---

## Task 14: 최종 통합 회귀 검증

- [ ] **Step 1: 전체 testEngine 테스트 실행**

```bash
cd client && npx vitest run src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js --reporter=verbose 2>&1 | tail -20
```

Expected: 기존 + 신규 테스트 전부 PASS

- [ ] **Step 2: 전체 client 테스트 실행 (회귀 확인)**

```bash
cd client && npx vitest run --reporter=dot 2>&1 | tail -10
```

Expected: 회귀 0건

- [ ] **Step 3: 수동 시나리오 — 파일 시뮬레이션**

브라우저에서 trigger 폼 "패턴 매칭 테스트" → "파일 시뮬레이션" 탭 → 임의 .log 파일(여러 줄 매칭 포함) 업로드 → "시뮬레이션 실행". 다음을 확인:
- step 헤더 배지에 정확한 매칭 수
- 패널 펼치면 라인이 `파일명:라인번호` 형식으로 표시
- 발동 라인 녹색 강조

- [ ] **Step 4: 수동 시나리오 — limitation 설정**

trigger에 `limitation: { duration: '1h', times: 10 }` 추가 후 매칭 라인 4건 입력 테스트 → 헤더 "총 4줄 매칭" 배지, 패널 펼치면 4줄 모두 녹색(각각 firing line). limitation summary 영역에 #1~#4 발동 시각도 함께 표시되는지 확인.

- [ ] **Step 5: 작업 완료 보고 + push 여부 확인**

terminal에서 작업 완료 사실을 사용자에게 보고하고, push 시점은 사용자의 명시 지시를 기다림.

---

## Self-Review

**1. Spec coverage:**
- ✅ 엔진 변경(별도 함수): Task 1, 6, 7, 9
- ✅ 적용 범위(MULTI/delay/0건/limitation 마킹): Task 3, 6, 7, 8, 13
- ✅ UI 카운트 배지: Task 10
- ✅ UI 접힘 패널: Task 11
- ✅ UI 10줄 + 더 보기: Task 12
- ✅ UI isFiringLine 강조: Task 12
- ✅ UI truncated 안내: Task 12
- ✅ UI max-height: Task 12 (CSS `max-h-60` = 240px)
- ✅ 안전장치 1000건 cap: Task 1, 2
- ✅ 데이터 구조: Task 1(stepAnalyses) / Task 6(fullAnalysis) / Task 9(fileName)
- ✅ 테스트 전략: Task 1~9가 spec의 9개 테스트 시나리오를 모두 커버, UI는 manual smoke (프로젝트에 컴포넌트 테스트 프레임워크 부재)

**2. Placeholder scan:**
- "TBD"/"TODO" 없음
- 모든 코드 step에 실제 코드 포함
- 모든 명령에 정확한 경로/플래그 포함

**3. Type/이름 일관성:**
- `analyzeAllMatches`, `fullAnalysis`, `stepAnalyses`, `matchedLines`, `totalMatches`, `truncated`, `isFiringLine` — 전 task에서 동일 명칭 유지
- `fullAnalysisFor`, `analysisState`, `ensureAnalysisState`, `toggleAnalysis`, `showMore` — UI 헬퍼 명칭 일관
- `markFiringLines` — 헬퍼 함수, Task 7에서 정의 후 Task 7에서만 사용 (testTriggerPattern 내부)

이상 없음.
