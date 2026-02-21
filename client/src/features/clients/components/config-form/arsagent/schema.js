/**
 * arsagent/schema.js
 *
 * ARSAgent configuration schema.
 */

export const ARSAGENT_SCHEMA = {
  sections: {
    ErrorTrigger: {
      label: 'Error Trigger',
      description: '에이전트가 사용할 트리거 규칙을 선택합니다. trigger.json에서 정의한 트리거 중 활성화할 항목을 선택하세요.',
      type: 'trigger-list'
    },
    AccessLogLists: {
      label: 'Access Log Lists',
      description: '에이전트가 모니터링할 로그 소스를 선택합니다. AccessLog.json에서 정의한 소스 중 활성화할 항목을 선택하세요.',
      type: 'source-list'
    }
  }
}
