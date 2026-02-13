<template>
  <div class="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
    <!-- Header (always visible) -->
    <div
      class="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-t-lg"
      @click="$emit('toggle')"
    >
      <div class="flex items-center gap-2">
        <svg
          :class="['w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200', collapsed ? '-rotate-90' : '']"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
        <span class="font-medium text-gray-700 dark:text-gray-300">Filters</span>
        <span v-if="collapsed" class="text-sm text-gray-500 dark:text-gray-400 ml-2">
          {{ filterSummary }}
        </span>
      </div>

      <!-- Filter Bookmarks -->
      <FilterBookmarks
        :bookmarks="bookmarks"
        :has-filters="hasActiveFilters"
        @save="handleSaveBookmark"
        @apply="handleApplyBookmark"
        @delete="handleDeleteBookmark"
      />
    </div>

    <!-- Filter Content (collapsible) -->
    <div
      v-show="!collapsed"
      class="transition-all duration-200 ease-out"
    >
      <div>
        <div class="flex flex-wrap items-end gap-4 px-4 pb-4 pt-1">
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
            @update:model-value="handleCodeChange"
          />

          <!-- Subcode Filter -->
          <MultiSelect
            v-model="selectedSubcodes"
            :options="availableSubcodes"
            label="Subcode"
            placeholder="Select Subcode..."
          />

          <!-- Search Button -->
          <button
            @click="handleSearch"
            :disabled="selectedProcesses.length === 0 && selectedModels.length === 0 && selectedCodes.length === 0 && selectedSubcodes.length === 0"
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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { emailImageApi } from '../api'
import MultiSelect from '../../../shared/components/MultiSelect.vue'
import FilterBookmarks from '../../../shared/components/FilterBookmarks.vue'
import { useFilterBookmarks } from '../../../shared/composables/useFilterBookmarks'
import { useProcessFilterStore } from '../../../shared/stores/processFilter'

