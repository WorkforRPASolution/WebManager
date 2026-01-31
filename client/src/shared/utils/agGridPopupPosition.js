/**
 * AG Grid Popup Position Utility
 *
 * 팝업 에디터가 화면 아래로 잘리지 않도록 위치를 자동 계산합니다.
 * 셀 위치와 뷰포트 크기를 기반으로 'under' 또는 'over'를 반환합니다.
 */

/**
 * 팝업 에디터의 최적 위치를 계산합니다.
 * @param {Object} params - AG Grid editor params
 * @param {number} estimatedPopupHeight - 팝업의 예상 높이 (기본값: 350px)
 * @returns {'under' | 'over'} - 팝업 위치
 */
export function getOptimalPopupPosition(params, estimatedPopupHeight = 350) {
  try {
    // Get the cell element
    const cellElement = params.eGridCell
    if (!cellElement) {
      return 'under'
    }

    // Get cell position relative to viewport
    const cellRect = cellElement.getBoundingClientRect()

    // Get viewport height
    const viewportHeight = window.innerHeight

    // Calculate available space below the cell
    const spaceBelow = viewportHeight - cellRect.bottom

    // Calculate available space above the cell
    const spaceAbove = cellRect.top

    // If there's not enough space below but enough space above, show above
    if (spaceBelow < estimatedPopupHeight && spaceAbove > estimatedPopupHeight) {
      return 'over'
    }

    // Default: show below
    return 'under'
  } catch (error) {
    console.warn('Failed to calculate popup position:', error)
    return 'under'
  }
}
