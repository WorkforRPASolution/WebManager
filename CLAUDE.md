# WebManager Project

## Overview
Akka 기반 서버-클라이언트 시스템에서 **클라이언트들을 모니터링하고 관리**하는 웹 애플리케이션

## Tech Stack
- **Frontend**: Vue.js 3 (Composition API) + Vite
- **Backend**: Node.js (Express)
- **Database**: MongoDB
- **Styling**: Tailwind CSS
- **State Management**: Pinia

## UI Requirements
- 라이트/다크 모드 전환 지원
- **상단 헤더**: 로고 + 메가 메뉴(MainMenu) + 알림 + 사용자 메뉴
- **좌측 사이드바**: 선택된 MainMenu의 SubMenu 표시 (접기/펼치기 가능)
- **하단 탭 바**: 열린 페이지들을 탭으로 관리 (다중 페이지 열기)
- 카드 기반 대시보드 레이아웃
- 시스템 리소스 모니터링 UI
- 실시간 로그 스트림 뷰어

## Pages
| Page | Description |
|------|-------------|
| Login | 기본 로그인 (아이디/비밀번호) |
| Dashboard | 전체 시스템 개요 (KPI 카드) |
| Clients | 클라이언트 목록 (계층적 필터링) |
| ClientDetail | 클라이언트 상세 (상태, 리소스, 로그, 제어) |
| Master | 클라이언트 기준정보 관리 (조회/추가/수정/삭제) |

## Menu Structure (Mega Menu + Sidebar)
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

## Client Data Structure (MongoDB Collection)
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

## Clients Page - Hierarchical Filtering
클라이언트 목록 조회 시 계층적 필터링 적용:
1. **Process** 선택 → Process 목록 표시
2. **EqpModel** 선택 → 선택된 Process의 EqpModel 목록 표시
3. **EqpId (Clients)** 표시 → 선택된 EqpModel의 클라이언트 목록 표시

## API Endpoints
```
POST   /api/auth/login             # 로그인
GET    /api/dashboard/summary      # 대시보드 KPI

GET    /api/clients/processes      # Process 목록
GET    /api/clients/models         # EqpModel 목록 (?process=xxx)
GET    /api/clients                # 클라이언트 목록 (?process=xxx&model=xxx)
GET    /api/clients/:id            # 클라이언트 상세
GET    /api/clients/:id/logs       # 클라이언트 로그
POST   /api/clients/:id/restart    # 클라이언트 재시작
POST   /api/clients/:id/stop       # 클라이언트 정지

# Master Data Management
GET    /api/clients/master         # 전체 필드 조회 (?process=xxx&model=xxx&ipSearch=xxx)
POST   /api/clients/master         # 다중 생성 (배치)
PUT    /api/clients/master         # 다중 수정 (배치)
DELETE /api/clients/master         # 다중 삭제 (배치)
```

