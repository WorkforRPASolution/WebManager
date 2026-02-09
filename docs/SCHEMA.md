# MongoDB Schema Documentation

## Database Overview

WebManager는 두 개의 MongoDB 데이터베이스를 사용합니다:

| Database | 용도 | 컬렉션 |
|----------|------|--------|
| **EARS** | Akka 서버와 공유 | EQP_INFO, EMAIL_TEMPLATE_REPOSITORY, EMAILINFO, ARS_USER_INFO |
| **WEB_MANAGER** | WebManager 전용 | FEATURE_PERMISSIONS, OS_VERSION_LIST, WEBMANAGER_ROLE_PERMISSIONS |

### 환경변수

```env
MONGODB_URI=mongodb://localhost:27017/EARS
WEBMANAGER_DB_URI=mongodb://localhost:27017/WEB_MANAGER
```

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
| serviceType | String | Optional | 서비스 제어 방식 (예: `win_sc`) |
| agentPorts | Object | Optional | 설비별 Agent 포트 override (미설정 시 .env 기본값 사용) |
| agentPorts.rpc | Number | Optional | ManagerAgent RPC 포트 (기본: `MANAGER_AGENT_PORT=7180`) |
| agentPorts.ftp | Number | Optional | ManagerAgent FTP 포트 (기본: `FTP_PORT=7181`) |
| agentPorts.socks | Number | Optional | SOCKS5 프록시 포트 (기본: `SOCKS_PROXY_PORT=30000`) |
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

**마이그레이션**: 기존 `socksPort` 필드는 `agentPorts.socks`로 통합됨 (`server/scripts/migrateAgentPorts.js`)

### Sample Data
- 75 clients (5 processes, 15 models)

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

---

## EMAIL_IMAGE_REPOSITORY (이메일 및 PopUp에 추가되는 Image 저장소)

시스템이 발송하는 이메일 및 Client 가 실행하는 PopUp 시 포함되는 Image 파일을 지정하기 위한 컬렉션

| Field Name | Type | 필수/선택 | Description |
|------------|------|---------|-------------|
| prefix | String | 필수 (PK) | format: [app]_[process]_[model]_[code]_[subcode] |
| name | String | 필수 (PK) | Image file UUID |
| fileName | String | 필수 | Image file Name |
| body | BinData | 필수 | Image binary data |

---

## ARS_USER_INFO (시스템 사용자 정보 저장소)

시스템 사용자의 정보를 저장하는 컬렉션

### Fields

| Field Name | Type | 필수/선택 | Description |
|------------|------|---------|-------------|
| name | String | 필수 | 이름 |
| singleid | String | 필수 (PK) | ID |
| line | String | 필수 | line info |
| process | String | 필수 | Process Name (레거시 호환용, `;` 구분자) |
| processes | Array[String] | 선택 | Process 배열 (WebManager용, Multi-process 지원) |
| authority | String | 필수 | 권한. (WRITE or 빈값) |
| authorityManager | NumberLong | 필수 | 사용자 등급 (아래 권한 체계 표 참조) |
| note | String | 필수 | 사용자 관련 note(설명) |
| accessnum | NumberLong | 선택 | 시스템접속 횟수(자동 update) |
| accessnum_desktop | NumberLong | 선택 | Desktop시스템 접속횟수(자동 Update) |
| lastExecution | String | 선택 | 마지막 접속 일자. format : yyyy-MM-ddTHH:mm:ss.SSS+09:00" (자동 update) |

### Multi-Process 지원 (2026-01-26 추가)

- **process 필드**: 레거시 시스템과 호환되는 문자열 필드 (예: `"CVD;ETCH;PHOTO"`)
- **processes 필드**: WebManager에서 사용하는 배열 필드 (예: `["CVD", "ETCH", "PHOTO"]`)
- **동기화**: WebManager에서 저장 시 두 필드가 자동으로 동기화됨
  - processes 변경 → process 필드에 `;` 구분자로 저장
  - 기존 데이터 마이그레이션: `server/scripts/migrateProcesses.js` 실행

```javascript
// 동기화 예시
{
  process: "CVD;ETCH",         // 레거시 호환용
  processes: ["CVD", "ETCH"]   // WebManager용
}
```

### 권한 체계 (authorityManager)

| Level | 이름 | 설명 | 접근 권한 |
|-------|------|------|----------|
| 0 | User | 일반 유저 | Dashboard만 |
| 1 | Admin | 시스템 관리자 | **모든 메뉴** |
| 2 | Conductor | 유저 중 최고 관리자 | Dashboard만 |
| 3 | Manager | 유저 중 관리자 | Dashboard만 |

**권한별 메뉴 접근**:
| 메뉴 | User (0) | Admin (1) | Conductor (2) | Manager (3) |
|------|:--------:|:---------:|:-------------:|:-----------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Clients | ❌ | ✅ | ❌ | ❌ |
| Master | ❌ | ✅ | ❌ | ❌ |
| Email Template | ❌ | ✅ | ❌ | ❌ |
| Alerts | ❌ | ✅ | ❌ | ❌ |
| Settings | ❌ | ✅ | ❌ | ❌ |
| Users | ❌ | ✅ | ❌ | ❌ |

