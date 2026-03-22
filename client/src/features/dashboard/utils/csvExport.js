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
 * ARSAgent Status 상세 데이터를 CSV로 내보내기 (설비별)
 */
export function exportMonitorDetailCsv(details) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `ARSAgent_Monitor_Detail_${timestamp}.csv`
  const headers = ['Process', 'Model', 'Eqp ID', 'Status']
  const rows = details.map(d => [d.process, d.eqpModel, d.eqpId, d.status])
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

/**
 * ARSAgent Version 상세 데이터를 CSV로 내보내기 (설비별)
 */
export function exportVersionDetailCsv(details) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `ARSAgent_Version_Detail_${timestamp}.csv`
  const headers = ['Process', 'Model', 'Eqp ID', 'Version']
  const rows = details.map(d => [d.process, d.eqpModel, d.eqpId, d.version])
  downloadCsv(filename, headers, rows)
}

// ===================================================
// ResourceAgent CSV Export Functions
// ===================================================

/**
 * ResourceAgent Status 요약 CSV (5상태)
 */
export function exportResourceAgentStatusCsv(data, groupByModel) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `ResourceAgent_Status_${timestamp}.csv`

  const headers = groupByModel
    ? ['Process', 'Model', 'Agent Count', 'OK', 'WARN', 'SHUTDOWN', 'Stopped', 'Never Started', 'Rate']
    : ['Process', 'Agent Count', 'OK', 'WARN', 'SHUTDOWN', 'Stopped', 'Never Started', 'Rate']

  const rows = data.map(row => {
    const neverStarted = row.agentCount - row.okCount - row.warnCount - row.shutdownCount - (row.stoppedCount || 0)
    const active = row.okCount + row.warnCount
    const rate = row.agentCount > 0 ? ((active / row.agentCount) * 100).toFixed(0) + '%' : '—'
    const base = [row.agentCount, row.okCount, row.warnCount, row.shutdownCount, row.stoppedCount || 0, neverStarted, rate]
    return groupByModel
      ? [row.process, row.eqpModel, ...base]
      : [row.process, ...base]
  })

  downloadCsv(filename, headers, rows)
}

/**
 * ResourceAgent Status 상세 CSV (설비별)
 */
export function exportResourceAgentStatusDetailCsv(details) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `ResourceAgent_Status_Detail_${timestamp}.csv`
  const headers = ['Process', 'Model', 'Eqp ID', 'Status']
  const rows = details.map(d => [d.process, d.eqpModel, d.eqpId, d.status])
  downloadCsv(filename, headers, rows)
}

/**
 * ResourceAgent Version 요약 CSV
 */
export function exportResourceAgentVersionCsv(data, allVersions, groupByModel) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `ResourceAgent_Version_${timestamp}.csv`

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

/**
 * ResourceAgent Version 상세 CSV (설비별)
 */
export function exportResourceAgentVersionDetailCsv(details) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `ResourceAgent_Version_Detail_${timestamp}.csv`
  const headers = ['Process', 'Model', 'Eqp ID', 'Version']
  const rows = details.map(d => [d.process, d.eqpModel, d.eqpId, d.version])
  downloadCsv(filename, headers, rows)
}

// ===================================================
// Tool Usage CSV Export Functions
// ===================================================

/**
 * 공정별 사용 현황 CSV
 */
export function exportToolUsageProcessCsv(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `ToolUsage_Process_${timestamp}.csv`
  const headers = ['Process', 'Total Users', 'Active Users', 'Inactive Users', 'Usage Rate(%)']
  const rows = data.map(d => [
    d.process,
    d.totalUsers,
    d.activeUsers,
    d.totalUsers - d.activeUsers,
    (d.usageRate || 0).toFixed(1)
  ])
  downloadCsv(filename, headers, rows)
}

/**
 * 최근 실행 사용자 CSV (전체 목록)
 * @param {Array} data - recentUsers 전체 배열 (noLimit 호출 결과)
 */
export function exportToolUsageRecentUsersCsv(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `ToolUsage_RecentUsers_${timestamp}.csv`
  const headers = ['#', 'Name', 'User ID', 'Process', 'Access Count', 'Latest Execution']
  const rows = data.map((d, i) => [i + 1, d.name, d.singleid, d.process, d.accessnum, d.latestExecution || ''])
  downloadCsv(filename, headers, rows)
}

// ===================================================
// Scenario CSV Export Functions
// ===================================================

/**
 * 공정별 시나리오 현황 CSV
 */
export function exportScenarioProcessCsv(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `Scenario_Process_${timestamp}.csv`
  const headers = ['Process', 'Total', 'Active', 'Inactive', 'Active Rate(%)']
  const rows = data.map(d => {
    const rate = d.total > 0 ? ((d.active / d.total) * 100).toFixed(1) : '0.0'
    return [d.process, d.total, d.active, d.inactive, rate]
  })
  downloadCsv(filename, headers, rows)
}

