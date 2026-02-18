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
    "date_subdir_format": "string (joda datetime format)",
    "charset": "string (enum)",
    "access_interval": "duration string",
    "batch_count": number,
    "batch_timeout": "duration string",
    "reopen": boolean,
    "back": boolean,
    "end": boolean,
    "exclude_suffix": ["string"],
    "date_subdir_format": "string (joda datetime format)",
    "startPattern": "string",
    "endPattern": "string",
    "count": number,
    "priority": "string",
    "extractPattern": "string",
    "appendPos": "string"
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

---
추가 설명
1 소스 이름의 경우 용도( Log Trigger 용, Log Upload 용 두가지)에 따라 Naming rule 이 달라진다.
 - Log Trigger 용은, 설정에 의해 선정한 Log 파일의 Log 내용을 trigger.json 의 trigger 에 전달한다.
 - Log Upload 용은, 설정에 의해 선정한 Log 파일의 Log 내용을 시스템에 Upload 한다.
 - Log Trigger 용의 경우 Name 양쪽에 더블 언더스코어를 붙이여, Log Upload 용은 Name 양쪽에 더블 언더스코어가 없다.
 - 따라서, AccessLog 설정시 사용자가 먼저 용도를 선택한 이후, SourceName 에 이름을 입력하면 JSON Preview 에 용도에 따라 자동으로 더블 언더 스코어를 붙인다.
  
---

### 4.3 필드 상세

#### `directory` (필수)
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 설명 | 로그 파일이 위치한 클라이언트 머신의 **절대 경로** |
| 예시 | `"C:/EARS/TestFile"`, `"/var/log/app"` |
| 비고 | Windows 경로 구분자 `/` 또는 `\` 모두 가능 |

---
추가 설명
1. 경로는 `/`, `\` 외에 `//`, `\\` 의 구분자 입력도 가능하다
  
---

#### `prefix`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 로그 파일명의 접두사. 파일명 매칭에 사용 |
| 예시 | `"log_"` → `log_20240101.txt` 매칭 |

---
추가 설명
1. prefix 는, log_type 이 date_prefix_single 일 경우 joda date timeformat 으로 string 을 입력할 수 있다.
 - 따라서 경로 매칭 Test 시 log_type : date_prefix 일 경우 현재 시간에 따라 date time 을 값으로 변경하여 Test 해야 한다. 
  
---

#### `wildcard`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 파일명 중간 부분의 와일드카드 패턴. 비워두면 모든 파일 매칭 |

---
추가 설명
1. wildcard 값을 비워두면 모든 파일 매칭을 하는 것이 아니라, wildcard 자체를 사용하지 않는다
---

#### `suffix`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 로그 파일의 확장자 혹은 접미사 |
| 예시 | `".txt"`, `".log"`, `".csv"` |

> **파일명 매칭 공식**: `{prefix}{wildcard}{날짜 등}{suffix}`
> 예: prefix=`"log_"`, suffix=`".txt"` → `log_20240101.txt`

#### `log_type` (enum)
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `"normal_single"` |
| 허용값 | `"normal_single"`, `"date_single"`, `"date_prefix_single"`, `"normal_single_extract_append"`, `"date_single_extract_append"`, `"date_prefix_single_extract_append"`, `"normal_multiline"`, `"date_multiline"`, `"normal_multiline_extract_append"`, `"date_multiline_extract_append"` |

---
추가 설명
* 위의 기존 ㅣog_type 설명은 무시하고 하기의 내용에 따라 재정리
1. 현재 log_type 값을 3가지 독립적인 기능 축이 합쳐져 있음 
| 축       | 가능한 값                          |
|----------|------------------------------------|
| date 모드 | `normal` / `date` / `date_prefix` |
| line 모드 | `single` / `multiline`            |
| 후처리    | (없음) / `extract_append`          |

2. 위의 조합에 따라 가능한 log_type 의 기능 축 조합은 다음과 같으며, 일부 조합 case 에서 빠져 있는 항목은, ARSAgent 에서 기능 제공이 안되어 빠져 있는 항목임
| log_type                             | date        | line      | 후처리          |
|--------------------------------------|-------------|-----------|-----------------|
| `normal_single`                      | normal      | single    | -               |
| `date_single`                        | date        | single    | -               |
| `date_prefix_single`                | date_prefix | single    | -               |
| `normal_single_extract_append`       | normal      | single    | extract_append  |
| `date_single_extract_append`         | date        | single    | extract_append  |
| `date_prefix_single_extract_append`  | date_prefix | single    | extract_append  |
| `normal_multiline`                   | normal      | multiline | -               |
| `date_multiline`                     | date        | multiline | -               |
| `normal_multiline_extract_append`    | normal      | multiline | extract_append  |
| `date_multiline_extract_append`      | date        | multiline | extract_append  |

