<script setup>
import { ref, computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClientData } from './composables/useClientData'
import { useConfigManager } from './composables/useConfigManager'
import { useBatchActionStream } from './composables/useBatchActionStream'
import { useLogViewer } from './composables/useLogViewer'
import { serviceApi } from './api'
import { useFeaturePermission } from '@/shared/composables/useFeaturePermission'
import PermissionSettingsDialog from '@/shared/components/PermissionSettingsDialog.vue'
import ClientFilterBar from './components/ClientFilterBar.vue'
import ClientToolbar from './components/ClientToolbar.vue'
import ClientDataGrid from './components/ClientDataGrid.vue'
import ConfigManagerModal from './components/ConfigManagerModal.vue'
import LogViewerModal from './components/LogViewerModal.vue'
import ConfigSettingsModal from './components/ConfigSettingsModal.vue'
import LogSettingsModal from './components/LogSettingsModal.vue'
import UpdateSettingsModal from './components/UpdateSettingsModal.vue'
import UpdateModal from './components/UpdateModal.vue'

const router = useRouter()
const route = useRoute()
const agentGroup = computed(() => route.meta.agentGroup)

// Feature permission
const { canWrite, canDelete, isAdmin } = useFeaturePermission('arsAgent')
const showPermissionDialog = ref(false)

// Config Manager
const configManager = useConfigManager()

// Log Viewer
const logViewer = useLogViewer()

// Config Settings
const showConfigSettings = ref(false)

// Log Settings
const showLogSettings = ref(false)

// Update Settings
const showUpdateSettings = ref(false)

// Update Modal
const showUpdateModal = ref(false)
const updateTargetClients = ref([])

// SSE batch action stream
const { streaming, execute: executeStream, cancel: cancelStream } = useBatchActionStream()

// Service status state (RPC-based real-time status)
const serviceStatuses = ref({})  // { [eqpId]: { running, state, uptime, loading, error } }

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
const toast = reactive({
  show: false,
  message: '',
  type: 'success'
})

