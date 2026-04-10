/**
 * Client service - Database operations and business logic
 */

const Client = require('./model')
const { parsePaginationParams } = require('../../shared/utils/pagination')
const { validateBatchCreate, validateUpdate } = require('./validation')
const { createRulesContext } = require('../../shared/utils/businessRules')
const strategyRegistry = require('./strategies')
const { distinctWithCount } = require('../../shared/utils/aggregateHelpers')
const { ensureLongFields, stripNullFields, separateNullFields } = require('../../shared/utils/mongoLong')

// EQP_INFO 정수 필드 — BSON Long(int64)으로 저장할 필드 목록
const EQP_INFO_LONG_FIELDS = [
  'localpc', 'onoff', 'webmanagerUse', 'usereleasemsg', 'usetkincancel',
  'snapshotTimeDiff',
  'agentPorts.rpc', 'agentPorts.ftp', 'agentPorts.socks'
]

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
    innerIp: client.ipAddrL || null,
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
  return distinctWithCount(Client, 'process')
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
  return distinctWithCount(Client, 'eqpModel', query)
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
  return distinctWithCount(Client, 'line', query)
}

/**
 * Get clients list (simple, no pagination)
 */
async function getClients(filters) {
  const query = buildClientQuery(filters)
  const clients = await Client.find(query)
    .select('eqpId eqpModel process ipAddr onoff osVer category line')
    .sort({ eqpId: 1 })
    .lean()

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
      .select('eqpId eqpModel process ipAddr ipAddrL onoff osVer category line')
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

  // 4. Build uniqueness lookup structures (Set/Map for O(1) checks)
  // existingIpCombos: Map<combo, Set<eqpId>> — IP unique 인덱스가 없으므로 같은 조합이 여러 행에 존재 가능
  const existingClients = await Client.find({}, 'eqpId ipAddr ipAddrL').lean()
  const existingEqpIds = new Set(existingClients.map(c => c.eqpId?.toLowerCase()).filter(Boolean))
  existingEqpIds._originals = new Map(existingClients.filter(c => c.eqpId).map(c => [c.eqpId.toLowerCase(), c.eqpId]))
  const existingIpCombos = new Map()
  for (const c of existingClients) {
    const combo = `${c.ipAddr || ''}|${c.ipAddrL || ''}`
    if (!existingIpCombos.has(combo)) existingIpCombos.set(combo, new Set())
    existingIpCombos.get(combo).add(c.eqpId || String(c._id))
  }

  // 5. Validate format and uniqueness
  const { valid, errors: validationErrors } = validateBatchCreate(dataToValidate, existingEqpIds, existingIpCombos)

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

  // 6. Insert valid clients (M9: ordered:false + 부분 실패 처리로 audit 정합성 유지)
  let created = 0
  let insertedDocs = []
  if (valid.length > 0) {
    // NumberLong 변환 + null 필드 제거 (필드 부재로 처리)
    const prepared = valid.map(item =>
      stripNullFields(ensureLongFields(item, EQP_INFO_LONG_FIELDS))
    )
    try {
      insertedDocs = await Client.insertMany(prepared, { ordered: false })
      created = insertedDocs.length
    } catch (err) {
      // mongoose MongoBulkWriteError: 부분 성공 docs는 err.insertedDocs에 있음
      const partialDocs = err.insertedDocs || []
      insertedDocs = partialDocs
      created = partialDocs.length
      const writeErrors = err.writeErrors || (err.result && err.result.writeErrors) || []
      if (writeErrors.length === 0 && partialDocs.length === 0) {
        // 부분 성공/실패 정보 추출 불가 → 원본 에러 전파
        throw err
      }
      for (const we of writeErrors) {
        const idx = we.index ?? we.err?.index
        const failed = (idx !== undefined && idx !== null) ? valid[idx] : null
        const msg = we.errmsg || we.err?.errmsg || we.message || 'Insert failed'
        errors.push({
          rowIndex: idx ?? -1,
          field: failed?.eqpId ? 'eqpId' : '_id',
          message: failed?.eqpId ? `${failed.eqpId}: ${msg}` : msg
        })
      }
    }
  }

  // 7. Execute afterCreate hooks (with created data for audit logging)
  if (insertedDocs.length > 0) {
    await rules.executeHooks('afterCreate', insertedDocs.map(d => d.toObject()), context)
  }

  return { created, errors, syncStatus: context.syncStatus || null }
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

  // Split queries: fetch only target docs + lightweight uniqueness data
  const updateIds = clientsData.map(d => d._id).filter(Boolean)
  const [targetDocs, uniquenessData] = await Promise.all([
    Client.find({ _id: { $in: updateIds } }).lean(),
    Client.find({}, 'eqpId ipAddr ipAddrL').lean()
  ])
  const clientsById = new Map(targetDocs.map(c => [c._id.toString(), c]))

  // Build Set/Map for O(1) uniqueness lookups
  // allIpCombos: Map<combo, Set<eqpId>> — 동일 IP 조합 중복 보존
  const allEqpIds = new Set(uniquenessData.map(c => c.eqpId?.toLowerCase()).filter(Boolean))
  allEqpIds._originals = new Map(uniquenessData.filter(c => c.eqpId).map(c => [c.eqpId.toLowerCase(), c.eqpId]))
  const allIpCombos = new Map()
  for (const c of uniquenessData) {
    const combo = `${c.ipAddr || ''}|${c.ipAddrL || ''}`
    if (!allIpCombos.has(combo)) allIpCombos.set(combo, new Set())
    allIpCombos.get(combo).add(c.eqpId || String(c._id))
  }

  const updatedIdsList = []
  const previousDocsList = []
  const bulkOps = []

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

    // 4. Temporarily remove self from uniqueness structures for per-item validation
    // (in-place 변경 후 finally에서 복원 — 매 iteration 클론 회피로 메모리 절감)
    const selfEqpIdLower = existingDoc.eqpId?.toLowerCase()
    const selfEqpIdOriginal = existingDoc.eqpId
    const selfIpCombo = `${existingDoc.ipAddr || ''}|${existingDoc.ipAddrL || ''}`
    const selfIpComboKey = existingDoc.eqpId || String(existingDoc._id)

    let removedEqpId = false
    if (selfEqpIdLower && allEqpIds.has(selfEqpIdLower)) {
      allEqpIds.delete(selfEqpIdLower)
      removedEqpId = true
    }

    let removedFromIpSet = false
    let ipSetBecameEmpty = false
    const ipConflictSet = allIpCombos.get(selfIpCombo)
    if (ipConflictSet && ipConflictSet.has(selfIpComboKey)) {
      ipConflictSet.delete(selfIpComboKey)
      removedFromIpSet = true
      if (ipConflictSet.size === 0) {
        allIpCombos.delete(selfIpCombo)
        ipSetBecameEmpty = true
      }
    }

    // 5. Validate format and uniqueness
    const validation = validateUpdate(processedData, allEqpIds, allIpCombos)

    if (!validation.valid) {
      // 검증 실패 → self를 원래대로 복원하여 다음 iteration의 set 정합성 유지
      if (removedEqpId) allEqpIds.add(selfEqpIdLower)
      if (removedFromIpSet) {
        if (ipSetBecameEmpty) allIpCombos.set(selfIpCombo, new Set())
        allIpCombos.get(selfIpCombo).add(selfIpComboKey)
      }
      for (const [field, message] of Object.entries(validation.errors)) {
        errors.push({ rowIndex: i, field, message })
      }
      continue
    }

    // 6. Queue update operation (will be batched via bulkWrite)
    // NumberLong 변환 + null 필드를 $unset으로 분리
    const longData = ensureLongFields(processedData, EQP_INFO_LONG_FIELDS)
    const { $set, $unset } = separateNullFields(longData)
    const update = {}
    if (Object.keys($set).length > 0) update.$set = $set
    if (Object.keys($unset).length > 0) update.$unset = $unset
    if (Object.keys(update).length === 0) continue
    bulkOps.push({
      updateOne: {
        filter: { _id },
        update
      }
    })
    updatedIdsList.push(_id)
    previousDocsList.push(existingDoc)

    // I-NEW-4: 검증 통과 후 새 eqpId/IP를 set에 갱신 (cross-row uniqueness)
    // processedData에 명시되지 않은 필드는 기존 값 유지
    const newEqpIdOriginal = processedData.eqpId !== undefined ? processedData.eqpId : selfEqpIdOriginal
    const newEqpIdLower = newEqpIdOriginal?.toLowerCase?.()
    const newIpAddr = processedData.ipAddr !== undefined ? processedData.ipAddr : existingDoc.ipAddr
    const newIpAddrL = processedData.ipAddrL !== undefined ? processedData.ipAddrL : existingDoc.ipAddrL
    const newIpCombo = `${newIpAddr || ''}|${newIpAddrL || ''}`
    const newIpComboKey = newEqpIdOriginal || String(existingDoc._id)

    if (newEqpIdLower) {
      allEqpIds.add(newEqpIdLower)
      if (allEqpIds._originals && newEqpIdOriginal) {
        allEqpIds._originals.set(newEqpIdLower, newEqpIdOriginal)
      }
    }
    if (!allIpCombos.has(newIpCombo)) allIpCombos.set(newIpCombo, new Set())
    allIpCombos.get(newIpCombo).add(newIpComboKey)
  }

  // Execute all updates in a single bulkWrite (I-NEW-2/3: matchedCount + 부분 실패 처리)
  if (bulkOps.length > 0) {
    let bulkResult = null
    try {
      bulkResult = await Client.bulkWrite(bulkOps, { ordered: false })
    } catch (err) {
      // BulkWriteError: 부분 성공 결과 추출
      bulkResult = err.result || null
      const writeErrors = err.writeErrors || (err.result && err.result.writeErrors) || []
      if (!bulkResult && writeErrors.length === 0) {
        throw err
      }
      // 실패한 row의 _id 추출
      const failedIndices = new Set()
      for (const we of writeErrors) {
        const idx = we.index ?? we.err?.index
        const failedId = (idx !== undefined && idx !== null) ? updatedIdsList[idx] : null
        const msg = we.errmsg || we.err?.errmsg || we.message || 'Update failed'
        errors.push({
          rowIndex: idx ?? -1,
          field: '_id',
          message: failedId ? `${failedId}: ${msg}` : msg
        })
        if (idx !== undefined && idx !== null) failedIndices.add(idx)
      }
      // audit 정합성: 실패한 row를 updatedIdsList/previousDocsList에서 제거
      if (failedIndices.size > 0) {
        const newIds = []
        const newPrev = []
        for (let j = 0; j < updatedIdsList.length; j++) {
          if (!failedIndices.has(j)) {
            newIds.push(updatedIdsList[j])
            newPrev.push(previousDocsList[j])
          }
        }
        updatedIdsList.length = 0
        previousDocsList.length = 0
        updatedIdsList.push(...newIds)
        previousDocsList.push(...newPrev)
      }
    }
    if (bulkResult) {
      // matchedCount 사용: 동일 데이터 재저장(modifiedCount=0)도 성공으로 카운트
      updated = bulkResult.matchedCount ?? bulkResult.modifiedCount ?? 0
    }
  }

  // Batch fetch all updated docs for audit logging
  if (updatedIdsList.length > 0) {
    const updatedDocsMap = new Map()
    const fetchedDocs = await Client.find({ _id: { $in: updatedIdsList } }).lean()
    for (const doc of fetchedDocs) updatedDocsMap.set(doc._id.toString(), doc)

    // Maintain parallel array order
    for (let i = 0; i < updatedIdsList.length; i++) {
      const id = updatedIdsList[i]
      const doc = updatedDocsMap.get(id.toString ? id.toString() : id)
      if (doc) {
        previousDocs.push(previousDocsList[i])
        updatedDocs.push(doc)
      }
    }
  }

  // 7. Execute afterUpdate hooks (with change tracking for audit logging)
  if (updatedDocs.length > 0) {
    const hookContext = { ...context, previousData: previousDocs, newData: updatedDocs }
    await rules.executeHooks('afterUpdate', updatedDocs, hookContext)
    context.syncStatus = hookContext.syncStatus
  }

  return { updated, errors, syncStatus: context.syncStatus || null }
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
    const hookContext = { ...context, deletedData: documentsToDelete }
    await rules.executeHooks('afterDelete', null, hookContext)
    context.syncStatus = hookContext.syncStatus
  }

  return { deleted: result.deletedCount, syncStatus: context.syncStatus || null }
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
