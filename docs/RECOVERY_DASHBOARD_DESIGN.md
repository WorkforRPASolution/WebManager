# Recovery Dashboard - MongoDB 설계 문서

## 1. 원본 컬렉션 스키마 (`EQP_AUTO_RECOVERY`)

| Field Name  | Type   | 필수/선택 | Description                                      |
|-------------|--------|-----------|--------------------------------------------------|
| txn_seq     | Long   | 필수 (PK) | document serial number                           |
| line        | String | 필수      | line info                                        |
| process     | String | 필수      | Process Name                                     |
| model       | String | 필수      | Equipment Model                                  |
| eqpid       | String | 필수 (PK) | Equipment ID                                     |
| ears_code   | String | 필수      | scenario name                                    |
| trigger_by  | String | 필수      | 실행 trigger (아래 값 목록 참조)                 |
| status      | String | 필수      | 실행 상태 (아래 상태 전이 참조)                  |
| create_date | String | 필수      | create time. ex) 2026-03-16T00:00:01.228+09:00   |
| retry       | String | 필수      | retry 정보. ex) 0/0/10                           |
| params      | Object | 필수      | 추가 param object                                |

### `status` 상태 전이 (Akka `JobActor.scala` 기준)

```
[Insert]──▶ Wait ──▶ StartPending ──┬──▶ Success         (result=0, 성공)
                                    ├──▶ Stopped         (result=1, Agent 중지 상태)
                                    ├──▶ Failed          (result=2, 실패)
                                    ├──▶ ScriptFailed    (result=3, 스크립트 오류)
                                    ├──▶ VisionDelayed   (result=6, Vision 지연)
                                    ├──▶ Skip            (result=7, 조건 불일치)
                                    ├──▶ Retry           (재시도 → 다시 Wait)
                                    ├──▶ Unknown         (미인식 result)
                                    └──▶ NotStarted      (Agent 명령 전달 실패)
```

> Summary 컬렉션에서는 status 값을 **롤업하지 않고 원본 그대로 저장** (raw string).
> 새 status 값이 추가/변경되어도 파이프라인 수정 없이 자동 반영됨.
> 그룹핑(성공/실패/대기 등)은 **Dashboard 프론트엔드**에서 유연하게 처리.

**참고 — `Stopped` vs `Failed` 차이**:

| | Stopped (result=1) | Failed (result=2) |
|---|---|---|
| 의미 | Agent 중지 상태, 실행 안 됨 | 시나리오 실행 중 실패 |
| Retry 대상 | 아님 | 대상 |
| 후속 시나리오 | `NextScenarioIfFail` 실행 안 함 | 실행함 |
| 이메일 플래그 | `DoNotSendEmailWhenStop` | `DoNotSendEmailWhenFail` |

> Dashboard에서 Stopped를 "실패"에 포함할지 여부는 사용자 판단에 맡김 (프론트엔드 필터/토글로 제공).

**성공률 공식**: `Success / Total` (단순 비율). `Success` 키가 없으면 0으로 간주.

**참고 — `StartPending` ghost 레코드**:
Akka 코드에서 `DBFail` 케이스 (Redis에서 시나리오 바디 로드 실패) 시 `updateRecoveryStatus`를 호출하지 않아
`StartPending` 상태가 영구적으로 남는 레코드가 존재할 수 있음. Pending 카운트 해석 시 참고.

### `trigger_by` 값 목록 (Akka 기준)

| 값 | 출처 | 설명 |
|---|---|---|
| `Log` | 로그 패턴 매칭 | 로그 트리거 |
| `Scheduler` | 크론 스케줄 | 스케줄 트리거 |
| `Status` | 장비 상태 변화 | 상태 트리거 |
| `SE` | 사용자 수동 실행 | 수동 트리거 |
| `Scenario` | 선행 시나리오 성공/실패 후 후속 | 연쇄 트리거 |
| `Unknown` | 트리거 정보 없음 | 기본값 |
| (기타) | 외부 API `triggeredBy` 헤더 | 자유 텍스트 가능 |

> 외부 API에서 자유 텍스트로 `trigger_by`가 전달될 수 있으므로 예상치 못한 값 존재 가능.
> 카디널리티 폭발 방지를 위해 배치 또는 프론트엔드에서 비표준 값을 `"Other"`로 정규화하는 것을 검토.

### `create_date` 포맷 계약

- **형식**: `YYYY-MM-DDTHH:mm:ss.SSS+09:00` (항상 밀리초 3자리, 항상 `+09:00`)
- **타입**: String (원본 변경 불가)
- **정렬**: ISO 8601 + 고정 오프셋이라 lexicographic sort가 시간순과 일치
- **주의**: 다른 오프셋(`+00:00`, `Z`) 또는 다른 밀리초 자릿수가 섞이면 문자열 비교 깨짐
- Cron 배치 구현 시 포맷 검증 로직 권장 (샘플링 기반)

---

## 2. 현황 및 전제조건

- 현재 doc 수: **약 1,500만 건**
- 쓰기 부하: 1대 eqpid 기준 최대 ~1,000건/일, 전체 ~12~58 inserts/sec
- 현재 인덱스: `txn_seq + eqpid` (복합 PK 인덱스만 존재)
- Dashboard 목적: **실시간 현황 모니터링 + 통계/집계 차트 + 원본 이력 조회**
- `create_date`는 **String 타입** (원본 변경 불가)
- Summary 컬렉션의 `bucket`은 **ISODate로 변환**하여 저장
- Summary 컬렉션은 **EARS DB**에 배치 (`$merge` 네이티브 사용)
  - `$merge`는 소스와 동일 DB 내 컬렉션만 대상 가능 → EARS DB 배치 필수
  - EARS DB는 Akka 서버가 소유 — WebManager가 생성하는 컬렉션임을 명확히 하기 위해 이름 앞에 `RECOVERY_` 접두사 유지
  - DBA/운영 시 EARS DB 백업/복원 시 Summary 컬렉션도 포함됨을 인지 필요
- **MongoDB**: bitnami 4.2.6-debian-10-r23, **Replica Set 구성** (PRIMARY + SECONDARY + ARBITER)
  - `$merge`는 Replica Set 또는 Sharded Cluster 전용 (Standalone에서는 동작하지 않음)
  - 현재 환경은 Replica Set이므로 `$merge` 사용 가능 확인됨

---

## 3. 원본 컬렉션 인덱스 (`EQP_AUTO_RECOVERY`)

> 인덱스 설계 원칙: **ESR 규칙** (Equality → Sort → Range)

**현황**: `txn_seq + eqpid` 복합 PK 인덱스만 존재. Dashboard 쿼리에 사실상 무용.

### 추가 인덱스 (확정)

