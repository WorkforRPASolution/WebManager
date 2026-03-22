# User Activity Dashboard - 설계 문서

## 개요

사용자 활동 현황을 3개 탭으로 시각화하는 대시보드.
각 탭은 독립된 데이터 소스와 산출 로직을 가진다.

| 탭 | 데이터 소스 | DB | 목적 |
|----|-----------|----|----|
| Tool Usage | `ARS_USER_INFO` | EARS | ScenarioEditor(SE) 사용 현황 |
| Scenario | `SC_PROPERTY` | EARS | 시나리오 작성/수정 현황 |
| WebManager | `WEBMANAGER_LOG` (category='access') | WEB_MANAGER | WebManager 페이지 접근 현황 |

**권한**: `dashboardUserActivity` (전체 역할 기본 true)

---

## 1. Tool Usage 탭

### 1.1 데이터 소스

**컬렉션**: `ARS_USER_INFO` (EARS DB)

| 필드 | 타입 | 설명 |
|------|------|------|
| `singleid` | String | 사용자 ID |
| `name` | String | 사용자 이름 |
| `accessnum` | Number | SE 누적 실행 횟수 |
| `latestExecution` | String (ISO) | 최근 SE 실행 시각 |
| `processes` | Array | 할당 공정 배열 (WebManager 동기화) |
| `process` | String | 세미콜론 구분 공정 문자열 (Akka 원본) |
| `authorityManager` | Number | 1=관리자 |

### 1.2 KPI 카드 (3장)

| KPI | 산출 방법 | 기간 반응 |
|-----|---------|---------|
| **전체 사용자** | `COUNT(*)` (baseMatch 조건) | No |
| **SE 사용자** | `COUNT(accessnum > 0 AND latestExecution >= periodStart)` | Yes |
| **사용률** | `(SE 사용자 / 전체 사용자) × 100` | Yes |

- `period='all'`(전체)일 때: SE 사용자 = `accessnum > 0`인 사용자 (시간 조건 없음)
- 기간 지정 시: `latestExecution >= periodStart` 조건 추가

### 1.3 공정 필드 정규화

`processes` 배열이 있으면 그대로 사용, 없으면 `process` 문자열을 `;`로 split.
파이프라인 내 `_procs` 필드로 통일:

```
_procs = processes (비어있지 않으면) || process.split(';') || []
```

### 1.4 공정 필터 동작

공정 필터 선택 시 `$unwind _procs` → 선택 공정만 남기는 이중 `$match`.
다중 공정 사용자가 비선택 공정에서 카운트되지 않도록 보장.

### 1.5 관리자 필터

`includeAdmin=false` 시: `baseMatch.authorityManager = { $ne: 1 }`

### 1.6 기간 옵션

| 값 | 라벨 | 비고 |
|----|------|------|
| `all` | 전체 | 종료=항상 현재 |
| `today` | 최근 24시간 | |
| `7d` | 최근 7일 | |
| `30d` | 최근 30일 | |
| `1y` | 최근 1년 | |
| `custom` | 시작일 지정 | 최대 2년, 종료=항상 현재 |

### 1.7 차트 구성

| 차트 | 타입 | 위치 | 데이터 |
|------|------|------|--------|
| 공정별 사용 현황 | Stacked Bar (2/3) | Row 1 좌 | 공정별 totalUsers, activeUsers |
| 공정별 Active 분포 | Donut (1/3) | Row 1 우 | Top 10 + 기타, scroll legend |
| Top 10 누적 실행 | Vertical Bar (1/2) | Row 2 좌 | userId별 accessnum Top 10 |
| 최근 실행 사용자 | Table (1/2) | Row 2 우 | 이름, ID, 공정, 횟수, 마지막 실행 (30행) |

---

## 2. Scenario 탭

### 2.1 데이터 소스

**컬렉션**: `SC_PROPERTY` (EARS DB)

| 필드 | 타입 | 설명 |
|------|------|------|
| `scname` | String | 시나리오 이름 |
| `process` | String | 공정 |
| `eqpModel` | String | 장비 모델 |
| `property.IsEnabled` | Boolean | 시나리오 활성 여부 |
| `property.ID` | String | 시나리오 고유 ID |
| `property.Owners` | Array | `"userId@yyyy-MM-dd HH:mm:ss"` 형식의 수정 이력 |
| `performance.*` | Number | 성과 지표 (ManWorkLoss, EqpPerfornmanceLoss 등) |

