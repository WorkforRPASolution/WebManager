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
        :operation-mode="operationMode"
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

    <!-- Feature Permission Settings Dialog (Admin only) -->
    <PermissionSettingsDialog
      v-model="showPermissionDialog"
      feature="users"
      @saved="handlePermissionsSaved"
      @error="handlePermissionsError"
    />

    <!-- Password Reset Confirm Modal -->
    <Teleport to="body">
      <div v-if="showResetConfirmModal" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50" @click="showResetConfirmModal = false" />
        <div class="relative bg-white dark:bg-dark-card rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Approve Password Reset</h3>
          <div class="space-y-3">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              <template v-if="operationMode === 'integrated'">
                A temporary password will be generated. Enter the user's email to send it automatically.
              </template>
              <template v-else>
                A temporary password will be generated. Please share it with the user manually.
              </template>
            </p>
            <div v-if="operationMode === 'integrated'">
              <!-- Email input mode toggle -->
              <div class="flex gap-2 mb-2">
                <button
                  @click="resetEmailMode = 'manual'"
                  class="px-3 py-1 text-xs font-medium rounded-lg transition"
                  :class="resetEmailMode === 'manual'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
                >
                  Manual Input
                </button>
                <button
                  @click="resetEmailMode = 'ears'"
                  class="px-3 py-1 text-xs font-medium rounded-lg transition"
                  :class="resetEmailMode === 'ears'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
                >
                  EARS Search
                </button>
              </div>
              <!-- Manual email input -->
              <div v-if="resetEmailMode === 'manual'">
                <label class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email (optional)</label>
                <input
                  v-model="resetConfirmEmail"
                  type="email"
                  placeholder="user@example.com"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-border text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  @keyup.enter="confirmPasswordReset"
                />
              </div>
              <!-- EARS search -->
              <div v-else>
                <EarsUserSearch
                  @select="handleEarsUserSelect"
                  @clear="resetConfirmEmail = ''"
                />
              </div>
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-2">
            <button
              @click="showResetConfirmModal = false"
              class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 font-medium rounded-lg transition"
            >
              Cancel
            </button>
            <button
              @click="confirmPasswordReset"
              class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition"
            >
              Approve
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Temporary Password Modal -->
    <Teleport to="body">
      <div v-if="showTempPasswordModal" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50" />
        <div class="relative bg-white dark:bg-dark-card rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Password Reset Approved</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">User ID</label>
              <div class="px-3 py-2 bg-gray-100 dark:bg-dark-border rounded-lg text-gray-900 dark:text-white font-mono">
                {{ tempPasswordData.singleid }}
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Temporary Password</label>
              <div class="flex items-center gap-2">
                <div class="flex-1 px-3 py-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-200 font-mono text-lg tracking-wider">
                  {{ tempPasswordData.tempPassword }}
                </div>
                <button
                  @click="copyTempPassword"
                  class="p-2 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  title="Copy password"
                >
                  <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            <p class="text-sm text-amber-600 dark:text-amber-400">
              Please share this temporary password with the user. They will be required to change it on next login.
            </p>
            <template v-if="operationMode === 'integrated'">
              <div v-if="tempPasswordData.emailSent" class="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
                <svg class="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span class="text-sm text-green-700 dark:text-green-300">Email notification sent to the user.</span>
              </div>
              <div v-else class="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span class="text-sm text-gray-500 dark:text-gray-400">Email not sent (no email on file or service unavailable).</span>
              </div>
            </template>
          </div>
          <div class="mt-6 flex justify-end">
            <button
              @click="showTempPasswordModal = false"
              class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Validation Errors Modal -->
    <ValidationErrorsModal
      :show="showValidationErrorsModal"
      :errors="combinedErrors"
      :error-count="validationErrorCount"
      :get-row-identifier="getRowIdentifier"
      @close="showValidationErrorsModal = false"
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
import PermissionSettingsDialog from '@/shared/components/PermissionSettingsDialog.vue'
import ValidationErrorsModal from '@/shared/components/ValidationErrorsModal.vue'
import EarsUserSearch from '@/shared/components/EarsUserSearch.vue'
import { useUserData } from './composables/useUserData'
import { useToast } from '@/shared/composables/useToast'
import { useFeaturePermission } from '@/shared/composables/useFeaturePermission'
import { useValidationErrorsModal } from '@/shared/composables/useValidationErrorsModal'
import { useProcessPermission } from '@/shared/composables/useProcessPermission'
import { usersApi } from './api'
import { clientListApi } from '../clients/api'
import { authApi } from '@/shared/api'

