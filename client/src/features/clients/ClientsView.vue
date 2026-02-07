<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClientData } from './composables/useClientData'
import { useConfigManager } from './composables/useConfigManager'
import { clientControlApi, serviceApi } from './api'
import ClientFilterBar from './components/ClientFilterBar.vue'
import ClientToolbar from './components/ClientToolbar.vue'
import ClientDataGrid from './components/ClientDataGrid.vue'
import ConfigManagerModal from './components/ConfigManagerModal.vue'
import LogViewerModal from './components/LogViewerModal.vue'

const router = useRouter()

// Config Manager
const configManager = useConfigManager()

// Log Viewer state
const logModalOpen = ref(false)
const logModalClient = ref({ name: '', eqpId: '' })

// Service status state (RPC-based real-time status)
const serviceStatuses = ref({})  // { [eqpId]: { running, pid, uptime, loading, error } }

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

// Fetch all service statuses via batch RPC
const fetchAllServiceStatuses = async () => {
  if (!clients.value.length) return

  const eqpIds = clients.value.map(c => c.eqpId || c.id).filter(Boolean)
  if (!eqpIds.length) return

  // Set all to loading state
  const loadingState = {}
  for (const id of eqpIds) {
    loadingState[id] = { loading: true }
  }
  serviceStatuses.value = { ...serviceStatuses.value, ...loadingState }

  try {
    const response = await clientControlApi.getBatchStatus(eqpIds)
    const statuses = response.data || {}
    serviceStatuses.value = { ...serviceStatuses.value, ...statuses }
  } catch (err) {
    // Set error state for all
    const errorState = {}
    for (const id of eqpIds) {
      errorState[id] = { error: 'Failed to fetch status' }
    }
    serviceStatuses.value = { ...serviceStatuses.value, ...errorState }
  }
}

// Computed: merge clients with service statuses
const clientsWithStatus = computed(() => {
  return clients.value.map(client => ({
    ...client,
    serviceStatus: serviceStatuses.value[client.eqpId || client.id] || null
  }))
})

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
    gridRef.value?.restoreSelection(selectedIds.value)
    fetchAllServiceStatuses()
    showToast('All statuses updated', 'success')
  } catch (err) {
    showToast(err.message || 'Failed to refresh', 'error')
  }
}

// Control handler (Start/Stop/Restart/Status)
const handleControl = async (action) => {
  if (!selectedIds.value.length) {
    showToast('Please select at least one client', 'warning')
    return
  }

  // Status: 선택된 클라이언트만 상태 갱신 (페이지 새로고침 없음)
  if (action === 'status') {
    // 선택된 클라이언트를 loading 상태로 설정
    for (const eqpId of selectedIds.value) {
      serviceStatuses.value[eqpId] = { loading: true }
    }

    let successCount = 0
    let failCount = 0

    for (const eqpId of selectedIds.value) {
      try {
        const response = await clientControlApi.getStatus(eqpId)
        if (response.data.success !== false) {
          serviceStatuses.value[eqpId] = response.data
          successCount++
        } else {
          serviceStatuses.value[eqpId] = { error: 'Failed' }
          failCount++
        }
      } catch (err) {
        serviceStatuses.value[eqpId] = { error: err.message }
        failCount++
      }
    }

    if (failCount === 0) {
      showToast(`Status checked for ${successCount} client(s)`, 'success')
    } else {
      showToast(`Status check: ${successCount} succeeded, ${failCount} failed`, 'warning')
    }
    return
  }

  // Kill: Force kill handling
  if (action === 'kill') {
    if (!confirm(`Are you sure you want to force kill ${selectedIds.value.length} client(s)? This will forcefully terminate the processes.`)) {
      return
    }

    let successCount = 0
    let failCount = 0

    for (const eqpId of selectedIds.value) {
      try {
        const response = await serviceApi.executeAction(eqpId, 'kill')
        const result = response.data?.data || response.data
        if (result.success) {
          successCount++
        } else {
          failCount++
        }
      } catch (err) {
        failCount++
      }
    }

    if (failCount === 0) {
      showToast(`Force kill sent to ${successCount} client(s)`, 'success')
    } else {
      showToast(`Force kill: ${successCount} succeeded, ${failCount} failed`, 'warning')
    }

    await refreshCurrentPage()
    await fetchAllServiceStatuses()
    gridRef.value?.restoreSelection(selectedIds.value)
    return
  }

  // Start/Stop/Restart: 기존 로직
  const actionMap = {
    start: clientControlApi.start,
    stop: clientControlApi.stop,
    restart: clientControlApi.restart
  }

  const apiFn = actionMap[action]
  if (!apiFn) {
    showToast(`Unknown action: ${action}`, 'error')
    return
  }

  let successCount = 0
  let failCount = 0

  for (const eqpId of selectedIds.value) {
    try {
      const response = await apiFn(eqpId)
      if (response.data.success) {
        successCount++
      } else {
        failCount++
      }
    } catch (err) {
      failCount++
    }
  }

  if (failCount === 0) {
    showToast(`${action.charAt(0).toUpperCase() + action.slice(1)} command sent to ${successCount} client(s)`, 'success')
  } else {
    showToast(`${action}: ${successCount} succeeded, ${failCount} failed`, 'warning')
  }

  // Refresh data after control action + restore selection
  await refreshCurrentPage()
  await fetchAllServiceStatuses()
  gridRef.value?.restoreSelection(selectedIds.value)
}

