import { downloadCsv } from './csvExport'

/**
 * Recovery Analysis 테이블 데이터 CSV 내보내기
 * @param {Array} data - 분석 데이터
 * @param {string} tab - 'scenario' | 'equipment' | 'trigger'
 */
export function exportRecoveryAnalysisCsv(data, tab) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `Recovery_Analysis_${tab}_${timestamp}.csv`

  let headers
  if (tab === 'scenario') {
    headers = ['ears_code', 'Process', 'Model', 'Total', 'Success', 'Failed', 'Stopped', 'Skip', 'Other', '성공률']
  } else if (tab === 'equipment') {
    headers = ['eqpid', 'Process', 'Model', 'Total', 'Success', 'Failed', 'Stopped', 'Skip', 'Other', '성공률']
  } else {
    headers = ['trigger_by', 'Total', 'Success', 'Failed', 'Stopped', 'Skip', 'Other', '성공률']
  }

  const rows = data.map(row => {
    const sc = row.statusCounts || {}
    const total = row.total || 0
    const rate = total > 0 ? Math.round(((sc.Success || 0) / total) * 100) + '%' : '0%'
    const base = [total, sc.Success || 0, sc.Failed || 0, sc.Stopped || 0, sc.Skip || 0, sc.Other || 0, rate]

    if (tab === 'scenario') {
      return [row.name || row.ears_code, row.process || '', row.model || '', ...base]
    } else if (tab === 'equipment') {
      return [row.name || row.eqpid, row.process || '', row.model || '', ...base]
    } else {
      return [row.name || row.trigger_by, ...base]
    }
  })

  downloadCsv(filename, headers, rows)
}

/**
 * Recovery History 데이터 CSV 내보내기
 * @param {Array} data - 이력 데이터
 * @param {string} mode - 'eqpid' | 'ears_code'
 * @param {string} targetId - 대상 ID
 */
export function exportRecoveryHistoryCsv(data, mode, targetId) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `Recovery_History_${targetId}_${timestamp}.csv`

  const headers = ['create_date', 'eqpid', 'ears_code', 'status', 'trigger_by', 'retry', 'process', 'model', 'line']

  const rows = data.map(row => [
    row.create_date || '',
    row.eqpid || '',
    row.ears_code || '',
    row.status || '',
    row.trigger_by || '',
    row.retry ?? '',
    row.process || '',
    row.model || '',
    row.line || ''
  ])

  downloadCsv(filename, headers, rows)
}
