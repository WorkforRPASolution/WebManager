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
import AgGridMultiSelectEditor from '../../../shared/components/AgGridMultiSelectEditor.vue'

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

const { isDark } = useTheme()

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
  roles: {
    type: Array,
    default: () => []
  },
  availableProcesses: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['cell-edit', 'selection-change', 'paste-rows', 'paste-cells', 'approve-user', 'approve-reset'])

const gridContainer = ref(null)
const gridApi = ref(null)

// Custom Scrollbar
const { scrollState, scrollTo, handleColumnChange } = useCustomScrollbar(gridContainer)

const handleCustomScroll = (scrollLeft) => {
  scrollTo(scrollLeft)
}

// Shift+클릭 행 범위 선택을 위한 마지막 선택 행
const lastSelectedRowIndex = ref(null)

const editableColumns = [
  'name', 'singleid', 'password', 'line', 'processes',
  'authority', 'authorityManager', 'note', 'email', 'department', 'accountStatus'
]

// 셀 범위 선택 및 일괄 편집 Composable
const {
  cellSelectionStart,
  cellSelectionEnd,
  bulkEditMode,
  handleCellClicked: baseCellClicked,
  handleCellEditingStarted: onCellEditingStarted,
  handleCellEditingStopped: baseEditingStopped,
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
  onPasteCells: (updates) => {
    // Filter out password updates (null values from transformer)
    const filtered = updates.filter(u => u.value !== null)
    if (filtered.length > 0) {
      emit('paste-cells', filtered)
    }
  },
  valueTransformer: (field, value) => {
    // Skip password field
    if (field === 'password') return null

    if (field === 'authorityManager') {
      return parseInt(value) || 2
    } else if (field === 'accountStatus') {
      const lower = value.toLowerCase()
      if (['pending', 'active', 'suspended'].includes(lower)) {
        return lower
      }
      return 'active' // default
    } else if (field === 'processes') {
      // Parse semicolon-separated string to array
      return value.split(';').map(p => p.trim()).filter(Boolean)
    }
    return value
  },
})

onMounted(() => {
  setupHeaderClickHandler()
})

// rowData 변경 시 선택 해제
setupRowDataWatcher(() => props.rowData)

// 선택 범위 변경 시 그리드 갱신
setupSelectionWatcher()

const rowSelection = ref({
  mode: 'multiRow',
  checkboxes: true,
  headerCheckbox: true,
  enableClickSelection: false,
})

