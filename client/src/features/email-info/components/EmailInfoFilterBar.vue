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
          <!-- Project Filter -->
          <MultiSelect
            v-model="selectedProjects"
            :options="projects"
            label="Project"
            placeholder="Select Project..."
            @update:model-value="handleProjectChange"
          />

          <!-- Process Filter -->
          <MultiSelect
            v-model="selectedProcesses"
            :options="filteredProcesses"
            label="Process"
            placeholder="Select Process..."
            @update:model-value="handleProcessChange"
          />

          <!-- Model Filter -->
          <MultiSelect
            v-model="selectedModels"
            :options="filteredModels"
            label="Model"
            placeholder="Select Model..."
          />

          <!-- Category Search -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category Keyword</label>
            <input
              v-model="categorySearch"
              type="text"
              placeholder="Search Category..."
              class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm w-[200px]"
              @keyup.enter="handleSearch"
            />
          </div>

          <!-- Account Search -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Keyword</label>
            <input
              v-model="accountSearch"
              type="text"
              placeholder="Search Account..."
              class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm w-[200px]"
              @keyup.enter="handleSearch"
            />
          </div>

          <!-- Search Button -->
          <button
            @click="handleSearch"
            :disabled="selectedProjects.length === 0 && selectedProcesses.length === 0 && selectedModels.length === 0 && !categorySearch && !accountSearch"
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
import { emailInfoApi } from '../api'
import MultiSelect from '../../../shared/components/MultiSelect.vue'
import FilterBookmarks from '../../../shared/components/FilterBookmarks.vue'
import { useFilterBookmarks } from '../../../shared/composables/useFilterBookmarks'

defineProps({
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['filter-change', 'toggle'])

const { bookmarks, add: addBookmark, remove: removeBookmark } = useFilterBookmarks('emailInfo')

const projects = ref([])
const selectedProjects = ref([])
const allProcesses = ref([])
const filteredProcesses = ref([])
const selectedProcesses = ref([])
const allModels = ref([])
const filteredModels = ref([])
const selectedModels = ref([])
const categorySearch = ref('')
const accountSearch = ref('')

// Summary text when filter bar is collapsed
const filterSummary = computed(() => {
  const parts = []
  if (selectedProjects.value.length) parts.push(`Project: ${selectedProjects.value.length}`)
  if (selectedProcesses.value.length) parts.push(`Process: ${selectedProcesses.value.length}`)
  if (selectedModels.value.length) parts.push(`Model: ${selectedModels.value.length}`)
  if (categorySearch.value) parts.push(`Category: "${categorySearch.value}"`)
  if (accountSearch.value) parts.push(`Account: "${accountSearch.value}"`)
  return parts.length ? parts.join(', ') : 'No filters'
})

const fetchProjects = async () => {
  try {
    const response = await emailInfoApi.getProjects()
    projects.value = response.data
  } catch (error) {
    console.error('Failed to fetch projects:', error)
  }
}

const fetchProcesses = async (projectFilter) => {
  try {
    const response = await emailInfoApi.getProcessesFromCategory(projectFilter)
    allProcesses.value = response.data
    filteredProcesses.value = response.data
  } catch (error) {
    console.error('Failed to fetch processes:', error)
  }
}

const fetchModels = async (projectFilter, processFilter) => {
  try {
    const response = await emailInfoApi.getModelsFromCategory(projectFilter, processFilter)
    allModels.value = response.data
    filteredModels.value = response.data
  } catch (error) {
    console.error('Failed to fetch models:', error)
  }
}

const handleProjectChange = async (newProjects) => {
  // Reset dependent filters
  selectedProcesses.value = []
  selectedModels.value = []

  // Fetch processes based on selected projects
  const projectFilter = newProjects.length > 0 ? newProjects.join(',') : null
  await fetchProcesses(projectFilter)
  await fetchModels(projectFilter, null)
}

const handleProcessChange = async (newProcesses) => {
  // Reset model filter
  selectedModels.value = []

  // Fetch models based on selected projects and processes
  const projectFilter = selectedProjects.value.length > 0 ? selectedProjects.value.join(',') : null
  const processFilter = newProcesses.length > 0 ? newProcesses.join(',') : null
  await fetchModels(projectFilter, processFilter)
}

const handleSearch = () => {
  if (selectedProjects.value.length === 0 && selectedProcesses.value.length === 0 && selectedModels.value.length === 0 && !categorySearch.value && !accountSearch.value) {
    return
  }

  emit('filter-change', {
    projects: selectedProjects.value,
    processes: selectedProcesses.value,
    models: selectedModels.value,
    category: categorySearch.value,
    account: accountSearch.value
  })
}

const handleClear = () => {
  selectedProjects.value = []
  selectedProcesses.value = []
  selectedModels.value = []
  categorySearch.value = ''
  accountSearch.value = ''
  // Reset to full lists
  filteredProcesses.value = allProcesses.value
  filteredModels.value = allModels.value
  emit('filter-change', null)
}

// Bookmark handlers
const hasActiveFilters = computed(() =>
  selectedProjects.value.length > 0 || selectedProcesses.value.length > 0 || selectedModels.value.length > 0 || categorySearch.value || accountSearch.value
)

const handleSaveBookmark = (name) => {
  addBookmark(name, {
    projects: selectedProjects.value,
    processes: selectedProcesses.value,
    models: selectedModels.value,
    category: categorySearch.value,
    account: accountSearch.value
  })
}

const handleApplyBookmark = async (bookmark) => {
  selectedProjects.value = bookmark.filters.projects || []
  selectedProcesses.value = bookmark.filters.processes || []
  selectedModels.value = bookmark.filters.models || []
  categorySearch.value = bookmark.filters.category || ''
  accountSearch.value = bookmark.filters.account || ''

  // Refresh dependent filter options
  const projectFilter = selectedProjects.value.length > 0 ? selectedProjects.value.join(',') : null
  const processFilter = selectedProcesses.value.length > 0 ? selectedProcesses.value.join(',') : null
  await fetchProcesses(projectFilter)
  await fetchModels(projectFilter, processFilter)

  handleSearch()
}

const handleDeleteBookmark = (id) => {
  removeBookmark(id)
}

const refreshFilters = async () => {
  await fetchProjects()
  await fetchProcesses(null)
  await fetchModels(null, null)
}

onMounted(async () => {
  await refreshFilters()
})

defineExpose({ refreshFilters })
</script>
