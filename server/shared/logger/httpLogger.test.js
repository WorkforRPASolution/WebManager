import { describe, it, expect, vi } from 'vitest'

describe('httpLogger middleware', () => {
  it('exports a middleware function', async () => {
    const { httpLogger } = await import('./httpLogger.js')
    expect(typeof httpLogger).toBe('function')
  })

  it('calls next() to pass through', async () => {
    const { httpLogger } = await import('./httpLogger.js')

    const req = {
      method: 'GET',
      originalUrl: '/api/health',
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-agent')
    }

    const res = {
      statusCode: 200,
      get: vi.fn().mockReturnValue('123'),
      on: vi.fn()
    }

    const next = vi.fn()

    httpLogger(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('logs on response finish event', async () => {
    const { httpLogger } = await import('./httpLogger.js')

    let finishCallback
    const req = {
      method: 'GET',
      originalUrl: '/api/clients',
      ip: '::1',
      get: vi.fn().mockReturnValue('Mozilla/5.0')
    }

    const res = {
      statusCode: 200,
      get: vi.fn().mockReturnValue('456'),
      on: vi.fn((event, cb) => {
        if (event === 'finish') finishCallback = cb
      })
    }

    const next = vi.fn()

    httpLogger(req, res, next)
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function))

    // Trigger finish — should not throw
    expect(() => finishCallback()).not.toThrow()
  })

  it('skips health check endpoint', async () => {
    const { httpLogger } = await import('./httpLogger.js')

    const req = {
      method: 'GET',
      originalUrl: '/api/health',
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('')
    }

    const res = {
      statusCode: 200,
      get: vi.fn().mockReturnValue('0'),
      on: vi.fn()
    }

    const next = vi.fn()

    httpLogger(req, res, next)
    // health check should not register a finish listener
    expect(res.on).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
  })
})
