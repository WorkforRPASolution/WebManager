/**
 * User controller - Request/Response handling
 */

const service = require('./service')
const authService = require('../auth/service')
const { ApiError } = require('../../shared/middleware/errorHandler')

// ===========================================
// User CRUD Controllers
// ===========================================

/**
 * GET /api/users
 * Get users with filtering and pagination
 * Supports multi-process filtering via `processes` parameter (comma-separated)
 */
async function getUsers(req, res) {
  const { process, processes, line, authorityManager, accountStatus, passwordStatus, search, page, pageSize } = req.query

  // Parse processes parameter (comma-separated string → array)
  let processesArray = null
  if (processes) {
    processesArray = processes.split(',').map(p => p.trim()).filter(Boolean)
  }

  const result = await service.getUsers(
    { process, processes: processesArray, line, authorityManager, accountStatus, passwordStatus, search },
    { page, pageSize }
  )

  res.json(result)
}

/**
 * GET /api/users/processes
 * Get distinct process values for filter
 */
async function getProcesses(req, res) {
  const processes = await service.getProcesses()
  res.json(processes)
}

/**
 * GET /api/users/lines
 * Get distinct line values for filter
 */
async function getLines(req, res) {
  const { process } = req.query
  const lines = await service.getLines(process)
  res.json(lines)
}

/**
 * GET /api/users/roles
 * Get all role definitions
 */
async function getRoles(req, res) {
  const roles = await service.getRolePermissions()

  // If no roles exist, initialize defaults
  if (roles.length === 0) {
    await service.initializeRolePermissions()
    const initializedRoles = await service.getRolePermissions()
    return res.json(initializedRoles)
  }

  res.json(roles)
}

/**
 * PUT /api/users/roles/:level
 * Update role permissions
 */
async function updateRole(req, res) {
  const { level } = req.params
  const { permissions } = req.body

  if (permissions === undefined) {
    throw ApiError.badRequest('permissions is required')
  }

  const roleLevel = parseInt(level, 10)
  if (isNaN(roleLevel) || roleLevel < 0 || roleLevel > 3) {
    throw ApiError.badRequest('Invalid role level. Must be 0-3')
  }

  const result = await service.updateRolePermissions(roleLevel, permissions)

  if (!result) {
    throw ApiError.notFound('Role not found')
  }

  res.json(result)
}

/**
 * GET /api/users/:id
 * Get user by ID
 */
async function getUser(req, res) {
  const { id } = req.params
  const user = await service.getUserById(id)

  if (!user) {
    throw ApiError.notFound('User not found')
  }

  res.json(user)
}

/**
 * POST /api/users
 * Create users (batch)
 */
async function createUsers(req, res) {
  const { users } = req.body

  if (!users || !Array.isArray(users) || users.length === 0) {
    throw ApiError.badRequest('users array is required')
  }

  const { created, errors } = await service.createUsers(users)

  const statusCode = errors.length > 0 && created === 0 ? 400 : 201
  res.status(statusCode).json({
    success: created > 0,
    created,
    errors
  })
}

/**
 * PUT /api/users
 * Update users (batch)
 */
async function updateUsers(req, res) {
  const { users } = req.body

  if (!users || !Array.isArray(users) || users.length === 0) {
    throw ApiError.badRequest('users array is required')
  }

  const { updated, errors } = await service.updateUsers(users)

  res.json({
    success: updated > 0 || errors.length === 0,
    updated,
    errors
  })
}

/**
 * DELETE /api/users
 * Delete users (batch)
 */
async function deleteUsers(req, res) {
  const { ids } = req.body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('ids array is required')
  }

  const { deleted } = await service.deleteUsers(ids)

  res.json({
    success: true,
    deleted
  })
}

/**
 * PUT /api/users/:id/approve
 * Approve user account (Admin only)
 * Optionally updates user data before approval if provided in request body
 */
async function approveUser(req, res) {
  const { id } = req.params
  const updateData = req.body

  // If update data is provided, update the user first
  if (updateData && Object.keys(updateData).length > 0) {
    const { updated, errors } = await service.updateUsers([{ _id: id, ...updateData }])
    if (errors.length > 0) {
      throw ApiError.badRequest(errors[0])
    }
  }

  // Then approve the account
  const result = await authService.approveUserAccount(id)

  if (result.error) {
    throw ApiError.notFound(result.error)
  }

  res.json(result)
}

/**
 * PUT /api/users/:id/approve-reset
 * Approve password reset (Admin only)
 */
async function approvePasswordReset(req, res) {
  const { id } = req.params

  const result = await authService.approvePasswordReset(id)

  if (result.error) {
    throw ApiError.notFound(result.error)
  }

  res.json(result)
}

module.exports = {
  getUsers,
  getProcesses,
  getLines,
  getRoles,
  updateRole,
  getUser,
  createUsers,
  updateUsers,
  deleteUsers,
  approveUser,
  approvePasswordReset
}
