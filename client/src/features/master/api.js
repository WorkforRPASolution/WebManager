import api from '../../shared/api'

export const masterApi = {
  // Server-side pagination: returns { data, total, page, pageSize, totalPages }
  getAll: (filters = {}, page = 1, pageSize = 25) => {
    const params = { page, pageSize }
    if (filters.process) params.process = filters.process
    if (filters.model) params.model = filters.model
    if (filters.ipSearch) params.ipSearch = filters.ipSearch
    return api.get('/clients/master', { params })
  },

  getProcesses: () => api.get('/clients/processes'),

  getModels: (process) => {
    const params = process ? { process } : {}
    return api.get('/clients/models', { params })
  },

  create: (clients) => api.post('/clients/master', { clients }),

  update: (clients) => api.put('/clients/master', { clients }),

  delete: (ids) => api.delete('/clients/master', { data: { ids } }),
}
