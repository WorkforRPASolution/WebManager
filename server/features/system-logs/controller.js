const service = require('./service')
const { validateCategory, validatePeriod } = require('./validation')

// Dependency injection for testing
let deps = {}
function _setDeps(d) { deps = d }
function getService() { return deps.service || service }

async function getLogs(req, res) {
  const { category, userId, action, startDate, endDate, search, page, pageSize } = req.query

  const catError = validateCategory(category)
  if (catError) return res.status(400).json({ error: catError })

  const result = await getService().queryLogs({
    category, userId, action, startDate, endDate, search, page, pageSize
  })

  res.json(result)
}

async function getLogDetail(req, res) {
  const { id } = req.params

  const log = await getService().getLogById(id)
  if (!log) return res.status(404).json({ error: 'Log not found' })

  res.json(log)
}

async function getStats(req, res) {
  const { period, startDate, endDate } = req.query

  const periodError = validatePeriod(period)
  if (periodError) return res.status(400).json({ error: periodError })

  const result = await getService().getStatistics({
    period: period || 'today',
    startDate,
    endDate
  })

  res.json(result)
}

module.exports = {
  getLogs,
  getLogDetail,
  getStats,
  _setDeps
}
