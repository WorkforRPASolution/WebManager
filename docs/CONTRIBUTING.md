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

### Mongoose 모델 등록 시 주의사항 (Dual DB)

WebManager는 EARS와 WEB_MANAGER 두 개의 DB 연결을 사용합니다.
**`mongoose.model()` (기본 연결)을 사용하면 안 됩니다.** 기본 연결은 열리지 않으므로 10초 타임아웃이 발생합니다.

```javascript
// ❌ 잘못된 사용 (기본 연결 → 타임아웃)
const mongoose = require('mongoose')
const Model = mongoose.model('MyModel', schema)

// ✅ 올바른 사용 (명시적 연결)
const { earsConnection } = require('../../shared/db/connection')
const Model = earsConnection.model('MyModel', schema)

// ✅ WEB_MANAGER DB인 경우
const { webManagerConnection } = require('../../shared/db/connection')
const Model = webManagerConnection.model('MyModel', schema)
```

standalone 스크립트에서도 `connectDB()` / `closeConnections()`를 사용해야 합니다:
```javascript
const { connectDB, closeConnections } = require('../shared/db/connection')
await connectDB()     // 두 연결 모두 오픈
// ... 작업 ...
await closeConnections()
```

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
- 권한 값은 해당 기능의 식별자와 일치 (예: `reports`, `equipmentInfo`, `users`)
- `FEATURE_PERMISSIONS`의 `feature` 필드 enum 값 사용 (상세: `docs/SCHEMA.md`)
- 대소문자 구분됨 (camelCase 사용)

> ⚠️ **주의**: 두 위치 중 하나라도 누락되면 보안 취약점이 발생할 수 있습니다.

### Role Permission 다이얼로그 업데이트

새 permission을 추가하면 Role Permission 관리 UI에도 반영해야 합니다.

**파일**: `client/src/features/users/components/RolePermissionDialog.vue`

1. **`formatPermissionName`**: 새 permission 키의 표시 라벨 추가
```javascript
const formatPermissionName = (key) => {
  const names = {
    // ...기존 항목
    newFeature: 'New Feature',  // ⬅️ 추가
  }
}
```

2. **`permissionGroups`**: 적절한 카테고리에 permission 키 추가
```javascript
const permissionGroups = [
  { label: 'Clients', keys: ['arsAgent', 'resourceAgent'] },
  { label: '기준정보 관리', keys: ['equipmentInfo', 'emailTemplate', 'popupTemplate', 'emailRecipients', 'emailInfo'] },
  { label: 'System', keys: ['dashboard', 'alerts', 'settings', 'users', 'newFeature'] }  // ⬅️ 추가
]
```

> ⚠️ **주의**: `permissionGroups`에 누락되면 Role Permission Settings 다이얼로그에서 해당 권한이 표시되지 않습니다.

---

## 5. 외부 서비스 연동 패턴

Client PC와 통신하는 기능을 추가할 때 참고할 기존 패턴입니다.

### 네트워크 라우팅 (socksHelper.js)

Client PC 접속 시 직접 연결 또는 SOCKS5 프록시 경유 연결을 `server/shared/utils/socksHelper.js`로 통일합니다.

```javascript
const { createConnection } = require('../../shared/utils/socksHelper')

// ipAddrL이 있으면 SOCKS 경유, 없으면 직접 연결
// socksPort가 null이면 .env의 SOCKS_PROXY_PORT 기본값 사용
const socket = await createConnection(ipAddr, ipAddrL, targetPort, socksPort)
```

### 설비별 포트 override (agentPorts)

EQP_INFO의 `agentPorts` 필드로 설비별 포트를 개별 설정할 수 있습니다.
값이 없으면 `.env`의 글로벌 기본값을 사용합니다.

```javascript
// 포트 resolve 패턴 (controlService.js, ftpService.js 참조)
const rpcPort = client.agentPorts?.rpc || MANAGER_AGENT_PORT   // 7180
const ftpPort = client.agentPorts?.ftp || FTP_PORT             // 7181
const socksPort = client.agentPorts?.socks || null             // null → socksHelper fallback
```

| 포트 | .env 변수 | 기본값 | 용도 |
|------|-----------|--------|------|
| RPC | `MANAGER_AGENT_PORT` | 7180 | Avro RPC (서비스 제어) |
| FTP | `FTP_PORT` | 7181 | FTP (Config 파일) |
| SOCKS | `SOCKS_PROXY_PORT` | 30000 | SOCKS5 프록시 (내부망 경유) |

### basePath 경로 해석

Strategy 모듈의 `commandLine`이 상대경로(`./bin/sc`)일 경우, Java 서비스 모드에서 CWD ≠ 설치 경로이므로 실행 실패합니다. `controlService.executeAction()`에서 자동으로 절대경로로 변환합니다.