/**
 * 공정별 시나리오 상세 CSV (시나리오별)
 */
export function exportScenarioProcessDetailCsv(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `Scenario_Process_Detail_${timestamp}.csv`
  const headers = ['Process', 'Model', 'Scenario', 'Active']
  const rows = data.map(d => [d.process, d.eqpModel, d.scname, d.isEnabled ? 'Y' : 'N'])
  downloadCsv(filename, headers, rows)
}

/**
 * 공정별 성과 입력률 CSV
 */
export function exportScenarioPerformanceCsv(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `Scenario_Performance_${timestamp}.csv`
  const headers = ['Process', 'Total', 'Filled', 'Unfilled', 'Fill Rate(%)']
  const rows = data.map(d => {
    const unfilled = (d.total || 0) - (d.performanceFilled || 0)
    return [d.process, d.total || 0, d.performanceFilled || 0, unfilled, (d.performanceRate || 0).toFixed(1)]
  })
  downloadCsv(filename, headers, rows)
}

/**
 * 공정별 성과 입력 상세 CSV (시나리오별)
 */
export function exportScenarioPerformanceDetailCsv(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `Scenario_Performance_Detail_${timestamp}.csv`
  const headers = ['Process', 'Model', 'Scenario', 'Performance Data']
  const rows = data.map(d => [d.process, d.eqpModel, d.scname, d.performanceFilled ? 'Y' : 'N'])
  downloadCsv(filename, headers, rows)
}

/**
 * 최근 수정 이력 CSV (전체 목록)
 */
export function exportScenarioRecentCsv(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `Scenario_RecentModifications_${timestamp}.csv`
  const headers = ['#', 'Scenario', 'Process', 'Model', 'Name', 'Author ID', 'Modified At']
  const rows = data.map((d, i) => [i + 1, d.scname, d.process, d.eqpModel, d.name || '', d.userId, d.modifiedAt])
  downloadCsv(filename, headers, rows)
}

// ===================================================
// WebManager CSV Export Functions
// ===================================================

function formatDurationCsv(ms) {
  if (!ms || ms <= 0) return '0s'
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}m ${sec}s`
}

/**
 * 페이지별 방문 현황 CSV
 */
export function exportWebManagerPageSummaryCsv(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `WebManager_PageSummary_${timestamp}.csv`
  const headers = ['Menu Group', 'Page', 'Path', 'Visits', 'Unique Users', 'Avg Duration']
  const rows = data.map(d => [
    d.menuGroup, d.pageName, d.pagePath, d.visitCount, d.uniqueUsers, formatDurationCsv(d.avgDurationMs)
  ])
  downloadCsv(filename, headers, rows)
}

/**
 * Top 10 활성 사용자 CSV
 */
export function exportWebManagerTopUsersCsv(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `WebManager_TopUsers_${timestamp}.csv`
  const headers = ['#', 'Name', 'User ID', 'Visits', 'Total Duration', 'Last Visit']
  const rows = data.map((d, i) => [
    i + 1, d.name || '', d.userId, d.visitCount, formatDurationCsv(d.totalDurationMs),
    d.lastVisitTime ? new Date(d.lastVisitTime).toISOString() : ''
  ])
  downloadCsv(filename, headers, rows)
}

/**
 * 공정별 활성 사용자 추이 CSV
 */
export function exportWebManagerProcessTrendCsv(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `WebManager_ProcessTrend_${timestamp}.csv`

  if (!data || data.length === 0) return

  // 동적 컬럼: date + 각 공정명
  const processNames = new Set()
  for (const row of data) {
    for (const key of Object.keys(row)) {
      if (key !== 'date') processNames.add(key)
    }
  }
  const sorted = [...processNames].sort()
  const headers = ['Date', ...sorted]
  const rows = data.map(d => [d.date, ...sorted.map(p => d[p] || 0)])
  downloadCsv(filename, headers, rows)
}

/**
 * 최근 접속 이력 CSV
 */
export function exportWebManagerRecentVisitsCsv(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const filename = `WebManager_RecentVisits_${timestamp}.csv`
  const headers = ['#', 'Name', 'User ID', 'Page', 'Path', 'Duration', 'Enter Time']
  const rows = data.map((d, i) => [
    i + 1, d.name || '', d.userId, d.pageName || d.pagePath, d.pagePath,
    formatDurationCsv(d.durationMs),
    d.enterTime ? new Date(d.enterTime).toISOString() : ''
  ])
  downloadCsv(filename, headers, rows)
}
