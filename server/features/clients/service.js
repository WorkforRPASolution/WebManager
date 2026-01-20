/**
 * Client service - Database operations and business logic
 */

const Client = require('./model')
const { parsePaginationParams } = require('../../shared/utils/pagination')
const { validateBatchCreate, validateUpdate } = require('./validation')

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
function transformClientDetail(client) {
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
 * Get distinct model list (optionally filtered by process)
 */
async function getModels(processFilter) {
  const query = {}
  if (processFilter) {
    const filter = parseCommaSeparated(processFilter)
    if (filter) query.process = filter
  }
  const models = await Client.distinct('eqpModel', query)
  return models.sort()
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
async function getClientById(eqpId) {
  const client = await Client.findOne({ eqpId })
  if (!client) return null
  return transformClientDetail(client)
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
 * Get master data with pagination
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
 */
async function createClients(clientsData) {
  // Get existing IDs and IPs for validation
  const existingClients = await Client.find({}, 'eqpId ipAddr').lean()
  const existingIds = existingClients.map(c => c.eqpId)
  const existingIps = existingClients.map(c => c.ipAddr)

  // Validate
  const { valid, errors } = validateBatchCreate(clientsData, existingIds, existingIps)

  // Insert valid clients
  let created = 0
  if (valid.length > 0) {
    const inserted = await Client.insertMany(valid)
    created = inserted.length
  }

  return { created, errors }
}

/**
 * Update multiple clients
 */
async function updateClients(clientsData) {
  const errors = []
  let updated = 0

  // Get all other clients' IDs and IPs once (avoid N+1)
  const allClients = await Client.find({}, '_id eqpId ipAddr').lean()

  for (let i = 0; i < clientsData.length; i++) {
    const clientData = clientsData[i]
    const { _id, ...updateData } = clientData

    if (!_id) {
      errors.push({ rowIndex: i, field: '_id', message: '_id is required for update' })
      continue
    }

    // Get other clients (excluding current one)
    const otherClients = allClients.filter(c => c._id.toString() !== _id)
    const existingIds = otherClients.map(c => c.eqpId)
    const existingIps = otherClients.map(c => c.ipAddr)

    // Validate
    const validation = validateUpdate(updateData, existingIds, existingIps)

    if (!validation.valid) {
      for (const [field, message] of Object.entries(validation.errors)) {
        errors.push({ rowIndex: i, field, message })
      }
      continue
    }

    const result = await Client.updateOne({ _id }, { $set: updateData })
    if (result.modifiedCount > 0) {
      updated++
    }
  }

  return { updated, errors }
}

/**
 * Delete multiple clients
 */
async function deleteClients(ids) {
  const result = await Client.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

/**
 * Check if client exists
 */
async function clientExists(eqpId) {
  const client = await Client.findOne({ eqpId })
  return !!client
}

module.exports = {
  getProcesses,
  getModels,
  getClients,
  getClientsPaginated,
  getClientById,
  getClientLogs,
  getMasterData,
  createClients,
  updateClients,
  deleteClients,
  clientExists
}
