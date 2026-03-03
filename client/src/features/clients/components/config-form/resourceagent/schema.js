/**
 * resourceagent/schema.js
 *
 * ResourceAgent.json configuration schema.
 * Nested config is flattened to dot-notation for formData.
 */

export const RESOURCEAGENT_SCHEMA = {
  fields: {
    // ── 전송 방식 ──
    SenderType: {
      type: 'select', label: '전송 방식', default: 'kafkarest',
      description: '메트릭 전송 방식을 선택합니다. kafkarest: KafkaRest Proxy, file: 로컬 파일',
      options: [
        { value: 'kafkarest', label: 'KafkaRest Proxy' },
        { value: 'kafka', label: 'Kafka 직접 전송', disabled: true },
        { value: 'file', label: '로컬 파일' }
      ]
    },

    // ── 파일 출력 ──
    'File.FilePath': {
      type: 'text', label: '파일 경로', default: 'log/ResourceAgent/metrics.log',
      description: '메트릭 출력 파일 경로입니다. basePath 기준 상대경로입니다.'
    },
    'File.MaxSizeMB': {
      type: 'number', label: '최대 파일 크기 (MB)', default: 10,
      description: '단일 파일 최대 크기(MB)입니다. 초과 시 로테이션됩니다.'
    },
    'File.MaxBackups': {
      type: 'number', label: '백업 파일 수', default: 3,
      description: '로테이션 시 유지할 백업 파일 수입니다.'
    },
    'File.Pretty': {
      type: 'boolean', label: 'JSON 들여쓰기', default: false,
      description: 'JSON 출력 시 들여쓰기를 적용할지 여부입니다.'
    },
    'File.Format': {
      type: 'select', label: '출력 포맷', default: 'grok',
      description: '파일 출력 포맷입니다. grok: EARS 호환 평문, json: JSON 형식.',
      options: [
        { value: 'grok', label: 'Grok (평문)' },
        { value: 'json', label: 'JSON' }
      ]
    },

    // ── Kafka 연결 ──
    'Kafka.BrokerPort': {
      type: 'number', label: '브로커 포트', default: 9092,
      description: 'Kafka 브로커 포트입니다 (1~65535). 호스트는 ServiceDiscovery에서 자동 결정됩니다.'
    },
    'Kafka.Compression': {
      type: 'select', label: '압축 방식', default: 'snappy',
      description: 'Kafka 메시지 압축 방식입니다.',
      options: [
        { value: 'none', label: 'None' },
        { value: 'gzip', label: 'Gzip' },
        { value: 'snappy', label: 'Snappy' },
        { value: 'lz4', label: 'LZ4' },
        { value: 'zstd', label: 'Zstd' }
      ]
    },
    'Kafka.RequiredAcks': {
      type: 'select', label: '응답 수준', default: 1,
      description: '프로듀서가 요구하는 브로커 응답 수준입니다.',
      options: [
        { value: 0, label: '0 (NoResponse)' },
        { value: 1, label: '1 (WaitForLocal)' },
        { value: -1, label: '-1 (WaitForAll)' }
      ]
    },
    'Kafka.Timeout': {
      type: 'go-duration', label: '타임아웃', default: '10s',
      description: 'Kafka 연결/요청 타임아웃입니다. Go duration 형식 (예: 10s, 30s).'
    },
    'Kafka.EnableTLS': {
      type: 'boolean', label: 'TLS 사용', default: false,
      description: 'TLS 암호화 활성화 여부입니다.'
    },
    'Kafka.TLSCertFile': {
      type: 'text', label: 'TLS 인증서 파일', default: '',
      description: 'TLS 클라이언트 인증서 파일 경로입니다.',
      conditional: { field: 'Kafka.EnableTLS', value: true }
    },
    'Kafka.TLSKeyFile': {
      type: 'text', label: 'TLS 키 파일', default: '',
      description: 'TLS 클라이언트 키 파일 경로입니다.',
      conditional: { field: 'Kafka.EnableTLS', value: true }
    },
    'Kafka.TLSCAFile': {
      type: 'text', label: 'TLS CA 파일', default: '',
      description: 'TLS CA 인증서 파일 경로입니다.',
      conditional: { field: 'Kafka.EnableTLS', value: true }
    },
    'Kafka.SASLEnabled': {
      type: 'boolean', label: 'SASL 사용', default: false,
      description: 'SASL 인증 활성화 여부입니다.'
    },
    'Kafka.SASLMechanism': {
      type: 'select', label: 'SASL 메커니즘', default: '',
      description: 'SASL 인증 메커니즘입니다.',
      conditional: { field: 'Kafka.SASLEnabled', value: true },
      options: [
        { value: 'PLAIN', label: 'PLAIN' },
        { value: 'SCRAM-SHA-256', label: 'SCRAM-SHA-256' },
        { value: 'SCRAM-SHA-512', label: 'SCRAM-SHA-512' }
      ]
    },
    'Kafka.SASLUser': {
      type: 'text', label: 'SASL 사용자', default: '',
      description: 'SASL 인증 사용자명입니다.',
      conditional: { field: 'Kafka.SASLEnabled', value: true }
    },
    'Kafka.SASLPassword': {
      type: 'password', label: 'SASL 비밀번호', default: '',
      description: 'SASL 인증 비밀번호입니다.',
      conditional: { field: 'Kafka.SASLEnabled', value: true }
    },

    // ── 배치/재시도 ──
    'Batch.FlushFrequency': {
      type: 'go-duration', label: 'Flush 주기', default: '30s',
      description: '배치 flush 주기입니다. Go duration 형식 (예: 30s, 1m).'
    },
    'Batch.FlushMessages': {
      type: 'number', label: 'Flush 메시지 수', default: 100,
      description: 'flush 트리거 메시지 수입니다 (1 이상). 이 수만큼 쌓이면 즉시 전송합니다.'
    },
    'Batch.MaxBatchSize': {
      type: 'number', label: '최대 배치 크기', default: 500,
      description: '한 번의 전송에 포함할 최대 레코드 수입니다 (1 이상).'
    },
    'Batch.MaxRetries': {
      type: 'number', label: '최대 재시도', default: 2,
      description: '전송 실패 시 최대 재시도 횟수입니다 (0 이상).'
    },
    'Batch.RetryBackoff': {
      type: 'go-duration', label: '재시도 대기', default: '500ms',
      description: '재시도 간 대기 시간입니다. Go duration 형식 (예: 500ms, 1s).'
    },

    // ── 네트워크/기타 ──
    VirtualAddressList: {
      type: 'text', label: '가상 주소 목록', default: '',
      description: 'IP 감지에 사용할 가상 주소 목록입니다. 쉼표로 구분합니다. file 모드 외에는 필수입니다.'
    },
    ServiceDiscoveryPort: {
      type: 'number', label: 'ServiceDiscovery 포트', default: 50009,
      description: 'ServiceDiscovery HTTP 서비스 포트입니다 (1~65535).'
    },
    ResourceMonitorTopic: {
      type: 'select', label: '토픽 명명 모드', default: 'process',
      description: 'Kafka/KafkaRest 토픽 명명 모드입니다. EQP_INFO 기반으로 토픽명이 자동 생성됩니다.',
      options: [
        { value: 'process', label: 'Process별 (tp_{Process}_all_resource)' },
        { value: 'model', label: 'Model별 (tp_{Process}_{EqpModel}_resource)' },
        { value: 'all', label: '전체 (tp_all_all_resource)' }
      ]
    },
    TimeDiffSyncInterval: {
      type: 'number', label: '시간 동기화 주기 (초)', default: 3600,
      description: '서버와의 시간차 동기화 주기(초)입니다. 기본 1시간(3600초).'
    },

    // ── SOCKS Proxy ──
    'SocksProxy.Host': {
      type: 'text', label: 'SOCKS 호스트', default: '',
      description: 'SOCKS5 프록시 호스트 주소입니다. 비어있으면 프록시를 사용하지 않습니다. Host와 Port는 둘 다 설정하거나 둘 다 비워야 합니다.'
    },
    'SocksProxy.Port': {
      type: 'number', label: 'SOCKS 포트', default: 0,
      description: 'SOCKS5 프록시 포트입니다 (1~65535). Host와 Port는 둘 다 설정하거나 둘 다 비워야 합니다.'
    },
    PrivateIPAddressPattern: {
      type: 'text', label: '사설 IP 패턴', default: '',
      description: '사설 IP 대역 패턴입니다. Go 정규표현식으로 매칭되는 IP를 우선 선택합니다.'
    },

    // ── Redis ──
    'Redis.Port': {
      type: 'number', label: 'Redis 포트', default: 50001,
      description: 'Redis 포트 번호입니다 (1~65535). 호스트는 감지된 서버 IP를 사용합니다.'
    },
    'Redis.Password': {
      type: 'password', label: 'Redis 비밀번호', default: '',
      description: 'Redis 비밀번호입니다. 비어있으면 내부 기본값을 사용합니다.'
    },
    'Redis.DB': {
      type: 'number', label: 'Redis DB', default: 10,
      description: 'Redis DB 번호(0~15)입니다.'
    }
  },

  fieldGroups: [
    { name: '전송 방식', fields: ['SenderType'] },
    {
      name: '파일 출력',
      fields: ['File.FilePath', 'File.MaxSizeMB', 'File.MaxBackups', 'File.Pretty', 'File.Format'],
      showWhen: { field: 'SenderType', value: 'file' }
    },
    {
      name: 'Kafka 연결',
      fields: [
        'Kafka.BrokerPort', 'Kafka.Compression', 'Kafka.RequiredAcks', 'Kafka.Timeout'
        // TLS/SASL 필드는 보안 이슈 대응 시 추가 예정:
        // 'Kafka.EnableTLS', 'Kafka.TLSCertFile', 'Kafka.TLSKeyFile', 'Kafka.TLSCAFile',
        // 'Kafka.SASLEnabled', 'Kafka.SASLMechanism', 'Kafka.SASLUser', 'Kafka.SASLPassword'
      ],
      showWhen: { field: 'SenderType', value: 'kafka' }
    },
    {
      name: '배치/재시도',
      fields: ['Batch.FlushFrequency', 'Batch.FlushMessages', 'Batch.MaxBatchSize', 'Batch.MaxRetries', 'Batch.RetryBackoff'],
      showWhen: { field: 'SenderType', values: ['kafka', 'kafkarest'] }
    },
    { name: '네트워크/검색', fields: ['VirtualAddressList', 'ServiceDiscoveryPort', 'ResourceMonitorTopic', 'TimeDiffSyncInterval'] },
    { name: 'SOCKS Proxy', fields: ['SocksProxy.Host', 'SocksProxy.Port', 'PrivateIPAddressPattern'] },
    { name: 'Redis', fields: ['Redis.Port', 'Redis.Password', 'Redis.DB'] }
  ]
}

