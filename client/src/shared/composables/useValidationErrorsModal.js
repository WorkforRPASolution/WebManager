import { ref, computed } from 'vue'

export function useValidationErrorsModal(validationErrors) {
  const serverErrors = ref({})
  const showValidationErrorsModal = ref(false)

  const combinedErrors = computed(() => ({
    ...validationErrors.value,
    ...serverErrors.value
  }))

  const validationErrorCount = computed(() =>
    Object.keys(combinedErrors.value).length
  )

  function mapServerErrors(resultErrors) {
    const errorMap = {}
    for (const err of resultErrors) {
      const key = `server_row_${err.rowIndex}`
      if (!errorMap[key]) errorMap[key] = {}
      errorMap[key][err.field] = err.message
    }
    serverErrors.value = errorMap
  }

  function resetServerErrors() {
    serverErrors.value = {}
  }

  return {
    serverErrors,
    showValidationErrorsModal,
    combinedErrors,
    validationErrorCount,
    mapServerErrors,
    resetServerErrors
  }
}
