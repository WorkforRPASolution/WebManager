import { ref, reactive, onMounted, onUnmounted } from 'vue'

/**
 * 모달 drag/resize 공용 composable
 * @param {Ref} modalRef - 모달 DOM element ref
 * @param {object} options - { defaultWidth, defaultHeight, minWidth?, minHeight? }
 */
export function useResizableModal(modalRef, { defaultWidth, defaultHeight, minWidth = 500, minHeight = 400 }) {
  const customWidth = ref(defaultWidth)
  const customHeight = ref(defaultHeight)
  const modalPos = reactive({ x: null, y: null })
  const isMaximized = ref(false)

  let isDragging = false, dragStartX = 0, dragStartY = 0, dragStartPosX = 0, dragStartPosY = 0
  let isResizing = false, resizeStartX = 0, resizeStartY = 0, resizeStartW = 0, resizeStartH = 0

  const startDrag = (e) => {
    if (isMaximized.value) return
    isDragging = true
    dragStartX = e.clientX; dragStartY = e.clientY
    const rect = modalRef.value.getBoundingClientRect()
    dragStartPosX = rect.left; dragStartPosY = rect.top
    e.preventDefault()
  }

  const doDrag = (e) => {
    if (!isDragging) return
    modalPos.x = Math.max(0, Math.min(window.innerWidth - 100, dragStartPosX + (e.clientX - dragStartX)))
    modalPos.y = Math.max(0, Math.min(window.innerHeight - 50, dragStartPosY + (e.clientY - dragStartY)))
  }

  const stopDrag = () => { isDragging = false }

  const startResize = (e) => {
    isResizing = true
    resizeStartX = e.clientX; resizeStartY = e.clientY
    const rect = modalRef.value.getBoundingClientRect()
    resizeStartW = rect.width; resizeStartH = rect.height
    modalPos.x = rect.left; modalPos.y = rect.top
    e.preventDefault()
  }

  const doResize = (e) => {
    if (!isResizing) return
    customWidth.value = Math.max(minWidth, Math.min(window.innerWidth * 0.95, resizeStartW + (e.clientX - resizeStartX)))
    customHeight.value = Math.max(minHeight, Math.min(window.innerHeight * 0.95, resizeStartH + (e.clientY - resizeStartY)))
  }

  const stopResize = () => { isResizing = false }

  const onMouseMove = (e) => { doDrag(e); doResize(e) }
  const onMouseUp = () => { stopDrag(); stopResize() }

  onMounted(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  })

  const toggleMaximize = () => { isMaximized.value = !isMaximized.value }

  return {
    customWidth, customHeight, modalPos, isMaximized,
    startDrag, startResize, toggleMaximize,
  }
}