const gridRef = ref(null)
const filterBarRef = ref(null)
const selectedIds = ref([])
const showDeleteModal = ref(false)
const showPermissionDialog = ref(false)
const showTempPasswordModal = ref(false)
const tempPasswordData = ref({ singleid: '', tempPassword: '', emailSent: false })
const showResetConfirmModal = ref(false)
const resetConfirmEmail = ref('')
const resetConfirmUserId = ref(null)
const resetEmailMode = ref('manual')
const hasSearched = ref(false)
const filterCollapsed = ref(false)
const availableProcesses = ref([])
const operationMode = ref('standalone')
const { toast, showToast } = useToast()

// Fetch operation mode
const fetchOperationMode = async () => {
  try {
    const res = await authApi.getOperationMode()
    operationMode.value = res.data.mode
  } catch {
    // fallback to standalone
  }
}
fetchOperationMode()

// Fetch available processes from EQP_INFO for the multi-select editor
const fetchAvailableProcesses = async () => {
  try {
    const response = await clientListApi.getProcesses()
    const raw = response.data || []
    availableProcesses.value = raw.map(p => typeof p === 'object' ? p.value : p)
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

// Validation errors modal (shared composable)
const {
  showValidationErrorsModal,
  combinedErrors,
  validationErrorCount,
  mapServerErrors,
  resetServerErrors
} = useValidationErrorsModal(validationErrors)

const getRowIdentifier = (rowId) => {
  if (rowId.startsWith('server_row_')) {
    const index = parseInt(rowId.replace('server_row_', ''))
    const newRowsList = currentData.value.filter(r => r._tempId && newRows.value.has(r._tempId))
    if (newRowsList[index]) {
      const row = newRowsList[index]
      return row.singleid ? `NEW: ${row.singleid}` : `Row ${index + 1}`
    }
    return `Row ${index + 1}`
  }

  const row = currentData.value.find(r => (r._id || r._tempId) === rowId)
  if (!row) return rowId

  if (row._tempId) {
    return row.singleid ? `NEW: ${row.singleid}` : 'NEW Row'
  }

  return row.singleid || rowId
}

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
  resetServerErrors()

  if (!validate()) {
    showValidationErrorsModal.value = true
    showToast('error', `Validation failed: ${validationErrorCount.value} rows with errors`)
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
    mapServerErrors(result.errors)
    showValidationErrorsModal.value = true
    showToast('error', `Server validation failed: ${result.errors.length} errors`)
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

const handleApprovePasswordReset = (userId) => {
  resetConfirmUserId.value = userId
  resetConfirmEmail.value = ''
  resetEmailMode.value = 'manual'
  showResetConfirmModal.value = true
}

const handleEarsUserSelect = (user) => {
  resetConfirmEmail.value = user.mail || ''
}

const confirmPasswordReset = async () => {
  showResetConfirmModal.value = false
  try {
    const response = await usersApi.approvePasswordReset(resetConfirmUserId.value, resetConfirmEmail.value || undefined)
    const { singleid, tempPassword, emailSent } = response.data
    tempPasswordData.value = { singleid, tempPassword, emailSent: !!emailSent }
    showTempPasswordModal.value = true
    await refreshCurrentPage()
  } catch (err) {
    showToast('error', err.response?.data?.error || 'Failed to approve password reset')
  }
}

const copyTempPassword = async () => {
  try {
    await navigator.clipboard.writeText(tempPasswordData.value.tempPassword)
    showToast('success', 'Temporary password copied')
  } catch {
    showToast('error', 'Failed to copy')
  }
}
</script>
