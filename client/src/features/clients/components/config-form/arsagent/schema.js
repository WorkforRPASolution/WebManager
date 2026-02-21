/**
 * arsagent/schema.js
 *
 * ARSAgent configuration schema.
 */

export const CRONTAB_DEFAULTS = {
  name: '', type: 'AR', arg: '', 'no-email': '', key: '', timeout: '', retry: ''
}

export function createDefaultCronTab() {
  return { ...CRONTAB_DEFAULTS }
}

export const REQUIRED_FIELDS = [
  'VirtualAddressList', 'AliveSignalInterval', 'RedisPingInterval',
  'IsSendAgentStatus2Redis', 'AgentPort4RPC', 'ScenarioCheckInterval',
  'UpdateServerAddressInterval', 'IgnoreEventBetweenTime', 'TransferImagerInterval',
  'IsSnapshotRecordingOn', 'IsSnapshotRecordingDuringRecovery', 'SnapshotFormat',
  'InformDialogSize', 'MouseEventDelay', 'MouseEventDelayDoubleClick',
  'CpuMonitoringInterval', 'MemMonitoringInterval', 'TotalCpuPercentLimit',
  'AgentCpuPercentLimit', 'FileChangeMonitorInterval', 'UseUploadLog',
  'ResourceMonitorInterval', 'PopupSrcLocalMode', 'UseDataBackup',
  'UseRouter', 'PrivateIPAddressPattern'
]

