const service = require('./service')

async function getAgentStatus(req, res) {
  const { process, eqpModel, groupByModel } = req.query
  const result = await service.getAgentStatus({
    process: process || null,
    eqpModel: eqpModel || null,
    groupByModel: groupByModel === 'true'
  })
  res.json(result)
}

async function getAgentVersionDistribution(req, res) {
  const { process, eqpModel, groupByModel, runningOnly } = req.query
  const result = await service.getAgentVersionDistribution({
    process: process || null,
    eqpModel: eqpModel || null,
    groupByModel: groupByModel === 'true',
    runningOnly: runningOnly === 'true'
  })
  res.json(result)
}

async function getResourceAgentStatus(req, res) {
  const { process, eqpModel, groupByModel } = req.query
  const result = await service.getResourceAgentStatus({
    process: process || null,
    eqpModel: eqpModel || null,
    groupByModel: groupByModel === 'true'
  })
  res.json(result)
}

async function getResourceAgentVersionDistribution(req, res) {
  const { process, eqpModel, groupByModel, runningOnly } = req.query
  const result = await service.getResourceAgentVersionDistribution({
    process: process || null,
    eqpModel: eqpModel || null,
    groupByModel: groupByModel === 'true',
    runningOnly: runningOnly === 'true'
  })
  res.json(result)
}

module.exports = { getAgentStatus, getAgentVersionDistribution, getResourceAgentStatus, getResourceAgentVersionDistribution }
