<template>
  <div class="flex flex-col gap-4" style="height: calc(100vh - 144px);">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
      <!-- Settings Buttons (Admin only) -->
      <div v-if="isAdmin" class="flex items-center gap-2">
        <!-- Export Column Widths -->
        <button
          v-if="hasSearched && !loading"
          @click="handleExportColumnWidths"
          class="p-2 text-sm bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 rounded-lg transition-colors"
          title="Copy column widths to clipboard"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2v-4" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 14h10m-3-3l3 3-3 3" />
          </svg>
        </button>
        <button
          @click="showPermissionDialog = true"
          class="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          title="Feature Permissions"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Feature Permissions
        </button>
        <button
          @click="showRoleDialog = true"
          class="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Role Permissions
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <UserFilterBar
      ref="filterBarRef"
      :collapsed="filterCollapsed"
      @toggle="filterCollapsed = !filterCollapsed"
      @filter-change="handleFilterChange"
    />

    <!-- Toolbar -->
    <BaseDataGridToolbar
      :selected-count="selectedIds.length"
      :has-changes="hasUnsavedChanges"
      :saving="saving"
      :total-count="totalRecords"
      :page-size="pageSize"
      :current-page="currentPage"
      :total-pages="totalPages"
      :can-write="canWrite"
      :can-delete="canDelete"
      @add="handleAddRow"
      @delete="handleDeleteClick"
      @save="handleSave"
      @discard="handleDiscard"
      @page-size-change="handlePageSizeChange"
      @page-change="handlePageChange"
    />

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
        <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading users...</span>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="text-red-500 dark:text-red-400 mb-2">
          <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p class="text-gray-600 dark:text-gray-400">{{ error }}</p>
        <button
          @click="refreshCurrentPage"
          class="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Initial State -->
    <div v-else-if="!hasSearched" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-dark-border rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">User Management</h3>
        <p class="text-gray-500 dark:text-gray-400 max-w-sm mb-4">
          Use the filter bar above to search for users, or click "Add" to create a new user.
        </p>
        <button
          @click="loadAllUsers"
          class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition"
        >
          Load All Users
        </button>
      </div>
    </div>

    <!-- Data Grid -->
    <div v-else class="flex-1 min-h-0">
      <UserDataGrid
        ref="gridRef"
        :row-data="currentData"
        :validation-errors="validationErrors"
        :modified-rows="modifiedRowsSet"
        :modified-cells="modifiedCells"
        :new-rows="newRowsSet"
        :deleted-rows="deletedRowsSet"
        :available-processes="availableProcesses"
        @cell-edit="handleCellEdit"
        @selection-change="handleSelectionChange"
        @paste-rows="handlePasteRows"
        @paste-cells="handlePasteCells"
        @approve-user="handleApproveUser"
        @approve-reset="handleApprovePasswordReset"
      />
    </div>

    <!-- Delete Confirmation Modal -->
    <DeleteConfirmModal
      v-model="showDeleteModal"
      :count="selectedIds.length"
      @confirm="handleDeleteConfirm"
    />

    <!-- Role Permission Dialog -->
    <RolePermissionDialog
      v-model="showRoleDialog"
      @saved="handleRolesSaved"
      @error="handleRolesError"
    />

    <!-- Feature Permission Settings Dialog (Admin only) -->
    <PermissionSettingsDialog
      v-model="showPermissionDialog"
      feature="users"
      @saved="handlePermissionsSaved"
      @error="handlePermissionsError"
    />

    <!-- Toast Notification -->
    <Teleport to="body">
      <div
        v-if="toast.show"
        class="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg"
        :class="{
          'bg-green-500 text-white': toast.type === 'success',
          'bg-red-500 text-white': toast.type === 'error',
          'bg-amber-500 text-white': toast.type === 'warning',
        }"
      >
        <svg v-if="toast.type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else-if="toast.type === 'error'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{{ toast.message }}</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import UserFilterBar from './components/UserFilterBar.vue'
import BaseDataGridToolbar from '@/shared/components/BaseDataGridToolbar.vue'
import UserDataGrid from './components/UserDataGrid.vue'
import DeleteConfirmModal from './components/DeleteConfirmModal.vue'
import RolePermissionDialog from './components/RolePermissionDialog.vue'
import PermissionSettingsDialog from '@/shared/components/PermissionSettingsDialog.vue'
import { useUserData } from './composables/useUserData'
import { useToast } from '@/shared/composables/useToast'
import { useFeaturePermission } from '@/shared/composables/useFeaturePermission'
import { useProcessPermission } from '@/shared/composables/useProcessPermission'
import { usersApi } from './api'
import { clientListApi } from '../clients/api'

const gridRef = ref(null)
const filterBarRef = ref(null)
const selectedIds = ref([])
const showDeleteModal = ref(false)
const showRoleDialog = ref(false)
const showPermissionDialog = ref(false)
const hasSearched = ref(false)
const filterCollapsed = ref(false)
const availableProcesses = ref([])
const { toast, showToast } = useToast()

// Fetch available processes from EQP_INFO for the multi-select editor
const fetchAvailableProcesses = async () => {
  try {
    const response = await clientListApi.getProcesses()
    availableProcesses.value = response.data || []
  } catch (err) {
    console.error('Failed to fetch processes:', err)
  }
}
fetchAvailableProcesses()

// Permission hooks
const { canRead, canWrite, canDelete, isAdmin, refresh: refreshPermissions } = useFeaturePermission('users')
const { buildUserProcessFilter } = useProcessPermission()

