/**
 * Template Service Factory
 *
 * Email Template / Popup Template 등 동일 구조의 템플릿 CRUD를 생성.
 * - app, process, model, code, subcode 기반 composite key
 * - createCrudService 내장 (audit 자동)
 * - 필터 조회 + 페이지네이션
 *
 * 사용법:
 *   const service = createTemplateService(Model, 'COLLECTION_NAME', {
 *     requiredFields: ['app', 'process', 'model', 'code', 'subcode', 'title', 'html'],
 *     extraValidations: (data) => ({ title: 'too long' })  // optional
 *   })
 */

const { createCrudService } = require('./createCrudService')
const { parsePaginationParams } = require('./pagination')
const { distinctWithCount } = require('./aggregateHelpers')

function createTemplateService(Model, collectionName, options = {}) {
  const {
    requiredFields = ['app', 'process', 'model', 'code', 'subcode', 'html'],
    extraValidations = null
  } = options

  const crud = createCrudService(Model, collectionName, {
    skipFullDataInAudit: true
  })

  // ============================================
  // Validation
  // ============================================

  function validateData(data) {
    const errors = {}
    for (const field of requiredFields) {
      if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
        errors[field] = `${field} is required`
      }
    }
    if (data.app && data.app.length > 50) {
      errors.app = 'App name must be 50 characters or less'
    }
    if (extraValidations) {
      const extra = extraValidations(data)
      if (extra) Object.assign(errors, extra)
    }
    return Object.keys(errors).length > 0 ? errors : null
  }

  function compositeKey(data) {
    return `${data.app}|${data.process}|${data.model}|${data.code}|${data.subcode}`
  }

  // ============================================
  // Filter Helpers
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

  function parseMultiFilter(value) {
    if (!value) return null
    const arr = value.split(',').map(v => v.trim()).filter(v => v)
    if (arr.length === 0) return null
    return arr.length === 1 ? arr[0] : { $in: arr }
  }

  // ============================================
  // Service Methods
  // ============================================

  async function getProcesses() {
    return distinctWithCount(Model, 'process')
  }

  async function getModels(process, userProcesses) {
    const query = buildProcessQuery(process, userProcesses)
    return distinctWithCount(Model, 'model', query)
  }

  async function getCodes(process, model, userProcesses) {
    const query = buildProcessQuery(process, userProcesses)
    const modelFilter = parseMultiFilter(model)
    if (modelFilter) query.model = modelFilter
    return distinctWithCount(Model, 'code', query)
  }

  async function getTemplates(filters = {}, paginationQuery = {}) {
    const query = {}
    const processFilter = parseMultiFilter(filters.process)
    if (processFilter) query.process = processFilter
    const modelFilter = parseMultiFilter(filters.model)
    if (modelFilter) query.model = modelFilter
    const codeFilter = parseMultiFilter(filters.code)
    if (codeFilter) query.code = codeFilter

    const { page, pageSize, skip, limit } = parsePaginationParams(paginationQuery)

    const [templates, total] = await Promise.all([
      Model.find(query)
        .sort({ process: 1, model: 1, code: 1, subcode: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Model.countDocuments(query)
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

      const validationErrors = validateData(data)
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
          const keyInfo = insertError.keyValue
            ? Object.entries(insertError.keyValue).map(([k, v]) => `${k}=${v}`).join(', ')
            : 'unknown'
          errors.push({ rowIndex: -1, field: 'key', message: `Duplicate template key (${keyInfo})` })
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
      const { _id, ...updateData } = templates[i]

      if (!_id) {
        errors.push({ rowIndex: i, field: '_id', message: '_id is required for update' })
        continue
      }

      const validationErrors = validateData(updateData)
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
          const keyInfo = updateError.keyValue
            ? Object.entries(updateError.keyValue).map(([k, v]) => `${k}=${v}`).join(', ')
            : 'unknown'
          errors.push({ rowIndex: i, field: 'key', message: `Duplicate template key (${keyInfo})` })
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

  return {
    getProcesses,
    getModels,
    getCodes,
    getTemplates,
    createTemplates,
    updateTemplates,
    deleteTemplates
  }
}

module.exports = { createTemplateService }
