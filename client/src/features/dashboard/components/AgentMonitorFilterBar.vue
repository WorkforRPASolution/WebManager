<script setup>
import { ref, watch } from 'vue'
import MultiSelect from '../../../shared/components/MultiSelect.vue'

const props = defineProps({
  processes: { type: Array, default: () => [] },
  models: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  sortBy: { type: String, default: 'name' },
  sortAsc: { type: Boolean, default: true }
})

const emit = defineEmits(['search', 'process-change', 'update:sortBy', 'update:sortAsc'])

const selectedProcesses = ref([])
const groupByModel = ref(false)
const selectedModels = ref([])

watch(selectedProcesses, (val) => {
  selectedModels.value = []
  emit('process-change', val.length > 0 ? val : null)
})

watch(groupByModel, (val) => {
  if (!val) selectedModels.value = []
  else emit('process-change', selectedProcesses.value.length > 0 ? selectedProcesses.value : null)
})

function handleSearch() {
  emit('search', {
    process: selectedProcesses.value.length > 0 ? selectedProcesses.value.join(',') : null,
    groupByModel: groupByModel.value,
    eqpModel: groupByModel.value && selectedModels.value.length > 0
      ? selectedModels.value.join(',')
      : null
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

    <!-- Model MultiSelect (Model 토글 ON일 때만) -->
    <MultiSelect
      v-if="groupByModel"
      v-model="selectedModels"
      :options="models"
      label="Model"
      placeholder="전체 Model"
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

    <!-- Sort -->
    <div class="flex items-center gap-1">
      <select
        :value="sortBy"
        @change="emit('update:sortBy', $event.target.value)"
        class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="name">이름순</option>
        <option value="count">수량순</option>
      </select>
      <button
        @click="emit('update:sortAsc', !sortAsc)"
        class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-dark-border transition-colors text-gray-500 dark:text-gray-400"
        :title="sortAsc ? '오름차순' : '내림차순'"
      >
        <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': !sortAsc }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </div>

    <!-- Model Toggle -->
    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none mb-1.5">
      <span>Model</span>
      <button
        type="button"
        role="switch"
        :aria-checked="groupByModel"
        @click="groupByModel = !groupByModel"
        class="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-dark-bg"
        :class="groupByModel ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'"
      >
        <span
          class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
          :class="groupByModel ? 'translate-x-4' : 'translate-x-0'"
        />
      </button>
    </label>
  </div>
</template>
