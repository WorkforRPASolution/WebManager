import api from '../../shared/api'
import { emailInfoApi } from '@/features/email-info/api'

export const emailRecipientsApi = {
  // Server-side pagination: returns { data, total, page, pageSize, totalPages }
  getAll: (filters = {}, page = 1, pageSize = 25) => {
    const params = { page, pageSize }
    if (filters.app) params.app = filters.app
    if (filters.process) params.process = filters.process
    if (filters.model) params.model = filters.model
    if (filters.code) params.code = filters.code
    if (filters.emailCategory) params.emailCategory = filters.emailCategory
    // 키워드 검색 시 process 권한 필터링
    if (filters.userProcesses && Array.isArray(filters.userProcesses) && filters.userProcesses.length > 0) {
      params.userProcesses = filters.userProcesses.join(',')
    }
    return api.get('/email-recipients', { params })
  },

  getApps: () => api.get('/email-recipients/apps'),

  getProcesses: (app) => {
    const params = {}
    if (app) params.app = app
    return api.get('/email-recipients/processes', { params })
  },

  getModels: (app, process, userProcesses) => {
    const params = {}
    if (app) params.app = app
    if (process) params.process = process
    // Process 선택 없이 조회 시 사용자 권한으로 필터링
    if (userProcesses && Array.isArray(userProcesses) && userProcesses.length > 0) {
      params.userProcesses = userProcesses.join(',')
    }
    return api.get('/email-recipients/models', { params })
  },

  getCodes: (app, process, model, userProcesses) => {
    const params = {}
    if (app) params.app = app
    if (process) params.process = process
    if (model) params.model = model
    // Process 선택 없이 조회 시 사용자 권한으로 필터링
    if (userProcesses && Array.isArray(userProcesses) && userProcesses.length > 0) {
      params.userProcesses = userProcesses.join(',')
    }
    return api.get('/email-recipients/codes', { params })
  },

  create: (items) => api.post('/email-recipients', { items }),

  update: (items) => api.put('/email-recipients', { items }),

  delete: (ids) => api.delete('/email-recipients', { data: { ids } }),

  // EMAILINFO category APIs (reusing emailInfoApi)
  getEmailInfoCategories: async (project = 'ARS') => {
    const response = await emailInfoApi.getCategories(project)
    return response.data || []
  },

  checkCategories: async (categories) => {
    const response = await emailInfoApi.checkCategories(categories)
    return response.data || { existing: [], missing: [] }
  },
}