const columnDefs = ref([
  { field: 'name', headerName: 'Name', width: 150, editable: true },
  { field: 'singleid', headerName: 'User ID', width: 120, editable: true },
  {
    field: 'password',
    headerName: 'Password',
    width: 120,
    editable: true,
    valueFormatter: (params) => params.value ? '********' : '',
  },
  { field: 'line', headerName: 'Line', width: 100, editable: true },
  {
    field: 'processes',
    headerName: 'Process',
    width: 180,
    editable: true,
    // Display as tags
    cellRenderer: (params) => {
      const processes = params.data?.processes
      if (!processes || !Array.isArray(processes) || processes.length === 0) {
        return '<span class="text-gray-400 dark:text-gray-500">-</span>'
      }
      return processes.map(p =>
        `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-1">${p}</span>`
      ).join('')
    },
    // Multi-select editor with custom input support
    cellEditor: AgGridMultiSelectEditor,
    cellEditorParams: () => ({
      options: props.availableProcesses,
      allowCustomInput: true  // Allow adding custom values (A-Z, _ only)
    }),
    cellEditorPopup: true,
    // Handle array value from editor
    valueSetter: (params) => {
      const newValue = params.newValue
      if (Array.isArray(newValue)) {
        params.data.processes = newValue
      } else if (typeof newValue === 'string') {
        params.data.processes = newValue.split(';').map(p => p.trim()).filter(Boolean)
      } else {
        params.data.processes = []
      }
      return true
    },
    tooltipValueGetter: () => 'Click to select processes'
  },
  {
    field: 'authority',
    headerName: 'RPA Auth',
    width: 100,
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: ['', 'WRITE'] },
  },
  {
    field: 'authorityManager',
    headerName: 'Role Level',
    width: 100,
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: [0, 1, 2, 3] },
    valueFormatter: (params) => {
      const labels = ['User (0)', 'Admin (1)', 'Conductor (2)', 'Manager (3)']
      return labels[params.value] || params.value
    },
  },
  { field: 'note', headerName: 'Note', width: 150, editable: true },
  { field: 'email', headerName: 'Email', width: 180, editable: true },
  { field: 'department', headerName: 'Department', width: 120, editable: true },
  {
    field: 'accountStatus',
    headerName: 'Account',
    width: 100,
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: ['pending', 'active', 'suspended'] },
    cellRenderer: (params) => {
      const status = params.value
      const styles = {
        pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
        active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      }
      const labels = { pending: 'Pending', active: 'Active', suspended: 'Suspended' }
      return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || ''}">${labels[status] || status}</span>`
    },
  },
  {
    field: 'passwordStatus',
    headerName: 'Password',
    width: 120,
    editable: false,
    cellRenderer: (params) => {
      const status = params.value
      if (status === 'normal') return '-'
      const styles = {
        reset_requested: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
        must_change: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      }
      const labels = { reset_requested: 'Reset Requested', must_change: 'Must Change' }
      return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || ''}">${labels[status] || status}</span>`
    },
  },
  {
    field: 'actions',
    headerName: 'Actions',
    width: 150,
    editable: false,
    sortable: false,
    filter: false,
    cellRenderer: (params) => {
      const data = params.data
      if (!data) return ''

      const buttons = []

      // Show approve button for pending users
      if (data.accountStatus === 'pending') {
        buttons.push(`<button class="approve-user-btn px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded mr-1" data-id="${data._id}">Approve</button>`)
      }

      // Show approve reset button for users with password reset requested
      if (data.passwordStatus === 'reset_requested') {
        buttons.push(`<button class="approve-reset-btn px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded" data-id="${data._id}">Reset PW</button>`)
      }

      return buttons.join('')
    },
    onCellClicked: (params) => {
      const target = params.event.target
      if (target.classList.contains('approve-user-btn')) {
        const id = target.getAttribute('data-id')
        emit('approve-user', id)
      } else if (target.classList.contains('approve-reset-btn')) {
        const id = target.getAttribute('data-id')
        emit('approve-reset', id)
      }
    }
  },
  {
    field: 'lastLoginAt',
    headerName: 'Last Login',
    width: 150,
    editable: false,
    valueFormatter: (params) => {
      if (!params.value) return '-'
      return new Date(params.value).toLocaleString()
    },
  },
])

// 셀 스타일 함수 - AG Grid에서 매번 호출됨
const getCellStyle = (params) => {
  const rowId = params.data?._id || params.data?._tempId
  if (!rowId) return null

  // Check for cell range selection (highest priority for visual feedback)
  const selectionStyle = getCellSelectionStyle(params.rowIndex, params.colDef.field)
  if (selectionStyle) return selectionStyle

  // Check for validation errors
  const rowErrors = props.validationErrors[rowId]
  if (rowErrors && rowErrors[params.colDef.field]) {
    return {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      borderColor: '#ef4444',
    }
  }

  // Check if cell is modified (for existing rows)
  if (props.modifiedRows.has(rowId)) {
    return {
      backgroundColor: isDark.value ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
    }
  }

  // Check if row is new
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
  // Initialize custom scrollbar after grid is ready
  handleColumnChange()
}

const onCellValueChanged = (params) => {
  const rowId = params.data._id || params.data._tempId
  const field = params.colDef.field
  let newValue = params.newValue

  // Convert to number for authorityManager
  if (field === 'authorityManager') {
    newValue = Number(newValue)
  }

  // Handle processes field - convert string to array if needed
  if (field === 'processes') {
    if (typeof newValue === 'string') {
      newValue = newValue.split(';').map(p => p.trim()).filter(Boolean)
    } else if (!Array.isArray(newValue)) {
      newValue = []
    }
  }

  // 기존 동작: 편집한 셀 업데이트
  emit('cell-edit', rowId, field, newValue)
}

const onSelectionChanged = () => {
  if (!gridApi.value) return
  const selectedRows = gridApi.value.getSelectedRows()
  const selectedIds = selectedRows.map(row => row._id || row._tempId)
  emit('selection-change', selectedIds)
}

