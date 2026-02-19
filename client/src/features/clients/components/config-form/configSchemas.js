/**
 * EARS Config 파일 타입 감지 및 필드 메타데이터 정의
 *
 * 3개 config 파일의 스키마를 프론트엔드 코드로 관리합니다.
 * - AccessLog.json: 로그 소스 정의
 * - trigger.json: 트리거 규칙 정의
 * - ARSAgent.json: 트리거 ↔ 로그 소스 연결
 */

// ── 파일 타입 감지 ──

const FILE_TYPE_MAP = {
  'accesslog.json': 'accesslog',
  'trigger.json': 'trigger',
  'arsagent.json': 'arsagent',
}

export function detectConfigFileType(fileName, filePath) {
  if (!fileName && !filePath) return null
  // Check display name first
  if (fileName) {
    const match = FILE_TYPE_MAP[fileName.toLowerCase()]
    if (match) return match
  }
  // Fallback: check basename of path
  if (filePath) {
    const basename = filePath.split('/').pop()?.toLowerCase()
    if (basename) {
      const match = FILE_TYPE_MAP[basename]
      if (match) return match
    }
  }
  return null
}

// ── log_type 3축 모델 ──

export const DATE_AXIS_OPTIONS = [
  { value: 'normal', label: '일반' },
  { value: 'date', label: '날짜별' },
  { value: 'date_prefix', label: '날짜접두사' }
]

export const LINE_AXIS_OPTIONS = [
  { value: 'single', label: '단일 라인' },
  { value: 'multiline', label: '다중 라인' }
]

export const POST_PROC_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'extract_append', label: '추출-삽입' }
]

// Valid 10 combinations lookup
const VALID_LOG_TYPES = new Set([
  'normal_single',
  'date_single',
  'date_prefix_single',
  'normal_single_extract_append',
  'date_single_extract_append',
  'date_prefix_single_extract_append',
  'normal_multiline',
  'date_multiline',
  'normal_multiline_extract_append',
  'date_multiline_extract_append'
])

export function decomposeLogType(logType) {
  if (!logType || !VALID_LOG_TYPES.has(logType)) {
    return { dateAxis: 'normal', lineAxis: 'single', postProc: 'none' }
  }

  let dateAxis = 'normal'
  if (logType.startsWith('date_prefix_')) dateAxis = 'date_prefix'
  else if (logType.startsWith('date_')) dateAxis = 'date'

  const lineAxis = logType.includes('multiline') ? 'multiline' : 'single'
  const postProc = logType.includes('extract_append') ? 'extract_append' : 'none'

  return { dateAxis, lineAxis, postProc }
}

export function composeLogType({ dateAxis = 'normal', lineAxis = 'single', postProc = 'none' } = {}) {
  const parts = [dateAxis, lineAxis]
  if (postProc && postProc !== 'none') parts.push(postProc)
  const result = parts.join('_')
  return VALID_LOG_TYPES.has(result) ? result : 'normal_single'
}

// ── 소스 네이밍 ──

export function formatSourceName(baseName, purpose) {
  if (!baseName) return ''
  if (purpose === 'trigger') return `__${baseName}__`
  return baseName // upload
}

export function parseSourceName(key) {
  if (!key) return { baseName: '', purpose: 'trigger' }
  const match = key.match(/^__(.+)__$/)
  if (match) return { baseName: match[1], purpose: 'trigger' }
  return { baseName: key, purpose: 'upload' }
}

// ── AccessLog.json 스키마 ──

