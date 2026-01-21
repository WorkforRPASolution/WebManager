# MongoDB Schema Documentation

## Database: EARS

---

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

### Sample Data
- 71 clients (5 processes, 15 models)

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

## ARS_USER_INFO (시스템 사용자 정보 저장소)

시스템 사용자의 정보를 저장하는 컬렉션

### Fields

| Field Name | Type | 필수/선택 | Description |
|------------|------|---------|-------------|
| name | String | 필수 | 이름 |
| singleid | String | 필수 (PK) | ID |
| line | String | 필수 | line info |
| process | String | 필수 | Process Name |
| authority | String | 필수 | 권한. (WRITE or 빈값) |
| authorityManager | NumberLong | 필수 | 사용자 등급 (아래 권한 체계 표 참조) |
| note | String | 필수 | 사용자 관련 note(설명) |
| accessnum | NumberLong | 선택 | 시스템접속 횟수(자동 update) |
| accessnum_desktop | NumberLong | 선택 | Desktop시스템 접속횟수(자동 Update) |
| lastExecution | String | 선택 | 마지막 접속 일자. format : yyyy-MM-ddTHH:mm:ss.SSS+09:00" (자동 update) |

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

<!-- 새 컬렉션 추가 시 아래 형식으로 작성 -->
<!--
## COLLECTION_NAME (설명)

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| field1 | String | Required | 설명 |

-->
