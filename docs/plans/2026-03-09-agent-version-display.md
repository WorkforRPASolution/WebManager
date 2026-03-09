# Agent Version Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ARSAgent 및 ResourceAgent의 버전 정보를 WebManager UI에 표시. MongoDB first → Redis fallback (저장 없음) 전략으로 Redis 부하 최소화.

**Architecture:** MongoDB `EQP_INFO.agentVersion` 확인 → 없으면 Redis DB 0 `AgentMetaInfo` HGET → 결과 반환 (MongoDB에 저장하지 않음). ARSAgent는 항상 Redis fallback, ResourceAgent는 향후 MongoDB에 직접 기록하므로 Redis 불필요.

**Tech Stack:** Node.js (ioredis), MongoDB (Mongoose), Vue.js 3, AG Grid

---

### Task 1: 환경 설정 확인

**Files:**
- Modify: `server/.env.example` (코멘트 업데이트)
- Modify: `k8s/configmap.yaml` (코멘트 업데이트)

**변경 없음 — 기존 `REDIS_URL` (DB 0) 활용**

AgentRunning, AgentHealth, AgentMetaInfo 모두 Redis DB 0에 저장되므로 별도 연결이 필요 없음.
기존 `redisConnection.js`의 단일 `redisClient`를 그대로 사용.

`.env.example` 코멘트만 업데이트:
```env
# Redis Connection (Agent Status + MetaInfo, DB 0 - optional, graceful degradation)
REDIS_URL=redis://localhost:6379/0
```

**핵심:** 모든 Redis 키가 DB 0에 있으므로 단일 연결로 충분. 별도 `REDIS_METADATA_URL` 불필요.

---

### Task 2: EQP_INFO 스키마 변경 (model.js)

**Files:**
- Modify: `server/features/clients/model.js:26`

**Step 1: agentVersion 필드를 Object로 변경**

현재:
```javascript
agentVersion: { type: String },
```

변경:
```javascript
agentVersion: {
  arsAgent: { type: String },
  resourceAgent: { type: String },
},
```

**주의:** 기존 `agentVersion` 필드에 String 값이 저장된 문서가 있을 수 있음. Mongoose는 스키마 타입 불일치 시 해당 필드를 무시하므로 마이그레이션 불필요 (기존 값은 현재 아무도 안 쓰고 있음).

---

### Task 3: agentVersionService.js 생성 (TDD)

**Files:**
- Create: `server/features/clients/agentVersionService.js`
- Create: `server/features/clients/agentVersionService.test.js`

**Step 1: 테스트 작성**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseAgentMetaInfoVersion,
  buildAgentMetaInfoKey,
  getBatchAgentVersions,
  _setDeps,
} from './agentVersionService.js'

describe('parseAgentMetaInfoVersion', () => {
  it('extracts version from colon-separated value', () => {
    expect(parseAgentMetaInfoVersion('6.8.5.24:7180:EQP001:192.168.1.10:1'))
      .toBe('6.8.5.24')
  })

  it('returns null for null/empty', () => {
    expect(parseAgentMetaInfoVersion(null)).toBeNull()
    expect(parseAgentMetaInfoVersion('')).toBeNull()
  })

  it('returns full value if no colons', () => {
    expect(parseAgentMetaInfoVersion('7.0.0.0')).toBe('7.0.0.0')
  })
})

describe('buildAgentMetaInfoKey', () => {
  it('creates key in format AgentMetaInfo:process-model', () => {
    expect(buildAgentMetaInfoKey('LINE01', 'MODEL_A'))
      .toBe('AgentMetaInfo:LINE01-MODEL_A')
  })
})

