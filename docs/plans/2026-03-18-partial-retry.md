# Partial Bucket 분리 표시 + 재처리 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backfill 분석 시 success/partial/pending 3분류 표시, "Partial 재처리" 체크 시 partial bucket만 재처리

**Architecture:** `getCompletedBucketSet`에 `retryPartial` 옵션 추가 + `getPartialBucketSet` 신규 함수로 partial 별도 집계. controller가 3분류 응답 반환. 프론트엔드에서 체크박스로 실행 대상 전환.

**Tech Stack:** Node.js (Express), Vue 3, MongoDB (CRON_RUN_LOG), Vitest

---

## 파일 변경 맵

| 파일 | 액션 | 역할 |
|------|------|------|
| `server/features/recovery/recoverySummaryService.js` | 수정 | `getPartialBucketSet` 추가, `getCompletedBucketSet` 옵션 추가, `processBackfill` retryPartial 지원 |
| `server/features/recovery/recoverySummaryService.test.js` | 수정 | partial 관련 테스트 추가 |
| `server/features/recovery/controller.js` | 수정 | `analyzeBackfill` 3분류 응답, `startBackfill` retryPartial 전달 |
| `server/features/recovery/controller.backfill.test.js` | 수정 | partial 분리 + retryPartial 테스트 추가 |
| `client/src/features/dashboard/components/RecoveryBackfillModal.vue` | 수정 | 3분류 표시, 체크박스, 실행 대상 동적 전환 |

---

## Task 1: `getPartialBucketSet` 추가 (Service)

**Files:**
- Modify: `server/features/recovery/recoverySummaryService.js:322-331`
- Test: `server/features/recovery/recoverySummaryService.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`recoverySummaryService.test.js`의 기존 `getCompletedBucketSet` describe 블록 아래에 추가:

```javascript
describe('getPartialBucketSet', () => {
  it('returns only partial bucket timestamps', async () => {
    const mockCronRunLog = createMockCronRunLog()
    const partialBucket = new Date('2026-03-16T15:00:00.000Z')
    const successBucket = new Date('2026-03-17T15:00:00.000Z')
    mockCronRunLog.find = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { bucket: partialBucket }
        ])
      })
    })
    _setDeps({ CronRunLog: mockCronRunLog })

    const start = new Date('2026-03-16T15:00:00.000Z')
    const end = new Date('2026-03-18T15:00:00.000Z')
    const result = await getPartialBucketSet('daily', start, end)

    expect(result).toBeInstanceOf(Set)
    expect(result.has(partialBucket.getTime())).toBe(true)
    expect(mockCronRunLog.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'partial'
      })
    )
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd server && npx vitest run features/recovery/recoverySummaryService.test.js -t "getPartialBucketSet"`
Expected: FAIL — `getPartialBucketSet is not defined`

- [ ] **Step 3: 최소 구현**

`recoverySummaryService.js`에서 `getCompletedBucketSet` 함수(line 322) 바로 아래에 추가:

```javascript
/**
 * Get partial-status bucket set for retry detection.
 */
async function getPartialBucketSet(period, startDate, endDate) {
  const CronRunLog = getCronRunLog()
  const logs = await CronRunLog.find({
    jobName: 'recoverySummary',
    period,
    bucket: { $gte: startDate, $lte: endDate },
    status: 'partial'
  }).select('bucket').lean()
  return new Set(logs.map(l => l.bucket.getTime()))
}
```

`module.exports`에 `getPartialBucketSet` 추가.

import 문에도 `getPartialBucketSet` 추가 (test 파일 상단).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd server && npx vitest run features/recovery/recoverySummaryService.test.js -t "getPartialBucketSet"`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add server/features/recovery/recoverySummaryService.js server/features/recovery/recoverySummaryService.test.js
git commit -m "feat: add getPartialBucketSet for partial bucket detection"
```

---

## Task 2: `getCompletedBucketSet` retryPartial 옵션 추가 (Service)

**Files:**
- Modify: `server/features/recovery/recoverySummaryService.js:322-331`
- Test: `server/features/recovery/recoverySummaryService.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

기존 `getCompletedBucketSet` 테스트 블록에 추가:

