# WebManager Project

## 상위 계획 참조

세션 중 "상위 플랜 체크해" 요청 시: `/Users/hyunkyungmin/Developer/ARS/.claude/PLANNING.md` 읽기

## Overview
Akka 기반 서버-클라이언트 시스템에서 **클라이언트들을 모니터링하고 관리**하는 웹 애플리케이션

## Tech Stack
- **Frontend**: Vue.js 3 (Composition API) + Vite
- **Backend**: Node.js (Express)
- **Database**: MongoDB
- **Styling**: Tailwind CSS
- **State Management**: Pinia

## 참조 문서
- MongoDB 스키마: `docs/SCHEMA.md`
- 개발 가이드 (새 페이지 추가, 아이콘 등): `docs/CONTRIBUTING.md`
- Config 관리: `docs/CONFIG_MANAGEMENT.md`
- Config 비교: `docs/CONFIG_COMPARE.md`

## 개발 주의사항
- **신규 메뉴/기능 추가 시**: Role Permission에 해당 기능을 반드시 추가해야 함
  - `server/scripts/seedRolePermissions.js` 또는 관련 권한 설정 업데이트
  - Dashboard에 표시되는 항목도 사용자 권한에 따라 필터링되므로 권한 체크 로직 확인 필요
- **권한 기반 UI 표시**: 사용자 역할(Role)에 따라 메뉴 및 Dashboard 위젯이 다르게 표시됨
- **WEB_MANAGER DB 컬렉션 추가 시**: 서버 시작 시 자동 초기화 로직 필수 추가
  - `service.js`에 `initializeXXX()` 함수 구현
  - `server/index.js`에서 호출 추가
- **서버 코드에서 `console.log/error/warn` 사용 금지** — 반드시 winston 로거 사용
  - `const { createLogger } = require('../../shared/logger')` + `const log = createLogger('category')`
  - 카테고리는 `shared/logger/index.js` 상단 JSDoc 테이블에 등록된 것만 사용, 새 카테고리 추가 시 테이블 업데이트
  - SSE catch 블록에는 반드시 `log.error(...)` 추가 (errorHandler에 도달하지 않으므로)
  - 외부 의존성 실패(FTP, Redis, RPC 등)의 catch에도 `log.warn(...)` 추가
  - 상세: `docs/CONTRIBUTING.md` "백엔드 로깅 패턴" 섹션 참조
  - 상세: `docs/SCHEMA.md`의 "자동 초기화 로직" 섹션 참조
- **Audit Logging 필수 적용**: 모든 데이터 변경(CRUD) 서비스는 반드시 `createCrudService` 팩토리를 사용하거나, 직접 `createAuditLog`/`createActionLog`를 호출해야 합니다
  - CRUD 팩토리: `server/shared/utils/createCrudService.js` — audit 로깅 자동 처리
  - 비-CRUD 액션: `createActionLog()` — start/stop/deploy/save 등의 액션 로깅
  - 민감 필드: `sensitiveFields` 옵션으로 password 등 `[REDACTED]` 처리
  - HTML 등 대용량 문서: `skipFullDataInAudit: true` 옵션으로 전체 데이터 생략
  - 설계 문서: `docs/AUDIT_LOGGING_DESIGN.md`

## UI Requirements
- 라이트/다크 모드 전환 지원
- **상단 헤더**: 로고 + 메가 메뉴(MainMenu) + 알림 + 사용자 메뉴
- **좌측 사이드바**: 선택된 MainMenu의 SubMenu 표시 (접기/펼치기 가능)
- **하단 탭 바**: 열린 페이지들을 탭으로 관리 (다중 페이지 열기)

## Pages
| Page | Description |
|------|-------------|
| Login | EARS 인트로 애니메이션 + 스플릿 로그인 (LandingLayout) |
| Sign Up | 2단 레이아웃 (좌: 계정정보, 우: 업무정보), integrated 모드 EARS 검색 + 자동완성 |
| Dashboard - Overview | 전체 시스템 개요 (KPI 카드) |
| Dashboard - ARSAgent Status | Process별 ARSAgent 가동 현황 (Running/Stopped/NeverStarted 3상태) |
| Dashboard - ARSAgent Version | Process별 ARSAgent 버전 분포 (Grouped 테이블, Running Only 필터) |
| Dashboard - ResourceAgent Status | Process별 ResourceAgent 가동 현황 (OK/WARN/SHUTDOWN/Stopped/NeverStarted 5상태) |
| Dashboard - ResourceAgent Version | Process별 ResourceAgent 버전 분포 (Grouped 테이블, Running Only 필터) |
| Dashboard - Recovery Overview | Recovery 실행 현황 종합 (KPI + 트렌드 + 도넛 + Top10 Treemap + Trigger Donut) |
| Dashboard - Recovery by Process | 공정별 Recovery 성공률 비교 (100% 스택바 + 추이 + 요약 테이블 + 드릴다운) |
| Dashboard - Recovery by Category | 시나리오 카테고리별 Recovery 비교 (KPI + Stacked Bar + 추이 + 드릴다운 테이블 + 카테고리명 관리 모달 + 도넛 차트 + CSV 내보내기) |
| Dashboard - Recovery by Model | 모델별 Recovery 성공률 비교 (Grouped Bar + 추이 + 요약 테이블 + 드릴다운) |
| Dashboard - Recovery Analysis | 드릴다운 분석 3탭 (Scenario/Equipment/Trigger) + 이력 조회 모달 + Process→Scenario→Model 캐스케이드 필터 |
| Dashboard - User Activity | 사용자 활동 현황 3탭 (Tool Usage/Scenario/WebManager), 3탭 모두 구현 완료 |
| Clients | 클라이언트 목록 (계층적 필터링) |
| ClientDetail | 클라이언트 상세 (상태, 리소스, 로그, 제어) |
| EquipmentInfo | 클라이언트 기준정보 관리 (조회/추가/수정/삭제) |
| UserManagement | 사용자 관리 (CRUD/권한/계정상태/비밀번호) |
| Permissions | Role/Feature 권한 매트릭스 관리 (Admin 전용, 풀페이지, 2탭: Menu/Feature) |

