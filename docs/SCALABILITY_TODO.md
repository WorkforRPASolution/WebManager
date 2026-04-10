# WebManager 확장성 개선 TODO

> **기준**: 클라이언트 15,000대, 내부 네트워크 1Gbps, 단일 컨테이너 기본
> **작성일**: 2026-03-20

---

## 현황 요약

| 항목 | 현재 상태 |
|------|----------|
| 단일 Pod 동시접속 한계 | ~10-15명 (최적화 없음) |
| Dashboard 응답시간 (10명) | 1.5-3초 |
| `GET /api/clients` 응답 크기 | ~3 MB (비압축, 페이지네이션 없음) |
| Dashboard `details[]` 응답 크기 | ~2 MB (15K 항목 무조건 포함) |
| Redis 조회 패턴 | 30회 순차 mget (BATCH_SIZE=500) |
| Response Compression | 미적용 |
| Dashboard 캐시 | 없음 (매 요청마다 전체 재계산) |

---

## Tier 1 — 즉시 적용 (목표: 40-50명) ✅ 완료

작업량: ~1일. 2026-04-01 완료.

### T1-1. compression 미들웨어 추가 ✅

- [x] `server/app.js`에 `compression` 미들웨어 등록 (SSE `text/event-stream` 필터 포함)
- 효과: JSON 응답 gzip 압축 (8-15x), SSE 5개 엔드포인트 자동 제외

### T1-2. `.lean()` 누락 쿼리 추가 ✅

- [x] `server/features/clients/service.js` — `getClients()` `.lean()` 추가

### T1-3. `onoff` 인덱스 추가 ✅

- [x] `server/features/clients/model.js` — `{ onoff: 1 }` 인덱스 추가

### T1-4. Dashboard Overview 쿼리 병렬화 ✅

- [x] `server/features/dashboard/routes.js` — 3개 순차 쿼리 `Promise.all()` 병렬화

### T1-5. Redis 단일 `mget()` 전환 ✅

- [x] `server/features/dashboard/service.js` — 4개 함수의 순차 배치 루프를 단일 `redis.mget(keys)` 호출로 변경
  - `getAgentStatus`, `getAgentVersionDistribution`, `getResourceAgentStatus`, `getResourceAgentVersionDistribution`
  - `BATCH_SIZE` 상수 제거
  - 효과: 30 round-trip → 1 round-trip

### T1-6. Dashboard `details[]` 별도 요청 분리 ✅

- [x] 백엔드: 4개 서비스 함수에 `includeDetails` 옵션 추가 (기본값 `false`)
- [x] 백엔드: controller에서 `?includeDetails=true` 쿼리 파라미터 파싱
- [x] 프론트엔드: 4개 Dashboard 뷰에서 `fetchData()` 시 details 미요청
- [x] 프론트엔드: CSV Detail Export 시에만 `includeDetails=true`로 별도 API 호출
- [x] UX: `csvExporting` 로딩 상태 + `useToast` 에러 알림 + 버튼 disabled 처리
- [x] 테스트: 기존 details 테스트에 `includeDetails: true` 추가 + 기본값 undefined 검증 추가

---

## Tier 2 — Dashboard Redis 캐시 (목표: 100명, 핵심) ✅ 완료

작업량: ~2일. 2026-04-02 완료.

### T2-1. 캐시 유틸리티 구현 ✅

- [x] `server/shared/utils/apiCache.js` 생성
  - `getWithCache(redis, key, computeFn, ttlSec)` — Redis 기반 응답 캐시
  - Stampede 방지: NX EX 10초 뮤텍스 + 지수 백오프 6회 (50~1600ms)
  - `buildCacheKey(prefix, params)` — 필터 조합별 MD5 해싱 (쉼표 값 정렬)
  - Graceful degradation: Redis 미사용 시 computeFn 직접 호출
  - 15개 TDD 테스트 (apiCache.test.js)

### T2-2. 엔드포인트별 캐시 적용 (Service 레이어) ✅

