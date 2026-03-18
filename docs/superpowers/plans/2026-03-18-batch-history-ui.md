# Batch History UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recovery Overview에 배치 실행 이력 모달(히트맵+테이블)을 추가한다.

**Architecture:** 서버에 2개 API(목록 조회, 히트맵 집계)를 추가하고, 클라이언트에 BatchHistoryModal(필터+테이블)과 BatchHeatmap(GitHub Contribution 스타일) 컴포넌트를 생성하여 RecoveryOverviewView에 통합한다.

**Tech Stack:** Express, MongoDB aggregation, Vue 3 Composition API, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-18-batch-history-ui-design.md`

---

## Task 1: Server — Batch Logs API 테스트 (RED)

**Files:**
- Create: `server/features/recovery/controller.batchLogs.test.js`

**References:**
- Test pattern: `server/features/recovery/controller.backfill.test.js`
- Model: `server/shared/models/webmanagerLogModel.js` (WebManagerLog, createBatchLog, getRecentBatchLogs)
- Pagination: `server/shared/utils/pagination.js` (parsePaginationParams, createPaginatedResponse)

- [ ] **Step 1: Write failing tests**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getBatchLogs, getBatchHeatmap, _setDeps } = require('./controller.js')

// ── Mock WebManagerLog ──
const mockFind = vi.fn()
const mockCountDocuments = vi.fn()

function mockReq(query = {}) {
  return { query }
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res },
    json(data) { res.body = data; return res }
  }
  return res
}

describe('controller.batchLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([])
          })
        })
      })
    })
    mockCountDocuments.mockResolvedValue(0)

    _setDeps({
      WebManagerLog: {
        find: mockFind,
        countDocuments: mockCountDocuments
      }
    })
  })

  describe('getBatchLogs', () => {
    it('returns paginated response with default params', async () => {
      mockCountDocuments.mockResolvedValue(3)
      mockFind.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue([
                { batchAction: 'cron_completed', timestamp: new Date() },
                { batchAction: 'cron_completed', timestamp: new Date() },
                { batchAction: 'cron_skipped', timestamp: new Date() }
              ])
            })
          })
        })
      })

      const req = mockReq({})
      const res = mockRes()
      await getBatchLogs(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.data).toHaveLength(3)
      expect(res.body.pagination).toBeDefined()
      expect(res.body.pagination.total).toBe(3)
      expect(res.body.pagination.page).toBe(1)
    })

    it('filters by batchAction', async () => {
      const req = mockReq({ batchAction: 'cron_skipped' })
      const res = mockRes()
      await getBatchLogs(req, res)

      const findCall = mockFind.mock.calls[0][0]
      expect(findCall.batchAction).toBe('cron_skipped')
    })

    it('filters by period=today', async () => {
      const req = mockReq({ period: 'today' })
      const res = mockRes()
      await getBatchLogs(req, res)

      const findCall = mockFind.mock.calls[0][0]
      expect(findCall.timestamp).toBeDefined()
      expect(findCall.timestamp.$gte).toBeInstanceOf(Date)
    })

    it('filters by startDate/endDate (heatmap cell click)', async () => {
      const req = mockReq({ startDate: '2026-03-17', endDate: '2026-03-17' })
      const res = mockRes()
      await getBatchLogs(req, res)

      const findCall = mockFind.mock.calls[0][0]
      expect(findCall.timestamp.$gte).toBeInstanceOf(Date)
      expect(findCall.timestamp.$lte).toBeInstanceOf(Date)
    })
  })

  describe('getBatchHeatmap', () => {
    it('returns heatmap data with default 30 days', async () => {
      const mockAggregate = vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { _id: '2026-03-18', total: 26, actions: { cron_completed: 24, cron_skipped: 1, backfill_started: 1 } }
        ])
      })
      _setDeps({
        WebManagerLog: {
          find: mockFind,
          countDocuments: mockCountDocuments,
          collection: { aggregate: mockAggregate }
        }
      })

      const req = mockReq({})
      const res = mockRes()
      await getBatchHeatmap(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].date).toBe('2026-03-18')
      expect(res.body.data[0].cron).toBe(24)
      expect(res.body.data[0].skip).toBe(1)
      expect(res.body.data[0].backfill).toBe(1)
    })

    it('maps batchActions to 3 categories correctly', async () => {
      const mockAggregate = vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            _id: '2026-03-18',
            total: 30,
            actions: {
              cron_completed: 24,
              cron_skipped: 2,
              backfill_started: 1,
              backfill_completed: 1,
              backfill_cancelled: 1,
              auto_backfill_completed: 1
            }
          }
        ])
      })
      _setDeps({
        WebManagerLog: {
          find: mockFind,
          countDocuments: mockCountDocuments,
          collection: { aggregate: mockAggregate }
        }
      })

      const req = mockReq({})
      const res = mockRes()
      await getBatchHeatmap(req, res)

      const day = res.body.data[0]
      expect(day.cron).toBe(24)
      expect(day.skip).toBe(2)
      expect(day.backfill).toBe(4) // started + completed + cancelled + auto
    })

    it('accepts days=90 parameter', async () => {
      const mockAggregate = vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
      _setDeps({
        WebManagerLog: {
          find: mockFind,
          countDocuments: mockCountDocuments,
          collection: { aggregate: mockAggregate }
        }
      })

      const req = mockReq({ days: '90' })
      const res = mockRes()
      await getBatchHeatmap(req, res)

      // Verify the $match stage uses 90 days ago
      const pipeline = mockAggregate.mock.calls[0][0]
      const matchDate = pipeline[0].$match.timestamp.$gte
      const diffMs = Date.now() - matchDate.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeGreaterThan(89)
      expect(diffDays).toBeLessThan(91)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run features/recovery/controller.batchLogs.test.js`
