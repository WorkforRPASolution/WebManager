<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import MultiSelect from '../../../shared/components/MultiSelect.vue'
import AppIcon from '../../../shared/components/AppIcon.vue'

const props = defineProps({
  processes: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  hideProcess: { type: Boolean, default: false },
  periodOptions: { type: Array, default: null },
  defaultPeriod: { type: String, default: null },
  showEndDate: { type: Boolean, default: false },
  maxDays: { type: Number, default: 730 }
})

const emit = defineEmits(['search'])

const selectedPeriod = ref(props.defaultPeriod || (props.periodOptions ? props.periodOptions[0]?.value : 'all'))
const startDate = ref('')
const endDate = ref('')
const selectedProcesses = ref([])

const defaultPeriodOptions = [
  { value: 'all', label: '전체' },
  { value: 'today', label: '최근 24시간' },
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
  { value: '1y', label: '최근 1년' },
  { value: 'custom', label: '시작일 지정' }
]

const periodOptions = computed(() => props.periodOptions || defaultPeriodOptions)

const periodDropdownOpen = ref(false)
const periodContainerRef = ref(null)

const isCustom = computed(() => selectedPeriod.value === 'custom')

const minDateStr = computed(() => {
  const d = new Date(Date.now() - props.maxDays * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
})

const todayStr = computed(() => new Date().toISOString().slice(0, 10))

const selectedPeriodLabel = computed(() => {
  return periodOptions.value.find(o => o.value === selectedPeriod.value)?.label || '전체'
})

function selectPeriod(value) {
  selectedPeriod.value = value
  periodDropdownOpen.value = false
}

function handlePeriodClickOutside(e) {
  if (periodContainerRef.value && !periodContainerRef.value.contains(e.target)) {
    periodDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handlePeriodClickOutside)
})
onUnmounted(() => {
  document.removeEventListener('click', handlePeriodClickOutside)
})

const customError = ref('')

function handleSearch() {
  customError.value = ''

  if (isCustom.value) {
    if (!startDate.value) {
      customError.value = '시작일을 입력하세요'
      return
    }
    if (props.showEndDate && !endDate.value) {
      customError.value = '종료일을 입력하세요'
      return
    }
    const s = new Date(startDate.value)
    if (s > new Date()) {
      customError.value = '시작일은 미래일 수 없습니다'
      return
    }
    const diffDays = (Date.now() - s.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > props.maxDays) {
      customError.value = `시작일은 최근 ${props.maxDays}일 이내여야 합니다`
      return
    }
    if (props.showEndDate && endDate.value) {
      const e = new Date(endDate.value)
      if (e < s) {
        customError.value = '종료일은 시작일 이후여야 합니다'
        return
      }
    }
  }

  const filters = { period: selectedPeriod.value }

  if (!props.hideProcess && selectedProcesses.value.length > 0) {
    filters.process = selectedProcesses.value.join(',')
  }

  if (isCustom.value) {
    filters.startDate = startDate.value
    if (props.showEndDate && endDate.value) {
      filters.endDate = endDate.value
    }
  }

  emit('search', filters)
}
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <!-- Period -->
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
        style="width: 160px"
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

    <!-- Start date (custom only) -->
    <div v-if="isCustom">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시작일</label>
      <input
        v-model="startDate"
        type="date"
        :min="minDateStr"
        :max="todayStr"
        class="text-sm border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <!-- End date (custom + showEndDate only) -->
    <template v-if="isCustom && showEndDate">
      <div class="flex items-center pb-0.5">
        <span class="text-xs text-gray-400 dark:text-gray-500 italic">~</span>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">종료일</label>
        <input
          v-model="endDate"
          type="date"
          class="text-sm border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </template>

    <!-- "~ 현재" indicator (non-custom with endDate, or non-showEndDate custom) -->
    <div v-if="selectedPeriod !== 'all' && !(isCustom && showEndDate)" class="flex items-center pb-0.5">
      <span class="text-xs text-gray-400 dark:text-gray-500 italic">~ 현재</span>
    </div>

    <!-- Process filter -->
    <MultiSelect
      v-if="!hideProcess"
      v-model="selectedProcesses"
      :options="processes"
      label="Process"
      placeholder="전체 Process"
      width="200px"
    />

    <!-- Search button -->
    <button
      @click="handleSearch"
      :disabled="loading"
      class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <span v-if="loading">조회 중...</span>
      <span v-else>조회</span>
    </button>

    <span v-if="customError" class="text-red-500 dark:text-red-400 text-xs mb-2.5">
      {{ customError }}
    </span>
  </div>
</template>
