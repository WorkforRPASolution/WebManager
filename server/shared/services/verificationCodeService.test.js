/**
 * verificationCodeService — tests (TDD)
 *
 * Uses _setDeps() dependency injection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateCode,
  storeCode,
  verifyCode,
  checkCode,
  _setDeps
} from './verificationCodeService.js'

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  exists: vi.fn(),
}

const mockIsRedisAvailable = vi.fn()

_setDeps({
  getRedisClient: () => mockRedis,
  isRedisAvailable: mockIsRedisAvailable,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockIsRedisAvailable.mockReturnValue(true)
})

describe('generateCode', () => {
  it('6자리 숫자 문자열 반환', () => {
    const code = generateCode()
    expect(code).toMatch(/^\d{6}$/)
    expect(code.length).toBe(6)
  })
})

describe('storeCode', () => {
  it('정상 호출 → Redis SET (code EX 300 + cooldown EX 60), { code } 반환', async () => {
    mockRedis.exists.mockResolvedValue(0)
    mockRedis.set.mockResolvedValue('OK')

    const result = await storeCode('user@test.com')

    expect(result.code).toMatch(/^\d{6}$/)
    // code key: wm:vcode:<mail> EX 300
    expect(mockRedis.set).toHaveBeenCalledWith(
      'wm:vcode:user@test.com',
      result.code,
      'EX',
      300
    )
    // cooldown key: wm:vcode:cooldown:<mail> EX 60
    expect(mockRedis.set).toHaveBeenCalledWith(
      'wm:vcode:cooldown:user@test.com',
      '1',
      'EX',
      60
    )
  })

  it('쿨다운 중 (cooldown key exists) → 에러 반환', async () => {
    mockRedis.exists.mockResolvedValue(1)

    const result = await storeCode('user@test.com')

    expect(result.error).toBe('인증 코드 재발송 대기 중입니다. 잠시 후 다시 시도해주세요.')
    expect(result.code).toBeUndefined()
    // SET이 호출되지 않아야 함
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  it('Redis 미연결 → 에러 반환', async () => {
    mockIsRedisAvailable.mockReturnValue(false)

    const result = await storeCode('user@test.com')

    expect(result.error).toBeTruthy()
    expect(result.code).toBeUndefined()
  })

  it('빈 mail → 에러 반환', async () => {
    const result1 = await storeCode('')
    expect(result1.error).toBeTruthy()
    expect(result1.code).toBeUndefined()

    const result2 = await storeCode(null)
    expect(result2.error).toBeTruthy()

    const result3 = await storeCode(undefined)
    expect(result3.error).toBeTruthy()
  })
})

describe('verifyCode', () => {
  it('정확한 코드 → { success: true } + 관련 키 삭제', async () => {
    mockRedis.get.mockResolvedValue('123456')
    mockRedis.del.mockResolvedValue(1)

    const result = await verifyCode('user@test.com', '123456')

    expect(result).toEqual({ success: true })
    // 3개 키 삭제
    expect(mockRedis.del).toHaveBeenCalledWith(
      'wm:vcode:user@test.com',
      'wm:vcode:cooldown:user@test.com',
      'wm:vcode:attempts:user@test.com'
    )
  })

  it('잘못된 코드 → { success: false } + attempts 증가', async () => {
    mockRedis.get.mockResolvedValue('123456')
    mockRedis.incr.mockResolvedValue(1)
    mockRedis.expire.mockResolvedValue(1)

    const result = await verifyCode('user@test.com', '999999')

    expect(result.success).toBe(false)
    expect(result.error).toBe('인증 코드가 일치하지 않습니다.')
    expect(mockRedis.incr).toHaveBeenCalledWith('wm:vcode:attempts:user@test.com')
    expect(mockRedis.expire).toHaveBeenCalledWith('wm:vcode:attempts:user@test.com', 300)
  })

  it('5회 초과 → 코드 무효화 (관련 키 삭제) + locked 에러', async () => {
    mockRedis.get.mockResolvedValue('123456')
    mockRedis.incr.mockResolvedValue(6) // 6번째 시도 (> 5)
    mockRedis.del.mockResolvedValue(1)

    const result = await verifyCode('user@test.com', '999999')

    expect(result.success).toBe(false)
    expect(result.error).toBe('인증 시도 횟수를 초과했습니다. 새 인증 코드를 요청해주세요.')
    // code key + attempts key 삭제
    expect(mockRedis.del).toHaveBeenCalledWith(
      'wm:vcode:user@test.com',
      'wm:vcode:attempts:user@test.com'
    )
  })

  it('만료된 코드 (code key null) → { success: false, error: expired }', async () => {
    mockRedis.get.mockResolvedValue(null)

    const result = await verifyCode('user@test.com', '123456')

    expect(result.success).toBe(false)
    expect(result.error).toBe('인증 코드가 만료되었거나 존재하지 않습니다.')
  })

  it('빈 입력 → 에러 반환', async () => {
    const result1 = await verifyCode('', '123456')
    expect(result1.success).toBe(false)
    expect(result1.error).toBeTruthy()

    const result2 = await verifyCode('user@test.com', '')
    expect(result2.success).toBe(false)
    expect(result2.error).toBeTruthy()

    const result3 = await verifyCode(null, null)
    expect(result3.success).toBe(false)
    expect(result3.error).toBeTruthy()
  })
})

describe('checkCode', () => {
  it('정확한 코드 → { success: true }, 키 삭제 안 함', async () => {
    mockRedis.get.mockResolvedValue('123456')

    const result = await checkCode('user@test.com', '123456')

    expect(result).toEqual({ success: true })
    expect(mockRedis.del).not.toHaveBeenCalled()
  })

  it('잘못된 코드 → { success: false } + attempts 증가', async () => {
    mockRedis.get.mockResolvedValue('123456')
    mockRedis.incr.mockResolvedValue(1)
    mockRedis.expire.mockResolvedValue(1)

    const result = await checkCode('user@test.com', '999999')

    expect(result.success).toBe(false)
    expect(result.error).toBe('인증 코드가 일치하지 않습니다.')
    expect(mockRedis.incr).toHaveBeenCalledWith('wm:vcode:attempts:user@test.com')
  })

  it('만료된 코드 → { success: false }', async () => {
    mockRedis.get.mockResolvedValue(null)

    const result = await checkCode('user@test.com', '123456')

    expect(result.success).toBe(false)
    expect(result.error).toBe('인증 코드가 만료되었거나 존재하지 않습니다.')
  })
})