Expected: FAIL — `getBatchLogs` and `getBatchHeatmap` are not exported from controller.js

---

## Task 2: Server — Batch Logs API 구현 (GREEN)

**Files:**
- Modify: `server/features/recovery/controller.js` — `getBatchLogs`, `getBatchHeatmap` 핸들러 추가
- Modify: `server/features/recovery/routes.js` — 2개 라우트 추가

**References:**
- `server/features/recovery/controller.js:71-92` (getHistory 핸들러 — pagination 패턴)
- `server/shared/models/webmanagerLogModel.js` (WebManagerLog 모델)

- [ ] **Step 3: Add getBatchLogs handler to controller.js**

`controller.js` 상단 import에 WebManagerLog 추가:
```javascript
const { createBatchLog, WebManagerLog } = require('../../shared/models/webmanagerLogModel')
```

기존 `createBatchLog` import를 위 라인으로 교체 (WebManagerLog 추가).

DI 지원을 위해 `getSummaryService()` 아래에 추가:
```javascript
function getWebManagerLog() {
  return deps.WebManagerLog || WebManagerLog
}
```

`handleCancelBackfill` 함수 뒤에 추가:

```javascript
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function buildBatchLogsQuery(query) {
  const filter = { category: 'batch' }

  if (query.batchAction) filter.batchAction = query.batchAction

  if (query.startDate || query.endDate) {
    filter.timestamp = {}
    if (query.startDate) {
      const start = new Date(query.startDate)
      // KST 00:00:00으로 정렬
      start.setUTCHours(0, 0, 0, 0)
      filter.timestamp.$gte = new Date(start.getTime() - KST_OFFSET_MS)
    }
    if (query.endDate) {
      const end = new Date(query.endDate)
      end.setUTCHours(0, 0, 0, 0)
      // KST 23:59:59.999
      filter.timestamp.$lte = new Date(end.getTime() - KST_OFFSET_MS + 24 * 60 * 60 * 1000 - 1)
    }
  } else if (query.period) {
    const now = new Date()
    let startDate
    if (query.period === 'today') {
      const kstNow = new Date(now.getTime() + KST_OFFSET_MS)
      kstNow.setUTCHours(0, 0, 0, 0)
      startDate = new Date(kstNow.getTime() - KST_OFFSET_MS)
    } else if (query.period === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (query.period === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
    if (startDate) filter.timestamp = { $gte: startDate }
  }

  return filter
}

async function getBatchLogs(req, res) {
  const Log = getWebManagerLog()
  const { page, pageSize, skip, limit } = parsePaginationParams(req.query, { defaultPageSize: 50 })
  const filter = buildBatchLogsQuery(req.query)

  const [data, total] = await Promise.all([
    Log.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    Log.countDocuments(filter)
  ])

  res.json(createPaginatedResponse(data, total, page, pageSize))
}
```

