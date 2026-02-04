import api from '../../shared/api'

export const emailImageApi = {
  // Filter options
  getProcesses: () => api.get('/images/processes'),

  getModels: (process, userProcesses) => {
    const params = {}
    if (process) params.process = process
    if (userProcesses && Array.isArray(userProcesses) && userProcesses.length > 0) {
      params.userProcesses = userProcesses.join(',')
    }
    return api.get('/images/models', { params })
  },

  getCodes: (process, model, userProcesses) => {
    const params = {}
    if (process) params.process = process
    if (model) params.model = model
    if (userProcesses && Array.isArray(userProcesses) && userProcesses.length > 0) {
      params.userProcesses = userProcesses.join(',')
    }
    return api.get('/images/codes', { params })
  },

  getSubcodes: (process, model, code, userProcesses) => {
    const params = {}
    if (process) params.process = process
    if (model) params.model = model
    if (code) params.code = code
    if (userProcesses && Array.isArray(userProcesses) && userProcesses.length > 0) {
      params.userProcesses = userProcesses.join(',')
    }
    return api.get('/images/subcodes', { params })
  },

  // Paginated list with filters
  getAll: (filters = {}, page = 1, pageSize = 25) => {
    const params = { page, pageSize }
    if (filters.process) params.process = filters.process
    if (filters.model) params.model = filters.model
    if (filters.code) params.code = filters.code
    if (filters.subcode) params.subcode = filters.subcode
    if (filters.userProcesses) params.userProcesses = filters.userProcesses
    return api.get('/images/paginated', { params })
  },

  // Upload image with context for filtering
  upload: (file, prefix, context = {}) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('prefix', prefix)
    // 개별 필터 필드 추가
    if (context.process) formData.append('process', context.process)
    if (context.model) formData.append('model', context.model)
    if (context.code) formData.append('code', context.code)
    if (context.subcode) formData.append('subcode', context.subcode)
    return api.post('/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  // Delete multiple images
  deleteMultiple: (items) => api.delete('/images/bulk', { data: { items } }),

  // Delete single image
  delete: (prefix, name) => api.delete(`/images/${encodeURIComponent(prefix)}/${name}`)
}
