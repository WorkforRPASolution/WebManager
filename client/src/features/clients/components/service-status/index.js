import ArsAgentStatus from './ArsAgentStatus.vue'
import DefaultStatus from './DefaultStatus.vue'

const statusComponents = {
  ars_agent: ArsAgentStatus,
}

export function getStatusComponent(displayType) {
  return statusComponents[displayType] || DefaultStatus
}

export { ArsAgentStatus, DefaultStatus }
