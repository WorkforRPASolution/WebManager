import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractNewLines, tailLogStream, _setDeps } from './logService.js'

describe('extractNewLines', () => {
  it('first call (no previous) — returns all lines', () => {
    expect(extractNewLines([], ['A', 'B', 'C'])).toEqual(['A', 'B', 'C'])
  })

  it('null previous — returns all lines', () => {
    expect(extractNewLines(null, ['A', 'B'])).toEqual(['A', 'B'])
  })

  it('partial overlap — returns only new lines', () => {
    const prev = ['A', 'B', 'C', 'D', 'E']
    const curr = ['C', 'D', 'E', 'F', 'G']
    expect(extractNewLines(prev, curr)).toEqual(['F', 'G'])
  })

  it('single new line', () => {
    const prev = ['A', 'B', 'C']
    const curr = ['B', 'C', 'D']
    expect(extractNewLines(prev, curr)).toEqual(['D'])
  })

  it('no overlap (file rotation) — returns all lines', () => {
    const prev = ['A', 'B', 'C']
    const curr = ['X', 'Y', 'Z']
    expect(extractNewLines(prev, curr)).toEqual(['X', 'Y', 'Z'])
  })

  it('full overlap (no change) — returns empty', () => {
    const prev = ['A', 'B', 'C']
    const curr = ['A', 'B', 'C']
    expect(extractNewLines(prev, curr)).toEqual([])
  })

  it('previous longer than current, partial overlap', () => {
    const prev = ['A', 'B', 'C', 'D', 'E']
    const curr = ['D', 'E', 'F']
    expect(extractNewLines(prev, curr)).toEqual(['F'])
  })

  it('repeated lines — matches longest suffix', () => {
    const prev = ['X', 'X', 'X', 'A']
    const curr = ['X', 'A', 'B']
    expect(extractNewLines(prev, curr)).toEqual(['B'])
  })

  it('empty current — returns empty', () => {
    expect(extractNewLines(['A', 'B'], [])).toEqual([])
  })

  it('both empty — returns empty', () => {
    expect(extractNewLines([], [])).toEqual([])
  })

  it('large overlap (49 of 50 lines same)', () => {
    const prev = Array.from({ length: 50 }, (_, i) => `line${i + 1}`)
    const curr = Array.from({ length: 50 }, (_, i) => `line${i + 2}`)
    expect(extractNewLines(prev, curr)).toEqual(['line51'])
  })
})

describe('tailLogStream — Windows CRLF handling', () => {
  let pollCount
  let mockRpcInstance
  let abortController
  const tailOutputs = []

  beforeEach(() => {
    pollCount = 0
    tailOutputs.length = 0
    abortController = new AbortController()

    mockRpcInstance = {
      connect: vi.fn(),
      runCommand: vi.fn(async () => {
        const output = tailOutputs[pollCount] ?? { success: true, output: '' }
        pollCount++
        if (pollCount >= tailOutputs.length) {
          abortController.abort()
        }
        return output
      }),
      disconnect: vi.fn()
    }

    _setDeps({
      AvroRpcClient: vi.fn().mockImplementation(function () { return mockRpcInstance }),
      ClientModel: {
        findOne: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue({
              ipAddr: '127.0.0.1',
              agentPorts: { rpc: 7180 },
              basePath: '/app',
              serviceType: 'win_sc'
            })
          })
        })
      },
      detectBasePath: vi.fn(),
      strategyRegistry: {
        get: vi.fn().mockReturnValue({
          getTailCommand: () => ({ commandLine: 'tail', args: ['-n', '50', '/log.txt'] })
        }),
        getDefault: vi.fn()
      },
      sleep: vi.fn()
    })
  })

  it('strips \\r from CRLF output — no duplicate on partial write', async () => {
    // Poll 1: partial write (no trailing \r\n yet)
    tailOutputs.push({ success: true, output: 'A\r\nB\r\nC' })
    // Poll 2: write completed (\r\n added), same content
    tailOutputs.push({ success: true, output: 'A\r\nB\r\nC\r\n' })

    const batches = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) batches.push([...data.lines]) },
      abortController.signal
    )

    // First poll: all 3 lines
    expect(batches[0]).toEqual(['A', 'B', 'C'])
    // Second poll: no change — should NOT send duplicates
    expect(batches).toHaveLength(1)
  })

  it('strips \\r from lines — clean output without CR', async () => {
    tailOutputs.push({ success: true, output: 'line1\r\nline2\r\nline3\r\n' })

    const received = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) received.push(...data.lines) },
      abortController.signal
    )

    // Lines should not contain \r
    expect(received).toEqual(['line1', 'line2', 'line3'])
    expect(received.every(l => !l.includes('\r'))).toBe(true)
  })

  it('CRLF + new lines correctly detected', async () => {
    tailOutputs.push(
      { success: true, output: 'A\r\nB\r\nC\r\n' },
      { success: true, output: 'B\r\nC\r\nD\r\n' }
    )

    const batches = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) batches.push([...data.lines]) },
      abortController.signal
    )

    expect(batches[0]).toEqual(['A', 'B', 'C'])
    expect(batches[1]).toEqual(['D'])
  })
})

