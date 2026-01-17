# WebManager Project

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
| Master | 클라이언트 기준정보 관리 (조회/추가/수정/삭제) |

## Menu Structure
```
MainMenu: Dashboard
└── SubMenu: Overview (/)

MainMenu: Clients
└── SubMenu: Client List (/clients)
    └── Client Detail (/clients/:id) - 동적 생성

MainMenu: System
├── SubMenu: Master Data (/master)
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

GET    /api/clients/master         # 기준정보 조회
POST   /api/clients/master         # 다중 생성
PUT    /api/clients/master         # 다중 수정
DELETE /api/clients/master         # 다중 삭제
```

## Project Structure
```
WebManager/
├── client/src/
│   ├── features/           # 기능별 모듈 (auth, dashboard, clients, master, ...)
│   ├── shared/             # 공통 컴포넌트, composables, utils
│   ├── layouts/            # DefaultLayout, AuthLayout
│   └── router/             # Vue Router (메뉴 구조 정의)
├── server/
│   ├── features/           # 기능별 라우트 및 서비스
│   └── shared/             # 미들웨어, DB 연결, 유틸리티
└── docs/                   # 스키마, 개발 가이드
```

## MongoDB Configuration
- **URL**: mongodb://localhost:27017/EARS
- **Database**: EARS
- **Main Collection**: EQP_INFO (스키마: `docs/SCHEMA.md`)

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

## Current Status (2026-01-16)
- 메가 메뉴 + 사이드바 + 탭 바 레이아웃 완료
- 다크/라이트 모드 지원
- MongoDB API 연동 완료
- Master Data Management 페이지 완료 (AG Grid)
- 라우트 기반 메뉴 시스템 (`router/index.js`만 수정하면 메뉴 자동 생성)

## UI Reference
- Dashboard: `/Users/hyunkyungmin/Developer/ARS/WebServer/UI_Refer/OverView/screen.png`
- Client Detail: `/Users/hyunkyungmin/Developer/ARS/WebServer/UI_Refer/SystemControl/screen.png`
