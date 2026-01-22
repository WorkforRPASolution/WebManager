/**
 * User Management API
 */

import api from '../../shared/api'

export const usersApi = {
  // Get users with pagination and filtering
  getAll: (filters = {}, page = 1, pageSize = 25) =>
    api.get('/users', {
      params: { ...filters, page, pageSize }
    }),

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
  approveUser: (id) => api.put(`/users/${id}/approve`),

  // Approve password reset (Admin only)
  approvePasswordReset: (id) => api.put(`/users/${id}/approve-reset`)
}
