# MongoDB Schema Documentation

## Database Overview

WebManager는 두 개의 MongoDB 데이터베이스를 사용합니다:

| Database | 용도 | 컬렉션 |
|----------|------|--------|
| **EARS** | Akka 서버와 공유 | EQP_INFO, ARS_USER_INFO, EMAIL_TEMPLATE_REPOSITORY, POPUP_TEMPLATE_REPOSITORY, EMAILINFO, EMAIL_RECIPIENTS, EMAIL_IMAGE_REPOSITORY, SC_PROPERTY, EQP_AUTO_RECOVERY, RECOVERY_SUMMARY_BY_SCENARIO, RECOVERY_SUMMARY_BY_EQUIPMENT, RECOVERY_SUMMARY_BY_TRIGGER, RECOVERY_SUMMARY_BY_CATEGORY |
| **WEB_MANAGER** | WebManager 전용 | FEATURE_PERMISSIONS, WEBMANAGER_ROLE_PERMISSIONS, CONFIG_SETTINGS, LOG_SETTINGS, UPDATE_SETTINGS, OS_VERSION_LIST, EXEC_COMMANDS, WEBMANAGER_LOG, CRON_RUN_LOG, RECOVERY_CATEGORY_MAP |

### 환경변수

```env
MONGODB_URI=mongodb://localhost:27017/EARS
WEBMANAGER_DB_URI=mongodb://localhost:27017/WEB_MANAGER
```

### WebManager 전용 필드 표기

EARS Database의 컬렉션에 WebManager가 추가한 전용 필드는 `[WM]`으로 표기합니다.
이 필드들은 Akka 서버에서 사용하지 않으며, WebManager에서만 읽기/쓰기합니다.

---

# EARS Database (Shared with Akka)

## EQP_INFO (클라이언트 정보)

클라이언트 장비 정보를 저장하는 컬렉션

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| line | String | Required | Line info |
| lineDesc | String | Required | Line description |
| process | String | Required | Process Name |
| eqpModel | String | Required | Equipment Model |
| eqpId | String | Required (PK) | Equipment ID |
| category | String | Required | Equipment Category |
| ipAddr | String | Required (PK) | Equipment IP Address |
| ipAddrL | String | Optional | Inner Network IP |
| serviceType | String | Optional | `[WM]` 서비스 제어 방식 (예: `win_sc`) |
| agentPorts | Object | Optional | `[WM]` 설비별 Agent 포트 override (미설정 시 .env 기본값 사용) |
| agentPorts.rpc | Number | Optional | `[WM]` ManagerAgent RPC 포트 (기본: `MANAGER_AGENT_PORT=7180`) |
| agentPorts.ftp | Number | Optional | `[WM]` ManagerAgent FTP 포트 (기본: `FTP_PORT=7181`) |
| agentPorts.socks | Number | Optional | `[WM]` SOCKS5 프록시 포트 (기본: `SOCKS_PROXY_PORT=30000`) |
| basePath | String | Optional | `[WM]` ManagerAgent 설치 경로 (예: `/app/ManagerAgent`, `D:/EARS/EEGAgent`). Tail/FTP 경로 resolve에 사용. `sc qc ARSAgent` RPC로 자동 감지 가능. |
| localpc | Long | Required | Local PC 여부 (1: Yes, 0: No) |
| emailcategory | String | Required | Email category |
| osVer | String | Required | OS version |
| onoff | Long | Required | 사용 여부 (1: 사용, 0: 미사용)|
| webmanagerUse | Number | Required | WebManager 사용 여부 (1: 사용, 0: 미사용) |
| installdate | String | Optional | 설치일자 (yyyy-MM-dd) |
| scFirstExcute | String | Optional | Scenario 최초 동작 일자 |
| snapshotTimeDiff | Number | Optional | 서버와의 시간 차이 |
| usereleasemsg | Number | Required | Release Message 사용 여부 |
| usetkincancel | Number | Required | TKIN Cancel 사용 여부 |

### Indexes

- `{ process: 1 }`
- `{ process: 1, eqpModel: 1 }` (compound)
- `{ eqpId: 1 }` (unique)

### agentPorts 필드 설명

설비별로 ManagerAgent 접속 포트가 다를 수 있으므로, `agentPorts` 객체에 개별 포트를 저장합니다.
값이 설정되지 않은 항목은 `.env`의 글로벌 기본값을 사용합니다.

```javascript
// 예시: SOCKS 프록시만 별도 포트 사용
{
  eqpId: "SOCKS_01",
  agentPorts: {
    socks: 30000    // rpc, ftp는 미설정 → .env 기본값 사용
  }
}

// 예시: 모든 포트를 기본값 사용 (agentPorts 없음)
{
  eqpId: "DIRECT_01"
  // agentPorts 필드 없음 → 모두 .env 기본값
}
```

---

## ARS_USER_INFO (시스템 사용자 정보 저장소)