## Project Structure (Feature-based)
```
WebManager/
├── client/                          # Vue.js Frontend
│   ├── src/
│   │   ├── features/                # 기능별 모듈
│   │   │   ├── auth/                # 인증 기능
│   │   │   │   ├── components/
│   │   │   │   ├── api.js
│   │   │   │   ├── store.js
│   │   │   │   └── LoginView.vue
│   │   │   ├── dashboard/           # 대시보드 기능
│   │   │   │   ├── components/
│   │   │   │   ├── api.js
│   │   │   │   ├── store.js
│   │   │   │   └── DashboardView.vue
│   │   │   ├── clients/             # 클라이언트 관리 기능
│   │   │   │   ├── components/
│   │   │   │   │   ├── ProcessList.vue
│   │   │   │   │   ├── ModelList.vue
│   │   │   │   │   ├── ClientList.vue
│   │   │   │   │   └── ClientDetail.vue
│   │   │   │   ├── api.js
│   │   │   │   ├── store.js
│   │   │   │   └── ClientsView.vue
│   │   │   ├── master/              # 기준정보 관리 기능
│   │   │   │   ├── components/
│   │   │   │   │   ├── MasterDataGrid.vue
│   │   │   │   │   ├── MasterFilterBar.vue
│   │   │   │   │   ├── MasterToolbar.vue
│   │   │   │   │   └── DeleteConfirmModal.vue
│   │   │   │   ├── composables/
│   │   │   │   │   └── useMasterData.js
│   │   │   │   ├── api.js
│   │   │   │   ├── validation.js
│   │   │   │   └── MasterView.vue
│   │   │   ├── alerts/              # 알림 기능
│   │   │   │   └── ...
│   │   │   └── settings/            # 설정 기능
│   │   │       └── ...
│   │   ├── shared/                  # 공통 모듈
│   │   │   ├── components/          # 공통 컴포넌트 (Button, Card, Modal 등)
│   │   │   ├── composables/         # 공통 Composition API (useTheme, useAuth 등)
│   │   │   └── utils/               # 유틸리티 함수
│   │   ├── layouts/                 # 레이아웃
│   │   │   ├── DefaultLayout.vue    # 사이드바 포함 기본 레이아웃
│   │   │   └── AuthLayout.vue       # 로그인 페이지용 레이아웃
│   │   ├── router/                  # Vue Router 설정
│   │   ├── assets/                  # 정적 리소스
│   │   ├── App.vue
│   │   └── main.js
│   └── ...
├── server/                          # Node.js Backend
│   ├── features/                    # 기능별 모듈
│   │   ├── auth/
│   │   │   ├── routes.js
│   │   │   └── service.js
│   │   ├── dashboard/
│   │   │   ├── routes.js
│   │   │   └── service.js
│   │   └── clients/
│   │       ├── routes.js
│   │       └── service.js
│   ├── shared/                      # 공통 모듈
│   │   ├── middleware/              # 인증 등 미들웨어
│   │   ├── db/                      # MongoDB 연결
│   │   └── utils/                   # 유틸리티
│   ├── app.js                       # Express 앱 설정
│   └── index.js                     # 서버 진입점
├── CLAUDE.md
└── package.json
```

## Development Strategy
1. **Phase 1**: Mock 데이터로 UI 개발 (MongoDB 연결 없이) ✅ 완료
2. **Phase 2**: MongoDB 로컬 설치 후 실제 데이터 연결 ✅ 완료
3. **Phase 3**: Akka 서버와 통합 테스트 ⏳ 대기

## MongoDB Configuration
- **Version**: 4.4.30
- **URL**: mongodb://localhost:27017/EARS
- **Database**: EARS
- **Collection**: EQP_INFO (클라이언트 정보)
- **Sample Data**: 71 clients (5 processes, 15 models)

## Current Status (2026-01-16)
- Phase 1 UI 개발 완료
- Phase 2 MongoDB 연결 완료
- 메가 메뉴 + 사이드바 + 탭 바 레이아웃 구현 완료
- 다크/라이트 모드 지원
- MongoDB API 연동 완료 (EARS.EQP_INFO 컬렉션)
- **Master Data Management 페이지 구현 완료** (AG Grid 기반)
  - 조회: Process/Model 필터링 + IP 검색
  - 추가: 행 추가 + Excel 붙여넣기
  - 수정: 인라인 편집 + 유효성 검증
  - 삭제: 다중 선택 + 확인 모달
- **메뉴 시스템 리팩토링 완료** (확장성 개선)
  - 라우트 기반 메뉴 자동 생성 (`router/index.js` → `menu.js`)
  - AppIcon 컴포넌트로 아이콘 시스템 통합
  - 새 페이지 추가 시 `router/index.js`만 수정하면 됨

## 실행 방법
```bash
# Frontend 개발 서버 실행
cd client && npm run dev

# Backend 개발 서버 실행 (별도 터미널)
cd server && npm run dev

# 또는 동시 실행 (루트에서)
npm run dev
```

