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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community'
import { useTheme } from '../../../shared/composables/useTheme'
import { useCustomScrollbar } from '../../../shared/composables/useCustomScrollbar'
import { useDataGridCellSelection } from '../../../shared/composables/useDataGridCellSelection'
import CustomHorizontalScrollbar from '../../../shared/components/CustomHorizontalScrollbar.vue'
import { osVersionApi } from '../api'

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

const { isDark } = useTheme()

// AG Grid 35 Theme API - 커스텀 테마 생성
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

// OS Version options for dropdown
const osVersionOptions = ref([])

// Custom Scrollbar
const { scrollState, scrollTo, handleColumnChange } = useCustomScrollbar(gridContainer)

const handleCustomScroll = (scrollLeft) => {
  scrollTo(scrollLeft)
}

// Shift+클릭 행 범위 선택을 위한 마지막 선택 행
const lastSelectedRowIndex = ref(null)

// 편집 가능한 컬럼 목록 (순서대로)
const editableColumns = [
  'line', 'lineDesc', 'process', 'eqpModel', 'eqpId', 'category',
  'ipAddr', 'ipAddrL', 'emailcategory', 'osVer',
  'onoff', 'webmanagerUse', 'usereleasemsg', 'usetkincancel'
]

// 셀 범위 선택 및 일괄 편집 Composable
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

// Load OS version options
async function loadOSVersionOptions() {
  try {
    const response = await osVersionApi.getDistinct()
    osVersionOptions.value = response.data.data || []
  } catch (error) {
    console.error('Failed to load OS versions:', error)
  }
}

onMounted(() => {
  setupHeaderClickHandler()
  loadOSVersionOptions()
})

// rowData 변경 시 선택 해제
setupRowDataWatcher(() => props.rowData)

// 선택 범위 변경 시 그리드 갱신
setupSelectionWatcher()

// AG Grid 35 rowSelection API - 체크박스와 클릭 선택 비활성화
const rowSelection = ref({
  mode: 'multiRow',
  checkboxes: true,
  headerCheckbox: true,
  enableClickSelection: false,
})

const columnDefs = ref([
  // 체크박스 컬럼은 rowSelection.checkboxes로 자동 생성됨
  { field: 'line', headerName: 'Line', width: 100, editable: true },
  { field: 'lineDesc', headerName: 'Line Desc', width: 150, editable: true },
  { field: 'process', headerName: 'Process', width: 120, editable: true },
  { field: 'eqpModel', headerName: 'Model', width: 120, editable: true },
  { field: 'eqpId', headerName: 'Eqp ID', width: 120, editable: true },
  { field: 'category', headerName: 'Category', width: 100, editable: true },
  { field: 'ipAddr', headerName: 'IP Address', width: 130, editable: true },
  { field: 'ipAddrL', headerName: 'Inner IP', width: 130, editable: true },
  {
    field: 'localpc',
    headerName: 'Local PC',
    width: 90,
    editable: false,  // 서버에서 자동 결정
  },
  { field: 'emailcategory', headerName: 'Email Cat.', width: 100, editable: true },
  {
    field: 'osVer',
    headerName: 'OS Version',
    width: 120,
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: () => ({ values: osVersionOptions.value })
  },
  {
    field: 'onoff',
    headerName: 'On/Off',
    width: 80,
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: [0, 1] },
  },
  {
    field: 'webmanagerUse',
    headerName: 'WebMgr',
    width: 90,
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: [0, 1] },
  },
  { field: 'installdate', headerName: 'Install Date', width: 110, editable: false },
  { field: 'scFirstExcute', headerName: 'First Exec', width: 110, editable: false },
  {
    field: 'snapshotTimeDiff',
    headerName: 'Time Diff',
    width: 90,
    editable: false,
  },
  {
    field: 'usereleasemsg',
    headerName: 'Release Msg',
    width: 100,
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: [0, 1] },
  },
  {
    field: 'usetkincancel',
    headerName: 'TKIN Cancel',
    width: 100,
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: [0, 1] },
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

// 셀 클래스 함수 - 수정된 셀에만 클래스 적용
const getCellClass = (params) => {
  const rowId = params.data?._id || params.data?._tempId
  if (!rowId) return null

  const field = params.colDef.field
  const cellFields = props.modifiedCells.get(rowId)

  // 해당 셀이 수정되었는지 확인
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

  // Convert to number for numeric fields
  const numericFields = ['onoff', 'webmanagerUse', 'usereleasemsg', 'usetkincancel']
  if (numericFields.includes(params.column.colId)) {
    const num = parseInt(value)
    return isNaN(num) ? 0 : num
  }

  return value
}

const onGridReady = (params) => {
  gridApi.value = params.api
  // Initialize custom scrollbar after grid is ready
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
  // Handle paste event - new rows might be added
  emit('paste', params)
}