시스템 사용자의 정보를 저장하는 컬렉션

### Fields

| Field Name | Type | 필수/선택 | Description |
|------------|------|---------|-------------|
| name | String | 필수 | 이름 (maxlength: 100) |
| singleid | String | 필수 (PK) | ID (unique, maxlength: 50) |
| password | String | 필수 | `[WM]` 암호화된 비밀번호 (bcrypt) |
| line | String | 필수 | line info (maxlength: 50) |
| process | String | 필수 | Process Name (레거시 호환용, `;` 구분자, maxlength: 200, 허용: `A-Z0-9_`) |
| processes | Array[String] | 선택 | `[WM]` Process 배열 (Multi-process 지원) |
| authority | String | 필수 | 시나리오 작성권한 (WRITE or 빈값) |
| authorityManager | NumberLong | 필수 | 사용자 등급 (아래 권한 체계 표 참조, 기본: 3) |
| note | String | 선택 | 사용자 관련 note(설명) |
| department | String | 선택 | `[WM]` 부서 |
| accountStatus | String | 선택 | `[WM]` 계정 상태 (pending/active/suspended, 기본: active) |
| passwordStatus | String | 선택 | `[WM]` 비밀번호 상태 (normal/reset_requested/must_change, 기본: normal) |
| passwordResetRequestedAt | Date | 선택 | `[WM]` 비밀번호 재설정 요청 시각 |
| lastLoginAt | Date | 선택 | `[WM]` 마지막 로그인 시각 |
| accessnum | NumberLong | 선택 | 시스템접속 횟수(자동 update) |
| accessnum_desktop | NumberLong | 선택 | Desktop시스템 접속횟수(자동 Update) |
| latestExecution | String | 선택 | 마지막 SE 실행 일시 |

### Indexes

- `{ singleid: 1 }` (unique)
- `{ process: 1 }`
- `{ processes: 1 }` (multikey)
- `{ line: 1 }`
- `{ authorityManager: 1 }`
- `{ accountStatus: 1 }`
- `{ passwordStatus: 1 }`

### Multi-Process 지원

- **process 필드** (Source of Truth): Akka 서버와 공유하는 세미콜론 구분 문자열 (예: `"CVD;ETCH;PHOTO"`)
- **processes 필드**: `[WM]` WebManager 편의용 배열 (예: `["CVD", "ETCH", "PHOTO"]`)
- **동기화 규칙**:
  - **저장 시** (WebManager → DB): `processes` 배열 → `process` 문자열로 변환 (`syncProcessFields()`)
  - **조회 시** (DB → WebManager): `process` 문자열 → `processes` 배열로 재생성 (항상 최신 보장)
  - **필터 쿼리**: `process` 필드에 대해 regex 매칭 (`(^|;)VALUE(;|$)`)

> ⚠️ **`process`가 단일 진실 소스(Source of Truth)**입니다. Akka 시스템이 `process`를 외부에서 변경할 수 있으므로, DB의 `processes` 배열이 stale할 수 있습니다. 조회 시 항상 `process`에서 재생성합니다.

```javascript
// DB 저장 형태
{
  process: "CVD;ETCH",         // Source of Truth (Akka 공유)
  processes: ["CVD", "ETCH"]   // [WM] 저장 시 동기화, 조회 시 재생성
}
```

### 권한 체계 (authorityManager)

| Level | 이름 | 설명 | 접근 권한 |
|-------|------|------|----------|
| 0 | User | 일반 유저 | Dashboard만 |
| 1 | Admin | 시스템 관리자 | **모든 메뉴** |
| 2 | Conductor | 유저 중 최고 관리자 | Dashboard만 |
| 3 | Manager | 유저 중 관리자 | Dashboard만 |

> **Sign Up 제한**: 회원가입 시 Admin(level=1)은 선택 불가. Admin 권한은 기존 Admin이 User Management에서 직접 부여.

---

## EMAIL_TEMPLATE_REPOSITORY (이메일 템플릿 저장소)

이메일 형식 정보를 저장하는 컬렉션

### Fields

| Field Name | Type | 필수/선택 | Description |
| ---------- | ---- | ------- | ----------- |
| app | String | 필수(PK) | app name. default: ARS |
| process | String | 필수(PK) | Process Name |
| model | String | 필수(PK) | Equipment Model |
| code | String | 필수(PK) | Action code |
| subcode | String | 필수(PK) | Action sub code |
| title | String | 필수 | email title |
| html | String | 필수 | email html contents |

### Indexes

- `{ app: 1, process: 1, model: 1, code: 1, subcode: 1 }` (compound unique)

---

## POPUP_TEMPLATE_REPOSITORY (팝업 템플릿 저장소)

Client가 실행하는 PopUp의 HTML 템플릿을 저장하는 컬렉션

### Fields

