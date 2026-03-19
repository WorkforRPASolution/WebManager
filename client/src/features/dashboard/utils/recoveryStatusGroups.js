/**
 * Recovery Status 그룹 분류 및 계산 유틸리티
 */

export const STATUS_GROUPS = {
  success: ['Success'],
  failed: ['Failed', 'ScriptFailed', 'VisionDelayed', 'NotStarted'],
  stopped: ['Stopped'],
  skip: ['Skip'],
  pending: ['Wait', 'StartPending'],
  retry: ['Retry']
}

/**
 * statusCounts에서 특정 그룹에 속하는 상태들의 합계 계산
 * @param {Object} statusCounts - { Success: N, Failed: N, ... }
 * @param {string} group - 그룹 키 (success, failed, stopped, skip, pending, retry)
 * @returns {number}
 */
export function sumByGroup(statusCounts, group) {
  return STATUS_GROUPS[group]?.reduce((sum, s) => sum + (statusCounts[s] || 0), 0) || 0
}

/**
 * 성공률 계산: Success / Total * 100
 * @param {Object} statusCounts - { Success: N, ... }
 * @param {number} total - 전체 수
 * @returns {number} 백분율 (0~100)
 */
/**
 * 주요 4그룹(success/failed/stopped/skip) 합계
 * @param {Object} statusCounts
 * @returns {number}
 */
export function sumAllMain(statusCounts) {
  return ['success', 'failed', 'stopped', 'skip'].reduce(
    (sum, group) => sum + sumByGroup(statusCounts, group), 0
  )
}

export function calcSuccessRate(statusCounts, total) {
  if (!total) return 0
  return ((statusCounts?.Success || 0) / total * 100)
}
