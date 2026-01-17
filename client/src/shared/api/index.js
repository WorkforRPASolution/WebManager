import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
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
      localStorage.removeItem('token')
      window.location.href = '/login'
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
}
