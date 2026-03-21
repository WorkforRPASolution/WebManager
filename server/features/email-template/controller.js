/**
 * Email Template Controller - Request/Response handling
 */

const service = require('./service')
const { ApiError } = require('../../shared/middleware/errorHandler')

async function getProcesses(req, res) {
  const processes = await service.getProcesses()
  res.json(processes)
}

async function getModels(req, res) {
  const { process, userProcesses } = req.query
  const models = await service.getModels(process, userProcesses)
  res.json(models)
}

async function getCodes(req, res) {
  const { process, model, userProcesses } = req.query
  const codes = await service.getCodes(process, model, userProcesses)
  res.json(codes)
}

async function getTemplates(req, res) {
  const { process, model, code, page, pageSize } = req.query
  const result = await service.getTemplates({ process, model, code }, { page, pageSize })
  res.json(result)
}

async function createTemplates(req, res) {
  const { templates } = req.body
  if (!templates || !Array.isArray(templates) || templates.length === 0) {
    throw ApiError.badRequest('templates array is required')
  }

  const context = { user: req.user }
  const { created, errors } = await service.createTemplates(templates, context)

  const statusCode = errors.length > 0 && created === 0 ? 400 : 201
  res.status(statusCode).json({ success: created > 0, created, errors })
}

async function updateTemplates(req, res) {
  const { templates } = req.body
  if (!templates || !Array.isArray(templates) || templates.length === 0) {
    throw ApiError.badRequest('templates array is required')
  }

  const context = { user: req.user }
  const { updated, errors } = await service.updateTemplates(templates, context)

  res.json({ success: updated > 0 || errors.length === 0, updated, errors })
}

async function deleteTemplates(req, res) {
  const { ids } = req.body
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('ids array is required')
  }

  const context = { user: req.user }
  const { deleted } = await service.deleteTemplates(ids, context)

  res.json({ success: true, deleted })
}

module.exports = {
  getProcesses,
  getModels,
  getCodes,
  getTemplates,
  createTemplates,
  updateTemplates,
  deleteTemplates
}
