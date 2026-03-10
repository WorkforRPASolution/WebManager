import { describe, it, expect } from 'vitest'
import { isFtpNotFoundError } from './ftpErrors.js'

describe('isFtpNotFoundError', () => {
  it('returns true for error with code 550', () => {
    const err = new Error('file not found')
    err.code = 550
    expect(isFtpNotFoundError(err)).toBe(true)
  })

  it('returns true for error message containing "No such file"', () => {
    const err = new Error('550 No such file or directory')
    expect(isFtpNotFoundError(err)).toBe(true)
  })

  it('returns false for other errors', () => {
    const err = new Error('Connection refused')
    err.code = 421
    expect(isFtpNotFoundError(err)).toBe(false)
  })

  it('returns false for error without code or message', () => {
    const err = new Error()
    expect(isFtpNotFoundError(err)).toBe(false)
  })

  it('handles null/undefined gracefully', () => {
    expect(isFtpNotFoundError(null)).toBe(false)
    expect(isFtpNotFoundError(undefined)).toBe(false)
  })
})
