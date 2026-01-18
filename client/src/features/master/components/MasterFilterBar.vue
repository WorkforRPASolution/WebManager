<template>
  <div class="flex flex-wrap items-end gap-4 p-4 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
    <!-- Process Filter -->
    <MultiSelect
      v-model="selectedProcesses"
      :options="processes"
      label="Process"
      placeholder="Select Process..."
      @update:model-value="handleProcessChange"
    />

    <!-- Model Filter -->
    <MultiSelect
      v-model="selectedModels"
      :options="availableModels"
      label="Model"
      placeholder="Select Model..."
      @update:model-value="handleModelChange"
    />

    <!-- IP Search -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP</label>
      <input
        v-model="ipSearch"
        type="text"
        placeholder="Search IP..."
        class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm w-[150px]"
      />
    </div>

    <!-- Search Button -->
    <button
      @click="handleSearch"
      :disabled="selectedProcesses.length === 0 && selectedModels.length === 0"
      class="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition text-sm h-[38px]"
    >
      Search
    </button>

    <!-- Clear Button -->
    <button
      @click="handleClear"
      class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition text-sm h-[38px]"
    >
      Clear
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { masterApi } from '../api'
import MultiSelect from '../../../shared/components/MultiSelect.vue'

const emit = defineEmits(['filter-change'])

const processes = ref([])
const allModels = ref([])  // All models from DB
const filteredModels = ref([])  // Models filtered by selected processes
const selectedProcesses = ref([])
const selectedModels = ref([])
const ipSearch = ref('')

// Show filtered models if processes are selected, otherwise show all models
const availableModels = computed(() => {
  if (selectedProcesses.value.length > 0) {
    return filteredModels.value
  }
  return allModels.value
})

const fetchProcesses = async () => {
  try {
    const response = await masterApi.getProcesses()
    processes.value = response.data
  } catch (error) {
    console.error('Failed to fetch processes:', error)
  }
}

const fetchAllModels = async () => {
  try {
    const response = await masterApi.getModels()  // No process param = all models
    allModels.value = response.data
  } catch (error) {
    console.error('Failed to fetch all models:', error)
  }
}

const fetchModelsForProcesses = async (processArray) => {
  if (!processArray || processArray.length === 0) {
    filteredModels.value = []
    return
  }
  try {
    // Fetch models for all selected processes
    const response = await masterApi.getModels(processArray.join(','))
    filteredModels.value = response.data
  } catch (error) {
    console.error('Failed to fetch models:', error)
  }
}

const handleProcessChange = async (newProcesses) => {
  // Filter models by selected processes
  await fetchModelsForProcesses(newProcesses)

  // Remove selected models that are no longer available
  if (newProcesses.length > 0) {
    selectedModels.value = selectedModels.value.filter(m => filteredModels.value.includes(m))
  }
}

const handleModelChange = (newModels) => {
  // Model selection changed - no additional action needed
}

const handleSearch = () => {
  if (selectedProcesses.value.length === 0 && selectedModels.value.length === 0) return

  emit('filter-change', {
    processes: selectedProcesses.value,
    models: selectedModels.value,
    ipSearch: ipSearch.value,
  })
}

const handleClear = () => {
  selectedProcesses.value = []
  selectedModels.value = []
  ipSearch.value = ''
  filteredModels.value = []
  emit('filter-change', null)
}

const refreshFilters = async () => {
  await Promise.all([
    fetchProcesses(),
    fetchAllModels()
  ])
}

onMounted(async () => {
  await refreshFilters()
})

defineExpose({ refreshFilters })
</script>