export const ACCESS_LOG_SCHEMA = {
  fields: {
    purpose: {
      type: 'select', label: '용도',
      description: 'Trigger용 소스는 이름 양쪽에 __가 자동 추가됩니다. Upload용 소스는 이름 그대로 사용됩니다.',
      options: [
        { value: 'trigger', label: 'Log Trigger 용' },
        { value: 'upload', label: 'Log Upload 용' }
      ]
    },
    directory: {
      type: 'text', label: '디렉토리 경로', required: true,
      description: '로그 파일이 위치한 클라이언트 머신의 디렉토리 경로입니다. 예: C:/EARS/TestFile',
      placeholder: 'C:/EARS/TestFile'
    },
    prefix: {
      type: 'text', label: '접두사 (Prefix)',
      description: '로그 파일명의 접두사입니다. 예: "log_"이면 log_20240101.txt 형태의 파일을 매칭합니다.',
      placeholder: 'log_'
    },
    wildcard: {
      type: 'text', label: '와일드카드 (Wildcard)',
      description: '파일명 중간 부분의 와일드카드 패턴입니다. 비워두면 와일드카드를 사용하지 않습니다.',
      placeholder: ''
    },
    suffix: {
      type: 'text', label: '접미사 (Suffix)',
      description: '로그 파일의 확장자입니다. 예: ".txt", ".log"',
      placeholder: '.txt'
    },
    date_subdir_format: {
      type: 'text', label: '날짜 하위 디렉토리 포맷',
      description: "날짜 기반 하위 디렉토리 패턴입니다 (Java SimpleDateFormat). 예: \"'\\\\' yyyy '\\\\' MM '\\\\' dd\" → \\2024\\01\\15",
      placeholder: "'\\\\'yyyy'\\\\'MM'\\\\'dd"
    },
    charset: {
      type: 'select', label: '문자 인코딩',
      description: '로그 파일의 문자 인코딩입니다. 한글 환경에서는 주로 EUC-KR 또는 UTF-8을 사용합니다.',
      options: [
        { value: 'UTF-8', label: 'UTF-8' },
        { value: 'EUC-KR', label: 'EUC-KR' },
        { value: 'MS949', label: 'MS949' },
        { value: 'UCS-2 LE BOM', label: 'UCS-2 LE BOM' },
        { value: '__custom__', label: '직접 입력' }
      ]
    },
    access_interval: {
      type: 'text', label: '접근 주기',
      description: '로그 파일을 확인하는 주기입니다. 예: "10 seconds", "1 minutes". 짧을수록 실시간에 가깝지만 부하가 증가합니다.',
      placeholder: '10 seconds'
    },
    batch_count: {
      type: 'number', label: '배치 수',
      description: '한 번에 시스템에 보내는 로그 batch 크기 (로그 라인 수)입니다.',
      placeholder: '1000'
    },
    batch_timeout: {
      type: 'text', label: '배치 타임아웃',
      description: 'batch send timeout 시간입니다. 로그가 batch_count만큼 수집되지 않아도 시스템에 보내는 대기 시간입니다.',
      placeholder: '30 seconds'
    },
    reopen: {
      type: 'boolean', label: '파일 재열기 (Reopen)',
      description: '매 접근 주기마다 파일 핸들을 다시 열지 여부입니다. 로그 로테이션이 발생하는 환경에서는 true로 설정하세요.'
    },
    back: {
      type: 'boolean', label: '이전 위치부터 읽기 (Back)',
      description: '파일 크기가 줄어들 경우 파일을 처음부터 읽을지 여부입니다. true일 경우 파일 크기가 줄어들면 처음부터 EOF까지 읽습니다.'
    },
    end: {
      type: 'boolean', label: '끝부터 읽기 (End)',
      description: '최초 접근 시 파일 끝부터 읽기 시작할지 여부입니다. true면 기존 로그는 건너뛰고 새 로그만 처리합니다.'
    },
    exclude_suffix: {
      type: 'tags', label: '제외 접미사',
      description: '모니터링에서 제외할 파일 확장자 목록입니다. 예: .bak, .tmp',
      placeholder: '예: .bak'
    },
    // Multiline fields (visible when lineAxis === 'multiline')
    start_pattern: {
      type: 'text', label: '시작 패턴 (start_pattern)',
      description: '멀티라인 로그 수집을 시작하는 정규표현식 패턴입니다.',
      placeholder: '.* WARN Alarm Occured.*'
    },
    end_pattern: {
      type: 'text', label: '종료 패턴 (end_pattern)',
      description: '멀티라인 로그 수집을 완료하는 정규표현식 패턴입니다. 이 패턴의 로그까지 한 라인으로 모아서 전달합니다.',
      placeholder: '.* WARN Alarm Reset.*'
    },
    line_count: {
      type: 'number', label: '수집 라인 수 (line_count)',
      description: '멀티라인 로그를 모으기 완료하는 라인 수입니다.',
      placeholder: ''
    },
    priority: {
      type: 'select', label: '우선순위 (priority)',
      description: '멀티라인 완료의 우선순위 설정입니다. 설정된 항목을 우선으로 처리합니다.',
      options: [
        { value: 'count', label: 'count (라인 수 우선)' },
        { value: 'pattern', label: 'pattern (패턴 우선)' }
      ]
    },
    // Extract-append fields (visible when postProc === 'extract_append')
    pathPattern: {
      type: 'text', label: '추출 패턴 (pathPattern)',
      description: '파일 절대 경로에서 로그에 붙일 데이터를 추출하는 정규표현식입니다. ()그룹으로 추출하며 최대 5개까지 지원합니다.',
      placeholder: '.*Log\\\\([0-9]+)\\\\([0-9]+)\\\\([0-9]+)\\\\app_log.*'
    },
    appendPos: {
      type: 'number', label: '삽입 위치 (appendPos)',
      description: '추출한 데이터를 로그에 붙일 위치입니다. 0은 로그 앞(왼쪽)입니다.',
      placeholder: '0'
    },
    appendFormat: {
      type: 'text', label: '삽입 포맷 (appendFormat)',
      description: '추출 데이터의 포맷입니다. @1, @2, @3으로 추출 그룹을 참조합니다.',
      placeholder: '@1-@2-@3 '
    }
  },
  defaults: {
    directory: '',
    prefix: '',
    wildcard: '',
    suffix: '.txt',
    log_type: 'normal_single',
    date_subdir_format: '',
    reopen: true,
    access_interval: '10 seconds',
    exclude_suffix: [],
    charset: '',
    back: null,
    end: null,
    batch_count: 1000,
    batch_timeout: '30 seconds',
    // multiline
    start_pattern: '',
    end_pattern: '',
    line_count: null,
    priority: 'count',
    // extract_append
    pathPattern: '',
    appendPos: 0,
    appendFormat: ''
  }
}

