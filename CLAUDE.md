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
| Dashboard | 전체 시스템 개요 (KPI 카드) |
| Clients | 클라이언트 목록 (계층적 필터링) |
| ClientDetail | 클라이언트 상세 (상태, 리소스, 로그, 제어) |
| EquipmentInfo | 클라이언트 기준정보 관리 (조회/추가/수정/삭제) |

## Menu Structure
```
MainMenu: Dashboard
└── SubMenu: Overview (/)

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
GET    /api/dashboard/summary      # 대시보드 KPI

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
PUT    /api/clients/:id/config/:fileId     # 단일 Config 파일 저장 (FTP)
POST   /api/clients/config/deploy          # 횡전개 실행 (SSE 진행률)
```

## Project Structure
```
WebManager/
├── client/src/
│   ├── features/           # 기능별 모듈 (auth, dashboard, clients, equipment-info, ...)
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
│   │   └── clients/        # 서비스 레이어 구조
│   │       ├── routes.js       # 라우트 정의
│   │       ├── controller.js   # 요청/응답 처리
│   │       ├── service.js      # DB 쿼리, 비즈니스 로직
│   │       ├── controlService.js # RPC 제어 (Avro)
│   │       ├── ftpService.js   # FTP Config 읽기/쓰기/배포
│   │       ├── validation.js   # 유효성 검사
│   │       └── model.js        # Mongoose 모델
│   └── shared/
│       ├── middleware/     # 미들웨어 (errorHandler 등)
│       ├── utils/          # 유틸리티 (pagination, queryBuilder, socksHelper)
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

## Current Status (2026-02-06)
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

## Security Configuration
- **helmet**: 보안 헤더 자동 설정
- **CORS**: `ALLOWED_ORIGINS` 환경변수로 허용 origin 관리
- **bcrypt**: 비밀번호 해싱 (BCRYPT_SALT_ROUNDS=12)
- **에러 핸들러**: 중앙집중식 에러 처리 (`shared/middleware/errorHandler.js`)

## UI Reference
- Dashboard: `/Users/hyunkyungmin/Developer/ARS/WebServer/UI_Refer/OverView/screen.png`
- Client Detail: `/Users/hyunkyungmin/Developer/ARS/WebServer/UI_Refer/SystemControl/screen.png`