| Field Name | Type | 필수/선택 | Description |
|------------|------|---------|-------------|
| app | String | 필수(PK) | app name (default: ARS) |
| process | String | 필수(PK) | Process Name |
| model | String | 필수(PK) | Equipment Model |
| code | String | 필수(PK) | Action code |
| subcode | String | 필수(PK) | Action sub code (default: '_') |
| html | String | 필수 | popup html contents |

### Indexes

- `{ app: 1, process: 1, model: 1, code: 1, subcode: 1 }` (compound unique)

---

## EMAILINFO (시스템 이메일 수신인 정보 저장소)

시스템이 발송하는 이메일 정보(emailcategory) 별 수신인 들의 에메일 주소를 저장하는 컬렉션

### Fields

| Field Name | Type | 필수/선택 | Description |
|------------|------|-----------|-------------|
| project | String | 필수(PK) | email project (default: ARS) |
| category | String | 필수(PK) | email category. format: EMAIL-[process]-[model]-[email group] |
| account | String Array | 선택 | email 수신자 list |
| departments | String Array | 선택 | email 수신자 부서 Info List |

### Indexes

- `{ project: 1, category: 1 }` (compound unique)
- `{ project: 1 }`
- `{ category: 1 }`

---

## EMAIL_RECIPIENTS (시나리오 실행 결과 이메일 수신인 Category 저장소)

시스템이 발송하는 시나리오 실행 결과 이메일을 다른 Category 로 별도 지정하기 위한 컬렉션

### Fields

| Field Name | Type | 필수/선택 | Description |
|------------|------|---------|-------------|
| app | String | 필수 (PK) | app name. default: ARS |
| line | String | 필수 (PK) | line Info |
| process | String | 필수 (PK) | Process Name |
| model | String | 필수 (PK) | Equipment Model |
| code | String | 필수 (PK) | Action code |
| emailCategory | String | 필수 | email category |

### Indexes

- `{ app: 1, line: 1, process: 1, model: 1, code: 1 }` (compound unique)

---

## EMAIL_IMAGE_REPOSITORY (이메일 및 PopUp에 추가되는 Image 저장소)

시스템이 발송하는 이메일 및 Client 가 실행하는 PopUp 시 포함되는 Image 파일을 지정하기 위한 컬렉션

### Fields

| Field Name | Type | 필수/선택 | Description |
|------------|------|---------|-------------|
| prefix | String | 필수 (PK) | format: [app]\_[process]\_[model]\_[code]\_[subcode] |
| name | String | 필수 (PK) | Image file UUID |
| process | String | 선택 | `[WM]` 프로세스 (필터용) |
| model | String | 선택 | `[WM]` 모델 (필터용) |
| code | String | 선택 | `[WM]` 코드 (필터용) |
| subcode | String | 선택 | `[WM]` 서브코드 (필터용) |
| fileName | String | 필수 | Image file Name |
| body | BinData | 필수 | Image binary data |
| mimetype | String | 선택 | `[WM]` MIME 타입 (예: image/png) |
| size | Number | 선택 | `[WM]` 파일 크기 (bytes) |
| createdAt | Date | 선택 | `[WM]` 생성 시각 |

### Indexes

- `{ prefix: 1, name: 1 }` (compound unique)
- `{ process: 1, model: 1, code: 1, subcode: 1 }` (compound)

---

## SC_PROPERTY (시나리오 속성)

시나리오 정의 및 속성을 저장하는 컬렉션 (Akka 서버 관리, WebManager는 읽기 전용)

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| scname | String | Required | 시나리오 이름 (= EQP_AUTO_RECOVERY.ears_code) |
| process | String | Required | 공정 |
| eqpModel | String | Required | 장비 모델 |
| scCategory | NumberLong | Optional | 시나리오 카테고리 (숫자 코드) |
| property.IsEnabled | Boolean | Required | 시나리오 활성 여부 |
| property.ID | String | Required | 시나리오 고유 ID |
| property.Owners | Array | Optional | 수정 이력 ("userId@yyyy-MM-dd HH:mm:ss" 형식) |
| performance.ManWorkLoss | Number | Optional | 성과 지표 |
| performance.EqpPerfornmanceLoss | Number | Optional | 성과 지표 (DB 필드명 오타, 의도적 보존) |
| performance.EqpStopLoss | Number | Optional | 성과 지표 |
| performance.WaferLoss | Number | Optional | 성과 지표 |
| performance.InvestCostLoss | Number | Optional | 성과 지표 |

> ⚠️ WebManager는 이 컬렉션을 **읽기 전용**으로만 접근합니다. 쓰기는 Akka 서버만 수행합니다.

---

## RECOVERY_SUMMARY_BY_CATEGORY (카테고리별 Recovery 집계)