// ── JSON 변환 함수 ──

export function buildAccessLogOutput(source) {
  const s = source || {}
  const axes = decomposeLogType(s.log_type)
  const result = {}

  // Always included fields
  result.directory = s.directory || ''
  result.prefix = s.prefix || ''
  result.wildcard = s.wildcard || ''
  result.suffix = s.suffix || ''
  result.log_type = s.log_type || 'normal_single'

  // date_subdir_format: only when date axis is date or date_prefix AND not _omit
  if ((axes.dateAxis === 'date' || axes.dateAxis === 'date_prefix') && s.date_subdir_format !== undefined && s._omit_date_subdir_format !== true) {
    result.date_subdir_format = s.date_subdir_format
  }

  // charset: only when not _omit
  if (s.charset && s._omit_charset !== true) {
    result.charset = s.charset
  }

  result.access_interval = s.access_interval || '10 seconds'
  result.reopen = s.reopen !== undefined ? s.reopen : true

  // back/end: only when not _omit
  if (s._omit_back !== true && s.back !== null && s.back !== undefined) {
    result.back = s.back
  }
  if (s._omit_end !== true && s.end !== null && s.end !== undefined) {
    result.end = s.end
  }

  if (s.exclude_suffix && s.exclude_suffix.length > 0) {
    result.exclude_suffix = s.exclude_suffix
  }

  // batch fields: only for upload purpose
  const { purpose } = parseSourceName(source?.name || '')
  if (purpose === 'upload') {
    result.batch_count = s.batch_count ?? 1000
    result.batch_timeout = s.batch_timeout || '30 seconds'
  }

  // Multiline fields: only when lineAxis === 'multiline'
  if (axes.lineAxis === 'multiline') {
    if (s.start_pattern) result.start_pattern = s.start_pattern
    if (s.end_pattern) result.end_pattern = s.end_pattern
    if (s.line_count != null) result.line_count = s.line_count
    if (s.priority) result.priority = s.priority
  }

  // Extract-append fields: only when postProc === 'extract_append'
  if (axes.postProc === 'extract_append') {
    if (s.pathPattern) result.pathPattern = s.pathPattern
    result.appendPos = s.appendPos ?? 0
    if (s.appendFormat) result.appendFormat = s.appendFormat
  }

  return result
}

export function parseAccessLogInput(key, config) {
  const { baseName, purpose } = parseSourceName(key)
  const axes = decomposeLogType(config?.log_type)

  return {
    name: key,
    baseName,
    purpose,
    ...ACCESS_LOG_SCHEMA.defaults,
    ...config,
    // Ensure _omit flags
    _omit_charset: !config?.charset,
    _omit_back: config?.back === undefined || config?.back === null,
    _omit_end: config?.end === undefined || config?.end === null,
    _omit_date_subdir_format: config?.date_subdir_format === undefined
  }
}

// ── trigger.json 스키마 ──

export const TRIGGER_SCHEMA = {
  fields: {
    source: {
      type: 'multi-select-source', label: '로그 소스',
      description: '이 트리거가 모니터링할 로그 소스입니다. 복수 선택 가능하며, 콤마로 구분되어 저장됩니다.',
      required: true
    }
  },
  limitation: {
    times: {
      type: 'number', label: '최대 트리거 횟수',
      description: '제한 기간 내 최대 트리거 발동 횟수입니다. 알림 폭주를 방지합니다.',
      placeholder: '1'
    },
    duration: {
      type: 'text', label: '제한 기간',
      description: '트리거 횟수 제한이 적용되는 기간입니다. 예: "1 minutes", "30 seconds"',
      placeholder: '1 minutes'
    }
  }
}

