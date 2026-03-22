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
          <!-- Index Warning -->
          <div v-if="indexWarning" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
            <strong>EQP_AUTO_RECOVERY 인덱스 미확인</strong>
            <p class="mt-1 text-xs">create_date 인덱스가 없으면 full collection scan이 발생하여 DB에 심각한 부하를 줄 수 있습니다. 서버 관리자에게 인덱스 생성을 요청하세요.</p>
          </div>

          <!-- Settings Form -->
          <div class="space-y-3" :class="{ 'opacity-50 pointer-events-none': serverStatus === 'running' }">
            <div class="flex flex-wrap items-center gap-3">
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">기간</label>
                <select
                  v-model="selectedPeriod"
                  class="px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-card text-gray-900 dark:text-white"
                >
                  <option v-for="opt in periodOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">시작일</label>
                <input type="date" v-model="startDate" :disabled="selectedPeriod !== 'custom'" class="px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-card text-gray-900 dark:text-white disabled:opacity-50" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">종료일</label>
                <div class="flex items-center gap-1">
                  <input type="date" v-model="endDate" :disabled="selectedPeriod !== 'custom'" class="px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-card text-gray-900 dark:text-white disabled:opacity-50" />
                  <button
                    v-if="selectedPeriod !== 'custom'"
                    @click="shiftPeriod(-1)"
                    class="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-dark-border rounded transition-colors"
                    title="이전 기간"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <button
                    v-if="selectedPeriod !== 'custom'"
                    @click="shiftPeriod(1)"
                    class="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-dark-border rounded transition-colors"
                    title="다음 기간"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
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
                  <span class="text-amber-600 dark:text-amber-400">
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
            <p v-if="analysisResult.settlingInfo" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
              ⚠ settling 기간({{ analysisResult.settlingInfo.settlingHours }}시간) 적용:
              요청 종료일 {{ analysisResult.settlingInfo.requestedEnd.slice(0, 16).replace('T', ' ') }}
              → 실제 {{ analysisResult.settlingInfo.effectiveEnd.slice(0, 16).replace('T', ' ') }}
            </p>
          </div>

          <!-- Distribution Chart -->
          <div class="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 space-y-2">
            <h4 class="font-medium text-sm text-gray-700 dark:text-gray-300">배치 실행 결과 분포</h4>
            <div v-if="distributionLoading" class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 120px">
              로딩 중...
            </div>
            <VChart
              v-else-if="distributionChartOption"
              :option="distributionChartOption"
              autoresize
              style="width: 100%; height: 200px"
            />
            <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 120px">
              배치 실행 이력이 없습니다
            </div>
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
import { useToast } from '../../../shared/composables/useToast'
import { useTheme } from '../../../shared/composables/useTheme'
import { useResizableModal } from '../../../shared/composables/useResizableModal'
import { useRecoveryPeriod, localDateStr } from '../composables/useRecoveryPeriod'
import { useBackfillExecution } from '../composables/useBackfillExecution'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([BarChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['close'])
const { showError } = useToast()
const { isDark } = useTheme()

// ── Form State ──
const BACKFILL_PERIOD_DAYS = { today: 1, '7d': 7, '30d': 30, '90d': 90 }
const {
  selectedPeriod, startDate, endDate,
  shiftPeriod
} = useRecoveryPeriod({
  periodDays: BACKFILL_PERIOD_DAYS,
  onShifted: () => { analysisResult.value = null; fetchDistribution() },
  maxDays: 730
})
const periodOptions = [
  { value: 'today', label: '오늘' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: '90d', label: '90일' },
  { value: 'custom', label: '직접 설정' }
]
const skipHourly = ref(false)
const skipDaily = ref(false)
const retryPartial = ref(false)
const throttleMs = ref(1000)
const rangeError = ref('')

const showConfirmDialog = ref(false)

const {
  analyzing, analysisResult, serverState, serverStatus,
  logs, indexWarning,
  distributionLoading, distributionData,
  totalActionable, progressPercent, elapsed, eta,
  statusLabel, statusBadgeClass,
  handleAnalyze: _handleAnalyze, handleStart: _handleStart, handleCancel,
  startPolling, stopPolling, fetchStatus, fetchDistribution: _fetchDistribution,
  pct, formatBucket, formatDuration, formatDistributionLabel
} = useBackfillExecution({
  getFormValues: () => ({
    startDate: startDate.value,
    endDate: endDate.value,
    skipHourly: skipHourly.value,
    skipDaily: skipDaily.value,
    throttleMs: throttleMs.value,
    retryPartial: retryPartial.value
  }),
  showError
})

// ── Date defaults (Backfill: today → exclusive end) ──
function applyPeriodDates(period) {
  if (period === 'custom') return
  const now = new Date()
  endDate.value = localDateStr(now)
  const start = new Date(now)
  if (period === 'today') {
    startDate.value = endDate.value
    // Backfill API requires start < end, so push end +1 day
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    endDate.value = localDateStr(tomorrow)
  } else {
    const days = BACKFILL_PERIOD_DAYS[period]
    if (days) {
      start.setDate(start.getDate() - days)
      startDate.value = localDateStr(start)
    }
  }
}

// ── Validation ──
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

// ── Analyze (with validation) ──
async function handleAnalyze() {
  if (!validateRange()) return
  await _handleAnalyze()
}

// ── Start Backfill ──
async function handleStart() {
  showConfirmDialog.value = false
  await _handleStart()
}

function fetchDistribution() {
  const period = selectedPeriod.value === 'custom' ? '90d' : selectedPeriod.value
  _fetchDistribution(period, startDate.value, endDate.value)
}

const distributionChartOption = computed(() => {
  if (!distributionData.value || !distributionData.value.data?.length) return null

  const { granularity, data } = distributionData.value
  const textColor = isDark.value ? '#9ca3af' : '#6b7280'
  const borderColor = isDark.value ? '#374151' : '#e5e7eb'

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter(params) {
        const bucket = params[0]?.axisValue || ''
        let html = `<div style="font-weight:600;margin-bottom:4px">${bucket}</div>`
        let total = 0
        for (const p of params) {
          if (p.value > 0) {
            html += `<div>${p.marker} ${p.seriesName}: <b>${p.value}</b></div>`
          }
          total += p.value
        }
        html += `<div style="margin-top:4px;border-top:1px solid ${borderColor};padding-top:4px">Total: <b>${total}</b></div>`
        return html
      }
    },
    legend: {
      top: 0,
      textStyle: { color: textColor, fontSize: 11 }
    },
    grid: { left: 40, right: 12, top: 28, bottom: 24 },
    xAxis: {
      type: 'category',
      data: data.map(d => formatDistributionLabel(d.bucket, granularity)),
      axisLabel: { color: textColor, fontSize: 10, rotate: data.length > 15 ? 45 : 0 },
      axisLine: { lineStyle: { color: borderColor } }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: textColor, fontSize: 10 },
      splitLine: { lineStyle: { color: borderColor, type: 'dashed' } }
    },
    series: [
      {
        name: 'Success',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.success),
        itemStyle: { color: '#22c55e' },
        barMaxWidth: 20
      },
      {
        name: 'Partial',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.partial),
        itemStyle: { color: '#f59e0b' },
        barMaxWidth: 20
      },
      {
        name: 'Failed',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.failed),
        itemStyle: { color: '#ef4444' },
        barMaxWidth: 20
      },
      {
        name: 'Pending',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.pending),
        itemStyle: { color: isDark.value ? '#4b5563' : '#d1d5db' },
        barMaxWidth: 20
      }
    ]
  }
})

watch(selectedPeriod, (val) => {
  applyPeriodDates(val)
  analysisResult.value = null
  fetchDistribution()
})

// ── Modal drag/resize ──
const modalRef = ref(null)
const {
  modalStyle, startDrag, startResize, center: centerModal
} = useResizableModal(modalRef, { defaultWidth: 640, defaultHeight: 700, minWidth: 480, minHeight: 500 })

// ── Lifecycle ──
watch(() => props.visible, (val) => {
  if (val) {
    centerModal()
    if (!startDate.value) applyPeriodDates(selectedPeriod.value)
    fetchDistribution()
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
    applyPeriodDates(selectedPeriod.value)
    fetchDistribution()
    fetchStatus().then(() => {
      if (serverStatus.value === 'running') startPolling()
    })
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>