describe('tailLogStream — line-diff integration', () => {
  let pollCount
  let mockRpcInstance
  let abortController
  const tailOutputs = []

  beforeEach(() => {
    pollCount = 0
    tailOutputs.length = 0
    abortController = new AbortController()

    mockRpcInstance = {
      connect: vi.fn(),
      runCommand: vi.fn(async () => {
        const output = tailOutputs[pollCount] ?? { success: true, output: '' }
        pollCount++
        if (pollCount >= tailOutputs.length) {
          abortController.abort()
        }
        return output
      }),
      disconnect: vi.fn()
    }

    _setDeps({
      AvroRpcClient: vi.fn().mockImplementation(function () { return mockRpcInstance }),
      ClientModel: {
        findOne: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue({
              ipAddr: '127.0.0.1',
              agentPorts: { rpc: 7180 },
              basePath: '/app',
              serviceType: 'win_sc'
            })
          })
        })
      },
      detectBasePath: vi.fn(),
      strategyRegistry: {
        get: vi.fn().mockReturnValue({
          getTailCommand: () => ({ commandLine: 'tail', args: ['-n', '50', '/log.txt'] })
        }),
        getDefault: vi.fn()
      },
      sleep: vi.fn()
    })
  })

  it('first poll sends all lines', async () => {
    tailOutputs.push({ success: true, output: 'A\nB\nC' })

    const received = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) received.push(...data.lines) },
      abortController.signal
    )

    expect(received).toEqual(['A', 'B', 'C'])
  })

  it('second poll sends only new lines (no duplicates)', async () => {
    tailOutputs.push(
      { success: true, output: 'A\nB\nC' },
      { success: true, output: 'B\nC\nD' }
    )

    const batches = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) batches.push([...data.lines]) },
      abortController.signal
    )

    expect(batches[0]).toEqual(['A', 'B', 'C'])
    expect(batches[1]).toEqual(['D'])
  })

  it('unchanged output sends nothing', async () => {
    tailOutputs.push(
      { success: true, output: 'A\nB\nC' },
      { success: true, output: 'A\nB\nC' }
    )

    const batches = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) batches.push([...data.lines]) },
      abortController.signal
    )

    expect(batches).toHaveLength(1)
  })

  it('file rotation (no overlap) sends all new lines', async () => {
    tailOutputs.push(
      { success: true, output: 'A\nB\nC' },
      { success: true, output: 'X\nY\nZ' }
    )

    const batches = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) batches.push([...data.lines]) },
      abortController.signal
    )

    expect(batches[0]).toEqual(['A', 'B', 'C'])
    expect(batches[1]).toEqual(['X', 'Y', 'Z'])
  })

  it('empty output resets previousLines for clean restart', async () => {
    tailOutputs.push(
      { success: true, output: 'A\nB\nC' },
      { success: true, output: '' },
      { success: true, output: 'X\nY' }
    )

    const batches = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) batches.push([...data.lines]) },
      abortController.signal
    )

    expect(batches[0]).toEqual(['A', 'B', 'C'])
    expect(batches[1]).toEqual(['X', 'Y'])
  })

  it('reuses RPC connection across successful polls', async () => {
    tailOutputs.push(
      { success: true, output: 'A\nB' },
      { success: true, output: 'B\nC' }
    )

    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      () => {},
      abortController.signal
    )

    // connect called once (not twice — connection reused for second poll)
    expect(mockRpcInstance.connect).toHaveBeenCalledTimes(1)
  })

  it('reconnects after RPC error', async () => {
    let callIdx = 0
    mockRpcInstance.runCommand.mockImplementation(async () => {
      callIdx++
      if (callIdx === 1) throw new Error('ECONNRESET')
      if (callIdx === 2) {
        abortController.abort()
        return { success: true, output: 'A\nB' }
      }
    })

    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      () => {},
      abortController.signal
    )

    // connect called twice: initial + reconnect after ECONNRESET
    expect(mockRpcInstance.connect).toHaveBeenCalledTimes(2)
    // disconnect called twice: once for error cleanup, once in finally block
    expect(mockRpcInstance.disconnect).toHaveBeenCalledTimes(2)
  })
})