export const TRIGGER_STEP_SCHEMA = {
  fields: {
    name: {
      type: 'text', label: '스텝 이름', required: true,
      description: '이 레시피 스텝의 고유 이름입니다. 다른 스텝에서 next 필드로 참조할 수 있습니다.',
      placeholder: 'Step_1'
    },
    type: {
      type: 'select', label: '매칭 타입',
      description: '로그 라인 매칭 방식입니다. regex: 정규식 패턴, delay: 조건 매칭 시 체인을 리셋하는 지연(취소) 스텝',
      options: [
        { value: 'regex', label: 'regex (정규식)' },
        { value: 'delay', label: 'delay (지연/취소)' }
      ]
    },
    trigger: {
      type: 'patterns', label: '트리거 패턴',
      description: '매칭할 패턴 목록입니다. 하나라도 매칭되면 해당 스텝이 발동합니다. regex 타입 예: ".*S3F216.*"',
      placeholder: '예: .*S3F216.*'
    },
    duration: {
      type: 'text', label: '감시 기간 (Duration)',
      description: '이전 스텝 발동 후 이 스텝이 발동되어야 하는 시간 제한입니다. 비워두면 무제한 대기합니다. 예: "10 minutes"',
      placeholder: '예: 10 minutes'
    },
    times: {
      type: 'number', label: '감지 횟수 (Times)',
      description: '이 스텝이 발동하기 위해 필요한 패턴 매칭 횟수입니다.',
      placeholder: '1'
    },
    next: {
      type: 'select-next', label: '다음 동작',
      description: '이 스텝 발동 후 실행할 동작입니다. 다른 스텝으로 연결하거나, @recovery(시나리오), @script(코드 기반 시나리오), @notify(메일 발송), @popup(PopUp)을 선택합니다.'
    },
    detail: {
      type: 'object', label: '상세 설정 (detail)',
      description: '@popup next에서 사용하는 추가 설정입니다.'
    }
  }
}

export const TRIGGER_SCRIPT_SCHEMA = {
  fields: {
    name: {
      type: 'text', label: '스크립트 파일명', required: true,
      description: '실행할 스크립트 파일명입니다. 에이전트의 스크립트 디렉토리에 위치해야 합니다.',
      placeholder: 'Test.scala'
    },
    arg: {
      type: 'text', label: '인자 (Arguments)',
      description: '스크립트에 전달할 인자입니다. 세미콜론(;)으로 구분합니다.',
      placeholder: 'arg1;arg2'
    },
    'no-email': {
      type: 'text', label: '이메일 비발송 조건',
      description: '이메일 알림을 보내지 않을 스크립트 결과값입니다. 세미콜론(;)으로 구분합니다. 예: "success;fail"',
      placeholder: 'success;fail'
    },
    key: {
      type: 'number', label: '키 (Key)',
      description: '스크립트 실행 식별 키입니다. 동일 key를 가진 스크립트는 동시에 실행되지 않습니다.',
      placeholder: '1'
    },
    timeout: {
      type: 'text', label: '타임아웃',
      description: '스크립트 실행 최대 대기 시간입니다. 이 시간을 초과하면 강제 종료됩니다.',
      placeholder: '30 seconds'
    },
    retry: {
      type: 'text', label: '재시도 간격',
      description: '스크립트 실행 실패 시 재시도까지 대기 시간입니다.',
      placeholder: '3 minutes'
    }
  },
  defaults: {
    name: '', arg: '', 'no-email': '', key: 1, timeout: '30 seconds', retry: '3 minutes'
  }
}

// ── ARSAgent.json 스키마 ──

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

// ── 기본값 생성 헬퍼 ──

export function createDefaultAccessLog(index = 0) {
  return {
    name: index === 0 ? '__LogReadInfo__' : `__LogReadInfo_${index + 1}__`,
    ...ACCESS_LOG_SCHEMA.defaults
  }
}

export function createDefaultTriggerStep(index = 0) {
  return {
    name: `Step_${index + 1}`,
    type: 'regex',
    trigger: [],
    duration: '',
    times: 1,
    next: '',
    script: { ...TRIGGER_SCRIPT_SCHEMA.defaults },
    detail: {}
  }
}

export function createDefaultTrigger() {
  return {
    name: '',
    source: '',
    recipe: [createDefaultTriggerStep(0)],
    limitation: { times: 1, duration: '1 minutes' }
  }
}
