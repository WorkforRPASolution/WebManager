# EARS Config 파일 스키마 레퍼런스

> ARSAgent가 사용하는 3개 설정 파일의 구조, 필드 규격, 관계를 정의합니다.
> Form View 개발 및 유효성 검증 로직 구현 시 참조용 문서입니다.

## 목차

1. [개요](#1-개요)
2. [파일 관계도](#2-파일-관계도)
3. [공통 규격](#3-공통-규격)
4. [AccessLog.json](#4-accesslogjson)
5. [trigger.json](#5-triggerjson)
6. [ARSAgent.json](#6-arsagentjson)
7. [알려진 특이사항](#7-알려진-특이사항)
8. [전체 예시](#8-전체-예시)

---

## 1. 개요

EARS 시스템의 ARSAgent는 클라이언트 머신에서 로그를 모니터링하고, 특정 패턴이 감지되면 트리거를 발동하여 스크립트를 실행합니다. 이 동작을 제어하는 3개 JSON 설정 파일이 있습니다:

| 파일 | 역할 | 위치 |
|------|------|------|
| **AccessLog.json** | 모니터링할 로그 소스 정의 (경로, 인코딩, 읽기 주기 등) | 클라이언트 config 디렉토리 |
| **trigger.json** | 로그에서 감지할 패턴과 실행할 액션 정의 (레시피 스텝 체인) | 클라이언트 config 디렉토리 |
| **ARSAgent.json** | 위 두 파일에서 정의한 항목 중 실제로 활성화할 대상 선택 | 클라이언트 config 디렉토리 |

**핵심 동작 흐름**: AccessLog.json에서 로그 소스를 읽음 → trigger.json의 레시피 스텝이 패턴을 감시 → 조건 충족 시 스크립트 실행 또는 다음 스텝으로 진행 → ARSAgent.json이 어떤 트리거/소스를 활성화할지 결정

---

## 2. 파일 관계도

```
AccessLog.json                    trigger.json                     ARSAgent.json
┌─────────────────┐              ┌──────────────────┐              ┌──────────────────┐
│ "__LogReadInfo__"│◄─reference── │ "TRIGGER_A"      │◄─reference── │ ErrorTrigger:    │
│ "AnotherSource" │              │   source: "..."  │              │   [{alid:"..."}] │
│                 │              │ "TRIGGER_B"      │              │ AccessLogLists:  │
│                 │              │   source: "..."  │              │   ["..."]        │
└─────────────────┘              └──────────────────┘              └──────────────────┘
  ▲ 로그 소스 이름                   ▲ 트리거 이름                    ● 활성화 선택
  (Object의 key)                   (Object의 key)                  (배열에 포함)
```

**참조 관계**:
- `trigger.json`의 각 트리거 → `source` 필드가 `AccessLog.json`의 소스 이름(key)을 참조
- `ARSAgent.json` → `ErrorTrigger[].alid`가 `trigger.json`의 트리거 이름(key)을 참조
- `ARSAgent.json` → `AccessLogLists[]`가 `AccessLog.json`의 소스 이름(key)을 참조

---

## 3. 공통 규격

### 3.1 Duration 포맷

시간 관련 필드는 모두 **문자열**로 표현하며, 아래 형식을 따릅니다:

```
"<숫자> <단위>"
```

| 단위 | 예시 | 설명 |
|------|------|------|
| `seconds` | `"10 seconds"` | 초 |
| `minutes` | `"1 minutes"` | 분 (복수형 사용) |
| `hours` | `"2 hours"` | 시 |

> **주의**: 단위는 항상 **복수형**입니다. `"1 minutes"`는 문법적으로 어색하지만 EARS 시스템이 이 형식을 요구합니다. 빈 문자열 `""`은 "무제한" 또는 "미사용"을 의미합니다.

### 3.2 JSON 구조 공통 패턴

3개 파일 모두 **최상위가 Object**이며, key가 항목의 고유 이름 역할을 합니다:

```json
{
  "항목이름1": { ... },
  "항목이름2": { ... }
}
```

- AccessLog.json: key = 로그 소스 이름
- trigger.json: key = 트리거 이름
- ARSAgent.json: key = 섹션 이름 (ErrorTrigger, AccessLogLists 고정)

### 3.3 파일 타입 감지

WebManager Form View에서 파일명으로 타입을 판별합니다 (대소문자 무시):

| 파일명 패턴 | 타입 |
|------------|------|
| `accesslog.json` | `accesslog` |
| `trigger.json` | `trigger` |
| `arsagent.json` | `arsagent` |

감지 로직: 파일 표시명(`fileName`) 우선 체크 → 실패 시 경로의 basename(`filePath`) 체크

---

## 4. AccessLog.json

### 4.1 전체 구조

```json
{
  "<소스이름>": {
    "directory": "string",
    "prefix": "string",
    "wildcard": "string",
    "suffix": "string",
    "log_type": "string (enum)",
    "date_subdir_format": "string",
    "charset": "string (enum)",
    "access_interval": "duration string",
    "batch_count": number,
    "batch_timeout": "duration string",
    "reopen": boolean,
    "back": boolean,
    "end": boolean,
    "exclude_suffix": ["string"]
  }
}
```

여러 소스를 하나의 파일에 정의할 수 있습니다. 소스 이름은 Object의 key입니다.

### 4.2 소스 이름 (key) 규격

| 속성 | 값 |
|------|-----|
| 타입 | string (Object key) |
| 관례 | `__<이름>__` 형식 (양쪽 더블 언더스코어) |
| 기본값 | `__LogReadInfo__` |
| 예시 | `__LogReadInfo__`, `__LogReadInfo_2__`, `__ErrorLog__` |
| 참조처 | trigger.json의 `source` 필드, ARSAgent.json의 `AccessLogLists` 배열 |

### 4.3 필드 상세

#### `directory` (필수)
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 설명 | 로그 파일이 위치한 클라이언트 머신의 **절대 경로** |
| 예시 | `"C:/EARS/TestFile"`, `"/var/log/app"` |
| 비고 | Windows 경로 구분자 `/` 또는 `\` 모두 가능 |

#### `prefix`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 로그 파일명의 접두사. 파일명 매칭에 사용 |
| 예시 | `"log_"` → `log_20240101.txt` 매칭 |

#### `wildcard`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 파일명 중간 부분의 와일드카드 패턴. 비워두면 모든 파일 매칭 |

#### `suffix`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `".txt"` |
| 설명 | 로그 파일의 확장자 |
| 예시 | `".txt"`, `".log"`, `".csv"` |

> **파일명 매칭 공식**: `{prefix}{wildcard}{날짜 등}{suffix}`
> 예: prefix=`"log_"`, suffix=`".txt"` → `log_20240101.txt`

#### `log_type` (enum)
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `"date_single"` |
| 허용값 | `"date_single"`, `"date_multi"`, `"rolling"`, `"static"` |

| 값 | 설명 | 예시 |
|----|------|------|
| `date_single` | 날짜별 단일 파일. 하루에 하나의 로그 파일 생성 | `log_20240101.txt` |
| `date_multi` | 날짜별 다중 파일. 같은 날짜에 여러 파일 존재 가능 | `log_20240101_001.txt` |
| `rolling` | 롤링 파일. 파일 크기 초과 시 새 파일 생성 | `app.log`, `app.log.1` |
| `static` | 고정 파일. 항상 같은 파일에 기록 | `output.log` |

#### `date_subdir_format`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 날짜 기반 하위 디렉토리 패턴 (Java SimpleDateFormat) |
| 예시 | `"'\\'yyyy'\\'MM'\\'dd"` → `\2024\01\15` |
| 비고 | Windows 경로 구분자 `\`를 리터럴로 쓰려면 작은따옴표로 감쌈. 비워두면 하위 디렉토리 없이 `directory` 경로에서 직접 읽음 |

> **주의**: JSON 문자열 내 백슬래시는 이중 이스케이프 필요. 실제 JSON 값: `"'\\\\'yyyy'\\\\'MM'\\\\'dd"`

#### `charset` (enum)
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `"EUC-KR"` |
| 허용값 | `"UTF-8"`, `"EUC-KR"`, `"MS949"`, `"ISO-8859-1"` |
| 설명 | 로그 파일의 문자 인코딩. 한글 환경은 `EUC-KR` 또는 `UTF-8` |

#### `access_interval` (duration)
| 속성 | 값 |
|------|-----|
| 타입 | `string` (duration) |
| 기본값 | `"10 seconds"` |
| 설명 | 로그 파일을 확인하는 폴링 주기 |
| 비고 | 짧을수록 실시간에 가깝지만 파일 I/O 부하가 증가 |

#### `batch_count`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `1000` |
| 설명 | 한 번의 폴링에서 읽는 최대 로그 라인 수 |
| 비고 | 로그 양이 많은 환경에서는 값을 높여 처리량 증가 |

#### `batch_timeout` (duration)
| 속성 | 값 |
|------|-----|
| 타입 | `string` (duration) |
| 기본값 | `"30 seconds"` |
| 설명 | 배치 읽기 최대 대기 시간. `batch_count`에 도달하지 않아도 이 시간이 지나면 읽은 만큼만 처리 |

#### `reopen`
| 속성 | 값 |
|------|-----|
| 타입 | `boolean` |
| 기본값 | `true` |
| 설명 | 매 접근 주기마다 파일 핸들을 다시 열지 여부 |
| 비고 | 로그 로테이션(파일이 새 파일로 교체)이 발생하는 환경에서는 반드시 `true` |

#### `back`
| 속성 | 값 |
|------|-----|
| 타입 | `boolean` |
| 기본값 | `true` |
| 설명 | 에이전트 재시작 시 마지막으로 읽었던 위치부터 이어서 읽을지 여부 |
| 비고 | `false`면 매 재시작 시 파일 처음부터 다시 읽어 중복 트리거 가능 |

#### `end`
| 속성 | 값 |
|------|-----|
| 타입 | `boolean` |
| 기본값 | `false` |
| 설명 | 최초 접근 시 파일 끝부터 읽기 시작할지 여부 |
| 비고 | `true`면 에이전트 시작 시점 이전 로그는 모두 건너뜀. 기존 로그를 분석하려면 `false` |

#### `exclude_suffix`
| 속성 | 값 |
|------|-----|
| 타입 | `string[]` (배열) |
| 기본값 | `[]` |
| 설명 | 모니터링에서 제외할 파일 확장자 목록 |
| 예시 | `[".bak", ".tmp", ".gz"]` |

---

## 5. trigger.json

### 5.1 전체 구조

```json
{
  "<트리거이름>": {
    "source": "string (AccessLog 소스 이름 참조)",
    "recipe": [
      {
        "name": "string",
        "type": "string (enum)",
        "trigger": [{"syntax": "string"}],
        "duration": "duration string",
        "times": number,
        "next": "string",
        "script": { ... }  // next가 "@script"일 때만
      }
    ],
    "limitation": {
      "times": number,
      "durtaion": "duration string"   // ⚠️ 오타 주의 (duration 아님)
    }
  }
}
```

### 5.2 트리거 이름 (key) 규격

| 속성 | 값 |
|------|-----|
| 타입 | string (Object key) |
| 관례 | 대문자 + 언더스코어 (예: `LIMITATION_TEST`) |
| 참조처 | ARSAgent.json의 `ErrorTrigger[].alid` |

### 5.3 최상위 필드

#### `source` (필수)
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 설명 | 이 트리거가 모니터링할 로그 소스 이름 |
| 값 | AccessLog.json에 정의된 소스 key 중 하나 |
| 예시 | `"__LogReadInfo__"` |

#### `recipe` (필수)
| 속성 | 값 |
|------|-----|
| 타입 | `array` of Step objects |
| 설명 | 순차적으로 실행되는 레시피 스텝 목록 |
| 최소 길이 | 1 (스텝 1개 이상 필수) |

#### `limitation`
| 속성 | 값 |
|------|-----|
| 타입 | `object` |
| 설명 | 트리거 발동 횟수 제한 (알림 폭주 방지) |

### 5.4 Recipe Step 필드 상세

각 스텝은 로그에서 특정 패턴이 감지되면 발동됩니다. 스텝 간 체이닝으로 복합 조건을 구성합니다.

#### `name` (필수)
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 설명 | 스텝의 고유 이름. 다른 스텝의 `next` 필드에서 참조 |
| 관례 | 트리거명_step1, Limitaion_step2 등 |
| 유일성 | 같은 트리거 내에서 유일해야 함 |

#### `type` (enum)
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `"regex"` |
| 허용값 | `"regex"`, `"keyword"`, `"exact"` |

| 값 | 설명 | trigger 패턴 예시 |
|----|------|-------------------|
| `regex` | 정규식 패턴 매칭 (Java regex) | `".*S3F216.*"` |
| `keyword` | 키워드 포함 여부 (대소문자 무시 가능) | `"ERROR"` |
| `exact` | 정확한 문자열 일치 | `"Connection refused"` |

#### `trigger` (패턴 목록)
| 속성 | 값 |
|------|-----|
| 타입 | `array` of `{syntax: string}` |
| 설명 | 매칭할 패턴 목록. **하나라도** 매칭되면 해당 스텝 발동 (OR 조건) |
| 비고 | 각 항목은 반드시 `{syntax: "패턴"}` 형태의 객체 |

```json
"trigger": [
  {"syntax": ".*S3F216.*"},
  {"syntax": ".*ERROR.*TIMEOUT.*"}
]
```

> **중요**: 배열 내 각 항목은 plain string이 아닌 **`{syntax: string}` 객체**입니다.

#### `duration` (duration)
| 속성 | 값 |
|------|-----|
| 타입 | `string` (duration) |
| 기본값 | `""` (무제한) |
| 설명 | 이전 스텝 발동 후 이 스텝이 발동되어야 하는 시간 제한 |
| 비고 | 첫 번째 스텝에서는 보통 `""`. 두 번째 이후 스텝에서 시간 창(window) 역할 |
| 예시 | `"10 minutes"` → 이전 스텝 발동 후 10분 이내에 조건 충족 필요 |

#### `times`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `1` |
| 설명 | 이 스텝이 발동하기 위해 필요한 패턴 매칭 횟수 |
| 예시 | `times: 3` → 동일 패턴이 3번 감지되어야 발동 |

#### `next`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 허용값 | (1) 같은 트리거 내 다른 스텝의 `name`, (2) `"@script"`, (3) `""` (비어있으면 체인 종료) |
| 설명 | 이 스텝 발동 후 실행할 동작 |

| next 값 | 동작 |
|---------|------|
| `"Step_2"` | 다음 스텝으로 진행 (스텝 체이닝) |
| `"@script"` | 스크립트 실행 → `script` 객체 필수 |
| `""` | 트리거 체인 종료 (단순 감지만) |

### 5.5 Script 객체 필드 상세

`next`가 `"@script"`일 때만 존재합니다. 트리거 발동 시 실행할 스크립트를 정의합니다.

```json
"script": {
  "name": "Test.scala",
  "arg": "arg1;arg2",
  "no-email": "success;fail",
  "key": 1,
  "timeout": "30 seconds",
  "retry": "3 minutes"
}
```

#### `name` (필수)
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 설명 | 실행할 스크립트 파일명. 에이전트의 스크립트 디렉토리에 위치해야 함 |
| 예시 | `"Test.scala"`, `"alert.py"` |

#### `arg`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 스크립트에 전달할 인자. **세미콜론(`;`)으로 구분** |
| 예시 | `"arg1;arg2;arg3"` |

#### `no-email`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 이메일 알림을 보내지 않을 스크립트 결과값 목록. **세미콜론(`;`)으로 구분** |
| 예시 | `"success;fail"` → 스크립트 결과가 "success" 또는 "fail"이면 이메일 미발송 |
| 비고 | JSON key에 하이픈 포함 (`no-email`). JavaScript에서 `obj['no-email']`로 접근 |

#### `key`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `1` |
| 설명 | 스크립트 실행 식별 키. **동일 key를 가진 스크립트는 동시에 실행되지 않음** (배타적 실행) |
| 비고 | 같은 스크립트를 여러 트리거에서 사용할 때 key를 같게 하면 동시 실행 방지 |

#### `timeout` (duration)
| 속성 | 값 |
|------|-----|
| 타입 | `string` (duration) |
| 기본값 | `"30 seconds"` |
| 설명 | 스크립트 실행 최대 대기 시간. 초과하면 강제 종료 |

#### `retry` (duration)
| 속성 | 값 |
|------|-----|
| 타입 | `string` (duration) |
| 기본값 | `"3 minutes"` |
| 설명 | 스크립트 실행 실패 시 재시도까지 대기 시간 |

### 5.6 Limitation 필드 상세

트리거 전체의 발동 빈도를 제한하여 알림 폭주를 방지합니다.

#### `times`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `1` |
| 설명 | `durtaion` 기간 내 최대 트리거 발동 횟수 |

#### `durtaion` (⚠️ 오타 주의)
| 속성 | 값 |
|------|-----|
| 타입 | `string` (duration) |
| 기본값 | `"1 minutes"` |
| 설명 | 트리거 발동 횟수 제한이 적용되는 기간 |
| ⚠️ | **필드명이 `durtaion`** (duration이 아님). EARS 시스템의 기존 오타이며 호환성을 위해 그대로 유지 |

---

## 6. ARSAgent.json

### 6.1 전체 구조

```json
{
  "ErrorTrigger": [
    {"alid": "<트리거이름>"}
  ],
  "AccessLogLists": [
    "<소스이름>"
  ]
}
```

ARSAgent.json은 다른 두 파일과 다르게 **key가 고정**됩니다. 항상 `ErrorTrigger`와 `AccessLogLists` 두 섹션으로 구성됩니다.

### 6.2 `ErrorTrigger`

| 속성 | 값 |
|------|-----|
| 타입 | `array` of `{alid: string}` |
| 설명 | 활성화할 트리거 목록 |
| 참조 | trigger.json에 정의된 트리거 이름(key) |

```json
"ErrorTrigger": [
  {"alid": "LIMITATION_TEST"},
  {"alid": "CONNECTION_ERROR"}
]
```

> **중요**: 배열 항목은 plain string이 아닌 **`{alid: string}` 객체**입니다. `alid`는 "alert id"의 약어입니다.

### 6.3 `AccessLogLists`

| 속성 | 값 |
|------|-----|
| 타입 | `string[]` (배열) |
| 설명 | 활성화할 로그 소스 목록 |
| 참조 | AccessLog.json에 정의된 소스 이름(key) |

```json
"AccessLogLists": [
  "__LogReadInfo__",
  "__ErrorLog__"
]
```

> **참고**: ErrorTrigger와 달리 **plain string 배열**입니다 (객체가 아님).

### 6.4 활성화 의미

- `trigger.json`에 트리거를 정의해도 `ARSAgent.json`의 `ErrorTrigger`에 포함되지 않으면 **비활성** (감시하지 않음)
- `AccessLog.json`에 소스를 정의해도 `ARSAgent.json`의 `AccessLogLists`에 포함되지 않으면 **비활성** (읽지 않음)
- 즉 ARSAgent.json은 "스위치" 역할 — 정의와 활성화를 분리하여 설정을 끄고 켤 수 있음

---

## 7. 알려진 특이사항

### 7.1 `durtaion` 오타

trigger.json의 `limitation.durtaion`은 `duration`의 오타이지만, EARS Akka 서버가 이 필드명으로 파싱하므로 **반드시 오타 그대로 유지**해야 합니다. Form View에서는 UI 레이블을 "제한 기간"으로 표시하되, JSON 직렬화 시 `durtaion`으로 출력합니다.

### 7.2 Duration 단위 복수형

`"1 minutes"`, `"1 seconds"` 처럼 숫자가 1이어도 복수형을 사용합니다. EARS 시스템이 복수형만 파싱할 수 있는지는 미확인이나, 기존 config들은 모두 복수형을 사용합니다.

### 7.3 trigger 패턴의 객체 래핑

trigger.json의 `recipe[].trigger` 배열 항목은 `{syntax: "패턴"}` 형태의 객체입니다. Plain string `"패턴"`이 아닙니다. Form View의 FormTagInput에서 이 변환을 처리합니다 (`objectKey="syntax"` prop).

### 7.4 ErrorTrigger 항목의 객체 래핑

ARSAgent.json의 `ErrorTrigger` 배열 항목은 `{alid: "이름"}` 형태의 객체입니다. `AccessLogLists`는 plain string 배열과 비대칭적 구조입니다.

### 7.5 no-email 하이픈 키

trigger.json script의 `no-email` 필드는 키에 하이픈을 포함합니다. JavaScript에서 dot notation으로 접근 불가하므로 `obj['no-email']`을 사용해야 합니다.

### 7.6 date_subdir_format 이스케이프

`date_subdir_format`은 Java SimpleDateFormat 기반이며, Windows 경로 구분자 `\`를 리터럴로 쓰기 위해 작은따옴표로 감싸는 관례를 따릅니다. JSON 문자열 내에서는 백슬래시 이중 이스케이프가 필요합니다:
- 실제 패턴: `'\' yyyy '\' MM '\' dd`
- JSON 값: `"'\\\\'yyyy'\\\\'MM'\\\\'dd"`

---

## 8. 전체 예시

### 8.1 AccessLog.json 예시

```json
{
  "__LogReadInfo__": {
    "directory": "C:/EARS/TestFile",
    "prefix": "log_",
    "wildcard": "",
    "suffix": ".txt",
    "log_type": "date_single",
    "date_subdir_format": "'\\'yyyy'\\'MM'\\'dd",
    "reopen": true,
    "access_interval": "10 seconds",
    "exclude_suffix": [],
    "charset": "EUC-KR",
    "back": true,
    "end": false,
    "batch_count": 1000,
    "batch_timeout": "30 seconds"
  }
}
```

### 8.2 trigger.json 예시 (2단계 스텝 + 스크립트)

```json
{
  "LIMITATION_TEST": {
    "source": "__LogReadInfo__",
    "recipe": [
      {
        "name": "Limitaion_step1",
        "type": "regex",
        "trigger": [
          {"syntax": ".*S3F216.*"}
        ],
        "duration": "",
        "times": 1,
        "next": "Limitaion_step2"
      },
      {
        "name": "Limitaion_step2",
        "type": "regex",
        "trigger": [
          {"syntax": ".*S3F216.*"}
        ],
        "duration": "10 minutes",
        "times": 2,
        "next": "@script",
        "script": {
          "name": "Test.scala",
          "arg": "arg1;arg2",
          "no-email": "success;fail",
          "key": 1,
          "timeout": "30 seconds",
          "retry": "3 minutes"
        }
      }
    ],
    "limitation": {
      "times": 1,
      "durtaion": "1 minutes"
    }
  }
}
```

**동작 설명**:
1. `Limitaion_step1`: 로그에서 `.*S3F216.*` 패턴이 **1회** 감지되면 → `Limitaion_step2`로 진행
2. `Limitaion_step2`: 이후 **10분 이내**에 같은 패턴이 **2회** 더 감지되면 → `Test.scala` 스크립트 실행
3. `limitation`: 전체 트리거는 **1분 내 최대 1회**만 발동 (알림 폭주 방지)

### 8.3 ARSAgent.json 예시

```json
{
  "ErrorTrigger": [
    {"alid": "LIMITATION_TEST"}
  ],
  "AccessLogLists": [
    "__LogReadInfo__"
  ]
}
```

---

## 부록: Form View 구현 참고

### A. JSON ↔ Form 데이터 변환

| 방향 | 변환 |
|------|------|
| JSON → Form | Object를 `{name, ...value}` 배열로 변환. Object의 key가 `name` 필드가 됨 |
| Form → JSON | 배열을 Object로 재조합. 각 항목의 `name`이 key가 됨 |

예시 (AccessLog):
```js
// JSON → Form
{__LogReadInfo__: {directory: "..."}} → [{name: "__LogReadInfo__", directory: "..."}]

// Form → JSON
[{name: "__LogReadInfo__", directory: "..."}] → {__LogReadInfo__: {directory: "..."}}
```

### B. 크로스파일 참조 데이터 흐름

```
ConfigFormView.vue
  ├── accessLogSources (computed): AccessLog.json 파싱 → Object.keys()
  │     → TriggerForm의 source 드롭다운 옵션
  │     → ARSAgentForm의 AccessLogLists 체크박스 목록
  └── triggerNames (computed): trigger.json 파싱 → Object.keys()
        → ARSAgentForm의 ErrorTrigger 체크박스 목록
```

### C. 필드 타입별 입력 컴포넌트 매핑

| 스키마 타입 | 컴포넌트 | 비고 |
|------------|----------|------|
| `text` | `<input type="text">` | FormField.vue |
| `number` | `<input type="number">` | FormField.vue |
| `boolean` | `<input type="checkbox">` | FormCheckbox.vue |
| `select` | `<select>` | FormField.vue (options prop) |
| `select-source` | `<select>` | accessLogSources 동적 옵션 |
| `select-next` | `<select>` | 동적 생성: 다른 스텝명 + @script |
| `tags` | FormTagInput.vue | plain string 배열 |
| `patterns` | FormTagInput.vue | `{syntax: string}` 객체 배열 (objectKey="syntax") |
| `trigger-list` | 체크박스 리스트 | `{alid: string}` 객체 배열 변환 |
| `source-list` | 체크박스 리스트 | plain string 배열 |
