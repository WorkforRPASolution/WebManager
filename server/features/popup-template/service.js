/**
 * Popup Template Service - CRUD via createCrudService factory
 */

const PopupTemplate = require('./model')
const { createCrudService } = require('../../shared/utils/createCrudService')

const crud = createCrudService(PopupTemplate, 'POPUP_TEMPLATE_REPOSITORY', {
  skipFullDataInAudit: true // HTML 문서 → diff만 기록, 전체 데이터 생략
})

// ============================================
// Validation
// ============================================

function validateTemplateData(data) {
  const errors = {}
  const requiredFields = ['app', 'process', 'model', 'code', 'subcode', 'html']

  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors[field] = `${field} is required`
    }
  }

  if (data.app && data.app.length > 50) {
    errors.app = 'App name must be 50 characters or less'
  }

  return Object.keys(errors).length > 0 ? errors : null
}

function compositeKey(data) {
  return `${data.app}|${data.process}|${data.model}|${data.code}|${data.subcode}`
}

// ============================================
// Filter Options
// ============================================

function buildProcessQuery(process, userProcesses) {
  if (process) {
    const arr = process.split(',').map(p => p.trim()).filter(p => p)
    if (arr.length === 1) return { process: arr[0] }
    if (arr.length > 1) return { process: { $in: arr } }
  } else if (userProcesses) {
    const arr = userProcesses.split(',').map(p => p.trim()).filter(p => p)
    if (arr.length > 0) return { process: { $in: arr } }
  }
  return {}
}

async function getProcesses() {
  const processes = await PopupTemplate.distinct('process')
  return processes.sort()
}

async function getModels(process, userProcesses) {
  const query = buildProcessQuery(process, userProcesses)
  const models = await PopupTemplate.distinct('model', query)
  return models.sort()
}

async function getCodes(process, model, userProcesses) {
  const query = buildProcessQuery(process, userProcesses)
  if (model) {
    const arr = model.split(',').map(m => m.trim()).filter(m => m)
    if (arr.length === 1) query.model = arr[0]
    else if (arr.length > 1) query.model = { $in: arr }
  }
  const codes = await PopupTemplate.distinct('code', query)
  return codes.sort()
}

// ============================================
// CRUD Operations
// ============================================

async function getTemplates(filters = {}, paginationQuery = {}) {
  const query = {}

  if (filters.process) {
    const arr = filters.process.split(',').map(p => p.trim()).filter(p => p)
    if (arr.length === 1) query.process = arr[0]
    else if (arr.length > 1) query.process = { $in: arr }
  }
  if (filters.model) {
    const arr = filters.model.split(',').map(m => m.trim()).filter(m => m)
    if (arr.length === 1) query.model = arr[0]
    else if (arr.length > 1) query.model = { $in: arr }
  }
  if (filters.code) {
    const arr = filters.code.split(',').map(c => c.trim()).filter(c => c)
    if (arr.length === 1) query.code = arr[0]
    else if (arr.length > 1) query.code = { $in: arr }
  }

  const page = parseInt(paginationQuery.page) || 1
  const pageSize = parseInt(paginationQuery.pageSize) || 25
  const skip = (page - 1) * pageSize

  const [templates, total] = await Promise.all([
    PopupTemplate.find(query)
      .sort({ process: 1, model: 1, code: 1, subcode: 1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    PopupTemplate.countDocuments(query)
  ])

  return { data: templates, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

async function createTemplates(templates, context = {}) {
  const errors = []
  const validItems = []
  const batchKeys = new Set()

  for (let i = 0; i < templates.length; i++) {
    const data = templates[i]
    const key = compositeKey(data)

    if (batchKeys.has(key)) {
      errors.push({ rowIndex: i, field: 'subcode', message: 'Duplicate template key in batch' })
      continue
    }

    const validationErrors = validateTemplateData(data)
    if (validationErrors) {
      for (const [field, message] of Object.entries(validationErrors)) {
        errors.push({ rowIndex: i, field, message })
      }
    } else {
      batchKeys.add(key)
      validItems.push(data)
    }
  }

  let created = 0
  if (validItems.length > 0) {
    try {
      const result = await crud.create(validItems, context)
      created = result.created
      errors.push(...result.errors)
    } catch (insertError) {
      if (insertError.code === 11000) {
        errors.push({ rowIndex: -1, field: 'key', message: 'One or more templates already exist with the same key' })
      } else {
        throw insertError
      }
    }
  }

  return { created, errors }
}

async function updateTemplates(templates, context = {}) {
  const errors = []
  let updated = 0

  for (let i = 0; i < templates.length; i++) {
    const data = templates[i]
    const { _id, ...updateData } = data

    if (!_id) {
      errors.push({ rowIndex: i, field: '_id', message: '_id is required for update' })
      continue
    }

    const validationErrors = validateTemplateData(updateData, true)
    if (validationErrors) {
      for (const [field, message] of Object.entries(validationErrors)) {
        errors.push({ rowIndex: i, field, message })
      }
      continue
    }

    try {
      const result = await crud.update([{ _id, ...updateData }], context)
      updated += result.updated
      errors.push(...result.errors.map(e => ({ ...e, rowIndex: i })))
    } catch (updateError) {
      if (updateError.code === 11000) {
        errors.push({ rowIndex: i, field: 'key', message: 'Duplicate template key' })
      } else {
        throw updateError
      }
    }
  }

  return { updated, errors }
}

async function deleteTemplates(ids, context = {}) {
  return await crud.remove(ids, context)
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
