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

    <!-- Code Filter -->
    <MultiSelect
      v-model="selectedCodes"
      :options="availableCodes"
      label="Code"
      placeholder="Select Code..."
    />

    <!-- Search Button -->
    <button
      @click="handleSearch"
      :disabled="selectedProcesses.length === 0 && selectedModels.length === 0 && selectedCodes.length === 0"
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
import { emailTemplateApi } from '../api'
import MultiSelect from '../../../shared/components/MultiSelect.vue'

const emit = defineEmits(['filter-change'])

const processes = ref([])
const allModels = ref([])
const filteredModels = ref([])
const allCodes = ref([])
const filteredCodes = ref([])
const selectedProcesses = ref([])
const selectedModels = ref([])
const selectedCodes = ref([])

const availableModels = computed(() => {
  if (selectedProcesses.value.length > 0) {
    return filteredModels.value
  }
  return allModels.value
})

const availableCodes = computed(() => {
  if (selectedProcesses.value.length > 0 || selectedModels.value.length > 0) {
    return filteredCodes.value
  }
  return allCodes.value
})

const fetchProcesses = async () => {
  try {
    const response = await emailTemplateApi.getProcesses()
    processes.value = response.data
  } catch (error) {
    console.error('Failed to fetch processes:', error)
  }
}

const fetchAllModels = async () => {
  try {
    const response = await emailTemplateApi.getModels()
    allModels.value = response.data
  } catch (error) {
    console.error('Failed to fetch all models:', error)
  }
}

const fetchAllCodes = async () => {
  try {
    const response = await emailTemplateApi.getCodes()
    allCodes.value = response.data
  } catch (error) {
    console.error('Failed to fetch all codes:', error)
  }
}

const fetchModelsForProcesses = async (processArray) => {
  if (!processArray || processArray.length === 0) {
    filteredModels.value = []
    return
  }
  try {
    const response = await emailTemplateApi.getModels(processArray.join(','))
    filteredModels.value = response.data
  } catch (error) {
    console.error('Failed to fetch models:', error)
  }
}

const fetchCodesForFilters = async (processArray, modelArray) => {
  if ((!processArray || processArray.length === 0) && (!modelArray || modelArray.length === 0)) {
    filteredCodes.value = []
    return
  }
  try {
    const response = await emailTemplateApi.getCodes(
      processArray?.join(',') || '',
      modelArray?.join(',') || ''
    )
    filteredCodes.value = response.data
  } catch (error) {
    console.error('Failed to fetch codes:', error)
  }
}

const handleProcessChange = async (newProcesses) => {
  await fetchModelsForProcesses(newProcesses)

  // Filter out selected models that are no longer available
  if (newProcesses.length > 0) {
    selectedModels.value = selectedModels.value.filter(m => filteredModels.value.includes(m))
  }

  // Update codes based on new process/model selection
  await fetchCodesForFilters(newProcesses, selectedModels.value)
  selectedCodes.value = selectedCodes.value.filter(c => filteredCodes.value.includes(c))
}

const handleModelChange = async (newModels) => {
  await fetchCodesForFilters(selectedProcesses.value, newModels)
  selectedCodes.value = selectedCodes.value.filter(c => filteredCodes.value.includes(c))
}

const handleSearch = () => {
  if (selectedProcesses.value.length === 0 && selectedModels.value.length === 0 && selectedCodes.value.length === 0) return

  emit('filter-change', {
    processes: selectedProcesses.value,
    models: selectedModels.value,
    codes: selectedCodes.value,
  })
}

const handleClear = () => {
  selectedProcesses.value = []
  selectedModels.value = []
  selectedCodes.value = []
  filteredModels.value = []
  filteredCodes.value = []
  emit('filter-change', null)
}

const refreshFilters = async () => {
  await Promise.all([
    fetchProcesses(),
    fetchAllModels(),
    fetchAllCodes()
  ])
}

onMounted(async () => {
  await refreshFilters()
})

defineExpose({ refreshFilters })
</script>