## Menu Structure
```
MainMenu: Dashboard
├── SubMenu: Overview (/)
├── SubMenu: ARSAgent Status (/agent-monitor)
├── SubMenu: ARSAgent Version (/agent-version)
├── SubMenu: ResourceAgent Status (/resource-agent-status)
├── SubMenu: ResourceAgent Version (/resource-agent-version)
├── SubMenu: Recovery Overview (/recovery-overview)
├── SubMenu: Recovery by Process (/recovery-by-process)
├── SubMenu: Recovery by Category (/recovery-by-category)
├── SubMenu: Recovery by Model (/recovery-by-model)
├── SubMenu: Recovery Analysis (/recovery-analysis)
└── SubMenu: User Activity (/user-activity)

MainMenu: Clients
└── SubMenu: Client List (/clients)
    └── Client Detail (/clients/:id) - 동적 생성

MainMenu: 기준정보 관리
├── SubMenu: Equipment Info (/equipment-info)
├── SubMenu: Email Template (/email-template)
└── SubMenu: User Management (/users)

MainMenu: System
├── SubMenu: Settings (/settings)
├── SubMenu: Permissions (/permissions) - Admin 전용 (allowedRoles)
└── SubMenu: Alerts History (/alerts)
```

## API Endpoints
```
POST   /api/auth/login             # 로그인
POST   /api/auth/signup            # 회원가입
POST   /api/auth/refresh           # Access Token 갱신
POST   /api/auth/logout            # 로그아웃
GET    /api/auth/me                # 현재 사용자 정보
POST   /api/auth/request-password-reset  # 비밀번호 재설정 요청
POST   /api/auth/change-password   # 비밀번호 변경 (로그인 상태)
POST   /api/auth/set-new-password  # 재설정 승인 후 새 비밀번호 설정
GET    /api/auth/check-id          # User ID 중복확인
GET    /api/auth/search-clients    # 클라이언트 검색 (회원가입 Process 도우미)
GET    /api/auth/signup-options     # 회원가입 옵션 (Process/Line 목록)
GET    /api/auth/operation-mode     # 운영 모드 조회 (standalone/integrated)
POST   /api/auth/ears/search-users         # EARS 사용자 이름 검색 (integrated)
POST   /api/auth/send-verification-code    # 인증 코드 이메일 발송 (integrated)
POST   /api/auth/check-verification-code   # 인증 코드 확인 (소모하지 않음, integrated)
POST   /api/auth/verify-and-reset          # 인증 코드 검증 + 새 비밀번호 설정 (integrated)

GET    /api/dashboard/summary        # 대시보드 KPI (dashboardOverview 권한)
GET    /api/dashboard/agent-status  # ARSAgent 가동 현황 (dashboardArsMonitor 권한, 응답: data+details)
GET    /api/dashboard/agent-version # ARSAgent 버전 분포 (dashboardArsVersion 권한, ?runningOnly=true, 응답: data+details)
GET    /api/dashboard/resource-agent-status  # ResourceAgent 가동 현황 (dashboardResStatus 권한, 5상태: OK/WARN/SHUTDOWN/Stopped/NeverStarted)
GET    /api/dashboard/resource-agent-version # ResourceAgent 버전 분포 (dashboardResVersion 권한, ?runningOnly=true)

GET    /api/recovery/overview               # Recovery 전체 현황 (dashboardRecoveryOverview 권한, ?period=today|7d|30d|90d|1y|custom)
GET    /api/recovery/by-process             # 공정별 비교 (dashboardRecoveryByProcess 권한)
GET    /api/recovery/by-category            # 카테고리별 비교 (dashboardRecoveryByCategory 권한)
GET    /api/recovery/by-model              # 모델별 비교 (dashboardRecoveryByModel 권한)
GET    /api/recovery/analysis               # 드릴다운 분석 (dashboardRecoveryAnalysis 권한, ?tab=scenario|equipment|trigger)
GET    /api/recovery/history                # 원본 이력 조회 (dashboardRecoveryAnalysis 권한, 최대 7일, ?eqpid|ears_code 필수)
GET    /api/recovery/last-aggregation       # 마지막 배치 집계 시각
GET    /api/recovery/analysis/filters       # Analysis 필터 (데이터 기반 Process/Model 목록)
GET    /api/recovery/category-map           # 카테고리명 매핑 목록 (dashboardRecoveryByCategory 권한)
PUT    /api/recovery/category-map           # 카테고리명 벌크 upsert (Admin)
DELETE /api/recovery/category-map           # 카테고리명 삭제 (Admin)
GET    /api/recovery/category-map/sc-categories  # SC_PROPERTY distinct scCategory (dashboardRecoveryByCategory 권한)
GET    /api/recovery/batch-logs             # 배치 실행 이력 (Admin, 페이지네이션)
GET    /api/recovery/batch-logs/heatmap     # 배치 히트맵 (Admin, ?days=30|60|90)

GET    /api/user-activity/tool-usage  # SE 사용 통계 (dashboardUserActivity 권한, ?period&process&startDate&includeAdmin)
GET    /api/user-activity/webmanager-stats  # WebManager 사용 통계 (dashboardUserActivity 권한, ?period&startDate&endDate&includeAdmin&noLimit)

POST   /api/access-logs              # 페이지 접근 로그 배치 수집 (프론트엔드 → 서버)

GET    /api/clients/processes      # Process 목록
GET    /api/clients/models         # EqpModel 목록 (?process=xxx)
GET    /api/clients                # 클라이언트 목록
GET    /api/clients/:id            # 클라이언트 상세

GET    /api/clients/equipment-info         # 기준정보 조회
POST   /api/clients/equipment-info         # 다중 생성
PUT    /api/clients/equipment-info         # 다중 수정
DELETE /api/clients/equipment-info         # 다중 삭제

GET    /api/clients/config/settings        # Config 파일 설정 조회
GET    /api/clients/by-model               # 횡전개 대상 Client 목록
GET    /api/clients/:id/config             # 4개 Config 파일 일괄 읽기 (FTP)
PUT    /api/clients/:id/config/:fileId     # 단일 Config 파일 저장 (FTP, 자동 백업)
POST   /api/clients/config/deploy          # 횡전개 실행 (SSE 진행률, 자동 백업)
POST   /api/clients/config/compare          # N-way Config 비교 (SSE, 2~25개)
GET    /api/clients/:id/config/:fileId/backups              # Config 백업 목록 조회
GET    /api/clients/:id/config/:fileId/backups/:backupName  # Config 백업 내용 조회

GET    /api/clients/log-settings/:agentGroup # 로그 소스 설정 조회
PUT    /api/clients/log-settings/:agentGroup # 로그 소스 설정 저장
GET    /api/clients/:id/log-files            # 로그 파일 목록 (FTP list)
GET    /api/clients/:id/log-content          # 파일 내용 다운로드 (FTP read)
POST   /api/clients/:id/log-files/download   # 로그 파일 다운로드 (FTP stream)
DELETE /api/clients/:id/log-files            # 파일 삭제 (FTP delete)
POST   /api/clients/log-tail-stream          # 실시간 Tailing (SSE)
POST   /api/clients/:id/detect-base-path     # basePath 자동 감지 (RPC)

GET    /api/clients/update-settings/:agentGroup  # 업데이트 설정 조회 (profiles[])
PUT    /api/clients/update-settings/:agentGroup  # 업데이트 설정 저장 (body: { profiles })
POST   /api/clients/update-source/list           # 소스 파일 목록 조회
POST   /api/clients/update/deploy                # 소프트웨어 배포 (body: profileId 필수, SSE 진행률)

GET    /api/users                            # 사용자 목록 (필터/페이지네이션)
POST   /api/users                            # 사용자 다중 생성
PUT    /api/users                            # 사용자 다중 수정
DELETE /api/users                            # 사용자 다중 삭제
GET    /api/users/processes                  # Process 목록 (필터용)
GET    /api/users/lines                      # Line 목록 (필터용)
GET    /api/users/roles                      # Role Permission 조회
PUT    /api/users/roles/:level               # Role Permission 수정
```