- [x] `GET /api/dashboard/summary` — TTL **15초** (routes.js 인라인 → service.js 추출)
- [x] `GET /api/dashboard/agent-status` — TTL **15초**
- [x] `GET /api/dashboard/agent-version` — TTL **30초**
- [x] `GET /api/dashboard/resource-agent-status` — TTL **15초**
- [x] `GET /api/dashboard/resource-agent-version` — TTL **30초**
- [x] `GET /api/recovery/overview` — TTL **60초** (배치 집계 기반, hourly 갱신)
- [x] `GET /api/recovery/by-process` — TTL **60초**
- [x] `GET /api/recovery/by-category` — TTL **60초** (RECOVERY_SUMMARY_BY_CATEGORY 기반)
- [x] `GET /api/user-activity/tool-usage` — TTL **60초** (스냅샷 데이터)
- [x] `GET /api/user-activity/webmanager-stats` — TTL **60초** (11개 aggregation, 성능 전문가 Critical 지적 반영)

> 캐시는 Controller가 아닌 Service 레이어에 배치 (레이어 위반 방지, 기존 DI 활용)
> `includeDetails=true` (CSV export) 시 캐시 bypass
> `redisAvailable`은 캐시에서 제외, 라이브 값 별도 주입

### T2-3. 캐시 키 설계 ✅

```
wm:cache:dashboard:summary                            → TTL 15s
wm:cache:dashboard:agent-status:{md5}                 → TTL 15s
wm:cache:dashboard:agent-version:{md5}                → TTL 30s
wm:cache:dashboard:resource-agent-status:{md5}        → TTL 15s
wm:cache:dashboard:resource-agent-version:{md5}       → TTL 30s
wm:cache:recovery:overview:{md5}                      → TTL 60s
wm:cache:recovery:by-process:{md5}                    → TTL 60s
wm:cache:recovery:by-category:{md5}                   → TTL 60s
wm:cache:user-activity:tool-usage:{md5}               → TTL 60s
wm:cache:user-activity:webmanager-stats:{md5}         → TTL 60s
```

- 필터 조합이 동일하면 캐시 공유 (사용자 무관)
- 쉼표 구분 값 정렬 후 `crypto.createHash('md5')` 해싱

---

## Tier 3 — Clients 최적화 (목표: 100명 안정화) ✅ 완료

작업량: ~1-2일. 2026-04-03 완료.

### T3-1. 서버 사이드 페이지네이션 적용 ✅ (기존 구현 확인)

- [x] `server/features/clients/service.js` — `getClientsPaginated()` 이미 구현됨
  - `GET /api/clients/list` 라우트 + `parsePaginationParams` + `Promise.all([find().skip().limit(), countDocuments()])`
- [x] 프론트엔드 `useClientData` composable + `ClientToolbar` 페이지네이션 UI 이미 구현됨

### T3-2. 프론트엔드 Clients 페이지 대응 ✅ (기존 구현 확인)

- [x] `clientListApi.getClients(filters, page, pageSize)` + `changePage/changePageSize` 이미 구현됨

### T3-3. `createClients/updateClients` 최적화 ✅

전문가 검증 결과 targeted 쿼리로 풀스캔 완전 제거는 비용 대비 이득 없음 (1-10회/시간 admin 작업).
대신 핵심 비효율을 간소화 최적화로 제거:

- [x] `updateClients()` — `Client.find({}).lean()` 전체 필드 풀로드 → 대상 문서 + 3필드 경량 쿼리 분리 (메모리 7.5MB → 755KB, 10x↓)
- [x] `updateClients()` — `allClients.filter()` 매 반복 15K 배열 재생성 → Set/Map 사전 구축 O(1) 룩업
- [x] `updateClients()` — 감사 로그 `findById` N회 개별 쿼리 → 1회 배치 조회
- [x] `validateBatchCreate/validateUpdate` — Array.find() O(K×15K) → Set/Map O(K) 전환
- [x] `{ ipAddr: 1, ipAddrL: 1 }` 인덱스 추가 (Redis 동기화 키 중복 방지 대비)