- [ ] **Step 4: Add getBatchHeatmap handler to controller.js**

`getBatchLogs` 함수 뒤에 추가:

```javascript
const BACKFILL_ACTIONS = new Set([
  'backfill_started', 'backfill_completed', 'backfill_cancelled', 'auto_backfill_completed'
])

async function getBatchHeatmap(req, res) {
  const Log = getWebManagerLog()
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const pipeline = [
    { $match: { category: 'batch', timestamp: { $gte: since } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: '+09:00' } },
          action: '$batchAction'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        total: { $sum: '$count' },
        actions: { $push: { k: '$_id.action', v: '$count' } }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id',
        total: 1,
        actions: { $arrayToObject: '$actions' }
      }
    }
  ]

  const raw = await Log.collection.aggregate(pipeline).toArray()

  const data = raw.map(row => ({
    date: row.date,
    total: row.total,
    cron: row.actions.cron_completed || 0,
    skip: row.actions.cron_skipped || 0,
    backfill: Object.entries(row.actions)
      .filter(([k]) => BACKFILL_ACTIONS.has(k))
      .reduce((sum, [, v]) => sum + v, 0)
  }))

  res.json({ data })
}
```

- [ ] **Step 5: Export new handlers from controller.js**

`module.exports`에 추가:

```javascript
module.exports = {
  // ... existing exports ...
  getBatchLogs,
  getBatchHeatmap,
  _setDeps
}
```

- [ ] **Step 6: Add routes**

`server/features/recovery/routes.js`에서 `module.exports` 바로 위에 추가:

```javascript
// Batch Logs API (Admin only)
router.get('/batch-logs', authenticate, requireRole([1]), asyncHandler(controller.getBatchLogs))
router.get('/batch-logs/heatmap', authenticate, requireRole([1]), asyncHandler(controller.getBatchHeatmap))
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd server && npx vitest run features/recovery/controller.batchLogs.test.js`
Expected: ALL PASS (7 tests)

- [ ] **Step 8: Run all recovery tests to verify no regressions**

Run: `cd server && npx vitest run features/recovery/`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add server/features/recovery/controller.js server/features/recovery/routes.js server/features/recovery/controller.batchLogs.test.js
git commit -m "feat: Batch Logs API (GET /batch-logs, /batch-logs/heatmap)"
```

---

## Task 3: Client — API 클라이언트 추가

**Files:**
- Modify: `client/src/shared/api/index.js`

- [ ] **Step 10: Add batch log API methods to recoveryApi**

`client/src/shared/api/index.js`의 `recoveryApi` 객체에 추가:

```javascript
// recoveryApi 객체 안, getCronRunDistribution 아래에 추가:
getBatchLogs: (params = {}) => api.get('/recovery/batch-logs', { params }),
getBatchHeatmap: (params = {}) => api.get('/recovery/batch-logs/heatmap', { params }),
```

- [ ] **Step 11: Commit**

```bash
git add client/src/shared/api/index.js
git commit -m "feat: recoveryApi에 getBatchLogs/getBatchHeatmap 추가"
```

---

## Task 4: Client — BatchHeatmap 컴포넌트

**Files:**
- Create: `client/src/features/dashboard/components/BatchHeatmap.vue`

**References:**
- 히트맵 스펙: `docs/superpowers/specs/2026-03-18-batch-history-ui-design.md` 히트맵 섹션
- 다크 모드 패턴: `client/src/features/dashboard/components/RecoveryStatusDonut.vue` (useTheme)

- [ ] **Step 12: Create BatchHeatmap.vue**

```vue
<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { recoveryApi } from '../../../shared/api'
import { useTheme } from '../../../shared/composables/useTheme'

const props = defineProps({
  days: { type: Number, default: 30 }
})

const emit = defineEmits(['select-date'])

const heatmapData = ref([])
const loading = ref(false)
const selectedDate = ref(null)
const { isDark } = useTheme()

