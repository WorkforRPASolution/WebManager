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

          <!-- Status Filter -->
          <MultiSelect
            v-model="selectedStatus"
            :options="statusOptions"
            label="Status"
            placeholder="Select Status..."
          />

          <!-- IP Search -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP</label>
            <input
              v-model="ipSearch"
              type="text"
              placeholder="Search IP..."
              class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm w-[150px]"
              @keyup.enter="handleSearch"
            />
          </div>

          <!-- Search Button -->
          <button
            @click="handleSearch"
            :disabled="selectedProcesses.length === 0 && selectedModels.length === 0 && selectedStatus.length === 0 && !ipSearch"
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
import { ref, computed, onMounted } from 'vue'
import { clientListApi } from '../api'
import MultiSelect from '../../../shared/components/MultiSelect.vue'
import FilterBookmarks from '../../../shared/components/FilterBookmarks.vue'
import { useFilterBookmarks } from '../../../shared/composables/useFilterBookmarks'
import { useProcessFilterStore } from '../../../shared/stores/processFilter'
import { useAuthStore } from '../../../shared/stores/auth'

defineProps({
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['filter-change', 'toggle'])

const { bookmarks, add: addBookmark, remove: removeBookmark } = useFilterBookmarks('clients')

const processFilterStore = useProcessFilterStore()
const authStore = useAuthStore()

const processes = ref([])
const allModels = ref([])
const filteredModels = ref([])
const selectedProcesses = ref([])
const selectedModels = ref([])
const selectedStatus = ref([])
const ipSearch = ref('')

const statusOptions = ['online', 'offline']

// Show filtered models if processes are selected, otherwise show all models
const availableModels = computed(() => {
  if (selectedProcesses.value.length > 0) {
    return filteredModels.value
  }
  return allModels.value
})

// Summary text when filter bar is collapsed
const filterSummary = computed(() => {
  const parts = []
  if (selectedProcesses.value.length) parts.push(`Process: ${selectedProcesses.value.length}`)
  if (selectedModels.value.length) parts.push(`Model: ${selectedModels.value.length}`)
  if (selectedStatus.value.length) parts.push(`Status: ${selectedStatus.value.length}`)
  if (ipSearch.value) parts.push(`IP: "${ipSearch.value}"`)
  return parts.length ? parts.join(', ') : 'No filters'
})

const fetchProcesses = async () => {
  try {
    const response = await clientListApi.getProcesses()
    // 전체 목록을 Store에 캐시하고, 필터링된 목록을 사용
    processFilterStore.setProcesses('clients', response.data)
    processes.value = processFilterStore.getFilteredProcesses('clients')
  } catch (error) {
    console.error('Failed to fetch processes:', error)
  }
}

const fetchAllModels = async () => {
  try {
    const response = await clientListApi.getModels()
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
    const response = await clientListApi.getModels(processArray.join(','))
    filteredModels.value = response.data
  } catch (error) {
    console.error('Failed to fetch models:', error)
  }
}

const handleProcessChange = async (newProcesses) => {
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
  // Allow search if any filter is set
  if (selectedProcesses.value.length === 0 &&
      selectedModels.value.length === 0 &&
      selectedStatus.value.length === 0 &&
      !ipSearch.value) {
    return
  }

  // 관리자/MASTER가 아닌 경우 userProcesses 전달 (키워드 검색 시 process 권한 필터링용)
  const userProcesses = processFilterStore.canViewAllProcesses
    ? null
    : processFilterStore.getUserProcessList()

  emit('filter-change', {
    processes: selectedProcesses.value,
    models: selectedModels.value,
    status: selectedStatus.value,
    ipSearch: ipSearch.value,
    userProcesses
  })
}

const handleClear = () => {
  selectedProcesses.value = []
  selectedModels.value = []
  selectedStatus.value = []
  ipSearch.value = ''
  filteredModels.value = []
  emit('filter-change', null)
}

// Bookmark handlers
const hasActiveFilters = computed(() =>
  selectedProcesses.value.length > 0 ||
  selectedModels.value.length > 0 ||
  selectedStatus.value.length > 0 ||
  ipSearch.value
)

const handleSaveBookmark = (name) => {
  addBookmark(name, {
    processes: selectedProcesses.value,
    models: selectedModels.value,
    status: selectedStatus.value,
    ipSearch: ipSearch.value
  })
}

const handleApplyBookmark = async (bookmark) => {
  selectedProcesses.value = bookmark.filters.processes || []
  selectedModels.value = bookmark.filters.models || []
  selectedStatus.value = bookmark.filters.status || []
  ipSearch.value = bookmark.filters.ipSearch || ''

  // Fetch models for selected processes
  if (selectedProcesses.value.length > 0) {
    await fetchModelsForProcesses(selectedProcesses.value)
  }

  handleSearch()
}

const handleDeleteBookmark = (id) => {
  removeBookmark(id)
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
