/**
 * Strategy Registry
 * serviceType별 Strategy 모듈을 등록하고 조회한다.
 */

const strategies = new Map()

function register(strategy) {
  strategies.set(strategy.id, strategy)
}

function get(serviceType) {
  return strategies.get(serviceType) || null
}

function list() {
  return Array.from(strategies.values()).map(s => ({
    id: s.id,
    displayType: s.displayType,
    label: s.label,
    actions: Object.entries(s.actions)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([name, meta]) => ({ name, ...meta }))
  }))
}

// Auto-register strategies
const arsAgentWinSc = require('./arsAgentWinSc')
register(arsAgentWinSc)

module.exports = { register, get, list }
