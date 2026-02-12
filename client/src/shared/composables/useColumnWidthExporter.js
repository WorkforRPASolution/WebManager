/**
 * AG Grid 컬럼 폭을 클립보드에 복사하는 유틸 함수
 *
 * 사용법:
 *   1. 브라우저에서 컬럼 폭을 드래그 또는 더블클릭으로 원하는 크기로 조정
 *   2. 버튼 클릭하면 클립보드에 코드 형태로 복사됨
 *   3. columnDefs의 width 값에 붙여넣기
 *
 * @param {Ref} gridApi - AG Grid API ref
 * @returns {{ exportColumnWidths: Function }}
 */
export function useColumnWidthExporter(gridApi) {
  const exportColumnWidths = () => {
    if (!gridApi.value) return

    const state = gridApi.value.getColumnState?.() || []
    const lines = state
      .filter(c => c.colId !== 'ag-Grid-SelectionColumn')
      .map(c => `// ${c.colId}: ${c.width}`)

    const text = lines.join('\n')
    navigator.clipboard.writeText(text)
    return text
  }

  return { exportColumnWidths }
}