3. 각 기능축에 대한 설명
- normal : 일반적인 항목
- date : AccesssLog 파일의 대상 경로를 directory + date_subdir_format 의 조합으로 결정
- date_prefix : AccesssLog 파일의 대상 경로를 directory + date_subdir_format 의 조합으로 결정.
                대상 파일의 접두어를 joda date time format 을 사용하여 결정
- single : 1개 라인 단위로 trigger 에 전달
- multiline : 여러 라인을 group 으로 모아 trigger 에 전달
- extract_append : Full Path 의 파일 경로에서 `extractPattern` 에서 지정한 추출 값을 `appendPos` 항목에서 지정한 위치에 따라 trigger 에 전달하기전 log 에 붙임
 예시) 파일의 경로가 `D:\EARS\Log\2025\08\05\app_log.txt` 이고,
      log 가 `05:46:49 INFO  DummyAgentMain:71 -    GET /health - Health check`  인 상황에서 
      `"extractPattern": ".*Log\\([0-9]+)\\([0-9]+)\\([0-9]+)\\app_log.*"`
      `"appendPos": 0`
      `"appendFormat": "@1-@2-@3 "`
      와 같이 설정되어 있다면 trigger 에 전달되는 최종 log 는 다음과 같음
      `202-08-05 05:46:49 INFO  DummyAgentMain:71 -    GET /health - Health check`
      즉, extractPattern 에서 정규표현식의 group 으로 추출지정된 값을 추출하여 appendPos 에서 지정한 위치(로그 앞) 에, appendFormat 으로  지정한 양식(@0, @01 과 같이 @[숫자] 로 추출된 값 매칭.
      나머지는 텍스트 처리)에 따라 log 에 추가하여 trigger에 전달

4. log_type 은 상기 3개 축에 대해 list 에서 선택하여, 최종적으로 2번의 가능한 List 내에서 조합되어 결정되도록 기능 구현 필요
---

