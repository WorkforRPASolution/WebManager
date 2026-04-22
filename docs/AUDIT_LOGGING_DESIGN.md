# 통합 Audit & Activity Logging 시스템

## 구현 완료 (2026-03-21)

---

### 아키텍처 개요

```
┌──────────────────────────────────────────────────────────────┐
│                       WEBMANAGER_LOG                         │
│   category: audit | auth | error | batch | access            │
│   TTL: expireAt (카테고리별 자동 만료)                        │
├────────────────┬──────────────┬──────────────────────────────┤
│ CRUD Audit     │ Action Audit │ Access Logging               │
│ (기준정보/설정)│ (Clients)    │ (페이지 접근)                 │
├────────────────┼──────────────┼──────────────────────────────┤
│ createTemplate │ createAction │ useAccessLogger()            │
│ Service()      │ Log()        │ (Vue composable)             │
│ makeAuditHelper│ 직접 호출     │ → POST /api/access-logs      │
│ createCrud     │              │ + sendBeacon                 │
│ Service()      │              │                              │
└────────────────┴──────────────┴──────────────────────────────┘
```

---

### 핵심 모듈

| 모듈 | 위치 | 설명 |
|------|------|------|
| `createCrudService` | `server/shared/utils/createCrudService.js` | CRUD 팩토리 — audit 자동, sensitiveFields, skipFullData |
| `createTemplateService` | `server/shared/utils/createTemplateService.js` | Template CRUD 팩토리 — createCrudService 내장 + 필터/페이지네이션 |
| `makeAuditHelper` | `server/shared/models/webmanagerLogModel.js` | 공유 audit 헬퍼 팩토리 (fire-and-forget) |
| `createActionLog` | `server/shared/models/webmanagerLogModel.js` | 비-CRUD 액션 로깅 (start/stop/deploy 등) |
| `calculateChanges` | `server/shared/models/webmanagerLogModel.js` | 필드 레벨 변경 추적 + sensitiveFields [REDACTED] |
| `redactSensitiveFields` | `server/shared/models/webmanagerLogModel.js` | 민감 필드 마스킹 |
| `useAccessLogger` | `client/src/shared/composables/useAccessLogger.js` | 페이지 접근 로그 수집 (Router guard + 30초 배치 + sendBeacon) |

---

### WEBMANAGER_LOG 카테고리 & 보존 정책

| 카테고리 | 보존 기간 | 환경변수 | 용도 |
|---------|----------|---------|------|
| audit | 2년 | `AUDIT_RETENTION_DAYS=730` | 데이터 변경 이력 (CRUD + 설정) |
| auth | 1년 | `AUTH_RETENTION_DAYS=365` | 인증/권한 (login/logout/signup) |
| error | 90일 | `ERROR_RETENTION_DAYS=90` | 서버 에러/예외 |
| batch | 1년 | `BATCH_RETENTION_DAYS=365` | Cron/Backfill 배치 실행 |
| access | 90일 | `ACCESS_RETENTION_DAYS=90` | 페이지 접근 이력 |

구현: `expireAt` 필드 + TTL 인덱스 `{ expireAt: 1 }, { expireAfterSeconds: 0 }`

### 액션 타입 (action enum)

`create`, `update`, `delete`, `upload`, `save`, `deploy`, `start`, `stop`, `restart`, `kill`, `approve`, `download`, `backup`, `restore`

---

### 도메인별 적용 현황

#### Domain 1: 기준정보 관리

| 서비스 | 컬렉션 | 방식 | 비고 |
|--------|--------|------|------|
| EQP_INFO | EQP_INFO | businessRules (기존) | enableAuditLog:true |
| Email Template | EMAIL_TEMPLATE_REPOSITORY | `createTemplateService` | skipFullDataInAudit, 서비스 레이어 분리 |
| Popup Template | POPUP_TEMPLATE_REPOSITORY | `createTemplateService` | skipFullDataInAudit, 서비스 레이어 분리 |
| Email Info | EMAILINFO | `makeAuditHelper` | |
| Email Recipients | EMAIL_RECIPIENTS | `makeAuditHelper` | |
| Email Image | EMAIL_IMAGE_REPOSITORY | `createActionLog` | upload/update/delete |
| OS Version | OS_VERSION_LIST | `makeAuditHelper` | |
| User Management | ARS_USER_INFO | `makeAuditHelper` | sensitiveFields: ['password'] |

#### Domain 2: System