| # | 인덱스 | 용도 | 크기 추정 |
|---|--------|------|-----------|
| 1 | `{ create_date: 1 }` | Cron 배치 `$match` 시간 범위 | ~500MB |
| 2 | `{ eqpid: 1, create_date: 1 }` | 장비 이력 조회 API (단일 eqpid, 최대 7일) | ~650MB |
| 3 | `{ ears_code: 1, create_date: 1 }` | 시나리오 이력 조회 API (단일 ears_code, 최대 7일) | ~650MB |

**합계**: 추가 스토리지 ~1.8GB, 쓰기 성능 ~30% 저하 (초당 ~58건 → ~40건, 영향 무시 가능)

**ESR 분석**:
- 인덱스 2: `eqpid`(E, 단일 값) → `create_date`(R, 7일 범위) — 결과 ~1,000건 이내, `ears_code` 필터는 인메모리 처리
- 인덱스 3: `ears_code`(E, 단일 값) → `create_date`(R, 7일 범위) — 결과 ~1,400건 이내, `eqpid` 필터는 인메모리 처리
- 3필드 복합 인덱스(`eqpid, ears_code, create_date`)는 불필요 — 2필드 인덱스로 충분히 소량으로 축소되어 인메모리 필터 부담 없음

**빌드 방법**:
- **별도 스크립트로 분리** — 서버 시작 시 실행하면 수 분간 블로킹
- 운영 시간 외 1회 수동 실행 (인덱스당 5~15분, 총 15~45분)
- MongoDB 4.2는 hybrid 빌드 (시작/종료 시에만 brief exclusive lock, 중간은 I/O 부하만)
- `earsConnection`이 `autoIndex: false`이므로 Mongoose 자동 생성 안 됨 → **수동 생성 필수**

**원본 조회 제약**:
- 단일 eqpid 또는 단일 ears_code만 허용 (다중 선택 불가)
- 기간 최대 **7일** (API 레벨에서 강제)
- 이 제약으로 인덱스 2, 3의 스캔 범위가 항상 소량으로 유지됨

---

## 4. Summary 컬렉션 설계

1,500만 건 원본에 매번 aggregation 하지 않도록 **별도 summary 컬렉션**을 운영.
Dashboard API는 통계/집계 시 summary 컬렉션만 읽고, 개별 이력 조회 시에만 원본을 직접 조회.

### 컬렉션 분리의 근거 (전문가 합의)

- 통합 시 카디널리티 곱: line(5) × process(10) × model(50) × ears_code(200) × trigger_by(5) × bucket(720/월) = **최악 1.8억 행** → 비현실적
- 분리 시 (30일 hourly 기준, 활성 조합 수 기반 추정):
  - scenario: 활성 (line, process, model, ears_code) 튜플 ~10,000 × 720 bucket = **~720만** (sparse 시 훨씬 적음)
  - equipment: 활성 eqpid ~5,000 × 720 = **~360만**
  - trigger: trigger_by 종류 ~5 × (line, process, model) ~2,500 × 720 = **~900만** (최악), 실제 sparse하므로 ~수만
- 각 컬렉션이 독립 쿼리 패턴을 가지므로 인덱스 최적화도 용이

### 집계 단위 (period / bucket)

| period  | bucket 형식                                | 예시                                       |
|---------|--------------------------------------------|--------------------------------------------|
| hourly  | ISODate(`YYYY-MM-DDTHH:00:00.000+09:00`)  | `ISODate("2026-03-16T09:00:00.000+09:00")` |
| daily   | ISODate(`YYYY-MM-DDT00:00:00.000+09:00`)  | `ISODate("2026-03-16T00:00:00.000+09:00")` |

> MongoDB는 ISODate를 내부적으로 UTC 밀리초로 저장.
> `+09:00` 오프셋은 입력 시 파싱되어 UTC로 변환 (예: `09:00+09:00` → `00:00Z`).
> Dashboard API에서 읽을 때 KST 변환은 클라이언트 측에서 처리.

### status_counts 구조

모든 Summary 컬렉션에서 공통. **원본 status 값을 키로 그대로 저장** (raw string):

```javascript
// 실제 존재하는 status 값만 키로 생성됨 (없는 값은 키 자체가 없음)
status_counts: {
  "Success":       120,
  "Failed":          8,
  "Stopped":         2,
  "ScriptFailed":    3,
  "VisionDelayed":   1,
  "NotStarted":      3,
  "Skip":            5
}
```

> - `total`은 `status_counts` 내 모든 값의 합과 반드시 일치해야 함
> - 새 status 값이 추가되면 자동으로 새 키가 생성됨 (파이프라인 수정 불필요)
> - **성공률** = `Success / Total` (단순 비율). `Success` 키가 없으면 0으로 간주

---

### 4-1. `RECOVERY_SUMMARY_BY_SCENARIO`
> ears_code별 실행 건수 + 상태별 breakdown

```javascript
{
  _id:        ObjectId(),
  period:     "hourly" | "daily",
  bucket:     ISODate("2026-03-16T09:00:00.000+09:00"),
  line:       "L01",
  process:    "PROCESS_A",
  model:      "MODEL_X",
  ears_code:  "SCENARIO_001",
  total:      142,
  status_counts: {
    "Success": 120, "Failed": 8, "Stopped": 2, "ScriptFailed": 3,
    "VisionDelayed": 1, "NotStarted": 3, "Skip": 5
  },
  updated_at: ISODate("...")
}
```

**인덱스**
```javascript
// $merge용 (필수 — 없으면 $merge 에러)
{ period: 1, bucket: 1, line: 1, process: 1, model: 1, ears_code: 1 }  // unique: true

// 쿼리용 — Dashboard API 설계 확정 후 결정 (TODO)
```

---

### 4-2. `RECOVERY_SUMMARY_BY_EQUIPMENT`
> eqpid별 실행 건수 + 상태별 breakdown

```javascript
{
  _id:        ObjectId(),
  period:     "hourly" | "daily",
  bucket:     ISODate("2026-03-16T09:00:00.000+09:00"),
  line:       "L01",
  process:    "PROCESS_A",
  model:      "MODEL_X",
  eqpid:      "EQP-001",
  total:      37,
  status_counts: {
    "Success": 30, "Failed": 5, "NotStarted": 1, "Skip": 1
  },
  updated_at: ISODate("...")
}
```

**인덱스**
```javascript
// $merge용 (필수)
{ period: 1, bucket: 1, line: 1, process: 1, model: 1, eqpid: 1 }  // unique: true

// 쿼리용 — TODO
```

---

### 4-3. `RECOVERY_SUMMARY_BY_TRIGGER`
> trigger_by별 실행 건수 + 상태별 breakdown

```javascript
{
  _id:        ObjectId(),
  period:     "hourly" | "daily",
  bucket:     ISODate("2026-03-16T09:00:00.000+09:00"),
  line:       "L01",
  process:    "PROCESS_A",
  model:      "MODEL_X",
  trigger_by: "SE",
  total:      89,
  status_counts: {
    "Success": 80, "Failed": 5, "NotStarted": 2, "Skip": 1, "Retry": 1
  },
  updated_at: ISODate("...")
}
```