## Project Structure
```
WebManager/
├── client/src/
│   ├── features/           # 기능별 모듈 (auth, dashboard, clients, equipment-info, users, permissions, ...)
│   ├── shared/
│   │   ├── components/     # 공용 컴포넌트 (BaseDataGridToolbar 등)
│   │   ├── composables/    # 공용 composables (useToast, useTheme 등)
│   │   ├── utils/          # 유틸리티 (dataGridValidation 등)
│   │   ├── stores/         # Pinia stores
│   │   └── api/            # API 클라이언트
│   ├── layouts/            # DefaultLayout, AuthLayout, LandingLayout
│   └── router/             # Vue Router (메뉴 구조 정의)
├── server/
│   ├── features/
│   │   ├── clients/        # 클라이언트 관리 + 서비스 제어
│   │   │   ├── routes.js       # 라우트 정의
│   │   │   ├── controller.js   # 요청/응답 처리
│   │   │   ├── service.js      # DB 쿼리, 비즈니스 로직
│   │   │   ├── controlService.js # RPC 제어 (Avro) + basePath 감지
│   │   │   ├── ftpService.js   # FTP Config 읽기/쓰기/배포
│   │   │   ├── configBackupService.js # Config 백업 생성/조회/복원 (FTP)
│   │   │   ├── configCompareService.js  # N-way Config 비교 (병렬 FTP)
│   │   │   ├── configCompareController.js # Config 비교 SSE 핸들러
│   │   │   ├── logService.js       # 로그 파일 조회/삭제/Tail
│   │   │   ├── logSettingsService.js # 로그 설정 CRUD + 초기화
│   │   │   ├── updateService.js    # 소프트웨어 배포 엔진 (캐시 + concurrency pool)
│   │   │   ├── updateSettingsService.js # 업데이트 설정 CRUD + 초기화
│   │   │   ├── updateSettingsModel.js  # UPDATE_SETTINGS 스키마
│   │   │   ├── agentInfoSyncService.js # AGENT_INFO 자동 동기화 (EQP_INFO CRUD 연동)
│   │   │   ├── updateSources/  # Source 추상화 (Local/FTP/MinIO + Factory)
│   │   │   ├── strategies/     # 서비스 제어 전략 모듈 (agentGroup:serviceType)
│   │   │   ├── validation.js   # 유효성 검사
│   │   │   └── model.js        # Mongoose 모델
│   │   ├── dashboard/      # 대시보드 (routes → controller → service)
│   │   ├── recovery/       # Recovery Dashboard (배치 집계 + API + Cron)
│   │   │   ├── dateUtils.js            # KST 날짜 경계 계산
│   │   │   ├── cronRunLogModel.js      # CRON_RUN_LOG Mongoose 모델
│   │   │   ├── recoverySummaryService.js # 배치 파이프라인 + Cron 오케스트레이션
│   │   │   ├── routes.js / controller.js / service.js / validation.js
│   │   │   └── *.test.js               # TDD 테스트 (161 tests)
│   │   ├── user-activity/   # User Activity Dashboard (SE 사용 통계)
│   │   ├── users/          # 사용자 관리 + 역할 권한
│   │   ├── access-logs/    # Access 로그 배치 수집 API
│   │   └── exec-commands/  # 실행 명령어 관리
│   └── shared/
│       ├── middleware/     # 미들웨어 (errorHandler 등)
│       ├── utils/          # 유틸리티 (pagination, queryBuilder, socksHelper, createCrudService, createTemplateService, businessRules, mongoLong)
│       ├── avro/           # Avro RPC 클라이언트
│       └── db/             # DB 연결
└── docs/                   # 스키마, 개발 가이드, 코드 리뷰 보고서
```

