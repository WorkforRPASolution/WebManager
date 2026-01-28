import { ref, computed } from 'vue'
import { equipmentInfoApi } from '../api'
import { validateAllRows } from '../validation'

export function useEquipmentInfoData() {
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
  const unsavedNewRows = ref([])  // New rows that are not yet saved

  // Store for modified row data across pages (for pagination persistence)
  const modifiedRowData = ref(new Map())  // Map<rowId, rowData>

  const hasUnsavedChanges = computed(() =>
    modifiedRows.value.size > 0 ||
    newRows.value.size > 0 ||
    deletedRows.value.size > 0
  )

  const fetchData = async (filters = {}, page = 1, size = 25) => {
    loading.value = true
    error.value = null
    try {
      const response = await equipmentInfoApi.getAll(filters, page, size)

      // Server returns { data, total, page, pageSize, totalPages }
      const serverData = response.data.data || []
      originalData.value = JSON.parse(JSON.stringify(serverData))

      // Merge unsaved new rows with server data
      // New rows always appear at the top of current page
      const unsavedRows = unsavedNewRows.value.filter(r => newRows.value.has(r._tempId))
      currentData.value = [...unsavedRows, ...serverData]

      // 페이지네이션 시 수정된 데이터 병합 (저장된 수정 데이터로 덮어씀)
      for (const row of currentData.value) {
        if (row._id && modifiedRowData.value.has(row._id)) {
          const savedData = modifiedRowData.value.get(row._id)
          // _id와 __v는 유지하고 나머지 필드만 병합
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

      // Don't clear tracking sets on page change - preserve across pages
      // Only clear validationErrors for fresh fetch
      validationErrors.value = {}
    } catch (err) {
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

    // Check if it's a new row
    if (row._tempId) {
      newRows.value.add(row._tempId)
      // 새 행의 수정된 셀 추적
      if (!modifiedCells.value.has(row._tempId)) {
        modifiedCells.value.set(row._tempId, new Set())
      }
      modifiedCells.value.get(row._tempId).add(field)
    } else {
      // Check if value differs from original
      const original = originalData.value.find(r => r._id === rowId)
      if (original && original[field] !== newValue) {
        modifiedRows.value.add(rowId)
        // 수정된 셀 추적
        if (!modifiedCells.value.has(rowId)) {
          modifiedCells.value.set(rowId, new Set())
        }
        modifiedCells.value.get(rowId).add(field)

        // 수정된 행 전체 데이터 저장 (페이지네이션 시 유지용)
        modifiedRowData.value.set(rowId, { ...row })
      } else if (original) {
        // 셀이 원래 값으로 복원된 경우 해당 셀 제거
        if (modifiedCells.value.has(rowId)) {
          modifiedCells.value.get(rowId).delete(field)
          if (modifiedCells.value.get(rowId).size === 0) {
            modifiedCells.value.delete(rowId)
          }
        }
        // Check if row is still modified in any field
        const isModified = Object.keys(row).some(key => {
          if (key === '_id' || key === '__v') return false
          return row[key] !== original[key]
        })
        if (!isModified) {
          modifiedRows.value.delete(rowId)
          modifiedRowData.value.delete(rowId)  // 원복되면 저장된 데이터도 삭제
        } else {
          // 아직 수정된 필드가 있으면 저장된 데이터 업데이트
          modifiedRowData.value.set(rowId, { ...row })
        }
      }
    }
  }

  const addNewRow = () => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newRow = {
      _tempId: tempId,
      line: '',
      lineDesc: '',
      process: '',
      eqpModel: '',
      eqpId: '',
      category: '',
      ipAddr: '',
      ipAddrL: '',
      localpc: '',
      emailcategory: '',
      osVer: '',
      onoff: 1,
      webmanagerUse: 1,
      installdate: '',
      scFirstExcute: '',
      snapshotTimeDiff: null,
      usereleasemsg: 1,
      usetkincancel: 0,
    }
    currentData.value.unshift(newRow)
    unsavedNewRows.value.unshift(newRow)  // Track for pagination persistence
    newRows.value.add(tempId)
    return newRow
  }

  const addMultipleRows = (rows) => {
    const addedRows = []
    for (const rowData of rows) {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newRow = {
        _tempId: tempId,
        line: rowData.line || '',
        lineDesc: rowData.lineDesc || '',
        process: rowData.process || '',
        eqpModel: rowData.eqpModel || '',
        eqpId: rowData.eqpId || '',
        category: rowData.category || '',
        ipAddr: rowData.ipAddr || '',
        ipAddrL: rowData.ipAddrL || '',
        localpc: rowData.localpc ?? 1,
        emailcategory: rowData.emailcategory || '',
        osVer: rowData.osVer || '',
        onoff: rowData.onoff ?? 1,
        webmanagerUse: rowData.webmanagerUse ?? 1,
        installdate: rowData.installdate || '',
        scFirstExcute: rowData.scFirstExcute || '',
        snapshotTimeDiff: rowData.snapshotTimeDiff ?? null,
        usereleasemsg: rowData.usereleasemsg ?? 1,
        usetkincancel: rowData.usetkincancel ?? 0,
      }
      currentData.value.unshift(newRow)
      unsavedNewRows.value.unshift(newRow)  // Track for pagination persistence
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
          // New row - just remove from data
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

  // Check for duplicate eqpId - only flag new/modified rows
  const checkDuplicateEqpId = () => {
    const eqpIdMap = new Map()  // eqpId (lowercase) -> [{ rowId, isNewOrModified, originalEqpId }]

    for (const row of currentData.value) {
      // Skip deleted rows
      if (row._id && deletedRows.value.has(row._id)) continue

      const rowId = row._id || row._tempId
      const originalEqpId = row.eqpId
      const eqpIdLower = originalEqpId?.toLowerCase?.()

      if (!eqpIdLower) continue

      // Check if this row is new or modified
      const isNew = row._tempId && newRows.value.has(row._tempId)
      const isModified = row._id && modifiedRows.value.has(row._id)
      const isNewOrModified = isNew || isModified

      if (!eqpIdMap.has(eqpIdLower)) {
        eqpIdMap.set(eqpIdLower, [])
      }
      eqpIdMap.get(eqpIdLower).push({ rowId, isNewOrModified, originalEqpId })
    }

    // Add errors only for new/modified rows that have duplicates
    for (const [, rows] of eqpIdMap) {
      if (rows.length > 1) {
        // Only flag new/modified rows that have duplicates
        for (const { rowId, isNewOrModified, originalEqpId } of rows) {
          if (isNewOrModified) {
            if (!validationErrors.value[rowId]) {
              validationErrors.value[rowId] = {}
            }
            validationErrors.value[rowId].eqpId = `중복된 Equipment ID: ${originalEqpId}`
          }
        }
      }
    }
  }

  // Check for duplicate ipAddr + ipAddrL combination - only flag new/modified rows
  const checkDuplicateIpCombination = () => {
    const ipMap = new Map()  // "ipAddr|ipAddrL" -> [{ rowId, isNewOrModified, eqpId }]

    for (const row of currentData.value) {
      // Skip deleted rows
      if (row._id && deletedRows.value.has(row._id)) continue

      const rowId = row._id || row._tempId
      const ipAddr = row.ipAddr || ''
      const ipAddrL = row.ipAddrL || ''
      const eqpId = row.eqpId || rowId

      // Skip rows without primary IP
      if (!ipAddr) continue

      // Check if this row is new or modified
      const isNew = row._tempId && newRows.value.has(row._tempId)
      const isModified = row._id && modifiedRows.value.has(row._id)
      const isNewOrModified = isNew || isModified

      const key = `${ipAddr}|${ipAddrL}`

      if (!ipMap.has(key)) {
        ipMap.set(key, [])
      }
      ipMap.get(key).push({ rowId, isNewOrModified, eqpId })
    }

    // Add errors only for new/modified rows that have duplicate IP combinations
    for (const [key, rows] of ipMap) {
      if (rows.length > 1) {
        const hasSecondaryIp = key.includes('|') && key.split('|')[1]

        for (const { rowId, isNewOrModified, eqpId } of rows) {
          if (isNewOrModified) {
            // Find other eqpIds with the same IP combination
            const otherEqpIds = rows
              .filter(r => r.rowId !== rowId)
              .map(r => r.eqpId)
              .join(', ')

            if (!validationErrors.value[rowId]) {
              validationErrors.value[rowId] = {}
            }
            validationErrors.value[rowId].ipAddr = `중복된 IP 조합 (${otherEqpIds})`
            if (hasSecondaryIp) {
              validationErrors.value[rowId].ipAddrL = `중복된 IP 조합 (${otherEqpIds})`
            }
          }
        }
      }
    }
  }

  const validate = () => {
    // Only validate new rows and modified rows (not all rows)
    const rowsToValidate = currentData.value.filter(r => {
      // Skip deleted rows
      if (r._id && deletedRows.value.has(r._id)) return false
      // Include new rows
      if (r._tempId && newRows.value.has(r._tempId)) return true
      // Include modified rows
      if (r._id && modifiedRows.value.has(r._id)) return true
      // Skip unchanged rows
      return false
    })
    validationErrors.value = validateAllRows(rowsToValidate)

    // Check for duplicate eqpId across all rows (including unchanged)
    checkDuplicateEqpId()

    // Check for duplicate IP combination across all rows (including unchanged)
    checkDuplicateIpCombination()

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
        const deleteRes = await equipmentInfoApi.delete(deleteIds)
        results.deleted = deleteRes.data.deleted
      }

      // Create new rows
      const rowsToCreate = currentData.value.filter(r => r._tempId && newRows.value.has(r._tempId))
      if (rowsToCreate.length > 0) {
        const createData = rowsToCreate.map(({ _tempId, ...data }) => data)
        const createRes = await equipmentInfoApi.create(createData)
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
        const updateRes = await equipmentInfoApi.update(rowsToUpdate)
        results.updated = updateRes.data.updated
        if (updateRes.data.errors?.length > 0) {
          results.errors.push(...updateRes.data.errors)
        }
      }

      // Refresh data if no errors
      if (results.errors.length === 0) {
        modifiedRows.value.clear()
        modifiedCells.value.clear()
        modifiedRowData.value.clear()  // 저장 성공 후 수정 데이터 초기화
        newRows.value.clear()
        deletedRows.value.clear()
        unsavedNewRows.value = []  // Clear unsaved new rows after successful save
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
    modifiedRowData.value.clear()  // 저장된 수정 데이터도 초기화
    newRows.value.clear()
    deletedRows.value.clear()
    unsavedNewRows.value = []  // Clear unsaved new rows
    validationErrors.value = {}
  }

  // Reset all data including originalData (for Clear button)
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

  /**
   * Generate emailcategory from process, eqpModel, lineDesc
   * Format: EMAIL-{process}-{eqpModel}-{lineDesc}
   */
  const generateEmailCategory = (row) => {
    const process = row.process || ''
    const eqpModel = row.eqpModel || ''
    const lineDesc = row.lineDesc || ''

    if (!process || !eqpModel || !lineDesc) {
      return '' // Required fields missing
    }

    return `EMAIL-${process}-${eqpModel}-${lineDesc}`
  }

  /**
   * Auto-fill emailcategory for rows with empty value
   * Returns list of auto-generated categories
   */
  const autoFillEmailCategories = () => {
    const generated = []

    for (const row of currentData.value) {
      // Skip deleted rows
      if (row._id && deletedRows.value.has(row._id)) continue

      // Only process new or modified rows
      const isNew = row._tempId && newRows.value.has(row._tempId)
      const isModified = row._id && modifiedRows.value.has(row._id)
      if (!isNew && !isModified) continue

      // Auto-fill if emailcategory is empty
      if (!row.emailcategory || row.emailcategory.trim() === '') {
        const category = generateEmailCategory(row)
        if (category) {
          row.emailcategory = category
          generated.push(category)
        }
      }
    }

    return [...new Set(generated)] // Return unique categories
  }

  /**
   * Get all emailcategories from rows being saved
   */
  const getEmailCategoriesToSave = () => {
    const categories = new Set()

    for (const row of currentData.value) {
      if (row._id && deletedRows.value.has(row._id)) continue

      const isNew = row._tempId && newRows.value.has(row._tempId)
      const isModified = row._id && modifiedRows.value.has(row._id)
      if (!isNew && !isModified) continue

      if (row.emailcategory && row.emailcategory.trim()) {
        categories.add(row.emailcategory)
      }
    }

    return [...categories]
  }

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

    // Email category helpers
    autoFillEmailCategories,
    getEmailCategoriesToSave,
  }
}