**인덱스**
```javascript
// $merge용 (필수)
{ period: 1, bucket: 1, line: 1, process: 1, model: 1, trigger_by: 1 }  // unique: true

// 쿼리용 — TODO
```

> **unique 인덱스는 `$merge` 동작의 전제 조건** — 없으면
> `PlanExecutor error: $merge requires a unique index` 에러로 실패.
> `earsConnection`이 `autoIndex: false`이므로 반드시 수동 생성 필요 (Section 8 참조).

---

## 5. Dashboard 구성

### 메뉴 구조

```
MainMenu: Dashboard
├── ...기존 메뉴...
├── SubMenu: Recovery Overview     (/recovery-overview)      ← 전체 현황
├── SubMenu: Recovery by Process   (/recovery-by-process)    ← 공정 비교 (관리자/임원)
└── SubMenu: Recovery Analysis     (/recovery-analysis)      ← 드릴다운 분석 + 이력 조회
```

### 데이터 소스 구분

| 뷰 | 데이터 소스 | 비고 |
|---|---|---|
| 통계/집계 차트 | Summary 컬렉션 (배치 집계) | Overview, By Process, Analysis 차트/테이블 |
| 개별 이력 조회 | `EQP_AUTO_RECOVERY` 원본 (직접 조회) | Analysis 드릴다운 상세 패널 |

### 공통 UX 요소

**데이터 신선도 표시** (모든 페이지 공통):
- 필터 바 우측에 `"마지막 집계: 14:05 (55분 전)"` 표시 + 수동 새로고침 버튼
- 마지막 집계가 2시간 이상 전이면 노란색 경고 배너: `"집계 데이터가 지연되고 있습니다"`
- "오늘" 선택 시 마지막 완료된 시간대까지만 표시 (미집계 현재 시간대 제외)
- 데이터 기준 시각은 API 응답의 `CRON_RUN_LOG` 최신 성공 기록에서 산출

**성공률 공식**: `Success / Total` (단순 비율). `Success` 키가 없으면 0으로 간주.

---

### 5-1. Recovery Overview (`/recovery-overview`)
> "오늘 Recovery 전체 상황은?" — 매일 수시 확인하는 첫 화면

```
┌──────────────────────────────────────────────────────────────────┐
│  필터 바: [Period: 오늘/7일/30일/커스텀] [Process ▼] [Line ▼]     │
│                                     마지막 집계: 14:05 (55분 전) 🔄│
├──────────┬──────────┬──────────┬──────────┬──────────┬───────────┤
│  Total   │ Success  │ Failed   │ Stopped  │  Skip    │ 성공률    │
│  1,247   │  1,050   │   120    │   30     │   42     │ 84.2%    │
│          │  +5.2%▲  │  -2.1%▼  │          │          │ +3.1%p▲  │
│  KPI 카드 (전일/전주 대비 증감)                                    │
├──────────────────────────────────┬───────────────────────────────┤
│  시간별 트렌드 (Stacked Bar)      │  상태 분포 (Donut)             │
│                                  │                               │
│   ██ Success                     │     ╱Success╲                 │
│   ██ ██ Failed                   │    │  84.2%  │                │
│   ██ ██ ██ Stopped               │     ╲_______╱                 │
│   ────────────────               │                               │
│   09  10  11  12  13  14         │                               │
├──────────────────────────────────┼───────────────────────────────┤
│  Top 10 실패 시나리오             │  Top 10 실패 장비              │
│  (Horizontal Bar)                │  (Horizontal Bar)             │
│                                  │                               │
│  SCENARIO_023 ████████ 45        │  EQP-1042 ██████████ 23      │
│  SCENARIO_107 ██████ 32          │  EQP-0887 ████████ 18        │
│  ...                             │  ...                          │
├──────────────────────────────────┴───────────────────────────────┤
│  Trigger 분포 (Horizontal Bar)                                    │
│                                                                   │
│  Log ████████████████ 523 (42%)                                   │
│  Scheduler █████████ 312 (25%)                                    │
│  SE ██████ 198 (16%)                                              │
│  Status █████ 156 (12%)                                           │
│  Scenario ██ 58 (5%)                                              │
└───────────────────────────────────────────────────────────────────┘
```

| 영역 | 데이터 소스 | 비고 |
|------|------------|------|
| KPI 카드 | BY_SCENARIO | `period: "daily"` 합산 |
| 시간별 트렌드 | BY_SCENARIO | `period: "hourly"` 시간대별 |
| 상태 분포 도넛 | BY_SCENARIO | daily 합산 |
| Top 10 실패 시나리오 | BY_SCENARIO | daily, 실패 합산 내림차순 |
| Top 10 실패 장비 | BY_EQUIPMENT | daily, 동일 |
| Trigger 분포 | BY_TRIGGER | daily, total 기준 |

---

### 5-2. Recovery by Process (`/recovery-by-process`)
> "어느 공정이 문제인가?" — 관리자/임원용 공정 간 비교

