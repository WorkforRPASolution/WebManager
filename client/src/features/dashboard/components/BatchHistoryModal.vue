<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { recoveryApi } from '../../../shared/api'
import BatchHeatmap from './BatchHeatmap.vue'
import { useResizableModal } from '../../../shared/composables/useResizableModal'

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
const {
  modalStyle, startDrag, startResize, center: centerModal
} = useResizableModal(modalRef, { defaultWidth: 720, defaultHeight: 600, minWidth: 560, minHeight: 480 })

// ── 유형 뱃지 ──
const ACTION_LABELS = {
  cron_completed: { label: 'Cron 완료', bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' },
  cron_skipped: { label: 'Cron Skip', bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300' },
  cron_failed: { label: 'Cron 실패', bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300' },
  backfill_started: { label: 'Backfill 시작', bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300' },
  backfill_completed: { label: 'Backfill 완료', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  backfill_cancelled: { label: 'Backfill 취소', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' },
  auto_backfill_completed: { label: 'Auto Backfill', bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300' }
}

function getActionBadge(action) {
  return ACTION_LABELS[action] || { label: action, bg: 'bg-gray-100', text: 'text-gray-600' }
}

// ── skip reason 한글 매핑 ──
const SKIP_REASONS = {
  indexNotReady: '인덱스 미확인',
  distributedLock: '다른 Pod에서 실행 중',
  isRunning: '이전 실행 진행 중',
  alreadyCompleted: '이미 완료된 bucket'
}

// ── 상세 축약 ──
function formatDetail(log) {
  const p = log.batchParams || {}
  const r = log.batchResult || {}
  switch (log.batchAction) {
    case 'cron_completed':
      return `status: ${r.status || '-'}, bucket: ${p.bucket ? new Date(p.bucket).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}`
    case 'cron_skipped':
      return SKIP_REASONS[p.reason] || p.reason || '-'
    case 'cron_failed':
      return p.error || '-'
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
    fetchLogs(1)
  }
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
                <option value="cron_failed">Cron 실패</option>
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
                  <th class="py-2.5 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Pod</th>
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
                    <span v-if="log.podId" class="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-mono">
                      {{ log.podId }}
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
