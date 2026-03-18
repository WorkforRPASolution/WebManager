<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40" @click="$emit('close')"></div>

      <!-- Modal -->
      <div
        ref="modalRef"
        class="fixed bg-white dark:bg-dark-card rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col overflow-hidden"
        :style="modalStyle"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0 select-none cursor-move"
          @mousedown="startDrag"
        >
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <h3 class="font-medium text-gray-900 dark:text-white">Recovery Backfill</h3>
            <span class="px-2 py-0.5 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full">Admin</span>
          </div>
          <button
            @click="$emit('close')"
            @mousedown.stop
            class="p-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- Settings Form -->
          <div class="space-y-3" :class="{ 'opacity-50 pointer-events-none': serverStatus === 'running' }">
            <div class="flex flex-wrap items-center gap-3">
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">시작일</label>
                <input type="date" v-model="startDate" class="px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-card text-gray-900 dark:text-white" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">종료일</label>
                <input type="date" v-model="endDate" class="px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-card text-gray-900 dark:text-white" />
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-4">
              <label class="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" v-model="skipHourly" class="rounded" />
                Hourly 건너뛰기
              </label>
              <label class="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" v-model="skipDaily" class="rounded" />
                Daily 건너뛰기
              </label>
              <label class="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" v-model="retryPartial" class="rounded" />
                Partial 재처리
              </label>
            </div>

            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Throttle: {{ (throttleMs / 1000).toFixed(1) }}초
              </label>
              <input type="range" v-model.number="throttleMs" min="0" max="5000" step="500"
                class="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer" />
              <p v-if="throttleMs === 0" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                ⚠ DB 부하가 높아질 수 있습니다
              </p>
            </div>

            <p v-if="rangeError" class="text-xs text-red-500">{{ rangeError }}</p>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2">
            <button
              @click="handleAnalyze"
              :disabled="analyzing || serverStatus === 'running'"
              class="px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {{ analyzing ? '분석 중...' : '분석' }}
            </button>
            <button
              v-if="analysisResult"
              @click="showConfirmDialog = true"
              :disabled="serverStatus === 'running' || totalActionable === 0"
              class="px-4 py-1.5 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Backfill 실행 ({{ totalActionable }}건)
            </button>
            <button
              v-if="serverStatus === 'running'"
              @click="handleCancel"
              class="px-4 py-1.5 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
            >
              취소
            </button>
          </div>

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

          <!-- Progress Section -->
          <div v-if="serverStatus && serverStatus !== 'idle'" class="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 space-y-2 text-sm">
            <div class="flex items-center justify-between">
              <h4 class="font-medium text-gray-700 dark:text-gray-300">진행 상태</h4>
              <span :class="statusBadgeClass">{{ statusLabel }}</span>
            </div>

            <!-- Progress bar -->
            <div v-if="serverState.total > 0" class="space-y-1">
              <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :class="serverStatus === 'error' ? 'bg-red-500' : serverStatus === 'cancelled' ? 'bg-yellow-500' : 'bg-blue-500'"
                  :style="{ width: `${progressPercent}%` }"
                ></div>
              </div>
              <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{{ progressPercent }}% ({{ serverState.current }}/{{ serverState.total }})</span>
                <span v-if="serverState.skipped > 0">skipped: {{ serverState.skipped }}</span>
              </div>
            </div>

            <!-- Current bucket -->
            <div v-if="serverState.currentBucket" class="text-xs text-gray-500 dark:text-gray-400">
              현재: {{ serverState.period }} {{ formatBucket(serverState.currentBucket) }}
            </div>

            <!-- Elapsed / ETA -->
            <div v-if="serverState.startedAt" class="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>경과: {{ elapsed }}</span>
              <span v-if="serverStatus === 'running' && eta">예상 잔여: {{ eta }}</span>
            </div>

            <!-- Errors -->
            <div v-if="serverState.errors && serverState.errors.length > 0" class="mt-2">
              <details class="text-xs">
                <summary class="cursor-pointer text-red-500">에러 {{ serverState.errors.length }}건</summary>
                <div class="mt-1 max-h-32 overflow-y-auto space-y-0.5">
                  <div v-for="(err, i) in serverState.errors.slice(0, 20)" :key="i" class="text-red-400">
                    {{ err.period }} {{ err.bucket || '' }}: {{ err.error }}
                  </div>
                </div>
              </details>
            </div>
          </div>

          <!-- Log Section -->
          <div v-if="logs.length > 0" class="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 text-xs">
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-1">최근 로그</h4>
            <div class="max-h-40 overflow-y-auto font-mono space-y-0.5">
              <div v-for="(log, i) in logs.slice(-30)" :key="i" :class="log.includes('✓') ? 'text-green-600 dark:text-green-400' : log.includes('⚠') ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'">
                {{ log }}
              </div>
            </div>
          </div>
        </div>

        <!-- Resize handle -->
        <div
          class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          @mousedown.stop.prevent="startResize"
        >
          <svg class="w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="12" cy="12" r="1.5" /><circle cx="8" cy="12" r="1.5" /><circle cx="12" cy="8" r="1.5" />
          </svg>
        </div>
      </div>

      <!-- Confirm Dialog -->
      <div v-if="showConfirmDialog" class="fixed inset-0 z-[60] flex items-center justify-center">
        <div class="absolute inset-0 bg-black/30" @click="showConfirmDialog = false"></div>
        <div class="relative bg-white dark:bg-dark-card rounded-xl shadow-xl border border-gray-200 dark:border-dark-border p-6 max-w-sm mx-4">
          <h4 class="font-medium text-gray-900 dark:text-white mb-2">Backfill 실행 확인</h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {{ totalActionable.toLocaleString() }}건 {{ retryPartial ? '(partial 재처리)' : '' }} 처리,
            예상 ~{{ formatDuration(analysisResult?.estimatedMinutes) }}.
            실행하시겠습니까?
          </p>
          <div class="flex justify-end gap-2">
            <button @click="showConfirmDialog = false" class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-bg transition">
              취소
            </button>
            <button @click="handleStart" class="px-3 py-1.5 text-sm rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition">
              실행
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { recoveryApi } from '../../../shared/api'
import { useToast } from '../../../shared/composables/useToast'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['close'])
const { showError } = useToast()