```
┌──────────────────────────────────────────────────────────────────┐
│  필터 바: [Period: 오늘/7일/30일/커스텀] [Line ▼]                 │
│  (Process 필터 없음 — 전 공정 비교가 목적)  마지막 집계: 14:05 🔄  │
├──────────────────────────────────────────────────────────────────┤
│  공정별 성공률 비교 (Grouped Bar Chart)                            │
│                                                                   │
│  100%│ ██                                                         │
│   80%│ ██ ██          ██                                          │
│   60%│ ██ ██    ██    ██ ██                                       │
│      └──────────────────────────                                  │
│      ETCH  PHOTO  DIFF  CVD   CMP                                 │
│      ■ 성공률  ■ 실패율  ■ Stopped율                                │
├─────────────────────────────────┬────────────────────────────────┤
│  공정별 실행 건수 비교            │  공정별 성공률 추이              │
│  (Stacked Bar)                  │  (Multi-Line Chart)            │
│                                 │                                │
│  ███ Success                    │  100%──────── ETCH             │
│  ███ ██ Failed                  │   90%──────── PHOTO            │
│  ███ ██ ██ Stopped              │   80%──────── DIFF             │
│  ───────────────                │   ─────────────────            │
│  ETCH PHOTO DIFF CVD            │   3/10  3/12  3/14  3/16      │
├─────────────────────────────────┴────────────────────────────────┤
│  공정별 요약 테이블 (AG Grid)                                      │
│                                                                   │
│  Process | Total | Success | Failed | Stopped | Skip | 성공률   │
│  ────────┼───────┼─────────┼────────┼─────────┼──────┼────────  │
│  ETCH    | 2,340 |   2,100 |     85 |      30 |  120 │  89.7%  │
│  PHOTO   | 1,890 |   1,580 |    150 |      45 |  110 │  83.6%  │
│  ...     |       |         |        |         |      │         │
│  ────────┼───────┼─────────┼────────┼─────────┼──────┼────────  │
│  합계    | 7,310 |   6,230 |    470 |     170 |  418 │  85.2%  │
│                                                                   │
│                                              [CSV 내보내기]       │
├───────────────────────────────────────────────────────────────────┤
│  ▶ PHOTO 공정 상세  (테이블 행 클릭 시 펼침)                       │
│  ┌─────────────────────────────┬─────────────────────────────┐   │
│  │  Top 5 실패 시나리오         │  Top 5 실패 장비             │   │
│  │  SC_107  ████████ 45         │  EQP-0887  ██████ 23        │   │
│  │  SC_023  ██████ 32           │  EQP-1201  █████ 18         │   │
│  │  ...                         │  ...                        │   │
│  │              [Recovery Analysis 페이지로 이동 →]            │   │
│  └─────────────────────────────┴─────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

| 영역 | 데이터 소스 | 비고 |
|------|------------|------|
| 공정별 성공률 비교 | BY_SCENARIO | 서버 API에서 process별 재집계 |
| 공정별 실행 건수 | BY_SCENARIO | 서버 API에서 process별 status 합산 |
| 공정별 성공률 추이 | BY_SCENARIO | hourly/daily, process별 라인 |
| 요약 테이블 | BY_SCENARIO | process별 집계 |
| 드릴다운 Top5 시나리오 | BY_SCENARIO | 선택 process 필터 |
| 드릴다운 Top5 장비 | BY_EQUIPMENT | 선택 process 필터 |

**Process별 재집계 방식**: **서버 API에서 MongoDB aggregation으로 처리**.
BY_SCENARIO에는 시간대당 ~10,000개 문서가 있으므로 클라이언트로 전송하여 JS로 합산하는 것은 비효율적.
서버에서 `$objectToArray` → `$unwind` → `$group` → `$arrayToObject` 파이프라인으로 process별 재집계하면
결과가 10~50개 문서로 줄어듦.

**Process 수가 많을 때 (50개+)**: 차트에는 **Top 10 Process** (실패 건수 기준)만 표시하고
나머지는 테이블에서 확인. 성공률 추이 Multi-Line도 Top 5만 라인 표시, 나머지는 회색 배경 처리.

**드릴다운 → Analysis 이동**: 반드시 선택 process를 query parameter로 전달.
`/recovery-analysis?process=PHOTO&period=7d` — Analysis 페이지에서 필터 자동 적용.

---

### 5-3. Recovery Analysis (`/recovery-analysis`)
> "왜 실패하는가?" — 엔지니어용 드릴다운 분석 + 원본 이력 조회

```
┌──────────────────────────────────────────────────────────────────┐
│  필터 바: [Period ▼] [Process ▼] [Line ▼] [Model ▼]              │
│  탭:  [ Scenario | Equipment | Trigger ]     마지막 집계: 14:05 🔄│
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ══════════════════ Scenario 탭 ══════════════════                │
│                                                                   │
│  ┌──────────────────────────────┬───────────────────────────┐    │
│  │ 시나리오별 상태 분포           │ 선택 시나리오 시간 트렌드   │    │
│  │ (Stacked Horizontal Bar)     │ (Line Chart)              │    │
│  │                              │                           │    │
│  │ SC_023 ███████░░░ 82%        │ ── Success                │    │
│  │ SC_107 █████░░░░░ 56%        │ ── Failed                 │    │
│  │ SC_005 ████████░░ 78%        │ ── Stopped                │    │
│  │ (클릭 시 우측 트렌드 연동)     │ ────────────────          │    │
│  │                              │ 09 10 11 12 13 14         │    │
│  └──────────────────────────────┴───────────────────────────┘    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ 상세 테이블 (AG Grid)                    [이력 조회] 버튼  │    │
│  │                                                          │    │
│  │ ears_code    | Process | Model | Total | Success | ...   │    │
│  │ SCENARIO_023 | PROC_A  | MDL_X | 450   | 370     | ...   │    │
│  │ SCENARIO_023 | PROC_B  | MDL_Y | 120   | 98      | ...   │    │
│  │                              [CSV 내보내기] [접기/펼치기]  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ══════════════════ Equipment 탭 ══════════════════               │
│  (동일 레이아웃, grouping key: eqpid, [이력 조회] 버튼 포함)      │
│                                                                   │
│  ══════════════════ Trigger 탭 ═══════════════════                │
│  (동일 레이아웃, grouping key: trigger_by)                        │
└───────────────────────────────────────────────────────────────────┘
```

| 탭 | 데이터 소스 (집계) | 이력 조회 |
|---|---|---|
| Scenario | BY_SCENARIO | 지원 (원본 조회) |
| Equipment | BY_EQUIPMENT | 지원 (원본 조회) |
| Trigger | BY_TRIGGER | 해당 없음 |

---

### 5-4. 이력 조회 상세 패널 (Analysis 페이지 내 드릴다운)
> 특정 장비 또는 시나리오의 **개별 Recovery 레코드**를 원본에서 직접 조회

Analysis 페이지의 테이블에서 특정 행을 선택하고 `[이력 조회]` 버튼 클릭 시,
사이드 패널(또는 모달)이 열려 `EQP_AUTO_RECOVERY` 원본 레코드를 표시.

```
┌─ 이력 조회 패널 ─────────────────────────────────────────────┐
│                                                               │
│  ── 장비 이력 (Equipment 탭에서 진입) ──                       │
│  대상: EQP-0887                                               │
│  필터: [Period: 최근 7일 이내 ▼] [Scenario ▼] [Status ▼]     │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ 이력 테이블 (AG Grid, 페이지네이션)                     │   │
│  │                                                       │   │
│  │ create_date          | ears_code | status  | trigger  │   │
│  │ 2026-03-16T14:23:01  | SC_023    | Failed  | Log      │   │
│  │ 2026-03-16T14:15:45  | SC_023    | Retry   | Log      │   │
│  │ 2026-03-16T13:58:12  | SC_107    | Success | Status   │   │
│  │ 2026-03-16T12:30:05  | SC_023    | Success | SE       │   │
│  │ ...                                                   │   │
│  │                                      [CSV 내보내기]    │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
│  ── 시나리오 이력 (Scenario 탭에서 진입) ──                    │
│  대상: SCENARIO_023                                           │
│  필터: [Period: 최근 7일 이내 ▼] [Equipment ▼] [Status ▼]    │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ 이력 테이블 (AG Grid, 페이지네이션)                     │   │
│  │                                                       │   │
│  │ create_date          | eqpid    | status  | trigger   │   │
│  │ 2026-03-16T14:23:01  | EQP-0887 | Failed  | Log       │   │
│  │ 2026-03-16T14:01:33  | EQP-1042 | Success | Scheduler │   │
│  │ 2026-03-16T13:45:20  | EQP-0887 | Retry   | Log       │   │
│  │ ...                                                   │   │
│  │                                      [CSV 내보내기]    │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

