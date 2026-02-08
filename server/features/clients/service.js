/**
 * Client service - Database operations and business logic
 */

const Client = require('./model')
const { parsePaginationParams } = require('../../shared/utils/pagination')
const { validateBatchCreate, validateUpdate } = require('./validation')
const { createRulesContext } = require('../../shared/utils/businessRules')
const strategyRegistry = require('./strategies')

// EQP_INFO 컬렉션용 비즈니스 규칙 컨텍스트
const rules = createRulesContext('EQP_INFO', { documentIdField: 'eqpId' })

/**
 * Apply default values for equipment info fields
 * - onoff, webmanagerUse, usetkincancel, usereleasemsg: 비어있으면 1
 * - localpc: ipAddrL 유무에 따라 결정 (있으면 1, 없으면 0) - 항상 서버에서 자동 설정
 * @param {Object} data - Equipment info data
 * @returns {Object} - Data with defaults applied
 */
function applyEquipmentDefaults(data) {
  const result = { ...data }

  // onoff, webmanagerUse, usetkincancel, usereleasemsg: 비어있으면 1
  const defaultToOne = ['onoff', 'webmanagerUse', 'usetkincancel', 'usereleasemsg']
  for (const field of defaultToOne) {
    if (result[field] === undefined || result[field] === null || result[field] === '') {
      result[field] = 1
    }
  }

  // localpc: ipAddrL 유무에 따라 결정 (항상 서버에서 자동 설정)
  result.localpc = (result.ipAddrL && result.ipAddrL.trim() !== '') ? 1 : 0

  return result
}

/**
 * Parse comma-separated filter values
 */
function parseCommaSeparated(value) {
  if (!value) return null
  const values = value.split(',').map(v => v.trim()).filter(v => v)
  if (values.length === 0) return null
  if (values.length === 1) return values[0]
  return { $in: values }
}

/**
 * Build query from filter parameters
 */
function buildClientQuery(filters) {
  const query = {}

  if (filters.process) {
    const processFilter = parseCommaSeparated(filters.process)
    if (processFilter) query.process = processFilter
  }

  if (filters.model) {
    const modelFilter = parseCommaSeparated(filters.model)
    if (modelFilter) query.eqpModel = modelFilter
  }

  if (filters.status) {
    const statuses = filters.status.split(',').map(s => s.trim().toLowerCase()).filter(s => s)
    if (statuses.length > 0) {
      const onoffValues = statuses.map(s => s === 'online' ? 1 : 0)
      query.onoff = onoffValues.length === 1 ? onoffValues[0] : { $in: onoffValues }
    }
  }

  if (filters.ipSearch) {
    query.ipAddr = { $regex: filters.ipSearch, $options: 'i' }
  }

  if (filters.eqpIdSearch) {
    query.eqpId = { $regex: filters.eqpIdSearch, $options: 'i' }
  }

  // 키워드 검색 시 process 권한 필터링 (userProcesses가 전달된 경우)
  // process 필터가 이미 설정된 경우에는 적용하지 않음
  if (filters.userProcesses && Array.isArray(filters.userProcesses) && filters.userProcesses.length > 0 && !filters.process) {
    query.process = { $in: filters.userProcesses }
  }

  return query
}

/**
 * Transform client document to frontend format
 */
function transformClient(client) {
  return {
    id: client.eqpId,
    eqpId: client.eqpId,
    eqpModel: client.eqpModel,
    process: client.process,
    ipAddress: client.ipAddr,
    status: client.onoff === 1 ? 'online' : 'offline',
    osVersion: client.osVer,
    category: client.category,
    line: client.line
  }
}

/**
 * Transform client document to detail format
 */
