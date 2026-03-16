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
  - 상세: `docs/SCHEMA.md`의 "자동 초기화 로직" 섹션 참조

## UI Requirements
- 라이트/다크 모드 전환 지원
- **상단 헤더**: 로고 + 메가 메뉴(MainMenu) + 알림 + 사용자 메뉴
- **좌측 사이드바**: 선택된 MainMenu의 SubMenu 표시 (접기/펼치기 가능)
- **하단 탭 바**: 열린 페이지들을 탭으로 관리 (다중 페이지 열기)

## Pages
| Page | Description |
|------|-------------|
| Login | 기본 로그인 (아이디/비밀번호) |
| Dashboard - Overview | 전체 시스템 개요 (KPI 카드) |
| Dashboard - ARSAgent Status | Process별 ARSAgent 가동 현황 (Running/Stopped/NeverStarted 3상태) |
| Dashboard - ARSAgent Version | Process별 ARSAgent 버전 분포 (Grouped 테이블, Running Only 필터) |
| Dashboard - ResourceAgent Status | Process별 ResourceAgent 가동 현황 (OK/WARN/SHUTDOWN/Stopped/NeverStarted 5상태) |
| Dashboard - ResourceAgent Version | Process별 ResourceAgent 버전 분포 (Grouped 테이블, Running Only 필터) |
| Clients | 클라이언트 목록 (계층적 필터링) |
| ClientDetail | 클라이언트 상세 (상태, 리소스, 로그, 제어) |
| EquipmentInfo | 클라이언트 기준정보 관리 (조회/추가/수정/삭제) |
| UserManagement | 사용자 관리 (CRUD/권한/계정상태/비밀번호) |

## Menu Structure
```
MainMenu: Dashboard
├── SubMenu: Overview (/)
├── SubMenu: ARSAgent Status (/agent-monitor)
├── SubMenu: ARSAgent Version (/agent-version)
├── SubMenu: ResAgent Status (/resource-agent-status)
└── SubMenu: ResAgent Version (/resource-agent-version)

MainMenu: Clients
└── SubMenu: Client List (/clients)
    └── Client Detail (/clients/:id) - 동적 생성

MainMenu: 기준정보 관리
├── SubMenu: Equipment Info (/equipment-info)
├── SubMenu: Email Template (/email-template)
└── SubMenu: User Management (/users)

MainMenu: System
├── SubMenu: Alerts History (/alerts)
└── SubMenu: Settings (/settings)
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
│   ├── features/           # 기능별 모듈 (auth, dashboard, clients, equipment-info, users, ...)
│   ├── shared/
│   │   ├── components/     # 공용 컴포넌트 (BaseDataGridToolbar 등)
│   │   ├── composables/    # 공용 composables (useToast, useTheme 등)
│   │   ├── utils/          # 유틸리티 (dataGridValidation 등)
│   │   ├── stores/         # Pinia stores
│   │   └── api/            # API 클라이언트
│   ├── layouts/            # DefaultLayout, AuthLayout
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
│   │   │   ├── updateSources/  # Source 추상화 (Local/FTP/MinIO + Factory)
│   │   │   ├── strategies/     # 서비스 제어 전략 모듈 (agentGroup:serviceType)
│   │   │   ├── validation.js   # 유효성 검사
│   │   │   └── model.js        # Mongoose 모델
│   │   ├── dashboard/      # 대시보드 (routes → controller → service)
│   │   ├── users/          # 사용자 관리 + 역할 권한
│   │   └── exec-commands/  # 실행 명령어 관리
│   └── shared/
│       ├── middleware/     # 미들웨어 (errorHandler 등)
│       ├── utils/          # 유틸리티 (pagination, queryBuilder, socksHelper, configCompareUtils)
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
| EMAIL_TEMPLATE_REPOSITORY | EARS | 이메일 템플릿 (공유) |
| EMAILINFO | EARS | 이메일 수신자 (공유) |
| ARS_USER_INFO | EARS | 사용자 정보 (공유) |
| FEATURE_PERMISSIONS | WEB_MANAGER | 기능별 권한 (전용) |
| OS_VERSION_LIST | WEB_MANAGER | OS 버전 목록 (전용) |
| WEBMANAGER_ROLE_PERMISSIONS | WEB_MANAGER | 역할별 메뉴 권한 (전용) |
| CONFIG_SETTINGS | WEB_MANAGER | Config 파일 설정 (전용) |
| LOG_SETTINGS | WEB_MANAGER | 로그 소스 설정 (전용) |
| UPDATE_SETTINGS | WEB_MANAGER | 소프트웨어 업데이트 설정 (전용) |

- 스키마 상세: `docs/SCHEMA.md`

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
```

## Current Status (2026-03-16)
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
- Dashboard 서브메뉴별 권한 분리 (dashboardOverview + dashboardArsMonitor + dashboardArsVersion + dashboardResStatus + dashboardResVersion)
- 바 차트 세로 방향 전환 (횡 스크롤 dataZoom, axisPointer 라벨)
- ResourceAgent Status 완료 (5상태: OK/WARN/SHUTDOWN/Stopped/NeverStarted + AgentHealth:resource_agent 키 + 도넛/바/테이블 + CSV 내보내기)
- ResourceAgent Version 완료 (ResourceAgentMetaInfo 키 + 기존 Version 컴포넌트 100% 재사용 + Running Only 토글)

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