```javascript
it('with retryPartial=true, excludes partial from completed set', async () => {
  const mockCronRunLog = createMockCronRunLog()
  mockCronRunLog.find = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { bucket: new Date('2026-03-16T15:00:00.000Z') } // success only
      ])
    })
  })
  _setDeps({ CronRunLog: mockCronRunLog })

  const start = new Date('2026-03-16T15:00:00.000Z')
  const end = new Date('2026-03-18T15:00:00.000Z')
  await getCompletedBucketSet('daily', start, end, { retryPartial: true })

  // status filter should be ['success'] only, not ['success', 'partial']
  expect(mockCronRunLog.find).toHaveBeenCalledWith(
    expect.objectContaining({
      status: { $in: ['success'] }
    })
  )
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd server && npx vitest run features/recovery/recoverySummaryService.test.js -t "retryPartial"`
Expected: FAIL — status filter still `['success', 'partial']`

- [ ] **Step 3: 최소 구현**

`getCompletedBucketSet` 시그니처 변경:

```javascript
async function getCompletedBucketSet(period, startDate, endDate, { retryPartial = false } = {}) {
  const CronRunLog = getCronRunLog()
  const statusFilter = retryPartial ? ['success'] : ['success', 'partial']
  const logs = await CronRunLog.find({
    jobName: 'recoverySummary',
    period,
    bucket: { $gte: startDate, $lte: endDate },
    status: { $in: statusFilter }
  }).select('bucket').lean()
  return new Set(logs.map(l => l.bucket.getTime()))
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd server && npx vitest run features/recovery/recoverySummaryService.test.js -t "retryPartial"`
Expected: PASS

- [ ] **Step 5: 전체 회귀 확인 + 커밋**

Run: `cd server && npx vitest run features/recovery/recoverySummaryService.test.js`
Expected: 모든 기존 테스트 PASS (기본값 `retryPartial=false`이므로 기존 동작 유지)

```bash
git add server/features/recovery/recoverySummaryService.js server/features/recovery/recoverySummaryService.test.js
git commit -m "feat: getCompletedBucketSet retryPartial option"
```

---

## Task 3: `processBackfill` retryPartial 지원 (Service)

