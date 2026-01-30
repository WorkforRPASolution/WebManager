import api from '../../shared/api'

export const emailInfoApi = {
  // Server-side pagination: returns { data, total, page, pageSize, totalPages }
  getAll: (filters = {}, page = 1, pageSize = 25) => {
    const params = { page, pageSize }
    if (filters.project) params.project = filters.project
    if (filters.category) params.category = filters.category
    if (filters.process) params.process = filters.process
    if (filters.model) params.model = filters.model
    if (filters.account) params.account = filters.account
    // 키워드 검색 시 process 권한 필터링
    if (filters.userProcesses && Array.isArray(filters.userProcesses) && filters.userProcesses.length > 0) {
      params.userProcesses = filters.userProcesses.join(',')
    }
    return api.get('/email-info', { params })
  },

  getProjects: () => api.get('/email-info/projects'),

  getCategories: (project) => {
    const params = project ? { project } : {}
    return api.get('/email-info/categories', { params })
  },

  // Get processes extracted from category (2nd part after "-")
  getProcessesFromCategory: (project, userProcesses) => {
    const params = {}
    if (project) params.project = project
    // Process 권한 필터링
    if (userProcesses && Array.isArray(userProcesses) && userProcesses.length > 0) {
      params.userProcesses = userProcesses.join(',')
    }
    return api.get('/email-info/processes-from-category', { params })
  },

  // Get models extracted from category (3rd part after "-")
  getModelsFromCategory: (project, process, userProcesses) => {
    const params = {}
    if (project) params.project = project
    if (process) params.process = process
    // Process 선택 없이 조회 시 사용자 권한으로 필터링
    if (userProcesses && Array.isArray(userProcesses) && userProcesses.length > 0) {
      params.userProcesses = userProcesses.join(',')
    }
    return api.get('/email-info/models-from-category', { params })
  },

  // Check which categories exist in EMAILINFO collection
  checkCategories: (categories) => api.post('/email-info/check-categories', { categories }),

  create: (items) => api.post('/email-info', { items }),

  update: (items) => api.put('/email-info', { items }),

  delete: (ids) => api.delete('/email-info', { data: { ids } }),
}
