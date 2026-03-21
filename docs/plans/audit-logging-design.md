# 통합 Audit & Activity Logging 시스템

## 구현 완료 (2026-03-21)

### 핵심 모듈

| 모듈 | 위치 | 설명 |
|------|------|------|
| `createCrudService` | `server/shared/utils/createCrudService.js` | CRUD 서비스 팩토리 (audit 자동) |
| `createActionLog` | `server/shared/models/webmanagerLogModel.js` | 비-CRUD 액션 로깅 헬퍼 |
| `calculateChanges` | `server/shared/models/webmanagerLogModel.js` | 변경 추적 (sensitiveFields 지원) |
| `useAccessLogger` | `client/src/shared/composables/useAccessLogger.js` | 페이지 접근 로그 Vue composable |

### WEBMANAGER_LOG 카테고리

| 카테고리 | 보존 기간 | 환경변수 | 용도 |
|---------|----------|---------|------|
| audit | 2년 | AUDIT_RETENTION_DAYS=730 | 데이터 변경 이력 |
| auth | 1년 | AUTH_RETENTION_DAYS=365 | 인증/권한 관련 |
| error | 90일 | ERROR_RETENTION_DAYS=90 | 서버 에러 |
| batch | 1년 | BATCH_RETENTION_DAYS=365 | Cron/Backfill |
| access | 90일 | ACCESS_RETENTION_DAYS=90 | 페이지 접근 이력 |

### 액션 타입 (action enum)

`create`, `update`, `delete`, `upload`, `save`, `deploy`, `start`, `stop`, `restart`, `kill`, `approve`, `download`, `backup`, `restore`

### 도메인별 적용 현황

| 도메인 | 서비스 | 방식 | 상태 |
|--------|--------|------|------|
| 기준정보 | EQP_INFO | businessRules (기존) | O |
| 기준정보 | Email Template | createCrudService | O (서비스 레이어 분리) |
| 기준정보 | Popup Template | createCrudService | O (서비스 레이어 분리) |
| System | User Management | 직접 createAuditLog | O (sensitiveFields) |
| System | Feature Permissions | 직접 createAuditLog | O |
| System | Role Permissions | 직접 createAuditLog | O |
| System | Account/PW 승인 | createActionLog | O |
| System | Config/Log/Update Settings | 직접 createAuditLog | O |
| Clients | Service Control | createActionLog | O |
| Clients | Config save/deploy | createActionLog | O |
| Clients | Log download/delete | createActionLog | O |
| Clients | SW Update deploy | createActionLog | O |
| Auth | login/logout/signup | createAuthLog (기존) | O |
| Access | 페이지 접근 | useAccessLogger → POST /api/access-logs | O |

### createCrudService 사용법

```javascript
const { createCrudService } = require('../../shared/utils/createCrudService')

const crud = createCrudService(Model, 'COLLECTION_NAME', {
  documentIdField: 'eqpId',           // audit documentId 필드
  sensitiveFields: ['password'],       // [REDACTED] 처리
  skipFullDataInAudit: true,           // HTML 등 대용량 문서
  autoSetters: [...],                  // 필드 자동 설정 규칙
  validators: [...],                   // 관계 검증 규칙
  hooks: { beforeCreate, afterCreate } // 생명주기 훅
})

// 반환: { create(items, context), update(items, context), remove(ids, context), rules }
// context = { user: req.user }  ← controller에서 전달
```

### createActionLog 사용법

```javascript
const { createActionLog } = require('../../shared/models/webmanagerLogModel')

createActionLog({
  action: 'start',              // 액션 타입
  targetType: 'ars_agent_service', // 대상 유형
  targetId: eqpId,              // 대상 식별자
  details: { agentGroup, ... }, // 추가 정보
  userId: req.user?.singleid    // 수행자
}).catch(() => {})              // fire-and-forget
```
