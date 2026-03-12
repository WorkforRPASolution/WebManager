/**
 * userEmailResolver — tests (TDD)
 *
 * Uses _setDeps() dependency injection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveEmail, _setDeps } from './userEmailResolver.js'

const mockFindOne = vi.fn()

_setDeps({
  User: {
    findOne: () => ({ select: () => ({ lean: () => mockFindOne() }) })
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveEmail', () => {
  it('존재하는 사용자 (email 있음) → 이메일 반환', async () => {
    mockFindOne.mockResolvedValue({ email: 'user@test.com' })
    const result = await resolveEmail('testuser')
    expect(result).toBe('user@test.com')
  })

  it('존재하는 사용자 (email 없음) → null', async () => {
    mockFindOne.mockResolvedValue({ email: '' })
    const result = await resolveEmail('testuser')
    expect(result).toBeNull()
  })

  it('존재하는 사용자 (email 필드 자체 없음) → null', async () => {
    mockFindOne.mockResolvedValue({})
    const result = await resolveEmail('testuser')
    expect(result).toBeNull()
  })

  it('존재하지 않는 사용자 → null', async () => {
    mockFindOne.mockResolvedValue(null)
    const result = await resolveEmail('nonexistent')
    expect(result).toBeNull()
  })

  it('singleid가 null → null', async () => {
    const result = await resolveEmail(null)
    expect(result).toBeNull()
    expect(mockFindOne).not.toHaveBeenCalled()
  })

  it('singleid가 undefined → null', async () => {
    const result = await resolveEmail(undefined)
    expect(result).toBeNull()
    expect(mockFindOne).not.toHaveBeenCalled()
  })

  it('DB 예외 → null (에러 무시)', async () => {
    mockFindOne.mockRejectedValue(new Error('DB connection lost'))
    const result = await resolveEmail('testuser')
    expect(result).toBeNull()
  })
})