/**
 * Coerce a value to the correct type based on field definition.
 */
function coerceValue(value, fieldDef) {
  if (fieldDef.type === 'number') return Number(value)
  if (fieldDef.type === 'boolean') return Boolean(value)
  if (fieldDef.type === 'select' && typeof fieldDef.default === 'number') return Number(value)
  return value
}

/**
 * Parse nested ResourceAgent config into flat dot-notation formData.
 *   { Kafka: { BrokerPort: 9092 } } -> { 'Kafka.BrokerPort': 9092 }
 *   Missing fields are filled with schema defaults.
 *
 * @param {Object} config - Nested ResourceAgent.json config object
 * @returns {Object} Flat formData object with dot-notation keys
 */
export function parseResourceAgentInput(config) {
  const c = config || {}
  const result = {}

  for (const [fieldName, fieldDef] of Object.entries(RESOURCEAGENT_SCHEMA.fields)) {
    const dotIdx = fieldName.indexOf('.')
    if (dotIdx > 0) {
      // Nested field: 'Kafka.BrokerPort' -> config.Kafka?.BrokerPort
      const prefix = fieldName.substring(0, dotIdx)
      const key = fieldName.substring(dotIdx + 1)
      const section = c[prefix]
      if (section && key in section) {
        result[fieldName] = section[key]
      } else {
        result[fieldName] = fieldDef.type === 'array' ? [...fieldDef.default] : fieldDef.default
      }
    } else {
      // Top-level field
      if (fieldName in c) {
        result[fieldName] = c[fieldName]
      } else {
        result[fieldName] = fieldDef.type === 'array' ? [...fieldDef.default] : fieldDef.default
      }
    }
  }

  return result
}