---

## Tier 4 — 멀티 Pod (목표: 200명+, HA)

Tier 1~3 완료 후 수평 확장이 필요할 때.

### T4-1. 멀티 레플리카 사전 조건 해결

- [ ] **Cron 분산 락**: `server/features/recovery/cronScheduler.js`
  - `runBatch()` 진입 시 Redis `SET NX PX` 락 획득 → 실패 시 skip
  - 또는 환경변수 `CRON_ENABLED=true`로 1개 Pod만 Cron 실행
- [ ] **Backfill 상태 Redis 이관**: `server/features/recovery/backfillManager.js`
  - `backfillState`를 Redis Hash로 관리
  - start/cancel/status가 모든 Pod에서 일관되게 동작
- [ ] **activeTailCount Redis 카운터**: `server/features/clients/logService.js`
  - `let activeTailCount` → `redis.incr('tail:active')` / `redis.decr('tail:active')`
  - 프로세스 크래시 대비 TTL 안전장치
- [ ] **isRunning 분산 락**: `server/features/recovery/batchRunner.js`
  - 로컬 `isRunning` → Redis `SET NX` 락

### T4-2. SSE Sticky Session 설정

- [ ] Kubernetes Ingress 또는 로드밸런서에 세션 어피니티 설정
  - SSE 엔드포인트 5개: log-tail, config-deploy, software-deploy, config-compare, batch-action

```yaml
# Kubernetes Ingress 예시
metadata:
  annotations:
    nginx.ingress.kubernetes.io/affinity: "cookie"
    nginx.ingress.kubernetes.io/session-cookie-name: "WM_AFFINITY"
    nginx.ingress.kubernetes.io/session-cookie-max-age: "3600"
```

### T4-3. MongoDB 커넥션 풀 조정

- [ ] 캐시 적용 후 실제 DB 쿼리가 소수이므로 풀 축소

```js
// 기본 100 → 캐시 환경에서 20이면 충분
mongoose.connect(uri, { maxPoolSize: 20 })
```

- Pod 5개 × 20 = 100 커넥션 (MongoDB 기본 한도 내)

### T4-4. Cache Stampede 방지 (T2-1 뮤텍스)

- 멀티 Pod 환경에서 TTL 만료 시 N개 Pod 동시 cache miss 가능
- T2-1의 Redis 뮤텍스 패턴이 이를 방지

### T4-5. 이미지 스토리지 외부화

- [ ] `IMAGE_STORAGE=httpwebserver` 설정 확인 (또는 MinIO/S3)
- 로컬 파일시스템(`localStorage.js`)은 멀티 Pod에서 사용 불가

---

## Pod 수별 예상 용량 (Tier 1~4 모두 적용 시)

| Pod 수 | 동시접속 | Dashboard 응답 | 용도 |
|--------|---------|---------------|------|
| 1 | ~150명 | < 50ms | 개발/소규모 |
| **2** | **~300명** | **< 50ms** | **운영 권장 (HA)** |
| 3 | ~450명 | < 50ms | 대규모 |
| 5 | ~700명 | < 50ms | 과잉 (15K 클라이언트 기준) |

> 2 Pod + 캐시 조합이 가장 실용적. HA 확보 + 충분한 용량.

---

## 우선순위 로드맵

```
Phase 1 (1일)    : Tier 1 (T1-1 ~ T1-6)         → 50명
Phase 2 (2일)    : Tier 2 (T2-1 ~ T2-3)         → 100명
Phase 3 (1-2일)  : Tier 3 (T3-1 ~ T3-3)         → 100명 안정화
Phase 4 (필요 시) : Tier 4 (T4-1 ~ T4-5)         → 200명+ HA
```

**Tier 2 (Redis 캐시)가 가장 임팩트가 크다.** Pod 확장 전 반드시 선행.
캐시 없이 Pod만 늘리면 공유 자원(MongoDB/Redis) 부하만 N배 증가하여 비효율적.