| 진입 경로 | 필수 파라미터 | 선택 필터 | 인덱스 |
|---|---|---|---|
| Equipment 탭 → [이력 조회] | `eqpid` (단일) | `ears_code`, `status`, 기간(최대 7일) | `{ eqpid: 1, create_date: 1 }` |
| Scenario 탭 → [이력 조회] | `ears_code` (단일) | `eqpid`, `status`, 기간(최대 7일) | `{ ears_code: 1, create_date: 1 }` |

**API 쿼리 패턴**:

```javascript
// 장비 이력 조회
db.EQP_AUTO_RECOVERY.find({
  eqpid: "EQP-0887",                              // 필수 (단일)
  ears_code: "SCENARIO_023",                       // 선택
  status: { $in: ["Failed", "ScriptFailed"] },     // 선택
  create_date: { $gte: "7일전", $lt: "현재" }       // 최대 7일 (API 강제)
}).sort({ create_date: -1 })
  .skip(offset).limit(pageSize)

// 시나리오 이력 조회
db.EQP_AUTO_RECOVERY.find({
  ears_code: "SCENARIO_023",                       // 필수 (단일)
  eqpid: "EQP-0887",                              // 선택
  status: { $in: ["Failed"] },                     // 선택
  create_date: { $gte: "7일전", $lt: "현재" }       // 최대 7일 (API 강제)
}).sort({ create_date: -1 })
  .skip(offset).limit(pageSize)
```

> **원본 조회는 실시간 데이터** — Summary 배치와 달리 즉시 최신 데이터 반영.
> 이력 패널에는 "마지막 집계" 배너 대신 실시간 데이터임을 표시.

---

### 페이지 역할 비교

| | Overview | By Process | Analysis | 이력 조회 패널 |
|---|---|---|---|---|
| **질문** | "전체 상황은?" | "어느 공정이 문제?" | "왜 실패하는가?" | "언제 어떻게 실패했나?" |
| **대상** | 전체 | 관리자, 임원 | 엔지니어 | 엔지니어 |
| **데이터** | Summary | Summary | Summary | **원본 (직접 조회)** |
| **기간** | 자유 | 자유 | 자유 | **최대 7일** |
| **흐름** | 첫 확인 → | 공정 식별 → | 드릴다운 → | 개별 레코드 확인 |

---

## 6. Cron 배치 전략

### 실행 주기

| period  | 배치 주기         | 집계 대상 범위                    |
|---------|-------------------|-----------------------------------|
| hourly  | 매 시 :05분       | 직전 완성된 1시간                 |
| daily   | 매일 00:10        | 전날 00:00:00 ~ 23:59:59 (KST)   |

> `:05`, `00:10`처럼 약간의 딜레이를 두는 이유:
> 자정/정각 경계에 insert된 doc의 누락을 방지하기 위한 버퍼.

### Daily 집계 방식

Daily는 **원본(`EQP_AUTO_RECOVERY`)에서 직접 재집계** (hourly 롤업 아닌 독립 실행):
- hourly 데이터 누락/지연에 의존하지 않아 데이터 정합성 보장
- 하루치 데이터 범위가 hourly 대비 24배이지만 `{ create_date: 1 }` 인덱스 + `allowDiskUse`로 처리 가능
- `period: "daily"` + 해당 날짜 자정 bucket으로 저장

### 6-1. Pipeline: `RECOVERY_SUMMARY_BY_SCENARIO` (hourly)

> Node.js 구현 기준 문법. `$arrayToObject`로 raw status를 동적 키 오브젝트로 변환.
> 반드시 `.toArray()` 호출 필요 — 없으면 커서가 소비되지 않아 파이프라인이 실행되지 않음.

```javascript
const bucketStart = new Date("2026-03-16T09:00:00.000+09:00");

await db.collection("EQP_AUTO_RECOVERY").aggregate([
  // 1. 시간 범위 필터 (String 비교) + null status 방어
  {
    $match: {
      create_date: {
        $gte: "2026-03-16T09:00:00.000+09:00",
        $lt:  "2026-03-16T10:00:00.000+09:00"
      },
      status: { $ne: null, $exists: true }  // null status → $arrayToObject 에러 방지
    }
  },
  // 2. 차원 + status별 카운트 (status를 grouping key에 포함)
  {
    $group: {
      _id: {
        line:      "$line",
        process:   "$process",
        model:     "$model",
        ears_code: "$ears_code",
        status:    "$status"
      },
      count: { $sum: 1 }
    }
  },
  // 3. status를 {k, v} 쌍으로 모으고 차원별로 재집계
  {
    $group: {
      _id: {
        line:      "$_id.line",
        process:   "$_id.process",
        model:     "$_id.model",
        ears_code: "$_id.ears_code"
      },
      total:        { $sum: "$count" },
      status_pairs: { $push: { k: "$_id.status", v: "$count" } }
    }
  },
  // 4. 최종 문서 형태로 변환
  {
    $addFields: {
      period:        "hourly",
      bucket:        bucketStart,
      line:          "$_id.line",
      process:       "$_id.process",
      model:         "$_id.model",
      ears_code:     "$_id.ears_code",
      status_counts: { $arrayToObject: "$status_pairs" },
      updated_at:    "$$NOW"
    }
  },
  { $unset: ["_id", "status_pairs"] },
  // 5. Summary 컬렉션에 upsert
  {
    $merge: {
      into: "RECOVERY_SUMMARY_BY_SCENARIO",
      on:   ["period", "bucket", "line", "process", "model", "ears_code"],
      whenMatched:    "replace",
      whenNotMatched: "insert"
    }
  }
], { allowDiskUse: true, maxTimeMS: 55000 }).toArray();
```

### 6-2. Pipeline: `RECOVERY_SUMMARY_BY_EQUIPMENT` (hourly)

`$match`는 6-1과 동일 (null status 방어 포함). `$group._id`와 `$merge.on`만 다름.

```javascript
// 1단계 $group._id 차이: ears_code 대신 eqpid
_id: { line: "$line", process: "$process", model: "$model", eqpid: "$eqpid", status: "$status" }

// 2단계 $group._id 차이
_id: { line: "$_id.line", process: "$_id.process", model: "$_id.model", eqpid: "$_id.eqpid" }

// $addFields 차이: ears_code 대신 eqpid
eqpid: "$_id.eqpid"

// $merge 차이
into: "RECOVERY_SUMMARY_BY_EQUIPMENT"
on:   ["period", "bucket", "line", "process", "model", "eqpid"]
```