/**
 * Build nested ResourceAgent.json config from flat dot-notation formData.
 *   { 'Kafka.BrokerPort': 9092 } -> { Kafka: { BrokerPort: 9092 } }
 *   Coerces types (number, boolean).
 *
 * @param {Object} formData - Flat formData with dot-notation keys
 * @returns {Object} Nested ResourceAgent.json config object
 */
export function buildResourceAgentOutput(formData) {
  const d = formData || {}
  const senderType = d.SenderType || RESOURCEAGENT_SCHEMA.fields.SenderType.default
  const result = {}

  // Determine which nested sections to exclude based on SenderType
  const excludePrefixes = new Set()
  if (senderType !== 'kafka') excludePrefixes.add('Kafka')
  if (senderType !== 'file') excludePrefixes.add('File')
  if (senderType === 'file') excludePrefixes.add('Batch')

  // Collect visible fields from fieldGroups (hidden fields are excluded from output)
  const visibleFields = new Set(RESOURCEAGENT_SCHEMA.fieldGroups.flatMap(g => g.fields))

  for (const [fieldName, fieldDef] of Object.entries(RESOURCEAGENT_SCHEMA.fields)) {
    if (!visibleFields.has(fieldName)) continue
    const dotIdx = fieldName.indexOf('.')
    if (dotIdx > 0) {
      const prefix = fieldName.substring(0, dotIdx)
      if (excludePrefixes.has(prefix)) continue
      const key = fieldName.substring(dotIdx + 1)
      if (!result[prefix]) result[prefix] = {}
      const val = fieldName in d ? d[fieldName] : (fieldDef.type === 'array' ? [...fieldDef.default] : fieldDef.default)
      result[prefix][key] = fieldDef.type === 'array' ? val : coerceValue(val, fieldDef)
    } else {
      const val = fieldName in d ? d[fieldName] : (fieldDef.type === 'array' ? [...fieldDef.default] : fieldDef.default)
      result[fieldName] = fieldDef.type === 'array' ? val : coerceValue(val, fieldDef)
    }
  }

  return result
}