## UI Reference
- `/Users/hyunkyungmin/Developer/ARS/WebServer/UI_Refer/OverView/screen.png` - Dashboard 참조
- `/Users/hyunkyungmin/Developer/ARS/WebServer/UI_Refer/SystemControl/screen.png` - Client Detail 참조

---

## 새 페이지/메뉴 추가 가이드

### 메뉴 시스템 구조
- **단일 소스**: `router/index.js`의 `meta.menu`에서 메뉴 구조 자동 생성
- **자동 메뉴 빌드**: `shared/stores/menu.js`가 라우트 정보를 읽어 메뉴 구성

### 새 페이지 추가 방법

#### 1. 라우트 추가 (`client/src/router/index.js`)

```javascript
{
  path: '/reports',
  name: 'Reports',
  component: () => import('../features/reports/ReportsView.vue'),
  meta: {
    layout: 'default',
    requiresAuth: true,
    menu: {
      // MainMenu 설정 (새 MainMenu일 경우 필수)
      mainMenu: 'reports',           // MainMenu ID
      mainMenuLabel: 'Reports',      // MainMenu 표시 라벨
      mainMenuIcon: 'chart',         // AppIcon 아이콘명
      mainMenuOrder: 4,              // 정렬 순서

      // SubMenu 설정
      subMenu: 'daily-report',       // SubMenu ID
      subMenuLabel: 'Daily Report',  // SubMenu 표시 라벨
      subMenuIcon: 'document',       // AppIcon 아이콘명
      subMenuOrder: 1,               // SubMenu 정렬 순서

      // 옵션
      hidden: false                  // true면 메뉴에 표시 안함
    }
  }
}
```

#### 2. Feature 폴더 생성

```
client/src/features/reports/
├── ReportsView.vue          # 메인 페이지
├── api.js                   # API 호출
├── composables/             # 상태 관리 로직
│   └── useReports.js
└── components/              # 하위 컴포넌트
    ├── ReportList.vue
    └── ReportDetail.vue
```

#### 3. 백엔드 API 추가 (필요시)

```
server/features/reports/
├── routes.js                # Express 라우트
└── model.js                 # Mongoose 스키마
```

`server/app.js`에 라우트 등록:
```javascript
app.use('/api/reports', require('./features/reports/routes'))
```

### 기존 MainMenu에 SubMenu만 추가

같은 `mainMenu` ID로 새 라우트 추가 시 자동으로 해당 MainMenu에 SubMenu 추가됨:

```javascript
// system MainMenu에 새 SubMenu 추가
{
  path: '/audit-log',
  name: 'AuditLog',
  component: () => import('../features/audit/AuditLogView.vue'),
  meta: {
    layout: 'default',
    requiresAuth: true,
    menu: {
      mainMenu: 'system',            // 기존 MainMenu ID
      subMenu: 'audit-log',
      subMenuLabel: 'Audit Log',
      subMenuIcon: 'clock',
      subMenuOrder: 4
    }
  }
}
```

### 아이콘 추가 방법

`client/src/shared/components/AppIcon.vue`의 `iconPaths` 객체에 추가:

```javascript
const iconPaths = {
  // ... 기존 아이콘들
  new_icon: 'M... SVG path data ...'
}
```

### 사용 가능한 아이콘 목록

| 아이콘명 | 용도 |
|---------|------|
| grid_view | 대시보드/그리드 |
| list | 목록 |
| devices | 장비/클라이언트 |
| notifications | 알림 |
| settings | 설정 |
| storage | 데이터베이스/저장소 |
| tune | 조정/설정 |
| users | 사용자 목록 |
| user | 단일 사용자 |
| shield | 보안 |
| chart | 차트/통계 |
| monitor | 모니터링 |
| activity | 활동/펄스 |
| key | 인증/키 |
| document | 문서 |
| folder | 폴더 |
| clock | 시간/이력 |
| search | 검색 |
| plus | 추가 |
| edit | 편집 |
| trash | 삭제 |
| check | 확인/완료 |
| x | 닫기/취소 |
| info | 정보 |
| warning | 경고 |
| error | 에러 |
