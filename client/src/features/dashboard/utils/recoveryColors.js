/**
 * Recovery Analysis 상태별 색상 정의
 */
const STATUS_COLORS = {
  Success: { light: '#22c55e', dark: '#4ade80' },
  Failed:  { light: '#ef4444', dark: '#f87171' },
  Stopped: { light: '#f59e0b', dark: '#fbbf24' },
  Skip:    { light: '#06b6d4', dark: '#22d3ee' },
  Other:   { light: '#9ca3af', dark: '#6b7280' }
}

/**
 * 상태명으로 색상 반환
 * @param {string} status - 상태명 (Success, Failed, Stopped, Skip, Other)
 * @param {boolean} isDark - 다크 모드 여부
 * @returns {string} 색상 코드
 */
export function getStatusColor(status, isDark = false) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.Other
  return isDark ? colors.dark : colors.light
}

/**
 * 모든 상태 목록 반환
 * @returns {string[]}
 */
export function getStatusList() {
  return ['Success', 'Failed', 'Stopped', 'Skip', 'Other']
}

/**
 * 상태별 전체 색상 맵 반환
 * @param {boolean} isDark
 * @returns {Object} { [status]: color }
 */
export function buildStatusColorMap(isDark) {
  const map = {}
  for (const [status, colors] of Object.entries(STATUS_COLORS)) {
    map[status] = isDark ? colors.dark : colors.light
  }
  return map
}