배치 cron이 EQP_AUTO_RECOVERY를 시나리오 카테고리(scCategory)별로 집계한 컬렉션.
SC_PROPERTY의 scCategory를 `$lookup`으로 조인하여 생성.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| period | String | Required | 집계 주기 (`hourly`, `daily`) |
| bucket | Date | Required | 집계 시간 버킷 (UTC, KST 기준) |
| line | String | Required | Line info |
| process | String | Required | Process Name |
| model | String | Required | Equipment Model |
| scCategory | Number | Required | 시나리오 카테고리 숫자 (-1 = Uncategorized) |
| total | Number | Required | 총 실행 건수 |
| status_counts | Object | Required | 상태별 건수 (`{ Success: N, Failed: N, ... }`) |
| updated_at | Date | Required | 마지막 업데이트 시각 |

### Indexes

- `{ period: 1, bucket: 1, line: 1, process: 1, model: 1, scCategory: 1 }` (unique, $merge용)

### 생성 방식

배치 파이프라인 (batchRunner.js)에서 기존 3개 파이프라인과 병렬 실행:
1. `$match` — create_date 범위 + status not null
2. `$lookup` — SC_PROPERTY에서 ears_code → scname으로 scCategory 조회
3. `$addFields` — scCategory 추출 (null이면 -1)
4. 2단 `$group` — (line, process, model, scCategory, status) → status_counts
5. `$merge` — RECOVERY_SUMMARY_BY_CATEGORY에 upsert

---

# WEB_MANAGER Database (WebManager-specific)

## 자동 초기화 로직 (중요)

WEB_MANAGER DB의 컬렉션들은 서버 시작 시 **자동 초기화**됩니다. 운영 환경에서 빈 DB로 배포해도 정상 동작합니다.

### 초기화 함수 위치

| 컬렉션 | 초기화 함수 | 파일 | 동작 |
|--------|-------------|------|------|
| FEATURE_PERMISSIONS | `initializeDefaultPermissions()` | `server/features/permissions/service.js` | 없으면 9개 기본 권한 생성 |
| WEBMANAGER_ROLE_PERMISSIONS | `initializeRolePermissions()` | `server/features/users/service.js` | 없으면 4개 역할 생성 |
| OS_VERSION_LIST | `initializeOSVersions()` | `server/features/os-version/service.js` | 없으면 기본 OS 버전 생성 |
| EMAIL_IMAGE_REPOSITORY | `initializeImageStorage()` | `server/features/images/service.js` | 인덱스 확인 |
| EXEC_COMMANDS | `initializeExecCommands()` | `server/features/exec-commands/service.js` | 없으면 4개 기본 명령어 upsert |
| CONFIG_SETTINGS | `initializeConfigSettings()` | `server/features/clients/configSettingsService.js` | 인덱스 확인 |
| LOG_SETTINGS | `initializeLogSettings()` | `server/features/clients/logSettingsService.js` | 없으면 기본 로그 소스 upsert |
| UPDATE_SETTINGS | `initializeUpdateSettings()` | `server/features/clients/updateSettingsService.js` | 인덱스 확인 + 레거시→프로필 마이그레이션 |
| RECOVERY_CATEGORY_MAP | `initializeRecoveryCategoryMap()` | `server/features/recovery/recoveryCategoryService.js` | 인덱스 확인 |

### 호출 순서 (`server/index.js`)

```javascript
await initializeDefaultPermissions();
await initializeRolePermissions();
await initializeOSVersions();
await initializeImageStorage();
await initializeExecCommands();
await initializeConfigSettings();
await initializeLogSettings();
await initializeUpdateSettings();
await initializeRecoveryCategoryMap();
```

### 신규 컬렉션 추가 시 체크리스트

1. `service.js`에 `DEFAULT_XXX` 상수와 `initializeXXX()` 함수 추가
2. `module.exports`에 초기화 함수 추가
3. `server/index.js`에 import 및 호출 추가
4. 이 문서(SCHEMA.md)에 컬렉션 스키마 문서화
5. 위 초기화 함수 테이블에 항목 추가

---

## FEATURE_PERMISSIONS (기능별 세부 권한)

기능별 역할 기반 세부 권한(Read/Write/Delete)을 저장하는 컬렉션

### Fields

| Field Name | Type | 필수/선택 | Description |
|------------|------|---------|-------------|
| feature | String | 필수 (PK) | 기능 식별자 (enum: 아래 참조) |
| permissions | Map<String, Object> | 필수 | 역할별 권한 맵 (키: roleLevel) |
| permissions.{roleLevel}.read | Boolean | 필수 | 조회 권한 |
| permissions.{roleLevel}.write | Boolean | 필수 | 생성/수정 권한 |
| permissions.{roleLevel}.delete | Boolean | 필수 | 삭제 권한 |
| updatedAt | Date | 자동 | 마지막 수정 일시 |
| updatedBy | String | 선택 | 수정한 Admin singleid |

### feature enum 값

| feature | 설명 |
|---------|------|
| `arsAgent` | ARS Agent 관리 |
| `equipmentInfo` | Equipment Info 관리 |
| `emailTemplate` | Email Template 관리 |
| `popupTemplate` | Popup Template 관리 |
| `emailRecipients` | Email Recipients 관리 |
| `emailInfo` | Email Info 관리 |
| `emailImage` | Email Image 관리 |
| `users` | User Management |
| `osVersion` | OS Version 관리 |

