import { describe, it, expect } from 'vitest'
import { useResizableModal } from '../useResizableModal.js'
import { ref } from 'vue'

// Note: onMounted/onUnmounted won't fire outside a Vue component setup,
// so we test the return shape and initial values only
describe('useResizableModal', () => {
  it('returns expected API shape', () => {
    const modalRef = ref(null)
    const result = useResizableModal(modalRef, { defaultWidth: 800, defaultHeight: 600 })

    expect(result.startDrag).toBeTypeOf('function')
    expect(result.startResize).toBeTypeOf('function')
    expect(result.toggleMaximize).toBeTypeOf('function')
    expect(result.modalPos).toBeDefined()
    expect(result.customWidth.value).toBe(800)
    expect(result.customHeight.value).toBe(600)
    expect(result.isMaximized.value).toBe(false)
  })

  it('respects custom default dimensions', () => {
    const modalRef = ref(null)
    const result = useResizableModal(modalRef, { defaultWidth: 1200, defaultHeight: 900 })
    expect(result.customWidth.value).toBe(1200)
    expect(result.customHeight.value).toBe(900)
  })
})
