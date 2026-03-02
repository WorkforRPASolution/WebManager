/**
 * monitor/schema.js
 *
 * Monitor.json configuration schema for ResourceAgent.
 * 14개 Collector의 활성화/주기/특수 옵션을 관리합니다.
 */

export const COLLECTOR_NAMES = [
  'CPU', 'Memory', 'Disk', 'Network', 'Temperature', 'Fan', 'GPU',
  'Voltage', 'MotherboardTemp', 'StorageSmart', 'CPUProcess',
  'MemoryProcess', 'Uptime', 'ProcessWatch'
]

export const COLLECTOR_DEFAULTS = {
  CPU:             { Enabled: true, Interval: '30s' },
  Memory:          { Enabled: true, Interval: '30s' },
  Disk:            { Enabled: true, Interval: '60s' },
  Network:         { Enabled: true, Interval: '30s' },
  Temperature:     { Enabled: true, Interval: '60s' },
  Fan:             { Enabled: true, Interval: '60s' },
  GPU:             { Enabled: true, Interval: '60s' },
  Voltage:         { Enabled: true, Interval: '60s' },
  MotherboardTemp: { Enabled: true, Interval: '60s' },
  StorageSmart:    { Enabled: true, Interval: '300s' },
  CPUProcess:      { Enabled: true, Interval: '60s', TopN: 10 },
  MemoryProcess:   { Enabled: true, Interval: '60s', TopN: 10 },
  Uptime:          { Enabled: true, Interval: '300s' },
  ProcessWatch:    { Enabled: true, Interval: '60s' }
}

export const COLLECTOR_SPECIAL_FIELDS = {
  Disk:            { Disks: { type: 'array', label: '대상 디스크', default: [] } },
  StorageSmart:    { Disks: { type: 'array', label: '대상 디스크', default: [] } },
  Network:         { Interfaces: { type: 'array', label: '대상 인터페이스', default: [] } },
  Temperature:     { IncludeZones: { type: 'array', label: '대상 Zone', default: [] } },
  Fan:             { IncludeZones: { type: 'array', label: '대상 Zone', default: [] } },
  GPU:             { IncludeZones: { type: 'array', label: '대상 Zone', default: [] } },
  Voltage:         { IncludeZones: { type: 'array', label: '대상 Zone', default: [] } },
  MotherboardTemp: { IncludeZones: { type: 'array', label: '대상 Zone', default: [] } },
  CPUProcess:      { TopN: { type: 'number', label: 'Top N', default: 10 }, WatchProcesses: { type: 'array', label: '감시 프로세스', default: [] } },
  MemoryProcess:   { TopN: { type: 'number', label: 'Top N', default: 10 }, WatchProcesses: { type: 'array', label: '감시 프로세스', default: [] } },
  ProcessWatch:    { RequiredProcesses: { type: 'array', label: '필수 프로세스', default: [] }, ForbiddenProcesses: { type: 'array', label: '금지 프로세스', default: [] } }
}

export const COLLECTOR_GROUPS = [
  { name: '기본 시스템', collectors: ['CPU', 'Memory', 'Uptime'] },
  { name: '디스크', collectors: ['Disk', 'StorageSmart'] },
  { name: '네트워크', collectors: ['Network'] },
  { name: '하드웨어 센서', collectors: ['Temperature', 'Fan', 'GPU', 'Voltage', 'MotherboardTemp'] },
  { name: '프로세스 순위', collectors: ['CPUProcess', 'MemoryProcess'] },
  { name: '프로세스 감시', collectors: ['ProcessWatch'] }
]

/**
 * { Collectors: { CPU: {...}, ... } } -> flat { CPU: {...}, ... }
 * 누락된 Collector는 기본값으로 채우고, 특수 필드도 기본값으로 채웁니다.
 */
export function parseMonitorInput(config) {
  const collectors = (config && config.Collectors) || {}
  const result = {}

  for (const name of COLLECTOR_NAMES) {
    const defaults = COLLECTOR_DEFAULTS[name]
    const raw = collectors[name] || {}

    // 공통 필드: Enabled, Interval (+ COLLECTOR_DEFAULTS의 TopN 등)
    const entry = { ...defaults, ...raw }

    // 특수 필드 기본값 채우기
    const specialFields = COLLECTOR_SPECIAL_FIELDS[name]
    if (specialFields) {
      for (const [fieldName, fieldDef] of Object.entries(specialFields)) {
        if (!(fieldName in entry)) {
          entry[fieldName] = Array.isArray(fieldDef.default)
            ? [...fieldDef.default]
            : fieldDef.default
        }
      }
    }

    result[name] = entry
  }

  return result
}

/**
 * flat { CPU: {...}, ... } -> { Collectors: { CPU: {...}, ... } }
 * 타입 강제 변환: TopN -> number, Enabled -> boolean
 */
export function buildMonitorOutput(formData) {
  const d = formData || {}
  const collectors = {}

  for (const [name, config] of Object.entries(d)) {
    const entry = { ...config }

    // Enabled -> boolean
    if ('Enabled' in entry) {
      entry.Enabled = Boolean(entry.Enabled)
    }

    // TopN -> number (CPUProcess, MemoryProcess)
    if ('TopN' in entry) {
      entry.TopN = Number(entry.TopN)
    }

    collectors[name] = entry
  }

  return { Collectors: collectors }
}
