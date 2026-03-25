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

// ─── 2A: activeTailCount lifecycle tests ───────────────────────────────
describe('tailLogStream — activeTailCount lifecycle', () => {
  let mockRpcInstance
  let mockClientModel

  function makeStandardDeps(overrides = {}) {
    mockRpcInstance = {
      connect: vi.fn(),
      runCommand: vi.fn(),
      disconnect: vi.fn()
    }
    mockClientModel = {
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(
            overrides.clientDoc !== undefined ? overrides.clientDoc : {
              ipAddr: '127.0.0.1',
              agentPorts: { rpc: 7180 },
              basePath: '/app',
              serviceType: 'win_sc'
            }
          )
        })
      })
    }
    _setDeps({
      AvroRpcClient: vi.fn().mockImplementation(function () { return mockRpcInstance }),
      ClientModel: overrides.ClientModel || mockClientModel,
      detectBasePath: vi.fn(),
      strategyRegistry: {
        get: vi.fn().mockReturnValue({
          getTailCommand: () => ({ commandLine: 'tail', args: ['-n', '50', '/log.txt'] })
        }),
        getDefault: vi.fn()
      },
      sleep: vi.fn()
    })
  }

  it('정상 tail 완료 후 다음 호출 정상 시작', async () => {
    makeStandardDeps()

    // First call: return data then abort
    let callCount1 = 0
    const ac1 = new AbortController()
    mockRpcInstance.runCommand.mockImplementation(async () => {
      callCount1++
      if (callCount1 >= 1) ac1.abort()
      return { success: true, output: 'line1\nline2' }
    })

    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      () => {},
      ac1.signal
    )

    // Second call: should NOT throw "limit reached" (activeTailCount back to 0)
    const ac2 = new AbortController()
    let callCount2 = 0
    mockRpcInstance.runCommand.mockImplementation(async () => {
      callCount2++
      if (callCount2 >= 1) ac2.abort()
      return { success: true, output: 'line3' }
    })
    mockRpcInstance.connect.mockClear()

    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      () => {},
      ac2.signal
    )

    // If we got here without error, activeTailCount was properly decremented
    expect(mockRpcInstance.connect).toHaveBeenCalled()
  })

  it('모든 타겟 DB 조회 실패 시에도 다음 호출 정상', async () => {
    makeStandardDeps({ clientDoc: null })

    const ac1 = new AbortController()
    const errors1 = []
    await tailLogStream(
      [{ eqpId: 'EQ_MISSING', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.error) errors1.push(data.error) },
      ac1.signal
    )

    expect(errors1[0]).toMatch(/Client not found/)

    // Second call should work — reset client to valid
    makeStandardDeps()
    const ac2 = new AbortController()
    mockRpcInstance.runCommand.mockImplementation(async () => {
      ac2.abort()
      return { success: true, output: 'OK' }
    })

    const received = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) received.push(...data.lines) },
      ac2.signal
    )

    expect(received).toEqual(['OK'])
  })

  it('max targets 초과 시 에러 후 다음 호출 정상', async () => {
    makeStandardDeps()

    // LOG_MAX_CONCURRENT_TAILS defaults to 5; pass 6 targets
    const tooMany = Array.from({ length: 6 }, (_, i) => ({
      eqpId: `EQ${i}`, filePath: '/log.txt', agentGroup: 'ars_agent'
    }))

    await expect(
      tailLogStream(tooMany, () => {}, new AbortController().signal)
    ).rejects.toThrow('Too many')

    // Immediately call again with 1 target — should succeed (count was NOT incremented)
    const ac = new AbortController()
    mockRpcInstance.runCommand.mockImplementation(async () => {
      ac.abort()
      return { success: true, output: 'data' }
    })

    await expect(
      tailLogStream(
        [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
        () => {},
        ac.signal
      )
    ).resolves.toBeUndefined()
  })

  it('동시 tail 제한 초과 시 에러', async () => {
    makeStandardDeps()

    const ac1 = new AbortController()
    // First call: fill the limit (5 targets), never abort — hangs on sleep
    let sleepResolve
    const sleepPromise = new Promise(r => { sleepResolve = r })
    _setDeps({
      sleep: vi.fn().mockImplementation(() => sleepPromise),
      AvroRpcClient: vi.fn().mockImplementation(function () { return mockRpcInstance }),
      ClientModel: mockClientModel,
      detectBasePath: vi.fn(),
      strategyRegistry: {
        get: vi.fn().mockReturnValue({
          getTailCommand: () => ({ commandLine: 'tail', args: ['-n', '50', '/log.txt'] })
        }),
        getDefault: vi.fn()
      }
    })

    mockRpcInstance.runCommand.mockResolvedValue({ success: true, output: 'data' })

    const fillTargets = Array.from({ length: 5 }, (_, i) => ({
      eqpId: `EQ${i}`, filePath: '/log.txt', agentGroup: 'ars_agent'
    }))

    // Start first tail (will block on sleep after first poll)
    const firstTail = tailLogStream(fillTargets, () => {}, ac1.signal)

    // Wait for the runCommand calls to happen (all 5 targets polled once)
    await vi.waitFor(() => {
      expect(mockRpcInstance.runCommand).toHaveBeenCalledTimes(5)
    })

    // Second call should fail — concurrent limit reached
    await expect(
      tailLogStream(
        [{ eqpId: 'EQ_EXTRA', filePath: '/log.txt', agentGroup: 'ars_agent' }],
        () => {},
        new AbortController().signal
      )
    ).rejects.toThrow('Concurrent tail limit reached')

    // Abort first tail to free slots
    ac1.abort()
    sleepResolve()
    await firstTail

    // Third call should succeed now
    const ac3 = new AbortController()
    mockRpcInstance.runCommand.mockImplementation(async () => {
      ac3.abort()
      return { success: true, output: 'ok' }
    })

    await expect(
      tailLogStream(
        [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
        () => {},
        ac3.signal
      )
    ).resolves.toBeUndefined()
  })
})

