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
      style="width: 100%; height: 100%;"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community'
import { useTheme } from '../../../shared/composables/useTheme'

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
  }
})

const emit = defineEmits(['cell-edit', 'selection-change', 'paste-rows', 'paste-cells', 'approve-user', 'approve-reset'])

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

const editableColumns = [
  'name', 'singleid', 'password', 'line', 'process',
  'authority', 'authorityManager', 'note', 'email', 'department', 'accountStatus'
]

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
  { field: 'process', headerName: 'Process', width: 120, editable: true },
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
}

// 편집 시작 시 선택 범위 저장 (마우스 더블클릭 시에만)
const onCellEditingStarted = (params) => {
  // 키보드 입력으로 시작된 일괄 편집은 pendingBulkEditRange를 설정하지 않음
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
  let newValue = params.newValue

  // Convert to number for authorityManager
  if (field === 'authorityManager') {
    newValue = Number(newValue)
  }

  // 키보드 입력으로 시작된 일괄 편집 중에는 단일 셀만 업데이트
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

// Shift+클릭으로 체크박스 범위 선택 및 셀 범위 선택
const onCellClicked = (params) => {
  const colId = params.colDef.field
  const rowIndex = params.rowIndex

  // 체크박스 컬럼 클릭 처리
  if (colId === '_selection') {
    if (params.event.shiftKey && lastSelectedRowIndex.value !== null) {
      // Shift+클릭: 행 범위 선택
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
    // Shift+클릭: 셀 범위 선택
    cellSelectionEnd.value = { rowIndex, colId }
  } else {
    // 일반 클릭: 새로운 셀 범위 시작점 (기존 선택 해제)
    cellSelectionStart.value = { rowIndex, colId }
    cellSelectionEnd.value = null
  }
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
  if (bulkEditMode.value) {
    return
  }

  // ESC: 선택 해제
  if (event.key === 'Escape') {
    cellSelectionStart.value = null
    cellSelectionEnd.value = null
    gridApi.value?.clearFocusedCell()
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

  let newValue = params.newValue

  // Type conversion for specific fields
  if (params.column.colId === 'authorityManager') {
    newValue = Number(newValue)
  }

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
        const colId = focusedCell.column.colId
        if (colId === 'password') {
          copyData = ''
        } else {
          const value = rowNode.data[colId]
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

const handlePaste = (event) => {
  const clipboardData = event.clipboardData || window.clipboardData
  if (!clipboardData) return

  const pastedText = clipboardData.getData('text')
  if (!pastedText) return

  event.preventDefault()

  const focusedCell = gridApi.value?.getFocusedCell()

  if (focusedCell) {
    const startRowIndex = focusedCell.rowIndex
    const startColId = focusedCell.column.colId
    const startColIndex = editableColumns.indexOf(startColId)

    if (startColIndex === -1) return

    const hasTab = pastedText.includes('\t')
    let dataRows = hasTab
      ? pastedText.split('\n').filter(row => row.trim()).map(row => row.split('\t'))
      : pastedText.split('\n').filter(row => row.trim()).map(row => [row])

    const cellUpdates = []

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
        if (field === 'password') continue // Skip password paste

        let value = cells[colOffset]?.trim() || ''

        if (field === 'authorityManager') {
          value = parseInt(value) || 2
        } else if (field === 'accountStatus') {
          const lower = value.toLowerCase()
          if (['pending', 'active', 'suspended'].includes(lower)) {
            value = lower
          } else {
            value = 'active' // default
          }
        }

        cellUpdates.push({ rowId, field, value })
      }
    }

    if (cellUpdates.length > 0) {
      emit('paste-cells', cellUpdates)
    }
  } else {
    // Paste as new rows
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
        if (field === 'password') continue

        let value = cells[i]?.trim() || ''
        if (field === 'authorityManager') {
          value = parseInt(value) || 2
        } else if (field === 'accountStatus') {
          const lower = value.toLowerCase()
          if (['pending', 'active', 'suspended'].includes(lower)) {
            value = lower
          } else {
            value = 'active' // default
          }
        }
        rowData[field] = value
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

watch(() => props.validationErrors, () => {
  if (gridApi.value) {
    gridApi.value.refreshCells({ force: true })
  }
}, { deep: true })

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
/* 수평 스크롤바 강제 표시 */
.ag-body-horizontal-scroll-viewport {
  overflow-x: scroll !important;
  scrollbar-width: thin !important;
  scrollbar-color: rgba(100, 100, 100, 0.5) rgba(0, 0, 0, 0.1) !important;
}

.ag-body-horizontal-scroll-viewport::-webkit-scrollbar {
  -webkit-appearance: none !important;
  height: 12px !important;
  display: block !important;
}

.ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
  border-radius: 6px !important;
  background-color: rgba(100, 100, 100, 0.5) !important;
  border: 2px solid transparent !important;
  background-clip: content-box !important;
}

.ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb:hover {
  background-color: rgba(100, 100, 100, 0.7) !important;
}

.ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track {
  background-color: rgba(0, 0, 0, 0.1) !important;
  border-radius: 6px !important;
}

/* 스크롤 영역 강제 표시 */
.ag-body-horizontal-scroll {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  min-height: 14px !important;
  height: 14px !important;
}

/* AG Grid 내부 overflow 설정 오버라이드 */
.ag-root,
.ag-root-wrapper {
  overflow: visible !important;
}

.ag-cell.cell-value-changed,
.ag-cell.cell-value-changed .ag-cell-value,
.ag-cell.cell-value-changed .ag-cell-wrapper,
.ag-cell.cell-value-changed * {
  color: #dc2626 !important;
  font-weight: 600 !important;
}
</style>