## MongoDB Configuration

### Dual Database Architecture
| Database | 용도 | 환경변수 |
|----------|------|----------|
| **EARS** | Akka 서버와 공유 데이터 | `MONGODB_URI` |
| **WEB_MANAGER** | WebManager 전용 데이터 | `WEBMANAGER_DB_URI` |

### 컬렉션 분배
| 컬렉션 | Database | 설명 |
|--------|----------|------|
| EQP_INFO | EARS | 장비 정보 (공유) |
| AGENT_INFO | EARS | Agent 활성화 정보 (공유, EQP_INFO CRUD 시 자동 동기화) |
| EMAIL_TEMPLATE_REPOSITORY | EARS | 이메일 템플릿 (공유) |
| EMAILINFO | EARS | 이메일 수신자 (공유) |
| ARS_USER_INFO | EARS | 사용자 정보 (공유) |
| FEATURE_PERMISSIONS | WEB_MANAGER | 기능별 권한 (전용) |
| OS_VERSION_LIST | WEB_MANAGER | OS 버전 목록 (전용) |
| WEBMANAGER_ROLE_PERMISSIONS | WEB_MANAGER | 역할별 메뉴 권한 (전용) |
| CONFIG_SETTINGS | WEB_MANAGER | Config 파일 설정 (전용) |
| LOG_SETTINGS | WEB_MANAGER | 로그 소스 설정 (전용) |
| UPDATE_SETTINGS | WEB_MANAGER | 소프트웨어 업데이트 설정 (전용) |
| CRON_RUN_LOG | WEB_MANAGER | Cron 배치 실행 이력 (전용, TTL 800일, docsMatched 원본건수 기록) |
| WEBMANAGER_LOG | WEB_MANAGER | 시스템 로그 (audit/batch 카테고리, 전용) |
| EQP_AUTO_RECOVERY | EARS | Recovery 실행 원본 (Akka 공유) |
| RECOVERY_SUMMARY_BY_SCENARIO | EARS | Recovery 시나리오별 집계 (WebManager 생성) |
| RECOVERY_SUMMARY_BY_EQUIPMENT | EARS | Recovery 장비별 집계 (WebManager 생성) |
| RECOVERY_SUMMARY_BY_TRIGGER | EARS | Recovery 트리거별 집계 (WebManager 생성) |
| RECOVERY_SUMMARY_BY_CATEGORY | EARS | Recovery 카테고리별 집계 (WebManager 생성, SC_PROPERTY $lookup) |
| SC_PROPERTY | EARS | 시나리오 속성 (Akka 관리, WebManager 읽기 전용) |
| RECOVERY_CATEGORY_MAP | WEB_MANAGER | 시나리오 카테고리 숫자→이름 매핑 (전용) |

