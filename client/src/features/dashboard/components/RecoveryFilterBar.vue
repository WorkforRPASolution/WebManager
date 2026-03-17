<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import MultiSelect from '../../../shared/components/MultiSelect.vue'
import AppIcon from '../../../shared/components/AppIcon.vue'

const props = defineProps({
  processes: { type: Array, default: () => [] },
  models: { type: Array, default: () => [] },
  lines: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  showProcessFilter: { type: Boolean, default: true },
  showModelFilter: { type: Boolean, default: false },
  showLineFilter: { type: Boolean, default: true }
})

const emit = defineEmits(['search'])

const selectedPeriod = ref('today')
const selectedProcesses = ref([])
const selectedModels = ref([])
const selectedLines = ref([])
const customStartDate = ref('')
const customEndDate = ref('')

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

function selectPeriod(value) {
  selectedPeriod.value = value
  periodDropdownOpen.value = false
}

function handlePeriodClickOutside(e) {
  if (periodContainerRef.value && !periodContainerRef.value.contains(e.target)) {
    periodDropdownOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handlePeriodClickOutside))
onUnmounted(() => document.removeEventListener('click', handlePeriodClickOutside))

const customError = ref('')

function handleSearch() {
  customError.value = ''

  if (isCustom.value) {
    if (!customStartDate.value || !customEndDate.value) {
      customError.value = '시작일과 종료일을 모두 입력하세요'
      return
    }
    const start = new Date(customStartDate.value)
    const end = new Date(customEndDate.value)
    if (start >= end) {
      customError.value = '시작일은 종료일보다 이전이어야 합니다'
      return
    }
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 730) {
      customError.value = '최대 2년까지 조회할 수 있습니다'
      return
    }
  }

  const filters = {
    period: selectedPeriod.value
  }
  if (props.showProcessFilter && selectedProcesses.value.length > 0) {
    filters.process = selectedProcesses.value.join(',')
  }
  if (props.showModelFilter && selectedModels.value.length > 0) {
    filters.model = selectedModels.value.join(',')
  }
  if (props.showLineFilter && selectedLines.value.length > 0) {
    filters.line = selectedLines.value.join(',')
  }
  if (isCustom.value) {
    filters.startDate = customStartDate.value
    filters.endDate = customEndDate.value
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

    <!-- Custom Date Range -->
    <template v-if="isCustom">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시작일</label>
        <input
          v-model="customStartDate"
          type="date"
          class="text-sm border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">종료일</label>
        <input
          v-model="customEndDate"
          type="date"
          class="text-sm border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </template>

    <!-- Process MultiSelect -->
    <MultiSelect
      v-if="showProcessFilter"
      v-model="selectedProcesses"
      :options="processes"
      label="Process"
      placeholder="전체 Process"
      width="200px"
    />

    <!-- Line MultiSelect -->
    <MultiSelect
      v-if="showLineFilter"
      v-model="selectedLines"
      :options="lines"
      label="Line"
      placeholder="전체 Line"
      width="200px"
    />

    <!-- Model MultiSelect -->
    <MultiSelect
      v-if="showModelFilter"
      v-model="selectedModels"
      :options="models"
      label="Model"
      placeholder="전체 Model"
      width="300px"
    />

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
