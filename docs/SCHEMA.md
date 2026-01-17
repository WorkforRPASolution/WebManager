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
| IpAddr | String | Required (PK) | Equipment IP Address |
| IpAddrL | String | Optional | Inner Network IP |
| localpcNunber | Long | Required | Local PC 여부 (1: Yes, 0: No) |
| emailcategory | String | Required | Email category |
| osVer | String | Required | OS version |
| onoffNunber | Long | Required | 사용 여부 (1: 사용, 0: 미사용) |
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
| htmp | String | 필수 | email html contents |

---

<!-- 새 컬렉션 추가 시 아래 형식으로 작성 -->
<!--
## COLLECTION_NAME (설명)

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| field1 | String | Required | 설명 |

-->