// ── Form State ──
const startDate = ref('')
const endDate = ref('')
const skipHourly = ref(false)
const skipDaily = ref(false)
const retryPartial = ref(false)
const throttleMs = ref(1000)
const rangeError = ref('')

// ── Analysis ──
const analyzing = ref(false)
const analysisResult = ref(null)

// ── Server State ──
const serverState = ref({
  status: 'idle', current: 0, total: 0, skipped: 0,
  period: null, currentBucket: null, startedAt: null, completedAt: null, errors: []
})
const serverStatus = computed(() => serverState.value.status)

// ── UI State ──
const showConfirmDialog = ref(false)
const logs = ref([])
let pollTimer = null
let pollFailCount = 0
let lastBucket = null

// ── Date defaults ──
function initDates() {
  const now = new Date()
  const end = new Date(now)
  end.setDate(end.getDate())
  const start = new Date(now)
  start.setDate(start.getDate() - 7)
  endDate.value = end.toISOString().slice(0, 10)
  startDate.value = start.toISOString().slice(0, 10)
}

// ── Validation ──
const totalActionable = computed(() => {
  if (!analysisResult.value) return 0
  let total = 0
  if (analysisResult.value.hourly) total += analysisResult.value.hourly.actionable
  if (analysisResult.value.daily) total += analysisResult.value.daily.actionable
  return total
})

function validateRange() {
  rangeError.value = ''
  if (!startDate.value || !endDate.value) {
    rangeError.value = '시작일과 종료일을 입력하세요'
    return false
  }
  const s = new Date(startDate.value)
  const e = new Date(endDate.value)
  if (s >= e) {
    rangeError.value = '시작일은 종료일보다 이전이어야 합니다'
    return false
  }
  const diffDays = (e - s) / (1000 * 60 * 60 * 24)
  if (diffDays > 730) {
    rangeError.value = '최대 2년(730일)까지 설정 가능합니다'
    return false
  }
  return true
}

// ── Analyze ──
async function handleAnalyze() {
  if (!validateRange()) return
  analyzing.value = true
  analysisResult.value = null
  try {
    const res = await recoveryApi.analyzeBackfill({
      startDate: startDate.value,
      endDate: endDate.value,
      skipHourly: skipHourly.value,
      skipDaily: skipDaily.value,
      throttleMs: throttleMs.value,
      retryPartial: retryPartial.value
    })
    analysisResult.value = res.data
  } catch (err) {
    showError(err.response?.data?.error || '분석 실패')
  } finally {
    analyzing.value = false
  }
}

// ── Start Backfill ──
async function handleStart() {
  showConfirmDialog.value = false
  logs.value = []
  lastBucket = null
  try {
    await recoveryApi.startBackfill({
      startDate: startDate.value,
      endDate: endDate.value,
      skipHourly: skipHourly.value,
      skipDaily: skipDaily.value,
      throttleMs: throttleMs.value,
      retryPartial: retryPartial.value
    })
    startPolling()
  } catch (err) {
    if (err.response?.status === 409) {
      showError('이미 실행 중입니다')
      startPolling()
    } else {
      showError(err.response?.data?.error || 'Backfill 시작 실패')
    }
  }
}

// ── Cancel ──
async function handleCancel() {
  try {
    await recoveryApi.cancelBackfill()
  } catch {
    showError('취소 요청 실패')
  }
}