#### `date_subdir_format`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `` |
| 설명 | 날짜 기반 하위 디렉토리 패턴 (Joda DateTime Format) |
| 예시 | `"'\\'yyyy'\\'MM'\\'dd"` → `\2024\01\15` |
| 비고 | Windows 경로 구분자 `\`를 리터럴로 쓰려면 작은따옴표로 감쌈. 비워두면 하위 디렉토리 없이 `directory` 경로에서 직접 읽음 |

> **주의**: JSON 문자열 내 백슬래시는 이중 이스케이프 필요. 실제 JSON 값: `"'\\\\'yyyy'\\\\'MM'\\\\'dd"`

---
추가 설명
1. date_subdir_format, 은 log_type 에 `date` 혹은 `date_prefix` 가 포함되어 있어야만 입력 활성화
2. date_subdir_format 항목에 대해 설정하지 않음 옵션이 필요. 설정하지 않을 경우 JSON preview 에 표시 하지 않음(JSON 에 항목을 추가 하지 않음)
3. date_subdir_format 이 설정되어 있으면 최종 경로는 `directory + date_subdir_format에서 joda date time 을 현재 시간을 기준으로 치환한 값`
  예시) `"dirctory": "D:\\EARS\\Log"`, `"date_subdir_format": "'\\'yyyy'\\'MM'\\'dd"`이고 현재 시간이 2025-12-25 13:41:55.123 이라면 최종 경로는 `D:\EARS\Log\2025\12\25` 
---
 
#### `charset` (enum)
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `` |
| 허용값 | `"UTF-8"`, `"EUC-KR"`, `"MS949"`, `"UCS-2 LE BOM"`, 직접 입력 |
| 설명 | 로그 파일의 문자 인코딩. 한글 환경은 `EUC-KR` 또는 `UTF-8` 을 주로 사용 |

---
추가 설명
1. charset 항목에 대해 설정하지 않음 옵션이 필요. 설정하지 않을 경우 JSON preview 에 표시 하지 않음(JSON 에 항목을 추가 하지 않음)
---

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
| 설명 | 한 번의 System 에 보내는 로그 batch 크기 (로그 라인 수) |
| 비고 | 로그 양이 많은 환경에서는 값을 높여 처리 효율화 |

---
추가 설명
1. Access Log 의 용도가 `Log Upload 용` 일때만 입력 활성화
---

#### `batch_timeout` (duration)
| 속성 | 값 |
|------|-----|
| 타입 | `string` (duration) |
| 기본값 | `"30 seconds"` |
| 설명 | batch send timeout 시간. log가 batch_count 만큼 수집 되지 않아도 System 보내는 대기 시간  |

---
추가 설명
1. Access Log 의 용도가 `Log Upload 용` 일때만 입력 활성화
---

#### `reopen`
| 속성 | 값 |
|------|-----|
| 타입 | `boolean` |
| 기본값 | `true` |
| 설명 | 매 접근 주기마다 파일 핸들을 다시 열지 여부 |
| 비고 | log 를 다른 해당 프로세스에서 점유하고 있지 않도록 일반적으로  `true` |


#### `back`
| 속성 | 값 |
|------|-----|
| 타입 | `boolean` |
| 기본값 | `` |
| 설명 | Access 파일의 크기가 줄어들 경우 파일을 처음부터 읽는지에 대한 설정 |
| 비고 | `true` 일 경우 파일 크기가 줄어들 경우 file을 처음부터 EOF 까지 한번에 읽음 |

---
추가 설명
1. back 항목에 대해 설정하지 않음 옵션이 필요. 설정하지 않을 경우 JSON preview 에 표시 하지 않음(JSON 에 항목을 추가 하지 않음)
---

#### `end`
| 속성 | 값 |
|------|-----|
| 타입 | `boolean` |
| 기본값 | `false` |
| 설명 | 최초 접근 시 파일 끝부터 읽기 시작할지 여부 |
| 비고 | `true`면 에이전트 시작 시점 이전 로그는 모두 건너뜀. 기존 로그를 분석하려면 `false` |

---
추가 설명
1. back 항목에 대해 설정하지 않음 옵션이 필요. 설정하지 않을 경우 JSON preview 에 표시 하지 않음(JSON 에 항목을 추가 하지 않음)
---

#### `exclude_suffix`
| 속성 | 값 |
|------|-----|
| 타입 | `string[]` (배열) |
| 기본값 | `[]` |
| 설명 | 모니터링에서 제외할 파일 확장자 목록 |
| 예시 | `[".bak", ".tmp", ".gz"]` |

#### `startPattern`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 로그를 Muliline 으로 모으기 시작하는 정규표현식 패턴 |
| 예시 | `".* WARN Alarm Occured.*"` |

---
추가 설명
1. startPattern 은 log_type 에 `multiline` 이 포함되어 있어야만 입력 활성화
---

#### `endPattern`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 로그를 Muliline 으로 모으기 완료하는 정규표현식 패턴. 해당 Pattern 의 로그까지 한 라인으로 모아서 trigger 에 전달 |
| 예시 | `".* WARN Alarm Reset.*"` |

---
추가 설명
1. endPattern 은 log_type 에 `multiline` 이 포함되어 있어야만 입력 활성화
---

#### `count`
| 속성 | 값 |
|------|-----|
| 타입 | `number` |
| 기본값 | `` |

| 설명 | 로그를 모으기 완료하는 라인 수. 해당 수량의 로그까지 한 라인으로 모아서 trigger 에 전달 |

---
추가 설명
1. count 는 log_type 에 `multiline` 이 포함되어 있어야만 입력 활성화
---

#### `priority`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `"count"` |
| 허용값 | `"count"`, `"pattern"` |
| 설명 | multiline 완료의 우선 순위 설정. 설정된 항목을 우선으로 처리함 |

---
추가 설명
1. count 는 log_type 에 `multiline` 이 포함되어 있어야만 입력 활성화
---

#### `extractPattern`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | Access 파일의 절대 경로(Full Path) 에서 로그에 붙일 Data 를 추출하는 패턴 설정 |
| 예시 | `".*Log\\([0-9]+)\\([0-9]+)\\([0-9]+)\\app_log.*"` |
| 비고 | 정규 표현식 `()` 을 사용한 Data 추출은 5개 까지로 제한 |

---
추가 설명
1. extractPattern 은 log_type 에 `extract_append` 이 포함되어 있어야만 입력 활성화
---

#### `appendPos`
| 속성 | 값 |
|------|-----|
| 타입 | `number` |
| 기본값 | `"0"` |
| 설명 | extractPattern 를 사용하여 경로에서 추출한 Data 를 로그에 붙일 위치 설정. `0` 은 로그 앞(왼쪽) |
| 예시 | `"0"` |

---
추가 설명
1. appendPos 는 log_type 에 `extract_append` 이 포함되어 있어야만 입력 활성화
---

#### `appendFormat`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | extractPattern 를 사용하여 경로에서 추출한 Data 의 포멧 설정. 추출한 data 는 왼쪽부터 순서대로 @1, @2, @3 .. 에 대응 |
| 예시 | `"@1-@2-@3 "` |

---
추가 설명
1. appendFormat 은 log_type 에 `extract_append` 이 포함되어 있어야만 입력 활성화
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
        "trigger": [
          {
            "syntax": "string",
            "params": "string" // 선택 항목
          }
        ],
        "duration": "duration string",
        "times": number,
        "next": "string",
        "script": { ... },  // next가 "@script"일 때만
        "detail": { ... }  // next가 "@popup"일 때만 선택적 입력
      }
    ],
    "limitation": {
      "times": number,
      "duration": "duration string" 
    }
  }
}
```

