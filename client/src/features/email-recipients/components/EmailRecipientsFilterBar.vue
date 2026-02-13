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
          <!-- App Filter -->
          <MultiSelect
            v-model="selectedApps"
            :options="apps"
            label="App"
            placeholder="Select App..."
            @update:model-value="handleAppChange"
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
            @update:model-value="handleModelChange"
          />

          <!-- Code Filter -->
          <MultiSelect
            v-model="selectedCodes"
            :options="filteredCodes"
            label="Code"
            placeholder="Select Code..."
          />

          <!-- Email Category Search -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Category</label>
            <input
              v-model="emailCategorySearch"
              type="text"
              placeholder="Search Category..."
              class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm w-[200px]"
              @keyup.enter="handleSearch"
            />
          </div>

          <!-- Search Button -->
          <button
            @click="handleSearch"
            :disabled="!hasActiveFilters"
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
import { emailRecipientsApi } from '../api'
import MultiSelect from '../../../shared/components/MultiSelect.vue'
import FilterBookmarks from '../../../shared/components/FilterBookmarks.vue'
import { useFilterBookmarks } from '../../../shared/composables/useFilterBookmarks'
import { useProcessFilterStore } from '../../../shared/stores/processFilter'
import { useAuthStore } from '../../../shared/stores/auth'

