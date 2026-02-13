<template>
  <BaseFilterBar
    :collapsed="collapsed"
    :has-active-filters="hasActiveFilters"
    :filter-summary="filterSummary"
    :search-disabled="false"
    :bookmarks="bookmarks"
    @toggle="$emit('toggle')"
    @search="handleSearch"
    @clear="handleClear"
    @bookmark-save="handleSaveBookmark"
    @bookmark-apply="handleApplyBookmark"
    @bookmark-delete="handleDeleteBookmark"
  >
    <template #filters>
      <!-- Process Filter -->
      <MultiSelect
        v-model="selectedProcesses"
        :options="processes"
        label="Process"
        placeholder="Select Process..."
        @update:model-value="onProcessChange"
      />

      <!-- Model Filter -->
      <MultiSelect
        v-model="selectedModels"
        :options="availableModels"
        label="Model"
        placeholder="Select Model..."
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
    </template>
  </BaseFilterBar>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { clientListApi } from '../api'
import MultiSelect from '../../../shared/components/MultiSelect.vue'
import BaseFilterBar from '../../../shared/components/BaseFilterBar.vue'
import { useFilterBar } from '../../../shared/composables/useFilterBar'

defineProps({
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['filter-change', 'toggle'])

// Filter bar composable
const {
  processes,
  filteredModels,
  bookmarks,
  handleSaveBookmark: saveBookmark,
  handleDeleteBookmark,
  buildSearchFilters,
  refreshFilters,
  handleProcessChange,
  getAvailableModels
} = useFilterBar({
  pageKey: 'clients',
  processSource: 'clients',
  api: clientListApi
})

// Local filter state
const selectedProcesses = ref([])
const selectedModels = ref([])
const selectedStatus = ref([])
const ipSearch = ref('')

const statusOptions = ['online', 'offline']

// Computed: available models based on process selection
const availableModels = getAvailableModels(selectedProcesses)

// Computed: filter summary for collapsed state
const filterSummary = computed(() => {
  const parts = []
  if (selectedProcesses.value.length) parts.push(`Process: ${selectedProcesses.value.length}`)
  if (selectedModels.value.length) parts.push(`Model: ${selectedModels.value.length}`)
  if (selectedStatus.value.length) parts.push(`Status: ${selectedStatus.value.length}`)
  if (ipSearch.value) parts.push(`IP: "${ipSearch.value}"`)
  return parts.length ? parts.join(', ') : 'No filters'
})

// Computed: has active filters
const hasActiveFilters = computed(() =>
  selectedProcesses.value.length > 0 ||
  selectedModels.value.length > 0 ||
  selectedStatus.value.length > 0 ||
  ipSearch.value
)

// Handlers
const onProcessChange = async (newProcesses) => {
  await handleProcessChange(newProcesses, selectedModels)
}

const handleSearch = () => {
  const filters = buildSearchFilters({
    processes: selectedProcesses.value,
    models: selectedModels.value,
    status: selectedStatus.value,
    ipSearch: ipSearch.value
  })

  emit('filter-change', filters)
}

const handleClear = () => {
  selectedProcesses.value = []
  selectedModels.value = []
  selectedStatus.value = []
  ipSearch.value = ''
  filteredModels.value = []
  emit('filter-change', null)
}

const handleSaveBookmark = (name) => {
  saveBookmark(name, {
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
    await handleProcessChange(selectedProcesses.value, selectedModels)
  }

  handleSearch()
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