| 서비스 | 방식 | 비고 |
|--------|------|------|
| Feature Permissions | `createAuditLog` 직접 | previousDoc diff |
| Role Permissions | `makeAuditHelper` | context 전달 |
| Account 승인 | `createActionLog` | action: 'approve' |
| PW Reset 승인 | `createActionLog` | action: 'approve' |
| Config Settings | `createAuditLog` + `calculateChanges` | previousDoc diff |
| Log Settings | `createAuditLog` + `calculateChanges` | previousDoc diff |
| Update Settings | `createAuditLog` + `calculateChanges` | per-profile CRUD (`create`/`update`/`delete`), documentId=`{agentGroup}:{profileId}` |

#### Domain 3: Clients

| 액션 | 방식 | 컨트롤러 |
|------|------|---------|
| Service Control (단건) | `createActionLog` | controller.js handleExecuteAction |
| Service Control (배치) | `createActionLog` | controller.js handleBatchExecuteAction/Stream |
| Config save | `createActionLog` | configController.js |
| Config deploy | `createActionLog` | configController.js |
| Log download | `createActionLog` | logController.js |
| Log delete | `createActionLog` | logController.js |
| SW Update deploy | `createActionLog` | updateController.js |

#### Domain 4: Auth (기존)

`createAuthLog` — login, logout, login_failed, signup, password_reset_request, password_changed, password_reset_verified, permission_denied

#### Domain 5: Access

`useAccessLogger` composable → `POST /api/access-logs` (optionalAuth + body token 폴백)

---

### 사용법 가이드

#### 1. 새 CRUD 서비스 추가 시 (기본)

```javascript
const { createCrudService } = require('../../shared/utils/createCrudService')
const Model = require('./model')

const crud = createCrudService(Model, 'COLLECTION_NAME', {
  documentIdField: 'eqpId',           // audit documentId 필드 (기본: '_id')
  sensitiveFields: ['password'],       // [REDACTED] 처리 (기본: [])
  skipFullDataInAudit: false,          // HTML 등 대용량 문서 시 true
  autoSetters: [...],                  // 필드 자동 설정 규칙
  validators: [...],                   // 관계 검증 규칙
  hooks: { beforeCreate, afterCreate } // 생명주기 훅
})

// 반환: { create(items, context), update(items, context), remove(ids, context), rules }
// context = { user: req.user }  ← controller에서 전달
```

#### 2. Template 계열 서비스 추가 시

```javascript
const Model = require('./model')
const { createTemplateService } = require('../../shared/utils/createTemplateService')

module.exports = createTemplateService(Model, 'COLLECTION_NAME', {
  requiredFields: ['app', 'process', 'model', 'code', 'subcode', 'html'],
  extraValidations: (data) => {
    if (data.title && data.title.length > 200) return { title: 'Too long' }
    return null
  }
})
```

#### 3. 기존 서비스에 audit 추가 시 (makeAuditHelper)

```javascript
const { makeAuditHelper, calculateChanges } = require('../../shared/models/webmanagerLogModel')

const auditLog = makeAuditHelper('COLLECTION_NAME', {
  sensitiveFields: ['password'],  // 선택
  log: createLogger('category')   // 선택 (fallback 로거)
})

// 사용:
auditLog('create', docId, context, { newData: doc })
auditLog('update', docId, context, { changes, previousData, newData })
auditLog('delete', docId, context, { previousData: doc })
```

#### 4. 비-CRUD 액션 로깅 (createActionLog)

```javascript
const { createActionLog } = require('../../shared/models/webmanagerLogModel')

createActionLog({
  action: 'start',                    // 액션 타입
  targetType: 'ars_agent_service',    // 대상 유형
  targetId: eqpId,                    // 대상 식별자
  details: { agentGroup, ... },       // 추가 정보
  userId: req.user?.singleid          // 수행자
}).catch(() => {})                    // fire-and-forget
```

---

### 설계 원칙

1. **fire-and-forget**: audit 실패가 비즈니스 로직을 차단하지 않음 (`.catch()` 필수)
2. **append-only**: audit 로그 update/delete API 없음
3. **민감 필드 자동 마스킹**: `GLOBAL_SENSITIVE_FIELDS` + 서비스별 `sensitiveFields`
4. **TTL 자동 정리**: `expireAt` 인덱스로 카테고리별 보존 기간 후 자동 삭제
5. **userId 해석**: `context.user?.singleid || context.user?.id || 'system'`

### 테스트

- `server/shared/utils/createCrudService.test.js` — 22개 테스트
- 전체: 47개 파일, 659개 테스트 통과
