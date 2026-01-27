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
export const useProcessFilterStore = defineStore('processFilter', () => {
  const authStore = useAuthStore()

  // 캐시된 전체 Process 목록 (API 소스별)
  const allProcesses = ref({
    clients: [],       // EQP_INFO (Clients, Master)
    users: [],         // ARS_USER_INFO
    emailTemplate: []  // EMAIL_TEMPLATE
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
    if (Array.isArray(user.processes) && user.processes.includes('MASTER')) return true

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
    const userProcesses = authStore.user?.processes || []
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
      emailTemplate: []
    }
  }

  return {
    // State
    allProcesses,

    // Getters
    canViewAllProcesses,

    // Methods
    getFilteredProcesses,
    setProcesses,
    clearCache
  }
})
