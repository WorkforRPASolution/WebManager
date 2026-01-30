<template>
  <div class="flex flex-col w-full h-full">
    <div ref="gridContainer" class="flex-1 min-h-0 ag-grid-custom-scrollbar" @paste="handlePaste" @copy="handleCopy" @keydown.capture="handleKeyDown" tabindex="0">
      <AgGridVue
      :theme="gridTheme"
      :rowData="rowData"
      :columnDefs="columnDefs"
      :defaultColDef="defaultColDef"
      :rowSelection="rowSelection"
      :suppressRowClickSelection="true"
      :enableCellTextSelection="true"
      :clipboardDelimiter="'\t'"
      :getRowId="getRowId"
      :getRowStyle="getRowStyle"
      :alwaysShowHorizontalScroll="true"
      :suppressSizeToFit="true"
      @grid-ready="onGridReady"
      @cell-editing-started="onCellEditingStarted"
      @cell-editing-stopped="onCellEditingStopped"
      @cell-value-changed="onCellValueChanged"
      @selection-changed="onSelectionChanged"
      @paste-end="onPasteEnd"
      @cell-clicked="onCellClicked"
      @sort-changed="onSortChanged"
      @displayed-columns-changed="handleColumnChange"
      @column-resized="handleColumnChange"
        style="width: 100%; height: 100%;"
      />
    </div>
    <CustomHorizontalScrollbar
      :scrollState="scrollState"
      @scroll="handleCustomScroll"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community'
import { useTheme } from '../../../shared/composables/useTheme'
import { useCustomScrollbar } from '../../../shared/composables/useCustomScrollbar'
import { useDataGridCellSelection } from '../../../shared/composables/useDataGridCellSelection'
import CustomHorizontalScrollbar from '../../../shared/components/CustomHorizontalScrollbar.vue'
import AgGridProcessModelEditor from '../../../shared/components/AgGridProcessModelEditor.vue'
import AgGridEmailCategoryEditor from '../../../shared/components/AgGridEmailCategoryEditor.vue'
import { useAuthStore } from '../../../shared/stores/auth'
import { useProcessFilterStore } from '../../../shared/stores/processFilter'
import { clientListApi } from '../../clients/api'
import { emailRecipientsApi } from '../api'

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

const { isDark } = useTheme()
const authStore = useAuthStore()
const processFilterStore = useProcessFilterStore()

// Check if user has MASTER access (admin or has MASTER process)
const hasMasterAccess = computed(() => {
  if (authStore.isAdmin) return true
  const processes = processFilterStore.getUserProcessList()
  return processes.some(p => p.toUpperCase() === 'MASTER')
})

// Get user's process list
const userProcesses = computed(() => processFilterStore.getUserProcessList())

// Fetch all processes from server (for MASTER users)
const fetchAllProcesses = async () => {
  try {
    const response = await clientListApi.getProcesses()
    return response.data || []
  } catch (error) {
    console.error('Failed to fetch all processes:', error)
    return []
  }
}

// Fetch all models from server (for MASTER users, optionally filtered by process)
const fetchAllModels = async (process) => {
  try {
    const response = await clientListApi.getModels(process || null)
    return response.data || []
  } catch (error) {
    console.error('Failed to fetch all models:', error)
    return []
  }
}

// Fetch models for a given process
const fetchModelsForProcess = async (process) => {
  if (!process) return []
  try {
    const response = await clientListApi.getModels(process)
    return response.data || []
  } catch (error) {
    console.error('Failed to fetch models:', error)
    return []
  }
}

// Fetch email categories from EMAILINFO
const fetchEmailCategories = async () => {
  try {
    return await emailRecipientsApi.getEmailInfoCategories('ARS')
  } catch (error) {
    console.error('Failed to fetch email categories:', error)
    return []
  }
}

// AG Grid Theme
const lightTheme = themeQuartz.withParams({
  fontSize: 12,
  spacing: 6,
  rowHeight: 36,
  headerHeight: 40,
  borderRadius: 0,
  wrapperBorderRadius: 0,
  backgroundColor: '#ffffff',
  headerBackgroundColor: '#f8fafc',
  borderColor: '#e2e8f0',
  foregroundColor: '#1e293b',
})

const darkTheme = themeQuartz.withParams({
  fontSize: 12,
  spacing: 6,
  rowHeight: 36,
  headerHeight: 40,
  borderRadius: 0,
  wrapperBorderRadius: 0,
  backgroundColor: '#1e293b',
  headerBackgroundColor: '#0f172a',
  borderColor: '#334155',
  foregroundColor: '#e2e8f0',
  oddRowBackgroundColor: '#1e293b',
  rowHoverColor: '#334155',
  selectedRowBackgroundColor: 'rgba(59, 130, 246, 0.2)',
})