const {
  currentData,
  loading,
  saving,
  error,
  hasUnsavedChanges,
  validationErrors,
  currentPage,
  totalRecords,
  totalPages,
  pageSize,
  fetchData,
  changePage,
  changePageSize,
  refreshCurrentPage,
  trackChange,
  addNewRow,
  addMultipleRows,
  markForDeletion,
  validate,
  save,
  discardChanges,
  resetAllData,
  isRowModified,
  isRowNew,
  isRowDeleted,
  getModifiedRowData,
  removeFromModifiedRows,
  modifiedCells,
  newRows,
  deletedRows
} = useUserData()

const modifiedRowsSet = computed(() => {
  const set = new Set()
  for (const row of currentData.value) {
    if (row._id && isRowModified(row._id)) {
      set.add(row._id)
    }
  }
  return set
})

const newRowsSet = computed(() => {
  const set = new Set()
  for (const row of currentData.value) {
    if (row._tempId && isRowNew(row._tempId)) {
      set.add(row._tempId)
    }
  }
  return set
})

const deletedRowsSet = computed(() => {
  // Directly return deletedRows to ensure Vue tracks the dependency
  return deletedRows.value
})

const loadAllUsers = async () => {
  hasSearched.value = true
  try {
    // Apply user process permissions filter
    const userProcesses = buildUserProcessFilter()
    const filters = userProcesses ? { userProcesses } : {}
    await fetchData(filters, 1, pageSize.value)
  } catch (err) {
    showToast('error', 'Failed to load users')
  }
}

const handleFilterChange = async (filters) => {
  if (!filters) {
    hasSearched.value = false
    resetAllData()
    return
  }

  discardChanges()
  hasSearched.value = true

  try {
    await fetchData(filters, 1, pageSize.value)
  } catch (err) {
    showToast('error', 'Failed to load users')
  }
}

const handlePageSizeChange = async (newSize) => {
  try {
    await changePageSize(newSize)
  } catch (err) {
    showToast('error', 'Failed to change page size')
  }
}

const handlePageChange = async (newPage) => {
  try {
    await changePage(newPage)
  } catch (err) {
    showToast('error', 'Failed to change page')
  }
}

const handleCellEdit = (rowId, field, newValue) => {
  trackChange(rowId, field, newValue)
}

const handleSelectionChange = (ids) => {
  selectedIds.value = ids
}

const handleAddRow = (count = 1) => {
  hasSearched.value = true
  for (let i = 0; i < count; i++) {
    addNewRow()
  }
  showToast('success', `${count} user${count > 1 ? 's' : ''} added`)
}

const handleDeleteClick = () => {
  if (selectedIds.value.length === 0) return
  showDeleteModal.value = true
}

const handleDeleteConfirm = () => {
  markForDeletion(selectedIds.value)
  selectedIds.value = []
  if (gridRef.value) {
    gridRef.value.clearSelection()
  }
  showToast('warning', 'Users marked for deletion. Save to apply.')
}

const handleSave = async () => {
  if (!validate()) {
    showToast('error', 'Please fix validation errors before saving')
    return
  }

  const result = await save()

  if (result.success) {
    let message = 'Changes saved successfully'
    const parts = []
    if (result.created > 0) parts.push(`${result.created} created`)
    if (result.updated > 0) parts.push(`${result.updated} updated`)
    if (result.deleted > 0) parts.push(`${result.deleted} deleted`)
    if (parts.length > 0) message = parts.join(', ')

    showToast('success', message)
    await filterBarRef.value?.refreshFilters()
    await fetchAvailableProcesses()  // Refresh available processes for multi-select editor
    await refreshCurrentPage()
    selectedIds.value = []
  } else if (result.errors?.length > 0) {
    showToast('error', `Save failed: ${result.errors.length} errors`)
  } else {
    showToast('error', result.message || 'Save failed')
  }
}

const handleDiscard = () => {
  discardChanges()
  selectedIds.value = []
  if (gridRef.value) {
    gridRef.value.clearSelection()
  }
  showToast('warning', 'Changes discarded')
}

const handlePasteRows = (rows) => {
  if (!rows || rows.length === 0) return
  hasSearched.value = true
  addMultipleRows(rows)
  showToast('success', `${rows.length} users pasted`)
}

const handlePasteCells = (cellUpdates) => {
  if (!cellUpdates || cellUpdates.length === 0) return
  for (const { rowId, field, value } of cellUpdates) {
    trackChange(rowId, field, value)
  }
  if (gridRef.value) {
    gridRef.value.refreshCells()
  }
  showToast('success', `${cellUpdates.length} cells updated`)
}

const handleRolesSaved = () => {
  showToast('success', 'Role permissions updated')
}

const handleRolesError = (message) => {
  showToast('error', message)
}

const handlePermissionsSaved = async () => {
  showToast('success', 'Feature permissions updated')
  await refreshPermissions()
}

const handlePermissionsError = (message) => {
  showToast('error', message)
}

const handleApproveUser = async (userId) => {
  try {
    // Get modified data for this row (if any)
    const modifiedData = getModifiedRowData(userId)

    // Call API with modified data (will be saved before approval)
    await usersApi.approveUser(userId, modifiedData || {})

    // Remove from modified tracking if there were changes
    if (modifiedData) {
      removeFromModifiedRows(userId)
    }

    showToast('success', modifiedData ? 'User changes saved and account approved' : 'User account approved')
    await refreshCurrentPage()
  } catch (err) {
    showToast('error', err.response?.data?.error || 'Failed to approve user')
  }
}

const handleExportColumnWidths = () => {
  const text = gridRef.value?.exportColumnWidths?.()
  if (text) showToast('success', 'Column widths copied to clipboard')
}

const handleApprovePasswordReset = async (userId) => {
  try {
    await usersApi.approvePasswordReset(userId)
    showToast('success', 'Password reset approved')
    await refreshCurrentPage()
  } catch (err) {
    showToast('error', err.response?.data?.error || 'Failed to approve password reset')
  }
}
</script>