// Shift+클릭으로 체크박스 범위 선택 및 셀 범위 선택
const onCellClicked = (params) => {
  const colId = params.colDef.field
  const rowIndex = params.rowIndex

  // 체크박스 컬럼 클릭 처리
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

// 컬럼 순서 정의 (스프레드시트에서 복사할 때 사용)
const pasteColumnOrder = [
  'line', 'lineDesc', 'process', 'eqpModel', 'eqpId', 'category',
  'ipAddr', 'ipAddrL', 'emailcategory', 'osVer',
  'onoff', 'webmanagerUse', 'usereleasemsg', 'usetkincancel'
]

// 숫자 필드 목록
const numericFields = ['onoff', 'webmanagerUse', 'usereleasemsg', 'usetkincancel']

// 직접 copy 이벤트 처리 (AG Grid Community는 clipboard 미지원)
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
        const value = rowNode.data[colId]
        cells.push(value !== null && value !== undefined ? String(value) : '')
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

// 직접 paste 이벤트 처리 (AG Grid Community는 paste 미지원)
const handlePaste = (event) => {
  const clipboardData = event.clipboardData || window.clipboardData
  if (!clipboardData) return

  const pastedText = clipboardData.getData('text')
  if (!pastedText) return

  event.preventDefault() // 기본 paste 동작 방지

  // 셀이 포커스된 상태인지 확인
  const focusedCell = gridApi.value?.getFocusedCell()

  if (focusedCell) {
    // 셀이 포커스된 상태 → 해당 셀부터 가로로 붙여넣기
    const startRowIndex = focusedCell.rowIndex
    const startColId = focusedCell.column.colId
    const startColIndex = editableColumns.indexOf(startColId)

    if (startColIndex === -1) return // 편집 불가능한 컬럼

    // 데이터 파싱: 탭이 있으면 탭으로, 없으면 줄바꿈으로 구분
    const hasTab = pastedText.includes('\t')
    const hasNewline = pastedText.includes('\n')
    let dataRows

    if (hasTab) {
      // 스프레드시트 형식: 탭으로 열 구분, 줄바꿈으로 행 구분
      dataRows = pastedText.split('\n').filter(row => row.trim()).map(row => row.split('\t'))
    } else if (hasNewline) {
      // 세로 복사 형식: 줄바꿈으로 행 구분, 각 행은 단일 셀
      dataRows = pastedText.split('\n').filter(row => row.trim()).map(row => [row])
    } else {
      // 탭이 없으면 단일 셀 값으로 처리 (줄바꿈 포함 텍스트)
      dataRows = [[pastedText.trim()]]
    }

    const cellUpdates = []

    for (let rowOffset = 0; rowOffset < dataRows.length; rowOffset++) {
      const cells = dataRows[rowOffset]
      const targetRowIndex = startRowIndex + rowOffset
      const rowNode = gridApi.value.getDisplayedRowAtIndex(targetRowIndex)

      if (!rowNode) continue // 행이 없으면 스킵

      const rowId = rowNode.data._id || rowNode.data._tempId

      for (let colOffset = 0; colOffset < cells.length; colOffset++) {
        const targetColIndex = startColIndex + colOffset
        if (targetColIndex >= editableColumns.length) break

        const field = editableColumns[targetColIndex]
        let value = cells[colOffset]?.trim() || ''

        // 숫자 필드 변환
        if (numericFields.includes(field)) {
          const num = field === 'snapshotTimeDiff' ? parseFloat(value) : parseInt(value)
          value = isNaN(num) ? (field === 'snapshotTimeDiff' ? null : 0) : num
        }

        cellUpdates.push({ rowId, field, value })
      }
    }

    // 셀 업데이트 emit
    if (cellUpdates.length > 0) {
      emit('paste-cells', cellUpdates)
    }
  } else {
    // 셀이 선택되지 않은 상태 → 새 행 추가
    const rows = pastedText.split('\n').filter(row => row.trim())
    if (rows.length === 0) return

    const parsedRows = []

    for (const row of rows) {
      const cells = row.split('\t')
      if (cells.length === 0) continue

      // 첫 번째 셀이 헤더인지 확인 (line, process 등)
      const firstCell = cells[0]?.trim().toLowerCase()
      if (firstCell === 'line' || firstCell === 'process' || firstCell === 'eqpid') {
        continue // 헤더 행 스킵
      }

      const rowData = {}
      for (let i = 0; i < Math.min(cells.length, pasteColumnOrder.length); i++) {
        const field = pasteColumnOrder[i]
        let value = cells[i]?.trim() || ''

        // 숫자 필드 변환
        if (numericFields.includes(field)) {
          const num = field === 'snapshotTimeDiff' ? parseFloat(value) : parseInt(value)
          value = isNaN(num) ? (field === 'snapshotTimeDiff' ? null : 0) : num
        }

        rowData[field] = value
      }

      // 최소한 하나의 필드에 값이 있어야 추가
      const hasValue = Object.values(rowData).some(v => v !== '' && v !== null && v !== 0)
      if (hasValue) {
        parsedRows.push(rowData)
      }
    }

    if (parsedRows.length > 0) {
      emit('paste-rows', parsedRows)
    }
  }
}

// Refresh cells when validation errors change
watch(() => props.validationErrors, () => {
  if (gridApi.value) {
    gridApi.value.refreshCells({ force: true })
  }
}, { deep: true })

// Refresh cells when row states change
watch([() => props.modifiedRows, () => props.newRows, () => props.deletedRows], () => {
  if (gridApi.value) {
    // Use redrawRows for row style updates (deletedRows styling)
    gridApi.value.redrawRows()
  }
}, { deep: true })

// Expose methods for parent component
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
  refreshOSVersionOptions: loadOSVersionOptions,
})
</script>


