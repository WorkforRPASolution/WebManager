import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useValidationErrorsModal } from './useValidationErrorsModal'

describe('useValidationErrorsModal', () => {
  it('initial state: showModal false, serverErrors empty', () => {
    const validationErrors = ref({})
    const { showValidationErrorsModal, serverErrors } = useValidationErrorsModal(validationErrors)

    expect(showValidationErrorsModal.value).toBe(false)
    expect(serverErrors.value).toEqual({})
  })

  it('mapServerErrors converts errors array to keyed map', () => {
    const validationErrors = ref({})
    const { mapServerErrors, serverErrors } = useValidationErrorsModal(validationErrors)

    mapServerErrors([
      { rowIndex: 0, field: 'name', message: 'Name is required' },
      { rowIndex: 0, field: 'email', message: 'Invalid email' },
      { rowIndex: 2, field: 'role', message: 'Role is required' }
    ])

    expect(serverErrors.value).toEqual({
      server_row_0: {
        name: 'Name is required',
        email: 'Invalid email'
      },
      server_row_2: {
        role: 'Role is required'
      }
    })
  })

  it('combinedErrors merges validation + server errors', () => {
    const validationErrors = ref({
      row_abc: { field1: 'Client error' }
    })
    const { mapServerErrors, combinedErrors } = useValidationErrorsModal(validationErrors)

    mapServerErrors([
      { rowIndex: 1, field: 'field2', message: 'Server error' }
    ])

    expect(combinedErrors.value).toEqual({
      row_abc: { field1: 'Client error' },
      server_row_1: { field2: 'Server error' }
    })
  })

  it('validationErrorCount returns correct count', () => {
    const validationErrors = ref({
      row_1: { a: 'err' },
      row_2: { b: 'err' }
    })
    const { mapServerErrors, validationErrorCount } = useValidationErrorsModal(validationErrors)

    // 2 client errors only
    expect(validationErrorCount.value).toBe(2)

    // Add 1 server error → total 3
    mapServerErrors([
      { rowIndex: 5, field: 'x', message: 'y' }
    ])
    expect(validationErrorCount.value).toBe(3)
  })

  it('resetServerErrors clears server errors', () => {
    const validationErrors = ref({})
    const { mapServerErrors, resetServerErrors, serverErrors, combinedErrors } = useValidationErrorsModal(validationErrors)

    mapServerErrors([
      { rowIndex: 0, field: 'f', message: 'm' }
    ])
    expect(Object.keys(serverErrors.value).length).toBe(1)

    resetServerErrors()
    expect(serverErrors.value).toEqual({})
    expect(combinedErrors.value).toEqual({})
  })
})