---

# WEB_MANAGER Database (WebManager-specific)

## ⚠️ 자동 초기화 로직 (중요)

WEB_MANAGER DB의 컬렉션들은 서버 시작 시 **자동 초기화**됩니다. 운영 환경에서 빈 DB로 배포해도 정상 동작합니다.

### 초기화 함수 위치

| 컬렉션 | 초기화 함수 | 파일 |
|--------|-------------|------|
| FEATURE_PERMISSIONS | `initializeDefaultPermissions()` | `server/features/permissions/service.js` |
| WEBMANAGER_ROLE_PERMISSIONS | `initializeRolePermissions()` | `server/features/users/service.js` |
| OS_VERSION_LIST | `initializeOSVersions()` | `server/features/os-version/service.js` |

### 호출 순서 (`server/index.js`)

```javascript
await initializeDefaultPermissions();
await initializeRolePermissions();
await initializeOSVersions();
```

### 신규 컬렉션 추가 시 체크리스트

1. ✅ `service.js`에 `DEFAULT_XXX` 상수와 `initializeXXX()` 함수 추가
2. ✅ `module.exports`에 초기화 함수 추가
3. ✅ `server/index.js`에 import 및 호출 추가
4. ✅ 이 문서(SCHEMA.md)에 컬렉션 스키마 문서화
5. ✅ 위 초기화 함수 테이블에 항목 추가

---

## FEATURE_PERMISSIONS (기능별 세부 권한)

기능별 역할 기반 세부 권한(Read/Write/Delete)을 저장하는 컬렉션

### Fields

| Field Name | Type | 필수/선택 | Description |
|------------|------|---------|-------------|
| feature | String | 필수 (PK) | 기능 식별자 (master, emailTemplate, users) |
| permissions | Object | 필수 | 역할별 권한 맵 |
| permissions.{roleLevel} | Object | 필수 | 각 역할의 권한 (0, 1, 2, 3) |
| permissions.{roleLevel}.read | Boolean | 필수 | 조회 권한 |
| permissions.{roleLevel}.write | Boolean | 필수 | 생성/수정 권한 |
| permissions.{roleLevel}.delete | Boolean | 필수 | 삭제 권한 |
| updatedAt | Date | 자동 | 마지막 수정 일시 |
| updatedBy | String | 선택 | 수정한 Admin singleid |

### 초기 권한 설정

| 기능 | Admin (1) | Conductor (2) | Manager (3) | User (0) |
|------|:---------:|:-------------:|:-----------:|:--------:|
| Master Data | R/W/D | R | R | - |
| Email Template | R/W/D | R | R | - |
| User Management | R/W/D | R | R | - |

### Sample Data

```javascript
{
  feature: "master",
  permissions: {
    0: { read: false, write: false, delete: false },  // User
    1: { read: true, write: true, delete: true },     // Admin (항상 true)
    2: { read: true, write: false, delete: false },   // Conductor
    3: { read: true, write: false, delete: false }    // Manager
  },
  updatedAt: ISODate("2026-01-20T00:00:00.000Z"),
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

### Sample Data

```javascript
{
  version: "Windows 10",
  description: "Windows 10 Enterprise LTSC",
  active: true,
  createdAt: ISODate("2026-01-28T00:00:00.000Z"),
  updatedAt: ISODate("2026-01-28T00:00:00.000Z")
}
```

---

## WEBMANAGER_ROLE_PERMISSIONS (역할별 메뉴 권한)

역할별 메뉴 접근 권한을 저장하는 컬렉션

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| roleLevel | Number | Required (Unique) | 역할 레벨 (0-3) |
| roleName | String | Required | 역할 이름 (User, Admin, Conductor, Manager) |
| description | String | Optional | 역할 설명 |
| permissions | Object | Required | 메뉴별 접근 권한 |
| permissions.dashboard | Boolean | Required | Dashboard 접근 권한 |
| permissions.clients | Boolean | Required | Clients 접근 권한 |
| permissions.equipmentInfo | Boolean | Required | Equipment Info 접근 권한 |
| permissions.emailTemplate | Boolean | Required | Email Template 접근 권한 |
| permissions.emailInfo | Boolean | Required | Email Info 접근 권한 |
| permissions.alerts | Boolean | Required | Alerts 접근 권한 |
| permissions.settings | Boolean | Required | Settings 접근 권한 |
| permissions.users | Boolean | Required | Users 접근 권한 |
| createdAt | Date | Auto | 생성일 |
| updatedAt | Date | Auto | 수정일 |

### Sample Data

```javascript
{
  roleLevel: 1,
  roleName: "Admin",
  description: "시스템 관리자",
  permissions: {
    dashboard: true,
    clients: true,
    equipmentInfo: true,
    emailTemplate: true,
    emailInfo: true,
    alerts: true,
    settings: true,
    users: true
  }
}
```

---

<!-- 새 컬렉션 추가 시 아래 형식으로 작성 -->
<!--
## COLLECTION_NAME (설명)

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| field1 | String | Required | 설명 |

-->
