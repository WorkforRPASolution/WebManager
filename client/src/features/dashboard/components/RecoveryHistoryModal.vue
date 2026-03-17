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
        <!-- Header with drag handle -->
        <div
          class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0 select-none"
          :class="{ 'cursor-move': !isMaximized }"
          @mousedown="startDrag"
          @dblclick="toggleMaximize"
        >
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 class="font-medium text-gray-900 dark:text-white">이력 조회 - {{ targetId }}</h3>
            <span class="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">LIVE</span>
          </div>
          <div class="flex items-center gap-1">
            <!-- Maximize/Restore -->
            <button
              @click="toggleMaximize"
              @mousedown.stop
              class="p-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              :title="isMaximized ? 'Restore' : 'Maximize'"
            >
              <svg v-if="!isMaximized" class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="2" width="12" height="12" rx="1" />
              </svg>
              <svg v-else class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="4" y="1" width="11" height="11" rx="1" />
                <rect x="1" y="4" width="11" height="11" rx="1" />
              </svg>
            </button>
            <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
            <button
              @click="$emit('close')"
              @mousedown.stop
              class="p-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              title="Close"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="px-4 py-2 border-b border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg/50 flex flex-wrap gap-2 items-center shrink-0">
          <!-- Period -->
          <label class="text-xs text-gray-500 dark:text-gray-400">기간</label>
          <input
            type="date"
            v-model="startDate"
            class="px-2 py-1 text-sm border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-card text-gray-900 dark:text-white"
          />
          <span class="text-gray-400">~</span>
          <input
            type="date"
            v-model="endDate"
            class="px-2 py-1 text-sm border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-card text-gray-900 dark:text-white"
          />

          <!-- Status multiselect -->
          <label class="text-xs text-gray-500 dark:text-gray-400 ml-2">Status</label>
          <div class="flex items-center gap-1">
            <label
              v-for="st in statusOptions"
              :key="st"
              class="inline-flex items-center gap-1 text-xs cursor-pointer select-none"
            >
              <input
                type="checkbox"
                :value="st"
                v-model="selectedStatuses"
                class="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-dark-card"
              />
              <span class="text-gray-700 dark:text-gray-300">{{ st }}</span>
            </label>
          </div>

          <!-- Secondary filter -->
          <label class="text-xs text-gray-500 dark:text-gray-400 ml-2">
            {{ mode === 'eqpid' ? 'ears_code' : 'eqpid' }}
          </label>
          <input
            v-model="secondaryFilter"
            :placeholder="mode === 'eqpid' ? 'ears_code 검색' : 'eqpid 검색'"
            class="px-2 py-1 text-sm border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-card text-gray-900 dark:text-white w-36"
          />

          <button
            @click="fetchHistory"
            :disabled="historyLoading"
            class="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="historyLoading">조회 중...</span>
            <span v-else>조회</span>
          </button>
        </div>

        <!-- Table -->
        <div class="flex-1 overflow-auto px-4 py-2">
          <!-- Loading -->
          <div v-if="historyLoading" class="flex items-center justify-center py-16">
            <svg class="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>

          <!-- Empty -->
          <div v-else-if="historyData.length === 0" class="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">
            조회 결과가 없습니다. 조건을 변경하여 조회해 주세요.
          </div>

          <!-- Data table -->
          <table v-else class="w-full text-sm">
            <thead class="sticky top-0 bg-white dark:bg-dark-card z-10">
              <tr class="border-b border-gray-200 dark:border-dark-border">
                <th class="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">create_date</th>
                <th v-if="mode === 'eqpid'" class="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">ears_code</th>
                <th v-else class="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">eqpid</th>
                <th class="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">status</th>
                <th class="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">trigger_by</th>
                <th class="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">retry</th>
                <th class="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">process</th>
                <th class="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">model</th>
                <th class="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">line</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in historyData"
                :key="idx"
                class="border-b border-gray-100 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-dark-border/30 transition-colors"
              >
                <td class="py-2 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{{ formatDate(row.create_date) }}</td>
                <td v-if="mode === 'eqpid'" class="py-2 px-3 text-gray-700 dark:text-gray-300">{{ row.ears_code }}</td>
                <td v-else class="py-2 px-3 text-gray-700 dark:text-gray-300">{{ row.eqpid }}</td>
                <td class="py-2 px-3">
                  <span
                    class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="statusBadgeClass(row.status)"
                  >
                    {{ row.status }}
                  </span>
                </td>
                <td class="py-2 px-3 text-gray-700 dark:text-gray-300">{{ row.trigger_by }}</td>
                <td class="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{{ row.retry }}</td>
                <td class="py-2 px-3 text-gray-700 dark:text-gray-300">{{ row.process }}</td>
                <td class="py-2 px-3 text-gray-700 dark:text-gray-300">{{ row.model }}</td>
                <td class="py-2 px-3 text-gray-700 dark:text-gray-300">{{ row.line }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer: Pagination + CSV -->
        <div class="px-4 py-2 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg flex items-center justify-between shrink-0">
          <div class="text-sm text-gray-500 dark:text-gray-400">{{ total }} 건</div>
          <div class="flex items-center gap-3">
            <!-- Page size -->
            <select
              v-model.number="pageSize"
              @change="fetchHistory"
              class="text-sm border border-gray-300 dark:border-dark-border rounded px-2 py-1 bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300"
            >
              <option :value="20">20건</option>
              <option :value="50">50건</option>
              <option :value="100">100건</option>
            </select>

            <!-- Page navigation -->
            <div class="flex items-center gap-1">
              <button
                @click="goPage(1)"
                :disabled="page <= 1"
                class="px-2 py-1 text-sm rounded border border-gray-300 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &laquo;
              </button>
              <button
                @click="goPage(page - 1)"
                :disabled="page <= 1"
                class="px-2 py-1 text-sm rounded border border-gray-300 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &lsaquo;
              </button>
              <span class="text-sm text-gray-600 dark:text-gray-400 px-2">
                {{ page }} / {{ totalPages || 1 }}
              </span>
              <button
                @click="goPage(page + 1)"
                :disabled="page >= totalPages"
                class="px-2 py-1 text-sm rounded border border-gray-300 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &rsaquo;
              </button>
              <button
                @click="goPage(totalPages)"
                :disabled="page >= totalPages"
                class="px-2 py-1 text-sm rounded border border-gray-300 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &raquo;
              </button>
            </div>

            <!-- CSV export -->
            <button
              @click="handleExportCsv"
              :disabled="historyData.length === 0"
              class="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-dark-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV 내보내기
            </button>
          </div>
        </div>

        <!-- Resize Handle -->
        <div
          class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          @mousedown="startResize"
        >
          <svg class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22H20V20H22V22ZM22 18H18V22H22V18ZM18 22H14V18H18V22ZM22 14H14V22H22V14Z" />
          </svg>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { recoveryApi } from '../../../shared/api'
import { exportRecoveryHistoryCsv } from '../utils/recoveryCsvExport'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: 'eqpid' },
  targetId: { type: String, default: '' }
})