### 초기 권한 설정

| 기능 | Admin (1) | Conductor (2) | Manager (3) | User (0) |
|------|:---------:|:-------------:|:-----------:|:--------:|
| arsAgent | R/W/D | R | R | R |
| equipmentInfo | R/W/D | R | R | - |
| emailTemplate | R/W/D | R | R | - |
| popupTemplate | R/W/D | R | R | - |
| emailRecipients | R/W/D | R | R | - |
| emailInfo | R/W/D | R | R | - |
| emailImage | R/W/D | R | R | - |
| users | R/W/D | R | R | - |
| osVersion | R/W/D | R | R | - |

---

## WEBMANAGER_ROLE_PERMISSIONS (역할별 메뉴 권한)

역할별 메뉴 접근 권한을 저장하는 컬렉션

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| roleLevel | Number | Required (Unique) | 역할 레벨 (0-3) |
| roleName | String | Required | 역할 이름 |
| description | String | Optional | 역할 설명 |
| permissions.dashboardOverview | Boolean | Required | Dashboard Overview 접근 권한 |
| permissions.dashboardArsMonitor | Boolean | Required | ARSAgent Status 접근 권한 |
| permissions.dashboardArsVersion | Boolean | Required | ARSAgent Version 접근 권한 |
| permissions.dashboardResStatus | Boolean | Required | ResourceAgent Status 접근 권한 |
| permissions.dashboardResVersion | Boolean | Required | ResourceAgent Version 접근 권한 |
| permissions.arsAgent | Boolean | Required | ARS Agent Clients 접근 권한 |
| permissions.resourceAgent | Boolean | Required | Resource Agent Clients 접근 권한 |
| permissions.equipmentInfo | Boolean | Required | Equipment Info 접근 권한 |
| permissions.emailTemplate | Boolean | Required | Email Template 접근 권한 |
| permissions.popupTemplate | Boolean | Required | Popup Template 접근 권한 |
| permissions.emailRecipients | Boolean | Required | Email Recipients 접근 권한 |
| permissions.emailInfo | Boolean | Required | Email Info 접근 권한 |
| permissions.emailImage | Boolean | Required | Email Image 접근 권한 |
| permissions.alerts | Boolean | Required | Alerts 접근 권한 |
| permissions.settings | Boolean | Required | Settings 접근 권한 |
| permissions.users | Boolean | Required | Users 접근 권한 |
| createdAt | Date | Auto | 생성일 |
| updatedAt | Date | Auto | 수정일 |

### 기본 역할별 권한

| 메뉴 | User (0) | Admin (1) | Conductor (2) | Manager (3) |
|------|:--------:|:---------:|:-------------:|:-----------:|
| dashboardOverview | O | O | O | O |
| dashboardArsMonitor | O | O | O | O |
| dashboardArsVersion | O | O | O | O |
| dashboardResStatus | O | O | O | O |
| dashboardResVersion | O | O | O | O |
| arsAgent | - | O | - | - |
| resourceAgent | - | O | - | - |
| equipmentInfo | - | O | - | - |
| emailTemplate | - | O | - | - |
| popupTemplate | - | O | - | - |
| emailRecipients | - | O | - | - |
| emailInfo | - | O | - | - |
| emailImage | - | O | - | - |
| alerts | - | O | - | - |
| settings | - | O | - | - |
| users | - | O | - | - |

---

## CONFIG_SETTINGS (Config 파일 설정)

agentGroup별 Config 파일 정보를 저장하는 컬렉션.
Config Manager에서 FTP로 읽기/쓰기할 파일 목록을 관리합니다.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agentGroup | String | Required (PK) | Agent 그룹 식별자 (예: `ars_agent`, `resource_agent`) |
| configFiles | Array | Optional | Config 파일 목록 |
| configFiles[].fileId | String | Required | 파일 ID (예: `config_1`, `config_2`) |
| configFiles[].name | String | Required | 파일명 (예: `main.json`) |
| configFiles[].path | String | Required | FTP 경로 (예: `config/main.json`) |
| updatedBy | String | Optional | 수정자 (기본: `system`) |
| createdAt | Date | Auto | 생성일 |
| updatedAt | Date | Auto | 수정일 |

### Indexes

- `{ agentGroup: 1 }` (unique)

### Sample Data

```javascript
{
  agentGroup: "ars_agent",
  configFiles: [
    { fileId: "config_1", name: "main.json", path: "config/main.json" },
    { fileId: "config_2", name: "process.json", path: "config/process.json" }
  ],
  updatedBy: "admin"
}
```

---

## LOG_SETTINGS (로그 소스 설정)

