import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractNewLines, tailLogStream, _setDeps, parseOffsetHeader, isRotationSignal } from './logService.js'

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
    // Poll 1: partial write (no trailing \r\n yet) — C is incomplete
    tailOutputs.push({ success: true, output: 'A\r\nB\r\nC' })
    // Poll 2: write completed (\r\n added), same content (WinTail strips trailing \n → ends \r)
    tailOutputs.push({ success: true, output: 'A\r\nB\r\nC\r' })

    const batches = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) batches.push([...data.lines]) },
      abortController.signal
    )

    // First poll: A, B (C excluded as incomplete — no trailing \n/\r)
    // Second poll: C now included (output ends with \r → complete), overlap A,B → new = C
    expect(batches[0]).toEqual(['A', 'B'])
    expect(batches[1]).toEqual(['C'])
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

describe('tailLogStream — partial write handling', () => {
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

  it('부분 쓰기 (trailing \\n 없음) — 불완전 줄 제외하여 중복 방지', async () => {
    // Poll 1: 파일 쓰기 중 — "ERROR Conn" 은 불완전 (trailing \n/\r 없음)
    tailOutputs.push({ success: true, output: 'A\r\nB\r\nERROR Conn' })
    // Poll 2: 줄 완성 + 새 줄 D 추가 (WinTail: trailing \n strip → \r로 끝남)
    tailOutputs.push({ success: true, output: 'B\r\nERROR Connection timeout\r\nD\r' })

    const allReceived = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) allReceived.push(...data.lines) },
      abortController.signal
    )

    // 중복 없이 각 줄이 한 번만 나와야 함
    // Poll 1: A, B 전송 (불완전한 "ERROR Conn" 제외)
    // Poll 2: "ERROR Connection timeout", D 전송
    expect(allReceived).toEqual(['A', 'B', 'ERROR Connection timeout', 'D'])
  })

  it('LF 부분 쓰기 — Linux tail도 불완전 줄 제외', async () => {
    // Poll 1: Linux tail — trailing \n 없음 (부분 쓰기)
    tailOutputs.push({ success: true, output: 'X\nY\nZ_partial' })
    // Poll 2: Z 완성 + W 추가 (Linux tail — trailing \n 있음)
    tailOutputs.push({ success: true, output: 'Y\nZ_complete\nW\n' })

    const allReceived = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) allReceived.push(...data.lines) },
      abortController.signal
    )

    expect(allReceived).toEqual(['X', 'Y', 'Z_complete', 'W'])
  })

  it('WinTail CRLF 완전 출력 — 마지막 줄 정상 포함', async () => {
    // WinTail: trailing \n strip → output ends with \r → 완전
    tailOutputs.push({ success: true, output: 'A\r\nB\r\nC\r' })

    const allReceived = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) allReceived.push(...data.lines) },
      abortController.signal
    )

    // 마지막 줄 C도 포함되어야 함
    expect(allReceived).toEqual(['A', 'B', 'C'])
  })

  it('Linux tail 완전 출력 — 마지막 줄 정상 포함', async () => {
    // Linux tail: trailing \n 보존 → 완전
    tailOutputs.push({ success: true, output: 'A\nB\nC\n' })

    const allReceived = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) allReceived.push(...data.lines) },
      abortController.signal
    )

    expect(allReceived).toEqual(['A', 'B', 'C'])
  })

  it('연속 부분 쓰기 — 계속 불완전해도 완전한 줄은 정상 전송', async () => {
    // Poll 1: line3 부분 쓰기
    tailOutputs.push({ success: true, output: 'line1\r\nline2\r\nline3_p' })
    // Poll 2: line3 여전히 부분 쓰기 (더 길어짐)
    tailOutputs.push({ success: true, output: 'line1\r\nline2\r\nline3_partial' })
    // Poll 3: line3 완성, line4 추가 (WinTail 완전 출력)
    tailOutputs.push({ success: true, output: 'line2\r\nline3_complete\r\nline4\r' })

    const allReceived = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) allReceived.push(...data.lines) },
      abortController.signal
    )

    // line1, line2 (poll 1), line3_complete, line4 (poll 3)
    // 부분 쓰기된 line3_p, line3_partial은 전송되지 않아야 함
    expect(allReceived).toEqual(['line1', 'line2', 'line3_complete', 'line4'])
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
    tailOutputs.push({ success: true, output: 'A\nB\nC\n' })

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
      { success: true, output: 'A\nB\nC\n' },
      { success: true, output: 'B\nC\nD\n' }
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
      { success: true, output: 'A\nB\nC\n' },
      { success: true, output: 'A\nB\nC\n' }
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
      { success: true, output: 'A\nB\nC\n' },
      { success: true, output: 'X\nY\nZ\n' }
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
      { success: true, output: 'A\nB\nC\n' },
      { success: true, output: '' },
      { success: true, output: 'X\nY\n' }
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
      { success: true, output: 'A\nB\n' },
      { success: true, output: 'B\nC\n' }
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
        return { success: true, output: 'A\nB\n' }
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
      return { success: true, output: 'line1\nline2\n' }
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
      return { success: true, output: 'line3\n' }
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
      return { success: true, output: 'OK\n' }
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
      return { success: true, output: 'data\n' }
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

    mockRpcInstance.runCommand.mockResolvedValue({ success: true, output: 'data\n' })

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
      return { success: true, output: 'ok\n' }
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
      return { success: true, output: 'hello\nworld\n' }
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
      return { success: true, output: 'OK\n' }
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

