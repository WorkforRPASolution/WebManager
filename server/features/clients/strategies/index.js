/**
 * Strategy Registry
 * agentGroup:serviceType별 Strategy 모듈을 등록하고 조회한다.
 */

const strategies = new Map()

function register(strategy) {
  const key = `${strategy.agentGroup}:${strategy.serviceType}`
  strategies.set(key, strategy)
}

function get(agentGroup, serviceType) {
  return strategies.get(`${agentGroup}:${serviceType}`) || null
}

function hasServiceType(serviceType) {
  return [...strategies.values()].some(s => s.serviceType === serviceType)
}

function list() {
  return Array.from(strategies.values()).map(s => ({
    agentGroup: s.agentGroup,
    serviceType: s.serviceType,
    displayType: s.displayType,
    label: s.label,
    actions: Object.entries(s.actions)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([name, meta]) => ({ name, ...meta }))
  }))
}

function getDefault(agentGroup) {
  return [...strategies.values()].find(
    s => s.agentGroup === agentGroup && s.isDefault
  ) || null
}

// Auto-register strategies
const arsAgentWinSc = require('./arsAgentWinSc')
const resourceAgentWinSc = require('./resourceAgentWinSc')

register(arsAgentWinSc)
register(resourceAgentWinSc)


module.exports = { register, get, getDefault, hasServiceType, list }