const emit = defineEmits(['close'])

// Filter state
const statusOptions = ['Success', 'Failed', 'Stopped', 'Skip', 'Other']
const selectedStatuses = ref([])
const secondaryFilter = ref('')

// Date defaults: last 7 days
function getDefaultDates() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  }
}

const startDate = ref('')
const endDate = ref('')

// Pagination
const page = ref(1)
const pageSize = ref(50)
const total = ref(0)
const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)

// Data
const historyData = ref([])
const historyLoading = ref(false)

// Modal drag/resize
const modalRef = ref(null)
const isMaximized = ref(false)
const modalPos = reactive({ x: null, y: null })
const customWidth = ref(null)
const customHeight = ref(null)
const savedPos = reactive({ x: null, y: null, w: null, h: null })

const DEFAULT_WIDTH = 1100
const DEFAULT_HEIGHT = 600

const modalStyle = computed(() => {
  if (isMaximized.value) {
    return {
      left: '2.5vw',
      top: '2.5vh',
      width: '95vw',
      height: '95vh'
    }
  }

  const w = customWidth.value || DEFAULT_WIDTH
  const h = customHeight.value || DEFAULT_HEIGHT

  return {
    left: modalPos.x !== null ? `${modalPos.x}px` : `calc(50vw - ${w / 2}px)`,
    top: modalPos.y !== null ? `${modalPos.y}px` : `calc(50vh - ${h / 2}px)`,
    width: `${w}px`,
    height: `${h}px`,
    maxWidth: '95vw',
    maxHeight: '95vh'
  }
})

// Drag state
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let dragStartPosX = 0
let dragStartPosY = 0

