import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('logger', () => {
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('exports a winston logger instance with expected methods', async () => {
    const { logger } = await import('./index.js')

    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.http).toBe('function')
  })

  it('exports createLogger factory', async () => {
    const { createLogger } = await import('./index.js')
    expect(typeof createLogger).toBe('function')
  })

  it('createLogger returns a child logger with category', async () => {
    const { createLogger } = await import('./index.js')
    const childLogger = createLogger('auth')

    expect(typeof childLogger.info).toBe('function')
    expect(typeof childLogger.error).toBe('function')
  })

  describe('formatLogLine', () => {
    it('produces text format: [timestamp] [LEVEL]  [category] message', async () => {
      const { formatLogLine } = await import('./index.js')

      const line = formatLogLine({
        level: 'info',
        message: 'User logged in',
        category: 'auth',
        timestamp: '2026-03-19 14:30:00.123'
      })

      expect(line).toBe('[2026-03-19 14:30:00.123] [INFO]  [auth         ] User logged in')
    })

    it('pads level to 5 chars for alignment', async () => {
      const { formatLogLine } = await import('./index.js')
      const ts = '2026-01-01 00:00:00.000'

      expect(formatLogLine({ level: 'info', message: 'test', category: 'db', timestamp: ts }))
        .toBe(`[${ts}] [INFO]  [db           ] test`)

      expect(formatLogLine({ level: 'warn', message: 'test', category: 'db', timestamp: ts }))
        .toBe(`[${ts}] [WARN]  [db           ] test`)

      expect(formatLogLine({ level: 'error', message: 'test', category: 'db', timestamp: ts }))
        .toBe(`[${ts}] [ERROR] [db           ] test`)

      expect(formatLogLine({ level: 'debug', message: 'test', category: 'db', timestamp: ts }))
        .toBe(`[${ts}] [DEBUG] [db           ] test`)

      expect(formatLogLine({ level: 'http', message: 'test', category: 'http', timestamp: ts }))
        .toBe(`[${ts}] [HTTP]  [http         ] test`)
    })

    it('uses "general" as default category', async () => {
      const { formatLogLine } = await import('./index.js')

      const line = formatLogLine({ level: 'info', message: 'no category', timestamp: '2026-01-01 00:00:00.000' })
      expect(line).toBe('[2026-01-01 00:00:00.000] [INFO]  [general      ] no category')
    })
  })

  describe('environment variable defaults', () => {
    it('defaults LOG_LEVEL to info', async () => {
      delete process.env.LOG_LEVEL
      const { logger } = await import('./index.js')
      expect(logger.level).toBe('info')
    })

    it('respects LOG_LEVEL override', async () => {
      process.env.LOG_LEVEL = 'debug'
      const { logger } = await import('./index.js')
      expect(logger.level).toBe('debug')
    })

    it('defaults LOG_DIR to logs', async () => {
      delete process.env.LOG_DIR
      const { _getLogDir } = await import('./index.js')
      const logDir = _getLogDir()
      expect(logDir).toMatch(/logs$/)
    })
  })

  describe('file transport', () => {
    it('is null in test environment', async () => {
      const { _getFileTransport } = await import('./index.js')
      expect(_getFileTransport()).toBeNull()
    })
  })
})