// Shift+클릭으로 체크박스 범위 선택 및 셀 범위 선택
const onCellClicked = (params) => {
  const colId = params.colDef.field
  const rowIndex = params.rowIndex

  // 체크박스 컬럼 클릭 처리 (UserDataGrid 전용)
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

  // 나머지 셀 클릭은 composable에 위임
  baseCellClicked(params)
}

// 셀 편집 완료 시 처리 - composable에 위임
const onCellEditingStopped = (params) => {
  baseEditingStopped(params)
}

const handleCopy = (event) => {
  if (!gridApi.value) return

  let copyData = ''

  // 1. 체크박스로 선택된 행들 확인
  const selectedRows = gridApi.value.getSelectedRows()

  if (selectedRows.length > 0) {
    // 선택된 행들 복사 (모든 편집 가능한 컬럼)
    const rows = selectedRows.map(rowData => {
      return editableColumns.map(colId => {
        const value = rowData[colId]
        if (colId === 'password') return '' // Don't copy password
        // Convert processes array to semicolon-separated string
        if (colId === 'processes' && Array.isArray(value)) {
          return value.join(';')
        }
        return value !== null && value !== undefined ? String(value) : ''
      }).join('\t')
    })
    copyData = rows.join('\n')
  } else if (cellSelectionStart.value && cellSelectionEnd.value) {
    // 2. 셀 범위가 선택되어 있으면 해당 범위 복사
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
        if (colId === 'password') {
          cells.push('')
          continue
        }
        const value = rowNode.data[colId]
        // Convert processes array to semicolon-separated string
        if (colId === 'processes' && Array.isArray(value)) {
          cells.push(value.join(';'))
        } else {
          cells.push(value !== null && value !== undefined ? String(value) : '')
        }
      }
      rows.push(cells.join('\t'))
    }
    copyData = rows.join('\n')
  } else {
    // 3. 선택된 행이나 셀 범위가 없으면 포커스된 셀 값만 복사
    const focusedCell = gridApi.value.getFocusedCell()
    if (focusedCell) {
      const rowNode = gridApi.value.getDisplayedRowAtIndex(focusedCell.rowIndex)
      if (rowNode) {
        const colId = focusedCell.column.colId
        if (colId === 'password') {
          copyData = ''
        } else {
          const value = rowNode.data[colId]
          // Convert processes array to semicolon-separated string
          if (colId === 'processes' && Array.isArray(value)) {
            copyData = value.join(';')
          } else {
            copyData = value !== null && value !== undefined ? String(value) : ''
          }
        }
      }
    }
  }

  if (copyData) {
    event.preventDefault()
    event.clipboardData.setData('text/plain', copyData)
  }
}

// Value transformer for paste new rows
const transformUserValue = (field, value) => {
  if (field === 'password') return null
  if (field === 'authorityManager') {
    return parseInt(value) || 2
  } else if (field === 'accountStatus') {
    const lower = value.toLowerCase()
    if (['pending', 'active', 'suspended'].includes(lower)) {
      return lower
    }
    return 'active'
  } else if (field === 'processes') {
    return value.split(';').map(p => p.trim()).filter(Boolean)
  }
  return value
}

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
  const parsedRows = []

  for (const row of rows) {
    const cells = row.split('\t')
    const firstCell = cells[0]?.trim().toLowerCase()
    if (firstCell === 'name' || firstCell === 'singleid' || firstCell === 'user id') {
      continue // Skip header
    }

    const rowData = {}
    for (let i = 0; i < Math.min(cells.length, editableColumns.length); i++) {
      const field = editableColumns[i]
      const value = cells[i]?.trim() || ''
      const transformed = transformUserValue(field, value)
      if (transformed !== null) {
        rowData[field] = transformed
      }
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

watch(() => props.validationErrors, () => {
  if (gridApi.value) {
    gridApi.value.refreshCells({ force: true })
  }
}, { deep: true })

watch([() => props.modifiedRows, () => props.newRows, () => props.deletedRows], () => {
  if (gridApi.value) {
    // Use redrawRows for row style updates (deletedRows styling)
    gridApi.value.redrawRows()
  }
}, { deep: true })

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

