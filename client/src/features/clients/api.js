import api from '../../shared/api'

export const clientListApi = {
  // Server-side pagination: returns { data, total, page, pageSize, totalPages }
  getClients: (filters = {}, page = 1, pageSize = 25) => {
    const params = { page, pageSize }
    if (filters.processes?.length) params.process = filters.processes.join(',')
    if (filters.models?.length) params.model = filters.models.join(',')
    if (filters.ipSearch) params.ipSearch = filters.ipSearch
    if (filters.status?.length) params.status = filters.status.join(',')
    // 키워드 검색 시 process 권한 필터링
    if (filters.userProcesses && Array.isArray(filters.userProcesses) && filters.userProcesses.length > 0) {
      params.userProcesses = filters.userProcesses.join(',')
    }
    return api.get('/clients/list', { params })
  },

  getProcesses: () => api.get('/clients/processes'),

  getModels: (process) => {
    const params = process ? { process } : {}
    return api.get('/clients/models', { params })
  },

  // Control APIs (Phase 3에서 Akka 연동, 현재 Mock)
  controlClients: (ids, action) =>
    api.post('/clients/control', { ids, action }),

  updateClients: (ids, version) =>
    api.post('/clients/update', { ids, version }),

  configClients: (ids, settings) =>
    api.post('/clients/config', { ids, settings }),
}