### 2.2 수정 이력 파싱

`property.Owners` 배열의 각 항목을 `@`로 split:
- index 0 → `_ownerId` (작성자 ID)
- index 1 → `_ownerTimestamp` (수정 시각, `"yyyy-MM-dd HH:mm:ss"` KST)

### 2.3 KPI 카드 (5장)

| KPI | 산출 방법 | 기간 반응 |
|-----|---------|---------|
| **전체 시나리오** | `COUNT(*)` | No |
| **활성 시나리오** | `COUNT(property.IsEnabled = true)` | No |
| **성과 입력** | `COUNT(performance 필드 중 ≥1개 > 0)` | No |
| **수정된 시나리오** | `COUNT(DISTINCT property.ID WHERE ownerTimestamp >= periodStart)` | Yes |
| **활성 작성자** | `COUNT(DISTINCT ownerId WHERE ownerTimestamp >= periodStart)` | Yes |

성과 입력 판정 조건:
```
ManWorkLoss > 0 OR EqpPerfornmanceLoss > 0 OR EqpStopLoss > 0
OR WaferLoss > 0 OR InvestCostLoss > 0
```
(주의: `EqpPerfornmanceLoss`는 DB 필드명 오타, 의도적 보존)

### 2.4 기간 옵션

Tool Usage와 동일 (`all`~`custom`, 최대 2년).

### 2.5 이름 조회

`ARS_USER_INFO`에서 `singleid → name` 매핑을 파이프라인과 병렬 조회.
`topAuthors`와 `recentModifications`의 `userId`에 대해 `name` 필드 추가.

### 2.6 차트 구성

| 차트 | 타입 | 위치 | 데이터 |
|------|------|------|--------|
| 공정별 시나리오 현황 | Stacked Bar (2/3) | Row 1 좌 | 공정별 total, active, inactive |
| 공정별 성과 입력률 | Bar (1/3) | Row 1 우 | 공정별 performanceRate |
| Top 10 작성자 | Vertical Bar (1/3) | Row 2 좌 | userId별 modificationCount |
| 최근 수정 이력 | Table (2/3) | Row 2 우 | 이름, ID, 시나리오, 공정, 모델, 수정 시간 (30행) |

---

## 3. WebManager 탭

### 3.1 데이터 소스

**주 컬렉션**: `WEBMANAGER_LOG` (WEB_MANAGER DB, `category='access'`)

| 필드 | 타입 | 설명 |
|------|------|------|
| `timestamp` | Date | 로그 기록 시각 |
| `userId` | String | 사용자 ID |
| `pagePath` | String | 방문 페이지 경로 |
| `pageName` | String | 페이지 표시명 |
| `enterTime` | Date | 세션 시작 시각 |
| `leaveTime` | Date | 세션 종료 시각 |
| `durationMs` | Number | 체류 시간 (ms) |

**보조 컬렉션**: `ARS_USER_INFO` (EARS DB) — 관리자 필터 + 이름 조회 + 공정 매핑

**TTL**: 90일 (`ACCESS_RETENTION_DAYS=90`)

### 3.2 기간 옵션

| 값 | 라벨 | Granularity |
|----|------|-------------|
| `today` | 최근 24시간 | hourly |
| `7d` | 최근 7일 | daily |
| `30d` | 최근 30일 | daily |
| `all` | 최근 90일 (기본값) | weekly |
| `custom` | 시작일 지정 | ≤1일=hourly, ≤30일=daily, >30일=weekly |

- `custom` 최대 범위: 90일 (TTL 제한)
- `all`은 전체가 아닌 **최근 90일** (데이터 보존 기간)

### 3.3 관리자 필터

`includeAdmin=false` 시:
1. `ARS_USER_INFO`에서 `authorityManager=1` 사용자 ID 목록 사전 조회
2. `baseMatch.userId = { $nin: adminIds }`

> 알려진 한계: 기간 중간에 Admin 승격된 사용자의 과거 로그도 제외됨.

### 3.4 경로 정규화

동적 라우트를 정적 패턴으로 변환하여 그룹핑:

| 원본 경로 | 정규화 | 설명 |
|----------|--------|------|
| `/clients/EQP001` | `/clients/:id` | ARSAgent 상세 |
| `/resource-clients/RES001` | `/resource-clients/:id` | ResourceAgent 상세 |
| 기타 | 원본 유지 | |

