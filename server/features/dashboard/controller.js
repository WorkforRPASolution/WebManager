const service = require('./service')

async function getSummary(req, res) {
  const result = await service.getDashboardSummary()
  res.json(result)
}

async function getAgentStatus(req, res) {
  const { process, eqpModel, groupByModel, includeDetails } = req.query
  const result = await service.getAgentStatus({
    process: process || null,
    eqpModel: eqpModel || null,
    groupByModel: groupByModel === 'true',
    includeDetails: includeDetails === 'true'
  })
  res.json(result)
}

async function getAgentVersionDistribution(req, res) {
  const { process, eqpModel, groupByModel, runningOnly, includeDetails } = req.query
  const result = await service.getAgentVersionDistribution({
    process: process || null,
    eqpModel: eqpModel || null,
    groupByModel: groupByModel === 'true',
    runningOnly: runningOnly === 'true',
    includeDetails: includeDetails === 'true'
  })
  res.json(result)
}

async function getResourceAgentStatus(req, res) {
  const { process, eqpModel, groupByModel, includeDetails } = req.query
  const result = await service.getResourceAgentStatus({
    process: process || null,
    eqpModel: eqpModel || null,
    groupByModel: groupByModel === 'true',
    includeDetails: includeDetails === 'true'
  })
  res.json(result)
}

async function getResourceAgentVersionDistribution(req, res) {
  const { process, eqpModel, groupByModel, runningOnly, includeDetails } = req.query
  const result = await service.getResourceAgentVersionDistribution({
    process: process || null,
    eqpModel: eqpModel || null,
    groupByModel: groupByModel === 'true',
    runningOnly: runningOnly === 'true',
    includeDetails: includeDetails === 'true'
  })
  res.json(result)
}

module.exports = { getSummary, getAgentStatus, getAgentVersionDistribution, getResourceAgentStatus, getResourceAgentVersionDistribution }