agentGroup별 로그 파일 소스 정보를 저장하는 컬렉션.
Log Viewer에서 FTP로 조회할 로그 디렉토리와 파일명 필터를 관리합니다.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agentGroup | String | Required (PK) | Agent 그룹 식별자 (예: `ars_agent`, `resource_agent`) |
| logSources | Array | Optional | 로그 소스 목록 |
| logSources[].sourceId | String | Required | 소스 ID (예: `log_1`, `log_2`) |
| logSources[].name | String | Required | 소스 표시명 (예: `Agent Log`) |
| logSources[].path | String | Required | FTP 상대 디렉토리 경로 (예: `/logs/ARSAgent`) |
| logSources[].keyword | String | Optional | 파일명 필터 (예: `arsagent`, `*`) |
| updatedBy | String | Optional | 수정자 (기본: `system`) |
| createdAt | Date | Auto | 생성일 |
| updatedAt | Date | Auto | 수정일 |

### Indexes

- `{ agentGroup: 1 }` (unique)

### Sample Data

```javascript
{
  agentGroup: "ars_agent",
  logSources: [
    { sourceId: "log_1", name: "Agent Log", path: "/logs/ARSAgent", keyword: "arsagent" }
  ],
  updatedBy: "system"
}
```

---

## UPDATE_SETTINGS (소프트웨어 업데이트 설정)

agentGroup별 소프트웨어 업데이트 **프로필**을 저장하는 컬렉션.
각 프로필은 독립된 name/osVer/version/tasks/source를 가지며, OS별·버전별 다중 배포 구성을 지원합니다.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agentGroup | String | Required (PK) | Agent 그룹 식별자 (예: `ars_agent`, `resource_agent`) |
| profiles | Array | Optional | 배포 프로필 목록 |
| profiles[].profileId | String | Required | 프로필 ID (자동 생성: `prof_` 접두어) |
| profiles[].name | String | Required | 프로필 표시명 (예: `Windows v2.0`) |
| profiles[].osVer | String | Optional | 대상 OS 버전 (OS_VERSION_LIST 값). 빈 문자열 = "모든 OS" |
| profiles[].version | String | Optional | 배포 버전 (free text, 예: `2.0.0`) |
| profiles[].tasks | Array | Optional | 배포 태스크 목록 |
| profiles[].tasks[].taskId | String | Required | 태스크 ID (자동 생성: `task_` 접두어) |
| profiles[].tasks[].type | String | Optional | `copy` (파일 업로드) 또는 `exec` (원격 명령). 기본: `copy` |
| profiles[].tasks[].name | String | Required | 태스크 표시명 (예: `Agent Binary`) |
| profiles[].tasks[].stopOnFail | Boolean | Optional | `true`: 실패 시 해당 eqpId의 후속 태스크 스킵. 기본: `false` |
| profiles[].tasks[].sourcePath | String | Optional | copy용: 소스 경로 (trailing `/` = directory) |
| profiles[].tasks[].targetPath | String | Optional | copy용: basePath 기준 상대경로 (예: `bin/agent.jar`) |
| profiles[].tasks[].commandLine | String | Optional | exec용: 실행 명령어 (예: `net`, `./bin/install.bat`) |
| profiles[].tasks[].args | [String] | Optional | exec용: 명령어 인수 배열 (예: `["stop", "svc"]`) |
| profiles[].tasks[].timeout | Number | Optional | exec용: 실행 타임아웃(ms). 기본: 30000 |
| profiles[].tasks[].description | String | Optional | 태스크 설명 |
| profiles[].source | Object | Optional | 프로필별 업데이트 소스 설정 |
| profiles[].source.type | String | Optional | 소스 타입: `local`, `ftp`, 또는 `minio`. 기본: `local` |
| profiles[].source.localPath | String | Optional | 로컬 경로 (type=local 시) |
| profiles[].source.ftpHost | String | Optional | 외부 FTP 호스트 (type=ftp 시) |
| profiles[].source.ftpPort | Number | Optional | 외부 FTP 포트. 기본: 21 |
| profiles[].source.ftpUser | String | Optional | 외부 FTP 사용자 |
| profiles[].source.ftpPass | String | Optional | 외부 FTP 비밀번호 |
| profiles[].source.ftpBasePath | String | Optional | 외부 FTP 기본 경로 |
| profiles[].source.minioEndpoint | String | Optional | MinIO 호스트 (type=minio 시) |
| profiles[].source.minioPort | Number | Optional | MinIO 포트. 기본: 9000 |
| profiles[].source.minioBucket | String | Optional | MinIO 버킷명 |
| profiles[].source.minioAccessKey | String | Optional | MinIO Access Key |
| profiles[].source.minioSecretKey | String | Optional | MinIO Secret Key |
| profiles[].source.minioUseSSL | Boolean | Optional | SSL 사용 여부. 기본: false |
| profiles[].source.minioBasePath | String | Optional | 오브젝트 prefix (선택) |
| updatedBy | String | Optional | 수정자 (기본: `system`) |
| createdAt | Date | Auto | 생성일 |
| updatedAt | Date | Auto | 수정일 |

