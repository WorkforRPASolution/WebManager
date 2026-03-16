import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  exportMonitorDetailCsv,
  exportVersionDetailCsv,
} from './csvExport'

// DOM API 모킹
let lastBlobContent = ''
const mockLink = { href: '', download: '', click: vi.fn() }

beforeEach(() => {
  lastBlobContent = ''
  mockLink.click.mockClear()

  vi.stubGlobal('Blob', class {
    constructor([content]) { lastBlobContent = content }
  })
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn(),
  })
  vi.stubGlobal('document', {
    createElement: vi.fn(() => mockLink),
  })
})

describe('exportMonitorDetailCsv', () => {
  it('설비별 상세 CSV 생성 (Process, Model, Eqp ID, Status)', () => {
    const details = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001', status: 'Running' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-002', status: 'Stopped' },
      { process: 'ETCH', eqpModel: 'E1', eqpId: 'EQP-003', status: 'Never Started' },
    ]

    exportMonitorDetailCsv(details)

    const csv = lastBlobContent.replace('\uFEFF', '')
    const lines = csv.split('\n')

    expect(lines[0]).toBe('Process,Model,Eqp ID,Status')
    expect(lines[1]).toBe('CVD,M1,EQP-001,Running')
    expect(lines[2]).toBe('CVD,M1,EQP-002,Stopped')
    expect(lines[3]).toBe('ETCH,E1,EQP-003,Never Started')
    expect(lines).toHaveLength(4)
    expect(mockLink.click).toHaveBeenCalled()
  })

  it('빈 배열 → 헤더만', () => {
    exportMonitorDetailCsv([])

    const csv = lastBlobContent.replace('\uFEFF', '')
    const lines = csv.split('\n')

    expect(lines[0]).toBe('Process,Model,Eqp ID,Status')
    expect(lines).toHaveLength(1)
  })
})

describe('exportVersionDetailCsv', () => {
  it('설비별 상세 CSV 생성 (Process, Model, Eqp ID, Version)', () => {
    const details = [
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-001', version: '7.0.0.0' },
      { process: 'CVD', eqpModel: 'M1', eqpId: 'EQP-002', version: '6.8.5.24' },
      { process: 'ETCH', eqpModel: 'E1', eqpId: 'EQP-003', version: 'Unknown' },
    ]

    exportVersionDetailCsv(details)

    const csv = lastBlobContent.replace('\uFEFF', '')
    const lines = csv.split('\n')

    expect(lines[0]).toBe('Process,Model,Eqp ID,Version')
    expect(lines[1]).toBe('CVD,M1,EQP-001,7.0.0.0')
    expect(lines[2]).toBe('CVD,M1,EQP-002,6.8.5.24')
    expect(lines[3]).toBe('ETCH,E1,EQP-003,Unknown')
    expect(lines).toHaveLength(4)
  })
})
