/**
 * earsService — tests (TDD)
 *
 * EARS InterfaceServer HTTP client.
 * Uses _setDeps() dependency injection for fetch mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchUsers, _setDeps } from './earsService.js'

const mockFetch = vi.fn()
_setDeps({ fetch: mockFetch })

const EARS_URL = 'http://ears-server:9000'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.EARS_INTERFACE_URL = EARS_URL
})

afterEach(() => {
  delete process.env.EARS_INTERFACE_URL
})

describe('searchUsers', () => {
  it('EARS_INTERFACE_URL 미설정 시 에러 반환', async () => {
    delete process.env.EARS_INTERFACE_URL

    const result = await searchUsers('홍길동')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/EARS_INTERFACE_URL/)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('빈 name → 에러 반환', async () => {
    const result = await searchUsers('')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/name/)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('정상 검색 → 응답 필드 매핑 (employee 배열)', async () => {
    const earsResponse = {
      success: 'true',
      message: '',
      employee: [
        { Cn: '홍길동', Employeenumber: 'E001', Department: '개발팀', Mail: 'hong@test.com' },
        { Cn: '김철수', Employeenumber: 'E002', Department: '운영팀', Mail: 'kim@test.com' }
      ]
    }
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(earsResponse)
    })

    const result = await searchUsers('홍')

    expect(result.success).toBe(true)
    expect(result.data).toEqual([
      { cn: '홍길동', employeeNumber: 'E001', department: '개발팀', mail: 'hong@test.com' },
      { cn: '김철수', employeeNumber: 'E002', department: '운영팀', mail: 'kim@test.com' }
    ])

    // fetch 호출 검증
    expect(mockFetch).toHaveBeenCalledWith(
      `${EARS_URL}/EARS/Interface`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'category': 'sso',
          'function': 'getusers'
        },
        body: JSON.stringify({ Name: '홍' }),
        signal: expect.any(AbortSignal)
      })
    )
  })

  it('빈 결과 → 빈 배열', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([])
    })

    const result = await searchUsers('존재하지않는이름')

    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })

  it('네트워크 에러 → 에러 반환', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

    const result = await searchUsers('홍길동')

    expect(result.success).toBe(false)
    expect(result.error).toBe('ECONNREFUSED')
  })

  it('응답 실패 (non-ok) → 에러 반환', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    const result = await searchUsers('홍길동')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/500/)
  })
})
