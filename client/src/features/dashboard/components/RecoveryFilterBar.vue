<script setup>
import { ref, computed } from 'vue'
import MultiSelect from '../../../shared/components/MultiSelect.vue'

const props = defineProps({
  processes: { type: Array, default: () => [] },
  lines: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  showProcessFilter: { type: Boolean, default: true }
})

const emit = defineEmits(['search'])

const selectedPeriod = ref('today')
const selectedProcesses = ref([])
const selectedLines = ref([])
const customStartDate = ref('')
const customEndDate = ref('')

const periodOptions = [
  { value: 'today', label: '오늘' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: 'custom', label: '커스텀' }
]

const isCustom = computed(() => selectedPeriod.value === 'custom')

function handleSearch() {
  const filters = {
    period: selectedPeriod.value
  }
  if (props.showProcessFilter && selectedProcesses.value.length > 0) {
    filters.process = selectedProcesses.value.join(',')
  }
  if (selectedLines.value.length > 0) {
    filters.line = selectedLines.value.join(',')
  }
  if (isCustom.value) {
    if (customStartDate.value) filters.startDate = customStartDate.value
    if (customEndDate.value) filters.endDate = customEndDate.value
  }
  emit('search', filters)
}
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <!-- Period -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">기간</label>
      <select
        v-model="selectedPeriod"
        class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option v-for="opt in periodOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <!-- Custom Date Range -->
    <template v-if="isCustom">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시작일</label>
        <input
          v-model="customStartDate"
          type="date"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">종료일</label>
        <input
          v-model="customEndDate"
          type="date"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      v-model="selectedLines"
      :options="lines"
      label="Line"
      placeholder="전체 Line"
      width="200px"
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
  </div>
</template>