function transformClientDetail(client, agentGroup) {
  const strategy = agentGroup
    ? (client.serviceType
        ? strategyRegistry.get(agentGroup, client.serviceType)
        : strategyRegistry.getDefault(agentGroup))
    : null
  return {
    id: client.eqpId,
    eqpId: client.eqpId,
    eqpModel: client.eqpModel,
    process: client.process,
    ipAddress: client.ipAddr,
    innerIp: client.ipAddrL,
    status: client.onoff === 1 ? 'online' : 'offline',
    osVersion: client.osVer,
    category: client.category,
    line: client.line,
    lineDesc: client.lineDesc,
    installDate: client.installdate,
    localPc: client.localpc === 1,
    webmanagerUse: client.webmanagerUse === 1,
    serviceType: client.serviceType || null,
    displayType: strategy?.displayType || null,
    actions: strategy
      ? Object.entries(strategy.actions)
          .sort(([, a], [, b]) => a.order - b.order)
          .map(([name, meta]) => ({ name, ...meta }))
      : [],
    // Mock resource data (will be from Akka server in Phase 3)
    resources: {
      cpu: Math.floor(Math.random() * 60) + 20,
      memory: Math.floor(Math.random() * 40) + 40,
      storage: Math.floor(Math.random() * 30) + 50,
      latency: Math.floor(Math.random() * 100) + 10
    }
  }
}

// ============================================
// Service Methods
// ============================================

/**
 * Get distinct process list
 */
async function getProcesses() {
  const processes = await Client.distinct('process')
  return processes.sort()
}

/**
 * Get distinct model list (optionally filtered by process or userProcesses)
 * @param {string} processFilter - Comma-separated process filter (explicit selection)
 * @param {string[]} userProcesses - User's process permissions (for filtering when no explicit selection)
 */
async function getModels(processFilter, userProcesses) {
  const query = {}
  if (processFilter) {
    const filter = parseCommaSeparated(processFilter)
    if (filter) query.process = filter
  } else if (userProcesses && userProcesses.length > 0) {
    // Process 선택 없이 조회 시 사용자 권한으로 필터링
    query.process = { $in: userProcesses }
  }
  const models = await Client.distinct('eqpModel', query)
  return models.sort()
}

/**
 * Get distinct line list (optionally filtered by process)
 */
async function getLines(processFilter) {
  const query = {}
  if (processFilter) {
    const filter = parseCommaSeparated(processFilter)
    if (filter) query.process = filter
  }
  const lines = await Client.distinct('line', query)
  return lines.filter(l => l).sort()
}

/**
 * Get clients list (simple, no pagination)
 */
async function getClients(filters) {
  const query = buildClientQuery(filters)
  const clients = await Client.find(query)
    .select('eqpId eqpModel process ipAddr onoff osVer category line')
    .sort({ eqpId: 1 })

  return clients.map(transformClient)
}

/**
 * Get clients list with pagination
 */
