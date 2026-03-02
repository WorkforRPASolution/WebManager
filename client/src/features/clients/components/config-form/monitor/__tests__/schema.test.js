import { describe, it, expect } from 'vitest'
import {
  COLLECTOR_NAMES,
  COLLECTOR_DEFAULTS,
  COLLECTOR_SPECIAL_FIELDS,
  COLLECTOR_GROUPS,
  parseMonitorInput,
  buildMonitorOutput
} from '../schema'

// ===========================================================================
// Cycle 1: Constants
// ===========================================================================

describe('COLLECTOR_NAMES', () => {
  it('has 14 entries', () => {
    expect(COLLECTOR_NAMES).toHaveLength(14)
  })

  it('contains all expected collector names', () => {
    const expected = [
      'CPU', 'Memory', 'Disk', 'Network', 'Temperature', 'Fan', 'GPU',
      'Voltage', 'MotherboardTemp', 'StorageSmart', 'CPUProcess',
      'MemoryProcess', 'Uptime', 'ProcessWatch'
    ]
    expect(COLLECTOR_NAMES).toEqual(expected)
  })
})

describe('COLLECTOR_DEFAULTS', () => {
  it('has 14 entries matching COLLECTOR_NAMES', () => {
    expect(Object.keys(COLLECTOR_DEFAULTS)).toHaveLength(14)
    for (const name of COLLECTOR_NAMES) {
      expect(COLLECTOR_DEFAULTS).toHaveProperty(name)
    }
  })

  it('every collector has Enabled and Interval', () => {
    for (const name of COLLECTOR_NAMES) {
      const def = COLLECTOR_DEFAULTS[name]
      expect(def).toHaveProperty('Enabled')
      expect(def).toHaveProperty('Interval')
      expect(typeof def.Enabled).toBe('boolean')
      expect(typeof def.Interval).toBe('string')
    }
  })

  it('CPU default: Enabled=true, Interval=30s', () => {
    expect(COLLECTOR_DEFAULTS.CPU).toEqual({ Enabled: true, Interval: '30s' })
  })

  it('StorageSmart default: Enabled=true, Interval=300s', () => {
    expect(COLLECTOR_DEFAULTS.StorageSmart).toEqual({ Enabled: true, Interval: '300s' })
  })

  it('CPUProcess default includes TopN=10', () => {
    expect(COLLECTOR_DEFAULTS.CPUProcess.TopN).toBe(10)
  })

  it('MemoryProcess default includes TopN=10', () => {
    expect(COLLECTOR_DEFAULTS.MemoryProcess.TopN).toBe(10)
  })
})

describe('COLLECTOR_GROUPS', () => {
  it('has 6 groups', () => {
    expect(COLLECTOR_GROUPS).toHaveLength(6)
  })

  it('covers all 14 collectors', () => {
    const allCollectors = COLLECTOR_GROUPS.flatMap(g => g.collectors)
    expect(allCollectors).toHaveLength(14)
    expect(allCollectors.sort()).toEqual([...COLLECTOR_NAMES].sort())
  })

  it('group names are correct', () => {
    const names = COLLECTOR_GROUPS.map(g => g.name)
    expect(names).toEqual([
      '기본 시스템', '디스크', '네트워크', '하드웨어 센서', '프로세스 순위', '프로세스 감시'
    ])
  })

  it('기본 시스템 contains CPU, Memory, Uptime', () => {
    const group = COLLECTOR_GROUPS.find(g => g.name === '기본 시스템')
    expect(group.collectors).toEqual(['CPU', 'Memory', 'Uptime'])
  })

  it('하드웨어 센서 contains 5 collectors', () => {
    const group = COLLECTOR_GROUPS.find(g => g.name === '하드웨어 센서')
    expect(group.collectors).toEqual(['Temperature', 'Fan', 'GPU', 'Voltage', 'MotherboardTemp'])
  })
})

