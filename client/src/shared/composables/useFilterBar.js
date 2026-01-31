import { ref, computed } from 'vue'
import { useFilterBookmarks } from './useFilterBookmarks'
import { useProcessPermission } from './useProcessPermission'

/**
 * Filter Bar Composable
 *
 * 필터바의 공통 로직을 추출하여 재사용합니다.
 * - 북마크 관리
 * - 권한 기반 필터링
 * - 공통 핸들러
 *
 * @param {Object} config - 설정 객체
 * @param {string} config.pageKey - 북마크 저장 키 (예: 'clients', 'equipmentInfo')
 * @param {string} config.processSource - Process 권한 소스 (예: 'clients')
 * @param {Object} config.filterFields - 필터 필드 정의
 * @param {Function} config.fetchModelsForProcesses - Process 선택 시 Model 목록 조회 함수
 * @param {Object} config.api - API 객체 (getProcesses, getModels 함수 포함)
 */
export function useFilterBar(config) {
  const {
    pageKey,
    processSource = 'clients',
    filterFields,
    fetchModelsForProcesses,
    api
  } = config

  // Composables
  const { bookmarks, add: addBookmark, remove: removeBookmark } = useFilterBookmarks(pageKey)
  const { canViewAll, getFilteredProcesses, buildUserProcessFilter, setProcesses } = useProcessPermission()

  // State
  const processes = ref([])
  const allModels = ref([])
  const filteredModels = ref([])

  /**
   * Process 목록 조회 및 캐시
   */
  const fetchProcesses = async () => {
    try {
      const response = await api.getProcesses()
      setProcesses(processSource, response.data)
      processes.value = getFilteredProcesses(processSource)
    } catch (error) {
      console.error('Failed to fetch processes:', error)
    }
  }

  /**
   * 전체 Model 목록 조회
   * @param {boolean} applyPermissionFilter - 권한 필터 적용 여부
   */
  const fetchAllModels = async (applyPermissionFilter = false) => {
    try {
      const userProcesses = applyPermissionFilter ? buildUserProcessFilter() : null
      const response = await api.getModels(null, userProcesses)
      allModels.value = response.data
    } catch (error) {
      console.error('Failed to fetch all models:', error)
    }
  }

  /**
   * 선택된 Process에 해당하는 Model 목록 조회
   * @param {string[]} processArray - 선택된 Process 배열
   */
  const fetchModelsForSelectedProcesses = async (processArray) => {
    if (!processArray || processArray.length === 0) {
      filteredModels.value = []
      return
    }
    try {
      const response = await api.getModels(processArray.join(','))
      filteredModels.value = response.data
    } catch (error) {
      console.error('Failed to fetch models:', error)
    }
  }

  /**
   * 검색 필터 객체 생성 (userProcesses 포함)
   * @param {Object} filters - 현재 필터 상태
   * @returns {Object} API 호출용 필터 객체
   */
  const buildSearchFilters = (filters) => {
    return {
      ...filters,
      userProcesses: buildUserProcessFilter()
    }
  }

  /**
   * 북마크 저장 핸들러
   * @param {string} name - 북마크 이름
   * @param {Object} filters - 현재 필터 상태
   */
  const handleSaveBookmark = (name, filters) => {
    addBookmark(name, filters)
  }

  /**
   * 북마크 삭제 핸들러
   * @param {string} id - 북마크 ID
   */
  const handleDeleteBookmark = (id) => {
    removeBookmark(id)
  }

  /**
   * 필터 초기화 및 데이터 조회
   * @param {boolean} applyPermissionFilter - Model 조회 시 권한 필터 적용 여부
   */
  const refreshFilters = async (applyPermissionFilter = false) => {
    await Promise.all([
      fetchProcesses(),
      fetchAllModels(applyPermissionFilter)
    ])
  }

  /**
   * 선택된 Process가 변경되었을 때 호출
   * Model 목록을 다시 조회하고, 현재 선택된 Model 중 유효하지 않은 것을 제거
   * @param {string[]} newProcesses - 새로 선택된 Process 배열
   * @param {Object} selectedModels - 현재 선택된 Model ref
   */
  const handleProcessChange = async (newProcesses, selectedModels) => {
    await fetchModelsForSelectedProcesses(newProcesses)

    // 선택된 Model 중 더 이상 유효하지 않은 것 제거
    if (newProcesses.length > 0) {
      selectedModels.value = selectedModels.value.filter(m => filteredModels.value.includes(m))
    }
  }

  /**
   * 필터바에서 사용할 availableModels computed
   * Process가 선택되면 filteredModels, 아니면 allModels
   * @param {Ref<string[]>} selectedProcesses - 선택된 Process ref
   * @returns {ComputedRef<string[]>}
   */
  const getAvailableModels = (selectedProcesses) => {
    return computed(() => {
      if (selectedProcesses.value.length > 0) {
        return filteredModels.value
      }
      return allModels.value
    })
  }

  return {
    // State
    processes,
    allModels,
    filteredModels,

    // Bookmarks
    bookmarks,
    handleSaveBookmark,
    handleDeleteBookmark,

    // Permission
    canViewAll,
    buildUserProcessFilter,
    buildSearchFilters,

    // Data fetching
    fetchProcesses,
    fetchAllModels,
    fetchModelsForSelectedProcesses,
    refreshFilters,

    // Handlers
    handleProcessChange,
    getAvailableModels
  }
}