export const OPTIONAL_FIELDS = [
  'AgentPort4ScreenProtector', 'IsStandAloneMode', 'ShowEQPLog',
  'VisionType', 'CommandType'
]

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
    },
    CronTab: {
      label: 'CronTab',
      description: '주기적으로 실행할 예약 작업을 설정합니다.',
      type: 'crontab-list'
    }
  },

  cronTabFields: {
    name: { type: 'text', label: 'Action 이름', required: true, description: '실행할 시나리오 또는 작업의 이름입니다.', placeholder: 'Scenario_Check' },
    type: {
      type: 'select', label: 'Action 타입', required: true,
      description: 'AR: 시나리오 실행, SR: 코드 시나리오, EN: 이메일 발송, PU: 팝업 실행',
      options: [
        { value: 'AR', label: 'AR (시나리오 실행)' },
        { value: 'SR', label: 'SR (코드 시나리오)' },
        { value: 'EN', label: 'EN (이메일 발송)' },
        { value: 'PU', label: 'PU (팝업 실행)' }
      ]
    },
    arg: { type: 'text', label: '인자 (Arguments)', required: false, description: '작업에 전달할 인자입니다. 세미콜론(;)으로 구분합니다.', placeholder: 'arg1;arg2' },
    'no-email': { type: 'no-email', label: '이메일 비발송 조건', required: false, description: '이메일 알림을 보내지 않을 결과값입니다. 세미콜론(;)으로 구분합니다.' },
    key: { type: 'number', label: '실행 키', required: false, description: '동일한 키를 가진 작업은 동시에 실행되지 않습니다.', placeholder: '1' },
    timeout: { type: 'text', label: '타임아웃', required: false, description: '작업 실행 최대 대기 시간입니다. 초과 시 강제 종료됩니다.', placeholder: '30 seconds' },
    retry: { type: 'text', label: '재시도 간격', required: false, description: '작업 실패 시 다음 재시도까지 대기 시간입니다.', placeholder: '3 minutes' }
  },

  fields: {
    VirtualAddressList: { type: 'text', label: '가상 주소 목록', required: true, default: '', description: 'Akka 서버의 가상 주소 목록입니다. 콤마(,)로 구분합니다.' },
    AliveSignalInterval: { type: 'duration', label: 'Alive 신호 주기', required: true, default: '5 minutes', description: '서버에 에이전트 생존 신호를 보내는 주기입니다.' },
    RedisPingInterval: { type: 'duration', label: 'Redis Ping 주기', required: true, default: '5 minutes', description: 'Redis 서버에 Ping을 보내는 주기입니다.' },
    IsSendAgentStatus2Redis: { type: 'boolean', label: 'Redis 상태 전송', required: true, default: false, description: '에이전트 상태 정보를 Redis에 전송할지 여부입니다.' },
    AgentPort4RPC: { type: 'number', label: 'RPC 포트', required: true, default: 50100, description: '에이전트가 서버 RPC 요청을 수신하는 포트 번호입니다.' },
    ScenarioCheckInterval: { type: 'duration', label: '시나리오 체크 주기', required: true, default: '1 seconds', description: '대기 중인 시나리오 실행 요청을 확인하는 주기입니다.' },
    UpdateServerAddressInterval: { type: 'duration', label: '서버 주소 갱신 주기', required: true, default: '100 minutes', description: 'Akka 서버 주소 목록을 갱신하는 주기입니다.' },
    IgnoreEventBetweenTime: { type: 'duration', label: '이벤트 무시 간격', required: true, default: '300 milliseconds', description: '동일 이벤트가 연속 발생할 때 무시하는 최소 간격입니다.' },
    TransferImagerInterval: { type: 'duration', label: '이미지 전송 주기', required: true, default: '5 seconds', description: '스냅샷 이미지를 서버로 전송하는 주기입니다.' },
    IsSnapshotRecordingOn: { type: 'boolean', label: '스냅샷 녹화', required: true, default: true, description: '화면 스냅샷 녹화 기능을 사용할지 여부입니다.' },
    IsSnapshotRecordingDuringRecovery: { type: 'boolean', label: '복구 중 스냅샷 녹화', required: true, default: false, description: '복구 시나리오 실행 중에도 스냅샷을 녹화할지 여부입니다.' },
    SnapshotFormat: { type: 'text', label: '스냅샷 포맷', required: true, default: 'png', description: '스냅샷 이미지 파일 형식입니다. (png, jpg)' },
    InformDialogSize: { type: 'text', label: '알림 대화상자 크기', required: true, default: '800:280', description: '에이전트 알림 팝업의 크기입니다. (너비:높이)' },
    MouseEventDelay: { type: 'number', label: '마우스 이벤트 지연', required: true, default: 300, description: '마우스 클릭 이벤트 처리 시 지연 시간(ms)입니다.' },
    MouseEventDelayDoubleClick: { type: 'number', label: '더블클릭 지연', required: true, default: 50, description: '더블클릭 판정 시 두 클릭 사이 최대 간격(ms)입니다.' },
    CpuMonitoringInterval: { type: 'duration', label: 'CPU 모니터링 주기', required: true, default: '2 minutes', description: 'CPU 사용률을 측정하는 주기입니다.' },
    MemMonitoringInterval: { type: 'duration', label: '메모리 모니터링 주기', required: true, default: '10 minutes', description: '메모리 사용률을 측정하는 주기입니다.' },
    TotalCpuPercentLimit: { type: 'number', label: '전체 CPU 제한 (%)', required: true, default: 90, description: '시스템 전체 CPU 사용률이 이 값을 초과하면 경고합니다.' },
    AgentCpuPercentLimit: { type: 'number', label: '에이전트 CPU 제한 (%)', required: true, default: 20, description: '에이전트 프로세스 CPU 사용률이 이 값을 초과하면 경고합니다.' },
    FileChangeMonitorInterval: { type: 'duration', label: '파일 변경 감지 주기', required: true, default: '10 seconds', description: '모니터링 대상 파일의 변경을 확인하는 주기입니다.' },
    UseUploadLog: { type: 'boolean', label: '로그 업로드 사용', required: true, default: true, description: '에이전트 로그를 서버로 업로드할지 여부입니다.' },
    ResourceMonitorInterval: { type: 'duration', label: '리소스 모니터 주기', required: true, default: '2 minutes', description: '디스크, 네트워크 등 시스템 리소스를 모니터링하는 주기입니다.' },
    PopupSrcLocalMode: { type: 'boolean', label: '팝업 로컬 모드', required: true, default: false, description: '팝업 리소스를 로컬에서 로드할지 여부입니다.' },
    UseDataBackup: { type: 'boolean', label: '데이터 백업 사용', required: true, default: false, description: '에이전트 데이터 자동 백업 기능을 사용할지 여부입니다.' },
    UseRouter: { type: 'boolean', label: '라우터 사용', required: true, default: false, description: '내부 네트워크 라우터를 통해 서버에 접속할지 여부입니다.' },
    PrivateIPAddressPattern: { type: 'text', label: '사설 IP 패턴', required: true, default: '', description: '라우터 사용 시 사설 IP 대역을 식별하는 정규식 패턴입니다.' },
    AgentPort4ScreenProtector: { type: 'number', label: 'ScreenProtector 포트', required: false, default: 32126, description: 'ScreenProtector 서비스가 사용하는 포트 번호입니다.' },
    IsStandAloneMode: { type: 'boolean', label: '독립 실행 모드', required: false, default: false, description: '서버 연결 없이 에이전트를 단독으로 실행할지 여부입니다.' },
    ShowEQPLog: { type: 'boolean', label: '장비 로그 표시', required: false, default: false, description: '에이전트 UI에 장비 로그를 표시할지 여부입니다.' },
    VisionType: {
      type: 'select', label: 'Vision 타입', required: false, default: 'thrift',
      description: '화면 인식 엔진과의 통신 프로토콜입니다.',
      options: [
        { value: 'thrift', label: 'thrift' },
        { value: 'grpc', label: 'grpc' },
        { value: 'http', label: 'http' }
      ]
    },
    CommandType: {
      type: 'select', label: 'Command 타입', required: false, default: 'http',
      description: '명령 실행 엔진과의 통신 프로토콜입니다.',
      options: [
        { value: 'http', label: 'http' },
        { value: 'grpc', label: 'grpc' }
      ]
    }
  },

  fieldGroups: [
    { name: '네트워크', fields: ['VirtualAddressList', 'AgentPort4RPC'] },
    { name: '시스템 통신', fields: ['AliveSignalInterval', 'RedisPingInterval', 'IsSendAgentStatus2Redis', 'UpdateServerAddressInterval'] },
    { name: '시나리오/이벤트', fields: ['ScenarioCheckInterval', 'IgnoreEventBetweenTime'] },
    { name: '스냅샷', fields: ['IsSnapshotRecordingOn', 'IsSnapshotRecordingDuringRecovery', 'SnapshotFormat', 'TransferImagerInterval'] },
    { name: 'UI/마우스', fields: ['MouseEventDelay', 'MouseEventDelayDoubleClick', 'InformDialogSize'] },
    { name: 'CPU/메모리', fields: ['CpuMonitoringInterval', 'MemMonitoringInterval', 'TotalCpuPercentLimit', 'AgentCpuPercentLimit'] },
    { name: '파일/데이터', fields: ['FileChangeMonitorInterval', 'UseUploadLog', 'ResourceMonitorInterval', 'UseDataBackup'] },
    { name: '라우터/통신', fields: ['UseRouter', 'PrivateIPAddressPattern', 'PopupSrcLocalMode'] },
    { name: '선택 항목', fields: ['AgentPort4ScreenProtector', 'IsStandAloneMode', 'ShowEQPLog', 'VisionType', 'CommandType'] }
  ]
}

