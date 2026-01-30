import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

/**
 * Process Filter Store
 *
 * 사용자 권한에 따라 Process 필터 옵션을 제한합니다.
 *
 * 전체 조회 조건 (아래 중 하나 만족 시):
 * - authorityManager >= 1 (관리자)
 * - processes 배열에 "MASTER" 포함
 *
 * 일반 사용자: 자신의 processes 필드에 있는 Process만 표시
 */

/**
 * 사용자의 process 권한 목록을 배열로 반환
 * - processes 배열이 있으면 사용
 * - 없거나 비어있으면 process 문자열에서 파싱 (세미콜론 구분)
 * @param {Object} user - 사용자 객체
 * @returns {string[]} process 목록 배열
 */
function getUserProcesses(user) {
  if (!user) return []

  // processes 배열이 있고 비어있지 않으면 사용
  if (Array.isArray(user.processes) && user.processes.length > 0) {
    return [...user.processes]  // Proxy를 일반 배열로 변환
  }

  // processes가 없거나 비어있으면 process 문자열에서 파싱
  if (user.process && typeof user.process === 'string') {
    return user.process.split(';').map(p => p.trim()).filter(Boolean)
  }

  return []
}

export const useProcessFilterStore = defineStore('processFilter', () => {
  const authStore = useAuthStore()

  // 캐시된 전체 Process 목록 (API 소스별)
  const allProcesses = ref({
    clients: [],         // EQP_INFO (Clients, Master)
    users: [],           // ARS_USER_INFO
    emailTemplate: [],   // EMAIL_TEMPLATE
    emailRecipients: [], // EMAIL_RECIPIENTS
    emailInfo: []        // EMAILINFO (category에서 추출)
  })

  /**
   * 전체 Process 조회 가능 여부
   * - authorityManager === 1 (Admin)
   * - processes 배열에 "MASTER" 포함
   */
  const canViewAllProcesses = computed(() => {
    const user = authStore.user
    if (!user) return false

    // 조건 1: 관리자 (authorityManager == 1)
    // authorityManager: 1=Admin, 2=Conductor, 3=Manager/User
    // == 사용: API에서 문자열 "1"로 올 수 있음
    if (user.authorityManager == 1) return true

    // 조건 2: MASTER 권한 보유
    const userProcesses = getUserProcesses(user)
    if (userProcesses.includes('MASTER')) return true

    return false
  })

  /**
   * 사용자 권한에 따라 필터링된 Process 목록 반환
   * @param {string} source - API 소스 ('clients' | 'users' | 'emailTemplate')
   * @returns {string[]} 필터링된 Process 목록
   */
  const getFilteredProcesses = (source) => {
    const all = allProcesses.value[source] || []

    // 전체 조회 가능하면 모든 Process 반환
    if (canViewAllProcesses.value) return all

    // 일반 사용자는 자신의 processes만 반환
    // processes 배열이 비어있으면 process 문자열에서 파싱
    const userProcesses = getUserProcesses(authStore.user)

    // DB에 실제 있는 프로세스 중 사용자 권한에 해당하는 것만 반환
    // 교집합이 비어있으면 빈 목록 반환 (사용자 process 목록 반환 금지)
    return all.filter(p => userProcesses.includes(p))
  }

  /**
   * API 응답을 캐시에 저장
   * @param {string} source - API 소스
   * @param {string[]} processes - Process 목록
   */
  const setProcesses = (source, processes) => {
    if (allProcesses.value.hasOwnProperty(source)) {
      allProcesses.value[source] = processes
    }
  }

  /**
   * 캐시 초기화 (로그아웃 시 호출)
   */
  const clearCache = () => {
    allProcesses.value = {
      clients: [],
      users: [],
      emailTemplate: [],
      emailRecipients: [],
      emailInfo: []
    }
  }

  /**
   * 사용자의 process 권한 목록 반환 (외부에서 사용 가능)
   * - processes 배열이 있으면 사용
   * - 없거나 비어있으면 process 문자열에서 파싱
   * @returns {string[]} process 목록 배열
   */
  const getUserProcessList = () => getUserProcesses(authStore.user)

  return {
    // State
    allProcesses,

    // Getters
    canViewAllProcesses,

    // Methods
    getFilteredProcesses,
    getUserProcessList,
    setProcesses,
    clearCache
  }
})