### 6-3. Pipeline: `RECOVERY_SUMMARY_BY_TRIGGER` (hourly)

`$match`는 6-1과 동일 (null status 방어 포함).

```javascript
// 1단계 $group._id 차이: ears_code 대신 trigger_by
_id: { line: "$line", process: "$process", model: "$model", trigger_by: "$trigger_by", status: "$status" }

// 2단계 $group._id 차이
_id: { line: "$_id.line", process: "$_id.process", model: "$_id.model", trigger_by: "$_id.trigger_by" }

// $addFields 차이
trigger_by: "$_id.trigger_by"

// $merge 차이
into: "RECOVERY_SUMMARY_BY_TRIGGER"
on:   ["period", "bucket", "line", "process", "model", "trigger_by"]
```

> **공통 사항**:
> - `$match`는 3개 파이프라인 모두 동일: `create_date` 범위 (String) + `status: { $ne: null, $exists: true }`
> - `$arrayToObject` (MongoDB 3.4.4+) — status 값을 동적 키로 변환. 새 status 추가 시 파이프라인 수정 불필요
> - `updated_at: "$$NOW"` — 서버 측 타임스탬프 (MongoDB 4.2+, 파이프라인 실행 시점 고정)
> - `{ allowDiskUse: true, maxTimeMS: 55000 }` — 고카디널리티 시간대에 `$group`이 100MB 메모리 제한 초과 방지 + 고아 커서 방지 (API timeout 60초보다 5초 일찍 종료)
> - `.toArray()` **필수** — `$merge` 파이프라인이라도 커서를 소비해야 실행됨
> - `$merge`의 `whenMatched: "replace"` 로 **멱등성 보장** → 배치 실패 후 재실행해도 중복 집계 없음
> - `$merge`는 **개별 문서 단위 atomic, 전체 파이프라인은 non-atomic** — 중간 실패 시 이미 merge된 문서는 롤백되지 않으나, 멱등성으로 재실행하면 자연 복구

---

## 7. 전체 아키텍처 흐름

```
[EQP_AUTO_RECOVERY 원본 ~1,500만 건 (EARS DB, Replica Set)]
              │
      ┌───────┴─────────────────────────────────┐
      │                                         │
      │  node-cron                              │  API 직접 조회
      │  (매 :05분 / 매일 00:10)                │  (단일 eqpid/ears_code, 최대 7일)
      │  ┌──────────────────────┐               │
      │  │ 동시 실행 방지       │               │  인덱스:
      │  └──────────────────────┘               │  { eqpid: 1, create_date: 1 }
      ▼                                         │  { ears_code: 1, create_date: 1 }
  Aggregation Pipeline × 3                      │
  ($match → $group×2 → ... → $merge)           │
  인덱스: { create_date: 1 }                    │
      │                                         │
      ├──▶ RECOVERY_SUMMARY_BY_SCENARIO         │
      ├──▶ RECOVERY_SUMMARY_BY_EQUIPMENT        │
      └──▶ RECOVERY_SUMMARY_BY_TRIGGER          │
                    │                            │
      ┌─────────────┤                            │
      ▼             ▼                            │
  [Dashboard API]  [CRON_RUN_LOG]                │
      │          (WEB_MANAGER DB)                │
      ▼                                         ▼
  ┌────────────────────────────────────────────────┐
  │  Recovery Overview      │  Summary 기반 (배치) │
  │  Recovery by Process    │  Summary 기반 (배치) │
  │  Recovery Analysis      │  Summary 기반 (배치) │
  │    └─ 이력 조회 패널    │  원본 직접 조회       │
  └────────────────────────────────────────────────┘
```

---

## 8. 인덱스 초기화

`earsConnection`이 `autoIndex: false`이므로 **모든 인덱스를 수동 생성**해야 함.

### 8-1. 원본 컬렉션 인덱스 (별도 스크립트)

15M 건에 대한 인덱스 빌드는 서버 시작 시 수 분간 블로킹하므로 **별도 마이그레이션 스크립트로 분리**.
첫 배포 시 운영 시간 외 1회 수동 실행. 인덱스당 5~15분, 총 15~45분 소요.

```javascript
// scripts/buildRecoveryIndexes.js
async function buildSourceIndexes() {
  const db = earsConnection.db;
  const coll = db.collection("EQP_AUTO_RECOVERY");

  console.log("[1/3] Building { create_date: 1 } ...");
  await coll.createIndex({ create_date: 1 });

  console.log("[2/3] Building { eqpid: 1, create_date: 1 } ...");
  await coll.createIndex({ eqpid: 1, create_date: 1 });

  console.log("[3/3] Building { ears_code: 1, create_date: 1 } ...");
  await coll.createIndex({ ears_code: 1, create_date: 1 });

  console.log("Done. All 3 indexes built.");
}
```

### 8-2. Summary 컬렉션 인덱스 (서버 시작 시)

Summary 컬렉션은 초기에 비어있으므로 인덱스 생성이 즉시 완료됨.
`server/index.js`에서 기존 `initializeXXX()` 호출 패턴에 맞춰 추가.
**Cron 등록보다 반드시 먼저 실행** — unique 인덱스 없이 `$merge`가 실행되면 에러.

```javascript
async function initializeRecoverySummary() {
  const db = earsConnection.db;

  // RECOVERY_SUMMARY_BY_SCENARIO
  const scenario = db.collection("RECOVERY_SUMMARY_BY_SCENARIO");
  await scenario.createIndex(
    { period: 1, bucket: 1, line: 1, process: 1, model: 1, ears_code: 1 },
    { unique: true }
  );

  // RECOVERY_SUMMARY_BY_EQUIPMENT
  const equipment = db.collection("RECOVERY_SUMMARY_BY_EQUIPMENT");
  await equipment.createIndex(
    { period: 1, bucket: 1, line: 1, process: 1, model: 1, eqpid: 1 },
    { unique: true }
  );

  // RECOVERY_SUMMARY_BY_TRIGGER
  const trigger = db.collection("RECOVERY_SUMMARY_BY_TRIGGER");
  await trigger.createIndex(
    { period: 1, bucket: 1, line: 1, process: 1, model: 1, trigger_by: 1 },
    { unique: true }
  );

  // 쿼리용 인덱스는 Dashboard API 설계 확정 후 추가 (TODO)

  console.log("  + RECOVERY_SUMMARY collections ready");
}
```

---

## 9. 운영 고려사항

### 9-1. 전제조건

- **MongoDB Replica Set 필수** — `$merge`는 Standalone에서 동작하지 않음
- 현재 환경: bitnami 4.2.6, PRIMARY + SECONDARY + ARBITER (확인 완료)

### 9-2. 타임존

- KST(`Asia/Seoul`)는 DST 없음 → 연중 `+09:00` 고정, 시간 경계 이슈 없음
- `node-cron` 설정 시 반드시 `timezone: "Asia/Seoul"` 지정:
  ```javascript
  cron.schedule("5 * * * *", handler, { timezone: "Asia/Seoul" });
  ```
