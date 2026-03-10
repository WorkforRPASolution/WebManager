/**
 * 4-state 서비스 상태 분류 순수 함수
 * @param {object|null|undefined} serviceStatus - { running, state, loading, error }
 * @returns {'running'|'stopped'|'unreachable'|'not_installed'|'loading'|'unknown'}
 */
export function classifyServiceState(serviceStatus) {
  if (!serviceStatus) return 'unknown'
  if (serviceStatus.loading === true) return 'loading'
  if (serviceStatus.error) return 'unknown'
  if (serviceStatus.state === 'UNREACHABLE') return 'unreachable'
  if (serviceStatus.state === 'NOT_INSTALLED') return 'not_installed'
  if (serviceStatus.running === true) return 'running'
  if (serviceStatus.running === false) return 'stopped'
  return 'unknown'
}
