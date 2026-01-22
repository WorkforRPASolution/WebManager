<template>
  <div ref="gridContainer" class="w-full h-full" @paste="handlePaste" @copy="handleCopy" @keydown.capture="handleKeyDown" tabindex="0">
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
      style="width: 100%; height: 100%;"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community'
import { useTheme } from '../../../shared/composables/useTheme'

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

// Shift+클릭 행 범위 선택을 위한 마지막 선택 행
const lastSelectedRowIndex = ref(null)

// Shift+클릭 셀 범위 선택
const cellSelectionStart = ref(null)  // { rowIndex, colId }
const cellSelectionEnd = ref(null)    // { rowIndex, colId }

// 일괄 편집을 위한 선택 범위 저장
const pendingBulkEditRange = ref(null)

// 일괄 편집 모드 플래그 (Excel 스타일: 첫 번째 셀 편집 후 Enter로 전체 적용)
const bulkEditMode = ref(false)

// Shift+헤더 클릭 시 정렬 복원을 위한 상태
let shiftHeaderClickPending = false
let savedSortState = null

onMounted(() => {
  // Shift+헤더 클릭 감지 및 열 선택 처리
  gridContainer.value?.addEventListener('mousedown', (e) => {
    if (!e.shiftKey) return

    // 헤더 셀인지 확인
    const headerCell = e.target.closest('.ag-header-cell')
    if (!headerCell) return

    // colId 추출
    const colId = headerCell.getAttribute('col-id')
    if (!colId || !editableColumns.includes(colId)) return

    // 현재 정렬 상태 저장 (AG Grid가 정렬 후 복원하기 위해)
    savedSortState = gridApi.value?.getColumnState()
    shiftHeaderClickPending = true

    // 열 전체 선택 수동 실행
    const rowCount = gridApi.value?.getDisplayedRowCount() || 0
    if (rowCount > 0) {
      cellSelectionStart.value = { rowIndex: 0, colId }
      cellSelectionEnd.value = { rowIndex: rowCount - 1, colId }
    }

    // 그리드 컨테이너로 포커스 이동
    gridContainer.value?.focus()
  }, true)  // capture phase
})

// 정렬 변경 시 Shift+클릭이었으면 정렬 복원
const onSortChanged = () => {
  if (shiftHeaderClickPending && savedSortState) {
    shiftHeaderClickPending = false
    // 저장된 정렬 상태로 복원
    gridApi.value?.applyColumnState({ state: savedSortState, applyOrder: true })
    savedSortState = null
  }
}

// 셀이 선택 범위 안에 있는지 확인
const isCellInSelectionRange = (rowIndex, colId) => {
  if (!cellSelectionStart.value || !cellSelectionEnd.value) return false

  const startRowIndex = Math.min(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
  const endRowIndex = Math.max(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)

  const startColIndex = editableColumns.indexOf(cellSelectionStart.value.colId)
  const endColIndex = editableColumns.indexOf(cellSelectionEnd.value.colId)
  const colIndex = editableColumns.indexOf(colId)

  if (startColIndex === -1 || endColIndex === -1 || colIndex === -1) return false

  const minColIndex = Math.min(startColIndex, endColIndex)
  const maxColIndex = Math.max(startColIndex, endColIndex)

  return rowIndex >= startRowIndex && rowIndex <= endRowIndex &&
         colIndex >= minColIndex && colIndex <= maxColIndex
}

// 편집 가능한 컬럼 목록 (순서대로)
const editableColumns = [
  'line', 'lineDesc', 'process', 'eqpModel', 'eqpId', 'category',
  'ipAddr', 'ipAddrL', 'localpc', 'emailcategory', 'osVer',
  'onoff', 'webmanagerUse', 'installdate', 'scFirstExcute',
  'snapshotTimeDiff', 'usereleasemsg', 'usetkincancel'
]

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
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: [0, 1] },
  },
  { field: 'emailcategory', headerName: 'Email Cat.', width: 100, editable: true },
  { field: 'osVer', headerName: 'OS Version', width: 120, editable: true },
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
  { field: 'installdate', headerName: 'Install Date', width: 110, editable: true },
  { field: 'scFirstExcute', headerName: 'First Exec', width: 110, editable: true },
  {
    field: 'snapshotTimeDiff',
    headerName: 'Time Diff',
    width: 90,
    editable: true,
    valueParser: params => params.newValue === '' ? null : Number(params.newValue),
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
  // 직접 ref 값 접근
  const start = cellSelectionStart.value
  const end = cellSelectionEnd.value

  if (start && end) {
    const startRowIndex = Math.min(start.rowIndex, end.rowIndex)
    const endRowIndex = Math.max(start.rowIndex, end.rowIndex)
    const startColIndex = editableColumns.indexOf(start.colId)
    const endColIndex = editableColumns.indexOf(end.colId)
    const colIndex = editableColumns.indexOf(params.colDef.field)

    if (startColIndex !== -1 && endColIndex !== -1 && colIndex !== -1) {
      const minColIndex = Math.min(startColIndex, endColIndex)
      const maxColIndex = Math.max(startColIndex, endColIndex)

      if (params.rowIndex >= startRowIndex && params.rowIndex <= endRowIndex &&
          colIndex >= minColIndex && colIndex <= maxColIndex) {
        return {
          backgroundColor: 'rgba(59, 130, 246, 0.3)',
          borderColor: '#3b82f6',
        }
      }
    }
  }

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
  const numericFields = ['localpc', 'onoff', 'webmanagerUse', 'usereleasemsg', 'usetkincancel']
  if (numericFields.includes(params.column.colId)) {
    const num = parseInt(value)
    return isNaN(num) ? 0 : num
  }

  if (params.column.colId === 'snapshotTimeDiff') {
    const num = parseFloat(value)
    return isNaN(num) ? null : num
  }

  return value
}