- 스키마 상세: `docs/SCHEMA.md`
- Recovery 설계 상세: `docs/RECOVERY_DASHBOARD_DESIGN.md`

## Development Phase
1. Phase 1: Mock 데이터로 UI 개발 ✅
2. Phase 2: MongoDB 연결 ✅
3. Phase 3: Akka 서버 통합 ⏳

## 실행 방법
```bash
# Frontend
cd client && npm run dev

# Backend (별도 터미널)
cd server && npm run dev

# 동시 실행 (루트)
npm run dev

# Recovery Summary 초기화 (Summary + CRON_RUN_LOG + batch 로그 삭제)
cd server && npm run reset:buckets          # 확인 프롬프트
cd server && npm run reset:buckets -- --yes # 확인 생략
cd server && npm run reset:buckets -- --keep-logs  # batch 로그 유지
```

## Current Status (2026-04-13)
- 메가 메뉴 + 사이드바 + 탭 바 레이아웃 완료
- 다크/라이트 모드 지원
- MongoDB API 연동 완료
- Equipment Info Management 페이지 완료 (AG Grid)
- Email Template Management 페이지 완료 (Monaco Editor)
- 라우트 기반 메뉴 시스템 (`router/index.js`만 수정하면 메뉴 자동 생성)
- 공용 컴포넌트 리팩토링 완료 (BaseDataGridToolbar, useToast, dataGridValidation)
- Backend 서비스 레이어 분리 완료 (clients: routes → controller → service)
- 보안 개선 완료 (helmet, CORS, bcrypt)
- DB 분리 완료 (EARS: 공유, WEB_MANAGER: 전용)
- Client Remote Control (Avro RPC) 완료 (서비스 시작/중지/재시작/상태)
- Config Management 완료 (FTP 기반 Config 파일 조회/수정/횡전개)
- Service Control UI 테스트 완료 (상태조회/시작/중지/재시작)
- Config Management UI 테스트 완료 (FTP 조회/수정/저장)
- Log Viewer 완료 (FTP 파일 목록/읽기/삭제/다운로드 + RPC 실시간 Tailing + 멀티클라이언트 + 크로스 검색)
- Log Settings UI 완료 (LogSettingsModal)
- User Management 완료 (CRUD/필터/권한 관리/계정 상태/비밀번호 관리)
- Per-client basePath 완료 (자동 감지 + 수동 설정 + commandLine 절대경로 변환)
- Software Update 완료 (Source 추상화(Local/FTP/MinIO) + FTP 배포 + SSE 진행률 + 다중 프로필(OS별/버전별) 관리 + UpdateSettings 2패널 모달 + Update 모달 프로필 자동 필터링 + exec 태스크(원격 명령) + stopOnFail + eqpId별 순차실행 + 상대경로 해석)
- Config Backup 완료 (저장/횡전개 시 자동 백업 + 백업 목록 조회/복원 UI)
- 회원가입/로그인 UX 개선 (ID 중복확인, Process 검색 도우미, 비밀번호 미설정 안내)
- Redis Sentinel 연결 지원 (기존 단순 모드 호환, `REDIS_URL` 형식 자동 감지)
- basePath 감지 ManagerAgent 기반 전환 (strategy 제거, ensureBasePaths 사전 감지)
- Config Compare 완료 (N-way Matrix View 비교 + SSE 병렬 로딩 + Baseline diff + 접기/펼치기 + 검색)
- Email Notification Phase 1 완료 (임시 비밀번호 이메일 발송, Operation Mode standalone/integrated)
- Email Notification Phase 2 완료 (EARS 이름 검색 + 인증 코드 본인 확인 + 새 비밀번호 직접 설정 위저드)
- ARSAgent Status 완료 (Process별 가동 현황 + 도넛/바 차트 + 3상태 분류(Running/Stopped/NeverStarted) + AgentMetaInfo 활용 + Process/Model 필터 + 정렬 + CSV 내보내기(요약/상세))
- ARSAgent Version 완료 (Process별 버전 분포 + 도넛/바 차트 + Grouped 테이블(접기/펼치기) + Running Only 토글 + 정렬 + CSV 내보내기(요약/상세))
- Dashboard 서브메뉴별 권한 분리 (dashboardOverview + dashboardArsMonitor + dashboardArsVersion + dashboardResStatus + dashboardResVersion + dashboardRecoveryOverview + dashboardRecoveryByProcess + dashboardRecoveryByCategory + dashboardRecoveryByModel + dashboardRecoveryAnalysis + dashboardUserActivity)
- 바 차트 세로 방향 전환 (횡 스크롤 dataZoom, axisPointer 라벨)
- ResourceAgent Status 완료 (5상태: OK/WARN/SHUTDOWN/Stopped/NeverStarted + AgentHealth:resource_agent 키 + 도넛/바/테이블 + CSV 내보내기)
- ResourceAgent Version 완료 (ResourceAgentMetaInfo 키 + 기존 Version 컴포넌트 100% 재사용 + Running Only 토글)
- EARS Landing 완료 (시네마틱 인트로 애니메이션 + 스플릿 로그인 레이아웃 + 스킵/재방문 축약 + 다크·라이트 색상 전환 + 반응형)
- Sign Up 개선 (2단 레이아웃 + integrated 모드 EARS 검색/자동완성 + Admin 알림 메일(EARS 경유 이메일 조회) + Admin 역할 선택 제외 + Process 숫자 허용(A-Z0-9_) + "시나리오 작성권한" 명칭 변경)
- ARS_USER_INFO email 필드 삭제 (이메일은 EARS InterfaceServer 또는 수동 입력으로 확보, DB 저장 안 함)
- Recovery Dashboard 완료 (5페이지: Overview + By Process + By Category + By Model + Analysis)
  - Cron 배치 집계 서비스 (hourly :05, daily settlingHours:10 KST 동적 설정, node-cron, 동시 실행 방지)
  - 4개 Summary 컬렉션 ($merge 기반 멱등 집계, EARS DB — Scenario/Equipment/Trigger/Category)
  - CRON_RUN_LOG 실행 이력 (WEB_MANAGER DB, TTL 800일, docsMatched 원본건수)
  - REST API 6개 + 권한 5개 (dashboardRecoveryOverview/ByProcess/ByCategory/ByModel/Analysis)
  - 조회 기간: 오늘/7일/30일/90일/1년/커스텀(최대 2년)
  - 기간별 트렌드 단위 자동 전환 (hourly → daily → weekly → monthly)
  - Overview: KPI 카드 + 트렌드(Stacked Bar + Total/Scenarios 라인) + 도넛 + Top10(Vertical Bar) + Trigger(Donut)
  - By Process: 100% 스택바 성공률 비교 + 추이 Multi-Line + 요약 테이블 + 드릴다운
  - Analysis: 3탭(Scenario/Equipment/Trigger) + 차트 클릭→트렌드 연동 + 이력 조회 모달(원본 직접 조회, 7일 제한, LIVE 배지)
  - 데이터 신선도 표시 + 2시간 초과 경고
  - 모든 API aggregate에 allowDiskUse:true + Overview 7개 쿼리 Promise.all 병렬 실행
  - API timeout 60초 (장기 조회 대응)
  - 설계 문서: `docs/RECOVERY_DASHBOARD_DESIGN.md`
  - 기간 이동 ◀▶ 버튼 (프리셋 기간 단위로 과거/미래 이동, 시작일/종료일 표시, 미래 불가/2년 제한)
  - By Process: 미실행 공정 표시 토글 (EQP_INFO 등록됐지만 실행 건수 0인 공정, 성공률 ∅ 표시)
  - daily 버킷 계산에 settling 시간 적용 (hourly/daily 시간 기준 통일)
  - Batch 실행 이력 로깅 (WEBMANAGER_LOG category='batch', 6개 batchAction)
  - Batch History 모달 (Admin 전용, GitHub 히트맵 + 필터 + 페이지네이션 테이블)
  - Trigger 분포 Top 5 + 기타 합산
  - 초기화 스크립트: `npm run reset:buckets` (Summary + CRON_RUN_LOG + batch 로그 삭제)
  - CRON_RUN_LOG TTL 800일 (조회 최대 730일 + 70일 버퍼, `expireAfterSeconds: 69120000`)
  - Backfill verify 옵션: CRON_RUN_LOG ↔ SUMMARY 교차 검증, docsMatched로 빈 버킷 구분, orphanedLog 감지
  - Backfill 파이프라인 인식 개선 (신규 파이프라인 미감지 + 선택적 재실행)
  - By Category 개선: 도넛 차트 + CSV 내보내기 + Category 에디터 중복 체크 + Group 필수 검증 강화
  - By Model: 모델별 성공률 비교 (Grouped Bar + 추이 Multi-Line + 요약 테이블 + 드릴다운, BY_SCENARIO 재집계)
  - Analysis 필터 개선: Process → Scenario → Model 캐스케이드 필터, Scenario MultiSelect(다중선택)
  - Recovery FilterBar 개선: 드롭다운 자동 포커스 + 긴 항목 툴팁 + MultiSelect 컴포넌트 전환
