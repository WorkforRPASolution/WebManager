import { ref, watch } from 'vue'

/**
 * AG Grid 셀 범위 선택 및 일괄 편집 공통 Composable
 *
 * 기능:
 * - Shift+클릭으로 셀 범위 선택
 * - 더블클릭으로 편집 시 선택 범위 유지
 * - 일괄 편집 (선택된 모든 셀에 같은 값 적용)
 * - 키보드 입력으로 편집 시작 (Excel 스타일)
 * - Delete/Backspace로 선택 셀 비우기
 * - ESC로 선택 해제
 * - Shift+헤더 클릭으로 열 전체 선택
 */
export function useDataGridCellSelection(options) {
  const {
    gridApi,           // ref<GridApi>
    gridContainer,     // ref<HTMLElement>
    editableColumns,   // string[] - 편집 가능한 컬럼 목록
    onBulkEdit,        // (cellUpdates: Array<{rowId, field, value}>) => void
    onCellEdit,        // (rowId, field, value) => void - 단일 셀 편집
    onPasteCells,      // (cellUpdates: Array<{rowId, field, value, rowData}>) => void - 붙여넣기 셀 업데이트
    getRowId = (data) => data._id || data._tempId,  // rowId 추출 함수 (기본: _id || _tempId)
    valueTransformer,  // (field, value) => transformedValue - 값 변환 함수 (숫자 필드 등)
  } = options

  // === State ===
  const cellSelectionStart = ref(null)  // { rowIndex, colId }
  const cellSelectionEnd = ref(null)    // { rowIndex, colId }
  const pendingBulkEditRange = ref(null)
  const bulkEditMode = ref(false)

  // 더블클릭 감지용 상태
  let lastClickTime = 0
  let lastClickCell = null
  const DOUBLE_CLICK_THRESHOLD = 300 // ms

  // Shift+헤더 클릭 시 정렬 복원을 위한 상태
  let shiftHeaderClickPending = false
  let savedSortState = null

  // === Helpers ===

  /**
   * 클릭한 셀이 현재 선택 범위 안에 있는지 확인
   */
  const isInsideSelection = (rowIndex, colId) => {
    if (!cellSelectionStart.value || !cellSelectionEnd.value) return false

    const startRow = Math.min(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
    const endRow = Math.max(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
    const startColIdx = editableColumns.indexOf(cellSelectionStart.value.colId)
    const endColIdx = editableColumns.indexOf(cellSelectionEnd.value.colId)
    const minCol = Math.min(startColIdx, endColIdx)
    const maxCol = Math.max(startColIdx, endColIdx)
    const clickedColIdx = editableColumns.indexOf(colId)

    return rowIndex >= startRow && rowIndex <= endRow &&
           clickedColIdx >= minCol && clickedColIdx <= maxCol
  }

  /**
   * 셀이 선택 범위 안에 있는지 확인 (스타일링용)
   */
  const isInSelectionRange = (rowIndex, colId) => {
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

  /**
   * 셀 범위 선택 스타일 반환
   */
  const getCellSelectionStyle = (rowIndex, colId) => {
    if (isInSelectionRange(rowIndex, colId)) {
      return {
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
        borderColor: '#3b82f6',
      }
    }
    return null
  }

  /**
   * 선택 해제
   */
  const clearSelection = () => {
    cellSelectionStart.value = null
    cellSelectionEnd.value = null
    pendingBulkEditRange.value = null
  }

  /**
   * 선택된 셀들 비우기 (Delete/Backspace)
   */
  const clearSelectedCells = () => {
    if (!cellSelectionStart.value || !cellSelectionEnd.value) return
    if (!gridApi.value) return

    const startRow = Math.min(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
    const endRow = Math.max(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
    const startColIdx = editableColumns.indexOf(cellSelectionStart.value.colId)
    const endColIdx = editableColumns.indexOf(cellSelectionEnd.value.colId)
    const minCol = Math.min(startColIdx, endColIdx)
    const maxCol = Math.max(startColIdx, endColIdx)

    for (let rowIdx = startRow; rowIdx <= endRow; rowIdx++) {
      const rowNode = gridApi.value.getDisplayedRowAtIndex(rowIdx)
      if (!rowNode) continue
      const rowId = getRowId(rowNode.data)

      for (let colIdx = minCol; colIdx <= maxCol; colIdx++) {
        const colId = editableColumns[colIdx]
        onCellEdit?.(rowId, colId, '')
      }
    }

    gridApi.value.refreshCells({ force: true })
  }

  // === Event Handlers ===

  /**
   * 셀 클릭 핸들러 - AG Grid @cell-clicked에 연결
   */
  const handleCellClicked = (params) => {
    const colId = params.colDef.field
    const rowIndex = params.rowIndex

    // 체크박스 컬럼 클릭 시 셀 범위 선택 초기화
    if (colId === '_selection') {
      cellSelectionStart.value = null
      cellSelectionEnd.value = null
      return
    }

    // 선택 범위 내부 클릭 → 선택 유지 (더블클릭으로 편집 진입 허용)
    if (isInsideSelection(rowIndex, colId)) {
      return
    }

    // 일반 셀 클릭 - 셀 범위 선택 처리
    if (params.event.shiftKey && cellSelectionStart.value) {
      // Shift+클릭: 셀 범위 선택
      cellSelectionEnd.value = { rowIndex, colId }
    } else {
      // 일반 클릭: 단일 셀 선택 (start와 end 모두 같은 셀로 설정 - 복사 지원)
      cellSelectionStart.value = { rowIndex, colId }
      cellSelectionEnd.value = { rowIndex, colId }
    }
  }

  /**
   * 편집 시작 핸들러 - AG Grid @cell-editing-started에 연결
   */
  const handleCellEditingStarted = (params) => {
    // 키보드 입력으로 시작된 일괄 편집은 handleKeyDown에서 이미 pendingBulkEditRange를 설정함
    // 덮어쓰지 않고 바로 리턴
    if (bulkEditMode.value) {
      return
    }

    // 마우스 더블클릭으로 시작된 편집: 셀 범위 선택 상태면 일괄 편집 모드 활성화
    if (cellSelectionStart.value && cellSelectionEnd.value) {
      pendingBulkEditRange.value = {
        start: { ...cellSelectionStart.value },
        end: { ...cellSelectionEnd.value }
      }
      // 마우스 일괄 편집 모드 활성화
      bulkEditMode.value = true
    } else {
      pendingBulkEditRange.value = null
    }
  }

  /**
   * 편집 완료 핸들러 - AG Grid @cell-editing-stopped에 연결
   */
  const handleCellEditingStopped = (params) => {
    // 일괄 편집 모드가 아니면 무시
    if (!bulkEditMode.value) return
    bulkEditMode.value = false

    // ESC로 취소된 경우 (valueChanged가 false)
    if (!params.valueChanged) {
      pendingBulkEditRange.value = null
      cellSelectionStart.value = null
      cellSelectionEnd.value = null
      gridApi.value?.refreshCells({ force: true })
      return
    }

    // 저장된 선택 범위 사용 (rowData 변경으로 cellSelectionStart/End가 초기화될 수 있음)
    const range = pendingBulkEditRange.value
    if (!range) {
      return
    }

    const newValue = params.newValue

    // 선택된 범위의 모든 셀에 값 적용 (편집한 셀 제외)
    const startRow = Math.min(range.start.rowIndex, range.end.rowIndex)
    const endRow = Math.max(range.start.rowIndex, range.end.rowIndex)
    const startColIdx = editableColumns.indexOf(range.start.colId)
    const endColIdx = editableColumns.indexOf(range.end.colId)
    const minCol = Math.min(startColIdx, endColIdx)
    const maxCol = Math.max(startColIdx, endColIdx)

    const cellUpdates = []
    for (let rowIdx = startRow; rowIdx <= endRow; rowIdx++) {
      const rowNode = gridApi.value?.getDisplayedRowAtIndex(rowIdx)
      if (!rowNode) continue
      const rowId = getRowId(rowNode.data)

      for (let colIdx = minCol; colIdx <= maxCol; colIdx++) {
        const colId = editableColumns[colIdx]
        // 편집한 셀은 이미 업데이트됨
        if (rowIdx === params.rowIndex && colId === params.column.colId) continue
        cellUpdates.push({ rowId, field: colId, value: newValue })
      }
    }

    if (cellUpdates.length > 0) {
      onBulkEdit?.(cellUpdates)
    }

    // 선택 해제
    pendingBulkEditRange.value = null
    cellSelectionStart.value = null
    cellSelectionEnd.value = null
    gridApi.value?.refreshCells({ force: true })
  }

  /**
   * 키보드 입력 핸들러 - gridContainer @keydown.capture에 연결
   */
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

        // 키보드 입력의 경우, pendingBulkEditRange를 먼저 저장
        // (handleCellEditingStarted에서 bulkEditMode가 true면 null로 설정하기 때문)
        pendingBulkEditRange.value = {
          start: { ...cellSelectionStart.value },
          end: { ...cellSelectionEnd.value }
        }

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
            editorInput.focus()
            editorInput.setSelectionRange(editorInput.value.length, editorInput.value.length)
          }
        }, 0)
      }
    }
  }

  /**
   * 정렬 변경 핸들러 - AG Grid @sort-changed에 연결
   */
  const handleSortChanged = () => {
    if (shiftHeaderClickPending && savedSortState) {
      shiftHeaderClickPending = false
      gridApi.value?.applyColumnState({ state: savedSortState, applyOrder: true })
      savedSortState = null
    }
  }

  /**
   * Shift+헤더 클릭 핸들러 설정 - onMounted에서 호출
   */
  const setupHeaderClickHandler = () => {
    gridContainer.value?.addEventListener('mousedown', (e) => {
      if (!e.shiftKey) return

      // 헤더 셀인지 확인
      const headerCell = e.target.closest('.ag-header-cell')
      if (!headerCell) return

      // colId 추출
      const colId = headerCell.getAttribute('col-id')
      if (!colId || !editableColumns.includes(colId)) return

      // 현재 정렬 상태 저장
      savedSortState = gridApi.value?.getColumnState()
      shiftHeaderClickPending = true

      // 열 전체 선택
      const rowCount = gridApi.value?.getDisplayedRowCount() || 0
      if (rowCount > 0) {
        cellSelectionStart.value = { rowIndex: 0, colId }
        cellSelectionEnd.value = { rowIndex: rowCount - 1, colId }
      }

      // 그리드 컨테이너로 포커스 이동
      gridContainer.value?.focus()
    }, true)
  }

  /**
   * rowData 변경 시 선택 해제 watcher 설정
   */
  const setupRowDataWatcher = (rowDataRef) => {
    watch(rowDataRef, () => {
      cellSelectionStart.value = null
      cellSelectionEnd.value = null
    }, { deep: false })
  }

  /**
   * 선택 범위 변경 시 그리드 갱신 watcher 설정
   */
  const setupSelectionWatcher = () => {
    watch([cellSelectionStart, cellSelectionEnd], () => {
      if (gridApi.value) {
        const editingCells = gridApi.value.getEditingCells()
        if (editingCells && editingCells.length > 0) {
          return
        }
        setTimeout(() => {
          gridApi.value?.redrawRows()
        }, 0)
      }
    })
  }

  /**
   * 선택 범위 정보 계산 헬퍼
   */
  const getSelectionRange = () => {
    if (!cellSelectionStart.value || !cellSelectionEnd.value) return null

    const startRowIndex = Math.min(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
    const endRowIndex = Math.max(cellSelectionStart.value.rowIndex, cellSelectionEnd.value.rowIndex)
    const startColIndex = editableColumns.indexOf(cellSelectionStart.value.colId)
    const endColIndex = editableColumns.indexOf(cellSelectionEnd.value.colId)

    if (startColIndex === -1 || endColIndex === -1) return null

    const minColIndex = Math.min(startColIndex, endColIndex)
    const maxColIndex = Math.max(startColIndex, endColIndex)

    return { startRowIndex, endRowIndex, minColIndex, maxColIndex }
  }

  /**
   * 복사 핸들러 - gridContainer @copy에 연결
   */
  const handleCopy = (event) => {
    if (!gridApi.value) return
    if (!cellSelectionStart.value || !cellSelectionEnd.value) return

    const range = getSelectionRange()
    if (!range) return

    const { startRowIndex, endRowIndex, minColIndex, maxColIndex } = range

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

    if (rows.length > 0) {
      event.preventDefault()
      event.clipboardData.setData('text/plain', rows.join('\n'))
    }
  }

  /**
   * 붙여넣기 핸들러 - gridContainer @paste에 연결
   *
   * 다중 셀 선택 시 단일 값을 모든 셀에 채움 (Excel 스타일)
   * @returns {boolean} 붙여넣기 처리 여부 (false면 그리드에서 추가 처리 가능)
   */
  const handlePaste = (event) => {
    if (!gridApi.value) return false

    const clipboardData = event.clipboardData || window.clipboardData
    if (!clipboardData) return false

    const pastedText = clipboardData.getData('text')
    if (!pastedText) return false

    // 시작 위치 결정: 포커스된 셀 또는 선택 시작점
    const focusedCell = gridApi.value.getFocusedCell()
    let startRowIndex, startColId

    if (focusedCell) {
      startRowIndex = focusedCell.rowIndex
      startColId = focusedCell.column.colId
    } else if (cellSelectionStart.value) {
      startRowIndex = cellSelectionStart.value.rowIndex
      startColId = cellSelectionStart.value.colId
    } else {
      return false // 선택된 셀 없음 - 그리드에서 추가 처리 가능
    }

    const startColIndex = editableColumns.indexOf(startColId)
    if (startColIndex === -1) return false // 편집 불가능한 컬럼

    event.preventDefault()

    // 클립보드 데이터 파싱
    const hasTab = pastedText.includes('\t')
    const hasNewline = pastedText.includes('\n')
    let dataRows

    if (hasTab) {
      // 스프레드시트 형식: 탭으로 열 구분, 줄바꿈으로 행 구분
      dataRows = pastedText.split('\n').filter(row => row.trim()).map(row => row.split('\t'))
    } else if (hasNewline) {
      // 세로 복사 형식: 줄바꿈으로 행 구분
      dataRows = pastedText.split('\n').filter(row => row.trim()).map(row => [row])
    } else {
      // 단일 셀 값
      dataRows = [[pastedText.trim()]]
    }

    // 단일 값이고 다중 셀이 선택된 경우 → 모든 선택된 셀에 채우기
    const isSingleValue = dataRows.length === 1 && dataRows[0].length === 1
    const selectionRange = getSelectionRange()
    const hasMultiCellSelection = selectionRange && (
      selectionRange.startRowIndex !== selectionRange.endRowIndex ||
      selectionRange.minColIndex !== selectionRange.maxColIndex
    )

    const cellUpdates = []

    if (isSingleValue && hasMultiCellSelection) {
      // 단일 값을 선택된 모든 셀에 채우기 (Excel 스타일)
      const singleValue = dataRows[0][0]
      const { startRowIndex: selStartRow, endRowIndex: selEndRow, minColIndex, maxColIndex } = selectionRange

      for (let rowIdx = selStartRow; rowIdx <= selEndRow; rowIdx++) {
        const rowNode = gridApi.value.getDisplayedRowAtIndex(rowIdx)
        if (!rowNode) continue

        const rowId = getRowId(rowNode.data)

        for (let colIdx = minColIndex; colIdx <= maxColIndex; colIdx++) {
          const field = editableColumns[colIdx]
          let value = singleValue

          // 값 변환 (숫자 필드 등)
          if (valueTransformer) {
            value = valueTransformer(field, value)
          }

          cellUpdates.push({ rowId, field, value, rowData: rowNode.data })
        }
      }
    } else {
      // 기존 동작: 클립보드 데이터 크기대로 붙여넣기
      for (let rowOffset = 0; rowOffset < dataRows.length; rowOffset++) {
        const cells = dataRows[rowOffset]
        const targetRowIndex = startRowIndex + rowOffset
        const rowNode = gridApi.value.getDisplayedRowAtIndex(targetRowIndex)

        if (!rowNode) continue

        const rowId = getRowId(rowNode.data)

        for (let colOffset = 0; colOffset < cells.length; colOffset++) {
          const targetColIndex = startColIndex + colOffset
          if (targetColIndex >= editableColumns.length) break

          const field = editableColumns[targetColIndex]
          let value = cells[colOffset]?.trim() || ''

          // 값 변환 (숫자 필드 등)
          if (valueTransformer) {
            value = valueTransformer(field, value)
          }

          cellUpdates.push({ rowId, field, value, rowData: rowNode.data })
        }
      }
    }

    // 셀 업데이트 콜백 호출
    if (cellUpdates.length > 0) {
      if (onPasteCells) {
        onPasteCells(cellUpdates)
      }
      gridApi.value.refreshCells({ force: true })
      return true
    }

    return false
  }

  return {
    // State
    cellSelectionStart,
    cellSelectionEnd,
    pendingBulkEditRange,
    bulkEditMode,

    // Event handlers
    handleCellClicked,
    handleCellEditingStarted,
    handleCellEditingStopped,
    handleKeyDown,
    handleSortChanged,
    handleCopy,
    handlePaste,

    // Helpers
    clearSelectedCells,
    clearSelection,
    getCellSelectionStyle,
    isInSelectionRange,
    getSelectionRange,

    // Lifecycle
    setupHeaderClickHandler,
    setupRowDataWatcher,
    setupSelectionWatcher,
  }
}