const onGridReady = (params) => {
  gridApi.value = params.api
}

// 편집 시작 시 선택 범위 저장 (마우스 더블클릭 시에만)
const onCellEditingStarted = (params) => {
  // 키보드 입력으로 시작된 일괄 편집은 pendingBulkEditRange를 설정하지 않음
  // (onCellEditingStopped에서 처리)
  if (bulkEditMode.value) {
    pendingBulkEditRange.value = null
    return
  }

  // 마우스 더블클릭으로 시작된 편집: 기존 방식 유지
  if (cellSelectionStart.value && cellSelectionEnd.value) {
    pendingBulkEditRange.value = {
      start: { ...cellSelectionStart.value },
      end: { ...cellSelectionEnd.value }
    }
  } else {
    pendingBulkEditRange.value = null
  }
}

const onCellValueChanged = (params) => {
  const rowId = params.data._id || params.data._tempId
  const field = params.colDef.field
  const newValue = params.newValue

  // 키보드 입력으로 시작된 일괄 편집 중에는 단일 셀만 업데이트
  // (Enter 시 onCellEditingStopped에서 전체 셀에 적용)
  if (bulkEditMode.value) {
    emit('cell-edit', rowId, field, newValue)
    return
  }

  // 마우스 더블클릭으로 시작된 편집: 기존 방식 유지
  if (pendingBulkEditRange.value) {
    const range = pendingBulkEditRange.value
    const startRowIndex = Math.min(range.start.rowIndex, range.end.rowIndex)
    const endRowIndex = Math.max(range.start.rowIndex, range.end.rowIndex)

    const startColIndex = editableColumns.indexOf(range.start.colId)
    const endColIndex = editableColumns.indexOf(range.end.colId)
    const minColIndex = Math.min(startColIndex, endColIndex)
    const maxColIndex = Math.max(startColIndex, endColIndex)

    const cellUpdates = []
    for (let rowIdx = startRowIndex; rowIdx <= endRowIndex; rowIdx++) {
      const rowNode = gridApi.value.getDisplayedRowAtIndex(rowIdx)
      if (!rowNode) continue
      const targetRowId = rowNode.data._id || rowNode.data._tempId

      for (let colIdx = minColIndex; colIdx <= maxColIndex; colIdx++) {
        const targetField = editableColumns[colIdx]
        // 편집한 셀은 이미 업데이트되므로 나머지만 추가
        if (targetRowId === rowId && targetField === field) continue
        cellUpdates.push({ rowId: targetRowId, field: targetField, value: newValue })
      }
    }

    if (cellUpdates.length > 0) {
      emit('paste-cells', cellUpdates)
    }

    // 범위 초기화
    pendingBulkEditRange.value = null
    cellSelectionStart.value = null
    cellSelectionEnd.value = null

    // 일괄 편집 후 화면 새로고침 (하이라이트 표시)
    setTimeout(() => {
      gridApi.value?.refreshCells({ force: true })
    }, 0)
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

const onPasteEnd = (params) => {
  // Handle paste event - new rows might be added
  emit('paste', params)
}

// Shift+클릭으로 체크박스 범위 선택 및 셀 범위 선택 (페이지 내에서만 동작)
const onCellClicked = (params) => {
  const colId = params.colDef.field
  const rowIndex = params.rowIndex

  // 체크박스 컬럼 클릭 처리
  if (colId === '_selection') {
    if (params.event.shiftKey && lastSelectedRowIndex.value !== null) {
      // Shift+클릭: 행 범위 선택 (현재 페이지 내에서만)
      const start = Math.min(lastSelectedRowIndex.value, rowIndex)
      const end = Math.max(lastSelectedRowIndex.value, rowIndex)

      for (let i = start; i <= end; i++) {
        const node = gridApi.value.getDisplayedRowAtIndex(i)
        node?.setSelected(true)
      }
    } else if (params.event.ctrlKey || params.event.metaKey) {
      // Ctrl+클릭: 개별 토글 (기본 체크박스 동작이 처리함)
      lastSelectedRowIndex.value = rowIndex
    } else {
      // 일반 클릭: 마지막 선택 행 업데이트
      lastSelectedRowIndex.value = rowIndex
    }
    // 체크박스 클릭 시 셀 범위 선택 초기화
    cellSelectionStart.value = null
    cellSelectionEnd.value = null
    return
  }

  // 일반 셀 클릭 - 셀 범위 선택 처리
  if (params.event.shiftKey && cellSelectionStart.value) {
    // Shift+클릭: 셀 범위 선택 (현재 페이지 내에서만)
    cellSelectionEnd.value = { rowIndex, colId }
  } else {
    // 일반 클릭: 새로운 셀 범위 시작점 (기존 선택 해제)
    cellSelectionStart.value = { rowIndex, colId }
    cellSelectionEnd.value = null
  }
  // watcher가 refreshCells 처리함
}

// 선택된 셀들 비우기 (Delete/Backspace)
const clearSelectedCells = () => {
  if (!cellSelectionStart.value || !cellSelectionEnd.value) return

  const startRow = Math.min(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
  const endRow = Math.max(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
  const startColIdx = editableColumns.indexOf(cellSelectionStart.value.colId)
  const endColIdx = editableColumns.indexOf(cellSelectionEnd.value.colId)
  const minCol = Math.min(startColIdx, endColIdx)
  const maxCol = Math.max(startColIdx, endColIdx)

  for (let rowIdx = startRow; rowIdx <= endRow; rowIdx++) {
    const rowNode = gridApi.value?.getDisplayedRowAtIndex(rowIdx)
    if (!rowNode) continue
    const rowId = rowNode.data._id || rowNode.data._tempId

    for (let colIdx = minCol; colIdx <= maxCol; colIdx++) {
      const colId = editableColumns[colIdx]
      emit('cell-edit', rowId, colId, '')
    }
  }

  gridApi.value?.refreshCells({ force: true })
}

// ESC 키로 셀 선택 해제 및 키보드 입력으로 첫 번째 셀 편집 모드 진입 (Excel 스타일)
const handleKeyDown = (event) => {
  // 이미 편집 모드 중이면 키 입력을 에디터로 전달 (가로채지 않음)
  // ESC는 AG Grid가 처리하고 onCellEditingStopped에서 선택 해제됨
  if (bulkEditMode.value) {
    return
  }

  // ESC: 선택 해제
  if (event.key === 'Escape') {
    cellSelectionStart.value = null
    cellSelectionEnd.value = null
    return
  }

  // 셀 범위가 선택되어 있고, printable 문자 입력인 경우
  if (cellSelectionStart.value && cellSelectionEnd.value) {
    // Ctrl/Cmd 조합키는 무시 (복사/붙여넣기 등)
    if (event.ctrlKey || event.metaKey) return

    // Delete/Backspace: 선택된 셀들 비우기
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      clearSelectedCells()
      return
    }

    // printable 문자 입력: 첫 번째 셀 편집 모드 시작 (Excel 스타일)
    if (event.key.length === 1) {
      event.preventDefault()

      // 선택 범위의 첫 번째 셀 (왼쪽 상단)
      const startRow = Math.min(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
      const startColIdx = Math.min(
        editableColumns.indexOf(cellSelectionStart.value.colId),
        editableColumns.indexOf(cellSelectionEnd.value.colId)
      )
      const startColId = editableColumns[startColIdx]

      // 일괄 편집 모드 플래그 설정
      bulkEditMode.value = true

      // 입력한 문자 저장
      const charPressed = event.key

      // 첫 번째 셀 편집 시작
      gridApi.value?.startEditingCell({
        rowIndex: startRow,
        colKey: startColId
      })

      // 편집 모드 진입 후 에디터에 문자 입력 및 포커스 설정
      setTimeout(() => {
        const editorInput = gridContainer.value?.querySelector('.ag-cell-editor input, .ag-cell-editor textarea')
        if (editorInput) {
          editorInput.value = charPressed
          editorInput.dispatchEvent(new Event('input', { bubbles: true }))
          // 에디터에 포커스를 설정하여 추가 입력이 가능하도록 함
          editorInput.focus()
          // 커서를 텍스트 끝으로 이동
          editorInput.setSelectionRange(editorInput.value.length, editorInput.value.length)
        }
      }, 0)
    }
  }
}

// 셀 편집 완료 시 처리 (Excel 스타일: Enter로 전체 적용)
const onCellEditingStopped = (params) => {
  // 일괄 편집 모드가 아니면 무시
  if (!bulkEditMode.value) return
  bulkEditMode.value = false

  // ESC로 취소된 경우 (valueChanged가 false)
  if (!params.valueChanged) {
    cellSelectionStart.value = null
    cellSelectionEnd.value = null
    gridApi.value?.refreshCells({ force: true })
    return
  }

  const newValue = params.newValue

  // 선택된 범위의 모든 셀에 값 적용 (편집한 셀 제외)
  const startRow = Math.min(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
  const endRow = Math.max(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
  const startColIdx = editableColumns.indexOf(cellSelectionStart.value.colId)
  const endColIdx = editableColumns.indexOf(cellSelectionEnd.value.colId)
  const minCol = Math.min(startColIdx, endColIdx)
  const maxCol = Math.max(startColIdx, endColIdx)

  const cellUpdates = []
  for (let rowIdx = startRow; rowIdx <= endRow; rowIdx++) {
    const rowNode = gridApi.value?.getDisplayedRowAtIndex(rowIdx)
    if (!rowNode) continue
    const rowId = rowNode.data._id || rowNode.data._tempId

    for (let colIdx = minCol; colIdx <= maxCol; colIdx++) {
      const colId = editableColumns[colIdx]
      // 편집한 셀은 이미 업데이트됨
      if (rowIdx === params.rowIndex && colId === params.column.colId) continue
      cellUpdates.push({ rowId, field: colId, value: newValue })
    }
  }

  if (cellUpdates.length > 0) {
    emit('paste-cells', cellUpdates)
  }

  // 선택 해제
  cellSelectionStart.value = null
  cellSelectionEnd.value = null
  gridApi.value?.refreshCells({ force: true })
}

// 컬럼 순서 정의 (스프레드시트에서 복사할 때 사용)
const pasteColumnOrder = [
  'line', 'lineDesc', 'process', 'eqpModel', 'eqpId', 'category',
  'ipAddr', 'ipAddrL', 'localpc', 'emailcategory', 'osVer',
  'onoff', 'webmanagerUse', 'installdate', 'scFirstExcute',
  'snapshotTimeDiff', 'usereleasemsg', 'usetkincancel'
]

// 숫자 필드 목록
const numericFields = ['localpc', 'onoff', 'webmanagerUse', 'usereleasemsg', 'usetkincancel', 'snapshotTimeDiff']

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
    let dataRows

    if (hasTab) {
      // 스프레드시트 형식: 탭으로 열 구분, 줄바꿈으로 행 구분
      dataRows = pastedText.split('\n').filter(row => row.trim()).map(row => row.split('\t'))
    } else {
      // 세로 복사 형식: 줄바꿈으로 행 구분, 각 행은 단일 셀
      dataRows = pastedText.split('\n').filter(row => row.trim()).map(row => [row])
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
    gridApi.value.refreshCells({ force: true })
  }
}, { deep: true })

// Clear cell selection when rowData changes (page change, etc.)
watch(() => props.rowData, () => {
  cellSelectionStart.value = null
  cellSelectionEnd.value = null
}, { deep: false })

// Watch cell selection changes and force redraw
watch([cellSelectionStart, cellSelectionEnd], () => {
  if (gridApi.value) {
    // 편집 중인 셀이 있으면 redraw 하지 않음 (편집 모드 취소 방지)
    const editingCells = gridApi.value.getEditingCells()
    if (editingCells && editingCells.length > 0) {
      return
    }
    setTimeout(() => {
      gridApi.value?.redrawRows()
    }, 0)
  }
})

// Expose methods for parent component
defineExpose({
  getSelectedRows: () => gridApi.value?.getSelectedRows() || [],
  clearSelection: () => {
    gridApi.value?.deselectAll()
    cellSelectionStart.value = null
    cellSelectionEnd.value = null
  },
  refreshCells: () => gridApi.value?.refreshCells({ force: true }),
  clearCellSelection: () => {
    cellSelectionStart.value = null
    cellSelectionEnd.value = null
    gridApi.value?.refreshCells({ force: true })
  },
})
</script>

<style>
@import '../../../shared/styles/ag-grid-scroll.css';
</style>

