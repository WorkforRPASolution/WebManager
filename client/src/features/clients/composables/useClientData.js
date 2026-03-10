import { ref, computed } from 'vue'
import { clientListApi } from '../api'

export function useClientData() {
  // Data state
  const clients = ref([])
  const loading = ref(false)
  const error = ref(null)
  const selectedIds = ref([])

  // Pagination state
  const currentPage = ref(1)
  const totalRecords = ref(0)
  const totalPages = ref(0)
  const pageSize = ref(25)
  const currentFilters = ref({})

  // Operation state (used by toolbar to disable buttons during async ops)
  const operating = ref(false)

  const hasSelection = computed(() => selectedIds.value.length > 0)

  const fetchClients = async (filters = {}, page = 1, size = 25) => {
    loading.value = true
    error.value = null
    try {
      const response = await clientListApi.getClients(filters, page, size)

      // Server returns { data, total, page, pageSize, totalPages }
      clients.value = response.data.data || []

      // Update pagination state
      totalRecords.value = response.data.total
      totalPages.value = response.data.totalPages
      currentPage.value = response.data.page
      pageSize.value = response.data.pageSize
      currentFilters.value = filters

      // Clear selection on data change
      selectedIds.value = []
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch clients'
      throw err
    } finally {
      loading.value = false
    }
  }

  const changePage = async (page) => {
    await fetchClients(currentFilters.value, page, pageSize.value)
  }

  const changePageSize = async (size) => {
    pageSize.value = size
    await fetchClients(currentFilters.value, 1, size)
  }

  const refreshCurrentPage = async () => {
    const preservedIds = [...selectedIds.value]
    await fetchClients(currentFilters.value, currentPage.value, pageSize.value)
    // fetchClients에서 selectedIds가 []로 초기화되므로 복원
    selectedIds.value = preservedIds
  }

  const setSelectedIds = (ids) => {
    selectedIds.value = ids
  }

  const clearSelection = () => {
    selectedIds.value = []
  }

  // Reset all data (for Clear button)
  const resetAllData = () => {
    clients.value = []
    selectedIds.value = []
    currentFilters.value = {}
    totalRecords.value = 0
    totalPages.value = 0
    currentPage.value = 1
  }

  return {
    // Data
    clients,
    loading,
    error,
    selectedIds,
    hasSelection,
    operating,

    // Pagination state
    currentPage,
    totalRecords,
    totalPages,
    pageSize,
    currentFilters,

    // Data operations
    fetchClients,
    changePage,
    changePageSize,
    refreshCurrentPage,
    setSelectedIds,
    clearSelection,
    resetAllData,

  }
}