function startDrag(e) {
  if (isMaximized.value) return
  isDragging = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  const rect = modalRef.value.getBoundingClientRect()
  dragStartPosX = rect.left
  dragStartPosY = rect.top
  e.preventDefault()
}

function doDrag(e) {
  if (!isDragging) return
  modalPos.x = Math.max(0, Math.min(window.innerWidth - 100, dragStartPosX + (e.clientX - dragStartX)))
  modalPos.y = Math.max(0, Math.min(window.innerHeight - 50, dragStartPosY + (e.clientY - dragStartY)))
}

function stopDrag() { isDragging = false }

// Resize state
let isResizing = false
let resizeStartX = 0
let resizeStartY = 0
let resizeStartW = 0
let resizeStartH = 0

function startResize(e) {
  isResizing = true
  resizeStartX = e.clientX
  resizeStartY = e.clientY
  const rect = modalRef.value.getBoundingClientRect()
  resizeStartW = rect.width
  resizeStartH = rect.height
  modalPos.x = rect.left
  modalPos.y = rect.top
  e.preventDefault()
}

function doResize(e) {
  if (!isResizing) return
  customWidth.value = Math.max(600, Math.min(window.innerWidth * 0.95, resizeStartW + (e.clientX - resizeStartX)))
  customHeight.value = Math.max(400, Math.min(window.innerHeight * 0.95, resizeStartH + (e.clientY - resizeStartY)))
}

function stopResize() { isResizing = false }

function toggleMaximize() {
  if (isMaximized.value) {
    modalPos.x = savedPos.x
    modalPos.y = savedPos.y
    customWidth.value = savedPos.w
    customHeight.value = savedPos.h
  } else {
    const rect = modalRef.value?.getBoundingClientRect()
    savedPos.x = modalPos.x ?? rect?.left
    savedPos.y = modalPos.y ?? rect?.top
    savedPos.w = customWidth.value
    savedPos.h = customHeight.value
  }
  isMaximized.value = !isMaximized.value
}

// Combined mouse handlers
function onMouseMove(e) {
  doDrag(e)
  doResize(e)
}

function onMouseUp() {
  stopDrag()
  stopResize()
}

function handleKeyDown(e) {
  if (!props.visible) return
  if (e.key === 'Escape') {
    emit('close')
  }
}

// Date validation: max 7 days
function validateDateRange() {
  if (!startDate.value || !endDate.value) return true
  const start = new Date(startDate.value)
  const end = new Date(endDate.value)
  const diff = (end - start) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 7
}

// Fetch history
async function fetchHistory() {
  if (!validateDateRange()) {
    return
  }

  historyLoading.value = true
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value
    }

    if (props.mode === 'eqpid') {
      params.eqpid = props.targetId
    } else {
      params.ears_code = props.targetId
    }

    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value
    if (selectedStatuses.value.length > 0) {
      params.status = selectedStatuses.value.join(',')
    }
    if (secondaryFilter.value) {
      if (props.mode === 'eqpid') {
        params.ears_code = secondaryFilter.value
      } else {
        params.eqpid = secondaryFilter.value
      }
    }

    const res = await recoveryApi.getHistory(params)
    historyData.value = res.data.data || []
    total.value = res.data.total || 0
  } catch (err) {
    console.error('Failed to fetch recovery history:', err)
    historyData.value = []
    total.value = 0
  } finally {
    historyLoading.value = false
  }
}

function goPage(newPage) {
  if (newPage < 1 || newPage > totalPages.value) return
  page.value = newPage
  fetchHistory()
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    })
  } catch {
    return dateStr
  }
}

function statusBadgeClass(status) {
  const s = (status || '').toLowerCase()
  if (s === 'success') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (s === 'failed' || s === 'fail' || s === 'error') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (s === 'stopped' || s === 'stop') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (s === 'skip' || s === 'skipped') return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

function handleExportCsv() {
  exportRecoveryHistoryCsv(historyData.value, props.mode, props.targetId)
}

// Watch for modal open → reset & fetch
watch(() => props.visible, (val) => {
  if (val) {
    const defaults = getDefaultDates()
    startDate.value = defaults.startDate
    endDate.value = defaults.endDate
    selectedStatuses.value = []
    secondaryFilter.value = ''
    page.value = 1
    historyData.value = []
    total.value = 0
    modalPos.x = null
    modalPos.y = null
    customWidth.value = null
    customHeight.value = null
    isMaximized.value = false
    fetchHistory()
  }
})

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>