### 3.5 페이지 매핑 (PAGE_MAP)

22개 페이지를 `pageName` + `menuGroup`으로 매핑:

| Group | Pages |
|-------|-------|
| **Dashboard** (9) | Overview, ARSAgent Status/Version, ResourceAgent Status/Version, Recovery Overview/ByProcess/Analysis, User Activity |
| **Clients** (4) | ARSAgent List/Detail, ResourceAgent List/Detail |
| **Master Data** (7) | Equipment Info, Email/Popup Template, Email Image/Recipients/Info, User Management |
| **System** (3) | Permissions, System Logs, Settings |

### 3.6 durationMs 품질 보정

| 규칙 | 이유 |
|------|------|
| `durationMs = 0` → 제외 | 크래시/미완료 세션 |
| `durationMs > 1,800,000` → 1,800,000으로 캡 | 탭 방치 (30분 상한) |

```
avgDurationMs = SUM(MIN(durationMs, 1800000)) / COUNT(durationMs > 0)
```

### 3.7 KPI 카드 (6장)

| KPI | 산출 방법 |
|-----|---------|
| **활성 사용자** | `COUNT(DISTINCT userId)` |
| **총 페이지 방문** | `COUNT(*)` (access log 건수) |
| **페이지 도달률** | `(방문된 고유 페이지 수 / 22) × 100` — hover 시 미방문 페이지 목록 tooltip |
| **평균 체류 시간** | 보정된 평균 (위 3.6 참조), `Xm Ys` 포맷 |
| **피크 동시접속** | sweep-line 알고리즘으로 산출된 전체 기간 최대 동시 세션 수 |
| **평균 동시접속** | `총 세션 시간 합계 / 조회 기간` — "어떤 순간에 평균 몇 명이 접속해 있었나" |

### 3.8 동시접속 산출 — Sweep-line 알고리즘

```
입력: enterTime~leaveTime 쌍의 배열
1. 각 세션을 2개 이벤트로 변환: enter(+1), leave(-1)
2. 이벤트를 시각 순 정렬 (동시각이면 leave 먼저 처리)
3. 순회하며 current += delta, peak = max(current, peak)
4. 각 이벤트를 KST 시간 버킷(1시간)에 할당, 버킷별 피크 기록
5. 시간 버킷 → 일별/주별 피크로 롤업 (granularity에 따라)
```

**피크 동시접속**: 전체 이벤트 순회 중 `current`의 최대값
**평균 동시접속**: `Σ(leaveTime - enterTime) / (periodEnd - periodStart)` — 유효 세션의 총 시간을 조회 기간으로 나눈 값

### 3.9 주별 롤업 (Weekly Rollup)

granularity가 `weekly`일 때 일별 데이터를 주 단위로 집계:

```
주 기준: 월요일 (getUTCDay() 기반, KST 오프셋 적용)
모드:
  - sum: 방문 횟수, 사용자 수 등 → 7일 합산
  - avg: 평균 체류시간 등 → 7일 평균 (0 제외 후 나누기)
```

| 사용처 | 모드 | 이유 |
|-------|------|------|
| pageTrend (페이지별 방문) | sum | 주간 총 방문 |
| groupTrend (그룹별 방문) | sum | 주간 총 방문 |
| processTrend (공정별 사용자) | sum | 주간 총 사용자 |
| durationTrend (페이지별 체류시간) | **avg** | 평균값의 합산은 의미 왜곡 |

### 3.10 공정별 활성 사용자 산출

access log에는 공정 정보가 없으므로 Cross-DB 조인으로 산출:

```
1. ARS_USER_INFO에서 userId → processes 매핑 사전 조회
2. WEBMANAGER_LOG에서 시간 버킷별 고유 userId 집합 조회
3. JS에서 교차 매핑: 각 userId의 공정별로 카운트
4. 다중 공정 사용자는 각 공정에 중복 카운트 (차트에 "다중 공정 중복 포함" 표시)
5. 매핑되지 않는 userId → "미지정" 카테고리
```

### 3.11 차트 구성