defineProps({
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['filter-change', 'toggle'])

const { bookmarks, add: addBookmark, remove: removeBookmark } = useFilterBookmarks('emailRecipients')

const processFilterStore = useProcessFilterStore()
const authStore = useAuthStore()

const apps = ref([])
const selectedApps = ref([])
const allProcesses = ref([])
const filteredProcesses = ref([])
const selectedProcesses = ref([])
const allModels = ref([])
const filteredModels = ref([])
const selectedModels = ref([])
const allCodes = ref([])
const filteredCodes = ref([])
const selectedCodes = ref([])
const emailCategorySearch = ref('')

// Summary text when filter bar is collapsed
const filterSummary = computed(() => {
  const parts = []
  if (selectedApps.value.length) parts.push(`App: ${selectedApps.value.length}`)
  if (selectedProcesses.value.length) parts.push(`Process: ${selectedProcesses.value.length}`)
  if (selectedModels.value.length) parts.push(`Model: ${selectedModels.value.length}`)
  if (selectedCodes.value.length) parts.push(`Code: ${selectedCodes.value.length}`)
  if (emailCategorySearch.value) parts.push(`Category: "${emailCategorySearch.value}"`)
  return parts.length ? parts.join(', ') : 'No filters'
})

const hasActiveFilters = computed(() =>
  selectedApps.value.length > 0 ||
  selectedProcesses.value.length > 0 ||
  selectedModels.value.length > 0 ||
  selectedCodes.value.length > 0 ||
  emailCategorySearch.value
)

const fetchApps = async () => {
  try {
    const response = await emailRecipientsApi.getApps()
    apps.value = response.data
  } catch (error) {
    console.error('Failed to fetch apps:', error)
  }
}

const fetchProcesses = async (appFilter) => {
  try {
    const response = await emailRecipientsApi.getProcesses(appFilter)
    // Store all processes and filter based on user's access
    processFilterStore.setProcesses('emailRecipients', response.data)
    const filtered = processFilterStore.getFilteredProcesses('emailRecipients')
    allProcesses.value = filtered
    filteredProcesses.value = filtered
  } catch (error) {
    console.error('Failed to fetch processes:', error)
  }
}

const fetchModels = async (appFilter, processFilter) => {
  try {
    // 관리자/MASTER가 아닌 경우 userProcesses 전달하여 필터링
    const userProcesses = processFilterStore.canViewAllProcesses
      ? null
      : processFilterStore.getUserProcessList()

    const response = await emailRecipientsApi.getModels(appFilter, processFilter, userProcesses)
    allModels.value = response.data
    filteredModels.value = response.data
  } catch (error) {
    console.error('Failed to fetch models:', error)
  }
}

const fetchCodes = async (appFilter, processFilter, modelFilter) => {
  try {
    // 관리자/MASTER가 아닌 경우 userProcesses 전달하여 필터링
    const userProcesses = processFilterStore.canViewAllProcesses
      ? null
      : processFilterStore.getUserProcessList()

    const response = await emailRecipientsApi.getCodes(appFilter, processFilter, modelFilter, userProcesses)
    allCodes.value = response.data
    filteredCodes.value = response.data
  } catch (error) {
    console.error('Failed to fetch codes:', error)
  }
}

const handleAppChange = async (newApps) => {
  // Reset dependent filters
  selectedProcesses.value = []
  selectedModels.value = []
  selectedCodes.value = []

  const appFilter = newApps.length > 0 ? newApps.join(',') : null
  await fetchProcesses(appFilter)
  await fetchModels(appFilter, null)
  await fetchCodes(appFilter, null, null)
}

const handleProcessChange = async (newProcesses) => {
  // Reset dependent filters
  selectedModels.value = []
  selectedCodes.value = []

  const appFilter = selectedApps.value.length > 0 ? selectedApps.value.join(',') : null
  const processFilter = newProcesses.length > 0 ? newProcesses.join(',') : null
  await fetchModels(appFilter, processFilter)
  await fetchCodes(appFilter, processFilter, null)
}

const handleModelChange = async (newModels) => {
  // Reset dependent filters
  selectedCodes.value = []

  const appFilter = selectedApps.value.length > 0 ? selectedApps.value.join(',') : null
  const processFilter = selectedProcesses.value.length > 0 ? selectedProcesses.value.join(',') : null
  const modelFilter = newModels.length > 0 ? newModels.join(',') : null
  await fetchCodes(appFilter, processFilter, modelFilter)
}

const handleSearch = () => {
  if (!hasActiveFilters.value) return

  // 관리자/MASTER가 아닌 경우 userProcesses 전달 (키워드 검색 시 process 권한 필터링용)
  const userProcesses = processFilterStore.canViewAllProcesses
    ? null
    : processFilterStore.getUserProcessList()

  emit('filter-change', {
    apps: selectedApps.value,
    processes: selectedProcesses.value,
    models: selectedModels.value,
    codes: selectedCodes.value,
    emailCategory: emailCategorySearch.value,
    userProcesses
  })
}

const handleClear = () => {
  selectedApps.value = []
  selectedProcesses.value = []
  selectedModels.value = []
  selectedCodes.value = []
  emailCategorySearch.value = ''
  // Reset to full lists
  filteredProcesses.value = allProcesses.value
  filteredModels.value = allModels.value
  filteredCodes.value = allCodes.value
  emit('filter-change', null)
}

// Bookmark handlers
const handleSaveBookmark = (name) => {
  addBookmark(name, {
    apps: selectedApps.value,
    processes: selectedProcesses.value,
    models: selectedModels.value,
    codes: selectedCodes.value,
    emailCategory: emailCategorySearch.value
  })
}

const handleApplyBookmark = async (bookmark) => {
  selectedApps.value = bookmark.filters.apps || []
  selectedProcesses.value = bookmark.filters.processes || []
  selectedModels.value = bookmark.filters.models || []
  selectedCodes.value = bookmark.filters.codes || []
  emailCategorySearch.value = bookmark.filters.emailCategory || ''

  // Refresh dependent filter options
  const appFilter = selectedApps.value.length > 0 ? selectedApps.value.join(',') : null
  const processFilter = selectedProcesses.value.length > 0 ? selectedProcesses.value.join(',') : null
  const modelFilter = selectedModels.value.length > 0 ? selectedModels.value.join(',') : null
  await fetchProcesses(appFilter)
  await fetchModels(appFilter, processFilter)
  await fetchCodes(appFilter, processFilter, modelFilter)

  handleSearch()
}

const handleDeleteBookmark = (id) => {
  removeBookmark(id)
}

const refreshFilters = async () => {
  await fetchApps()
  await fetchProcesses(null)
  await fetchModels(null, null)
  await fetchCodes(null, null, null)
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
