import api from '../../shared/api'

export const equipmentInfoApi = {
  // Server-side pagination: returns { data, total, page, pageSize, totalPages }
  getAll: (filters = {}, page = 1, pageSize = 25) => {
    const params = { page, pageSize }
    if (filters.process) params.process = filters.process
    if (filters.model) params.model = filters.model
    if (filters.ipSearch) params.ipSearch = filters.ipSearch
    if (filters.eqpIdSearch) params.eqpIdSearch = filters.eqpIdSearch
    // 키워드 검색 시 process 권한 필터링
    if (filters.userProcesses && Array.isArray(filters.userProcesses) && filters.userProcesses.length > 0) {
      params.userProcesses = filters.userProcesses.join(',')
    }
    return api.get('/clients/equipment-info', { params })
  },

  getProcesses: () => api.get('/clients/processes'),

  getModels: (process, userProcesses) => {
    const params = {}
    if (process) params.process = process
    // Process 선택 없이 조회 시 사용자 권한으로 필터링
    if (userProcesses && Array.isArray(userProcesses) && userProcesses.length > 0) {
      params.userProcesses = userProcesses.join(',')
    }
    return api.get('/clients/models', { params })
  },

  create: (clients) => api.post('/clients/equipment-info', { clients }),

  update: (clients) => api.put('/clients/equipment-info', { clients }),

  delete: (ids) => api.delete('/clients/equipment-info', { data: { ids } }),
}

// OS Version API
export const osVersionApi = {
  getDistinct: () => api.get('/os-version/distinct'),
  getAll: () => api.get('/os-version'),
  create: (items) => api.post('/os-version', { items }),
  update: (items) => api.put('/os-version', { items }),
  delete: (ids) => api.delete('/os-version', { data: { ids } })
}
