<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import MultiSelect from '../../../shared/components/MultiSelect.vue'
import AppIcon from '../../../shared/components/AppIcon.vue'

const props = defineProps({
  processes: { type: Array, default: () => [] },
  models: { type: Array, default: () => [] },
  lines: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  showProcessFilter: { type: Boolean, default: true },
  showModelFilter: { type: Boolean, default: false },
  showLineFilter: { type: Boolean, default: true },
  singleSelectMode: { type: Boolean, default: false },
  initialProcess: { type: String, default: '' },
  initialModel: { type: String, default: '' }
})

const emit = defineEmits(['search', 'process-change', 'period-change'])

const selectedPeriod = ref('today')
const selectedProcesses = ref([])
const selectedModels = ref([])
const selectedLines = ref([])

// 단일 선택 모드용 state
const singleProcess = ref(props.initialProcess)
const singleModel = ref(props.initialModel)

// initialProcess/Model이 비동기로 설정될 때 반영
watch(() => props.initialProcess, (v) => { if (v && !singleProcess.value) singleProcess.value = v })
watch(() => props.initialModel, (v) => { if (v && !singleModel.value) singleModel.value = v })

function selectSingleProcess(p) {
  singleProcess.value = p
  processDropdownOpen.value = false
  processSearch.value = ''
  // Model 초기화 + 부모에 알림
  singleModel.value = ''
  emit('process-change', p)
}

function selectSingleModel(m) {
  singleModel.value = m
  modelDropdownOpen.value = false
  modelSearch.value = ''
}
const processDropdownOpen = ref(false)
const modelDropdownOpen = ref(false)
const processContainerRef = ref(null)
const modelContainerRef = ref(null)
const processSearch = ref('')
const modelSearch = ref('')

const filteredProcesses = computed(() => {
  if (!processSearch.value) return props.processes
  const q = processSearch.value.toLowerCase()
  return props.processes.filter(p => p.toLowerCase().includes(q))
})

const filteredModels = computed(() => {
  if (!modelSearch.value) return props.models
  const q = modelSearch.value.toLowerCase()
  return props.models.filter(m => m.toLowerCase().includes(q))
})

function handleSingleDropdownClickOutside(e) {
  if (processContainerRef.value && !processContainerRef.value.contains(e.target)) {
    processDropdownOpen.value = false
  }
  if (modelContainerRef.value && !modelContainerRef.value.contains(e.target)) {
    modelDropdownOpen.value = false
  }
}

const periodOptions = [
  { value: 'today', label: '오늘' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: '90d', label: '90일' },
  { value: '1y', label: '1년' },
  { value: 'custom', label: '커스텀 (최대 2년)' }
]

const periodDropdownOpen = ref(false)
const periodContainerRef = ref(null)

const selectedPeriodLabel = computed(() => {
  return periodOptions.find(o => o.value === selectedPeriod.value)?.label || '오늘'
})

const isCustom = computed(() => selectedPeriod.value === 'custom')

const startDate = ref('')
const endDate = ref('')

// ── Period Navigation ──
const PERIOD_DAYS = { today: 1, '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
const MAX_DAYS = 730

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr() {
  return localDateStr(new Date())
}

function computePresetDates(period) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = PERIOD_DAYS[period]
  if (!days) return
  const start = new Date(today)
  start.setDate(start.getDate() - days + 1)
  startDate.value = localDateStr(start)
  endDate.value = localDateStr(today)
}

// 초기 + 기간 변경 시 날짜 자동 계산
computePresetDates('today')

function selectPeriod(value) {
  selectedPeriod.value = value
  periodDropdownOpen.value = false
  if (value !== 'custom') {
    computePresetDates(value)
    emit('period-change', value)
  }
}

function shiftPeriod(direction) {
  const days = PERIOD_DAYS[selectedPeriod.value]
  if (!days) return

  const s = new Date(startDate.value)
  const e = new Date(endDate.value)
  s.setDate(s.getDate() + direction * days)
  e.setDate(e.getDate() + direction * days)

  // 미래 제한
  const today = todayStr()
  if (direction > 0 && localDateStr(e) > today) return

  // 2년 이전 제한
  const twoYearsAgo = new Date()
  twoYearsAgo.setDate(twoYearsAgo.getDate() - MAX_DAYS)
  if (direction < 0 && s < twoYearsAgo) return

  startDate.value = localDateStr(s)
  endDate.value = localDateStr(e)
  handleSearch()
}