async function fetchData() {
  loading.value = true
  try {
    const res = await recoveryApi.getBatchHeatmap({ days: props.days })
    heatmapData.value = res.data.data || []
  } catch (err) {
    console.error('Heatmap fetch error:', err)
    heatmapData.value = []
  } finally {
    loading.value = false
  }
}

// 날짜 → 데이터 맵
const dataMap = computed(() => {
  const map = new Map()
  for (const item of heatmapData.value) {
    map.set(item.date, item)
  }
  return map
})

// 히트맵 그리드 생성 (GitHub 스타일: 열=주, 행=요일)
const grid = computed(() => {
  const today = new Date()
  // KST 기준 오늘 날짜
  const kstToday = new Date(today.getTime() + 9 * 60 * 60 * 1000)
  const endDate = new Date(Date.UTC(kstToday.getUTCFullYear(), kstToday.getUTCMonth(), kstToday.getUTCDate()))

  const totalDays = props.days
  const startDate = new Date(endDate.getTime() - (totalDays - 1) * 24 * 60 * 60 * 1000)

  // 주 단위로 그룹화 (0=Mon ~ 6=Sun)
  const weeks = []
  let currentWeek = []
  const cursor = new Date(startDate)

  // 첫 주의 빈 셀 채우기
  const startDow = (cursor.getUTCDay() + 6) % 7 // Mon=0
  for (let i = 0; i < startDow; i++) {
    currentWeek.push(null)
  }

  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const isFuture = cursor > endDate
    currentWeek.push({
      date: dateStr,
      data: dataMap.value.get(dateStr) || null,
      isFuture,
      isToday: dateStr === endDate.toISOString().slice(0, 10)
    })

    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  // 마지막 주 미래 셀 채우기
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: null, data: null, isFuture: true })
    }
    weeks.push(currentWeek)
  }

  return weeks
})

function getCellColor(cell) {
  if (!cell || cell.isFuture || !cell.date) return isDark.value ? 'bg-gray-800' : 'bg-gray-100'
  const d = cell.data
  if (!d) return isDark.value ? 'bg-gray-700' : 'bg-gray-200'

  // 우선순위: skip > backfill > cron
  if (d.skip > 0) return 'bg-yellow-300 dark:bg-yellow-600'
  if (d.backfill > 0) return 'bg-blue-400 dark:bg-blue-600'

  // cron 건수에 따른 초록 농도
  const count = d.cron || 0
  if (count === 0) return isDark.value ? 'bg-gray-700' : 'bg-gray-200'
  if (count <= 10) return 'bg-green-200 dark:bg-green-900'
  if (count <= 20) return 'bg-green-300 dark:bg-green-700'
  return 'bg-green-500 dark:bg-green-500'
}

function getTooltip(cell) {
  if (!cell || !cell.date) return ''
  const d = cell.data
  if (!d) return `${cell.date}: 이벤트 없음`
  const parts = [`${cell.date}: 총 ${d.total}건`]
  if (d.cron) parts.push(`cron ${d.cron}`)
  if (d.skip) parts.push(`skip ${d.skip}`)
  if (d.backfill) parts.push(`backfill ${d.backfill}`)
  return parts.join(' | ')
}

function handleCellClick(cell) {
  if (!cell || !cell.date || cell.isFuture) return
  selectedDate.value = selectedDate.value === cell.date ? null : cell.date
  emit('select-date', selectedDate.value)
}

