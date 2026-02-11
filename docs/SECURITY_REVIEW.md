# 데이터 안전성 검토 보고서

> 최초 검토일: 2026-01-20
> 최종 업데이트: 2026-02-11
> 목적: 운영 시스템 적용 전 데이터 삭제/변경 버그 검토

---

## 요약

| 구분 | 상태 | 비고 |
|------|------|------|
| API 엔드포인트 | ✅ 안전 | 모든 DELETE에 ID 검증 있음 |
| 스크립트 | ✅ 해결 | seedData.js 삭제됨, 남은 seed 스크립트는 `--reset` 플래그 필수 |
| 입력 검증 | ✅ 안전 | 필수 필드, 형식, 중복 검사 |
| 권한 검증 | ✅ 해결 | authenticate + requireFeaturePermission 미들웨어 적용 |
| 감사 로깅 | 🟡 부분 | clients(EQP_INFO)만 자동 로깅, 나머지 컬렉션 미적용 |
| 배치 트랜잭션 | 🟡 미적용 | 배치 업데이트 중 실패 시 부분 처리 가능 |

---

## ✅ 해결된 항목

### 1. seedData.js 전체 삭제 위험 (해결)

**원래 문제**: `seedData.js`에서 `Client.deleteMany({})`로 전체 데이터 삭제 가능

**해결 방법**: `seedData.js` 파일 자체가 삭제됨

**남은 seed 스크립트 안전성**:
- `seedRolePermissions.js`: `--reset` 플래그 없이는 삭제 실행 안 함, 대상은 권한 설정 데이터만
- `seedPermissions.js`: `--reset` 플래그 없이는 삭제 실행 안 함, 대상은 기능 권한 데이터만

---

### 2. 권한 검증 미들웨어 (해결)

**원래 문제**: DELETE/UPDATE API에 인증 검사 없음

**해결 방법**: `server/shared/middleware/authMiddleware.js`에 4단계 인증/인가 구현

| 미들웨어 | 역할 |
|---------|------|
| `authenticate()` | JWT 토큰 검증 |
| `requireRole(level)` | 역할 레벨 기반 인가 |
| `requireMenuPermission(menu)` | 메뉴 접근 권한 (DB 실시간 조회) |
| `requireFeaturePermission(feature, action)` | 기능별 read/write/delete 권한 |

모든 DELETE 라우트에 `authenticate` + `requireFeaturePermission(..., 'delete')` 적용:

| 엔드포인트 | 인증 | 권한 |
|-----------|------|------|
| DELETE /api/clients/equipment-info | ✅ | requireFeaturePermission('equipmentInfo', 'delete') |
| DELETE /api/users | ✅ | requireFeaturePermission('users', 'delete') |
| DELETE /api/email-info | ✅ | requireFeaturePermission('emailInfo', 'delete') |
| DELETE /api/email-recipients | ✅ | requireFeaturePermission('emailRecipients', 'delete') |
| DELETE /api/os-version | ✅ | requireFeaturePermission('osVersion', 'delete') |

---

## 🟡 개선 권장 사항

### 3. 감사 로깅 (부분 해결)

**구현된 부분**:
- `WEBMANAGER_LOG` 통합 로그 모델 (`server/shared/models/webmanagerLogModel.js`)
- `createAuditLog()`, `calculateChanges()` 함수
- `businessRules.js`에서 afterCreate/afterUpdate/afterDelete 훅 자동 로깅
- 인증 로그: `createAuthLog()` (login, logout, login_failed 등)
- 에러 로그: `createErrorLog()`

**미적용 컬렉션**:

| 컬렉션 | 감사 로깅 | 비고 |
|--------|----------|------|
| EQP_INFO (clients) | ✅ 적용 | businessRules 훅으로 자동 로깅 |
| ARS_USER_INFO (users) | ❌ 미적용 | |
| EMAILINFO (email-info) | ❌ 미적용 | |
| EMAIL_RECIPIENTS | ❌ 미적용 | |
| OS_VERSION_LIST | ❌ 미적용 | |

---

### 4. 배치 작업 트랜잭션 지원 (미적용)

**현재 상태**: 모든 배치 업데이트가 개별 `updateOne()` 루프로 처리됨. 중간 실패 시 부분만 반영.

**영향받는 서비스**: clients, users, email-info, email-recipients, os-version

---

### 5. 배치 업데이트 성능 최적화 (일부 개선)

**현재 상태**: `bulkWrite`는 미사용이나, N+1 쿼리 문제는 Map 프리페치로 회피됨

**현재 구현**: 각 서비스에서 업데이트 전 전체 데이터를 Map으로 프리페치하여 검증 쿼리 최소화. 현재 데이터 규모에서는 충분한 성능.

---

## ✅ 안전하게 구현된 부분

### API 삭제 엔드포인트

모든 DELETE API에서 ID 배열 검증 구현:

| 엔드포인트 | 검증 | 상태 |
|-----------|------|------|
| DELETE /api/clients/equipment-info | ID 배열 필수, 빈 배열 거부 | ✅ |
| DELETE /api/users | ID 배열 필수, 빈 배열 거부 | ✅ |
| DELETE /api/email-info | ID 배열 필수, 빈 배열 거부 | ✅ |
| DELETE /api/email-recipients | ID 배열 필수, 빈 배열 거부 | ✅ |
| DELETE /api/os-version | ID 배열 필수, 빈 배열 거부 | ✅ |

### 입력 검증

- **clients/validation.js**: IP 형식, 날짜 형식, 중복 검사
- **users/validation.js**: 이메일 형식, 역할 화이트리스트
- **email-info, email-recipients, os-version**: 필수 필드, 길이 제한

### 보안 설정

- **helmet**: 보안 헤더 자동 설정
- **CORS**: 화이트리스트 기반 origin 관리
- **bcryptjs**: 비밀번호 해싱 (SALT_ROUNDS=12)
- **JSON 제한**: 10MB (DoS 방지)
- **JWT**: 액세스 토큰 + 리프레시 토큰 이중 인증

---

## 작업 우선순위

| 우선순위 | 작업 | 상태 |
|---------|------|------|
| ~~1 (필수)~~ | ~~seedData.js 환경 확인 추가~~ | ✅ 파일 삭제로 해결 |
| ~~2 (권장)~~ | ~~권한 검증 미들웨어 추가~~ | ✅ 구현 완료 |
| 3 (권장) | 감사 로깅 확대 (users, email-info 등) | 🟡 부분 완료 |
| 4 (선택) | 배치 작업 트랜잭션 | 미적용 |
| 5 (선택) | bulkWrite 최적화 | 미적용 (현재 규모에서 불필요) |

---

## 결론

최초 검토 시 필수 작업 2건(seedData.js 삭제 위험, 권한 미들웨어 부재)은 모두 해결되었다.
감사 로깅은 clients 컬렉션에만 적용되어 있으므로, 나머지 컬렉션으로 확대 적용을 권장한다.
배치 트랜잭션과 bulkWrite 최적화는 현재 데이터 규모에서는 선택 사항이다.
