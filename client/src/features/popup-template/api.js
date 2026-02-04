import api from '../../shared/api'

export const popupTemplateApi = {
  // Server-side pagination: returns { data, total, page, pageSize, totalPages }
  getAll: (filters = {}, page = 1, pageSize = 25) => {
    const params = { page, pageSize }
    if (filters.process) params.process = filters.process
    if (filters.model) params.model = filters.model
    if (filters.code) params.code = filters.code
    return api.get('/popup-template', { params })
  },

  getProcesses: () => api.get('/popup-template/processes'),

  getModels: (process, userProcesses) => {
    const params = {}
    if (process) params.process = process
    // Process 선택 없이 조회 시 사용자 권한으로 필터링
    if (userProcesses && Array.isArray(userProcesses) && userProcesses.length > 0) {
      params.userProcesses = userProcesses.join(',')
    }
    return api.get('/popup-template/models', { params })
  },

  getCodes: (process, model, userProcesses) => {
    const params = {}
    if (process) params.process = process
    if (model) params.model = model
    // Process 선택 없이 조회 시 사용자 권한으로 필터링
    if (userProcesses && Array.isArray(userProcesses) && userProcesses.length > 0) {
      params.userProcesses = userProcesses.join(',')
    }
    return api.get('/popup-template/codes', { params })
  },

  create: (templates) => api.post('/popup-template', { templates }),

  update: (templates) => api.put('/popup-template', { templates }),

  delete: (ids) => api.delete('/popup-template', { data: { ids } }),
}