watch(() => props.days, fetchData)
onMounted(fetchData)
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-4">
      <svg class="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>

    <div v-else>
      <!-- Grid -->
      <div class="flex gap-0.5">
        <!-- 요일 라벨 -->
        <div class="flex flex-col gap-0.5 mr-1 justify-center">
          <div class="h-3.5 text-[9px] text-gray-400 flex items-center">Mon</div>
          <div class="h-3.5" />
          <div class="h-3.5 text-[9px] text-gray-400 flex items-center">Wed</div>
          <div class="h-3.5" />
          <div class="h-3.5 text-[9px] text-gray-400 flex items-center">Fri</div>
          <div class="h-3.5" />
          <div class="h-3.5 text-[9px] text-gray-400 flex items-center">Sun</div>
        </div>

        <!-- 주 컬럼 -->
        <div v-for="(week, wi) in grid" :key="wi" class="flex flex-col gap-0.5">
          <div
            v-for="(cell, di) in week"
            :key="di"
            :class="[
              'w-3.5 h-3.5 rounded-sm cursor-pointer transition-all',
              getCellColor(cell),
              cell && selectedDate === cell.date ? 'ring-2 ring-blue-500' : '',
              cell && !cell.isFuture ? 'hover:ring-1 hover:ring-gray-400' : 'opacity-20 cursor-default'
            ]"
            :title="getTooltip(cell)"
            @click="handleCellClick(cell)"
          />
        </div>
      </div>

      <!-- 범례 -->
      <div class="flex items-center gap-3 mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        <span>적음</span>
        <div class="flex gap-0.5">
          <div class="w-2.5 h-2.5 rounded-sm bg-green-200 dark:bg-green-900" />
          <div class="w-2.5 h-2.5 rounded-sm bg-green-300 dark:bg-green-700" />
          <div class="w-2.5 h-2.5 rounded-sm bg-green-500" />
        </div>
        <span>많음</span>
        <span class="mx-1">|</span>
        <div class="flex items-center gap-1"><div class="w-2.5 h-2.5 rounded-sm bg-blue-400 dark:bg-blue-600" />backfill</div>
        <div class="flex items-center gap-1"><div class="w-2.5 h-2.5 rounded-sm bg-yellow-300 dark:bg-yellow-600" />skip</div>
      </div>

      <p class="text-[11px] text-gray-400 mt-1">셀을 클릭하면 해당 날짜로 필터링됩니다</p>
    </div>
  </div>
</template>
```

- [ ] **Step 13: Commit**

```bash
git add client/src/features/dashboard/components/BatchHeatmap.vue
git commit -m "feat: BatchHeatmap 컴포넌트 (GitHub Contribution 스타일)"
```

---

## Task 5: Client — BatchHistoryModal 컴포넌트

**Files:**
- Create: `client/src/features/dashboard/components/BatchHistoryModal.vue`

**References:**
- Modal pattern: `client/src/features/dashboard/components/RecoveryBackfillModal.vue` (Teleport, drag, resize)
- 테이블 패턴: 같은 파일의 로그 테이블 영역

- [ ] **Step 14: Create BatchHistoryModal.vue**

```vue
<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { recoveryApi } from '../../../shared/api'
import BatchHeatmap from './BatchHeatmap.vue'

const props = defineProps({
  visible: Boolean
})
const emit = defineEmits(['close'])

// ── 히트맵 기간 ──
const heatmapDays = ref(30)

// ── 필터 ──
const filterAction = ref('')
const filterPeriod = ref('7d')
const customDate = ref(null) // 히트맵 셀 클릭 시

// ── 데이터 ──
const logs = ref([])
const pagination = ref({ total: 0, page: 1, pageSize: 50, totalPages: 1 })
const loading = ref(false)
const error = ref(null)

// ── 모달 드래그/리사이즈 ──
const modalRef = ref(null)
const modalStyle = ref({})
const isDragging = ref(false)
const isResizing = ref(false)
const dragStart = ref({ x: 0, y: 0, left: 0, top: 0 })
const resizeStart = ref({ x: 0, y: 0, w: 0, h: 0 })

const MIN_WIDTH = 560
const MIN_HEIGHT = 480
const DEFAULT_WIDTH = 720
const DEFAULT_HEIGHT = 600

function centerModal() {
  const w = Math.min(DEFAULT_WIDTH, window.innerWidth * 0.95)
  const h = Math.min(DEFAULT_HEIGHT, window.innerHeight * 0.95)
  modalStyle.value = {
    left: `${(window.innerWidth - w) / 2}px`,
    top: `${(window.innerHeight - h) / 2}px`,
    width: `${w}px`,
    height: `${h}px`
  }
}

// ── 드래그 ──
function startDrag(e) {
  if (e.target.closest('button') || e.target.closest('select')) return
  isDragging.value = true
  dragStart.value = {
    x: e.clientX,
    y: e.clientY,
    left: parseInt(modalStyle.value.left),
    top: parseInt(modalStyle.value.top)
  }
}

