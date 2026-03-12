/**
 * emailNotificationService — tests (TDD)
 *
 * Uses _setDeps() dependency injection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendEmailTo, _setDeps } from './emailNotificationService.js'

const mockPublish = vi.fn()
const mockIsRedisAvailable = vi.fn()

_setDeps({
  getRedisClient: () => ({ publish: mockPublish }),
  isRedisAvailable: mockIsRedisAvailable
})

beforeEach(() => {
  vi.clearAllMocks()
  mockIsRedisAvailable.mockReturnValue(true)
})

describe('sendEmailTo', () => {
  it('Redis publish 성공 (subscribers > 0) → { sent: true, subscribers }', async () => {
    mockPublish.mockResolvedValue(1)
    const result = await sendEmailTo('user@test.com', 'Title', 'Body')
    expect(result).toEqual({ sent: true, subscribers: 1 })
  })

  it('Redis publish 성공 (subscribers === 0) → { sent: false, subscribers: 0 }', async () => {
    mockPublish.mockResolvedValue(0)
    const result = await sendEmailTo('user@test.com', 'Title', 'Body')
    expect(result).toEqual({ sent: false, subscribers: 0 })
  })

  it('Redis 미연결 → { sent: false, error }', async () => {
    mockIsRedisAvailable.mockReturnValue(false)
    const result = await sendEmailTo('user@test.com', 'Title', 'Body')
    expect(result.sent).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('Redis publish 예외 → { sent: false, error }', async () => {
    mockPublish.mockRejectedValue(new Error('Redis connection lost'))
    const result = await sendEmailTo('user@test.com', 'Title', 'Body')
    expect(result.sent).toBe(false)
    expect(result.error).toBe('Redis connection lost')
  })

  it('to가 빈 문자열 → { sent: false, error: "No recipient email" }', async () => {
    const result = await sendEmailTo('', 'Title', 'Body')
    expect(result).toEqual({ sent: false, error: 'No recipient email' })
  })

  it('to가 null → { sent: false, error: "No recipient email" }', async () => {
    const result = await sendEmailTo(null, 'Title', 'Body')
    expect(result).toEqual({ sent: false, error: 'No recipient email' })
  })

  it('채널명 포맷: SendEmailTo-<email>', async () => {
    mockPublish.mockResolvedValue(1)
    await sendEmailTo('user@test.com', 'Title', 'Body')
    expect(mockPublish).toHaveBeenCalledWith(
      'SendEmailTo-user@test.com',
      expect.any(String)
    )
  })

  it('메시지 포맷: title:contents', async () => {
    mockPublish.mockResolvedValue(1)
    await sendEmailTo('user@test.com', 'MyTitle', 'MyBody')
    expect(mockPublish).toHaveBeenCalledWith(
      expect.any(String),
      'MyTitle:MyBody'
    )
  })
})
