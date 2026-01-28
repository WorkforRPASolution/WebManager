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
    permission: 'reports',           // ⬅️ 라우트 레벨 권한 (URL 직접 접근 차단)
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

      // 권한 설정
      permission: 'reports',         // ⬅️ 메뉴 필터링용 권한 (권한 없으면 메뉴 숨김)

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
├── controller.js            # 요청/응답 처리
├── service.js               # 비즈니스 로직
├── validation.js            # 유효성 검사
└── model.js                 # Mongoose 스키마
```

`server/app.js`에 라우트 등록:
```javascript
app.use('/api/reports', require('./features/reports/routes'))
```

### WEB_MANAGER DB에 신규 컬렉션 추가 시 (중요!)

WEB_MANAGER DB에 새 컬렉션을 추가할 경우, **서버 시작 시 자동 초기화 로직**을 반드시 추가해야 합니다.

```javascript
// service.js에 추가
const DEFAULT_ITEMS = [
  { name: 'Item 1', active: true },
  { name: 'Item 2', active: true }
]

async function initializeItems() {
  const count = await Model.countDocuments()
  if (count === 0) {
    await Model.insertMany(DEFAULT_ITEMS)
    console.log(`  + Created ${DEFAULT_ITEMS.length} default items`)
    return true
  }
  return false
}

module.exports = { initializeItems, /* ... */ }
```

```javascript
// server/index.js에 추가
const { initializeItems } = require('./features/items/service');
// ...
await initializeItems();
```

> 📌 상세 내용: `docs/SCHEMA.md`의 "자동 초기화 로직" 섹션 참조

---

## 4. 권한 설정 (필수)

새 페이지 추가 시 **반드시** 권한을 설정해야 합니다. 두 곳 모두 설정해야 완전한 권한 제어가 가능합니다.

### 권한 설정 위치

| 위치 | 용도 | 미설정 시 문제 |
|------|------|----------------|
| `meta.permission` | Navigation Guard에서 URL 직접 접근 차단 | URL 직접 입력으로 무단 접근 가능 |
| `meta.menu.permission` | 메뉴 필터링 (권한 없으면 메뉴 숨김) | 권한 없는 사용자에게 메뉴 노출 |

### 예시

```javascript
meta: {
  permission: 'reports',           // 라우트 레벨: URL 접근 제어
  menu: {
    // ...
    permission: 'reports'          // 메뉴 레벨: 메뉴 표시 제어
  }
}
```

### 권한 값 규칙
- 권한 값은 해당 기능의 식별자와 일치 (예: `reports`, `master`, `users`)
- `permissions` 테이블의 `name` 필드 값 사용
- 대소문자 구분됨 (소문자 사용 권장)

> ⚠️ **주의**: 두 위치 중 하나라도 누락되면 보안 취약점이 발생할 수 있습니다.

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
