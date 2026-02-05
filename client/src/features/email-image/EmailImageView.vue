<template>
  <div class="flex flex-col gap-4" style="height: calc(100vh - 144px);">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Email Image Management</h1>
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
    <EmailImageFilterBar
      ref="filterBarRef"
      :collapsed="filterCollapsed"
      @toggle="handleFilterToggle"
      @filter-change="handleFilterChange"
    />

    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-3 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
      <div class="flex items-center gap-4">
        <!-- Selected Count -->
        <span v-if="selectedItems.length > 0" class="text-sm text-gray-600 dark:text-gray-400">
          {{ selectedItems.length }} selected
        </span>

        <!-- Upload Button -->
        <button
          v-if="canWrite"
          @click="showUploadModal = true"
          class="flex items-center gap-2 px-3 py-2 text-sm bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload
        </button>

        <!-- Delete Button -->
        <button
          v-if="canDelete && selectedItems.length > 0"
          @click="showDeleteModal = true"
          class="flex items-center gap-2 px-3 py-2 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>

        <!-- Divider when changes exist -->
        <div v-if="hasChanges" class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />

        <!-- Save Button -->
        <button
          v-if="hasChanges"
          @click="handleSaveChanges"
          class="flex items-center gap-2 px-3 py-2 text-sm bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Save
        </button>

        <!-- Cancel Button -->
        <button
          v-if="hasChanges"
          @click="handleCancelChanges"
          class="flex items-center gap-2 px-3 py-2 text-sm bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancel
        </button>
      </div>

      <!-- Pagination -->
      <div class="flex items-center gap-4">
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ totalRecords }} total
        </span>

        <!-- Page Size -->
        <select
          :value="pageSize"
          @change="handlePageSizeChange($event.target.value)"
          class="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
        >
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>

        <!-- Page Navigation -->
        <div class="flex items-center gap-1">
          <button
            @click="handlePageChange(currentPage - 1)"
            :disabled="currentPage <= 1"
            class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="px-2 text-sm text-gray-600 dark:text-gray-400">
            {{ currentPage }} / {{ totalPages || 1 }}
          </span>
          <button
            @click="handlePageChange(currentPage + 1)"
            :disabled="currentPage >= totalPages"
            class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>

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
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Select Filters to View Images</h3>
        <p class="text-gray-500 dark:text-gray-400 max-w-sm">
          Use the filter bar above to select processes, models, codes, or subcodes, then click Search to load the images.
        </p>
      </div>
    </div>

    <!-- Data Grid -->
    <div v-else class="flex-1 min-h-0">
      <EmailImageGrid
        ref="gridRef"
        :row-data="currentData"
        :editable="canWrite"
        :modified-cells="modifiedCells"
        @selection-change="handleSelectionChange"
        @preview-image="handlePreviewImage"
        @cell-value-changed="handleCellValueChanged"
      />
    </div>

    <!-- Delete Confirmation Modal -->
    <DeleteConfirmModal
      v-model="showDeleteModal"
      :count="selectedItems.length"
      @confirm="handleDeleteConfirm"
    />

    <!-- Upload Modal -->
    <ImageUploadModal
      v-model="showUploadModal"
      :initial-context="uploadContext"
      @upload="handleUpload"
    />

    <!-- Image Preview Modal -->
    <ImagePreviewModal
      v-model="showPreviewModal"
      :image="previewImage"
    />

    <!-- Permission Settings Dialog (Admin only) -->
    <PermissionSettingsDialog
      v-model="showPermissionDialog"
      feature="emailImage"
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
import EmailImageFilterBar from './components/EmailImageFilterBar.vue'
import EmailImageGrid from './components/EmailImageGrid.vue'
import DeleteConfirmModal from '../equipment-info/components/DeleteConfirmModal.vue'
import ImageUploadModal from './components/ImageUploadModal.vue'
import ImagePreviewModal from './components/ImagePreviewModal.vue'
import PermissionSettingsDialog from '@/shared/components/PermissionSettingsDialog.vue'
import { useEmailImageData } from './composables/useEmailImageData'
import { useToast } from '@/shared/composables/useToast'
import { useFeaturePermission } from '@/shared/composables/useFeaturePermission'