const gridTheme = computed(() => isDark.value ? darkTheme : lightTheme)

const props = defineProps({
  rowData: {
    type: Array,
    default: () => []
  },
  validationErrors: {
    type: Object,
    default: () => ({})
  },
  modifiedRows: {
    type: Set,
    default: () => new Set()
  },
  modifiedCells: {
    type: Map,
    default: () => new Map()
  },
  newRows: {
    type: Set,
    default: () => new Set()
  },
  deletedRows: {
    type: Set,
    default: () => new Set()
  }
})

const emit = defineEmits(['cell-edit', 'selection-change', 'paste', 'paste-rows', 'paste-cells'])

const gridContainer = ref(null)
const gridApi = ref(null)

// Custom Scrollbar
const { scrollState, scrollTo, handleColumnChange } = useCustomScrollbar(gridContainer)

const handleCustomScroll = (scrollLeft) => {
  scrollTo(scrollLeft)
}

// Shift+click row range selection
const lastSelectedRowIndex = ref(null)

// Editable columns (in order)
const editableColumns = ['app', 'line', 'process', 'model', 'code', 'emailCategory']

// Cell range selection composable
const {
  cellSelectionStart,
  cellSelectionEnd,
  bulkEditMode,
  handleCellClicked: baseCellClicked,
  handleCellEditingStarted: onCellEditingStarted,
  handleCellEditingStopped: onCellEditingStopped,
  handleKeyDown,
  handleSortChanged: onSortChanged,
  getCellSelectionStyle,
  clearSelection,
  setupHeaderClickHandler,
  setupRowDataWatcher,
  setupSelectionWatcher,
} = useDataGridCellSelection({
  gridApi,
  gridContainer,
  editableColumns,
  onBulkEdit: (updates) => emit('paste-cells', updates),
  onCellEdit: (rowId, field, value) => emit('cell-edit', rowId, field, value),
})

onMounted(() => {
  setupHeaderClickHandler()
})

setupRowDataWatcher(() => props.rowData)
setupSelectionWatcher()

// AG Grid rowSelection API
const rowSelection = ref({
  mode: 'multiRow',
  checkboxes: true,
  headerCheckbox: true,
  enableClickSelection: false,
})

const columnDefs = computed(() => [
  { field: 'app', headerName: 'App', width: 80, editable: true },
  { field: 'line', headerName: 'Line', width: 100, editable: true },
  {
    field: 'process',
    headerName: 'Process',
    width: 120,
    editable: true,
    cellEditor: AgGridProcessModelEditor,
    cellEditorParams: hasMasterAccess.value
      ? { fieldType: 'process', fetchOptions: fetchAllProcesses }
      : { fieldType: 'process', options: userProcesses.value },
    cellEditorPopup: true
  },
  {
    field: 'model',
    headerName: 'Model',
    width: 120,
    editable: true,
    cellEditor: AgGridProcessModelEditor,
    cellEditorParams: (params) => ({
      fieldType: 'model',
      fetchOptions: hasMasterAccess.value
        ? () => fetchAllModels(params.data?.process)
        : () => fetchModelsForProcess(params.data?.process)
    }),
    cellEditorPopup: true
  },
  { field: 'code', headerName: 'Code', width: 100, editable: true },
  {
    field: 'emailCategory',
    headerName: 'Email Category',
    width: 250,
    editable: true,
    cellEditor: AgGridEmailCategoryEditor,
    cellEditorParams: {
      fetchCategories: fetchEmailCategories
    },
    cellEditorPopup: true
  }
])

const getCellStyle = (params) => {
  const rowId = params.data?._id || params.data?._tempId
  if (!rowId) return null

  const selectionStyle = getCellSelectionStyle(params.rowIndex, params.colDef.field)
  if (selectionStyle) return selectionStyle

  const rowErrors = props.validationErrors[rowId]
  if (rowErrors && rowErrors[params.colDef.field]) {
    return {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      borderColor: '#ef4444',
    }
  }

  if (props.modifiedRows.has(rowId)) {
    return {
      backgroundColor: isDark.value ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
    }
  }

  if (props.newRows.has(rowId)) {
    return {
      backgroundColor: isDark.value ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.15)',
    }
  }

  return null
}

const getCellClass = (params) => {
  const rowId = params.data?._id || params.data?._tempId
  if (!rowId) return null

  const field = params.colDef.field
  const cellFields = props.modifiedCells.get(rowId)

  if (cellFields && cellFields.has(field)) {
    return 'cell-value-changed'
  }
  return null
}

const defaultColDef = ref({
  sortable: true,
  resizable: true,
  filter: true,
  cellStyle: params => getCellStyle(params),
  cellClass: params => getCellClass(params),
  tooltipValueGetter: params => {
    const rowId = params.data?._id || params.data?._tempId
    if (!rowId) return null

    const rowErrors = props.validationErrors[rowId]
    if (rowErrors && rowErrors[params.colDef.field]) {
      return rowErrors[params.colDef.field]
    }
    return null
  },
})

