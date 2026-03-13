/**
 * getOperationMode() — tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getOperationMode } from './service.js'

describe('getOperationMode', () => {
  let originalMode

  beforeEach(() => {
    originalMode = process.env.OPERATION_MODE
  })

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.OPERATION_MODE
    } else {
      process.env.OPERATION_MODE = originalMode
    }
  })

  it('환경변수 없음 → standalone (기본값)', () => {
    delete process.env.OPERATION_MODE
    expect(getOperationMode()).toBe('standalone')
  })

  it('OPERATION_MODE=standalone → standalone', () => {
    process.env.OPERATION_MODE = 'standalone'
    expect(getOperationMode()).toBe('standalone')
  })

  it('OPERATION_MODE=integrated → integrated', () => {
    process.env.OPERATION_MODE = 'integrated'
    expect(getOperationMode()).toBe('integrated')
  })

  it('잘못된 값 → standalone (fallback)', () => {
    process.env.OPERATION_MODE = 'invalid_mode'
    expect(getOperationMode()).toBe('standalone')
  })

  it('빈 문자열 → standalone (fallback)', () => {
    process.env.OPERATION_MODE = ''
    expect(getOperationMode()).toBe('standalone')
  })
})