### Indexes

- `{ agentGroup: 1 }` (unique)

### 마이그레이션

서버 시작 시 `initializeUpdateSettings()`가 레거시 문서를 자동 감지하여 변환합니다:
- Migration A: flat `packages[]` + `source` → `profiles: [{ ..., tasks: [] }]` (기존 `packages`, `source` 필드 `$unset`)
- Migration B: `profiles[].packages[]` → `profiles[].tasks[]` (packageId→taskId, type=copy 기본)

### 배포 실행 모델

```
eqpId별 순차, eqpId간 병렬 (concurrency pool, default=3):

for each eqpId (병렬):
  for each task (순차):
    if task.type === 'copy': FTP 파일 업로드
    if task.type === 'exec': Avro RPC 원격 명령 실행
    if failed && task.stopOnFail: 남은 태스크 → status: 'skipped'
```

- exec 태스크의 상대경로(`./`, `.\\`)는 `controlService.resolveCommandPath()`로 basePath 기반 절대경로 변환

### 배포 시 프로필 선택 흐름

```
1차: agentGroup — 페이지 라우트 meta에서 자동 결정
2차: 선택된 클라이언트의 EQP_INFO.osVer → 프로필의 osVer 자동 매칭
3차: 사용자가 남은 프로필 중 수동 선택 → 태스크 선택 → Deploy
```

- osVer가 비어있는 프로필은 "모든 OS"로 간주하여 항상 표시

### Sample Data

```javascript
{
  agentGroup: "ars_agent",
  profiles: [
    {
      profileId: "prof_a1b2c3d4",
      name: "Windows v2.0",
      osVer: "Windows",
      version: "2.0.0",
      tasks: [
        { taskId: "task_1", type: "exec", name: "Stop Service", commandLine: "net", args: ["stop", "ARSAgent"], timeout: 30000, stopOnFail: true },
        { taskId: "task_2", type: "copy", name: "Agent Binary", sourcePath: "bin/agent.jar", targetPath: "bin/agent.jar" },
        { taskId: "task_3", type: "exec", name: "Start Service", commandLine: "net", args: ["start", "ARSAgent"], timeout: 30000 }
      ],
      source: { type: "local", localPath: "/opt/releases/ars-agent/win-2.0" }
    },
    {
      profileId: "prof_e5f6g7h8",
      name: "Linux v2.0",
      osVer: "Redhat",
      version: "2.0.0",
      tasks: [
        { taskId: "task_1", type: "copy", name: "Agent Binary", sourcePath: "bin/agent.jar", targetPath: "bin/agent.jar" }
      ],
      source: { type: "ftp", ftpHost: "release-server", ftpBasePath: "/releases/linux" }
    }
  ],
  updatedBy: "admin"
}
```

---

## OS_VERSION_LIST (OS 버전 목록)

EQP_INFO의 osVer 필드에서 선택 가능한 OS 버전 목록을 관리하는 컬렉션

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | String | Required (Unique) | OS 버전명 (예: "Windows 10", "Windows 11") |
| description | String | Optional | 버전 설명 |
| active | Boolean | Required | 활성 여부 (true: 드롭다운에 표시) |
| createdAt | Date | Auto | 생성일 |
| updatedAt | Date | Auto | 수정일 |

### Indexes

- `{ version: 1 }` (unique)
- `{ active: 1 }`

---

## EXEC_COMMANDS (실행 명령어 관리)

ManagerAgent를 통해 실행할 수 있는 명령어를 관리하는 컬렉션

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| commandId | String | Required (PK) | 명령어 ID |
| name | String | Required | 명령어 표시 이름 |
| commandLine | String | Required | 실행 파일/명령 |
| args | Array[String] | Optional | 인자 목록 |
| timeout | Number | Optional | 타임아웃 ms (기본: 30000) |
| description | String | Optional | 설명 |
| category | String | Optional | 카테고리 |
| targetService | String | Optional | 대상 서비스명 |
| active | Boolean | Optional | 활성화 여부 (기본: true) |
| createdAt | Date | Auto | 생성일 |
| updatedAt | Date | Auto | 수정일 |

### Indexes

- `{ commandId: 1 }` (unique)

### 기본 명령어 (자동 초기화)

| commandId | name | commandLine | args | timeout |
|-----------|------|-------------|------|---------|
| service_status | Check Status | processctl | ['status'] | 10000 |
| service_start | Start Service | processctl | ['start'] | 30000 |
| service_stop | Stop Service | processctl | ['stop'] | 30000 |
| service_restart | Restart Service | processctl | ['restart'] | 60000 |

---

## RECOVERY_CATEGORY_MAP (시나리오 카테고리명 매핑)

