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

// ── AccessLog.json 스키마 ──

export const ACCESS_LOG_SCHEMA = {
  fields: {
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
      description: '파일명 중간 부분의 와일드카드 패턴입니다. 비워두면 모든 파일을 매칭합니다.',
      placeholder: ''
    },
    suffix: {
      type: 'text', label: '접미사 (Suffix)',
      description: '로그 파일의 확장자입니다. 예: ".txt", ".log"',
      placeholder: '.txt'
    },
    log_type: {
      type: 'select', label: '로그 타입',
      description: '로그 파일의 구성 방식을 지정합니다. date_single: 날짜별 단일 파일, date_multi: 날짜별 다중 파일, rolling: 롤링 파일, static: 고정 파일',
      options: [
        { value: 'date_single', label: 'date_single (날짜별 단일 파일)' },
        { value: 'date_multi', label: 'date_multi (날짜별 다중 파일)' },
        { value: 'rolling', label: 'rolling (롤링 파일)' },
        { value: 'static', label: 'static (고정 파일)' }
      ]
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
        { value: 'ISO-8859-1', label: 'ISO-8859-1' }
      ]
    },
    access_interval: {
      type: 'text', label: '접근 주기',
      description: '로그 파일을 확인하는 주기입니다. 예: "10 seconds", "1 minutes". 짧을수록 실시간에 가깝지만 부하가 증가합니다.',
      placeholder: '10 seconds'
    },
    batch_count: {
      type: 'number', label: '배치 수',
      description: '한 번에 읽는 최대 로그 줄 수입니다. 로그 양이 많은 환경에서는 값을 높이세요.',
      placeholder: '1000'
    },
    batch_timeout: {
      type: 'text', label: '배치 타임아웃',
      description: '배치 읽기 최대 대기 시간입니다. 이 시간 내에 batch_count에 도달하지 않으면 읽은 만큼만 처리합니다.',
      placeholder: '30 seconds'
    },
    reopen: {
      type: 'boolean', label: '파일 재열기 (Reopen)',
      description: '매 접근 주기마다 파일 핸들을 다시 열지 여부입니다. 로그 로테이션이 발생하는 환경에서는 true로 설정하세요.'
    },
    back: {
      type: 'boolean', label: '이전 위치부터 읽기 (Back)',
      description: '에이전트 재시작 시 마지막으로 읽었던 위치부터 이어서 읽을지 여부입니다. false면 처음부터 다시 읽습니다.'
    },
    end: {
      type: 'boolean', label: '끝부터 읽기 (End)',
      description: '최초 접근 시 파일 끝부터 읽기 시작할지 여부입니다. true면 기존 로그는 건너뛰고 새 로그만 처리합니다.'
    },
    exclude_suffix: {
      type: 'tags', label: '제외 접미사',
      description: '모니터링에서 제외할 파일 확장자 목록입니다. 예: .bak, .tmp',
      placeholder: '예: .bak'
    }
  },
  defaults: {
    directory: '',
    prefix: '',
    wildcard: '',
    suffix: '.txt',
    log_type: 'date_single',
    date_subdir_format: '',
    reopen: true,
    access_interval: '10 seconds',
    exclude_suffix: [],
    charset: 'EUC-KR',
    back: true,
    end: false,
    batch_count: 1000,
    batch_timeout: '30 seconds'
  }
}

// ── trigger.json 스키마 ──

export const TRIGGER_SCHEMA = {
  fields: {
    source: {
      type: 'select-source', label: '로그 소스',
      description: '이 트리거가 모니터링할 로그 소스입니다. AccessLog.json에서 정의한 소스 중 하나를 선택하세요.',
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
      description: '로그 라인 매칭 방식입니다. regex: 정규식 패턴, keyword: 키워드 포함 여부, exact: 정확한 문자열 일치',
      options: [
        { value: 'regex', label: 'regex (정규식)' },
        { value: 'keyword', label: 'keyword (키워드)' },
        { value: 'exact', label: 'exact (정확 일치)' }
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
      description: '이 스텝 발동 후 실행할 동작입니다. 다른 스텝으로 연결하거나, @script를 선택하면 스크립트를 실행합니다.'
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
    script: { ...TRIGGER_SCRIPT_SCHEMA.defaults }
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