### 5.2 트리거 이름 (key) 규격

| 속성 | 값 |
|------|-----|
| 타입 | string (Object key) |
| 관례 | 대소문자 + 숫자 + 언더스코어 (예: `LIMITATION_Test_1`) |
| 참조처 | ARSAgent.json의 `ErrorTrigger[].alid` |

### 5.3 최상위 필드

#### `source` (필수)
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 설명 | 이 트리거가 모니터링할 로그 소스 이름 |
| 값 | AccessLog.json에 정의된 소스 key 중 하나 |
| 예시 | `"__LogReadInfo__"` |

--- 
추가 설명
- source 는 ,(콤마) 를 구분자로 하여 여러개 설정가능. ,(콤마) 사이에는 공백이 없게 설정
예시) "__LogReadInfo1__,__LogReadInfo2__"
- 따라서 source 선택시 복수개 선택이 가능하도록 UI 구성 필요
---

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
| 설명 | 트리거 발동 횟수 제한 (실행 폭주 방지) |

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
| 허용값 | `"regex"`, `"delay"` |

| 값 | 설명 | trigger 패턴 예시 |
|----|------|-------------------|
| `regex` | trigger 의 syntax 조건이 만족하면 next 를 실행하는 일반 step | `".*S3F216.*"` |
| `delay` | trigger 의 syntax 조건을 만족하면 step 초기 step 으로 되돌리는 step  | `"ERROR"` |
| 비고 | `delay` 는 일반적으로 regex step 이후 바로 next 를 실행하는 것이 아니라 조건을 추가하여, duration 내에 time 만큰 로그가 발생할때 대기하다 timeout 시 next 를 실행하는 지연실행 (혹은 실행 취소)의 용도로 사용 |


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

---
추가 설명
1. `syntax` 에서는 정규 표현식을 사용하는데, 정규 표현식에서 `()` 을 사용하여 group 을 하면 추출을 의미한다. 
 - 이때 추출된 값은 trigger 에서 변수로 사용되는데 변수면은 `()` 내부에 추출되는 정규표현식에 `<<[변수명>>` 와 같이 접두사로 표현한다.
   예시) `"syntax": ".*ERROR.*TIMEOUT: (<<duration>>[0-9]+).*"` -> [0-9]+ 로 추출된 값을 duration 에 저장
---


