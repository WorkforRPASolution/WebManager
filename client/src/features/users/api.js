/**
 * User Management API
 */

import api from '../../shared/api'

export const usersApi = {
  // Get users with pagination and filtering
  // Supports multi-process filtering via `processes` array (sent as comma-separated string)
  getAll: (filters = {}, page = 1, pageSize = 25) => {
    const params = { ...filters, page, pageSize }
    // Convert processes array to comma-separated string for API
    if (params.processes && Array.isArray(params.processes)) {
      params.processes = params.processes.join(',')
    }
    return api.get('/users', { params })
  },

  // Get distinct processes for filter
  getProcesses: () => api.get('/users/processes'),

  // Get distinct lines for filter
  getLines: (process) => api.get('/users/lines', { params: { process } }),

  // Get role definitions
  getRoles: () => api.get('/users/roles'),

  // Update role permissions
  updateRole: (level, permissions) => api.put(`/users/roles/${level}`, { permissions }),

  // Get user by ID
  getById: (id) => api.get(`/users/${id}`),

  // Create users (batch)
  create: (users) => api.post('/users', { users }),

  // Update users (batch)
  update: (users) => api.put('/users', { users }),

  // Delete users (batch)
  delete: (ids) => api.delete('/users', { data: { ids } }),

  // Approve user account (Admin only)
  // Optionally accepts update data to save changes before approval
  approveUser: (id, data = {}) => api.put(`/users/${id}/approve`, data),

  // Approve password reset (Admin only)
  approvePasswordReset: (id) => api.put(`/users/${id}/approve-reset`)
}
