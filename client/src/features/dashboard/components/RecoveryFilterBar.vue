<script setup>
import { ref, watch } from 'vue'
import MultiSelect from '../../../shared/components/MultiSelect.vue'

const props = defineProps({
  processes: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['search'])

const selectedProcesses = ref([])
const startDate = ref('')
const endDate = ref('')

// Default dates: last 30 days
function setDefaultDates() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  startDate.value = start.toISOString().slice(0, 10)
  endDate.value = end.toISOString().slice(0, 10)
}

setDefaultDates()

function handleSearch() {
  emit('search', {
    process: selectedProcesses.value.length > 0 ? selectedProcesses.value.join(',') : null,
    startDate: startDate.value || null,
    endDate: endDate.value || null
  })
}
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <!-- Process -->
    <MultiSelect
      v-model="selectedProcesses"
      :options="processes"
      label="Process"
      placeholder="전체 Process"
      width="200px"
    />

    <!-- Period -->
    <div class="flex flex-col gap-1">
      <label class="text-xs text-gray-500 dark:text-gray-400">기간</label>
      <div class="flex items-center gap-1">
        <input
          type="date"
          v-model="startDate"
          class="px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span class="text-gray-400 px-1">~</span>
        <input
          type="date"
          v-model="endDate"
          class="px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>

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
