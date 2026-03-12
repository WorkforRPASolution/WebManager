# Config Compare (N-way 비교)

여러 클라이언트(최대 25개)의 동일 Config 파일을 Matrix View로 비교하여 차이점을 한눈에 파악하는 기능.

## 개요

| 항목 | 내용 |
|------|------|
| 비교 대상 | 2~25개 클라이언트 |
| Config 소스 | FTP (기존 ftpService.readAllConfigs 재사용) |
| 로딩 방식 | SSE 스트리밍 (병렬 FTP, concurrency=5) |
| 비교 기준 | Baseline 클라이언트 기준 diff |
| 표시 형식 | Matrix View (행=JSON 키, 열=클라이언트) |
| 독립성 | 기존 Config 기능(ConfigManagerModal)과 완전 독립 |

---

## 아키텍처

```
[Clients 목록]
  ↓ 2~25개 선택 → Compare 버튼
[ConfigCompareModal]
  ↓ SSE POST /config/compare
[configCompareController]
  ↓ configCompareService.compareConfigs()
[ftpService.readAllConfigs() × N] (병렬, concurrency=5)
  ↓ SSE progress 이벤트
[useConfigCompare composable]
  ↓ flatten → diff → tree
[CompareMatrixView] (하이라이트 표시)
```

### 레이어 구조

| 레이어 | 모듈 | 역할 |
|--------|------|------|
| Presentation | ConfigCompareModal, CompareToolbar, CompareMatrixView, CompareLoadingOverlay | UI 컴포넌트 |
| State Mgmt | useConfigCompare (composable, Facade 패턴) | SSE 구독, diff 계산, 필터/검색 |
| Business Logic | configCompareUtils.js (순수 함수) | flatten, diff, tree 알고리즘 |
| API | configCompareApi | POST /api/clients/config/compare (SSE) |
| Backend Service | configCompareService.js | 병렬 FTP + SSE 진행률 |
| Infrastructure | ftpService, concurrencyPool, sseHelper | 기존 인프라 읽기 전용 재사용 |

### 디자인 패턴

- **Facade**: `useConfigCompare` — 복잡한 내부 상태를 단순 인터페이스로 캡슐화
- **Adapter**: `configCompareService` — 기존 `ftpService.readAllConfigs()`를 N-way 비교용으로 래핑
- **Composite**: `TreeNode` 구조 — JSON 중첩 키의 접기/펼치기
- **Observer**: SSE 진행률 — 서버 progress 콜백 → 프론트엔드 실시간 갱신

---

## API

```
POST /api/clients/config/compare (SSE)
Body: { eqpIds: string[], agentGroup: string }
Auth: authenticate + requireMenuPermission(['arsAgent','resourceAgent'])
      + requireFeaturePermission('clientControl','read')
```

### SSE 이벤트

```jsonc
// 진행률 (클라이언트별)
data: {"type":"progress","eqpId":"EQP001","status":"loaded","configs":[...]}
data: {"type":"progress","eqpId":"EQP002","status":"error","error":"FTP timeout"}

// 완료
data: {"done":true,"type":"done","total":5,"loaded":4,"failed":1}
```

### 유효성 검증

| 조건 | 에러 |
|------|------|
| `eqpIds` 누락/비배열 | 400 `eqpIds array is required` |
| `agentGroup` 누락 | 400 `agentGroup is required` |
| `eqpIds.length < 2` | 400 `at least 2 items` |
| `eqpIds.length > 25` | 400 `maximum 25 items` |

---

## 핵심 알고리즘 (configCompareUtils.js)

서버와 프론트엔드에 각각 동일한 순수 함수 모듈 존재.

### flattenJson(obj, prefix='')

JSON 객체를 dot-notation 플랫 Map으로 변환.

```
입력: { server: { host: "0.0.0.0", port: 8080 } }
출력: Map {
  "server"      → { type: "object" },
  "server.host" → { value: "0.0.0.0", type: "string" },
  "server.port" → { value: 8080, type: "number" }
}
```

- 객체: 재귀, 부모에 `{type:'object'}` 마커
- 배열: 인덱스 키 (`arr.0`, `arr.1`), 부모에 `{type:'array', length}`
- 원시값: `{value, type}` 리프

### buildKeyTree(flattenedKeySets)

여러 클라이언트의 키 합집합 → 알파벳 정렬 → TreeNode 계층 구조.

```
TreeNode: { key, fullPath, isLeaf, children[], depth }
```

### computeDiff(baselineEqpId, clientFlatMaps, allKeys)

Baseline 기준 N-way diff 계산.

```
출력: Map<path, Map<eqpId, { value, isDifferent, isMissing, type }>>
시간복잡도: O(K × N)  (K=키 수, N=클라이언트 수)
```

### filterDiffOnly(diffResult)

차이가 있는 키만 필터링 + 부모 경로 자동 포함.

---

## UI 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│ Config Compare - 5 clients                      [□] [✕]    │  헤더 (드래그/최대화)
├─────────────────────────────────────────────────────────────┤
│ [app.json] [logback.json] [resource.json]                   │  Config 파일 탭
├─────────────────────────────────────────────────────────────┤
│ Baseline: [EQP001 ▼]  [☐ Diff Only]  🔍[Search...]        │  CompareToolbar
│                                [Expand All] [Collapse All]  │
├──────────────┬──────────┬──────────┬──────────┬─────────────┤
│   Key        │ EQP001★  │ EQP002   │ EQP003   │ EQP004     │  MatrixHeader
├──────────────┼──────────┼──────────┼──────────┼─────────────┤
│ ▼ server     │ {...}    │ {...}    │ {...}    │ {...}       │  비-리프 노드
│   ├─ host    │ 0.0.0.0  │ 0.0.0.0  │ 10.0.1.5 │ 0.0.0.0   │  값 셀
│   ├─ port    │ 8080     │ 8080     │ 8081     │ 8080       │  amber = diff
│   └─ timeout │ 30000    │ 30000    │ 30000    │ 30000      │
│ ▶ logging    │ {...}    │ {...}    │ {...}    │ (missing)  │  red = missing
└──────────────┴──────────┴──────────┴──────────┴─────────────┘