describe('getBatchAgentVersions', () => {
  const mockPipeline = {
    hget: vi.fn().mockReturnThis(),
    exec: vi.fn(),
  }
  const mockRedisClient = {
    pipeline: vi.fn(() => mockPipeline),
  }
  const mockClientModel = { find: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    _setDeps({ redisClient: mockRedisClient, ClientModel: mockClientModel })
  })

  it('returns version from MongoDB when agentVersion.arsAgent exists', async () => {
    mockClientModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1',
            agentVersion: { arsAgent: '7.0.0.0' } },
        ])
      })
    })

    const result = await getBatchAgentVersions(['EQP01'])

    expect(mockRedisClient.pipeline).not.toHaveBeenCalled()
    expect(result.EQP01.arsAgent).toBe('7.0.0.0')
  })

  it('falls back to Redis when MongoDB has no arsAgent version', async () => {
    mockClientModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1', agentVersion: {} },
        ])
      })
    })
    mockPipeline.exec.mockResolvedValue([[null, '6.8.5.24:7180:EQP01:192.168.1.10:1']])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(mockPipeline.hget).toHaveBeenCalledWith('AgentMetaInfo:ARS-M1', 'EQP01')
    expect(result.EQP01.arsAgent).toBe('6.8.5.24')
  })

  it('returns null when neither MongoDB nor Redis has version', async () => {
    mockClientModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
        ])
      })
    })
    mockPipeline.exec.mockResolvedValue([[null, null]])

    const result = await getBatchAgentVersions(['EQP01'])

    expect(result.EQP01.arsAgent).toBeNull()
  })

  it('returns resourceAgent from MongoDB', async () => {
    mockClientModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1',
            agentVersion: { arsAgent: '7.0.0.0', resourceAgent: '1.2.0' } },
        ])
      })
    })

    const result = await getBatchAgentVersions(['EQP01'])

    expect(result.EQP01.arsAgent).toBe('7.0.0.0')
    expect(result.EQP01.resourceAgent).toBe('1.2.0')
  })

  it('handles redisClient unavailable gracefully', async () => {
    _setDeps({ redisClient: null, ClientModel: mockClientModel })
    mockClientModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1' },
        ])
      })
    })

    const result = await getBatchAgentVersions(['EQP01'])

    expect(result.EQP01.arsAgent).toBeNull()
    expect(result.EQP01.resourceAgent).toBeNull()
  })

  it('handles empty eqpIds', async () => {
    const result = await getBatchAgentVersions([])
    expect(result).toEqual({})
  })
})
```

**Step 2: 구현**

```javascript
const { getRedisClient } = require('../../shared/db/redisConnection')
const Client = require('./model')

// Test DI
let deps = {}
function _setDeps(d) { deps = d }

function getClient() {
  return deps.redisClient !== undefined ? deps.redisClient : getRedisClient()
}
function getModel() {
  return deps.ClientModel || Client
}

function buildAgentMetaInfoKey(process, eqpModel) {
  return `AgentMetaInfo:${process}-${eqpModel}`
}

function parseAgentMetaInfoVersion(value) {
  if (value === null || value === undefined || value === '') return null
  const colonIndex = value.indexOf(':')
  return colonIndex === -1 ? value : value.substring(0, colonIndex)
}

async function getBatchAgentVersions(eqpIds) {
  if (!eqpIds || eqpIds.length === 0) return {}

  const ClientModel = getModel()
  const clients = await ClientModel.find({ eqpId: { $in: eqpIds } })
    .select('eqpId process eqpModel agentVersion')
    .lean()

  const clientMap = {}
  for (const c of clients) {
    clientMap[c.eqpId] = c
  }

  const redis = getClient()
  const result = {}

  // MongoDB에서 버전이 없는 eqpId만 Redis 조회 대상으로 수집
  const redisTargets = []
  for (const eqpId of eqpIds) {
    const c = clientMap[eqpId]
    if (!c) {
      result[eqpId] = { arsAgent: null, resourceAgent: null }
      continue
    }

    const mongoArs = c.agentVersion?.arsAgent || null
    const mongoRes = c.agentVersion?.resourceAgent || null

    result[eqpId] = { arsAgent: mongoArs, resourceAgent: mongoRes }

    // arsAgent가 MongoDB에 없으면 Redis 조회 대상
    if (!mongoArs) {
      redisTargets.push({ eqpId, process: c.process, eqpModel: c.eqpModel })
    }
  }

  // Redis 배치 조회 (HGET per target — Pipeline 사용)
  if (redis && redisTargets.length > 0) {
    const pipeline = redis.pipeline()
    for (const t of redisTargets) {
      pipeline.hget(buildAgentMetaInfoKey(t.process, t.eqpModel), t.eqpId)
    }
    const responses = await pipeline.exec()

    for (let i = 0; i < redisTargets.length; i++) {
      const [err, value] = responses[i]
      if (!err && value) {
        result[redisTargets[i].eqpId].arsAgent = parseAgentMetaInfoVersion(value)
      }
    }
  }

  return result
}