// ─── Offset utility tests ─────────────────────────────────
describe('parseOffsetHeader', () => {
  it('parses valid header with content', () => {
    expect(parseOffsetHeader('@WINTAIL:1234\ncontent line')).toEqual({ offset: 1234, content: 'content line' })
  })
  it('parses header with empty content (trailing newline)', () => {
    expect(parseOffsetHeader('@WINTAIL:5000\n')).toEqual({ offset: 5000, content: '' })
  })
  it('parses header without newline', () => {
    expect(parseOffsetHeader('@WINTAIL:5000')).toEqual({ offset: 5000, content: '' })
  })
  it('returns null for regular output', () => {
    expect(parseOffsetHeader('regular output')).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(parseOffsetHeader('')).toBeNull()
  })
  it('returns null for null', () => {
    expect(parseOffsetHeader(null)).toBeNull()
  })
  it('returns null for invalid number', () => {
    expect(parseOffsetHeader('@WINTAIL:abc\ndata')).toBeNull()
  })
})

describe('isRotationSignal', () => {
  it('detects exit value 2', () => {
    expect(isRotationSignal({ success: false, error: 'Exit value: 2' })).toBe(true)
  })
  it('detects exit value 2 in longer message', () => {
    expect(isRotationSignal({ success: false, error: 'Process exited with exit value: 2' })).toBe(true)
  })
  it('rejects exit value 1', () => {
    expect(isRotationSignal({ success: false, error: 'Exit value: 1' })).toBe(false)
  })
  it('rejects success response', () => {
    expect(isRotationSignal({ success: true })).toBe(false)
  })
  it('handles empty error', () => {
    expect(isRotationSignal({ success: false, error: '' })).toBe(false)
  })
  it('handles null error', () => {
    expect(isRotationSignal({ success: false, error: null })).toBe(false)
  })
})