describe('COLLECTOR_SPECIAL_FIELDS', () => {
  it('Disk has Disks array field', () => {
    expect(COLLECTOR_SPECIAL_FIELDS.Disk.Disks).toEqual({
      type: 'array', label: '대상 디스크', default: []
    })
  })

  it('StorageSmart has Disks array field', () => {
    expect(COLLECTOR_SPECIAL_FIELDS.StorageSmart.Disks).toEqual({
      type: 'array', label: '대상 디스크', default: []
    })
  })

  it('Network has Interfaces array field', () => {
    expect(COLLECTOR_SPECIAL_FIELDS.Network.Interfaces).toEqual({
      type: 'array', label: '대상 인터페이스', default: []
    })
  })

  it('Temperature has IncludeZones array field', () => {
    expect(COLLECTOR_SPECIAL_FIELDS.Temperature.IncludeZones).toEqual({
      type: 'array', label: '대상 Zone', default: []
    })
  })

  it('CPUProcess has TopN and WatchProcesses', () => {
    expect(COLLECTOR_SPECIAL_FIELDS.CPUProcess.TopN).toEqual({
      type: 'number', label: 'Top N', default: 10
    })
    expect(COLLECTOR_SPECIAL_FIELDS.CPUProcess.WatchProcesses).toEqual({
      type: 'array', label: '감시 프로세스', default: []
    })
  })

  it('ProcessWatch has RequiredProcesses and ForbiddenProcesses', () => {
    expect(COLLECTOR_SPECIAL_FIELDS.ProcessWatch.RequiredProcesses).toEqual({
      type: 'array', label: '필수 프로세스', default: []
    })
    expect(COLLECTOR_SPECIAL_FIELDS.ProcessWatch.ForbiddenProcesses).toEqual({
      type: 'array', label: '금지 프로세스', default: []
    })
  })

  it('collectors without special fields are not in COLLECTOR_SPECIAL_FIELDS', () => {
    expect(COLLECTOR_SPECIAL_FIELDS).not.toHaveProperty('CPU')
    expect(COLLECTOR_SPECIAL_FIELDS).not.toHaveProperty('Memory')
    expect(COLLECTOR_SPECIAL_FIELDS).not.toHaveProperty('Uptime')
  })
})

// ===========================================================================
// Cycle 2: parseMonitorInput
// ===========================================================================

describe('parseMonitorInput', () => {
  it('full config: unwraps Collectors and preserves all values', () => {
    const config = {
      Collectors: {
        CPU: { Enabled: true, Interval: '30s' },
        Memory: { Enabled: false, Interval: '60s' }
      }
    }
    const result = parseMonitorInput(config)
    expect(result.CPU.Enabled).toBe(true)
    expect(result.CPU.Interval).toBe('30s')
    expect(result.Memory.Enabled).toBe(false)
    expect(result.Memory.Interval).toBe('60s')
  })

  it('missing collectors get defaults', () => {
    const config = { Collectors: { CPU: { Enabled: false, Interval: '10s' } } }
    const result = parseMonitorInput(config)
    // CPU 는 주어진 값 유지
    expect(result.CPU.Enabled).toBe(false)
    expect(result.CPU.Interval).toBe('10s')
    // Memory 누락 -> 기본값
    expect(result.Memory.Enabled).toBe(true)
    expect(result.Memory.Interval).toBe('30s')
    // 모든 14개 Collector 존재
    for (const name of COLLECTOR_NAMES) {
      expect(result).toHaveProperty(name)
    }
  })

  it('empty config fills all defaults', () => {
    const result = parseMonitorInput({})
    for (const name of COLLECTOR_NAMES) {
      expect(result).toHaveProperty(name)
      expect(result[name].Enabled).toBe(COLLECTOR_DEFAULTS[name].Enabled)
      expect(result[name].Interval).toBe(COLLECTOR_DEFAULTS[name].Interval)
    }
  })

  it('null/undefined config fills all defaults', () => {
    const result = parseMonitorInput(null)
    for (const name of COLLECTOR_NAMES) {
      expect(result).toHaveProperty(name)
    }
  })

  it('special field defaults are filled when missing', () => {
    const config = { Collectors: { Disk: { Enabled: true, Interval: '60s' } } }
    const result = parseMonitorInput(config)
    expect(result.Disk.Disks).toEqual([])
  })

  it('special field values are preserved when present', () => {
    const config = {
      Collectors: {
        Disk: { Enabled: true, Interval: '60s', Disks: ['C:', 'D:'] },
        CPUProcess: { Enabled: true, Interval: '60s', TopN: 5, WatchProcesses: ['proc.exe'] },
        ProcessWatch: {
          Enabled: true, Interval: '60s',
          RequiredProcesses: ['a.exe'], ForbiddenProcesses: ['b.exe']
        }
      }
    }
    const result = parseMonitorInput(config)
    expect(result.Disk.Disks).toEqual(['C:', 'D:'])
    expect(result.CPUProcess.TopN).toBe(5)
    expect(result.CPUProcess.WatchProcesses).toEqual(['proc.exe'])
    expect(result.ProcessWatch.RequiredProcesses).toEqual(['a.exe'])
    expect(result.ProcessWatch.ForbiddenProcesses).toEqual(['b.exe'])
  })

  it('partial collector config fills missing fields from defaults', () => {
    // Collector 존재하지만 Enabled만 있고 Interval 없는 경우
    const config = { Collectors: { CPU: { Enabled: false } } }
    const result = parseMonitorInput(config)
    expect(result.CPU.Enabled).toBe(false)
    expect(result.CPU.Interval).toBe('30s')
  })

  it('CPUProcess without TopN fills default TopN=10', () => {
    const config = { Collectors: { CPUProcess: { Enabled: true, Interval: '30s' } } }
    const result = parseMonitorInput(config)
    expect(result.CPUProcess.TopN).toBe(10)
    expect(result.CPUProcess.WatchProcesses).toEqual([])
  })
})