// ── Polling ──
function startPolling() {
  stopPolling()
  pollFailCount = 0
  fetchStatus()
  pollTimer = setInterval(fetchStatus, 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function fetchStatus() {
  try {
    const res = await recoveryApi.getBackfillStatus()
    serverState.value = res.data
    pollFailCount = 0

    // Log tracking
    const currentBucket = res.data.currentBucket
    if (currentBucket && currentBucket !== lastBucket) {
      const time = new Date().toLocaleTimeString('ko-KR', { hour12: false })
      const symbol = res.data.status === 'error' ? '✗' : '✓'
      logs.value.push(`[${time}] ${res.data.period} ${formatBucket(currentBucket)} ${symbol}`)
      if (logs.value.length > 100) logs.value.shift()
      lastBucket = currentBucket
    }

    // Stop polling when done
    if (['completed', 'cancelled', 'error', 'idle'].includes(res.data.status)) {
      stopPolling()
    }
  } catch {
    pollFailCount++
    if (pollFailCount >= 3) {
      stopPolling()
      showError('상태 조회 실패. 재시도하려면 분석을 다시 실행하세요.')
    }
  }
}

// ── Formatting ──
function pct(value, total) {
  if (!total) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

function formatBucket(bucket) {
  if (!bucket) return ''
  const d = new Date(bucket)
  return d.toISOString().replace('T', ' ').slice(0, 16)
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0분'
  if (minutes < 60) return `${Math.round(minutes)}분`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`
}

function formatElapsed(startedAt) {
  if (!startedAt) return ''
  const elapsed = Date.now() - new Date(startedAt).getTime()
  const sec = Math.floor(elapsed / 1000)
  const min = Math.floor(sec / 60)
  const remSec = sec % 60
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const remMin = min % 60
    return `${h}시간 ${remMin}분 ${remSec}초`
  }
  return `${min}분 ${remSec}초`
}

const elapsed = computed(() => formatElapsed(serverState.value.startedAt))

const eta = computed(() => {
  const s = serverState.value
  if (!s.startedAt || s.current <= s.skipped) return ''
  const elapsedMs = Date.now() - new Date(s.startedAt).getTime()
  const processed = s.current - s.skipped
  if (processed <= 0) return ''
  const remaining = s.total - s.current
  const etaMs = (elapsedMs / processed) * remaining
  return formatDuration(etaMs / 60000)
})

const progressPercent = computed(() => {
  const s = serverState.value
  if (s.total <= 0) return 0
  return Math.round((s.current / s.total) * 100)
})

const statusLabel = computed(() => {
  const map = { idle: '대기', running: '실행 중', completed: '완료', cancelled: '취소됨', error: '오류' }
  return map[serverStatus.value] || serverStatus.value
})

const statusBadgeClass = computed(() => {
  const base = 'px-2 py-0.5 text-xs font-medium rounded-full'
  const map = {
    idle: `${base} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`,
    running: `${base} bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400`,
    completed: `${base} bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400`,
    cancelled: `${base} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400`,
    error: `${base} bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400`
  }
  return map[serverStatus.value] || map.idle
})

// ── Modal drag/resize (simplified from RecoveryHistoryModal pattern) ──
const modalRef = ref(null)
const pos = ref({ x: 0, y: 0 })
const size = ref({ w: 640, h: 560 })
let dragState = null

const modalStyle = computed(() => ({
  left: `${pos.value.x}px`,
  top: `${pos.value.y}px`,
  width: `${size.value.w}px`,
  height: `${size.value.h}px`,
  maxWidth: '95vw',
  maxHeight: '95vh'
}))

function centerModal() {
  pos.value = {
    x: Math.max(0, (window.innerWidth - size.value.w) / 2),
    y: Math.max(0, (window.innerHeight - size.value.h) / 2)
  }
}

function startDrag(e) {
  if (e.target.closest('button')) return
  dragState = { mode: 'drag', startX: e.clientX - pos.value.x, startY: e.clientY - pos.value.y }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function startResize(e) {
  dragState = { mode: 'resize', startX: e.clientX, startY: e.clientY, startW: size.value.w, startH: size.value.h }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e) {
  if (!dragState) return
  if (dragState.mode === 'drag') {
    pos.value = {
      x: Math.max(0, e.clientX - dragState.startX),
      y: Math.max(0, e.clientY - dragState.startY)
    }
  } else {
    size.value = {
      w: Math.max(480, dragState.startW + e.clientX - dragState.startX),
      h: Math.max(400, dragState.startH + e.clientY - dragState.startY)
    }
  }
}

function onMouseUp() {
  dragState = null
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

// ── Lifecycle ──
watch(() => props.visible, (val) => {
  if (val) {
    centerModal()
    if (!startDate.value) initDates()
    // Check existing running state
    fetchStatus().then(() => {
      if (serverStatus.value === 'running') startPolling()
    })
  } else {
    stopPolling()
  }
})

onMounted(() => {
  if (props.visible) {
    centerModal()
    initDates()
    fetchStatus().then(() => {
      if (serverStatus.value === 'running') startPolling()
    })
  }
})

onUnmounted(() => {
  stopPolling()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
</script>
