# Refactoring Design: 코드 품질 개선 (기능 안전성 보장)

**날짜**: 2026-03-10
**원칙**: 기능 손상 절대 불가 / Phase별 테스트 게이트 필수 통과
**전략**: Bottom-up (유틸 → 서비스 → 프론트 → 구조)

---

## Phase 1: 순수 유틸 추출 + Critical 수정

가장 작고 안전한 변경. 새 함수 추출 또는 한 줄 수정 수준.

| # | 항목 | 변경 내용 | 테스트 |
|---|------|----------|--------|
| 1-1 | `redis.mget` spread 수정 | `agentAliveService.js:118` — `mget(...keys)` → `mget(keys)` | 기존 `agentAliveService.test.js` 23개 통과 |
| 1-2 | `classifyServiceState()` 추출 | 새 파일 `client/src/features/clients/utils/serviceState.js` — 4-state 분류 순수 함수 | 새 테스트 작성 (입력→출력 매핑) |
| 1-3 | `isFtpNotFoundError()` 추출 | 새 파일 `server/shared/utils/ftpErrors.js` | 새 테스트 작성 (err.code 550, 문자열 매칭) |
| 1-4 | `parseCommaSeparated()` 추출 | `server/shared/utils/parseUtils.js` | 새 테스트 작성 |
| 1-5 | `deepMerge` 이동 | `ftpService.js:416` → `server/shared/utils/mergeUtils.js` | 새 테스트 작성 + 기존 config 관련 테스트 통과 |

**게이트**: 서버 기존 207개 테스트 전체 통과 + 신규 유틸 테스트 전체 통과

---

## Phase 2: 서비스 레이어 중복 제거 + 버그 수정

Phase 1 유틸을 활용하여 서비스/컨트롤러 중복 정리.

| # | 항목 | 변경 내용 | 테스트 |
|---|------|----------|--------|
| 2-1 | `getAliveStatusWithVersions()` 추출 | `controller.js` 399~406행, 430~437행 merge 로직 → 헬퍼 1개 | 기존 alive/version 테스트 + 신규 헬퍼 테스트 |
| 2-2 | MongoDB 중복 조회 통합 | `agentAlive` + `agentVersion` 각각 `ClientModel.find()` → 공유 `getClientInfoBatch()` 1회 | 기존 47개 테스트 통과 (alive 23 + version 24) |
| 2-3 | `agentGroup` 검증 추가 | `controller.js:424` `getBatchAliveStatusHandler`에 `badRequest` 체크 | 기존 테스트 + 검증 실패 케이스 추가 |
| 2-4 | `getClientIpInfo()` 통합 | `controlService.js:24` + `ftpService.js:30` → 공유 함수 1개 | 기존 `controlService.test.js` 12개 + `configBackupService.test.js` 25개 통과 |
| 2-5 | FTP `writeConfigFile` 삭제 | `ftpService.js:139~153` 미사용 함수 제거 | 기존 config 테스트 전체 통과 |
| 2-6 | `isFtpNotFoundError()` 적용 | Phase 1 유틸을 4곳에 적용 | 기존 `configBackupService.test.js` 25개 통과 |
| 2-7 | `parseCommaSeparated()` 적용 | Phase 1 유틸을 `controller.js` 3곳에 적용 | 기존 서버 테스트 전체 통과 |
| 2-8 | Redis 상태 체크 개선 | `null` 체크 → `isRedisAvailable()` 사용 | 기존 alive/version 47개 + Redis 비정상 상태 테스트 추가 |

**게이트**: 서버 전체 테스트 통과 + Phase 1~2 신규 테스트 통과

---

## Phase 3: 프론트엔드 정리 + dead code 제거

클라이언트 중복 제거와 불필요 코드 정리.

