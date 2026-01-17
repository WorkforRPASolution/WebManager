# Development Guide

## 새 페이지/메뉴 추가 가이드

### 메뉴 시스템 구조
- **단일 소스**: `router/index.js`의 `meta.menu`에서 메뉴 구조 자동 생성
- **자동 메뉴 빌드**: `shared/stores/menu.js`가 라우트 정보를 읽어 메뉴 구성

---

## 1. 라우트 추가

`client/src/router/index.js`에 추가:

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

---

## 2. Feature 폴더 생성

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

---

## 3. 백엔드 API 추가 (필요시)

```
server/features/reports/
├── routes.js                # Express 라우트
└── model.js                 # Mongoose 스키마
```

`server/app.js`에 라우트 등록:
```javascript
app.use('/api/reports', require('./features/reports/routes'))
```

---

## 기존 MainMenu에 SubMenu만 추가

같은 `mainMenu` ID 사용 시 자동으로 해당 MainMenu에 SubMenu 추가:

```javascript
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

---

## 아이콘 추가 방법

`client/src/shared/components/AppIcon.vue`의 `iconPaths` 객체에 추가:

```javascript
const iconPaths = {
  // ... 기존 아이콘들
  new_icon: 'M... SVG path data ...'
}
```

---

## 사용 가능한 아이콘 목록

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
