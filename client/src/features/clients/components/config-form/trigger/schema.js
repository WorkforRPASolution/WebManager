/**
 * trigger/schema.js
 *
 * Trigger configuration schema and helper functions.
 */

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
  },
  classField: {
    type: 'select',
    label: '트리거 클래스',
    description: '다중 인스턴스 추적을 활성화합니다. MULTI: step_01 캡처값별 독립 체인 추적, none: 기본 동작',
    options: [
      { value: 'MULTI', label: 'MULTI (다중 인스턴스 추적)' },
      { value: 'none', label: 'none (기본)' }
    ]
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
      description: '이 스텝 발동 후 실행할 동작입니다. 다른 스텝으로 연결하거나, @recovery(시나리오), @script(코드 기반 시나리오), @notify(메일 발송), @popup(PopUp), @suspend(트리거 실행 제한), @resume(트리거 실행 제한 해제)을 선택합니다.'
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

// ── 기본값 생성 헬퍼 ──

export function createDefaultTriggerStep(index = 0) {
  return {
    name: `Step_${index + 1}`,
    type: 'regex',
    trigger: [],
    duration: '',
    times: 1,
    next: '',
    script: { ...TRIGGER_SCRIPT_SCHEMA.defaults },
    detail: {},
    suspend: [],
    resume: []
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