const getRowId = (params) => {
  return params.data._id || params.data._tempId
}

const getRowStyle = (params) => {
  const rowId = params.data?._id || params.data?._tempId
  if (props.deletedRows.has(rowId)) {
    return {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      textDecoration: 'line-through',
      opacity: 0.6,
    }
  }
  return null
}

const onGridReady = (params) => {
  gridApi.value = params.api
  handleColumnChange()
}

const onCellValueChanged = (params) => {
  const rowId = params.data._id || params.data._tempId
  const field = params.colDef.field
  const newValue = params.newValue

  emit('cell-edit', rowId, field, newValue)
}

const onSelectionChanged = () => {
  if (!gridApi.value) return
  const selectedRows = gridApi.value.getSelectedRows()
  const selectedIds = selectedRows.map(row => row._id || row._tempId)
  emit('selection-change', selectedIds)
}

const onPasteEnd = (params) => {
  emit('paste', params)
}

const onCellClicked = (params) => {
  const colId = params.colDef.field
  const rowIndex = params.rowIndex

  if (colId === '_selection') {
    if (params.event.shiftKey && lastSelectedRowIndex.value !== null) {
      const start = Math.min(lastSelectedRowIndex.value, rowIndex)
      const end = Math.max(lastSelectedRowIndex.value, rowIndex)

      for (let i = start; i <= end; i++) {
        const node = gridApi.value.getDisplayedRowAtIndex(i)
        node?.setSelected(true)
      }
    } else if (params.event.ctrlKey || params.event.metaKey) {
      lastSelectedRowIndex.value = rowIndex
    } else {
      lastSelectedRowIndex.value = rowIndex
    }
    cellSelectionStart.value = null
    cellSelectionEnd.value = null
    return
  }

  baseCellClicked(params)
}

// Column order for paste
const pasteColumnOrder = ['app', 'line', 'process', 'model', 'code', 'emailCategory']