// Update handler
const handleUpdate = async () => {
  // TODO: Phase 3에서 실제 Akka 연동
  showToast('Update feature will be implemented in Phase 3', 'info')
}

// Config save handler
const handleConfigSave = async () => {
  const result = await configManager.saveCurrentFile()
  if (result?.success) {
    showToast('Config saved successfully', 'success')
  } else if (result?.error) {
    showToast(result.error, 'error')
  }
}

// Config handler - open Config Manager Modal for selected client
const handleConfig = async () => {
  if (!selectedIds.value.length) {
    showToast('Please select at least one client', 'warning')
    return
  }

  // Find the first selected client's data
  const selectedEqpId = selectedIds.value[0]
  const clientData = clients.value.find(c => (c.eqpId || c.id) === selectedEqpId)

  if (!clientData) {
    showToast('Client data not found', 'error')
    return
  }

  configManager.openConfig(clientData)
}

// Log handler - open Log Viewer Modal for selected client
const handleLog = () => {
  if (!selectedIds.value.length) {
    showToast('Please select at least one client', 'warning')
    return
  }

  const selectedEqpId = selectedIds.value[0]
  const clientData = clients.value.find(c => (c.eqpId || c.id) === selectedEqpId)

  logModalClient.value = {
    name: clientData?.name || clientData?.eqpId || selectedEqpId,
    eqpId: selectedEqpId
  }
  logModalOpen.value = true
}

// Auto-load all clients on mount
onMounted(async () => {
  hasSearched.value = true
  try {
    await fetchClients({}, 1, pageSize.value)
  } catch (err) {
    showToast(err.message || 'Failed to load clients', 'error')
  }
})
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
      @log="handleLog"
      @refresh="handleRefresh"
      @page-size-change="handlePageSizeChange"
      @page-change="handlePageChange"
      class="mb-4"
    />

    <!-- Loading State -->
    <div v-if="loading && !clients.length" class="flex-1 flex items-center justify-center">
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

    <!-- Data Grid -->
    <div v-else class="flex-1 min-h-0">
      <ClientDataGrid
        ref="gridRef"
        :row-data="clientsWithStatus"
        :loading="loading"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
        class="h-full bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border"
      />
    </div>

    <!-- Config Manager Modal -->
    <ConfigManagerModal
      :is-open="configManager.isOpen.value"
      :source-client="configManager.sourceClient.value"
      :config-files="configManager.configFiles.value"
      :active-file-id="configManager.activeFileId.value"
      :edited-contents="configManager.editedContents.value"
      :original-contents="configManager.originalContents.value"
      :loading="configManager.loading.value"
      :saving="configManager.saving.value"
      :show-diff="configManager.showDiff.value"
      :show-rollout="configManager.showRollout.value"
      :error="configManager.error.value"
      :active-file="configManager.activeFile.value"
      :active-content="configManager.activeContent.value"
      :active-original-content="configManager.activeOriginalContent.value"
      :has-changes="configManager.hasChanges.value"
      :active-file-has-changes="configManager.activeFileHasChanges.value"
      :changed-file-ids="configManager.changedFileIds.value"
      :global-error="configManager.error.value"
      @close="configManager.closeConfig()"
      @select-file="configManager.selectFile($event)"
      @update-content="configManager.updateContent($event)"
      @save="handleConfigSave"
      @toggle-diff="configManager.toggleDiff()"
      @toggle-rollout="configManager.toggleRollout()"
    />

    <!-- Log Viewer Modal -->
    <LogViewerModal
      :is-open="logModalOpen"
      :client-name="logModalClient.name"
      :eqp-id="logModalClient.eqpId"
      @close="logModalOpen = false"
    />

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
