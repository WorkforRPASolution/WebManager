import { ref, computed } from 'vue'
import { emailImageApi } from '../api'

export function useEmailImageData() {
  const currentData = ref([])
  const selectedItems = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Pagination state
  const currentPage = ref(1)
  const totalRecords = ref(0)
  const totalPages = ref(0)
  const pageSize = ref(25)
  const currentFilters = ref({})

  // Track modified rows for editing
  const modifiedRows = ref(new Map()) // Map<rowId, modifiedData>
  const modifiedCells = ref(new Map()) // Map<rowId, Set<fieldName>> - for cell styling

  // Computed: check if there are unsaved changes
  const hasChanges = computed(() => modifiedRows.value.size > 0)

  const fetchData = async (filters = {}, page = 1, size = 25) => {
    loading.value = true
    error.value = null
    try {
      const response = await emailImageApi.getAll(filters, page, size)
      currentData.value = response.data.data || []
      totalRecords.value = response.data.total
      totalPages.value = response.data.totalPages
      currentPage.value = response.data.page
      pageSize.value = response.data.pageSize
      currentFilters.value = filters
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to fetch data'
      throw err
    } finally {
      loading.value = false
    }
  }

  const changePage = async (page) => {
    await fetchData(currentFilters.value, page, pageSize.value)
  }

  const changePageSize = async (size) => {
    pageSize.value = size
    await fetchData(currentFilters.value, 1, size)
  }

  const refreshCurrentPage = async () => {
    await fetchData(currentFilters.value, currentPage.value, pageSize.value)
  }

  const uploadImage = async (file, templateContext) => {
    // Build prefix from template context (for URL compatibility)
    const prefix = `ARS_${templateContext.process || ''}_${templateContext.model || ''}_${templateContext.code || ''}_${templateContext.subcode || ''}`

    // Context object with individual fields for DB filtering
    const context = {
      process: templateContext.process || '',
      model: templateContext.model || '',
      code: templateContext.code || '',
      subcode: templateContext.subcode || ''
    }

    try {
      const response = await emailImageApi.upload(file, prefix, context)
      return response.data
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to upload image')
    }
  }

  const deleteImages = async (items) => {
    if (!items || items.length === 0) return { deleted: 0 }

    try {
      const response = await emailImageApi.deleteMultiple(items)
      return response.data
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to delete images')
    }
  }

  const resetAllData = () => {
    currentData.value = []
    selectedItems.value = []
    error.value = null
    currentFilters.value = {}
    modifiedRows.value = new Map()
    modifiedCells.value = new Map()
  }

  const setSelectedItems = (items) => {
    selectedItems.value = items
  }

  // Track a modified row and cell
  const trackModifiedRow = (rowData, field = null) => {
    const rowId = `${rowData.prefix}_${rowData.name}`
    modifiedRows.value.set(rowId, {
      prefix: rowData.originalPrefix || rowData.prefix, // Keep original prefix for API call
      name: rowData.name,
      process: rowData.process,
      model: rowData.model,
      code: rowData.code,
      subcode: rowData.subcode
    })
    // Trigger reactivity
    modifiedRows.value = new Map(modifiedRows.value)

    // Track modified cell for styling
    if (field) {
      if (!modifiedCells.value.has(rowId)) {
        modifiedCells.value.set(rowId, new Set())
      }
      modifiedCells.value.get(rowId).add(field)
      // Trigger reactivity
      modifiedCells.value = new Map(modifiedCells.value)
    }
  }

  // Clear all modifications
  const clearModifications = () => {
    modifiedRows.value = new Map()
    modifiedCells.value = new Map()
  }

  // Save all modified rows
  const saveChanges = async () => {
    if (modifiedRows.value.size === 0) return { updated: 0 }

    const items = Array.from(modifiedRows.value.values())
    try {
      const response = await emailImageApi.updateImages(items)
      modifiedRows.value = new Map()
      modifiedCells.value = new Map()
      return response.data
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to save changes')
    }
  }

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return {
    // Data
    currentData,
    selectedItems,
    loading,
    error,

    // Pagination state
    currentPage,
    totalRecords,
    totalPages,
    pageSize,

    // Edit tracking
    modifiedRows,
    modifiedCells,
    hasChanges,

    // Data operations
    fetchData,
    changePage,
    changePageSize,
    refreshCurrentPage,
    uploadImage,
    deleteImages,
    resetAllData,
    setSelectedItems,

    // Edit operations
    trackModifiedRow,
    clearModifications,
    saveChanges,

    // Utilities
    formatFileSize
  }
}