- 서버 시스템 시계가 UTC인 경우 `new Date()` 결과는 UTC — bucket 생성 시 KST 오프셋 명시 필수:
  ```javascript
  const bucket = new Date("2026-03-16T09:00:00.000+09:00");
  ```

### 9-3. 동시 실행 방지

**Cron 자체 중복 방지**: `isRunning` 플래그로 이전 hourly/daily 배치가 완료되기 전 다음 cron skip.

```javascript
let isRunning = false;
cron.schedule("5 * * * *", async () => {
  if (isRunning) return;  // skip
  isRunning = true;
  try { await runHourlyBatch(); }
  finally { isRunning = false; }
}, { timezone: "Asia/Seoul" });
```

**Cron + Manual Backfill 동시 실행**: 의도적으로 허용.
- `$merge`의 `whenMatched: "replace"` 멱등성 덕분에 같은 bucket을 동시 처리해도 데이터 정합성 문제 없음
- Lock을 공유하면 daily cron이 장시간 backfill에 의해 skip되는 위험이 있으므로 독립 운영
- `isRunning`은 cron 전용, `backfillState.status`는 manual backfill 전용

> PM2 cluster mode 등 다중 인스턴스 배포 시에는 in-memory 플래그로 불충분.
> `PM2_INSTANCE_ID === '0'` 체크 또는 MongoDB 기반 분산 락 필요.

### 9-3-1. EQP_AUTO_RECOVERY 인덱스 검증

서버 시작 시 `initializeRecoverySummary()`에서 `EQP_AUTO_RECOVERY`의 `create_date` 인덱스 존재를 검증.
인덱스가 없으면 **cron과 backfill이 자동 비활성화**되고, UI에 경고가 표시됨.

- `checkEarIndexes()`: `collection.indexes()`로 `create_date` 키 포함 인덱스 확인
- `isIndexReady()`: 현재 인덱스 검증 상태 반환
- 인덱스 미확인 시: `runBatch()` 즉시 return, `runManualBackfill()` throw, API 503 응답

### 9-4. Cron 실행 로그 (`CRON_RUN_LOG`)

WEB_MANAGER DB에 실행 이력 기록. Gap 감지 및 backfill 트리거에 활용.

```javascript
{
  jobName:      "recovery_summary_hourly",
  period:       "hourly",
  bucket:       ISODate("2026-03-16T09:00:00.000+09:00"),
  status:       "success" | "partial" | "failed" | "running",
  source:       "cron" | "autoBackfill" | "manualBackfill",
  startedAt:    ISODate("..."),
  completedAt:  ISODate("..."),
  pipelineResults: { scenario: "success", equipment: "success", trigger: "failed" },
  errorMessage: { trigger: "timeout error ..." }
}
```

> - `partial`: 3개 파이프라인 중 일부만 성공 시 (각 파이프라인은 독립 try/catch로 격리)
> - `completedAt`에 TTL 90일 인덱스 적용 — 90일 이후 자동 삭제

> EARS DB 백업/복원 시 `CRON_RUN_LOG`(WEB_MANAGER DB)와 불일치 가능.
> 복원 후에는 backfill 스크립트로 복원 시점~현재 구간 재집계 권장.

### 9-5. 결과 검증 (Sanity Check)

각 배치 완료 후:
1. `total === sum(status_counts)` 확인 — 불일치 시 미인식 status 값 존재 가능
2. 이전 동일 bucket 대비 급격한 변동 감지 (예: 전시간 대비 10배 이상)
3. 0건 집계된 bucket에 대해 원본 `countDocuments` 교차 확인

### 9-6. 초기 Backfill 전략

최초 배포 시 15M 건의 기존 데이터에 대한 summary가 없음. 전체를 한 번에 집계하면 `$group` 메모리 초과 위험.

**권장**: 시간 단위로 분할 실행 (별도 스크립트)

```javascript
for (let day = startDate; day < endDate; day = addDays(day, 1)) {
  for (let hour = 0; hour < 24; hour++) {
    await runHourlyAggregation(day, hour);  // 1시간씩 순차
  }
  await runDailyAggregation(day);
}
```

- `allowDiskUse: true` 필수
- 원본 인덱스 3개 **선행 생성 필수** — 없으면 매 iteration full scan
- 운영 시간 외 실행 권장 (I/O 부하)
- 진행률 로깅으로 중단 지점 파악 가능하게

### 9-7. Retention / TTL

**CRON_RUN_LOG**: `completedAt`에 TTL 90일 인덱스 적용 (`expireAfterSeconds: 7776000`).
서버 시작 시 `initializeRecoverySummary()`에서 자동 생성. 90일 이후 MongoDB가 자동 삭제.

**Summary 컬렉션**: MongoDB TTL 인덱스는 단일 Date 필드 기준이라, `period`별 차등 보존이 불가.
→ **Cron 기반 정리 작업** 권장:

| period  | 보존 기간 | 정리 주기 |
|---------|-----------|-----------|
| hourly  | 30일      | 매일 1회  |
| daily   | 1년       | 매월 1회  |

```javascript
// 예시: hourly 30일 초과 삭제
await collection.deleteMany({
  period: "hourly",
  bucket: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
});
```

**예상 저장 용량** (30일 hourly 기준, ~500 bytes/doc):

| 컬렉션 | 활성 조합 추정 | 30일 doc 수 | 용량 |
|--------|---------------|-------------|------|
| BY_SCENARIO | ~10,000 | ~720만 | ~3.6 GB |
| BY_EQUIPMENT | ~5,000 | ~360만 | ~1.8 GB |
| BY_TRIGGER | ~500 | ~36만 | ~180 MB |

---

## 10. 인덱스 통합 정리

> 문서 각 섹션에 분산되어 있는 인덱스 정보를 한곳에 정리.

### 10-1. 원본 컬렉션 (`EQP_AUTO_RECOVERY`, EARS DB)

| # | 인덱스 | 용도 | 생성 방법 | 비고 |
|---|--------|------|-----------|------|
| 기존 | `{ txn_seq: 1, eqpid: 1 }` | 복합 PK | Akka 서버가 생성 | Dashboard 쿼리에 무용 |
| 1 | `{ create_date: 1 }` | Cron 배치 `$match` 시간 범위 | 별도 스크립트 1회 수동 실행 | ~500MB, 빌드 5~15분 |
| 2 | `{ eqpid: 1, create_date: 1 }` | 장비 이력 조회 API (단일 eqpid, 최대 7일) | 별도 스크립트 1회 수동 실행 | ~650MB, 빌드 5~15분 |
| 3 | `{ ears_code: 1, create_date: 1 }` | 시나리오 이력 조회 API (단일 ears_code, 최대 7일) | 별도 스크립트 1회 수동 실행 | ~650MB, 빌드 5~15분 |