const isLatestPeriod = computed(() => endDate.value >= todayStr())

function handlePeriodClickOutside(e) {
  if (periodContainerRef.value && !periodContainerRef.value.contains(e.target)) {
    periodDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handlePeriodClickOutside)
  document.addEventListener('click', handleSingleDropdownClickOutside)
})
onUnmounted(() => {
  document.removeEventListener('click', handlePeriodClickOutside)
  document.removeEventListener('click', handleSingleDropdownClickOutside)
})

const customError = ref('')

function handleSearch() {
  customError.value = ''

  if (isCustom.value) {
    if (!startDate.value || !endDate.value) {
      customError.value = '시작일과 종료일을 모두 입력하세요'
      return
    }
    const s = new Date(startDate.value)
    const e = new Date(endDate.value)
    if (s >= e) {
      customError.value = '시작일은 종료일보다 이전이어야 합니다'
      return
    }
    const diffDays = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > MAX_DAYS) {
      customError.value = '최대 2년까지 조회할 수 있습니다'
      return
    }
  }

  const filters = {
    period: selectedPeriod.value
  }
  if (props.showProcessFilter) {
    if (props.singleSelectMode) {
      if (singleProcess.value) filters.process = singleProcess.value
    } else if (selectedProcesses.value.length > 0) {
      filters.process = selectedProcesses.value.join(',')
    }
  }
  if (props.showModelFilter) {
    if (props.singleSelectMode) {
      if (singleModel.value) filters.model = singleModel.value
    } else if (selectedModels.value.length > 0) {
      filters.model = selectedModels.value.join(',')
    }
  }
  if (props.showLineFilter && selectedLines.value.length > 0) {
    filters.line = selectedLines.value.join(',')
  }
  // 프리셋이 이동된 경우 또는 커스텀: custom + 날짜 전송
  if (isCustom.value || (!isCustom.value && !isLatestPeriod.value)) {
    filters.period = 'custom'
    filters.startDate = startDate.value
    // endDate +1일 (exclusive) — 서버 validation: start < end
    const e = new Date(endDate.value)
    e.setDate(e.getDate() + 1)
    filters.endDate = localDateStr(e)
  }
  emit('search', filters)
}
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <!-- Period (커스텀 드롭다운 — MultiSelect와 동일한 높이) -->
    <div ref="periodContainerRef" class="relative">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">기간</label>
      <div
        @click="periodDropdownOpen = !periodDropdownOpen"
        class="flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors"
        :class="[
          periodDropdownOpen
            ? 'border-primary-500 ring-2 ring-primary-500/20'
            : 'border-gray-300 dark:border-dark-border',
          'bg-white dark:bg-dark-bg hover:border-primary-400'
        ]"
        style="width: 180px"
      >
        <span class="text-sm text-gray-900 dark:text-white">{{ selectedPeriodLabel }}</span>
        <AppIcon
          name="chevron_down"
          size="4"
          class="text-gray-400 transition-transform"
          :class="{ 'rotate-180': periodDropdownOpen }"
        />
      </div>
      <div
        v-show="periodDropdownOpen"
        class="absolute z-50 mt-1 w-full bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-lg"
      >
        <div
          v-for="opt in periodOptions"
          :key="opt.value"
          @click="selectPeriod(opt.value)"
          class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-dark-border cursor-pointer text-sm"
          :class="selectedPeriod === opt.value ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'"
        >
          {{ opt.label }}
        </div>
      </div>
    </div>

    <!-- 시작일 -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시작일</label>
      <div class="flex items-center gap-1">
        <button
          v-if="!isCustom"
          @click="shiftPeriod(-1)"
          class="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-dark-border rounded transition-colors"
          title="이전 기간"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <input
          v-model="startDate"
          type="date"
          :disabled="!isCustom"
          class="text-sm border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        />
      </div>
    </div>
    <!-- 종료일 -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">종료일</label>
      <div class="flex items-center gap-1">
        <input
          v-model="endDate"
          type="date"
          :disabled="!isCustom"
          class="text-sm border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        />
        <button
          v-if="!isCustom"
          @click="shiftPeriod(1)"
          :disabled="isLatestPeriod"
          class="p-1.5 rounded transition-colors"
          :class="isLatestPeriod
            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
            : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-dark-border'"
          title="다음 기간"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>

    <!-- Process Filter -->
    <template v-if="showProcessFilter">
      <!-- 단일 선택 모드 -->
      <div v-if="singleSelectMode" ref="processContainerRef" class="relative">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Process</label>
        <div
          @click="processDropdownOpen = !processDropdownOpen"
          class="flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors"
          :class="[
            processDropdownOpen ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-300 dark:border-dark-border',
            'bg-white dark:bg-dark-bg hover:border-primary-400'
          ]"
          style="width: 200px"
        >
          <span class="text-sm" :class="singleProcess ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'">
            {{ singleProcess || 'Process 선택' }}
          </span>
          <AppIcon name="chevron_down" size="4" class="text-gray-400 transition-transform" :class="{ 'rotate-180': processDropdownOpen }" />
        </div>
        <div v-show="processDropdownOpen" class="absolute z-50 mt-1 w-full bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-lg">
          <div class="p-2 border-b border-gray-200 dark:border-dark-border">
            <input
              v-model="processSearch"
              type="text"
              placeholder="검색..."
              class="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400"
              @click.stop
            />
          </div>
          <div class="max-h-52 overflow-y-auto">
            <div
              v-for="p in filteredProcesses"
              :key="p"
              @click="selectSingleProcess(p)"
              class="px-3 py-2 hover:bg-gray-50 dark:hover:bg-dark-border cursor-pointer text-sm"
              :class="singleProcess === p ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'"
            >{{ p }}</div>
            <div v-if="filteredProcesses.length === 0" class="px-3 py-2 text-sm text-gray-400">결과 없음</div>
          </div>
        </div>
      </div>
      <!-- 멀티 선택 모드 -->
      <MultiSelect
        v-else
        v-model="selectedProcesses"
        :options="processes"
        label="Process"
        placeholder="전체 Process"
        width="200px"
      />
    </template>

    <!-- Line MultiSelect -->
    <MultiSelect
      v-if="showLineFilter"
      v-model="selectedLines"
      :options="lines"
      label="Line"
      placeholder="전체 Line"
      width="200px"
    />

    <!-- Model Filter -->
    <template v-if="showModelFilter">
      <!-- 단일 선택 모드 -->
      <div v-if="singleSelectMode" ref="modelContainerRef" class="relative">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
        <div
          @click="modelDropdownOpen = !modelDropdownOpen"
          class="flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors"
          :class="[
            modelDropdownOpen ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-300 dark:border-dark-border',
            'bg-white dark:bg-dark-bg hover:border-primary-400'
          ]"
          style="width: 300px"
        >
          <span class="text-sm" :class="singleModel ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'">
            {{ singleModel || 'Model 선택' }}
          </span>
          <AppIcon name="chevron_down" size="4" class="text-gray-400 transition-transform" :class="{ 'rotate-180': modelDropdownOpen }" />
        </div>
        <div v-show="modelDropdownOpen" class="absolute z-50 mt-1 w-full bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-lg">
          <div class="p-2 border-b border-gray-200 dark:border-dark-border">
            <input
              v-model="modelSearch"
              type="text"
              placeholder="검색..."
              class="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400"
              @click.stop
            />
          </div>
          <div class="max-h-52 overflow-y-auto">
            <div
              v-for="m in filteredModels"
              :key="m"
              @click="selectSingleModel(m)"
              class="px-3 py-2 hover:bg-gray-50 dark:hover:bg-dark-border cursor-pointer text-sm"
              :class="singleModel === m ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'"
            >{{ m }}</div>
            <div v-if="filteredModels.length === 0" class="px-3 py-2 text-sm text-gray-400">결과 없음</div>
          </div>
        </div>
      </div>
      <!-- 멀티 선택 모드 -->
      <MultiSelect
        v-else
        v-model="selectedModels"
        :options="models"
        label="Model"
        placeholder="전체 Model"
        width="300px"
      />
    </template>

    <!-- Search Button -->
    <button
      @click="handleSearch"
      :disabled="loading"
      class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <span v-if="loading">조회 중...</span>
      <span v-else>조회</span>
    </button>

    <!-- Custom period validation error -->
    <span v-if="customError" class="text-red-500 dark:text-red-400 text-xs mb-2.5">
      {{ customError }}
    </span>
  </div>
</template>
