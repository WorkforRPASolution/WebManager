import api from '../../shared/api'

export const emailInfoApi = {
  // Server-side pagination: returns { data, total, page, pageSize, totalPages }
  getAll: (filters = {}, page = 1, pageSize = 25) => {
    const params = { page, pageSize }
    if (filters.project) params.project = filters.project
    if (filters.category) params.category = filters.category
    return api.get('/email-info', { params })
  },

  getProjects: () => api.get('/email-info/projects'),

  getCategories: (project) => {
    const params = project ? { project } : {}
    return api.get('/email-info/categories', { params })
  },

  create: (items) => api.post('/email-info', { items }),

  update: (items) => api.put('/email-info', { items }),

  delete: (ids) => api.delete('/email-info', { data: { ids } }),
}
