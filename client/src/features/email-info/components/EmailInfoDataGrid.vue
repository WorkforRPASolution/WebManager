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
      :processCellFromClipboard="processCellFromClipboard"
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
import { useColumnWidthExporter } from '../../../shared/composables/useColumnWidthExporter'
import CustomHorizontalScrollbar from '../../../shared/components/CustomHorizontalScrollbar.vue'
import AgGridTagEditor from '../../../shared/components/AgGridTagEditor.vue'
import AgGridCategoryEditor from '../../../shared/components/AgGridCategoryEditor.vue'
import { arrayToString, stringToArray } from '../validation'
import { clientListApi } from '../../clients/api'

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

const { isDark } = useTheme()

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
  },
  availableProcesses: {
    type: Array,
    default: () => []
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
const editableColumns = ['project', 'category', 'account', 'departments']

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
  handlePaste: basePaste,
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
  onPasteCells: (updates) => emit('paste-cells', updates),
  valueTransformer: transformArrayValue,
})

// Admin용: 컬럼 폭 클립보드 복사
const { exportColumnWidths } = useColumnWidthExporter(gridApi)

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

// Array field value formatter
const arrayValueFormatter = (params) => {
  if (Array.isArray(params.value)) {
    return arrayToString(params.value)
  }
  return params.value || ''
}

// Array field value parser (for editing)
const arrayValueParser = (params) => {
  if (typeof params.newValue === 'string') {
    return stringToArray(params.newValue)
  }
  return params.newValue || []
}

// Array field value getter (for editing display)
const arrayValueGetter = (params) => {
  const value = params.data?.[params.colDef.field]
  if (Array.isArray(value)) {
    return arrayToString(value)
  }
  return value || ''
}

// Array field value setter
const arrayValueSetter = (params) => {
  const newValue = typeof params.newValue === 'string'
    ? stringToArray(params.newValue)
    : params.newValue || []
  params.data[params.colDef.field] = newValue
  return true
}

// Fetch models for category editor
const fetchModelsForCategory = async (process) => {
  try {
    const response = await clientListApi.getModels(process)
    return response.data || []
  } catch (error) {
    console.error('Failed to fetch models:', error)
    return []
  }
}

const columnDefs = computed(() => [
  { field: 'project', headerName: 'Project', width: 100, editable: true },
  {
    field: 'category',
    headerName: 'Category',
    width: 250,
    editable: true,
    cellEditor: AgGridCategoryEditor,
    cellEditorParams: {
      processes: props.availableProcesses,
      fetchModels: fetchModelsForCategory,
      prefix: 'EMAIL-'
    },
    cellEditorPopup: true
  },
  {
    field: 'account',
    headerName: 'Account (Emails)',
    width: 300,
    editable: true,
    valueFormatter: arrayValueFormatter,
    valueGetter: arrayValueGetter,
    valueSetter: arrayValueSetter,
    cellEditor: AgGridTagEditor,
    cellEditorParams: {
      placeholder: 'Enter email and press Enter...'
    },
    cellEditorPopup: true
  },
  {
    field: 'departments',
    headerName: 'Departments',
    width: 200,
    editable: true,
    valueFormatter: arrayValueFormatter,
    valueGetter: arrayValueGetter,
    valueSetter: arrayValueSetter,
    cellEditor: AgGridTagEditor,
    cellEditorParams: {
      placeholder: 'Enter department and press Enter...'
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

const processCellFromClipboard = (params) => {
  const value = params.value?.toString().trim() || ''

  // For array fields, convert semicolon/comma separated to array
  if (['account', 'departments'].includes(params.column.colId)) {
    return stringToArray(value)
  }

  return value
}

const onGridReady = (params) => {
  gridApi.value = params.api
  handleColumnChange()
}

const onCellValueChanged = (params) => {
  const rowId = params.data._id || params.data._tempId
  const field = params.colDef.field
  let newValue = params.newValue

  // Convert string to array for array fields if needed
  if (['account', 'departments'].includes(field) && typeof newValue === 'string') {
    newValue = stringToArray(newValue)
  }

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
const pasteColumnOrder = ['project', 'category', 'account', 'departments']

// Array fields transformer for paste
const transformArrayValue = (field, value) => {
  if (['account', 'departments'].includes(field)) {
    return stringToArray(value)
  }
  return value
}

// Copy handler
const handleCopy = (event) => {
  if (!gridApi.value) return

  let copyData = ''

  const selectedRows = gridApi.value.getSelectedRows()

  if (selectedRows.length > 0) {
    const rows = selectedRows.map(rowData => {
      return editableColumns.map(colId => {
        const value = rowData[colId]
        if (Array.isArray(value)) {
          return arrayToString(value)
        }
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
        if (Array.isArray(value)) {
          cells.push(arrayToString(value))
        } else {
          cells.push(value !== null && value !== undefined ? String(value) : '')
        }
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
        if (Array.isArray(value)) {
          copyData = arrayToString(value)
        } else {
          copyData = value !== null && value !== undefined ? String(value) : ''
        }
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
  // 공용 composable의 handlePaste 먼저 시도 (셀 범위 선택 시 단일 값 채우기 포함)
  if (basePaste(event)) {
    return
  }

  // 셀이 선택되지 않은 상태 → 새 행 추가
  const clipboardData = event.clipboardData || window.clipboardData
  if (!clipboardData) return

  const pastedText = clipboardData.getData('text')
  if (!pastedText) return

  event.preventDefault()

  const rows = pastedText.split('\n').filter(row => row.trim())
  if (rows.length === 0) return

  const parsedRows = []

  for (const row of rows) {
    const cells = row.split('\t')
    if (cells.length === 0) continue

    const firstCell = cells[0]?.trim().toLowerCase()
    if (firstCell === 'project' || firstCell === 'category') {
      continue
    }

    const rowData = {}
    for (let i = 0; i < Math.min(cells.length, pasteColumnOrder.length); i++) {
      const field = pasteColumnOrder[i]
      let value = cells[i]?.trim() || ''

      // Array field conversion
      value = transformArrayValue(field, value)

      rowData[field] = value
    }

    const hasValue = Object.values(rowData).some(v => {
      if (Array.isArray(v)) return v.length > 0
      return v !== '' && v !== null
    })
    if (hasValue) {
      parsedRows.push(rowData)
    }
  }

  if (parsedRows.length > 0) {
    emit('paste-rows', parsedRows)
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
  exportColumnWidths,
})
</script>
