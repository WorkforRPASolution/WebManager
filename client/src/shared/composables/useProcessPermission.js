import { computed } from 'vue'
import { useProcessFilterStore } from '../stores/processFilter'

/**
 * Process Permission Facade Composable
 *
 * processFilterStore의 권한 로직을 단순화하여 제공합니다.
 * 필터바에서 반복되는 권한 체크 코드를 캡슐화합니다.
 */
export function useProcessPermission() {
  const processFilterStore = useProcessFilterStore()

  /**
   * 전체 Process 조회 가능 여부
   * - authorityManager === 1 (Admin)
   * - processes 배열에 "MASTER" 포함
   */
  const canViewAll = computed(() => processFilterStore.canViewAllProcesses)

  /**
   * 사용자의 process 권한 목록 반환
   * @returns {string[]} process 목록 배열
   */
  const getUserProcesses = () => processFilterStore.getUserProcessList()

  /**
   * 권한 필터링된 Process 목록 반환
   * @param {string} source - API 소스 ('clients' | 'users' | 'emailTemplate' 등)
   * @returns {string[]} 필터링된 Process 목록
   */
  const getFilteredProcesses = (source) => processFilterStore.getFilteredProcesses(source)

  /**
   * API 파라미터용 userProcesses 생성
   * 관리자/MASTER는 null 반환 (전체 조회)
   * 일반 사용자는 자신의 process 목록 반환
   * @returns {string[] | null}
   */
  const buildUserProcessFilter = () => {
    return canViewAll.value ? null : getUserProcesses()
  }

  /**
   * Process 목록을 캐시에 저장
   * @param {string} source - API 소스
   * @param {string[]} processes - Process 목록
   */
  const setProcesses = (source, processes) => {
    processFilterStore.setProcesses(source, processes)
  }

  return {
    // Computed
    canViewAll,

    // Methods
    getUserProcesses,
    getFilteredProcesses,
    buildUserProcessFilter,
    setProcesses
  }
}