SC_PROPERTY.scCategory 숫자값에 대한 사람이 읽을 수 있는 이름을 관리하는 컬렉션.
Admin이 Recovery by Category 대시보드에서 관리.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| scCategory | Number | Required (Unique) | SC_PROPERTY.scCategory 숫자값 |
| categoryName | String | Required | 카테고리 표시명 (예: "PM", "Chamber Clean", "Vision") |
| description | String | Optional | 카테고리 설명 |
| updatedBy | String | Optional | 마지막 수정자 singleid |
| updatedAt | Date | Optional | 수정 시각 |

### Indexes

- `{ scCategory: 1 }` (unique)

### 초기화

서버 시작 시 `initializeRecoveryCategoryMap()`이 인덱스 존재 확인 및 생성.

---

## WEBMANAGER_LOG (통합 로그)

WebManager의 모든 로그를 통합 저장하는 컬렉션 (감사, 에러, 인증, 배치, 접근)

### 공통 Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| category | String | Required | 로그 카테고리 (enum: `audit`, `error`, `auth`, `batch`, `access`) |
| timestamp | Date | Optional | 타임스탬프 (기본: 현재 시각) |
| userId | String | Optional | 사용자 ID (기본: `system`) |
| expireAt | Date | Optional | TTL 만료 시각 (카테고리별 자동 설정) |

### audit 카테고리 전용 Fields

| Field | Type | Description |
|-------|------|-------------|
| collectionName | String | 대상 컬렉션명 |
| documentId | String | 문서 ID |
| action | String | 액션 (enum: `create`, `update`, `delete`, `upload`, `save`, `deploy`, `start`, `stop`, `restart`, `kill`, `approve`, `download`, `backup`, `restore`) |
| changes | Mixed | 변경사항 (`{ field: { from, to } }`) |
| previousData | Mixed | 이전 데이터 (sensitiveFields는 `[REDACTED]`) |
| newData | Mixed | 새 데이터 (skipFullDataInAudit 시 null) |
| targetType | String | 액션 대상 유형 (createActionLog용) |
| targetId | String | 액션 대상 식별자 (createActionLog용) |
| details | Mixed | 추가 정보 (createActionLog용) |

### error 카테고리 전용 Fields

| Field | Type | Description |
|-------|------|-------------|
| errorType | String | 에러 타입 |
| errorMessage | String | 에러 메시지 |
| errorStack | String | 에러 스택 트레이스 |
| requestInfo.method | String | HTTP 메소드 |
| requestInfo.url | String | 요청 URL |
| requestInfo.body | Mixed | 요청 본문 |

### auth 카테고리 전용 Fields

| Field | Type | Description |
|-------|------|-------------|
| authAction | String | 인증 액션 (enum: `login`, `logout`, `login_failed`, `signup`, `password_reset_request`, `password_changed`, `password_reset_verified`, `permission_denied`) |
| ipAddress | String | 클라이언트 IP 주소 |
| userAgent | String | User Agent 문자열 |

### batch 카테고리 전용 Fields

| Field | Type | Description |
|-------|------|-------------|
| batchAction | String | 배치 액션 (enum: `cron_completed`, `cron_skipped`, `cron_failed`, `backfill_started`, `backfill_completed`, `backfill_cancelled`, `auto_backfill_completed`) |
| batchPeriod | String | 배치 주기 (`hourly`, `daily`) |
| batchParams | Mixed | 배치 파라미터 |
| batchResult | Mixed | 배치 결과 |

### access 카테고리 전용 Fields

| Field | Type | Description |
|-------|------|-------------|
| pagePath | String | 페이지 경로 (예: `/email-template`) |
| pageName | String | 페이지 이름 (예: `EmailTemplate`) |
| enterTime | Date | 페이지 진입 시각 |
| leaveTime | Date | 페이지 이탈 시각 |
| durationMs | Number | 체류 시간 (ms) |

### TTL 보존 정책

| 카테고리 | 기본 보존 | 환경변수 |
|---------|----------|---------|
| audit | 730일 (2년) | `AUDIT_RETENTION_DAYS` |
| auth | 365일 (1년) | `AUTH_RETENTION_DAYS` |
| error | 90일 | `ERROR_RETENTION_DAYS` |
| batch | 365일 (1년) | `BATCH_RETENTION_DAYS` |
| access | 90일 | `ACCESS_RETENTION_DAYS` |

### Indexes

- `{ category: 1, timestamp: -1 }` (compound)
- `{ category: 1, userId: 1, timestamp: -1 }` (compound)
- `{ collectionName: 1, documentId: 1 }` (compound, audit용)
- `{ collectionName: 1, timestamp: -1 }` (compound, audit용)
- `{ category: 1, errorType: 1, timestamp: -1 }` (compound, error용)
- `{ category: 1, authAction: 1, timestamp: -1 }` (compound, auth용)
- `{ category: 1, batchAction: 1, timestamp: -1 }` (compound, batch용)
- `{ category: 1, pagePath: 1, timestamp: -1 }` (compound, access용)
- `{ expireAt: 1 }` (TTL index, expireAfterSeconds: 0)

---
