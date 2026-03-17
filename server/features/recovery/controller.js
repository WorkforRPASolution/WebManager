/**
 * Recovery Dashboard Controller
 * Parses request parameters and delegates to service layer.
 */

const service = require('./service')
const { validatePeriodRange } = require('./validation')
const { parsePaginationParams, createPaginatedResponse } = require('../../shared/utils/pagination')

async function getOverview(req, res) {
  const { period, process, line } = req.query
  const result = await service.getOverview({
    period: period || 'today',
    process: process || undefined,
    line: line || undefined
  })
  res.json(result)
}

async function getByProcess(req, res) {
  const { period, line } = req.query
  const result = await service.getByProcess({
    period: period || 'today',
    line: line || undefined
  })
  res.json(result)
}

async function getAnalysis(req, res) {
  const { period, process, line, model, tab } = req.query
  const result = await service.getAnalysis({
    period: period || 'today',
    process: process || undefined,
    line: line || undefined,
    model: model || undefined,
    tab: tab || 'scenario'
  })
  res.json(result)
}

async function getHistory(req, res) {
  const { eqpid, ears_code, status, startDate, endDate } = req.query

  // Enforce 7-day limit
  const validation = validatePeriodRange(startDate, endDate, 7)
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error })
  }

  const { page, pageSize, skip, limit } = parsePaginationParams(req.query)
  const result = await service.getHistory({
    eqpid: eqpid || undefined,
    ears_code: ears_code || undefined,
    status: status || undefined,
    startDate,
    endDate,
    skip,
    limit
  })

  res.json(createPaginatedResponse(result.data, result.total, page, pageSize))
}

async function getLastAggregation(req, res) {
  const { getLastCronRun } = require('./recoverySummaryService')
  const hourly = await getLastCronRun('hourly')
  const daily = await getLastCronRun('daily')
  res.json({ hourly, daily })
}

module.exports = {
  getOverview,
  getByProcess,
  getAnalysis,
  getHistory,
  getLastAggregation
}