// ─── Offset mode integration tests ────────────────────────
describe('tailLogStream — offset mode', () => {
  let pollCount
  let mockRpcInstance
  let abortController
  const tailOutputs = []
  let capturedOffsets

  beforeEach(() => {
    pollCount = 0
    tailOutputs.length = 0
    capturedOffsets = []
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
          getTailCommand: (filePath, lines, basePath, offset) => {
            capturedOffsets.push(offset)
            return { commandLine: 'tail', args: ['-n', '50', filePath] }
          }
        }),
        getDefault: vi.fn()
      },
      sleep: vi.fn()
    })
  })

  it('initial call parses header and sends lines', async () => {
    tailOutputs.push({ success: true, output: '@WINTAIL:100\nline1\nline2\n' })

    const batches = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) batches.push([...data.lines]) },
      abortController.signal
    )

    expect(batches[0]).toEqual(['line1', 'line2'])
  })

  it('follow-up passes offset to strategy', async () => {
    tailOutputs.push(
      { success: true, output: '@WINTAIL:100\nline1\n' },
      { success: true, output: '@WINTAIL:200\nline2\n' }
    )

    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      () => {},
      abortController.signal
    )

    // First call: offset is null (initial)
    expect(capturedOffsets[0]).toBeNull()
    // Second call: offset = 100 (from first response)
    expect(capturedOffsets[1]).toBe(100)
  })

  it('partial write buffering across polls', async () => {
    // Poll 1: "line1\npartial" — "partial" has no trailing \n
    tailOutputs.push({ success: true, output: '@WINTAIL:50\nline1\npartial' })
    // Poll 2: rest of partial completes + new line
    tailOutputs.push({ success: true, output: '@WINTAIL:120\n_end\nline2\n' })

    const batches = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) batches.push([...data.lines]) },
      abortController.signal
    )

    // Poll 1: only "line1" sent, "partial" buffered
    expect(batches[0]).toEqual(['line1'])
    // Poll 2: "partial" + "_end" joined → "partial_end", then "line2"
    expect(batches[1]).toEqual(['partial_end', 'line2'])
  })

  it('rotation resets offset and pending', async () => {
    tailOutputs.push(
      { success: true, output: '@WINTAIL:500\nold_line\n' },
      { success: false, error: 'Exit value: 2' },  // rotation signal
      { success: true, output: '@WINTAIL:50\nnew_line\n' }
    )

    const batches = []
    const infos = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => {
        if (data.lines) batches.push([...data.lines])
        if (data.info) infos.push(data.info)
      },
      abortController.signal
    )

    expect(batches[0]).toEqual(['old_line'])
    expect(infos[0]).toMatch(/rotation/i)
    expect(batches[1]).toEqual(['new_line'])
    // After rotation, offset passed to strategy should be null (reset)
    expect(capturedOffsets[2]).toBeNull()
  })

  it('empty follow-up does not emit', async () => {
    tailOutputs.push(
      { success: true, output: '@WINTAIL:100\nline1\n' },
      { success: true, output: '@WINTAIL:100\n' }  // no new content
    )

    const batches = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) batches.push([...data.lines]) },
      abortController.signal
    )

    // Only one batch from first poll
    expect(batches).toHaveLength(1)
    expect(batches[0]).toEqual(['line1'])
  })

  it('CRLF in offset mode — strips CR', async () => {
    tailOutputs.push({ success: true, output: '@WINTAIL:200\nline1\r\nline2\r\n' })

    const batches = []
    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      (data) => { if (data.lines) batches.push([...data.lines]) },
      abortController.signal
    )

    expect(batches[0]).toEqual(['line1', 'line2'])
    expect(batches[0].every(l => !l.includes('\r'))).toBe(true)
  })

  it('backward compat — no header falls back to legacy mode', async () => {
    // No @WINTAIL: header → legacy extractNewLines path
    tailOutputs.push(
      { success: true, output: 'A\nB\nC\n' },
      { success: true, output: 'B\nC\nD\n' }
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

  it('offset=0 is valid (not falsy)', async () => {
    // File was read from beginning, offset reports 0
    tailOutputs.push(
      { success: true, output: '@WINTAIL:0\n' },
      { success: true, output: '@WINTAIL:50\nnewdata\n' }
    )

    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      () => {},
      abortController.signal
    )

    // Second call should pass offset=0, not null
    expect(capturedOffsets[1]).toBe(0)
  })

  it('RPC error does not reset offset', async () => {
    let callIdx = 0
    mockRpcInstance.runCommand.mockImplementation(async () => {
      callIdx++
      if (callIdx === 1) return { success: true, output: '@WINTAIL:100\nline1\n' }
      if (callIdx === 2) throw new Error('ECONNRESET')
      if (callIdx === 3) {
        abortController.abort()
        return { success: true, output: '@WINTAIL:200\nline2\n' }
      }
    })

    await tailLogStream(
      [{ eqpId: 'EQ1', filePath: '/log.txt', agentGroup: 'ars_agent' }],
      () => {},
      abortController.signal
    )

    // After RPC error, offset should still be 100 (not reset)
    // Call 1: offset=null, Call 2: error (no getTailCommand), Call 3: offset=100
    expect(capturedOffsets[0]).toBeNull()
    expect(capturedOffsets[1]).toBe(100)
  })
})