**Files:**
- Modify: `server/features/recovery/recoverySummaryService.js:358-452`
- Test: `server/features/recovery/recoverySummaryService.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`runManualBackfill` 테스트 블록에 추가:

```javascript
it('with retryPartial=true, processes only partial buckets and skips pending', async () => {
  const mockEarsDb = createMockEarsDb()
  const mockCronRunLog = createMockCronRunLog()

  // 3 buckets: 1 success, 1 partial, 1 pending (no log)
  const successBucket = new Date('2026-03-14T15:00:00.000Z')
  const partialBucket = new Date('2026-03-15T15:00:00.000Z')
  // pendingBucket = 2026-03-16T15:00:00.000Z (no log entry)

  // getCompletedBucketSet(retryPartial=true) → returns only success
  // getPartialBucketSet → returns only partial
  let findCallCount = 0
  mockCronRunLog.find = vi.fn().mockImplementation((query) => {
    // Determine which query this is based on status filter
    let result
    if (query.status === 'partial') {
      // getPartialBucketSet call
      result = [{ bucket: partialBucket }]
    } else if (query.status?.$in) {
      if (query.status.$in.length === 1 && query.status.$in[0] === 'success') {
        // getCompletedBucketSet with retryPartial=true
        result = [{ bucket: successBucket }]
      } else {
        // getCompletedBucketSet without retryPartial
        result = [{ bucket: successBucket }, { bucket: partialBucket }]
      }
    } else {
      result = []
    }
    return {
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(result)
      })
    }
  })

  _setDeps({
    earsDb: mockEarsDb,
    CronRunLog: mockCronRunLog,
    settlingHours: 0,
    sleep: vi.fn()
  })

  const start = new Date('2026-03-14T15:00:00.000Z')
  const end = new Date('2026-03-17T15:00:00.000Z') // 3 daily buckets

  await runManualBackfill(start, end, {
    skipHourly: true,
    retryPartial: true,
    throttleMs: 0
  })

  // Wait for async processBackfill
  await _getBackfillPromise()

  const state = getBackfillState()
  expect(state.status).toBe('completed')
  // total = 3, skipped = 2 (success + pending), processed = 1 (partial only)
  expect(state.total).toBe(3)
  expect(state.skipped).toBe(2)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd server && npx vitest run features/recovery/recoverySummaryService.test.js -t "retryPartial=true, processes only partial"`
Expected: FAIL — `retryPartial` 옵션이 아직 구현되지 않아 pending도 처리됨

- [ ] **Step 3: 최소 구현**

`runManualBackfill` 수정 — `options`에서 `retryPartial` 추출하고 `processBackfill`에 전달:

```javascript
async function runManualBackfill(startDate, endDate, options = {}) {
  if (backfillState.status === 'running') {
    throw new Error('Backfill already in progress')
  }

  const { skipHourly = false, skipDaily = false, throttleMs = deps.defaultThrottleMs, retryPartial = false } = options

  // ... (기존 코드 동일)

  backfillPromise = processBackfill(periods, start, clampedEnd, throttleMs, { retryPartial })
}
```

`processBackfill` 수정 — retryPartial일 때 partial bucket만 처리:

```javascript
async function processBackfill(periods, startDate, endDate, throttleMs, { retryPartial = false } = {}) {
  try {
    let allBuckets = []
    for (const period of periods) {
      const expected = generateExpectedBuckets(period, startDate, endDate)

      if (retryPartial) {
        // Partial 재처리: partial만 처리, success+pending은 skip
        const partialSet = await getPartialBucketSet(period, startDate, endDate)
        for (const bucket of expected) {
          if (partialSet.has(bucket.getTime())) {
            allBuckets.push({ period, bucket })
          } else {
            backfillState.skipped++
          }
        }
      } else {
        // 기존 동작: success+partial skip, pending만 처리
        const completed = await getCompletedBucketSet(period, startDate, endDate)
        for (const bucket of expected) {
          if (completed.has(bucket.getTime())) {
            backfillState.skipped++
          } else {
            allBuckets.push({ period, bucket })
          }
        }
      }
    }

    // ... 이후 기존 코드 동일
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd server && npx vitest run features/recovery/recoverySummaryService.test.js -t "retryPartial=true, processes only partial"`
Expected: PASS

- [ ] **Step 5: 전체 회귀 + 커밋**

Run: `cd server && npx vitest run features/recovery/recoverySummaryService.test.js`
Expected: 모든 기존 테스트 PASS

```bash
git add server/features/recovery/recoverySummaryService.js server/features/recovery/recoverySummaryService.test.js
git commit -m "feat: processBackfill retryPartial — process only partial buckets"
```

---

## Task 4: Controller `analyzeBackfill` 3분류 응답 (Controller)

**Files:**
- Modify: `server/features/recovery/controller.js:101-140`
- Test: `server/features/recovery/controller.backfill.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`controller.backfill.test.js`에 새 describe 블록 추가:

```javascript
describe('Section F: Partial 분리 표시', () => {
  it('F1: analyzeBackfill returns success/partial/pending 3-way breakdown', async () => {
    // 2 daily buckets expected, 1 partial in completedSet
    const partialBucket = new Date('2026-03-16T15:00:00.000Z')

    // getCompletedBucketSet returns success+partial (기본)
    mockGetCompletedBucketSet.mockResolvedValue(
      new Set([partialBucket.getTime()])
    )
    // getPartialBucketSet returns only partial
    mockGetPartialBucketSet.mockResolvedValue(
      new Set([partialBucket.getTime()])
    )

    const req = mockReq({
      startDate: '2026-03-17',
      endDate: '2026-03-18',
      skipHourly: true
    })
    const res = mockRes()

    await analyzeBackfill(req, res)

    expect(res.body.daily.success).toBe(0)
    expect(res.body.daily.partial).toBe(1)
    expect(res.body.daily.pending).toBe(1)
    expect(res.body.daily.total).toBe(2)
  })

  it('F2: analyzeBackfill with retryPartial=true, actionable shows partial count', async () => {
    const partialBucket = new Date('2026-03-16T15:00:00.000Z')

    mockGetCompletedBucketSet.mockResolvedValue(
      new Set([partialBucket.getTime()])
    )
    mockGetPartialBucketSet.mockResolvedValue(
      new Set([partialBucket.getTime()])
    )

    const req = mockReq({
      startDate: '2026-03-17',
      endDate: '2026-03-18',
      skipHourly: true,
      retryPartial: true
    })
    const res = mockRes()

    await analyzeBackfill(req, res)

    // retryPartial=true → actionable = partial count
    expect(res.body.daily.actionable).toBe(1)
    // estimatedMinutes는 actionable 기준
    expect(res.body.estimatedMinutes).toBeGreaterThan(0)
  })
})
```

NOTE: test 파일의 `_setDeps` 호출에 `mockGetPartialBucketSet`을 `summaryService`에 추가해야 함:

```javascript
const mockGetPartialBucketSet = vi.fn()

// beforeEach의 _setDeps에 추가:
summaryService: {
  // ... 기존 mock들 ...
  getPartialBucketSet: mockGetPartialBucketSet,
}
```

그리고 `beforeEach`에 기본값 추가:
```javascript
mockGetPartialBucketSet.mockResolvedValue(new Set())
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd server && npx vitest run features/recovery/controller.backfill.test.js -t "Section F"`
Expected: FAIL — `res.body.daily.success` is `undefined`

- [ ] **Step 3: 최소 구현**

`controller.js`의 `analyzeBackfill` 함수 수정:

```javascript
async function analyzeBackfill(req, res) {
  const { startDate, endDate, skipHourly, skipDaily, throttleMs, retryPartial } = req.body
  const validation = validateBackfillRange(startDate, endDate)
  if (!validation.valid) return res.status(400).json({ error: validation.error })

  const { generateExpectedBuckets, floorToKSTBucket } = getDateUtils()
  const summaryService = getSummaryService()

  const rawStart = new Date(startDate)
  const rawEnd = new Date(endDate)
  const result = { hourly: null, daily: null, estimatedMinutes: 0 }
  let totalActionable = 0
  const effectiveThrottle = throttleMs ?? 1000

  for (const period of ['hourly', 'daily']) {
    if ((period === 'hourly' && skipHourly) || (period === 'daily' && skipDaily)) continue

    const start = floorToKSTBucket('daily', rawStart)
    const endFloored = floorToKSTBucket('daily', rawEnd)
    const end = new Date(endFloored.getTime() + 24 * 60 * 60 * 1000)

    const expected = generateExpectedBuckets(period, start, end)
    const completedSet = await summaryService.getCompletedBucketSet(period, start, end)
    const partialSet = await summaryService.getPartialBucketSet(period, start, end)

    const successCount = expected.filter(b =>
      completedSet.has(b.getTime()) && !partialSet.has(b.getTime())
    ).length
    const partialCount = expected.filter(b => partialSet.has(b.getTime())).length
    const pendingCount = expected.length - successCount - partialCount
    const actionable = retryPartial ? partialCount : pendingCount

    result[period] = {
      total: expected.length,
      success: successCount,
      partial: partialCount,
      pending: pendingCount,
      actionable
    }
    totalActionable += actionable
  }

  result.estimatedMinutes = Math.round(totalActionable * (1.5 + effectiveThrottle / 1000) / 60 * 10) / 10

  res.json(result)
}
```

`getSummaryService()`에서 destructuring 대신 전체 서비스 사용으로 변경 (line 107). `getPartialBucketSet`도 필요하므로.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd server && npx vitest run features/recovery/controller.backfill.test.js -t "Section F"`
Expected: PASS

- [ ] **Step 5: 기존 Section A~E 회귀 확인**

기존 테스트에서 `res.body.daily.completed`를 참조하던 부분이 없는지 확인. 기존 테스트는 `total`, `pending`만 사용하므로 호환 유지. 다만 Section A 테스트에서 `completed` 대신 `success + partial`을 확인할 수 있도록 약간 조정이 필요할 수 있음 — 기존 테스트가 `total`만 체크하므로 영향 없음.

Run: `cd server && npx vitest run features/recovery/controller.backfill.test.js`
Expected: 모든 18+2 = 20 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add server/features/recovery/controller.js server/features/recovery/controller.backfill.test.js
git commit -m "feat: analyzeBackfill 3-way breakdown (success/partial/pending)"
```

---

## Task 5: Controller `startBackfill` retryPartial 전달 (Controller)

**Files:**
- Modify: `server/features/recovery/controller.js:142-176`
- Test: `server/features/recovery/controller.backfill.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

Section F에 추가:

```javascript
it('F3: startBackfill passes retryPartial to runManualBackfill', async () => {
  const req = mockReq({
    startDate: '2026-03-17',
    endDate: '2026-03-18',
    retryPartial: true
  })
  const res = mockRes()

  await startBackfill(req, res)

  expect(res.statusCode).toBe(202)
  const options = mockRunManualBackfill.mock.calls[0][2]
  expect(options.retryPartial).toBe(true)
})

it('F4: startBackfill defaults retryPartial to false', async () => {
  const req = mockReq({
    startDate: '2026-03-17',
    endDate: '2026-03-18'
  })
  const res = mockRes()

  await startBackfill(req, res)

  const options = mockRunManualBackfill.mock.calls[0][2]
  expect(options.retryPartial).toBeFalsy()
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd server && npx vitest run features/recovery/controller.backfill.test.js -t "F3"`
Expected: FAIL — `options.retryPartial` is `undefined`

- [ ] **Step 3: 최소 구현**

`controller.js`의 `startBackfill` 수정:

```javascript
async function startBackfill(req, res) {
  const { startDate, endDate, skipHourly, skipDaily, throttleMs, retryPartial } = req.body
  // ... validation, getBackfillState 체크 동일 ...

  try {
    await summaryService.runManualBackfill(alignedStart, alignedEnd, {
      skipHourly: !!skipHourly,
      skipDaily: !!skipDaily,
      throttleMs: clampedThrottle,
      retryPartial: !!retryPartial
    })
    res.status(202).json({ message: 'Backfill started' })
  } catch (err) {
    res.status(409).json({ error: err.message })
  }
}
```

- [ ] **Step 4: 테스트 통과 + 전체 회귀 확인**

Run: `cd server && npx vitest run features/recovery/controller.backfill.test.js`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add server/features/recovery/controller.js server/features/recovery/controller.backfill.test.js
git commit -m "feat: startBackfill passes retryPartial to service"
```

---

## Task 6: 프론트엔드 — 3분류 표시 + Partial 재처리 체크박스

**Files:**
- Modify: `client/src/features/dashboard/components/RecoveryBackfillModal.vue`

- [ ] **Step 1: 체크박스 + retryPartial ref 추가**

`<script setup>` 섹션의 Form State에 추가:

```javascript
const retryPartial = ref(false)
```

Settings Form의 체크박스 영역 (line 51-60 부근)에 추가:

```html
<label class="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
  <input type="checkbox" v-model="retryPartial" class="rounded" />
  Partial 재처리
</label>
```

- [ ] **Step 2: handleAnalyze / handleStart에 retryPartial 전달**

`handleAnalyze` 수정:

```javascript
const res = await recoveryApi.analyzeBackfill({
  startDate: startDate.value,
  endDate: endDate.value,
  skipHourly: skipHourly.value,
  skipDaily: skipDaily.value,
  throttleMs: throttleMs.value,
  retryPartial: retryPartial.value
})
```

`handleStart` 수정:

```javascript
await recoveryApi.startBackfill({
  startDate: startDate.value,
  endDate: endDate.value,
  skipHourly: skipHourly.value,
  skipDaily: skipDaily.value,
  throttleMs: throttleMs.value,
  retryPartial: retryPartial.value
})
```

- [ ] **Step 3: totalPending → totalActionable 변환**

`totalPending` computed 수정:

```javascript
const totalActionable = computed(() => {
  if (!analysisResult.value) return 0
  let total = 0
  if (analysisResult.value.hourly) total += analysisResult.value.hourly.actionable
  if (analysisResult.value.daily) total += analysisResult.value.daily.actionable
  return total
})
```

기존 `totalPending` 참조를 `totalActionable`로 변경:
- Backfill 실행 버튼의 `:disabled` — `totalActionable === 0`
- 확인 다이얼로그 — `totalActionable.toLocaleString()`

- [ ] **Step 4: 분석 결과 표시 3분류로 변경**

기존 Analysis Result 템플릿 (line 103-133) 교체:

```html
<!-- Analysis Result -->
<div v-if="analysisResult" class="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 space-y-2 text-sm">
  <h4 class="font-medium text-gray-700 dark:text-gray-300">분석 결과</h4>
  <template v-for="period in ['hourly', 'daily']" :key="period">
    <div v-if="analysisResult[period]" class="space-y-1">
      <div class="text-gray-600 dark:text-gray-400">
        {{ period === 'hourly' ? 'Hourly' : 'Daily' }}: {{ analysisResult[period].total.toLocaleString() }} buckets
      </div>
      <div class="flex items-center gap-3 text-xs flex-wrap">
        <span class="text-green-600 dark:text-green-400">
          ✓ 성공: {{ analysisResult[period].success.toLocaleString() }}
          ({{ pct(analysisResult[period].success, analysisResult[period].total) }})
        </span>
        <span v-if="analysisResult[period].partial > 0" class="text-amber-600 dark:text-amber-400">
          ⚠ Partial: {{ analysisResult[period].partial.toLocaleString() }}
          ({{ pct(analysisResult[period].partial, analysisResult[period].total) }})
        </span>
        <span class="text-orange-600 dark:text-orange-400">
          ░ 미처리: {{ analysisResult[period].pending.toLocaleString() }}
          ({{ pct(analysisResult[period].pending, analysisResult[period].total) }})
        </span>
      </div>
      <!-- Progress bar: 3-segment -->
      <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
        <div
          class="h-full bg-green-500"
          :style="{ width: pct(analysisResult[period].success, analysisResult[period].total) }"
        ></div>
        <div
          class="h-full bg-amber-500"
          :style="{ width: pct(analysisResult[period].partial, analysisResult[period].total) }"
        ></div>
      </div>
    </div>
  </template>
  <p class="text-gray-500 dark:text-gray-400">
    예상 소요: ~{{ formatDuration(analysisResult.estimatedMinutes) }}
    (throttle {{ (throttleMs / 1000).toFixed(1) }}초 기준, {{ retryPartial ? 'partial만' : '미처리만' }} {{ totalActionable }}건)
  </p>
</div>
```

- [ ] **Step 5: 실행 버튼에 건수 표시**

Backfill 실행 버튼 텍스트 수정:

```html
<button
  v-if="analysisResult"
  @click="showConfirmDialog = true"
  :disabled="serverStatus === 'running' || totalActionable === 0"
  class="px-4 py-1.5 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
>
  Backfill 실행 ({{ totalActionable }}건)
</button>
```

- [ ] **Step 6: pct 헬퍼 함수 추가**

`<script setup>` 내 formatting 함수 영역에 추가:

```javascript
function pct(value, total) {
  if (!total) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}
```

- [ ] **Step 7: 확인 다이얼로그 메시지 업데이트**

```html
<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
  {{ totalActionable.toLocaleString() }}건 {{ retryPartial ? '(partial 재처리)' : '' }} 처리,
  예상 ~{{ formatDuration(analysisResult?.estimatedMinutes) }}.
  실행하시겠습니까?
</p>
```

- [ ] **Step 8: 수동 UI 검증**

브라우저에서 확인:
1. Backfill 모달 오픈 → 날짜 입력 → [분석] → 3분류 표시 확인
2. "Partial 재처리" 체크 → [분석] → actionable 건수 partial 기준으로 변경 확인
3. [Backfill 실행] 버튼에 건수 표시 확인
4. 체크 해제 → [분석] → pending 기준 복원 확인

- [ ] **Step 9: 커밋**

```bash
git add client/src/features/dashboard/components/RecoveryBackfillModal.vue
git commit -m "feat: 3-way analysis display + retryPartial checkbox"
```

---

## Task 7: 전체 테스트 회귀 검증

- [ ] **Step 1: 서버 전체 recovery 테스트**

Run: `cd server && npx vitest run features/recovery/controller.backfill.test.js features/recovery/recoverySummaryService.test.js features/recovery/dateUtils.test.js`
Expected: 모든 테스트 PASS (110+ tests)

- [ ] **Step 2: 기존 service.test.js 확인**

Run: `cd server && npx vitest run features/recovery/service.test.js`
Note: line 356 toISOString 기존 실패 1건은 이번 변경과 무관. 그 외 24건 PASS 확인.

- [ ] **Step 3: 최종 커밋 (필요 시)**

변경사항 정리 후 통합 커밋 또는 기존 커밋 유지.