- Dashboard 사이드바 메뉴 ResAgent → ResourceAgent 명칭 변경
- Permissions 페이지 완료 (System 메뉴 하위, Admin 전용 allowedRoles 필터링)
  - 2탭: Menu Permissions (6그룹 20항목 매트릭스) + Feature Permissions (2그룹 8항목 R/W/D 매트릭스)
  - 역할별 컬럼 (Admin/Conductor/Manager/User), Admin 열 disabled
  - 그룹 접기/펼치기, All 토글, 변경 감지(amber 강조), Save/Discard
  - menu store allowedRoles 필터링 + router navigation guard 연동
  - 기존 RolePermissionDialog 모달 → 풀페이지로 대체 (각 페이지 Feature Permissions 버튼은 유지)
- User Activity Dashboard Phase 1 완료 (Tool Usage 탭)
  - ARS_USER_INFO 기반 ScenarioEditor 사용 통계 (accessnum + latestExecution)
  - 3탭 구조 (Tool Usage 활성, Scenario/WebManager 준비 중)
  - KPI 3장 (전체 사용자/SE 사용자/사용률) — 기간 선택 시 전체 사용자 외 모든 항목 반응
  - 기간: 전체/최근24시간/7일/30일/1년/시작일지정 (종료=항상 현재, 커스텀 최대 2년)
  - 공정별 사용 현황 (2/3, Stacked Bar, dataZoom MAX 25) + 공정별 Active 분포 (1/3, Donut Top10+기타)
  - Top 10 누적 실행 횟수 (Vertical Bar, 450px) + 최근 실행 사용자 30명 (테이블, 450px 고정+스크롤)
  - 토글: 사용자미등록 공정포함 (프론트 computed, 프로세스 필터 범위 존중) + 관리자 포함 (백엔드 authorityManager 필터)
  - processes/process 필드 자동 정규화 (_procs: processes 배열 우선, 없으면 process 세미콜론 split)
  - 공정 필터 시 $unwind 후 선택 공정만 남기는 이중 $match (다중 공정 사용자의 비선택 공정 제거)
  - 다중 공정 사용자 중복 포함 표시
  - accountStatus 미참조 (Akka 원본 사용자 포함)
  - 권한: dashboardUserActivity (전체 역할 기본 true)
  - 13개 서비스 테스트 (TDD)
  - 초기 기획 대비 주요 변경사항:
    - 기간 필터: 시작~종료 구간 → **종료=항상 현재** (lastExecution 스냅샷 특성에 맞춤)
    - 기간 반응 범위: 기간 활성 KPI 1개만 → **전체 사용자 외 모든 항목** 반응
    - KPI: 4장 (전체/SE/사용률/기간활성) → **3장** (기간활성 제거, SE사용자가 기간 반응)
    - 도넛: Active/Inactive 비율 → **공정별 Active 분포** (Top10+기타 합산, scroll legend)
    - 필드명: lastExecution → **latestExecution** (프로덕션 DB 실제 필드명)
    - accountStatus: active 필터 → **미참조** (Akka 원본 사용자 필드 부재)
    - processes: 배열 직접 사용 → **_procs 정규화** (processes 우선, 없으면 process split)
    - 공정 필터: 사용자 매칭만 → **$unwind 후 이중 $match** (비선택 공정 노출 방지)
    - 토글 2개 추가: 사용자미등록 공정포함 + 관리자 포함 (초기 기획에 없던 기능)
    - "접속" 용어 → **"실행"** (latestExecution은 SE 실행 시각)
