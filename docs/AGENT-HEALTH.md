# AgentHealth 지원 -- Dual Key 조회

## 개요

ARS 시스템에는 두 종류의 에이전트가 존재한다:

- **ResourceAgent (신규)**: Redis에 `AgentHealth` 키로 상태를 기록. 상태(OK/WARN/SHUTDOWN) + uptime + 사유를 포함하는 확장 형식.
- **ARSAgent (기존)**: Redis에 `AgentRunning` 키로 상태를 기록. 순수 uptime 숫자만 포함하는 레거시 형식.

WebManager는 두 에이전트 타입을 동시에 지원하기 위해 **dual key 조회** 방식을 사용한다.
`AgentHealth` 키를 우선 조회하고, 값이 없으면 `AgentRunning` 키로 fallback한다.

**구현 파일**: `server/features/clients/agentAliveService.js`

## 조회 로직

### 키 구성

| 에이전트 | Redis 키 | 값 형식 | 예시 |
|----------|----------|---------|------|
| ResourceAgent | `AgentHealth:{Process}-{EqpModel}-{EqpID}` | `{Status}:{Uptime}` 또는 `{Status}:{Uptime}:{Reason}` | `OK:3600`, `WARN:1800:high_cpu` |
| ARSAgent | `AgentRunning:{Process}-{EqpModel}-{EqpID}` | `{Uptime}` (순수 숫자) | `3600` |

키 생성 함수:

```javascript
buildAgentHealthKey(process, eqpModel, eqpId)
// => "AgentHealth:ARS-M1-EQP01"

buildAgentRunningKey(process, eqpModel, eqpId)
// => "AgentRunning:ARS-M1-EQP01"
```

### getBatchAliveStatus() 동작

`getBatchAliveStatus(eqpIds)` 함수는 여러 eqpId의 alive 상태를 한 번에 조회한다.

**처리 순서:**

1. MongoDB에서 eqpId 목록에 해당하는 `process`, `eqpModel` 필드를 조회 (`Client.find()` + `.select('eqpId process eqpModel')`)
2. 각 eqpId에 대해 `AgentHealth` 키와 `AgentRunning` 키 2개를 생성
3. 모든 키를 하나의 배열로 합쳐 **단일 `mget`으로 한 번에 조회** (Redis round-trip 1회)
4. 결과를 health 값 배열과 running 값 배열로 분리
5. 각 eqpId에 대해 `AgentHealth` 값이 있으면 사용, 없으면 `AgentRunning` 값으로 fallback

**에지 케이스 처리:**

- Redis 클라이언트가 `null`이면 모든 eqpId에 `{ alive: null, redisUnavailable: true }` 반환
- eqpIds가 빈 배열이면 빈 객체 `{}` 반환
- MongoDB에 해당 eqpId가 없으면 `{ alive: false, uptimeSeconds: null, health: null }` 반환

### 우선순위 흐름

```
eqpIds 입력
    |
    v
MongoDB 조회 (process, eqpModel)
    |
    v
Redis 키 생성
  +-- AgentHealth:{P}-{M}-{ID}  (신규)
  +-- AgentRunning:{P}-{M}-{ID} (레거시)
    |
    v
Redis mget (1회 호출)
    |
    v
각 eqpId별 판정:
    |
    +-- AgentHealth 값 존재? --YES--> AgentHealth 값 사용
    |                                 (OK/WARN/SHUTDOWN 파싱)
    |
    +-- NO --> AgentRunning 값 존재? --YES--> AgentRunning 값 사용
    |                                         (순수 숫자 -> health="OK")
    |
    +-- 둘 다 없음 --> alive=false
    |
    v
parseAliveValue() 적용 + uptimeFormatted 추가
    |
    v
결과 반환: { [eqpId]: { alive, uptimeSeconds, health, reason, uptimeFormatted } }
```

## parseAliveValue() 파싱

값 문자열을 파싱하여 구조화된 객체로 변환한다.

| 입력 | alive | health | uptimeSeconds | reason | 설명 |
|------|-------|--------|---------------|--------|------|
| `"OK:3600"` | `true` | `"OK"` | `3600` | `null` | ResourceAgent 정상 |
| `"WARN:1800:no_collection"` | `true` | `"WARN"` | `1800` | `"no_collection"` | ResourceAgent 경고 |
| `"SHUTDOWN:3600"` | `true` | `"SHUTDOWN"` | `3600` | `null` | ResourceAgent 종료 중 |
| `"3600"` | `true` | `"OK"` | `3600` | - | ARSAgent 레거시 형식 |
| `null` | `false` | `null` | `null` | - | 키 없음 (오프라인) |
| `undefined` | `false` | `null` | `null` | - | 키 없음 |
| `""` | `false` | `null` | `null` | - | 빈 문자열 |

