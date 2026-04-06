# Tier 4 — 멀티 Pod 전체 계획 (동시접속 200명+ HA)

> 작성일: 2026-04-06
> 전문가 교차 검증 완료 (분산 시스템/Redis, Kubernetes/인프라, 아키텍처/테스트)

## Context

Tier 1~3 완료로 단일 Pod 100-150명 달성. 멀티 Pod(2+)로 수평 확장 + HA 확보.

## 전문가 교차 검증 결과

| 전문가 | 주요 발견 |
|--------|----------|
| 분산 시스템/Redis | Cron 락 TTL 120s < 실제 최대 ~1162s (auto-backfill 포함). **락 범위를 파이프라인 실행만으로 축소 + TTL 300s**. Backfill owner TTL 5분+5초 갱신 |
| Kubernetes/인프라 | Ingress v1 API K8s 1.17 미지원 → v1beta1. `fetchSSEStream`에 `credentials:'include'` 필수. PDB/리소스 제한/preStop hook 추가 |
| 아키텍처/테스트 | Backfill Hash 동기화 = 과도한 복잡성 → **owner key + cancel key만으로 간소화** (~15줄). 로거 `recovery` 재사용 |

## 항목별 독립 작업 목록

### T4-1. Cron 분산 락 (batchRunner.js)
- Redis `SET NX EX 300` 분산 락, 락 범위를 파이프라인 실행만으로 한정
- auto-backfill은 락 밖 (idempotent)
- Lua 스크립트 원자적 compare-and-delete 릴리스
- 선행: T4-5 (podIdentity), T4-6 (recoveryDeps Redis DI)

### T4-2. Backfill 교차 Pod 가시성
- owner key (`wm:backfill:owner`) + cancel key (`wm:backfill:cancel`) 2개만
- ~15줄 추가 (vs Hash 동기화 ~100줄)
- 선행: T4-5, T4-6

### T4-3. activeTailCount — 변경 없음
- Per-pod 인메모리 유지, 문서화 주석만

### T4-4. SSE Sticky Session + fetchSSEStream
- Ingress v1beta1 sticky session 쿠키
- `fetchSSEStream`에 `credentials: 'include'`

### T4-5. Pod ID + Health Check
- `podIdentity.js` 신규 (`process.env.POD_NAME || os.hostname()`)
- healthCheck.js 응답에 podId 추가

### T4-6. recoveryDeps.js Redis DI
- `getRedisClient`, `isRedisAvailable`, `getPodId` DI 추가

### T4-7. MongoDB maxPoolSize 명시
- EARS 20, WEB_MANAGER 10 (환경변수 설정 가능)

### T4-8. Kubernetes 인프라
- deployment.yaml: replicas:2, resources, preStop, startupProbe, POD_NAME env
- ingress.yaml: v1beta1, sticky session, SSE timeout
- pdb.yaml: minAvailable:1

## 구현 순서

```
독립 작업이므로 항목별로 분리 구현. 자연스러운 순서:
1. T4-5 + T4-6 (기반: podIdentity + DI)
2. T4-1 (Cron 분산 락) — replicas:2 전 필수
3. T4-2 (Backfill 교차 Pod) — replicas:2 전 필수
4. T4-7 (maxPoolSize) — 독립, 언제든
5. T4-3 (문서화 주석) — 독립, 언제든
6. T4-4 (SSE + fetchSSEStream) — 독립, 언제든
7. T4-8 (K8s 인프라) — 마지막
```

## Pod 수별 예상 용량

| Pod 수 | 동시접속 | 용도 |
|--------|---------|------|
| 1 | ~150명 | 개발/소규모 |
| **2** | **~300명** | **운영 권장 (HA)** |
| 3 | ~450명 | 대규모 |
| 5 | ~700명 | 과잉 (15K 클라이언트 기준) |
