<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClientData } from './composables/useClientData'
import ClientFilterBar from './components/ClientFilterBar.vue'
import ClientToolbar from './components/ClientToolbar.vue'
import ClientDataGrid from './components/ClientDataGrid.vue'

const router = useRouter()

// Composable state
const {
  clients,
  loading,
  error,
  selectedIds,
  hasSelection,
  operating,
  currentPage,
  totalRecords,
  totalPages,
  pageSize,
  fetchClients,
  changePage,
  changePageSize,
  refreshCurrentPage,
  setSelectedIds,
  resetAllData,
  controlClients,
  updateClients,
  configClients,
} = useClientData()

// Component refs
const filterBarRef = ref(null)
const gridRef = ref(null)

// Initial state
const hasSearched = ref(false)
const filterCollapsed = ref(false)

// Toggle filter bar collapse
const handleFilterToggle = () => {
  filterCollapsed.value = !filterCollapsed.value
}

// Toast notification
const toast = ref({
  show: false,
  message: '',
  type: 'success'
})

const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

// Filter change handler
const handleFilterChange = async (filters) => {
  if (filters === null) {
    resetAllData()
    hasSearched.value = false
    return
  }

  hasSearched.value = true
  try {
    await fetchClients(filters, 1, pageSize.value)
  } catch (err) {
    showToast(err.message || 'Failed to fetch clients', 'error')
  }
}

// Selection change handler
const handleSelectionChange = (ids) => {
  setSelectedIds(ids)
}

// Row click handler - navigate to detail page
const handleRowClick = (client) => {
  router.push(`/clients/${client.eqpId || client.id}`)
}

// Page change handler
const handlePageChange = async (page) => {
  try {
    await changePage(page)
  } catch (err) {
    showToast(err.message || 'Failed to change page', 'error')
  }
}

// Page size change handler
const handlePageSizeChange = async (size) => {
  try {
    await changePageSize(size)
  } catch (err) {
    showToast(err.message || 'Failed to change page size', 'error')
  }
}

// Refresh handler
const handleRefresh = async () => {
  try {
    await refreshCurrentPage()
    showToast('Data refreshed', 'success')
  } catch (err) {
    showToast(err.message || 'Failed to refresh', 'error')
  }
}

// Control handler (Start/Stop/Restart)
const handleControl = async (action) => {
  // TODO: Phase 3에서 실제 Akka 연동
  showToast(`${action.charAt(0).toUpperCase() + action.slice(1)} command will be implemented in Phase 3`, 'info')
}

// Update handler
const handleUpdate = async () => {
  // TODO: Phase 3에서 실제 Akka 연동
  showToast('Update feature will be implemented in Phase 3', 'info')
}

// Config handler
const handleConfig = async () => {
  // TODO: Phase 3에서 실제 Akka 연동
  showToast('Config feature will be implemented in Phase 3', 'info')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Manage and monitor your clients</p>
    </div>

    <!-- Filter Bar -->
    <ClientFilterBar
      ref="filterBarRef"
      :collapsed="filterCollapsed"
      @toggle="handleFilterToggle"
      @filter-change="handleFilterChange"
      class="mb-4"
    />

    <!-- Toolbar -->
    <ClientToolbar
      v-if="hasSearched"
      :selected-count="selectedIds.length"
      :operating="operating"
      :loading="loading"
      :total-count="totalRecords"
      :page-size="pageSize"
      :current-page="currentPage"
      :total-pages="totalPages"
      @control="handleControl"
      @update="handleUpdate"
      @config="handleConfig"
      @refresh="handleRefresh"
      @page-size-change="handlePageSizeChange"
      @page-change="handlePageChange"
      class="mb-4"
    />

    <!-- Loading State -->
    <div v-if="loading && !hasSearched" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-4">
        <svg class="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <svg class="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p class="text-red-600 dark:text-red-400">{{ error }}</p>
        <button
          @click="handleRefresh"
          class="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Initial State (before search) -->
    <div v-else-if="!hasSearched" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p class="text-gray-500 dark:text-gray-400 text-lg">Select filters and click Search to view clients</p>
      </div>
    </div>

    <!-- Data Grid -->
    <div v-else class="flex-1 min-h-0">
      <ClientDataGrid
        ref="gridRef"
        :row-data="clients"
        :loading="loading"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
        class="h-full bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border"
      />
    </div>

    <!-- Toast Notification -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="translate-y-4 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div
        v-if="toast.show"
        :class="[
          'fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50',
          toast.type === 'success' ? 'bg-green-500 text-white' :
          toast.type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        ]"
      >
        <svg v-if="toast.type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else-if="toast.type === 'error'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ toast.message }}</span>
      </div>
    </Transition>
  </div>
</template>