- 통합 Audit & Activity Logging 시스템 완료 (설계: `docs/AUDIT_LOGGING_DESIGN.md`)
  - 핵심 팩토리: `createCrudService` (CRUD audit 자동), `createTemplateService` (Template CRUD 공유), `makeAuditHelper` (공유 audit 헬퍼)
  - `createActionLog` 헬퍼: 비-CRUD 액션 로깅 (start/stop/deploy/save/download/delete)
  - WEBMANAGER_LOG 스키마 확장: `access` 카테고리 + `expireAt` TTL (audit 2년, auth/batch 1년, error/access 90일)
  - 기준정보 전체 audit: EQP_INFO, Email/Popup Template, Email Info/Recipients, Email Image, OS Version, User Management
  - Email/Popup Template 서비스 레이어 분리: routes → controller → `createTemplateService` 팩토리 (중복 제거)
  - System 도메인: Feature/Role Permissions + Account/PW 승인 + Config/Log/Update Settings audit
  - Clients 도메인: Service Control(단건+배치) + Config(save/deploy) + Log(delete/download) + SW Update action 로깅
  - Access Logging: `POST /api/access-logs` + `useAccessLogger` composable (Router guard + 30초 배치 + sendBeacon + body token 폴백)
- User Activity Dashboard Phase 3 완료 (WebManager 탭)
  - WEBMANAGER_LOG (category='access') 기반 WebManager 사용 통계
  - KPI 4장 (활성 사용자/총 방문/페이지 도달률/평균 체류 시간) + 뱃지
  - 페이지별 방문 현황 (Grouped Horizontal Bar, 메뉴 그룹별 색상 + avg duration 라벨)
  - 일별 사용 추이 (Line+Bar: DAU + 총 방문, 90d=주별 롤업)
  - Top 10 활성 사용자 (Vertical Bar) + 최근 접속 이력 (Table 30행)
  - 기간: 7d/30d/90d/custom (최대 90일, TTL 제한)
  - Admin 필터: ARS_USER_INFO authorityManager=1 사전 조회 → $nin
  - durationMs 품질 보정: 30분 캡 + 0값 제외
  - 동적 경로 정규화 (/clients/:id, /resource-clients/:id)
  - PAGE_MAP 상수 기반 pageName/menuGroup 매핑 (22개 페이지)
  - CSV 내보내기 3개 (PageSummary, TopUsers, RecentVisits)
  - FilterBar 재사용 (hideProcess + periodOptions + showEndDate props 추가)
  - 21개 서비스 테스트 (TDD)