#### `params`
1. params 역할: syntax 의 정규 표현식에서 추출된 값을 크기비교하는 추가 발동 조건
2. params 구조: params 의 추가는 사용자가 선택에 따라 추가가 가능하다
```json
"trigger": [
  {
    "syntax": "string",
    "params": "string" // 선택 항목
  }
]
```
3. params string 구조 : `"ParameterMatcher[count]:[compare_value][op]@[extract_value_name]"`
 : syntax 에서 추출되는 값(extract_value_name)과 비교값(compare_value)을 Operation(op) 에 따라 비교하여 참일 경우 trigger 가 매칭되었다고 판단
  * 최종 발동은 duration, times, type 에 따라 달라지면, params 는 syntax 로 매칭된 log 에 대해 추가로 매칭 여부를 최종 판단하는 항목이다.
 - ParameterMatcher: 고정 값
 - count: 비교 항목 갯수. [compare_value][op]@[extract_value_name] 1개 set 이 비교 항목 한개, 2개 이상일 경우 ,(콤마) 를 구분자로 나열
          [compare_value][op]@[extract_value_name],[compare_value2][op2]@[extract_value_name2]
 - compare_value: 비교값 (number)
 - op : eq (같은), neq (같지 않음), gt (큼), gte (크거나 같음), lt (작음), lte (작거나 같음)
 - extract_value_name : syntax 의 정규 표현식에 의해 추출된 값의 변수명
 - 비교 방법 : extract_value_name  op compare_value  참이면 매칭. 예시) 1.0gte@value  : value 가 1.0 보다 크거나 같으면 참(최종 매칭)
 4. 설정 예시
 ```json
"trigger": [
  {
    "syntax": ".*Warning value: (<<value>[\\.0-9]+)",
    "params": "ParameterMatcher1:9.5gte@value" // 선택 항목
  }
]



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

#### `next` (필수)
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 허용값 | (1) 같은 트리거 내 다른 스텝의 `name`, (2) `"@recovery"`, `"@script"`, `"@notify"`, `"@popup"` |
| 설명 | 이 스텝 발동 후 실행할 동작 |

| next 값 | 동작 |
|---------|------|
| `"[다음 Step명]"` | 다음 스텝으로 진행 (스텝 체이닝) |
| `"@recovery"` | 트리거 이름 (key) 과 동일한 이름의 시나리오 실행 |
| `"@script"` | Code 기반 시나리오 실행 → `script` 객체 필수 |
| `"@notify"` | 이메일 발송 실행|
| `"@popup"` | PopUp 실행 → `detail` 객체 선택 |

---
추가 설명
1. `detail` 객체는 `"@popup"` 에서만 사용하는 추가 설정값으로 설정을 Skip 할 수 있다
---

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
| 설명 | 실행할 스크립트 파일명. 에이전트의 scripts 디렉토리에 위치해야 함 |
| 예시 | `"Test.scala"`, `"alert.bat"` |

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

### 5.6 detail 객체 필드 상세

`next`가 `"@popup"`일 때만 존재합니다. 실행 옵션을 정의합니다. 설정을 Skip 할 수 있습니다.

```json
"detail": {
  "no-email": "success;fail"
}
```

#### `no-email`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 이메일 알림을 보내지 않을 popup 결과값 목록. **세미콜론(`;`)으로 구분** |
| 예시 | `"success;fail"` → popup 결과가 "success" 또는 "fail"이면 이메일 미발송 |
| 비고 | JSON key에 하이픈 포함 (`no-email`). JavaScript에서 `obj['no-email']`로 접근 |


### 5.7 Limitation 필드 상세

트리거 전체의 발동 빈도를 제한하여 실행 폭주를 방지합니다.

#### `times`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `1` |
| 설명 | `duration` 기간 내 최대 트리거 발동 횟수 |

#### `duration`
| 속성 | 값 |
|------|-----|
| 타입 | `string` (duration) |
| 기본값 | `"1 minutes"` |
| 설명 | 트리거 발동 횟수 제한이 적용되는 기간 |

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

ARSAgent.json 에 상기 두가지 key 이외에도 여러 항목이 있지만, trigger.json, AccessLog.json 과 연관된 항목은 위 `ErrorTrigger`와 `AccessLogLists` 두가지로 고정됩니다. 
나머지 항목에 대해서는 Form 에서는 다루지 않습니다.


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

> **중요**: 배열 항목은 plain string이 아닌 **`{alid: string}` 객체**입니다. `alid`는 "alarm id"의 약어입니다.

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

### 7.1 Duration 단위 복수형

`"1 minutes"`, `"1 seconds"` 처럼 숫자가 1이어도 복수형을 사용합니다. EARS 시스템이 복수형만 파싱할 수 있는지는 미확인이나, 기존 config들은 모두 복수형을 사용합니다.

### 7.2 trigger 패턴의 객체 래핑

trigger.json의 `recipe[].trigger` 배열 항목은 `{syntax: "패턴"}` 형태의 객체입니다. Plain string `"패턴"`이 아닙니다. Form View의 FormTagInput에서 이 변환을 처리합니다 (`objectKey="syntax"` prop).

### 7.3 ErrorTrigger 항목의 객체 래핑

ARSAgent.json의 `ErrorTrigger` 배열 항목은 `{alid: "이름"}` 형태의 객체입니다. `AccessLogLists`는 plain string 배열과 비대칭적 구조입니다.

### 7.4 no-email 하이픈 키

trigger.json script의 `no-email` 필드는 키에 하이픈을 포함합니다. JavaScript에서 dot notation으로 접근 불가하므로 `obj['no-email']`을 사용해야 합니다.

### 7.5 date_subdir_format 이스케이프

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
      "duration": "1 minutes"
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
