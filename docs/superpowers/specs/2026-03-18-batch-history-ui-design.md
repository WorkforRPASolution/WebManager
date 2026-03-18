# Batch History UI Design

Recovery Overview 페이지에 배치 실행 이력 모달을 추가한다.

## Context

WEBMANAGER_LOG의 `batch` 카테고리에 cron/backfill 실행 이력이 기록된다. 이 데이터를 Recovery Overview에서 모달로 조회할 수 있게 한다.

## 설계 결정

- **진입점**: Recovery Overview 헤더의 DataFreshness 옆 독립 버튼 ("📋 배치 이력")
- **모달 구성**: 히트맵(상단) + 필터 바(중간) + 테이블(하단)
- **모달 패턴**: 기존 RecoveryBackfillModal과 동일 (Teleport, 드래그, 리사이즈)
- **권한**: Admin(role 1)만 접근 (backfill 버튼과 동일)

## 히트맵 (상단)

GitHub Contribution 스타일 타임라인 히트맵.

- **기간 전환**: 30일 / 60일 / 90일 버튼
- **셀 색상**: 정상 실행 건수에 따라 초록 농도 (연한→진한), skip은 노란색, error는 빨간색, backfill은 파란색
- **색상 우선순위**: error > skip > backfill > cron (하루에 여러 유형이 있으면 가장 중요한 색)
- **셀 클릭**: 해당 날짜로 테이블 필터링
- **Tooltip**: 날짜, 총 건수, 유형별 건수
- **레이아웃**: 요일(Mon/Wed/Fri/Sun) × 주(columns), 오른쪽이 최신
- **구현**: Canvas 또는 순수 HTML div (ECharts 불필요)

## 필터 바 (중간)

- **유형 필터**: 드롭다운 — 전체 / Cron 완료 / Cron Skip / Backfill 시작 / Backfill 완료 / Backfill 취소 / Auto Backfill
- **기간 필터**: 드롭다운 — 오늘 / 7일 / 30일
- **총 건수**: 우측에 "총 N건" 표시
- **히트맵 셀 클릭 시**: 기간 필터가 해당 날짜로 자동 설정, 유형은 전체 유지

## 테이블 (하단)

| 컬럼 | 필드 | 표시 형식 |
|------|------|----------|
| 시각 | timestamp | MM/DD HH:MM:SS |
| 유형 | batchAction | 한글 뱃지 (색상별) |
| 주기 | batchPeriod | hourly/daily 뱃지, null이면 "—" |
| 실행자 | userId | system 또는 사용자 ID (사용자는 파란색) |
| 상세 | batchParams + batchResult | 축약 텍스트 (hover 시 전체 JSON) |

### 유형 뱃지 매핑

| batchAction | 한글 | 색상 |
|-------------|------|------|
| cron_completed | Cron 완료 | 초록 |
| cron_skipped | Cron Skip | 노란 |
| backfill_started | Backfill 시작 | 남색 |
| backfill_completed | Backfill 완료 | 파랑 |
| backfill_cancelled | Backfill 취소 | 회색 |
| auto_backfill_completed | Auto Backfill | 하늘색 |

### 상세 컬럼 축약 규칙

| batchAction | 축약 표시 |
|-------------|----------|
| cron_completed | `status: {status}, bucket: {bucket}` |
| cron_skipped | `reason: {reason}` |
| backfill_started | `{startDate}~{endDate}, throttle {throttleMs}ms` |
| backfill_completed | `{status}, {processed}건 처리, {durationMs/1000}초` |
| backfill_cancelled | (빈 문자열) |
| auto_backfill_completed | `gaps: {gapsFound}, processed: {processed}` |

### 정렬

- 기본: timestamp 내림차순 (최신 먼저)
- 컬럼 헤더 클릭 정렬 불필요 (시간순만)

### 페이지네이션

- 서버 사이드 페이지네이션 (기존 pagination util 사용)
- 페이지당 50건, 하단에 페이지 네비게이션

## API

### GET /api/recovery/batch-logs

기존 `getRecentBatchLogs()` 모델 함수를 활용한 조회 API.

**Query Parameters:**
- `batchAction` (optional): 필터
- `period` (optional): today / 7d / 30d
- `startDate`, `endDate` (optional): 히트맵 셀 클릭 시 특정 날짜
- `page`, `pageSize` (optional): 페이지네이션

**Response:**
```json
{
  "data": [...],
  "total": 168,
  "page": 1,
  "pageSize": 50,
  "totalPages": 4
}
```

### GET /api/recovery/batch-logs/heatmap

히트맵 데이터 전용 API. 일별 집계.

**Query Parameters:**
- `days` (optional): 30 / 60 / 90 (기본 30)

**Response:**
```json
{
  "data": [
    {
      "date": "2026-03-18",
      "total": 26,
      "cron": 24,
      "skip": 0,
      "error": 0,
      "backfill": 2,
      "autoBackfill": 0
    }
  ]
}
```

### 권한

- 기존 `dashboardRecoveryOverview` 권한에 포함 (별도 권한 불필요)
- Admin(role 1) 체크는 프론트엔드에서 버튼 표시 여부로 제어

## 파일 구조

### 신규 파일

| 파일 | 설명 |
|------|------|
| `client/src/features/dashboard/components/BatchHistoryModal.vue` | 모달 컴포넌트 (히트맵+필터+테이블) |
| `client/src/features/dashboard/components/BatchHeatmap.vue` | 히트맵 컴포넌트 (분리) |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `client/src/features/dashboard/RecoveryOverviewView.vue` | 버튼 + 모달 import/바인딩 |
| `client/src/shared/api/index.js` | `getBatchLogs`, `getBatchHeatmap` 추가 |
| `server/features/recovery/routes.js` | 2개 라우트 추가 |
| `server/features/recovery/controller.js` | `getBatchLogs`, `getBatchHeatmap` 핸들러 |

### 모달 크기

- 기본: 720 × 600
- 최소: 560 × 480
- 최대: 95vw × 95vh

## 다크 모드

히트맵/뱃지 색상은 다크 모드 대응 필요:
- 셀 배경: 라이트의 밝은 색 → 다크에서 어두운 색 (opacity 조절)
- 뱃지: 기존 Recovery 뱃지 패턴 따름
- 테이블: 기존 Recovery 테이블 다크 모드 패턴 따름

## 테스트

- 서버: controller 핸들러 단위 테스트 (vitest)
- 클라이언트: 별도 테스트 없음 (기존 패턴 동일)
