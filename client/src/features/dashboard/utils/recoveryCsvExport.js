/**
 * Recovery Dashboard CSV 내보내기 유틸리티
 */
import { downloadCsv } from './csvExport'
import { sumByGroup, sumAllMain } from './recoveryStatusGroups'

/**
 * Recovery Overview KPI + Trend 데이터를 CSV로 내보내기
 * @param {Object} kpi - { total, success, failed, stopped, skip, successRate }
 * @param {Array} trend - [{ bucket, statusCounts }]
 */
export function exportRecoveryOverviewCsv(kpi, trend) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `Recovery_Overview_${timestamp}.csv`

  const headers = ['시간', 'Success', 'Failed', 'Stopped', 'Skip', 'Other', 'Total']
  const rows = (trend || []).map(t => {
    const sc = t.statusCounts || {}
    const success = sc.Success || 0
    const failed = sumByGroup(sc, 'failed')
    const stopped = sc.Stopped || 0
    const skip = sc.Skip || 0
    const total = Object.values(sc).reduce((s, v) => s + v, 0)
    const other = total - sumAllMain(sc)
    return [t.bucket, success, failed, stopped, skip, other, total]
  })

  // KPI 요약행 추가
  if (kpi) {
    rows.unshift(['[KPI 요약]', kpi.success || 0, kpi.failed || 0, kpi.stopped || 0, kpi.skip || 0, '', kpi.total || 0])
  }

  downloadCsv(filename, headers, rows)
}

/**
 * Recovery by Process 데이터를 CSV로 내보내기
 * @param {Array} processes - [{ process, total, success, failed, stopped, skip, successRate }]
 */
export function exportRecoveryByProcessCsv(processes) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `Recovery_ByProcess_${timestamp}.csv`

  const headers = ['Process', 'Total', 'Success', 'Failed', 'Stopped', 'Skip', 'Success Rate']
  const rows = (processes || []).map(p => [
    p.process,
    p.total || 0,
    p.success || 0,
    p.failed || 0,
    p.stopped || 0,
    p.skip || 0,
    p.successRate != null ? `${p.successRate.toFixed(1)}%` : '0%'
  ])

  downloadCsv(filename, headers, rows)
}

/**
 * Recovery Analysis 데이터를 CSV로 내보내기
 * @param {Object} data - Analysis 데이터
 * @param {string} tab - 현재 탭 (scenario, equipment, trigger)
 */
export function exportRecoveryAnalysisCsv(data, tab) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `Recovery_Analysis_${tab}_${timestamp}.csv`

  if (tab === 'scenario') {
    const headers = ['Scenario', 'Total', 'Success', 'Failed', 'Success Rate']
    const rows = (data || []).map(d => [
      d.name || d.scenario,
      d.total || d.count || 0,
      d.success || 0,
      d.failed || 0,
      d.successRate != null ? `${d.successRate.toFixed(1)}%` : '0%'
    ])
    downloadCsv(filename, headers, rows)
  } else if (tab === 'equipment') {
    const headers = ['Equipment', 'Total', 'Success', 'Failed', 'Success Rate']
    const rows = (data || []).map(d => [
      d.name || d.eqpId,
      d.total || d.count || 0,
      d.success || 0,
      d.failed || 0,
      d.successRate != null ? `${d.successRate.toFixed(1)}%` : '0%'
    ])
    downloadCsv(filename, headers, rows)
  } else if (tab === 'trigger') {
    const headers = ['Trigger', 'Total', 'Percentage']
    const rows = (data || []).map(d => [
      d.trigger_by || d.name,
      d.total || d.count || 0,
      d.percentage != null ? `${d.percentage.toFixed(1)}%` : ''
    ])
    downloadCsv(filename, headers, rows)
  }
}

/**
 * Recovery History 데이터를 CSV로 내보내기
 * @param {Array} data - EQP_AUTO_RECOVERY documents [{ create_date, process, line, model, eqpid, ears_code, status, trigger_by, ... }]
 */
export function exportRecoveryHistoryCsv(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `Recovery_History_${timestamp}.csv`

  const headers = ['Timestamp', 'Process', 'Line', 'Model', 'EqpId', 'Scenario', 'Status', 'Trigger']
  const rows = (data || []).map(d => [
    d.create_date || '',
    d.process || '',
    d.line || '',
    d.model || '',
    d.eqpid || '',
    d.ears_code || '',
    d.status || '',
    d.trigger_by || ''
  ])

  downloadCsv(filename, headers, rows)
}
