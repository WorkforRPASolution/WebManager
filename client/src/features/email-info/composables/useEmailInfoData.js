import { ref, computed } from 'vue'
import { emailInfoApi } from '../api'
import { validateAllRows, stringToArray } from '../validation'

export function useEmailInfoData() {
  const originalData = ref([])
  const currentData = ref([])
  const modifiedRows = ref(new Set())
  const modifiedCells = ref(new Map())  // Map<rowId, Set<field>> - 수정된 셀 추적
  const newRows = ref(new Set())
  const deletedRows = ref(new Set())
  const validationErrors = ref({})
  const loading = ref(false)
  const saving = ref(false)
  const error = ref(null)

  // Pagination state
  const currentPage = ref(1)
  const totalRecords = ref(0)
  const totalPages = ref(0)
  const pageSize = ref(25)
  const currentFilters = ref({})

  // Store for unsaved rows across pages
  const unsavedNewRows = ref([])

  // Store for modified row data across pages
  const modifiedRowData = ref(new Map())

  const hasUnsavedChanges = computed(() =>
    modifiedRows.value.size > 0 ||
    newRows.value.size > 0 ||
    deletedRows.value.size > 0
  )

  const fetchData = async (filters = {}, page = 1, size = 25) => {
    loading.value = true
    error.value = null
    try {
      const response = await emailInfoApi.getAll(filters, page, size)

      const serverData = response.data.data || []
      originalData.value = JSON.parse(JSON.stringify(serverData))

      // Merge unsaved new rows with server data
      const unsavedRows = unsavedNewRows.value.filter(r => newRows.value.has(r._tempId))
      currentData.value = [...unsavedRows, ...serverData]

      // Merge modified data
      for (const row of currentData.value) {
        if (row._id && modifiedRowData.value.has(row._id)) {
          const savedData = modifiedRowData.value.get(row._id)
          Object.keys(savedData).forEach(key => {
            if (key !== '_id' && key !== '__v') {
              row[key] = savedData[key]
            }
          })
        }
      }

      // Update pagination state
      totalRecords.value = response.data.total
      totalPages.value = response.data.totalPages
      currentPage.value = response.data.page
      pageSize.value = response.data.pageSize
      currentFilters.value = filters

      validationErrors.value = {}
    } catch (err) {
      console.error('[EmailInfo] fetchData error:', err.message, err.response?.status, err.response?.data)
      error.value = err.response?.data?.error || 'Failed to fetch data'
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

  const trackChange = (rowId, field, newValue) => {
    const row = currentData.value.find(r => (r._id || r._tempId) === rowId)
    if (!row) return

    row[field] = newValue

    if (row._tempId) {
      newRows.value.add(row._tempId)
      if (!modifiedCells.value.has(row._tempId)) {
        modifiedCells.value.set(row._tempId, new Set())
      }
      modifiedCells.value.get(row._tempId).add(field)
    } else {
      const original = originalData.value.find(r => r._id === rowId)
      // Compare arrays properly
      const originalValue = original?.[field]
      const isDifferent = Array.isArray(newValue)
        ? JSON.stringify(newValue) !== JSON.stringify(originalValue)
        : newValue !== originalValue

      if (original && isDifferent) {
        modifiedRows.value.add(rowId)
        if (!modifiedCells.value.has(rowId)) {
          modifiedCells.value.set(rowId, new Set())
        }
        modifiedCells.value.get(rowId).add(field)
        modifiedRowData.value.set(rowId, { ...row })
      } else if (original) {
        if (modifiedCells.value.has(rowId)) {
          modifiedCells.value.get(rowId).delete(field)
          if (modifiedCells.value.get(rowId).size === 0) {
            modifiedCells.value.delete(rowId)
          }
        }
        // Check if row is still modified
        const isModified = Object.keys(row).some(key => {
          if (key === '_id' || key === '__v') return false
          const orig = original[key]
          const curr = row[key]
          return Array.isArray(curr)
            ? JSON.stringify(curr) !== JSON.stringify(orig)
            : curr !== orig
        })
        if (!isModified) {
          modifiedRows.value.delete(rowId)
          modifiedRowData.value.delete(rowId)
        } else {
          modifiedRowData.value.set(rowId, { ...row })
        }
      }
    }
  }

  const addNewRow = () => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newRow = {
      _tempId: tempId,
      project: 'ARS',
      category: '',
      account: [],
      departments: []
    }
    currentData.value.unshift(newRow)
    unsavedNewRows.value.unshift(newRow)
    newRows.value.add(tempId)
    return newRow
  }

  const addMultipleRows = (rows) => {
    const addedRows = []
    for (const rowData of rows) {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newRow = {
        _tempId: tempId,
        project: rowData.project || 'ARS',
        category: rowData.category || '',
        account: rowData.account || [],
        departments: rowData.departments || []
      }
      currentData.value.unshift(newRow)
      unsavedNewRows.value.unshift(newRow)
      newRows.value.add(tempId)
      addedRows.push(newRow)
    }
    return addedRows
  }

  const markForDeletion = (ids) => {
    for (const id of ids) {
      const row = currentData.value.find(r => (r._id || r._tempId) === id)
      if (row) {
        if (row._tempId) {
          currentData.value = currentData.value.filter(r => r._tempId !== id)
          unsavedNewRows.value = unsavedNewRows.value.filter(r => r._tempId !== id)
          newRows.value.delete(id)
        } else {
          deletedRows.value.add(id)
        }
      }
    }
  }

  const cancelDeletion = (id) => {
    deletedRows.value.delete(id)
  }

  // Check for duplicate project+category
  const checkDuplicateKey = () => {
    const keyMap = new Map()

    for (const row of currentData.value) {
      if (row._id && deletedRows.value.has(row._id)) continue

      const rowId = row._id || row._tempId
      const key = `${row.project}|${row.category}`.toLowerCase()

      if (!row.project || !row.category) continue

      const isNew = row._tempId && newRows.value.has(row._tempId)
      const isModified = row._id && modifiedRows.value.has(row._id)
      const isNewOrModified = isNew || isModified

      if (!keyMap.has(key)) {
        keyMap.set(key, [])
      }
      keyMap.get(key).push({ rowId, isNewOrModified })
    }

    for (const [, rows] of keyMap) {
      if (rows.length > 1) {
        for (const { rowId, isNewOrModified } of rows) {
          if (isNewOrModified) {
            if (!validationErrors.value[rowId]) {
              validationErrors.value[rowId] = {}
            }
            validationErrors.value[rowId].category = '중복된 Project + Category 조합'
          }
        }
      }
    }
  }

  const validate = () => {
    const rowsToValidate = currentData.value.filter(r => {
      if (r._id && deletedRows.value.has(r._id)) return false
      if (r._tempId && newRows.value.has(r._tempId)) return true
      if (r._id && modifiedRows.value.has(r._id)) return true
      return false
    })
    validationErrors.value = validateAllRows(rowsToValidate)
    checkDuplicateKey()
    return Object.keys(validationErrors.value).length === 0
  }

  const save = async () => {
    if (!validate()) {
      return { success: false, message: 'Validation failed' }
    }

    saving.value = true
    error.value = null

    try {
      const results = { created: 0, updated: 0, deleted: 0, errors: [] }

      // Delete rows
      if (deletedRows.value.size > 0) {
        const deleteIds = [...deletedRows.value]
        const deleteRes = await emailInfoApi.delete(deleteIds)
        results.deleted = deleteRes.data.deleted
      }

      // Create new rows
      const rowsToCreate = currentData.value.filter(r => r._tempId && newRows.value.has(r._tempId))
      if (rowsToCreate.length > 0) {
        const createData = rowsToCreate.map(({ _tempId, ...data }) => data)
        const createRes = await emailInfoApi.create(createData)
        results.created = createRes.data.created
        if (createRes.data.errors?.length > 0) {
          results.errors.push(...createRes.data.errors)
        }
      }

      // Update modified rows
      const rowsToUpdate = currentData.value.filter(
        r => r._id && modifiedRows.value.has(r._id) && !deletedRows.value.has(r._id)
      )
      if (rowsToUpdate.length > 0) {
        const updateRes = await emailInfoApi.update(rowsToUpdate)
        results.updated = updateRes.data.updated
        if (updateRes.data.errors?.length > 0) {
          results.errors.push(...updateRes.data.errors)
        }
      }

      if (results.errors.length === 0) {
        modifiedRows.value.clear()
        modifiedCells.value.clear()
        modifiedRowData.value.clear()
        newRows.value.clear()
        deletedRows.value.clear()
        unsavedNewRows.value = []
      }

      return {
        success: results.errors.length === 0,
        ...results
      }
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to save changes'
      return { success: false, message: error.value }
    } finally {
      saving.value = false
    }
  }

  const discardChanges = () => {
    currentData.value = JSON.parse(JSON.stringify(originalData.value))
    modifiedRows.value.clear()
    modifiedCells.value.clear()
    modifiedRowData.value.clear()
    newRows.value.clear()
    deletedRows.value.clear()
    unsavedNewRows.value = []
    validationErrors.value = {}
  }

  const resetAllData = () => {
    originalData.value = []
    currentData.value = []
    modifiedRows.value.clear()
    modifiedCells.value.clear()
    modifiedRowData.value.clear()
    newRows.value.clear()
    deletedRows.value.clear()
    unsavedNewRows.value = []
    validationErrors.value = {}
    currentFilters.value = {}
  }

  const isRowModified = (rowId) => modifiedRows.value.has(rowId)
  const isRowNew = (rowId) => newRows.value.has(rowId)
  const isRowDeleted = (rowId) => deletedRows.value.has(rowId)
  const isCellModified = (rowId, field) => modifiedCells.value.has(rowId) && modifiedCells.value.get(rowId).has(field)
  const getRowErrors = (rowId) => validationErrors.value[rowId] || null

  return {
    // Data
    currentData,
    loading,
    saving,
    error,
    hasUnsavedChanges,
    validationErrors,

    // Pagination state
    currentPage,
    totalRecords,
    totalPages,
    pageSize,

    // Data operations
    fetchData,
    changePage,
    changePageSize,
    refreshCurrentPage,
    trackChange,
    addNewRow,
    addMultipleRows,
    markForDeletion,
    cancelDeletion,
    validate,
    save,
    discardChanges,
    resetAllData,

    // Row state helpers
    isRowModified,
    isRowNew,
    isRowDeleted,
    isCellModified,
    getRowErrors,

    // Cell state
    modifiedCells,

    // Row state refs for reactivity
    deletedRows,
    newRows,
  }
}