function coerceValue(value, fieldDef) {
  if (fieldDef.type === 'number') return Number(value)
  if (fieldDef.type === 'boolean') return Boolean(value)
  return value
}

export function buildARSAgentOutput(formData) {
  const d = formData || {}
  const result = {}

  result.ErrorTrigger = d.ErrorTrigger || []
  result.AccessLogLists = d.AccessLogLists || []

  result.CronTab = (d.CronTab || []).map(entry => {
    const out = { name: entry.name, type: entry.type }
    if (entry.arg !== undefined && entry.arg !== '') out.arg = entry.arg
    if (entry['no-email'] !== undefined && entry['no-email'] !== '') out['no-email'] = entry['no-email']
    if (entry.key !== undefined && entry.key !== '') out.key = Number(entry.key)
    if (entry.timeout !== undefined && entry.timeout !== '') out.timeout = entry.timeout
    if (entry.retry !== undefined && entry.retry !== '') out.retry = entry.retry
    return out
  })

  for (const fieldName of REQUIRED_FIELDS) {
    const fieldDef = ARSAGENT_SCHEMA.fields[fieldName]
    const val = fieldName in d ? d[fieldName] : fieldDef.default
    result[fieldName] = coerceValue(val, fieldDef)
  }

  for (const fieldName of OPTIONAL_FIELDS) {
    if (d[`_omit_${fieldName}`] === true) continue
    const fieldDef = ARSAGENT_SCHEMA.fields[fieldName]
    const val = fieldName in d ? d[fieldName] : fieldDef.default
    result[fieldName] = coerceValue(val, fieldDef)
  }

  return result
}

export function parseARSAgentInput(config) {
  const result = { ...config }

  if (!result.ErrorTrigger) result.ErrorTrigger = []
  if (!result.AccessLogLists) result.AccessLogLists = []
  if (!result.CronTab) result.CronTab = []

  for (const fieldName of REQUIRED_FIELDS) {
    if (!(fieldName in result)) {
      result[fieldName] = ARSAGENT_SCHEMA.fields[fieldName].default
    }
  }

  for (const fieldName of OPTIONAL_FIELDS) {
    result[`_omit_${fieldName}`] = !(fieldName in config)
    if (!(fieldName in result)) {
      result[fieldName] = ARSAGENT_SCHEMA.fields[fieldName].default
    }
  }

  return result
}