module.exports = {
  buildAgentMetaInfoKey,
  parseAgentMetaInfoVersion,
  getBatchAgentVersions,
  _setDeps,
}
```

**핵심:**
- `pipeline()`으로 여러 HGET을 한 번의 RTT로 처리 → Redis 부하 최소화
- MongoDB에 arsAgent 버전이 있으면 Redis를 아예 안 침
- MongoDB에 저장하지 않음 → ARSAgent 버전은 항상 Redis에서 최신 값

**Step 3: 테스트 실행**

```bash
cd server && npx vitest run features/clients/agentVersionService.test.js
```

---

### Task 4: alive-status API에 버전 데이터 포함

**Files:**
- Modify: `server/features/clients/controller.js:416-425`

**Step 1: getBatchAliveStatusHandler에 버전 조회 추가**

현재:
```javascript
async function getBatchAliveStatusHandler(req, res) {
  const { eqpIds } = req.body
  if (!eqpIds || !Array.isArray(eqpIds) || eqpIds.length === 0) {
    throw ApiError.badRequest('eqpIds array is required')
  }
  const statuses = await getBatchAliveStatus(eqpIds)
  res.json(statuses)
}
```

변경:
```javascript
async function getBatchAliveStatusHandler(req, res) {
  const { eqpIds } = req.body
  if (!eqpIds || !Array.isArray(eqpIds) || eqpIds.length === 0) {
    throw ApiError.badRequest('eqpIds array is required')
  }
  const [statuses, versions] = await Promise.all([
    getBatchAliveStatus(eqpIds),
    getBatchAgentVersions(eqpIds),
  ])
  // 버전 데이터를 alive status에 병합
  for (const eqpId of Object.keys(statuses)) {
    statuses[eqpId].agentVersion = versions[eqpId] || { arsAgent: null, resourceAgent: null }
  }
  res.json(statuses)
}
```

**상단 import 추가:**
```javascript
const { getBatchAgentVersions } = require('./agentVersionService')
```

**핵심:** `Promise.all`로 alive-status와 version을 병렬 조회 → 응답 시간 증가 없음.

---

### Task 5: Frontend — 그리드에 Version 컬럼 추가

**Files:**
- Modify: `client/src/features/clients/components/ClientDataGrid.vue`
- Modify: `client/src/features/clients/ClientsView.vue`

**Step 1: ClientsView.vue — aliveStatuses에서 version 데이터 추출**

`ClientsView.vue`에서 `aliveStatuses`에 이미 `agentVersion`이 포함되어 옴.
`clientsWithStatus` computed (또는 그리드에 전달하는 데이터)에 version을 매핑.

`aliveStatuses`가 업데이트되는 곳 (line 219-221):
```javascript
if (result.aliveStatuses) {
  aliveStatuses.value = { ...aliveStatuses.value, ...result.aliveStatuses }
  return
}
```

이미 agentVersion이 포함되어 있으므로 별도 처리 불필요. 그리드 데이터 매핑 시 `aliveStatuses.value[eqpId]?.agentVersion`으로 접근.

**Step 2: ClientDataGrid.vue — versionCellRenderer 추가**

`uptimeCellRenderer` 뒤에 추가:

```javascript
const versionCellRenderer = (params) => {
  const version = params.value
  if (!version) return '<span class="text-gray-400 dark:text-gray-500">---</span>'

  const lines = []
  if (version.arsAgent) {
    lines.push(`<span class="text-blue-600 dark:text-blue-400 font-medium">ARS</span> <span>${version.arsAgent}</span>`)
  }
  if (version.resourceAgent) {
    lines.push(`<span class="text-teal-600 dark:text-teal-400 font-medium">RES</span> <span>${version.resourceAgent}</span>`)
  }
  if (lines.length === 0) return '<span class="text-gray-400 dark:text-gray-500">---</span>'
  return `<div class="leading-tight text-xs font-mono">${lines.join('<br>')}</div>`
}
```

**Step 3: columnDefs에 Version 컬럼 추가**

`osVersion` 컬럼 뒤 (line 290), `status` 컬럼 앞에:

```javascript
{
  field: 'agentVersion',
  headerName: 'Version',
  width: 130,
  cellRenderer: versionCellRenderer,
  sortable: false,
  filter: false,
},
```

**Step 4: 그리드 데이터에 agentVersion 포함**

`ClientsView.vue`에서 그리드에 데이터를 전달할 때 `aliveStatuses`에서 agentVersion을 추출하여 각 row에 매핑. 기존 `serviceStatuses`/`aliveStatuses` 매핑 패턴을 따름.

> **구현 시 확인 필요:** `clientsWithStatus` computed가 있다면 그곳에 `agentVersion: aliveStatuses.value[c.eqpId]?.agentVersion || null` 추가. 없다면 그리드 prop에서 직접 매핑.

---

### Task 6: useConfigManager.js mock 교체

**Files:**
- Modify: `client/src/features/clients/composables/useConfigManager.js`

**Step 1: 하드코딩 mock 제거**

현재 (line 162):
```javascript
agentVersions.value[eqpId] = '6.8.5.24'
```

변경: alive-status 응답에서 받은 `agentVersion.arsAgent`를 사용하도록 수정. `useConfigManager`가 단일 클라이언트 버전을 필요로 하므로, `aliveStatuses`에서 해당 eqpId의 arsAgent 버전을 참조.

```javascript
// agentVersion은 ClientsView의 aliveStatuses에서 전달받음
agentVersions.value[eqpId] = clientAliveStatus?.agentVersion?.arsAgent || ''
```

> **구현 시 확인 필요:** `useConfigManager`가 `aliveStatuses`에 접근할 수 있는지, 아니면 props로 전달해야 하는지 확인. 기존 패턴을 따를 것.

---

### Task 7: K8s ConfigMap 확인

**Files:**
- Modify: `k8s/configmap.yaml` (REDIS_URL이 DB 0으로 설정되어 있는지 확인)

**변경 사항:**
- 기존 `REDIS_URL`이 이미 DB 0(`/0`)을 사용하므로 별도 추가 불필요
- 코멘트 업데이트: `# Redis (headless 서비스 DNS — Agent Status + MetaInfo, DB 0)`

---

## 조회 흐름 요약

```
GET /api/clients/alive-status { eqpIds: [...] }
  │
  ├─ getBatchAliveStatus(eqpIds)     ← Redis DB 0 (기존)
  │   → { EQP01: { alive, uptimeSeconds, health, uptimeFormatted } }
  │
  ├─ getBatchAgentVersions(eqpIds)   ← MongoDB first → Redis DB 0 fallback
  │   │
  │   ├─ MongoDB: SELECT eqpId, process, eqpModel, agentVersion
  │   │   ├─ agentVersion.arsAgent 있음 → 사용 (Redis 안 침)
  │   │   └─ agentVersion.arsAgent 없음 → Redis 조회 대상
  │   │
  │   ├─ Redis DB 0: pipeline HGET AgentMetaInfo:{process}-{model} {eqpId}
  │   │   └─ split(':')[0] → arsAgent version (MongoDB에 저장 안 함)
  │   │
  │   └─ agentVersion.resourceAgent → MongoDB에서만 (Phase 3)
  │
  └─ 응답 병합:
     { EQP01: { alive, uptimeSeconds, ..., agentVersion: { arsAgent, resourceAgent } } }
```