// ─── 2B: RPC reconnection tests ───────────────────────────────────────
describe('tailLogStream — RPC reconnection', () => {
  let mockRpcInstance
  let callOrder

  function makeReconnectDeps() {
    callOrder = []
    mockRpcInstance = {
      connect: vi.fn().mockImplementation(() => { callOrder.push('connect') }),
      runCommand: vi.fn(),
      disconnect: vi.fn().mockImplementation(() => { callOrder.push('disconnect') })
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
  }

  it('2회 연속 RPC 에러 → 3회째 성공 시 데이터 수신', async () => {
    makeReconnectDeps()
    const ac = new AbortController()
    let callIdx = 0

    mockRpcInstance.runCommand.mockImplementation(async () => {
      callIdx++
      if (callIdx <= 2) throw new Error(`RPC fail #${callIdx}`)
      // 3rd call succeeds
      ac.abort()
      return { success: true, output: 'hello\nworld' }
    })

    const received = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) received.push(...data.lines) },
      ac.signal
    )

    expect(callIdx).toBe(3)
    expect(received).toEqual(['hello', 'world'])
  })

  it('재연결 시 disconnect → connect 순서 확인', async () => {
    makeReconnectDeps()
    const ac = new AbortController()
    let callIdx = 0

    mockRpcInstance.runCommand.mockImplementation(async () => {
      callIdx++
      callOrder.push(`runCommand:${callIdx}`)
      if (callIdx === 1) throw new Error('ECONNRESET')
      ac.abort()
      return { success: true, output: 'OK' }
    })

    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      () => {},
      ac.signal
    )

    // Expected order:
    // 1. connect (initial)
    // 2. runCommand:1 (fails)
    // 3. disconnect (error cleanup)
    // 4. connect (reconnect)
    // 5. runCommand:2 (succeeds)
    // 6. disconnect (finally cleanup)
    expect(callOrder).toEqual([
      'connect',
      'runCommand:1',
      'disconnect',
      'connect',
      'runCommand:2',
      'disconnect'
    ])
  })

  it('모든 재연결 실패 시 abort 후 정상 종료', async () => {
    makeReconnectDeps()
    const ac = new AbortController()

    mockRpcInstance.runCommand.mockImplementation(async () => {
      throw new Error('permanent RPC failure')
    })

    // Abort after a few retries via sleep mock
    let sleepCount = 0
    _setDeps({
      sleep: vi.fn().mockImplementation(async () => {
        sleepCount++
        if (sleepCount >= 3) ac.abort()
      }),
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
      }
    })

    // Should resolve (not hang) — the abort signal stops the loop
    await expect(
      tailLogStream(
        [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
        () => {},
        ac.signal
      )
    ).resolves.toBeUndefined()

    // Verify it actually retried multiple times
    expect(sleepCount).toBeGreaterThanOrEqual(3)
  })
})
