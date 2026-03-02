import { parseGoDuration } from '../shared/formatUtils'

/**
 * Monitor.json 설정의 요약 설명을 생성합니다.
 * 입력은 원본 네스트 구조 { Collectors: { ... } } 입니다.
 *
 * @param {Object|null} config - Monitor.json 설정 객체
 * @returns {string} 요약 설명 문자열
 */
export function describeMonitor(config) {
  if (!config) return '설정 없음'

  const collectors = config.Collectors
  if (!collectors || Object.keys(collectors).length === 0) return '설정 없음'

  const lines = []
  const names = Object.keys(collectors)
  const total = names.length
  const activeNames = names.filter(n => collectors[n].Enabled)
  const inactiveNames = names.filter(n => !collectors[n].Enabled)

  lines.push(`활성 Collector: ${activeNames.length}/${total}개`)

  if (inactiveNames.length > 0) {
    lines.push(`비활성: ${inactiveNames.join(', ')}`)
  }

  // CPUProcess / MemoryProcess 상세
  for (const name of ['CPUProcess', 'MemoryProcess']) {
    const c = collectors[name]
    if (!c || !c.Enabled) continue

    const interval = parseGoDuration(c.Interval) || c.Interval
    const parts = [`Top${c.TopN || 10}`]
    if (c.WatchProcesses && c.WatchProcesses.length > 0) {
      parts.push(`감시: ${c.WatchProcesses.length}개`)
    }
    lines.push(`${name}(${interval}): ${parts.join(', ')}`)
  }

  // ProcessWatch 상세
  const pw = collectors.ProcessWatch
  if (pw && pw.Enabled) {
    const interval = parseGoDuration(pw.Interval) || pw.Interval
    const parts = []
    if (pw.RequiredProcesses && pw.RequiredProcesses.length > 0) {
      parts.push(`필수: ${pw.RequiredProcesses.length}개`)
    }
    if (pw.ForbiddenProcesses && pw.ForbiddenProcesses.length > 0) {
      parts.push(`금지: ${pw.ForbiddenProcesses.length}개`)
    }
    if (parts.length > 0) {
      lines.push(`ProcessWatch(${interval}): ${parts.join(', ')}`)
    }
  }

  return lines.join('\n')
}
