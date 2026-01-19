import { ref } from 'vue'

/**
 * Shared toast notification composable
 * Provides consistent toast handling across all views
 */
export function useToast() {
  const toast = ref({
    show: false,
    type: 'success',
    message: ''
  })

  let timeoutId = null

  /**
   * Show a toast notification
   * @param {string} type - 'success', 'error', 'warning', 'info'
   * @param {string} message - Message to display
   * @param {number} duration - Duration in ms (default: 3000)
   */
  const showToast = (type, message, duration = 3000) => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    toast.value = {
      show: true,
      type,
      message
    }

    timeoutId = setTimeout(() => {
      toast.value.show = false
      timeoutId = null
    }, duration)
  }

  /**
   * Hide the current toast
   */
  const hideToast = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    toast.value.show = false
  }

  /**
   * Shorthand methods
   */
  const success = (message, duration) => showToast('success', message, duration)
  const error = (message, duration) => showToast('error', message, duration)
  const warning = (message, duration) => showToast('warning', message, duration)
  const info = (message, duration) => showToast('info', message, duration)

  return {
    toast,
    showToast,
    hideToast,
    success,
    error,
    warning,
    info
  }
}
