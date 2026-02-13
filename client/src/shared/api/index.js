import axios from 'axios'

// 환경변수 체크 및 경고 로그
const API_URL = import.meta.env.VITE_API_URL
if (!API_URL) {
  console.warn(
    '[API] VITE_API_URL 환경변수가 설정되지 않았습니다.\n' +
    '      client/.env 파일에 VITE_API_URL=http://localhost:3000/api 를 추가하세요.'
  )
}

const api = axios.create({
  baseURL: API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if on public auth pages
      const publicAuthPaths = ['/login', '/signup', '/request-password-reset']
      const currentPath = window.location.pathname
      if (!publicAuthPaths.includes(currentPath)) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

// Client API
export const clientsApi = {
  getProcesses: () => api.get('/clients/processes'),
  getModels: (process) => api.get('/clients/models', { params: { process } }),
  getClients: (process, model) => api.get('/clients', { params: { process, model } }),
  getClient: (id) => api.get(`/clients/${id}`),
  getLogs: (id, limit = 50) => api.get(`/clients/${id}/logs`, { params: { limit } }),
  restart: (id) => api.post(`/clients/${id}/restart`),
  stop: (id) => api.post(`/clients/${id}/stop`),
}

// Dashboard API
export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary'),
}

// Auth API
export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  signup: (data) => api.post('/auth/signup', data),
  requestPasswordReset: (singleid) => api.post('/auth/request-password-reset', { singleid }),
  changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }),
  setNewPassword: (newPassword) => api.post('/auth/set-new-password', { newPassword }),
}

// Users API
export const usersApi = {
  getProcesses: () => api.get('/users/processes'),
  getLines: (process) => api.get('/users/lines', { params: { process } }),
  getUsers: (params) => api.get('/users', { params }),
  getUser: (id) => api.get(`/users/${id}`),
  createUsers: (users) => api.post('/users', { users }),
  updateUsers: (users) => api.put('/users', { users }),
  deleteUsers: (ids) => api.delete('/users', { data: { ids } }),
  approveUser: (id) => api.put(`/users/${id}/approve`),
  approvePasswordReset: (id) => api.put(`/users/${id}/approve-reset`),
}

// Permissions API
export const permissionsApi = {
  getAll: () => api.get('/permissions'),
  getByFeature: (feature) => api.get(`/permissions/${feature}`),
  update: (feature, permissions) => api.put(`/permissions/${feature}`, { permissions }),
  getByRole: (level) => api.get(`/permissions/role/${level}`),
  check: (feature, action) => api.get('/permissions/check', { params: { feature, action } }),
}

// Images API
export const imagesApi = {
  getConfig: () => api.get('/images/config'),
  /**
   * Upload image with optional context for filtering
   * @param {File} file - Image file to upload
   * @param {string} prefix - Image prefix for URL
   * @param {Object} context - Filter context { process, model, code, subcode }
   */
  upload: (file, prefix, context = {}) => {
    const formData = new FormData()
    formData.append('file', file)
    if (prefix) {
      formData.append('prefix', prefix)
    }
    // 개별 필터 필드 추가
    if (context.process) formData.append('process', context.process)
    if (context.model) formData.append('model', context.model)
    if (context.code) formData.append('code', context.code)
    if (context.subcode) formData.append('subcode', context.subcode)

    return api.post('/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  list: (prefix) => api.get('/images', { params: prefix ? { prefix } : {} }),
  delete: (prefix, name) => {
    if (prefix && name) {
      return api.delete(`/images/${encodeURIComponent(prefix)}/${name}`)
    }
    // Backward compatibility for local storage (id only)
    return api.delete(`/images/${prefix}`)
  },
}