| 차트 | 타입 | 위치 | 데이터 |
|------|------|------|--------|
| 페이지별 방문 현황 | Stacked Bar (2/3) | Row 1 좌 | Top 9 페이지 + 기타, 메뉴 그룹별 고정 색상 |
| 페이지별 방문 비율 | Donut (1/3) | Row 1 우 | Top 10 + 기타, scroll legend |
| 공정별 활성 사용자 추이 | Stacked Bar (2/3) | Row 2 좌 | 공정별 활성 사용자 수 (중복 포함) |
| 공정별 활성 사용자 현황 | Donut (1/3) | Row 2 우 | 전체 기간 공정별 고유 사용자 |
| 동시접속 추이 | Line+Area (1/2) | Row 3 좌 | sweep-line 피크, 빨간 그라디언트, peak markLine |
| 페이지별 평균 체류시간 추이 | Multi-line (1/2) | Row 3 우 | Top 6 페이지, Y축=분, scroll legend |
| 시간대별 사용 패턴 | Heatmap (1/2) | Row 4 좌 | hour(0-23) × dayOfWeek(월~일), 168셀 전수 표시 |
| 메뉴 그룹별 방문 추이 | Stacked Area (1/2) | Row 4 우 | Dashboard/Clients/Master Data/System 고정 색상 |
| Top 10 활성 사용자 | Vertical Bar (1/2) | Row 5 좌 | 이름 + userId, 방문 횟수 기준 |
| 최근 접속 이력 | Table (1/2) | Row 5 우 | 이름, ID, 페이지, 체류, 접속 시간 (30행) |

### 3.12 noLimit 최적화

CSV 내보내기(`noLimit=true`) 시 recentVisits 파이프라인만 실행 후 early return.
나머지 10개 파이프라인 + 동시접속 계산 + 공정 매핑 모두 스킵.

### 3.13 CSV 내보내기

| 파일명 | 대상 | 컬럼 |
|-------|------|------|
| WebManager_PageSummary | 페이지별 방문 현황 | Menu Group, Page, Path, Visits, Unique Users, Avg Duration |
| WebManager_ProcessTrend | 공정별 활성 사용자 추이 | Date, 각 공정명 (동적 컬럼) |
| WebManager_TopUsers | Top 10 활성 사용자 | #, Name, User ID, Visits, Total Duration, Last Visit |
| WebManager_RecentVisits | 최근 접속 이력 | #, Name, User ID, Page, Path, Duration, Enter Time |

---

## 4. 공통 사항

### 4.1 API 엔드포인트

| Method | Path | 서비스 | Timeout |
|--------|------|--------|---------|
| GET | `/api/user-activity/tool-usage` | Tool Usage | 10s (기본) |
| GET | `/api/user-activity/scenario-stats` | Scenario | 10s (기본) |
| GET | `/api/user-activity/scenario-details` | Scenario (CSV) | 10s (기본) |
| GET | `/api/user-activity/webmanager-stats` | WebManager | 60s |

### 4.2 이름 표시 정책

3개 탭 모두 `ARS_USER_INFO`의 `name` 필드를 조회하여 사용자 이름을 표시:
- 차트 X축/범례: 이름 (없으면 ID)
- 차트 Tooltip: `이름 (ID)` 형식
- 테이블: 이름 컬럼 + ID 컬럼 분리 (Tool Usage 패턴 통일)
- CSV: Name, User ID 별도 컬럼

### 4.3 기간 기본값

| 탭 | 기본값 | 이유 |
|----|-------|------|
| Tool Usage | `all` (전체) | latestExecution 스냅샷 특성 |
| Scenario | `all` (전체) | 시나리오 상태는 기간 무관 |
| WebManager | `all` (최근 90일) | TTL 90일 = 사실상 전체 |

### 4.4 Aggregate 옵션

WebManager 파이프라인: `{ allowDiskUse: true, maxTimeMS: 55000 }`
Tool Usage / Scenario: `{ allowDiskUse: true }`

### 4.5 병렬 실행

| 탭 | 파이프라인 수 | 실행 방식 |
|----|------------|---------|
| Tool Usage | 4 | Promise.all |
| Scenario | 5 + 이름 조회 | Promise.all |
| WebManager | 2 사전 쿼리 + 9 메인 + 이름 조회 | 단계적 Promise.all |

### 4.6 테스트

| 서비스 | 테스트 파일 | 테스트 수 |
|--------|-----------|---------|
| Tool Usage | `service.test.js` | 13 |
| Scenario | `scenarioService.test.js` | (별도) |
| WebManager | `webManagerService.test.js` | 29 |

모든 테스트는 DI 패턴(`_setDeps`)으로 DB mock을 주입하여 격리 실행.
