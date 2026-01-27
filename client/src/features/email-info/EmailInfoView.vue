<template>
  <div class="flex flex-col gap-4" style="height: calc(100vh - 144px);">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Email Info Management</h1>
      <!-- Permission Settings Button (Admin only) -->
      <button
        v-if="isAdmin"
        @click="showPermissionDialog = true"
        class="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
        title="Feature Permissions"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Feature Permissions
      </button>
    </div>

    <!-- Filter Bar -->
    <EmailInfoFilterBar
      ref="filterBarRef"
      :collapsed="filterCollapsed"
      @toggle="handleFilterToggle"
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
        <span>Loading data...</span>
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

    <!-- Initial State - No Search Yet -->
    <div v-else-if="!hasSearched" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-dark-border rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Select Filters to View Data</h3>
        <p class="text-gray-500 dark:text-gray-400 max-w-sm">
          Use the filter bar above to select projects or search categories, then click Search to load the data.
        </p>
      </div>
    </div>

    <!-- Data Grid -->
    <div v-else class="flex-1 min-h-0">
      <EmailInfoDataGrid
        ref="gridRef"
        :row-data="currentData"
        :validation-errors="validationErrors"
        :modified-rows="modifiedRowsSet"
        :modified-cells="modifiedCells"
        :new-rows="newRowsSet"
        :deleted-rows="deletedRowsSet"
        @cell-edit="handleCellEdit"
        @selection-change="handleSelectionChange"
        @paste="handlePaste"
        @paste-rows="handlePasteRows"
        @paste-cells="handlePasteCells"
      />
    </div>

    <!-- Delete Confirmation Modal -->
    <DeleteConfirmModal
      v-model="showDeleteModal"
      :count="selectedIds.length"
      @confirm="handleDeleteConfirm"
    />

    <!-- Validation Errors Modal -->
    <Teleport to="body">
      <div
        v-if="showValidationErrorsModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showValidationErrorsModal = false"
      >
        <div class="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Validation Errors ({{ validationErrorCount }} items)
            </h3>
            <button
              @click="showValidationErrorsModal = false"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Error List -->
          <div class="flex-1 overflow-y-auto px-6 py-4">
            <div v-for="(errors, rowId) in combinedErrors" :key="rowId" class="mb-4 last:mb-0">
              <div class="font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <span class="px-2 py-0.5 bg-gray-100 dark:bg-dark-border rounded text-xs font-mono">
                  {{ getRowIdentifier(rowId) }}
                </span>
                <span
                  v-if="rowId.startsWith('server_row_')"
                  class="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded text-xs"
                >
                  Server Error
                </span>
              </div>
              <ul class="space-y-1 pl-4">
                <li
                  v-for="(message, field) in errors"
                  :key="field"
                  class="flex items-start gap-2 text-sm"
                >
                  <span class="font-medium text-red-600 dark:text-red-400 min-w-[100px]">{{ field }}:</span>
                  <span class="text-gray-600 dark:text-gray-400">{{ message }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 dark:border-dark-border flex justify-end">
            <button
              @click="showValidationErrorsModal = false"
              class="px-4 py-2 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Permission Settings Dialog (Admin only) -->
    <PermissionSettingsDialog
      v-model="showPermissionDialog"
      feature="emailInfo"
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
import EmailInfoFilterBar from './components/EmailInfoFilterBar.vue'
import BaseDataGridToolbar from '@/shared/components/BaseDataGridToolbar.vue'
import EmailInfoDataGrid from './components/EmailInfoDataGrid.vue'
import DeleteConfirmModal from './components/DeleteConfirmModal.vue'
import PermissionSettingsDialog from '@/shared/components/PermissionSettingsDialog.vue'
import { useEmailInfoData } from './composables/useEmailInfoData'
import { useToast } from '@/shared/composables/useToast'
import { useFeaturePermission } from '@/shared/composables/useFeaturePermission'

const gridRef = ref(null)
const filterBarRef = ref(null)
const selectedIds = ref([])
const showDeleteModal = ref(false)
const showPermissionDialog = ref(false)
const showValidationErrorsModal = ref(false)
const currentFiltersLocal = ref(null)
const { toast, showToast } = useToast()
const hasSearched = ref(false)
const filterCollapsed = ref(false)

// Permission hooks
const { canRead, canWrite, canDelete, isAdmin, refresh: refreshPermissions } = useFeaturePermission('emailInfo')

const handleFilterToggle = () => {
  filterCollapsed.value = !filterCollapsed.value
}

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
  isCellModified,

  modifiedCells,

  deletedRows,
  newRows,
} = useEmailInfoData()

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
  return deletedRows.value
})

// Combined errors
const combinedErrors = computed(() => {
  return { ...validationErrors.value, ...serverErrors.value }
})

const validationErrorCount = computed(() => {
  return Object.keys(combinedErrors.value).length
})

const getRowIdentifier = (rowId) => {
  if (rowId.startsWith('server_row_')) {
    const index = parseInt(rowId.replace('server_row_', ''))
    const newRowsList = currentData.value.filter(r => r._tempId && newRows.value.has(r._tempId))
    if (newRowsList[index]) {
      const row = newRowsList[index]
      return row.category ? `NEW: ${row.category}` : `Row ${index + 1}`
    }
    return `Row ${index + 1}`
  }

  const row = currentData.value.find(r => (r._id || r._tempId) === rowId)
  if (!row) return rowId

  if (row._tempId) {
    return row.category ? `NEW: ${row.category}` : `NEW Row`
  }

  return row.category || rowId
}

const handleFilterChange = async (filters) => {
  if (!filters) {
    currentFiltersLocal.value = null
    hasSearched.value = false
    resetAllData()
    return
  }

  discardChanges()

  currentFiltersLocal.value = filters
  hasSearched.value = true
  try {
    const apiFilters = {
      project: filters.projects?.join(',') || '',
      category: filters.category || ''
    }
    await fetchData(apiFilters, 1, pageSize.value)
  } catch (err) {
    showToast('error', 'Failed to load data')
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
  showToast('success', `${count} row${count > 1 ? 's' : ''} added`)
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
  showToast('warning', 'Rows marked for deletion. Save to apply.')
}

const serverErrors = ref({})

const handleSave = async () => {
  serverErrors.value = {}

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
    await refreshCurrentPage()
    selectedIds.value = []
  } else if (result.errors?.length > 0) {
    const errorMap = {}
    for (const err of result.errors) {
      const key = `server_row_${err.rowIndex}`
      if (!errorMap[key]) {
        errorMap[key] = {}
      }
      errorMap[key][err.field] = err.message
    }
    serverErrors.value = errorMap

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

const handlePaste = (params) => {
  // Handle AG Grid's internal paste event if needed
}

const handlePasteRows = (rows) => {
  if (!rows || rows.length === 0) return
  hasSearched.value = true
  addMultipleRows(rows)
  showToast('success', `${rows.length} rows pasted`)
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
  showToast('success', 'Permissions updated')
  await refreshPermissions()
}

const handlePermissionsError = (message) => {
  showToast('error', message)
}
</script>
