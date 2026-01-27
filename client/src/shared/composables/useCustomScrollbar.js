/**
 * useCustomScrollbar - AG Grid 커스텀 수평 스크롤바 Composable
 *
 * macOS에서 네이티브 스크롤바가 숨겨지는 문제를 해결하기 위해
 * JavaScript로 커스텀 스크롤바 UI를 구현합니다.
 *
 * Usage:
 * const { scrollState, updateScrollState, scrollTo } = useCustomScrollbar(gridRef)
 */

import { ref, onMounted, onUnmounted, nextTick } from 'vue'

export function useCustomScrollbar(gridContainerRef) {
  // Scroll state
  const scrollState = ref({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
    hasHorizontalScroll: false
  })

  // Internal references
  let viewportElement = null
  let resizeObserver = null
  let isUpdatingScroll = false
  let scrollHandler = null

  /**
   * AG Grid의 center-cols-viewport 요소 찾기
   */
  const findViewport = () => {
    if (!gridContainerRef.value) return null
    return gridContainerRef.value.querySelector('.ag-center-cols-viewport')
  }

  /**
   * 스크롤 상태 업데이트
   */
  const updateScrollState = () => {
    const vp = findViewport()
    if (!vp) return

    const { scrollLeft, scrollWidth, clientWidth } = vp

    scrollState.value = {
      scrollLeft,
      scrollWidth,
      clientWidth,
      hasHorizontalScroll: scrollWidth > clientWidth
    }
  }

  /**
   * 스크롤 위치 설정 (Custom Scrollbar → Grid)
   */
  const scrollTo = (newScrollLeft) => {
    const vp = findViewport()
    if (!vp || isUpdatingScroll) return

    isUpdatingScroll = true
    vp.scrollLeft = newScrollLeft

    // 상태 즉시 업데이트
    updateScrollState()

    // 약간의 딜레이 후 플래그 해제 (양방향 동기화 무한 루프 방지)
    requestAnimationFrame(() => {
      isUpdatingScroll = false
    })
  }

  /**
   * Grid 스크롤 이벤트 핸들러 (Grid → Custom Scrollbar)
   */
  const handleGridScroll = () => {
    if (isUpdatingScroll) return
    updateScrollState()
  }

  /**
   * 이벤트 리스너 설정/재설정
   */
  const setupEventListeners = () => {
    const vp = findViewport()
    if (!vp) return false

    // 기존 리스너 제거 (중복 방지)
    if (viewportElement && scrollHandler) {
      viewportElement.removeEventListener('scroll', scrollHandler)
    }

    viewportElement = vp
    scrollHandler = handleGridScroll

    // 새 리스너 추가
    viewportElement.addEventListener('scroll', scrollHandler, { passive: true })

    // ResizeObserver 설정
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
    resizeObserver = new ResizeObserver(() => {
      updateScrollState()
    })
    resizeObserver.observe(viewportElement)

    return true
  }

  /**
   * 컬럼 변경 시 스크롤 상태 업데이트
   * AG Grid의 displayed-columns-changed, column-resized 이벤트에서 호출
   */
  const handleColumnChange = () => {
    // DOM 업데이트 후 스크롤 상태 계산 및 리스너 재설정
    nextTick(() => {
      setTimeout(() => {
        setupEventListeners()
        updateScrollState()
      }, 50)
    })
  }

  /**
   * 초기화
   */
  const initialize = () => {
    if (setupEventListeners()) {
      updateScrollState()
    } else {
      // AG Grid가 아직 렌더링되지 않았으면 재시도
      setTimeout(initialize, 100)
    }
  }

  /**
   * 정리
   */
  const cleanup = () => {
    if (viewportElement && scrollHandler) {
      viewportElement.removeEventListener('scroll', scrollHandler)
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
  }

  onMounted(() => {
    // AG Grid 렌더링 후 초기화 (약간의 딜레이 필요)
    setTimeout(initialize, 200)
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    scrollState,
    updateScrollState,
    scrollTo,
    handleColumnChange,
    initialize
  }
}