// Copy handler
const handleCopy = (event) => {
  if (!gridApi.value) return

  let copyData = ''

  const selectedRows = gridApi.value.getSelectedRows()

  if (selectedRows.length > 0) {
    const rows = selectedRows.map(rowData => {
      return editableColumns.map(colId => {
        const value = rowData[colId]
        return value !== null && value !== undefined ? String(value) : ''
      }).join('\t')
    })
    copyData = rows.join('\n')
  } else if (cellSelectionStart.value && cellSelectionEnd.value) {
    const startRowIndex = Math.min(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
    const endRowIndex = Math.max(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)

    const startColIndex = editableColumns.indexOf(cellSelectionStart.value.colId)
    const endColIndex = editableColumns.indexOf(cellSelectionEnd.value.colId)
    const minColIndex = Math.min(startColIndex, endColIndex)
    const maxColIndex = Math.max(startColIndex, endColIndex)

    const rows = []
    for (let rowIdx = startRowIndex; rowIdx <= endRowIndex; rowIdx++) {
      const rowNode = gridApi.value.getDisplayedRowAtIndex(rowIdx)
      if (!rowNode) continue

      const cells = []
      for (let colIdx = minColIndex; colIdx <= maxColIndex; colIdx++) {
        const colId = editableColumns[colIdx]
        const value = rowNode.data[colId]
        cells.push(value !== null && value !== undefined ? String(value) : '')
      }
      rows.push(cells.join('\t'))
    }
    copyData = rows.join('\n')
  } else {
    const focusedCell = gridApi.value.getFocusedCell()
    if (focusedCell) {
      const rowNode = gridApi.value.getDisplayedRowAtIndex(focusedCell.rowIndex)
      if (rowNode) {
        const value = rowNode.data[focusedCell.column.colId]
        copyData = value !== null && value !== undefined ? String(value) : ''
      }
    }
  }

  if (copyData) {
    event.preventDefault()
    event.clipboardData.setData('text/plain', copyData)
  }
}

// Paste handler
const handlePaste = (event) => {
  const clipboardData = event.clipboardData || window.clipboardData
  if (!clipboardData) return

  const pastedText = clipboardData.getData('text')
  if (!pastedText) return

  event.preventDefault()

  const focusedCell = gridApi.value?.getFocusedCell()

  // Check if there's a cell selection range (shift+click selection)
  const hasSelectionRange = cellSelectionStart.value && cellSelectionEnd.value

  if (hasSelectionRange || focusedCell) {
    // Determine start position and selection range
    let startRowIndex, startColIndex
    let selectionStartRow, selectionEndRow, selectionStartCol, selectionEndCol

    if (hasSelectionRange) {
      // Use selection range
      selectionStartRow = Math.min(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
      selectionEndRow = Math.max(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
      const startColIdx = editableColumns.indexOf(cellSelectionStart.value.colId)
      const endColIdx = editableColumns.indexOf(cellSelectionEnd.value.colId)
      selectionStartCol = Math.min(startColIdx, endColIdx)
      selectionEndCol = Math.max(startColIdx, endColIdx)

      startRowIndex = selectionStartRow
      startColIndex = selectionStartCol
    } else {
      // Use focused cell
      startRowIndex = focusedCell.rowIndex
      startColIndex = editableColumns.indexOf(focusedCell.column.colId)
      selectionStartRow = selectionEndRow = startRowIndex
      selectionStartCol = selectionEndCol = startColIndex
    }

    if (startColIndex === -1) return

    const hasTab = pastedText.includes('\t')
    const hasNewline = pastedText.includes('\n')
    let dataRows

    if (hasTab) {
      dataRows = pastedText.split('\n').filter(row => row.trim()).map(row => row.split('\t'))
    } else if (hasNewline) {
      dataRows = pastedText.split('\n').filter(row => row.trim()).map(row => [row])
    } else {
      dataRows = [[pastedText.trim()]]
    }

    const cellUpdates = []

    // If single value is pasted and there's a selection range, fill all selected cells
    const isSingleValue = dataRows.length === 1 && dataRows[0].length === 1

    if (isSingleValue && hasSelectionRange) {
      // Fill all selected cells with the single value
      const pastedValue = dataRows[0][0]

      for (let rowIdx = selectionStartRow; rowIdx <= selectionEndRow; rowIdx++) {
        const rowNode = gridApi.value.getDisplayedRowAtIndex(rowIdx)
        if (!rowNode) continue

        const rowId = rowNode.data._id || rowNode.data._tempId

        for (let colIdx = selectionStartCol; colIdx <= selectionEndCol; colIdx++) {
          const field = editableColumns[colIdx]
          cellUpdates.push({ rowId, field, value: pastedValue })
        }
      }
    } else {
      // Paste data starting from start position (original behavior)
      for (let rowOffset = 0; rowOffset < dataRows.length; rowOffset++) {
        const cells = dataRows[rowOffset]
        const targetRowIndex = startRowIndex + rowOffset
        const rowNode = gridApi.value.getDisplayedRowAtIndex(targetRowIndex)

        if (!rowNode) continue

        const rowId = rowNode.data._id || rowNode.data._tempId

        for (let colOffset = 0; colOffset < cells.length; colOffset++) {
          const targetColIndex = startColIndex + colOffset
          if (targetColIndex >= editableColumns.length) break

          const field = editableColumns[targetColIndex]
          const value = cells[colOffset]?.trim() || ''

          cellUpdates.push({ rowId, field, value })
        }
      }
    }

    if (cellUpdates.length > 0) {
      emit('paste-cells', cellUpdates)
      // Clear selection after paste
      if (hasSelectionRange) {
        clearSelection()
        gridApi.value?.refreshCells({ force: true })
      }
    }
  } else {
    // New rows
    const rows = pastedText.split('\n').filter(row => row.trim())
    if (rows.length === 0) return

    const parsedRows = []

    for (const row of rows) {
      const cells = row.split('\t')
      if (cells.length === 0) continue

      const firstCell = cells[0]?.trim().toLowerCase()
      // Skip header row
      if (firstCell === 'app' || firstCell === 'line') {
        continue
      }

      const rowData = {}
      for (let i = 0; i < Math.min(cells.length, pasteColumnOrder.length); i++) {
        const field = pasteColumnOrder[i]
        rowData[field] = cells[i]?.trim() || ''
      }

      const hasValue = Object.values(rowData).some(v => v !== '' && v !== null)
      if (hasValue) {
        parsedRows.push(rowData)
      }
    }

    if (parsedRows.length > 0) {
      emit('paste-rows', parsedRows)
    }
  }
}

// Watchers
watch(() => props.validationErrors, () => {
  if (gridApi.value) {
    gridApi.value.refreshCells({ force: true })
  }
}, { deep: true })

watch([() => props.modifiedRows, () => props.newRows, () => props.deletedRows], () => {
  if (gridApi.value) {
    gridApi.value.redrawRows()
  }
}, { deep: true })

// Expose methods
defineExpose({
  getSelectedRows: () => gridApi.value?.getSelectedRows() || [],
  clearSelection: () => {
    gridApi.value?.deselectAll()
    clearSelection()
  },
  refreshCells: () => gridApi.value?.refreshCells({ force: true }),
  clearCellSelection: () => {
    clearSelection()
    gridApi.value?.refreshCells({ force: true })
  },
})
</script>
