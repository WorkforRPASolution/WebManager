import { describe, it, expect } from 'vitest'
import { describeMonitor } from '../description'

describe('describeMonitor', () => {
  // 전체 기본값 (14개 모두 활성)
  const ALL_ACTIVE_CONFIG = {
    Collectors: {
      CPU: { Enabled: true, Interval: '30s' },
      Memory: { Enabled: true, Interval: '30s' },
      Disk: { Enabled: true, Interval: '60s', Disks: [] },
      Network: { Enabled: true, Interval: '30s', Interfaces: [] },
      Temperature: { Enabled: true, Interval: '60s', IncludeZones: [] },
      Fan: { Enabled: true, Interval: '60s', IncludeZones: [] },
      GPU: { Enabled: true, Interval: '60s', IncludeZones: [] },
      Voltage: { Enabled: true, Interval: '60s', IncludeZones: [] },
      MotherboardTemp: { Enabled: true, Interval: '60s', IncludeZones: [] },
      StorageSmart: { Enabled: true, Interval: '300s', Disks: [] },
      CPUProcess: { Enabled: true, Interval: '60s', TopN: 10, WatchProcesses: [] },
      MemoryProcess: { Enabled: true, Interval: '60s', TopN: 10, WatchProcesses: [] },
      Uptime: { Enabled: true, Interval: '300s' },
      ProcessWatch: { Enabled: true, Interval: '60s', RequiredProcesses: [], ForbiddenProcesses: [] }
    }
  }

  it('all 14 active -> "활성 Collector: 14/14개"', () => {
    const desc = describeMonitor(ALL_ACTIVE_CONFIG)
    expect(desc).toContain('활성 Collector: 14/14개')
  })

  it('all active -> no 비활성 line', () => {
    const desc = describeMonitor(ALL_ACTIVE_CONFIG)
    expect(desc).not.toContain('비활성')
  })

  it('some inactive -> shows 비활성 names', () => {
    const config = {
      Collectors: {
        ...ALL_ACTIVE_CONFIG.Collectors,
        GPU: { Enabled: false, Interval: '60s', IncludeZones: [] },
        Voltage: { Enabled: false, Interval: '60s', IncludeZones: [] }
      }
    }
    const desc = describeMonitor(config)
    expect(desc).toContain('활성 Collector: 12/14개')
    expect(desc).toContain('비활성: GPU, Voltage')
  })

  it('CPUProcess with special fields -> shows TopN and WatchProcesses count', () => {
    const config = {
      Collectors: {
        ...ALL_ACTIVE_CONFIG.Collectors,
        CPUProcess: {
          Enabled: true, Interval: '60s', TopN: 10,
          WatchProcesses: ['agent.exe', 'svc.exe']
        }
      }
    }
    const desc = describeMonitor(config)
    expect(desc).toContain('CPUProcess(60초): Top10, 감시: 2개')
  })

  it('MemoryProcess with special fields -> shows TopN', () => {
    const config = {
      Collectors: {
        ...ALL_ACTIVE_CONFIG.Collectors,
        MemoryProcess: {
          Enabled: true, Interval: '30s', TopN: 5,
          WatchProcesses: []
        }
      }
    }
    const desc = describeMonitor(config)
    expect(desc).toContain('MemoryProcess(30초): Top5')
  })

  it('ProcessWatch with special fields -> shows required and forbidden count', () => {
    const config = {
      Collectors: {
        ...ALL_ACTIVE_CONFIG.Collectors,
        ProcessWatch: {
          Enabled: true, Interval: '60s',
          RequiredProcesses: ['a.exe', 'b.exe', 'c.exe'],
          ForbiddenProcesses: ['bad.exe']
        }
      }
    }
    const desc = describeMonitor(config)
    expect(desc).toContain('ProcessWatch(60초): 필수: 3개, 금지: 1개')
  })

  it('ProcessWatch with only required -> shows only required', () => {
    const config = {
      Collectors: {
        ...ALL_ACTIVE_CONFIG.Collectors,
        ProcessWatch: {
          Enabled: true, Interval: '60s',
          RequiredProcesses: ['a.exe'],
          ForbiddenProcesses: []
        }
      }
    }
    const desc = describeMonitor(config)
    expect(desc).toContain('ProcessWatch(60초): 필수: 1개')
    expect(desc).not.toContain('금지')
  })

  it('disabled CPUProcess -> no special field detail', () => {
    const config = {
      Collectors: {
        ...ALL_ACTIVE_CONFIG.Collectors,
        CPUProcess: {
          Enabled: false, Interval: '60s', TopN: 10,
          WatchProcesses: ['agent.exe']
        }
      }
    }
    const desc = describeMonitor(config)
    expect(desc).not.toContain('CPUProcess(60초)')
    expect(desc).toContain('비활성: CPUProcess')
  })

  it('empty/null config -> 설정 없음', () => {
    expect(describeMonitor(null)).toBe('설정 없음')
    expect(describeMonitor(undefined)).toBe('설정 없음')
  })

  it('empty Collectors -> 설정 없음', () => {
    expect(describeMonitor({})).toBe('설정 없음')
    expect(describeMonitor({ Collectors: {} })).toBe('설정 없음')
  })

  it('Interval uses parseGoDuration for Korean display', () => {
    const config = {
      Collectors: {
        ...ALL_ACTIVE_CONFIG.Collectors,
        CPUProcess: {
          Enabled: true, Interval: '1m30s', TopN: 10,
          WatchProcesses: ['a.exe']
        }
      }
    }
    const desc = describeMonitor(config)
    expect(desc).toContain('CPUProcess(1분 30초)')
  })

  it('MemoryProcess with WatchProcesses count', () => {
    const config = {
      Collectors: {
        ...ALL_ACTIVE_CONFIG.Collectors,
        MemoryProcess: {
          Enabled: true, Interval: '60s', TopN: 15,
          WatchProcesses: ['x.exe', 'y.exe', 'z.exe']
        }
      }
    }
    const desc = describeMonitor(config)
    expect(desc).toContain('MemoryProcess(60초): Top15, 감시: 3개')
  })
})