const showToast = (message, type = 'success') => {
  toast.show = true
  toast.message = message
  toast.type = type
  setTimeout(() => {
    toast.show = false
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
  } catch (err) {
    showToast(err.message || 'Failed to refresh', 'error')
    return
  }

  const eqpIds = clients.value.map(c => c.eqpId || c.id).filter(Boolean)
  if (!eqpIds.length) return

  for (const eqpId of eqpIds) {
    serviceStatuses.value[eqpId] = { loading: true }
  }

  await executeStream('status', eqpIds, agentGroup.value, (result) => {
    if (result.error) {
      serviceStatuses.value[result.eqpId] = { error: result.error }
    } else {
      serviceStatuses.value[result.eqpId] = result.data || result
    }
  })

  showToast('All statuses updated', 'success')
}

// Control handler (Start/Stop/Restart/Status)
const handleControl = async (action) => {
  if (!selectedIds.value.length) {
    showToast('Please select at least one client', 'warning')
    return
  }

  if (action === 'kill') {
    if (!confirm(`Are you sure you want to force kill ${selectedIds.value.length} client(s)? This will forcefully terminate the processes.`)) {
      return
    }
  }

  const eqpIds = selectedIds.value

  for (const eqpId of eqpIds) {
    serviceStatuses.value[eqpId] = { loading: true }
  }

  let successCount = 0
  let failCount = 0

  await executeStream(action, eqpIds, agentGroup.value, (result) => {
    if (result.error) {
      serviceStatuses.value[result.eqpId] = { error: result.error }
      failCount++
    } else {
      serviceStatuses.value[result.eqpId] = result.data || result
      successCount++
    }
  })

  const label = action.charAt(0).toUpperCase() + action.slice(1)
  if (failCount === 0) {
    showToast(`${label} completed for ${successCount} client(s)`, 'success')
  } else {
    showToast(`${label}: ${successCount} succeeded, ${failCount} failed`, 'warning')
  }
}

// Update handler - open Update Modal for selected clients
const handleUpdate = async () => {
  if (!selectedIds.value.length) {
    showToast('Please select at least one client', 'warning')
    return
  }
  const selectedClientData = selectedIds.value
    .map(id => clients.value.find(c => (c.eqpId || c.id) === id))
    .filter(Boolean)
  if (selectedClientData.length === 0) {
    showToast('Client data not found', 'error')
    return
  }
  updateTargetClients.value = selectedClientData
  showUpdateModal.value = true
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

// Config handler - open Config Manager Modal for selected clients
const handleConfig = async () => {
  if (!selectedIds.value.length) {
    showToast('Please select at least one client', 'warning')
    return
  }

  // Pass all selected clients
  const selectedClientData = selectedIds.value
    .map(id => clients.value.find(c => (c.eqpId || c.id) === id))
    .filter(Boolean)

  if (selectedClientData.length === 0) {
    showToast('Client data not found', 'error')
    return
  }

  await configManager.openConfig(selectedClientData, agentGroup.value)

  // If settings not found, show toast (modal won't open)
  if (!configManager.isOpen.value && configManager.error.value) {
    showToast(configManager.error.value, 'warning')
  }
}

// Switch client in config manager
const handleSwitchClient = (eqpId) => {
  configManager.switchClient(eqpId)
}

// Log handler - open Log Viewer Modal for selected client
const handleLog = async () => {
  if (!selectedIds.value.length) {
    showToast('Please select at least one client', 'warning')
    return
  }
  const selectedClientData = selectedIds.value
    .map(id => clients.value.find(c => (c.eqpId || c.id) === id))
    .filter(Boolean)
  if (selectedClientData.length === 0) {
    showToast('Client data not found', 'error')
    return
  }
  await logViewer.openLogViewer(selectedClientData, agentGroup.value)
  if (!logViewer.isOpen.value && logViewer.filesError.value) {
    showToast(logViewer.filesError.value, 'warning')
  }
}

// Config Settings handler
const handleConfigSettings = () => {
  showConfigSettings.value = true
}

// Log Settings handler
const handleLogSettings = () => {
  showLogSettings.value = true
}

// Update Settings handler
const handleUpdateSettings = () => {
  showUpdateSettings.value = true
}

// No auto-load on mount - user must use filters to search
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Manage and monitor your clients</p>
      </div>
      <button
        v-if="isAdmin"
        @click="showPermissionDialog = true"
        class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Permissions
      </button>
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
      :can-write="canWrite"
      :can-delete="canDelete"
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
      @config-settings="handleConfigSettings"
      @log-settings="handleLogSettings"
      @update-settings="handleUpdateSettings"
      @refresh="handleRefresh"
      @page-size-change="handlePageSizeChange"
      @page-change="handlePageChange"
      class="mb-4"
    />


    <!-- Initial State - No Search Yet -->
    <div v-if="!hasSearched" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-dark-border rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Select Filters to View Data</h3>
        <p class="text-gray-500 dark:text-gray-400 max-w-sm">
          Use the filter bar above to select processes or models, then click Search to load the data.
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading && !clients.length" class="flex-1 flex items-center justify-center">
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
      :can-write="canWrite"
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
      :current-agent-group="configManager.currentAgentGroup.value"
      :selected-clients="configManager.selectedClients.value"
      :active-client-id="configManager.activeClientId.value"
      :is-multi-mode="configManager.isMultiMode.value"
      :client-statuses="configManager.clientStatuses.value"
      @close="configManager.closeConfig()"
      @select-file="configManager.selectFile($event)"
      @update-content="configManager.updateContent($event)"
      @save="handleConfigSave"
      @discard="configManager.discardCurrentFile"
      @toggle-diff="configManager.toggleDiff()"
      @toggle-rollout="configManager.toggleRollout()"
      @switch-client="handleSwitchClient"
    />

    <!-- Permission Settings Dialog -->
    <PermissionSettingsDialog
      v-model="showPermissionDialog"
      feature="arsAgent"
      @saved="showToast('Permissions saved', 'success')"
      @error="showToast($event, 'error')"
    />

    <!-- Log Viewer Modal -->
    <LogViewerModal
      :log-viewer="logViewer"
      @close="logViewer.closeLogViewer()"
    />

    <!-- Config Settings Modal -->
    <ConfigSettingsModal
      v-model="showConfigSettings"
      :agent-group="agentGroup"
      @saved="showToast('Config settings saved', 'success')"
    />

    <!-- Log Settings Modal -->
    <LogSettingsModal
      v-model="showLogSettings"
      :agent-group="agentGroup"
      @saved="showToast('Log settings saved', 'success')"
    />

    <!-- Update Settings Modal -->
    <UpdateSettingsModal
      v-model="showUpdateSettings"
      :agent-group="agentGroup"
      @saved="showToast('Update settings saved', 'success')"
    />

    <!-- Update Modal -->
    <UpdateModal
      v-model="showUpdateModal"
      :agent-group="agentGroup"
      :target-clients="updateTargetClients"
      @deployed="showToast('Deployment completed', 'success')"
    />

    <!-- Toast Notification -->
    <div
      v-show="toast.show"
      :class="[
        'fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 transition-all duration-300',
        toast.type === 'success' ? 'bg-green-500 text-white' :
        toast.type === 'error' ? 'bg-red-500 text-white' :
        toast.type === 'warning' ? 'bg-amber-500 text-white' :
        'bg-blue-500 text-white'
      ]"
    >
      <svg v-if="toast.type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <svg v-else-if="toast.type === 'error'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <svg v-else-if="toast.type === 'warning'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>
