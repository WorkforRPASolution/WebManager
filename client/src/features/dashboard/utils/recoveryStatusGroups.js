/**
 * Recovery status 그룹 분류
 * 원본 status 문자열을 5개 그룹으로 매핑
 */
const STATUS_GROUP_MAP = {
  'Success':  'Success',
  'SUCCESS':  'Success',
  'success':  'Success',
  'Failed':   'Failed',
  'FAILED':   'Failed',
  'failed':   'Failed',
  'Fail':     'Failed',
  'FAIL':     'Failed',
  'Error':    'Failed',
  'ERROR':    'Failed',
  'Stopped':  'Stopped',
  'STOPPED':  'Stopped',
  'stopped':  'Stopped',
  'Stop':     'Stopped',
  'STOP':     'Stopped',
  'Skip':     'Skip',
  'SKIP':     'Skip',
  'skip':     'Skip',
  'Skipped':  'Skip',
  'SKIPPED':  'Skip'
}

/**
 * 원본 status를 그룹으로 매핑
 * @param {string} rawStatus
 * @returns {string} 'Success' | 'Failed' | 'Stopped' | 'Skip' | 'Other'
 */
export function groupStatus(rawStatus) {
  if (!rawStatus) return 'Other'
  return STATUS_GROUP_MAP[rawStatus] || 'Other'
}

/**
 * statusCounts 객체에서 총합 계산
 * @param {Object} statusCounts - { Success: n, Failed: n, ... }
 * @returns {number}
 */
export function totalFromCounts(statusCounts) {
  if (!statusCounts) return 0
  return Object.values(statusCounts).reduce((sum, v) => sum + (v || 0), 0)
}

/**
 * 성공률 계산
 * @param {Object} statusCounts
 * @returns {number} 0~100
 */
export function successRate(statusCounts) {
  const total = totalFromCounts(statusCounts)
  if (total === 0) return 0
  return Math.round(((statusCounts.Success || 0) / total) * 100)
}
