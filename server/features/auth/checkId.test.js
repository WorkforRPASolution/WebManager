/**
 * checkIdAvailability — tests (TDD)
 *
 * Uses _setDeps() dependency injection (same pattern as controlService/updateService).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkIdAvailability, _setDeps } from './service.js'

const mockFindOne = vi.fn()

_setDeps({
  User: {
    findOne: () => ({ select: () => ({ lean: () => mockFindOne() }) })
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('checkIdAvailability', () => {
  it('사용 가능한 ID → { available: true }', async () => {
    mockFindOne.mockResolvedValue(null)
    const result = await checkIdAvailability('newuser')
    expect(result).toEqual({ available: true })
  })

  it('이미 존재하는 ID → { available: false, message }', async () => {
    mockFindOne.mockResolvedValue({ singleid: 'existinguser' })
    const result = await checkIdAvailability('existinguser')
    expect(result).toEqual({ available: false, message: '이미 사용 중인 ID입니다' })
  })

  it('빈 문자열 → throw', async () => {
    await expect(checkIdAvailability('')).rejects.toThrow('3자 이상')
  })

  it('3자 미만 → throw', async () => {
    await expect(checkIdAvailability('ab')).rejects.toThrow('3자 이상')
  })
})