**파싱 로직:**

1. 값이 `null`, `undefined`, 빈 문자열이면 `alive: false`
2. 값에 `:`가 포함되면 확장 형식으로 파싱: `parts[0]`=health, `parts[1]`=uptime, `parts[2]`=reason(선택)
3. 그 외 순수 숫자이면 레거시 형식: `health: 'OK'`, uptime 파싱
4. 숫자 파싱 실패 시 `alive: false`

## formatUptime() 표시 형식

uptime 초 단위를 사람이 읽기 쉬운 문자열로 변환한다.

| 입력 (초) | 출력 | 설명 |
|-----------|------|------|
| `45` | `"45s"` | 60초 미만: 초 단위 |
| `125` | `"2m 5s"` | 60분 미만: 분+초 |
| `3661` | `"1h 1m"` | 24시간 미만: 시+분 |
| `86400` | `"1d 0h"` | 24시간 이상: 일+시 |
| `90061` | `"1d 1h"` | 복수 일 |
| `null` | `null` | 값 없음 |

## API 엔드포인트

```
POST /api/clients/alive-status
```

- **인증**: `authenticate` 미들웨어 필수
- **권한**: `arsAgent` 또는 `resourceAgent` 메뉴 권한 필요
- **요청 body**: `{ eqpIds: string[] }`
- **응답**: `{ [eqpId]: { alive, uptimeSeconds, health, reason, uptimeFormatted } }`
- **컨트롤러**: `controller.getBatchAliveStatusHandler`

SSE 스트림에서도 `aliveStatuses`를 전송하여 실시간 상태 업데이트를 지원한다.

## 프론트엔드 영향

프론트엔드는 **변경 없이** 두 에이전트 형식을 모두 지원한다.

`ClientDataGrid.vue`의 `uptimeCellRenderer`가 `health` 필드에 따라 렌더링을 분기한다:

| health 값 | 표시 | 색상 |
|-----------|------|------|
| `"OK"` | 초록 점 + uptime | 초록 (`green-600`) |
| `"WARN"` | 주황 점 + uptime (reason tooltip) | 주황 (`amber-600`) |
| `alive === false` | 회색 점 + 대시 | 회색 (`gray-400`) |
| 데이터 없음 / Redis 불가 | 대시 | 회색 (`gray-400`) |

AG Grid 컬럼 정의:

```javascript
{
  field: 'aliveStatus',
  headerName: 'Uptime',
  width: 95,
  cellRenderer: uptimeCellRenderer,
  sortable: false,
  filter: false,
}
```

`parseAliveValue()`가 서버 측에서 두 형식을 모두 통일된 구조로 변환하므로, 프론트엔드는 `health` 필드만 확인하면 된다.

## 테스트

```bash
cd server && npx vitest run features/clients/agentAliveService.test.js
```

총 **20개 테스트** (5개 describe 블록):

| describe | 테스트 수 | 검증 내용 |
|----------|----------|----------|
| `buildAgentRunningKey` | 1 | 레거시 키 형식 생성 |
| `buildAgentHealthKey` | 1 | 신규 키 형식 생성 |
| `parseAliveValue` | 5 | null/빈 문자열/순수 숫자/OK:N/WARN:N:reason 파싱 |
| `formatUptime` | 7 | 초/분/시/일 변환 + null/undefined 처리 |
| `getBatchAliveStatus` | 6 | Redis 불가/dual key mget/AgentHealth only/AgentRunning fallback/양쪽 모두 존재 시 우선순위/빈 배열 |

Dual key 관련 시나리오 3개:

1. **AgentHealth만 존재** (ResourceAgent): `AgentHealth` 값 사용
2. **AgentRunning만 존재** (레거시 ARSAgent): `AgentRunning` 값으로 fallback
3. **양쪽 모두 존재**: `AgentHealth` 값 우선 사용

테스트 DI 패턴: `_setDeps({ redisClient, ClientModel })`으로 Redis 클라이언트와 Mongoose 모델을 주입하여 단위 테스트 가능.
