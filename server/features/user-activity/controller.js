/**
 * User Activity Controller
 * Parses request parameters and delegates to service layer.
 */

const service = require('./service')
const scenarioService = require('./scenarioService')
const webManagerService = require('./webManagerService')
const { createLogger } = require('../../shared/logger')
const log = createLogger('user-activity')

async function getToolUsage(req, res) {
  const { period, process, startDate, includeAdmin, noLimit } = req.query

  if (period === 'custom') {
    if (!startDate) {
      return res.status(400).json({ error: 'startDate is required for custom period' })
    }
    const s = new Date(startDate)
    if (isNaN(s.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' })
    }
    if (s > new Date()) {
      return res.status(400).json({ error: 'startDate cannot be in the future' })
    }
    const diffDays = (Date.now() - s.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 730) {
      return res.status(400).json({ error: 'startDate cannot be more than 2 years ago' })
    }
  }

  const result = await service.getToolUsage({
    period: period || 'all',
    process: process || undefined,
    startDate,
    includeAdmin: includeAdmin === 'true',
    noLimit: noLimit === 'true'
  })
  res.json(result)
}

async function getScenarioStats(req, res) {
  const { period, process, startDate, noLimit } = req.query

  if (period === 'custom') {
    if (!startDate) {
      return res.status(400).json({ error: 'startDate is required for custom period' })
    }
    const s = new Date(startDate)
    if (isNaN(s.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' })
    }
    if (s > new Date()) {
      return res.status(400).json({ error: 'startDate cannot be in the future' })
    }
    const diffDays = (Date.now() - s.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 730) {
      return res.status(400).json({ error: 'startDate cannot be more than 2 years ago' })
    }
  }

  const result = await scenarioService.getScenarioStats({
    period: period || 'all',
    process: process || undefined,
    startDate,
    noLimit: noLimit === 'true'
  })
  res.json(result)
}

async function getScenarioDetails(req, res) {
  const { process } = req.query
  const result = await scenarioService.getScenarioDetails({
    process: process || undefined
  })
  res.json(result)
}

async function getWebManagerStats(req, res) {
  const { period, startDate, endDate, includeAdmin, noLimit, recentMode } = req.query

  if (period === 'custom') {
    if (!startDate) {
      return res.status(400).json({ error: 'startDate is required for custom period' })
    }
    const s = new Date(startDate)
    if (isNaN(s.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' })
    }
    if (s > new Date()) {
      return res.status(400).json({ error: 'startDate cannot be in the future' })
    }
    const diffDays = (Date.now() - s.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 90) {
      return res.status(400).json({ error: 'startDate cannot be more than 90 days ago' })
    }
  }

  const result = await webManagerService.getWebManagerStats({
    period: period || 'all',
    startDate,
    endDate,
    includeAdmin: includeAdmin === 'true',
    noLimit: noLimit === 'true',
    recentMode: recentMode === 'user' ? 'user' : 'detail'
  })
  res.json(result)
}

module.exports = {
  getToolUsage,
  getScenarioStats,
  getScenarioDetails,
  getWebManagerStats
}