- **합계 추가 스토리지**: ~1.8GB
- **생성 시점**: 운영 시간 외 1회 수동 실행 (총 15~45분)
- `earsConnection`이 `autoIndex: false`이므로 Mongoose 자동 생성 안 됨 → **수동 생성 필수**
- Seed 스크립트에서 `--with-indexes` 옵션으로 생성 가능

### 10-2. Summary 컬렉션 — `$merge`용 unique 인덱스 (EARS DB)

> `$merge` 동작의 전제 조건 — 없으면 `PlanExecutor error` 발생.
> **서버 시작 시 `initializeRecoverySummary()`에서 자동 생성** (빈 컬렉션이므로 즉시 완료).
> Cron 등록보다 반드시 먼저 실행.

| 컬렉션 | unique 인덱스 |
|--------|--------------|
| `RECOVERY_SUMMARY_BY_SCENARIO` | `{ period: 1, bucket: 1, line: 1, process: 1, model: 1, ears_code: 1 }` |
| `RECOVERY_SUMMARY_BY_EQUIPMENT` | `{ period: 1, bucket: 1, line: 1, process: 1, model: 1, eqpid: 1 }` |
| `RECOVERY_SUMMARY_BY_TRIGGER` | `{ period: 1, bucket: 1, line: 1, process: 1, model: 1, trigger_by: 1 }` |

### 10-3. Summary 컬렉션 — 쿼리용 인덱스 (EARS DB)

> Dashboard API 쿼리 패턴에 따라 추가. `initializeRecoverySummary()`에서 함께 생성.
> 데이터 증가 후 성능 이슈 발생 시 추가 검토.

| 컬렉션 | 인덱스 | 용도 |
|--------|--------|------|
| `RECOVERY_SUMMARY_BY_SCENARIO` | `{ period: 1, bucket: 1 }` | Overview/Analysis 시간 범위 조회 |
| `RECOVERY_SUMMARY_BY_SCENARIO` | `{ period: 1, bucket: 1, process: 1 }` | By Process 재집계 |
| `RECOVERY_SUMMARY_BY_EQUIPMENT` | `{ period: 1, bucket: 1 }` | Overview Top10 장비 조회 |
| `RECOVERY_SUMMARY_BY_TRIGGER` | `{ period: 1, bucket: 1 }` | Overview Trigger 분포 조회 |

### 10-4. 실행 로그 (`CRON_RUN_LOG`, WEB_MANAGER DB)

| 인덱스 | 용도 | 생성 방법 |
|--------|------|-----------|
| `{ jobName: 1, period: 1, bucket: 1 }` (unique) | bucket별 idempotent upsert | `initializeRecoverySummary()`에서 자동 생성 |
| `{ completedAt: 1 }` (TTL 90일) | 90일 이후 자동 삭제 | `initializeRecoverySummary()`에서 자동 생성 |

### 요약 (전체 인덱스 수)

| DB | 컬렉션 | 추가 인덱스 수 | 생성 방법 |
|----|--------|---------------|-----------|
| EARS | `EQP_AUTO_RECOVERY` | 3 | 별도 스크립트 (1회 수동) |
| EARS | `RECOVERY_SUMMARY_BY_SCENARIO` | 1 unique + 2 query | 서버 시작 시 자동 |
| EARS | `RECOVERY_SUMMARY_BY_EQUIPMENT` | 1 unique + 1 query | 서버 시작 시 자동 |
| EARS | `RECOVERY_SUMMARY_BY_TRIGGER` | 1 unique + 1 query | 서버 시작 시 자동 |
| WEB_MANAGER | `CRON_RUN_LOG` | 1 unique + 1 TTL | 서버 시작 시 자동 |
| **합계** | | **12** | |

---

## 11. 추후 논의 예정 항목 (TODO)

- [x] ~~`create_date` String → ISODate 마이그레이션 전략~~ → Summary에서 ISODate 변환으로 해결
- [x] ~~`status` 필드 정의~~ → Raw string 그대로 저장, 그룹핑은 프론트엔드에서 처리
- [x] ~~성공률 공식~~ → `Success / Total` (단순 비율)
- [x] ~~MongoDB 환경 확인~~ → Replica Set (PRIMARY + SECONDARY + ARBITER) 확인
- [x] ~~Dashboard 페이지 구성~~ → 3페이지 + 이력 조회 패널
- [x] ~~원본 인덱스 설계~~ → `{ create_date }` + `{ eqpid, create_date }` + `{ ears_code, create_date }` 확정
- [x] ~~Dashboard API 쿼리 설계~~ → 5개 API 구현 (overview/by-process/analysis/history/last-aggregation)
- [x] ~~Summary 쿼리용 인덱스 설계~~ → unique 인덱스 prefix `{ period, bucket }` 활용으로 별도 불필요
- [x] ~~배치 구현체~~ → `node-cron` + `isRunning` 동시 실행 방지 + `CRON_RUN_LOG` 기록
- [x] ~~권한 등록~~ → 3개 권한 키 + `DEFAULT_ROLE_PERMISSIONS` 전 레벨 `true`
- [x] ~~Summary 컬렉션 Mongoose 모델 정의 여부~~ → raw driver 사용 (autoIndex: false 환경)
- [x] ~~이력 조회 API~~ → 원본 직접 조회, 7일 제한, eqpid/ears_code 필수, skip/limit 페이지네이션
- [x] ~~조회 기간 설계~~ → 오늘/7일/30일/90일/1년/커스텀(최대 2년), 기간별 granularity 자동 전환 (hourly/daily/weekly/monthly)
- [x] ~~성능 최적화~~ → 모든 aggregate에 `allowDiskUse: true` + `maxTimeMS: 55000`, Overview 7개 + ByProcess 5개 `Promise.all` 병렬 실행, Analysis trend `$limit: 300000`, API timeout 60초
- [x] ~~Cron 실패 감지 + backfill 자동화~~ → gap 감지 + auto-backfill + manual backfill UI (RecoveryBackfillModal)
- [x] ~~초기 backfill 스크립트 작성~~ → RecoveryBackfillModal로 대체 (날짜 범위 지정, throttle 조절, 진행률 표시)
- [x] ~~CRON_RUN_LOG TTL~~ → completedAt에 TTL 90일 인덱스 자동 생성
- [x] ~~EQP_AUTO_RECOVERY 인덱스 검증~~ → 서버 시작 시 create_date 인덱스 확인, 미존재 시 cron/backfill 비활성 + UI 경고
- [ ] Retention 정리 cron 구현 (hourly 30일, daily 2년)
- [ ] 비표준 `trigger_by` 정규화 정책 결정
- [ ] 프론트엔드 Stopped 포함/제외 토글 구현 (실패율 계산 시 사용자 선택)