```javascript
// 변환 패턴 (controlService.js executeAction)
// ./bin/sc → /app/ManagerAgent/bin/sc (basePath 적용)
// basePath 조회 우선순위: client.basePath (DB) → detectBasePath (RPC 자동감지) → fallback (상대경로 유지)
```

basePath는 `POST /api/clients/:id/detect-base-path`로 자동 감지하거나, Equipment Info Grid에서 직접 입력합니다.

### 기존 연동 패턴

| 기능 | 방식 | 서비스 파일 | 상세 문서 |
|------|------|-------------|-----------|
| 서비스 제어 (시작/중지/재시작) | Avro RPC | `controlService.js` | - |
| Config 파일 조회/수정/횡전개 | FTP | `ftpService.js` | `docs/CONFIG_MANAGEMENT.md` |
| 로그 파일 조회/Tail/삭제 | FTP + RPC | `logService.js` | - |
| 소프트웨어 배포 | Source(Local/FTP/MinIO) → FTP | `updateService.js` | - |

### Software Update 소스 추상화

소프트웨어 배포 시 소스(파일 읽기)를 추상화하여 Local/FTP/MinIO 지원:

```javascript
const { createUpdateSource } = require('./updateSources')

// sourceConfig.type에 따라 LocalSource / FtpSource / MinioSource 반환
const source = createUpdateSource(sourceConfig)
const files = await source.listFilesRecursive('config/')
const stream = await source.getFileStream('bin/agent.jar')
await source.close()
```

### Software Update 로컬 캐시 패턴

다중 클라이언트 배포 시 동일 파일을 클라이언트마다 반복 다운로드하는 비효율을 방지:

```javascript
// 1. Source에서 1회만 다운로드 → 임시 디렉토리
const tempDir = await cacheSourceFiles(source, packages)
// 2. LocalSource(tempDir)로 모든 클라이언트에 배포 (concurrent safe)
const cacheSource = new LocalSource(tempDir)
// 3. 배포 완료 후 임시 디렉토리 삭제 (finally 블록)
await fsPromises.rm(tempDir, { recursive: true, force: true })
```

### FTP 배포 시 경로 주의사항 (중요!)

FTP 서버는 basePath(예: `/app/ManagerAgent`)로 **chroot**됩니다.
FTP 경로에 basePath를 포함하면 이중 경로가 발생합니다.

```javascript
// ❌ 잘못된 사용 (이중 경로: /app/ManagerAgent/app/ManagerAgent/bin/...)
const remotePath = path.posix.join(basePath, targetPath)

// ✅ 올바른 사용 (FTP chroot 내에서 targetPath만 사용)
const remotePath = '/' + targetPath
```

### basic-ftp 동시 작업 주의사항

`basic-ftp`의 `Client` 인스턴스는 **동시 작업을 지원하지 않습니다**.
`downloadTo`를 await하지 않고 다음 작업을 시작하면 서버가 crash합니다.

```javascript
// ❌ 잘못된 사용 (공유 client로 fire-and-forget download)
client.downloadTo(stream, path).catch(err => stream.destroy(err))
// 이후 같은 client로 다시 downloadTo 호출 → crash

// ✅ FtpSource 해결: getFileStream()에서 전용 dlClient 생성
const dlClient = new ftp.Client(30000)
await dlClient.access({ host, port, user, password, secure: false })
dlClient.downloadTo(passthrough, fullPath)
  .then(() => dlClient.close())
  .catch(err => { passthrough.destroy(err); dlClient.close() })
```

### FTP Source 경로 처리 주의사항

FTP 경로 결합 시 `path.posix.join()` 사용 필수. 문자열 결합은 trailing slash에서 double-slash 발생:

```javascript
// ❌ 'config/' + '/' + 'main.json' → 'config//main.json'
const relChild = relBase + '/' + entry.name

// ✅ path.posix.join('config/', 'main.json') → 'config/main.json'
const relChild = path.posix.join(relBase, entry.name)
```

### MinIO Source 개발 가이드

MinIO/S3-compatible 오브젝트 스토리지를 Update Source로 사용할 때:

```javascript
// MinioSource는 minio SDK (npm: minio) 사용
// HTTP connection pooling이므로 명시적 close() 불필요 (FTP와 차이)
const Minio = require('minio')
const client = new Minio.Client({
  endPoint: 'localhost', port: 9000,
  useSSL: false, accessKey: 'minioadmin', secretKey: 'minioadmin'
})

// listObjectsV2 recursive=false → 현재 디렉토리만 (common prefix로 하위 디렉토리 표현)
// listObjectsV2 recursive=true → 모든 하위 파일
// getObject → ReadableStream 반환 (FTP와 달리 concurrent 안전)
```