const gridRef = ref(null)
const filterBarRef = ref(null)
const selectedItems = ref([])
const showDeleteModal = ref(false)
const showUploadModal = ref(false)
const showPreviewModal = ref(false)
const showPermissionDialog = ref(false)
const previewImage = ref(null)
const uploadContext = ref({})
const currentFiltersLocal = ref(null)
const { toast, showToast } = useToast()
const hasSearched = ref(false)
const filterCollapsed = ref(false)

// Permission hooks
const { canRead, canWrite, canDelete, isAdmin, refresh: refreshPermissions } = useFeaturePermission('emailImage')

const {
  currentData,
  loading,
  error,
  currentPage,
  totalRecords,
  totalPages,
  pageSize,
  modifiedCells,
  hasChanges,
  fetchData,
  changePage,
  changePageSize,
  refreshCurrentPage,
  uploadImage,
  deleteImages,
  resetAllData,
  trackModifiedRow,
  clearModifications,
  saveChanges,
} = useEmailImageData()

// Toggle filter bar collapse
const handleFilterToggle = () => {
  filterCollapsed.value = !filterCollapsed.value
}

const handleFilterChange = async (filters) => {
  if (!filters) {
    currentFiltersLocal.value = null
    hasSearched.value = false
    resetAllData()
    return
  }

  currentFiltersLocal.value = filters
  hasSearched.value = true

  // Update upload context from filters
  uploadContext.value = {
    process: filters.processes?.[0] || '',
    model: filters.models?.[0] || '',
    code: filters.codes?.[0] || '',
    subcode: filters.subcodes?.[0] || ''
  }

  try {
    const apiFilters = {
      process: filters.processes?.join(',') || '',
      model: filters.models?.join(',') || '',
      code: filters.codes?.join(',') || '',
      subcode: filters.subcodes?.join(',') || ''
    }
    await fetchData(apiFilters, 1, pageSize.value)
  } catch (err) {
    showToast('error', 'Failed to load data')
  }
}

const handlePageSizeChange = async (newSize) => {
  try {
    await changePageSize(parseInt(newSize))
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

const handleSelectionChange = (items) => {
  selectedItems.value = items
}

const handlePreviewImage = (imageData) => {
  previewImage.value = imageData
  showPreviewModal.value = true
}

const handleDeleteConfirm = async () => {
  if (selectedItems.value.length === 0) return

  try {
    const result = await deleteImages(selectedItems.value)
    showToast('success', `${result.deleted} image(s) deleted`)
    selectedItems.value = []
    if (gridRef.value) {
      gridRef.value.clearSelection()
    }
    await refreshCurrentPage()
    await filterBarRef.value?.refreshFilters()
  } catch (err) {
    showToast('error', err.message || 'Failed to delete images')
  }
}

const handleUpload = async (uploadItems) => {
  let successCount = 0
  let errorCount = 0

  for (const { file, context } of uploadItems) {
    try {
      await uploadImage(file, context)
      successCount++
    } catch (err) {
      console.error('Upload failed:', err)
      errorCount++
    }
  }

  if (successCount > 0) {
    showToast('success', `${successCount} image(s) uploaded`)
    await refreshCurrentPage()
    await filterBarRef.value?.refreshFilters()
  }

  if (errorCount > 0) {
    showToast('error', `${errorCount} upload(s) failed`)
  }
}

const handlePermissionsSaved = async () => {
  showToast('success', 'Permissions updated')
  await refreshPermissions()
}

const handlePermissionsError = (message) => {
  showToast('error', message)
}

// Handle cell value changes in grid
const handleCellValueChanged = (rowData, field) => {
  trackModifiedRow(rowData, field)
}

// Save all changes
const handleSaveChanges = async () => {
  try {
    const result = await saveChanges()
    showToast('success', `${result.updated} image(s) updated`)
    // Refresh to get updated data with new prefixes
    await refreshCurrentPage()
    await filterBarRef.value?.refreshFilters()
  } catch (err) {
    showToast('error', err.message || 'Failed to save changes')
  }
}

// Cancel all changes
const handleCancelChanges = async () => {
  clearModifications()
  // Refresh to restore original data
  await refreshCurrentPage()
}
</script>