// ===========================================================================
// Cycle 3: buildMonitorOutput
// ===========================================================================

describe('buildMonitorOutput', () => {
  it('wraps in Collectors key', () => {
    const formData = {
      CPU: { Enabled: true, Interval: '30s' },
      Memory: { Enabled: true, Interval: '30s' }
    }
    const result = buildMonitorOutput(formData)
    expect(result).toHaveProperty('Collectors')
    expect(result.Collectors).toHaveProperty('CPU')
    expect(result.Collectors).toHaveProperty('Memory')
  })

  it('TopN is coerced to number', () => {
    const formData = {
      CPUProcess: { Enabled: true, Interval: '60s', TopN: '5', WatchProcesses: [] }
    }
    const result = buildMonitorOutput(formData)
    expect(result.Collectors.CPUProcess.TopN).toBe(5)
    expect(typeof result.Collectors.CPUProcess.TopN).toBe('number')
  })

  it('Enabled is coerced to boolean', () => {
    const formData = {
      CPU: { Enabled: 1, Interval: '30s' }
    }
    const result = buildMonitorOutput(formData)
    expect(result.Collectors.CPU.Enabled).toBe(true)
    expect(typeof result.Collectors.CPU.Enabled).toBe('boolean')
  })

  it('array fields are preserved', () => {
    const formData = {
      Disk: { Enabled: true, Interval: '60s', Disks: ['C:', 'D:'] },
      Network: { Enabled: true, Interval: '30s', Interfaces: ['eth0'] },
      ProcessWatch: {
        Enabled: true, Interval: '60s',
        RequiredProcesses: ['a.exe'], ForbiddenProcesses: ['b.exe']
      }
    }
    const result = buildMonitorOutput(formData)
    expect(result.Collectors.Disk.Disks).toEqual(['C:', 'D:'])
    expect(result.Collectors.Network.Interfaces).toEqual(['eth0'])
    expect(result.Collectors.ProcessWatch.RequiredProcesses).toEqual(['a.exe'])
    expect(result.Collectors.ProcessWatch.ForbiddenProcesses).toEqual(['b.exe'])
  })

  it('empty formData produces empty Collectors', () => {
    const result = buildMonitorOutput({})
    expect(result).toEqual({ Collectors: {} })
  })

  it('only includes collectors present in formData', () => {
    const formData = {
      CPU: { Enabled: true, Interval: '30s' }
    }
    const result = buildMonitorOutput(formData)
    expect(Object.keys(result.Collectors)).toEqual(['CPU'])
  })
})

// ===========================================================================
// Cycle 4: Roundtrip
// ===========================================================================

describe('Roundtrip: buildMonitorOutput(parseMonitorInput(config))', () => {
  it('full Monitor.json example from schema doc section 5.2', () => {
    const fullConfig = {
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

    const parsed = parseMonitorInput(fullConfig)
    const rebuilt = buildMonitorOutput(parsed)
    expect(rebuilt).toEqual(fullConfig)
  })

  it('partial config roundtrip fills defaults then rebuilds', () => {
    const config = {
      Collectors: {
        CPU: { Enabled: false, Interval: '10s' },
        ProcessWatch: {
          Enabled: true, Interval: '30s',
          RequiredProcesses: ['agent.exe'],
          ForbiddenProcesses: ['bad.exe']
        }
      }
    }
    const parsed = parseMonitorInput(config)
    const rebuilt = buildMonitorOutput(parsed)

    // 원본에 있던 값은 유지
    expect(rebuilt.Collectors.CPU.Enabled).toBe(false)
    expect(rebuilt.Collectors.CPU.Interval).toBe('10s')
    expect(rebuilt.Collectors.ProcessWatch.RequiredProcesses).toEqual(['agent.exe'])

    // 누락 collector는 기본값으로 채워짐
    expect(rebuilt.Collectors.Memory.Enabled).toBe(true)
    expect(rebuilt.Collectors.Memory.Interval).toBe('30s')

    // 모든 14개 collector 존재
    expect(Object.keys(rebuilt.Collectors)).toHaveLength(14)
  })

  it('config with custom TopN preserved through roundtrip', () => {
    const config = {
      Collectors: {
        CPUProcess: { Enabled: true, Interval: '30s', TopN: 20, WatchProcesses: ['x.exe'] },
        MemoryProcess: { Enabled: false, Interval: '120s', TopN: 5, WatchProcesses: [] }
      }
    }
    const parsed = parseMonitorInput(config)
    const rebuilt = buildMonitorOutput(parsed)
    expect(rebuilt.Collectors.CPUProcess.TopN).toBe(20)
    expect(rebuilt.Collectors.CPUProcess.WatchProcesses).toEqual(['x.exe'])
    expect(rebuilt.Collectors.MemoryProcess.TopN).toBe(5)
    expect(rebuilt.Collectors.MemoryProcess.Enabled).toBe(false)
  })
})