async function getClientsPaginated(filters, paginationQuery) {
  const query = buildClientQuery(filters)
  const { page, pageSize, skip, limit } = parsePaginationParams(paginationQuery)

  const [clients, total] = await Promise.all([
    Client.find(query)
      .select('eqpId eqpModel process ipAddr onoff osVer category line')
      .sort({ eqpId: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Client.countDocuments(query)
  ])

  return {
    data: clients.map(transformClient),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

/**
 * Get client by ID
 */
async function getClientById(eqpId, agentGroup) {
  const client = await Client.findOne({ eqpId })
  if (!client) return null
  return transformClientDetail(client, agentGroup)
}

/**
 * Get client logs (mock)
 */
async function getClientLogs(eqpId, limit = 50) {
  const client = await Client.findOne({ eqpId })
  if (!client) return null

  // Generate mock logs
  const levels = ['INFO', 'WARN', 'ERROR', 'DEBUG']
  const messages = [
    'System health check completed',
    'Connection established',
    'Processing request',
    'Memory usage within normal limits',
    'CPU temperature normal',
    'Network latency check passed',
    'Disk I/O operation completed',
    'Service heartbeat received'
  ]

  const logs = []
  const now = new Date()

  for (let i = 0; i < limit; i++) {
    const timestamp = new Date(now - i * 30000)
    logs.push({
      id: `log-${i}`,
      timestamp: timestamp.toISOString(),
      level: levels[Math.floor(Math.random() * (i < 5 ? 2 : 4))],
      message: messages[Math.floor(Math.random() * messages.length)]
    })
  }

  return logs
}

// ============================================
// Master Data Management
// ============================================

/**
 * Get equipment info with pagination
 */
async function getMasterData(filters, paginationQuery) {
  const query = buildClientQuery(filters)
  const { page, pageSize, skip, limit } = parsePaginationParams(paginationQuery)

  const [clients, total] = await Promise.all([
    Client.find(query).sort({ eqpId: 1 }).skip(skip).limit(limit).lean(),
    Client.countDocuments(query)
  ])

  return {
    data: clients,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

/**
 * Create multiple clients
 * @param {Array} clientsData - Array of client data
 * @param {Object} context - Execution context (user, etc.)
 */
async function createClients(clientsData, context = {}) {
  const errors = []

  // 0. Apply equipment defaults (onoff, webmanagerUse, usetkincancel, usereleasemsg, localpc)
  const dataWithDefaults = clientsData.map(item => applyEquipmentDefaults(item))

  // 1. Apply auto-setters
  const processedData = rules.applyAutoSettersBatch(dataWithDefaults, { ...context, isUpdate: false })

  // 2. Validate relations (cross-field validation)
  const relationErrors = rules.validateRelationsBatch(processedData, context)
  for (const { index, errors: relErrors } of relationErrors) {
    for (const error of relErrors) {
      errors.push({ rowIndex: index, field: error.field, message: error.message })
    }
  }

  // Remove items with relation errors from processing
  const errorIndices = new Set(relationErrors.map(r => r.index))
  const dataToValidate = processedData.filter((_, i) => !errorIndices.has(i))

  // 3. Execute beforeCreate hooks
  await rules.executeHooks('beforeCreate', dataToValidate, context)

  // 4. Get existing IDs and IP combinations for format/uniqueness validation
  const existingClients = await Client.find({}, 'eqpId ipAddr ipAddrL').lean()
  const existingIds = existingClients.map(c => c.eqpId?.toLowerCase?.() || '')
  const existingIpCombos = existingClients.map(c => `${c.ipAddr || ''}|${c.ipAddrL || ''}`)

  // 5. Validate format and uniqueness
  const { valid, errors: validationErrors } = validateBatchCreate(dataToValidate, existingIds, existingIpCombos)

  // Adjust rowIndex for validation errors (account for removed items)
  const originalIndices = processedData
    .map((_, i) => i)
    .filter(i => !errorIndices.has(i))
  for (const err of validationErrors) {
    errors.push({
      rowIndex: originalIndices[err.rowIndex] ?? err.rowIndex,
      field: err.field,
      message: err.message
    })
  }

  // 6. Insert valid clients
  let created = 0
  let insertedDocs = []
  if (valid.length > 0) {
    insertedDocs = await Client.insertMany(valid)
    created = insertedDocs.length
  }

  // 7. Execute afterCreate hooks (with created data for audit logging)
  if (insertedDocs.length > 0) {
    await rules.executeHooks('afterCreate', insertedDocs.map(d => d.toObject()), context)
  }

  return { created, errors }
}

/**
 * Update multiple clients
 * @param {Array} clientsData - Array of client data (with _id)
 * @param {Object} context - Execution context (user, etc.)
 */
async function updateClients(clientsData, context = {}) {
  const errors = []
  let updated = 0
  const updatedDocs = []
  const previousDocs = []

  // Get all clients' data (for change tracking and validation)
  const allClients = await Client.find({}).lean()
  const clientsById = new Map(allClients.map(c => [c._id.toString(), c]))

  for (let i = 0; i < clientsData.length; i++) {
    const clientData = clientsData[i]
    const { _id, ...updateData } = clientData

    if (!_id) {
      errors.push({ rowIndex: i, field: '_id', message: '_id is required for update' })
      continue
    }

    // Get existing document
    const existingDoc = clientsById.get(_id)
    if (!existingDoc) {
      errors.push({ rowIndex: i, field: '_id', message: 'Document not found' })
      continue
    }

    // 0. Apply equipment defaults
    const dataWithDefaults = applyEquipmentDefaults(updateData)

    // 1. Apply auto-setters
    const processedData = rules.applyAutoSetters(dataWithDefaults, { ...context, isUpdate: true })

    // 2. Validate relations
    const relationErrors = rules.validateRelations({ ...existingDoc, ...processedData }, context)
    if (relationErrors.length > 0) {
      for (const error of relationErrors) {
        errors.push({ rowIndex: i, field: error.field, message: error.message })
      }
      continue
    }

    // 3. Execute beforeUpdate hook
    await rules.executeHooks('beforeUpdate', processedData, {
      ...context,
      previousData: existingDoc
    })

    // 4. Get other clients (excluding current one) for uniqueness validation
    const otherClients = allClients.filter(c => c._id.toString() !== _id)
    const existingIds = otherClients.map(c => c.eqpId?.toLowerCase?.() || '')
    const existingIpCombos = otherClients.map(c => `${c.ipAddr || ''}|${c.ipAddrL || ''}`)

    // 5. Validate format and uniqueness
    const validation = validateUpdate(processedData, existingIds, existingIpCombos)

    if (!validation.valid) {
      for (const [field, message] of Object.entries(validation.errors)) {
        errors.push({ rowIndex: i, field, message })
      }
      continue
    }

    // 6. Perform update
    const result = await Client.updateOne({ _id }, { $set: processedData })
    if (result.modifiedCount > 0) {
      updated++

      // Get updated document for audit logging
      const updatedDoc = await Client.findById(_id).lean()
      if (updatedDoc) {
        previousDocs.push(existingDoc)
        updatedDocs.push(updatedDoc)
      }
    }
  }

  // 7. Execute afterUpdate hooks (with change tracking for audit logging)
  if (updatedDocs.length > 0) {
    await rules.executeHooks('afterUpdate', updatedDocs, {
      ...context,
      previousData: previousDocs,
      newData: updatedDocs
    })
  }

  return { updated, errors }
}

/**
 * Delete multiple clients
 * @param {Array} ids - Array of _id values to delete
 * @param {Object} context - Execution context (user, etc.)
 */
async function deleteClients(ids, context = {}) {
  // 1. Get documents before deletion (for audit logging)
  const documentsToDelete = await Client.find({ _id: { $in: ids } }).lean()

  // 2. Execute beforeDelete hooks
  await rules.executeHooks('beforeDelete', documentsToDelete, {
    ...context,
    deletedData: documentsToDelete
  })

  // 3. Perform deletion
  const result = await Client.deleteMany({ _id: { $in: ids } })

  // 4. Execute afterDelete hooks (with deleted data for audit logging)
  if (result.deletedCount > 0) {
    await rules.executeHooks('afterDelete', null, {
      ...context,
      deletedData: documentsToDelete
    })
  }

  return { deleted: result.deletedCount }
}

/**
 * Check if client exists
 */
async function clientExists(eqpId) {
  const client = await Client.findOne({ eqpId })
  return !!client
}

/**
 * Get clients by eqpModel (for config rollout targets)
 * @param {string} eqpModel - Equipment model name
 * @param {string} excludeEqpId - Exclude this client from results
 * @returns {Promise<Array>}
 */
async function getClientsByModel(eqpModel, excludeEqpId = null) {
  const query = { eqpModel }
  if (excludeEqpId) {
    query.eqpId = { $ne: excludeEqpId }
  }

  const clients = await Client.find(query)
    .select('eqpId eqpModel process ipAddr ipAddrL onoff')
    .sort({ eqpId: 1 })
    .lean()

  return clients.map(c => ({
    eqpId: c.eqpId,
    eqpModel: c.eqpModel,
    process: c.process,
    ipAddress: c.ipAddr,
    innerIp: c.ipAddrL || null,
    status: c.onoff === 1 ? 'online' : 'offline'
  }))
}

module.exports = {
  getProcesses,
  getModels,
  getLines,
  getClients,
  getClientsPaginated,
  getClientById,
  getClientLogs,
  getMasterData,
  createClients,
  updateClients,
  deleteClients,
  clientExists,
  getClientsByModel
}