defineProps({
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['filter-change', 'toggle'])

const { bookmarks, add: addBookmark, remove: removeBookmark } = useFilterBookmarks('email-image')

const processFilterStore = useProcessFilterStore()

const processes = ref([])
const allModels = ref([])
const filteredModels = ref([])
const allCodes = ref([])
const filteredCodes = ref([])
const allSubcodes = ref([])
const filteredSubcodes = ref([])
const selectedProcesses = ref([])
const selectedModels = ref([])
const selectedCodes = ref([])
const selectedSubcodes = ref([])

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

const availableSubcodes = computed(() => {
  if (selectedProcesses.value.length > 0 || selectedModels.value.length > 0 || selectedCodes.value.length > 0) {
    return filteredSubcodes.value
  }
  return allSubcodes.value
})

// Summary text when filter bar is collapsed
const filterSummary = computed(() => {
  const parts = []
  if (selectedProcesses.value.length) parts.push(`Process: ${selectedProcesses.value.length}`)
  if (selectedModels.value.length) parts.push(`Model: ${selectedModels.value.length}`)
  if (selectedCodes.value.length) parts.push(`Code: ${selectedCodes.value.length}`)
  if (selectedSubcodes.value.length) parts.push(`Subcode: ${selectedSubcodes.value.length}`)
  return parts.length ? parts.join(', ') : 'No filters'
})

const fetchProcesses = async () => {
  try {
    const response = await emailImageApi.getProcesses()
    processFilterStore.setProcesses('emailImage', response.data)
    processes.value = processFilterStore.getFilteredProcesses('emailImage')
  } catch (error) {
    console.error('Failed to fetch processes:', error)
  }
}

const fetchAllModels = async () => {
  try {
    const userProcesses = processFilterStore.canViewAllProcesses
      ? null
      : processFilterStore.getUserProcessList()

    const response = await emailImageApi.getModels(null, userProcesses)
    allModels.value = response.data
  } catch (error) {
    console.error('Failed to fetch all models:', error)
  }
}

const fetchAllCodes = async () => {
  try {
    const userProcesses = processFilterStore.canViewAllProcesses
      ? null
      : processFilterStore.getUserProcessList()

    const response = await emailImageApi.getCodes(null, null, userProcesses)
    allCodes.value = response.data
  } catch (error) {
    console.error('Failed to fetch all codes:', error)
  }
}

const fetchAllSubcodes = async () => {
  try {
    const userProcesses = processFilterStore.canViewAllProcesses
      ? null
      : processFilterStore.getUserProcessList()

    const response = await emailImageApi.getSubcodes(null, null, null, userProcesses)
    allSubcodes.value = response.data
  } catch (error) {
    console.error('Failed to fetch all subcodes:', error)
  }
}

const fetchModelsForProcesses = async (processArray) => {
  if (!processArray || processArray.length === 0) {
    filteredModels.value = []
    return
  }
  try {
    const response = await emailImageApi.getModels(processArray.join(','))
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
    const userProcesses = (!processArray || processArray.length === 0) && !processFilterStore.canViewAllProcesses
      ? processFilterStore.getUserProcessList()
      : null

    const response = await emailImageApi.getCodes(
      processArray?.join(',') || '',
      modelArray?.join(',') || '',
      userProcesses
    )
    filteredCodes.value = response.data
  } catch (error) {
    console.error('Failed to fetch codes:', error)
  }
}

const fetchSubcodesForFilters = async (processArray, modelArray, codeArray) => {
  if ((!processArray || processArray.length === 0) && (!modelArray || modelArray.length === 0) && (!codeArray || codeArray.length === 0)) {
    filteredSubcodes.value = []
    return
  }
  try {
    const userProcesses = (!processArray || processArray.length === 0) && !processFilterStore.canViewAllProcesses
      ? processFilterStore.getUserProcessList()
      : null

    const response = await emailImageApi.getSubcodes(
      processArray?.join(',') || '',
      modelArray?.join(',') || '',
      codeArray?.join(',') || '',
      userProcesses
    )
    filteredSubcodes.value = response.data
  } catch (error) {
    console.error('Failed to fetch subcodes:', error)
  }
}

const handleProcessChange = async (newProcesses) => {
  await fetchModelsForProcesses(newProcesses)

  if (newProcesses.length > 0) {
    selectedModels.value = selectedModels.value.filter(m => filteredModels.value.includes(m))
  }

  await fetchCodesForFilters(newProcesses, selectedModels.value)
  selectedCodes.value = selectedCodes.value.filter(c => filteredCodes.value.includes(c))

  await fetchSubcodesForFilters(newProcesses, selectedModels.value, selectedCodes.value)
  selectedSubcodes.value = selectedSubcodes.value.filter(s => filteredSubcodes.value.includes(s))
}

const handleModelChange = async (newModels) => {
  await fetchCodesForFilters(selectedProcesses.value, newModels)
  selectedCodes.value = selectedCodes.value.filter(c => filteredCodes.value.includes(c))

  await fetchSubcodesForFilters(selectedProcesses.value, newModels, selectedCodes.value)
  selectedSubcodes.value = selectedSubcodes.value.filter(s => filteredSubcodes.value.includes(s))
}

const handleCodeChange = async (newCodes) => {
  await fetchSubcodesForFilters(selectedProcesses.value, selectedModels.value, newCodes)
  selectedSubcodes.value = selectedSubcodes.value.filter(s => filteredSubcodes.value.includes(s))
}

const handleSearch = () => {
  if (selectedProcesses.value.length === 0 && selectedModels.value.length === 0 && selectedCodes.value.length === 0 && selectedSubcodes.value.length === 0) return

  emit('filter-change', {
    processes: selectedProcesses.value,
    models: selectedModels.value,
    codes: selectedCodes.value,
    subcodes: selectedSubcodes.value,
  })
}

const handleClear = () => {
  selectedProcesses.value = []
  selectedModels.value = []
  selectedCodes.value = []
  selectedSubcodes.value = []
  filteredModels.value = []
  filteredCodes.value = []
  filteredSubcodes.value = []
  emit('filter-change', null)
}

// Bookmark handlers
const hasActiveFilters = computed(() =>
  selectedProcesses.value.length > 0 ||
  selectedModels.value.length > 0 ||
  selectedCodes.value.length > 0 ||
  selectedSubcodes.value.length > 0
)

const handleSaveBookmark = (name) => {
  addBookmark(name, {
    processes: selectedProcesses.value,
    models: selectedModels.value,
    codes: selectedCodes.value,
    subcodes: selectedSubcodes.value
  })
}

const handleApplyBookmark = async (bookmark) => {
  selectedProcesses.value = bookmark.filters.processes || []
  selectedModels.value = bookmark.filters.models || []
  selectedCodes.value = bookmark.filters.codes || []
  selectedSubcodes.value = bookmark.filters.subcodes || []

  if (selectedProcesses.value.length > 0) {
    await fetchModelsForProcesses(selectedProcesses.value)
    await fetchCodesForFilters(selectedProcesses.value, selectedModels.value)
    await fetchSubcodesForFilters(selectedProcesses.value, selectedModels.value, selectedCodes.value)
  }

  handleSearch()
}

const handleDeleteBookmark = (id) => {
  removeBookmark(id)
}

const refreshFilters = async () => {
  await Promise.all([
    fetchProcesses(),
    fetchAllModels(),
    fetchAllCodes(),
    fetchAllSubcodes()
  ])
}

onMounted(async () => {
  await refreshFilters()
})

// keep-alive 재활성화 시 필터 옵션 갱신
onActivated(async () => {
  await refreshFilters()
})

defineExpose({ refreshFilters })
</script>