| # | 항목 | 변경 내용 | 테스트 |
|---|------|----------|--------|
| 3-1 | `classifyServiceState()` 적용 | Phase 1 유틸을 3곳에 적용: `ClientDataGrid.vue`, `ArsAgentStatus.vue`, `ClientsView.vue` | Phase 1 유틸 테스트 + UI 검증 체크리스트 |
| 3-2 | `useToast` 교체 | `ClientsView.vue:143~156` 로컬 toast → 공용 `useToast()` | UI 검증 (toast 표시/자동 사라짐/연속 호출) |
| 3-3 | `useClientData` dead code 삭제 | `controlClients`, `updateClients`, `configClients` + `operating` 제거 | 기존 클라이언트 테스트 통과 |
| 3-4 | `useResizableModal` 추출 | 모달 공통 drag/resize → composable | 새 composable 테스트 (초기 위치, 드래그, 리사이즈 경계값) |
| 3-5 | ConfigManagerModal props 정리 | 25+ 개별 props → `configManager` 단일 prop | UI 검증 (Config 모달 열기/편집/저장/횡전개) |
| 3-6 | 상태 맵 통합 | `serviceStatuses` + `aliveStatuses` → 단일 `clientStatusMap` | 기존 테스트 + UI 검증 (상태 조회/필터/선택) |

**게이트**: 전체 테스트 통과 + UI 검증 체크리스트 전체 PASS

---

## Phase 4: 서버 구조 리팩토링

파일 이동 + import 경로 변경 + 팩토리 추출.

| # | 항목 | 변경 내용 | 테스트 |
|---|------|----------|--------|
| 4-1 | `clients/` 하위 디렉토리 분리 | 5개 도메인으로 분리 | 서버 전체 테스트 통과 (import 경로만 변경) |
| | | `clients/` — `model.js`, `service.js`, `validation.js`, `ftpService.js` | |
| | | `clients/control/` — `controlService.js`, `agentAlive/VersionService.js`, `strategies/` | |
| | | `clients/config/` — `configController.js`, `configSettings*.js`, `configBackup*.js` | |
| | | `clients/logs/` — `logController.js`, `logService.js`, `logSettings*.js`, `logDownload.js` | |
| | | `clients/updates/` — `updateController.js`, `updateService.js`, `updateSettings*.js`, `updateSources/` | |
| 4-2 | barrel export 제거 | `controller.js` spread-merge 제거 | 서버 전체 테스트 통과 |
| 4-3 | Phase-3 mock 함수 정리 | `controlClients`, `updateClientsSoftware`, `configureClients` 삭제/TODO | 서버 전체 테스트 통과 |
| 4-4 | `configController` 레이어 위반 수정 | 직접 `connectFtp()` 3곳 → 서비스 메서드 위임 | 기존 테스트 + 신규 서비스 메서드 테스트 |
| 4-5 | Settings Service 팩토리 | 3개 service 공통 패턴 → `createSettingsService(Model, field, defaults)` | 기존 `updateSettingsService.test.js` 29개 + 팩토리 테스트 + 3서비스 동작 검증 |
| 4-6 | `withFtp()` 헬퍼 적용 | `ftpService.js` 6곳 try/finally → `withFtp(eqpId, fn)` | 기존 config/log 테스트 전체 통과 |

**게이트**: 서버 전체 테스트 + Phase 1~4 신규 테스트 + `npm run dev` 기동 확인

---

## 최종 게이트

서버 + 클라이언트 전체 테스트 일괄 실행 → 100% 통과

## 예상 신규 테스트

| Phase | 예상 테스트 수 | 대상 |
|-------|--------------|------|
| 1 | ~15개 | 유틸 함수 단위 테스트 |
| 2 | ~20개 | 헬퍼, 검증, Redis 상태 |
| 3 | ~10개 | composable 테스트 |
| 4 | ~25개 | 팩토리, 서비스 메서드, withFtp |

## UI 검증 체크리스트 (Phase 3)

- [ ] Client List: 상태 조회 → 4-state 아이콘/색상 정상
- [ ] Client List: "Select by Status" 드롭다운 동작
- [ ] Client List: Toast 알림 표시/자동 사라짐/연속 호출
- [ ] Config Modal: 열기/편집/저장/횡전개
- [ ] 다크/라이트 모드 전환 시 상태 표시 정상