Key열: position: sticky, left: 0 (고정)
Header행: position: sticky, top: 0 (고정)
★ = baseline 표시 (파란색 하이라이트)
amber 배경 = baseline과 다른 값
red 배경 + italic = 해당 클라이언트에 키 없음
```

### 컴포넌트 구성

| 컴포넌트 | 역할 |
|----------|------|
| **ConfigCompareModal** | Teleport 모달 쉘, 드래그/리사이즈/최대화, 파일 탭 |
| **CompareToolbar** | Baseline 드롭다운, Diff Only 토글, 검색(300ms debounce), Expand/Collapse All |
| **CompareMatrixView** | Matrix 테이블 — Key 열(sticky, 들여쓰기, 접기/펼치기) + Value 셀(하이라이트) |
| **CompareLoadingOverlay** | SSE 로딩 진행률 바 + 클라이언트별 상태 칩(pending/loaded/error) |

---

## 파일 구조

### Backend (신규)

```
server/
├── shared/utils/
│   └── configCompareUtils.js          # 순수 함수 (flatten, tree, diff, filter)
│   └── configCompareUtils.test.js     # 23개 단위 테스트
└── features/clients/
    ├── configCompareService.js         # 병렬 FTP + onProgress 콜백
    ├── configCompareService.test.js    # 5개 단위 테스트
    ├── configCompareController.js      # SSE 핸들러 + 유효성 검증
    └── configCompareController.test.js # 6개 단위 테스트
```

### Backend (수정)

```
server/features/clients/
└── routes.js    # +1줄: POST /config/compare 라우트 추가
```

### Frontend (신규)

```
client/src/features/clients/
├── utils/
│   └── configCompareUtils.js           # 순수 함수 (서버와 동일, 프론트엔드 번들용)
├── composables/
│   └── useConfigCompare.js             # 상태 관리 composable (SSE, diff, 필터)
└── components/
    ├── ConfigCompareModal.vue          # 모달 쉘 + 파일 탭
    ├── CompareToolbar.vue              # Baseline/DiffOnly/Search/Expand/Collapse
    ├── CompareMatrixView.vue           # Matrix 테이블
    └── CompareLoadingOverlay.vue       # 로딩 진행률
```

### Frontend (수정)

```
client/src/features/clients/
├── api.js                              # +configCompareApi export
├── components/ClientToolbar.vue        # +Compare 버튼, +compare emit
└── ClientsView.vue                     # +useConfigCompare, +handleCompare, +ConfigCompareModal
```

### 기존 인프라 (수정 없음, 읽기 전용 재사용)

- `ftpService.js` — `readAllConfigs(eqpId, agentGroup)`
- `concurrencyPool.js` — `runConcurrently(items, handler, concurrency)`
- `sseHelper.js` — `setupSSE(res)`
- `fetchSSEStream` — 클라이언트 SSE 파서

---

## 사용자 시나리오

### UC-1: Config 비교

1. Clients 목록에서 2~25개 클라이언트 체크박스 선택
2. 툴바 "Compare" 버튼 클릭
3. ConfigCompareModal 열림 → SSE로 병렬 FTP 로딩 (진행률 실시간 표시)
4. 로딩 완료 → 첫 번째 config 파일 탭 활성화, 첫 번째 클라이언트가 baseline
5. Matrix View에 diff 하이라이트 표시

### UC-2: Baseline 변경

- Baseline 드롭다운에서 다른 클라이언트 선택 → 하이라이트 즉시 재계산

### UC-3: 차이점만 보기

- "Diff Only" 토글 → 모든 값이 동일한 행 숨김

### UC-4: 키 검색

- 검색 입력(debounce 300ms) → flattened key 필터링, 부모 경로 자동 유지

### UC-5: 접기/펼치기

- 중첩 객체/배열 키의 접기/펼치기 + Expand All / Collapse All

### 대안 흐름

| 상황 | 동작 |
|------|------|
| Config Settings 미등록 | 토스트 경고, 모달 미오픈 |
| FTP 실패 클라이언트 | 빨간 에러 배너에 표시, 나머지 정상 비교 |
| 선택 < 2개 | Compare 버튼 비활성화 |
| 선택 > 25개 | 토스트 경고 |

---

## 테스트

### 단위 테스트 (34개)

```bash
cd server && npm test -- configCompareUtils     # 23개 (순수 함수)
cd server && npm test -- configCompareService   # 5개 (병렬 FTP)
cd server && npm test -- configCompareController # 6개 (SSE 핸들러)
```

### E2E 검증

| 항목 | 결과 |
|------|------|
| 모달 열림 + SSE 로딩 진행률 | ✅ |
| 로딩 완료 → Toolbar/Matrix 전환 | ✅ |
| FTP 실패 시 에러 배너 | ✅ |
| FTP 성공 시 파일 탭 + Matrix 헤더 | ✅ |
| Baseline ★ 표시 | ✅ |
| 빈 config → "No data" 상태 | ✅ |

---

## Phase 2 확장점 (미구현)

- **동기화(Sync)**: diff 결과 기반으로 선택한 키를 다른 클라이언트에 적용
- **셀 클릭 팝오버**: 긴 값의 전체 내용 확인
- **CSV/Excel 내보내기**: 비교 결과 다운로드