**MinIO 테스트 환경:**
```bash
docker run -d --name minio -p 9000:9000 -p 9001:9001 \
  minio/minio server /data --console-address ":9001"
# 기본 인증: minioadmin/minioadmin, 콘솔: http://localhost:9001
```

### FTP 연동 시 주의사항

- FTP 작업은 느릴 수 있으므로 API 타임아웃을 별도 설정 (프론트엔드 60초)
- SOCKS5 + FTP passive mode 호환성 주의 (상세: `docs/CONFIG_MANAGEMENT.md`)

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

---

## 공용 컴포넌트

### 풀스크린 모달 패턴

`Teleport to body` + 리사이즈 핸들 + S/M/L 프리셋을 사용하는 모달 패턴.

**기존 구현 예시:**
| 모달 | 파일 | 용도 |
|------|------|------|
| HtmlEditorModal | `features/email-template/components/` | HTML 편집 (TinyMCE + Monaco) |
| ConfigManagerModal | `features/clients/components/` | Config 편집 (Monaco + Diff) |

**구현 핵심:**
```javascript
// 사이즈 프리셋
const sizes = {
  small: { width: 700, height: 500 },
  medium: { width: 1000, height: 650 },
  large: { width: 1300, height: 800 }
}

// 커스텀 리사이즈 (드래그)
const customWidth = ref(null)
const customHeight = ref(null)
```

### Monaco Editor

| 컴포넌트 | 경로 | 용도 |
|---------|------|------|
| `MonacoEditor.vue` | `shared/components/` | 일반 코드 편집 (v-model 지원) |
| `MonacoDiffEditor.vue` | `shared/components/` | 원본/수정본 비교 (read-only) |

### SSE (Server-Sent Events) 패턴

진행률이 필요한 배치 작업에 SSE 사용. 기존 구현: Config 횡전개 (`POST /clients/config/deploy`).

**Backend:**
```javascript
res.setHeader('Content-Type', 'text/event-stream')
res.setHeader('Cache-Control', 'no-cache')
res.flushHeaders()

// 진행 중
res.write(`data: ${JSON.stringify({ completed, total, current, status })}\n\n`)

// 완료
res.write(`data: ${JSON.stringify({ done: true, success, failed, results })}\n\n`)
res.end()
```

**Frontend:**
```javascript
const response = await fetch(url, { method: 'POST', headers, body })
const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // SSE 파싱 (data: {...}\n\n)
}
```

---

## DataGrid 개발 주의사항

### 변수 선언 순서 (Temporal Dead Zone)

`useDataGridCellSelection` 등 composable에 콜백/옵션을 전달할 때, **참조하는 변수가 반드시 composable 호출 전에 선언**되어야 합니다.

`<script setup>`에서 `const`로 선언한 변수는 JavaScript의 Temporal Dead Zone(TDZ) 규칙에 의해, 선언 줄 이전에 참조하면 `ReferenceError`가 발생합니다. Vue는 이 에러를 **콘솔 warning으로만 표시**하고 해당 컴포넌트를 **렌더링하지 않으므로**, 화면에 아무것도 나타나지 않아 원인을 찾기 어렵습니다.

```javascript
// ❌ 잘못된 사용 (TDZ 에러: transformArrayValue가 아래에서 선언됨)
const { ... } = useDataGridCellSelection({
  valueTransformer: transformArrayValue,  // ReferenceError!
})

// ... 200줄 뒤 ...
const transformArrayValue = (field, value) => { ... }

// ✅ 올바른 사용 (선언 후 참조)
const transformArrayValue = (field, value) => { ... }

const { ... } = useDataGridCellSelection({
  valueTransformer: transformArrayValue,  // OK
})

// ✅ 인라인 화살표 함수도 안전 (별도 변수 참조 없음)
const { ... } = useDataGridCellSelection({
  valueTransformer: (field, value) => { ... },
})
```

> **증상**: 데이터 fetch 성공 (Total: N rows 표시), 그러나 그리드 영역이 완전히 비어있음
> **원인**: 컴포넌트 setup 함수에서 TDZ 에러 → Vue가 컴포넌트를 렌더링하지 않음
> **디버그**: 브라우저 콘솔에서 `Unhandled error during execution of setup function` 확인

### DataGrid 컴포넌트 구조 권장 순서

```
1. imports
2. ModuleRegistry, theme 설정
3. props, emits
4. ref/reactive 선언 (gridApi, gridContainer 등)
5. useCustomScrollbar
6. 유틸리티 함수 (valueTransformer 등) ← composable에 전달할 함수는 여기서 선언
7. useDataGridCellSelection ← 위의 함수를 참조
8. useColumnWidthExporter
9. onMounted, setupRowDataWatcher, setupSelectionWatcher
10. columnDefs, defaultColDef
11. 이벤트 핸들러
12. watchers
13. defineExpose
```