- EQP_INFO CRUD 시 AGENT_INFO 자동 동기화 (생성: upsert, 수정: eqpId/ipAddr 변경 감지, 삭제: cascade)
- NumberLong 정합성 수정 (EQP_INFO, ARS_USER_INFO, RECOVERY_CATEGORY_MAP, ROLE_PERMISSIONS — Long 타입 필드 저장 시 NumberLong 변환, null 필드 제거)
- mongoLong 유틸리티 (`server/shared/utils/mongoLong.js` — toLong/stripNulls/toLongFields 헬퍼)
- User Management 개선
  - 비밀번호 없이 사용자 생성 (Akka 원본 사용자 호환)
  - Process 필터 데이터 소스를 ARS_USER_INFO로 변경 (EQP_INFO 대신)
  - Line 필터 제거 → SE Auth 필터 추가
  - 라벨 변경: Role Level → Authority, RPA Auth → SE Auth
  - FilterBar 단일 select → MultiSelect 다중 선택 전환
- System Logs FilterBar 단일 select → MultiSelect 다중 선택 전환
- Email Info category 에디터 개선 (Type(opt) → Group(필수), Process 객체→문자열 정규화)
- Software Update Settings Copy & Paste (프로필/태스크 클립보드 복사 + 유니크 이름 생성 + TDD 21 테스트)

## Redis Key 구조 (Agent 상태)

| Key | Type | 용도 |
|-----|------|------|
| `AgentRunning:{process}-{eqpModel}-{eqpId}` | String (TTL) | 가동 상태 (값: uptime 초) |
| `AgentHealth:{agentGroup}:{process}-{eqpModel}-{eqpId}` | String (TTL) | 확장 상태 (`{Status}:{Uptime}:{Reason}`) |
| `AgentMetaInfo:{process}-{eqpModel}` | Hash | 버전 메타 (field: eqpId, 값 존재 여부로 Stopped/NeverStarted 구분) |

## Redis Key 구조 (인증 코드)

| Key | TTL | 용도 |
|-----|-----|------|
| `wm:vcode:<mail>` | 300초 (5분) | 인증 코드 값 |
| `wm:vcode:cooldown:<mail>` | 60초 (1분) | 재발송 쿨다운 |
| `wm:vcode:attempts:<mail>` | 300초 (5분) | 실패 시도 횟수 (5회 초과 시 코드 무효화) |

- 모두 `SET key value EX ttl`로 저장, TTL 만료 시 자동 삭제
- 인증 성공 또는 5회 초과 시 관련 키 즉시 `DEL`
- 구현: `server/shared/services/verificationCodeService.js`

## Security Configuration
- **helmet**: 보안 헤더 자동 설정
- **CORS**: `ALLOWED_ORIGINS` 환경변수로 허용 origin 관리
- **bcrypt**: 비밀번호 해싱 (BCRYPT_SALT_ROUNDS=12)
- **에러 핸들러**: 중앙집중식 에러 처리 (`shared/middleware/errorHandler.js`)

## UI Reference
- Dashboard: `/Users/hyunkyungmin/Developer/ARS/WebServer/UI_Refer/OverView/screen.png`
- Client Detail: `/Users/hyunkyungmin/Developer/ARS/WebServer/UI_Refer/SystemControl/screen.png`