function onMouseMove(e) {
  if (isDragging.value) {
    modalStyle.value.left = `${dragStart.value.left + e.clientX - dragStart.value.x}px`
    modalStyle.value.top = `${dragStart.value.top + e.clientY - dragStart.value.y}px`
  } else if (isResizing.value) {
    const w = Math.max(MIN_WIDTH, resizeStart.value.w + e.clientX - resizeStart.value.x)
    const h = Math.max(MIN_HEIGHT, resizeStart.value.h + e.clientY - resizeStart.value.y)
    modalStyle.value.width = `${w}px`
    modalStyle.value.height = `${h}px`
  }
}

function onMouseUp() {
  isDragging.value = false
  isResizing.value = false
}

function startResize(e) {
  isResizing.value = true
  resizeStart.value = {
    x: e.clientX,
    y: e.clientY,
    w: parseInt(modalStyle.value.width),
    h: parseInt(modalStyle.value.height)
  }
  e.preventDefault()
}

// ── 유형 뱃지 ──
const ACTION_LABELS = {
  cron_completed: { label: 'Cron 완료', bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' },
  cron_skipped: { label: 'Cron Skip', bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300' },
  backfill_started: { label: 'Backfill 시작', bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300' },
  backfill_completed: { label: 'Backfill 완료', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  backfill_cancelled: { label: 'Backfill 취소', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' },
  auto_backfill_completed: { label: 'Auto Backfill', bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300' }
}

function getActionBadge(action) {
  return ACTION_LABELS[action] || { label: action, bg: 'bg-gray-100', text: 'text-gray-600' }
}

// ── 상세 축약 ──
function formatDetail(log) {
  const p = log.batchParams || {}
  const r = log.batchResult || {}
  switch (log.batchAction) {
    case 'cron_completed':
      return `status: ${r.status || '-'}, bucket: ${p.bucket ? new Date(p.bucket).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}`
    case 'cron_skipped':
      return `reason: ${p.reason || '-'}`
    case 'backfill_started':
      return `${p.startDate?.slice(0, 10) || ''}~${p.endDate?.slice(0, 10) || ''}, throttle ${p.throttleMs ?? '-'}ms`
    case 'backfill_completed':
      return `${r.status || '-'}, ${r.processed ?? '-'}건 처리, ${r.durationMs ? (r.durationMs / 1000).toFixed(1) : '-'}초`
    case 'backfill_cancelled':
      return ''
    case 'auto_backfill_completed':
      return `gaps: ${p.gapsFound ?? '-'}, processed: ${p.processed ?? '-'}`
    default:
      return JSON.stringify(p).slice(0, 60)
  }
}

function formatTimestamp(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

// ── 데이터 조회 ──
async function fetchLogs(page = 1) {
  loading.value = true
  error.value = null
  try {
    const params = { page, pageSize: 50 }
    if (filterAction.value) params.batchAction = filterAction.value
    if (customDate.value) {
      params.startDate = customDate.value
      params.endDate = customDate.value
    } else if (filterPeriod.value) {
      params.period = filterPeriod.value
    }
    const res = await recoveryApi.getBatchLogs(params)
    logs.value = res.data.data || []
    pagination.value = res.data.pagination || { total: 0, page: 1, pageSize: 50, totalPages: 1 }
  } catch (err) {
    error.value = '데이터를 불러오지 못했습니다'
    console.error('Batch logs fetch error:', err)
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  customDate.value = null
  fetchLogs(1)
}

function handleHeatmapDateSelect(date) {
  if (date) {
    customDate.value = date
  } else {
    customDate.value = null
  }
  fetchLogs(1)
}

function handlePageChange(page) {
  fetchLogs(page)
}

// ── 모달 표시 감시 ──
watch(() => props.visible, async (val) => {
  if (val) {
    await nextTick()
    centerModal()
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    fetchLogs(1)
  } else {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

const periodLabel = computed(() => {
  if (customDate.value) return customDate.value
  return { today: '오늘', '7d': '7일', '30d': '30일' }[filterPeriod.value] || filterPeriod.value
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40" @click="emit('close')" />

      <!-- Modal -->
      <div
        ref="modalRef"
        class="fixed bg-white dark:bg-dark-card rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col overflow-hidden"
        :style="modalStyle"
      >
        <!-- Header (draggable) -->
        <div
          class="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-dark-border cursor-grab active:cursor-grabbing select-none shrink-0"
          @mousedown="startDrag"
        >
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span class="text-base font-bold text-gray-900 dark:text-white">배치 실행 이력</span>
          </div>
          <button
            @click="emit('close')"
            class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto">
          <!-- Heatmap Section -->
          <div class="px-5 py-4 border-b border-gray-100 dark:border-dark-border">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-semibold text-gray-600 dark:text-gray-300">배치 실행 현황</span>
              <div class="flex gap-1">
                <button
                  v-for="d in [30, 60, 90]"
                  :key="d"
                  @click="heatmapDays = d"
                  :class="[
                    'px-2.5 py-0.5 text-xs rounded border transition-colors',
                    heatmapDays === d
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700'
                      : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-border'
                  ]"
                >
                  {{ d }}일
                </button>
              </div>
            </div>
            <BatchHeatmap :days="heatmapDays" @select-date="handleHeatmapDateSelect" />
          </div>

          <!-- Filter Bar -->
          <div class="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-dark-border">
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-gray-500 dark:text-gray-400">유형:</span>
              <select
                v-model="filterAction"
                @change="handleFilterChange"
                class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300"
              >
                <option value="">전체</option>
                <option value="cron_completed">Cron 완료</option>
                <option value="cron_skipped">Cron Skip</option>
                <option value="backfill_started">Backfill 시작</option>
                <option value="backfill_completed">Backfill 완료</option>
                <option value="backfill_cancelled">Backfill 취소</option>
                <option value="auto_backfill_completed">Auto Backfill</option>
              </select>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-gray-500 dark:text-gray-400">기간:</span>
              <select
                v-model="filterPeriod"
                @change="handleFilterChange"
                :disabled="!!customDate"
                class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 disabled:opacity-50"
              >
                <option value="today">오늘</option>
                <option value="7d">7일</option>
                <option value="30d">30일</option>
              </select>
              <span v-if="customDate" class="text-xs text-blue-500">
                {{ customDate }}
                <button @click="customDate = null; fetchLogs(1)" class="ml-1 text-gray-400 hover:text-gray-600">✕</button>
              </span>
            </div>
            <div class="flex-1" />
            <span class="text-xs text-gray-500 dark:text-gray-400">총 {{ pagination.total }}건</span>
          </div>

          <!-- Table -->
          <div class="px-5 pb-4">
            <!-- Loading -->
            <div v-if="loading" class="flex justify-center py-8">
              <svg class="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>

            <!-- Error -->
            <div v-else-if="error" class="text-center py-8">
              <p class="text-sm text-red-500 mb-2">{{ error }}</p>
              <button @click="fetchLogs(pagination.page)" class="text-xs text-blue-500 hover:underline">재시도</button>
            </div>

            <!-- Empty -->
            <div v-else-if="logs.length === 0" class="text-center py-8">
              <p class="text-sm text-gray-400 dark:text-gray-500">조건에 맞는 이력이 없습니다</p>
            </div>

            <!-- Data Table -->
            <table v-else class="w-full text-sm">
              <thead>
                <tr class="border-b-2 border-gray-200 dark:border-dark-border text-left">
                  <th class="py-2.5 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">시각</th>
                  <th class="py-2.5 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">유형</th>
                  <th class="py-2.5 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">주기</th>
                  <th class="py-2.5 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">실행자</th>
                  <th class="py-2.5 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">상세</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="log in logs"
                  :key="log._id"
                  class="border-b border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-border/50"
                  :class="log.batchAction === 'cron_skipped' ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''"
                >
                  <td class="py-2 px-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{{ formatTimestamp(log.timestamp) }}</td>
                  <td class="py-2 px-2">
                    <span
                      :class="[getActionBadge(log.batchAction).bg, getActionBadge(log.batchAction).text, 'px-2 py-0.5 rounded-full text-xs font-medium']"
                    >
                      {{ getActionBadge(log.batchAction).label }}
                    </span>
                  </td>
                  <td class="py-2 px-2">
                    <span v-if="log.batchPeriod" class="px-1.5 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      {{ log.batchPeriod }}
                    </span>
                    <span v-else class="text-gray-400">—</span>
                  </td>
                  <td class="py-2 px-2">
                    <span :class="log.userId !== 'system' ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'">
                      {{ log.userId }}
                    </span>
                  </td>
                  <td class="py-2 px-2 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate" :title="JSON.stringify({ params: log.batchParams, result: log.batchResult }, null, 2)">
                    {{ formatDetail(log) }}
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Pagination -->
            <div v-if="pagination.totalPages > 1" class="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-dark-border">
              <button
                :disabled="!pagination.hasPrevPage"
                @click="handlePageChange(pagination.page - 1)"
                class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-dark-border"
              >
                이전
              </button>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ pagination.page }} / {{ pagination.totalPages }}
              </span>
              <button
                :disabled="!pagination.hasNextPage"
                @click="handlePageChange(pagination.page + 1)"
                class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-dark-border"
              >
                다음
              </button>
            </div>
          </div>
        </div>

        <!-- Resize Handle -->
        <div
          class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          @mousedown="startResize"
        >
          <svg class="w-3 h-3 text-gray-300 dark:text-gray-600 absolute bottom-1 right-1" viewBox="0 0 6 6">
            <circle cx="5" cy="1" r="0.7" fill="currentColor" />
            <circle cx="5" cy="5" r="0.7" fill="currentColor" />
            <circle cx="1" cy="5" r="0.7" fill="currentColor" />
          </svg>
        </div>
      </div>
    </div>
  </Teleport>
</template>
```

- [ ] **Step 15: Commit**

```bash
git add client/src/features/dashboard/components/BatchHistoryModal.vue
git commit -m "feat: BatchHistoryModal 컴포넌트 (필터+테이블+페이지네이션)"
```

---

## Task 6: Client — RecoveryOverviewView 통합

**Files:**
- Modify: `client/src/features/dashboard/RecoveryOverviewView.vue`

- [ ] **Step 16: Add import and ref**

`RecoveryOverviewView.vue` `<script setup>` 섹션에서:

1. import 추가 (line 14, `RecoveryBackfillModal` import 아래):
```javascript
import BatchHistoryModal from './components/BatchHistoryModal.vue'
```

2. ref 추가 (line 23, `backfillModalVisible` 아래):
```javascript
const batchHistoryVisible = ref(false)
```

- [ ] **Step 17: Add button to template**

`RecoveryOverviewView.vue` 템플릿에서 Backfill 버튼(line 116) 바로 앞에 배치 이력 버튼 추가:

```html
          <!-- Batch History (Admin only) -->
          <button
            v-if="isAdmin"
            @click="batchHistoryVisible = true"
            class="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg transition-colors"
            title="배치 이력"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
```

- [ ] **Step 18: Add modal component to template**

`RecoveryBackfillModal` 컴포넌트(line 198) 아래에 추가:

```html
    <!-- Batch History Modal -->
    <BatchHistoryModal
      :visible="batchHistoryVisible"
      @close="batchHistoryVisible = false"
    />
```

- [ ] **Step 19: Commit**

```bash
git add client/src/features/dashboard/RecoveryOverviewView.vue
git commit -m "feat: Recovery Overview에 배치 이력 버튼 + 모달 통합"
```

---

## Task 7: 통합 검증

- [ ] **Step 20: Run all server tests**

Run: `cd server && npx vitest run features/recovery/`
Expected: ALL PASS

- [ ] **Step 21: Start dev servers and verify UI**

Run: `cd /Users/hyunkyungmin/Developer/ARS/WebManager && npm run dev`

수동 검증:
1. Recovery Overview 페이지 이동
2. Admin 계정으로 로그인 — "배치 이력" 아이콘 버튼이 DataFreshness 옆에 표시
3. 버튼 클릭 → BatchHistoryModal 열림
4. 히트맵 30/60/90일 전환
5. 히트맵 셀 클릭 → 테이블 필터링
6. 유형/기간 드롭다운 필터
7. 페이지네이션 (데이터 50건 이상 시)
8. 다크 모드 전환
9. 모달 드래그/리사이즈
10. 비-Admin 계정 — 버튼 미표시

- [ ] **Step 22: Final commit (if any fixes)**

```bash
git add -A && git commit -m "fix: Batch History UI 통합 검증 수정"
```
