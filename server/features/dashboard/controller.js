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

module.exports = { getAgentStatus }
