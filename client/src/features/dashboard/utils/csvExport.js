/**
 * 데이터를 CSV 문자열로 변환 후 파일 다운로드
 * @param {string} filename - 파일명 (확장자 포함)
 * @param {string[]} headers - 컬럼 헤더
 * @param {Array<Array>} rows - 행 데이터 (2차원 배열)
 */
export function downloadCsv(filename, headers, rows) {
  const bom = '\uFEFF' // UTF-8 BOM (Excel 한글 깨짐 방지)
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const str = String(cell ?? '')
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(','))
  ].join('\n')

  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * ARSAgent Status 데이터를 CSV로 내보내기
 */
export function exportMonitorCsv(data, groupByModel) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `ARSAgent_Monitor_${timestamp}.csv`

  const headers = groupByModel
    ? ['Process', 'Model', 'Agent Count', 'Running', 'Stopped', 'Never Started', 'Rate']
    : ['Process', 'Agent Count', 'Running', 'Stopped', 'Never Started', 'Rate']

  const rows = data.map(row => {
    const neverStarted = row.agentCount - row.runningCount - (row.stoppedCount || 0)
    const rate = row.agentCount > 0 ? ((row.runningCount / row.agentCount) * 100).toFixed(0) + '%' : '—'
    const base = [row.agentCount, row.runningCount, row.stoppedCount || 0, neverStarted, rate]
    return groupByModel
      ? [row.process, row.eqpModel, ...base]
      : [row.process, ...base]
  })

  downloadCsv(filename, headers, rows)
}

/**
 * ARSAgent Version 데이터를 CSV로 내보내기
 */
export function exportVersionCsv(data, allVersions, groupByModel) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `ARSAgent_Version_${timestamp}.csv`

  const headers = groupByModel
    ? ['Process', 'Model', 'Version', 'Count', 'Rate']
    : ['Process', 'Version', 'Count', 'Rate']

  const rows = []
  for (const row of data) {
    const versions = allVersions.filter(v => (row.versionCounts?.[v] || 0) > 0)
    for (const ver of versions) {
      const count = row.versionCounts[ver]
      const rate = row.agentCount > 0 ? ((count / row.agentCount) * 100).toFixed(0) + '%' : '—'
      rows.push(groupByModel
        ? [row.process, row.eqpModel, ver, count, rate]
        : [row.process, ver, count, rate]
      )
    }
  }

  downloadCsv(filename, headers, rows)
}
