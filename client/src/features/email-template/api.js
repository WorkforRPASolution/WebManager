import api from '../../shared/api'

export const emailTemplateApi = {
  // Server-side pagination: returns { data, total, page, pageSize, totalPages }
  getAll: (filters = {}, page = 1, pageSize = 25) => {
    const params = { page, pageSize }
    if (filters.process) params.process = filters.process
    if (filters.model) params.model = filters.model
    if (filters.code) params.code = filters.code
    return api.get('/email-template', { params })
  },

  getProcesses: () => api.get('/email-template/processes'),

  getModels: (process, userProcesses) => {
    const params = {}
    if (process) params.process = process
    // Process 선택 없이 조회 시 사용자 권한으로 필터링
    if (userProcesses && Array.isArray(userProcesses) && userProcesses.length > 0) {
      params.userProcesses = userProcesses.join(',')
    }
    return api.get('/email-template/models', { params })
  },

  getCodes: (process, model, userProcesses) => {
    const params = {}
    if (process) params.process = process
    if (model) params.model = model
    // Process 선택 없이 조회 시 사용자 권한으로 필터링
    if (userProcesses && Array.isArray(userProcesses) && userProcesses.length > 0) {
      params.userProcesses = userProcesses.join(',')
    }
    return api.get('/email-template/codes', { params })
  },

  create: (templates) => api.post('/email-template', { templates }),

  update: (templates) => api.put('/email-template', { templates }),

  delete: (ids) => api.delete('/email-template', { data: { ids } }),
}
