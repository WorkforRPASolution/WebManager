# Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 기능 안전성을 보장하면서 코드 품질 개선 (중복 제거, 유틸 추출, 구조 분리)

**Architecture:** Bottom-up 4-Phase 접근. 순수 유틸 추출 → 서비스 중복 제거 → 프론트엔드 정리 → 구조 리팩토링. 각 Phase는 테스트 게이트 통과 필수.

**Tech Stack:** Node.js (Express), Vue.js 3 (Composition API), Vitest, MongoDB, Redis (ioredis)

**Design Doc:** `docs/plans/2026-03-10-refactoring-design.md`

---

# Phase 1: 순수 유틸 추출 + Critical 수정

## Task 1-1: `redis.mget` spread → 배열 형태로 변경

**Files:**
- Modify: `server/features/clients/agentAliveService.js:118`
- Modify: `server/features/clients/agentAliveService.test.js` (assertion 수정)

**Step 1: 테스트 assertion을 배열 형태로 변경**

`agentAliveService.test.js`에서 `mget` assertion을 variadic → 배열로 변경:

```javascript
// 변경 전 (line 133-138)
expect(mockRedis.mget).toHaveBeenCalledWith(
  'AgentHealth:ars_agent:ARS-M1-EQP01',
  'AgentHealth:ars_agent:ARS-M2-EQP02',
  'AgentRunning:ARS-M1-EQP01',
  'AgentRunning:ARS-M2-EQP02'
)

// 변경 후
expect(mockRedis.mget).toHaveBeenCalledWith([
  'AgentHealth:ars_agent:ARS-M1-EQP01',
  'AgentHealth:ars_agent:ARS-M2-EQP02',
  'AgentRunning:ARS-M1-EQP01',
  'AgentRunning:ARS-M2-EQP02',
])
```

같은 패턴으로 `resource_agent` 테스트도 수정 (line 215-218):

```javascript
// 변경 전
expect(mockRedis.mget).toHaveBeenCalledWith(
  'AgentHealth:resource_agent:ARS-M1-EQP01',
  'AgentHealth:resource_agent:ARS-M2-EQP02'
)

// 변경 후
expect(mockRedis.mget).toHaveBeenCalledWith([
  'AgentHealth:resource_agent:ARS-M1-EQP01',
  'AgentHealth:resource_agent:ARS-M2-EQP02',
])
```

**Step 2: 테스트 실행 → FAIL 확인**

```bash
cd server && npx vitest run agentAliveService.test.js
```
Expected: FAIL — 아직 구현이 spread 형태이므로 assertion 불일치

**Step 3: 구현 수정**

`agentAliveService.js` line 118:

```javascript
// 변경 전
values = await redis.mget(...validKeys)

// 변경 후
values = await redis.mget(validKeys)
```

**Step 4: 테스트 실행 → PASS 확인**

```bash
cd server && npx vitest run agentAliveService.test.js
```
Expected: 23 tests PASS

**Step 5: 전체 서버 테스트**

```bash
cd server && npm test
```
Expected: 207 tests PASS

**Step 6: Commit**

```bash
git add server/features/clients/agentAliveService.js server/features/clients/agentAliveService.test.js
git commit -m "fix: redis.mget spread를 배열 형태로 변경 (V8 인자 제한 방지)"
```

---

## Task 1-2: `classifyServiceState()` 유틸 추출

**Files:**
- Create: `client/src/features/clients/utils/serviceState.js`
- Create: `client/src/features/clients/utils/__tests__/serviceState.test.js`

**Step 1: 테스트 작성**

`client/src/features/clients/utils/__tests__/serviceState.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { classifyServiceState } from '../serviceState.js'

describe('classifyServiceState', () => {
  it('returns "unknown" for null/undefined input', () => {
    expect(classifyServiceState(null)).toBe('unknown')
    expect(classifyServiceState(undefined)).toBe('unknown')
  })

  it('returns "loading" when loading is true', () => {
    expect(classifyServiceState({ loading: true })).toBe('loading')
  })

  it('returns "unknown" when error exists', () => {
    expect(classifyServiceState({ error: 'some error' })).toBe('unknown')
  })

  it('returns "unreachable" for UNREACHABLE state', () => {
    expect(classifyServiceState({ state: 'UNREACHABLE' })).toBe('unreachable')
  })

  it('returns "not_installed" for NOT_INSTALLED state', () => {
    expect(classifyServiceState({ state: 'NOT_INSTALLED' })).toBe('not_installed')
  })

  it('returns "running" when running is true', () => {
    expect(classifyServiceState({ running: true })).toBe('running')
    expect(classifyServiceState({ running: true, state: 'RUNNING' })).toBe('running')
  })

  it('returns "stopped" when running is false', () => {
    expect(classifyServiceState({ running: false })).toBe('stopped')
    expect(classifyServiceState({ running: false, state: 'STOPPED' })).toBe('stopped')
  })

  it('returns "unknown" for ambiguous data', () => {
    expect(classifyServiceState({})).toBe('unknown')
    expect(classifyServiceState({ state: 'SOME_OTHER' })).toBe('unknown')
  })
})
```

**Step 2: 테스트 실행 → FAIL 확인**

```bash
cd client && npx vitest run src/features/clients/utils/__tests__/serviceState.test.js
```
Expected: FAIL — 모듈이 아직 없음

**Step 3: 구현 작성**

`client/src/features/clients/utils/serviceState.js`:

```javascript
/**
 * 4-state 서비스 상태 분류 순수 함수
 * @param {object|null|undefined} serviceStatus - { running, state, loading, error }
 * @returns {'running'|'stopped'|'unreachable'|'not_installed'|'loading'|'unknown'}
 */
export function classifyServiceState(serviceStatus) {
  if (!serviceStatus) return 'unknown'
  if (serviceStatus.loading === true) return 'loading'
  if (serviceStatus.error) return 'unknown'
  if (serviceStatus.state === 'UNREACHABLE') return 'unreachable'
  if (serviceStatus.state === 'NOT_INSTALLED') return 'not_installed'
  if (serviceStatus.running === true) return 'running'
  if (serviceStatus.running === false) return 'stopped'
  return 'unknown'
}
```

**Step 4: 테스트 실행 → PASS 확인**

```bash
cd client && npx vitest run src/features/clients/utils/__tests__/serviceState.test.js
```
Expected: 8 tests PASS

**Step 5: Commit**

```bash
git add client/src/features/clients/utils/serviceState.js client/src/features/clients/utils/__tests__/serviceState.test.js
git commit -m "feat: classifyServiceState() 4-state 분류 유틸 추출"
```

---

## Task 1-3: `isFtpNotFoundError()` 유틸 추출

**Files:**
- Create: `server/shared/utils/ftpErrors.js`
- Create: `server/shared/utils/ftpErrors.test.js`

**Step 1: 테스트 작성**

`server/shared/utils/ftpErrors.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { isFtpNotFoundError } from './ftpErrors.js'

describe('isFtpNotFoundError', () => {
  it('returns true for error with code 550', () => {
    const err = new Error('file not found')
    err.code = 550
    expect(isFtpNotFoundError(err)).toBe(true)
  })

  it('returns true for error message containing "No such file"', () => {
    const err = new Error('550 No such file or directory')
    expect(isFtpNotFoundError(err)).toBe(true)
  })

  it('returns false for other errors', () => {
    const err = new Error('Connection refused')
    err.code = 421
    expect(isFtpNotFoundError(err)).toBe(false)
  })

  it('returns false for error without code or message', () => {
    const err = new Error()
    expect(isFtpNotFoundError(err)).toBe(false)
  })

  it('handles null/undefined gracefully', () => {
    expect(isFtpNotFoundError(null)).toBe(false)
    expect(isFtpNotFoundError(undefined)).toBe(false)
  })
})
```

**Step 2: 테스트 실행 → FAIL 확인**

```bash
cd server && npx vitest run shared/utils/ftpErrors.test.js
```
Expected: FAIL

**Step 3: 구현 작성**

`server/shared/utils/ftpErrors.js`:

```javascript
/**
 * FTP 550 (파일 없음) 에러인지 판별
 * @param {Error|null} err
 * @returns {boolean}
 */
function isFtpNotFoundError(err) {
  if (!err) return false
  return err.code === 550 || (err.message && err.message.includes('No such file'))
}

module.exports = { isFtpNotFoundError }
```

**Step 4: 테스트 실행 → PASS 확인**

```bash
cd server && npx vitest run shared/utils/ftpErrors.test.js
```
Expected: 5 tests PASS

**Step 5: 전체 서버 테스트**

```bash
cd server && npm test
```
Expected: 기존 207 + 신규 5 = 212 tests PASS

**Step 6: Commit**

```bash
git add server/shared/utils/ftpErrors.js server/shared/utils/ftpErrors.test.js
git commit -m "feat: isFtpNotFoundError() FTP 550 판별 유틸 추출"
```

---

## Task 1-4: `parseCommaSeparated()` 유틸 추출

**Files:**
- Create: `server/shared/utils/parseUtils.js`
- Create: `server/shared/utils/parseUtils.test.js`

**Step 1: 테스트 작성**

`server/shared/utils/parseUtils.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { parseCommaSeparated } from './parseUtils.js'

describe('parseCommaSeparated', () => {
  it('splits comma-separated string and trims', () => {
    expect(parseCommaSeparated('a, b, c')).toEqual(['a', 'b', 'c'])
  })

  it('filters empty strings', () => {
    expect(parseCommaSeparated('a,,b,  ,c')).toEqual(['a', 'b', 'c'])
  })

  it('returns null for null/undefined/empty', () => {
    expect(parseCommaSeparated(null)).toBeNull()
    expect(parseCommaSeparated(undefined)).toBeNull()
    expect(parseCommaSeparated('')).toBeNull()
  })

  it('returns single-element array for no-comma string', () => {
    expect(parseCommaSeparated('hello')).toEqual(['hello'])
  })
})
```

**Step 2: 테스트 실행 → FAIL 확인**

```bash
cd server && npx vitest run shared/utils/parseUtils.test.js
```
Expected: FAIL

**Step 3: 구현 작성**

`server/shared/utils/parseUtils.js`:

```javascript
/**
 * 콤마로 구분된 문자열을 배열로 파싱 (trim + 빈 문자열 필터)
 * @param {string|null|undefined} value
 * @returns {string[]|null}
 */
function parseCommaSeparated(value) {
  if (!value) return null
  const result = value.split(',').map(s => s.trim()).filter(s => s)
  return result.length > 0 ? result : null
}

module.exports = { parseCommaSeparated }
```

**Step 4: 테스트 실행 → PASS 확인**

```bash
cd server && npx vitest run shared/utils/parseUtils.test.js
```
Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add server/shared/utils/parseUtils.js server/shared/utils/parseUtils.test.js
git commit -m "feat: parseCommaSeparated() 콤마 구분 파싱 유틸 추출"
```

---

## Task 1-5: `deepMerge` → `shared/utils/mergeUtils.js`로 이동

**Files:**
- Create: `server/shared/utils/mergeUtils.js`
- Create: `server/shared/utils/mergeUtils.test.js`
- Modify: `server/features/clients/ftpService.js` — `deepMerge` 함수 제거, import로 교체

**Step 1: 테스트 작성**

`server/shared/utils/mergeUtils.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { deepMerge } from './mergeUtils.js'

describe('deepMerge', () => {
  it('merges flat objects', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })

  it('overwrites primitive values', () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 })
  })

  it('deep merges nested objects', () => {
    const target = { a: { x: 1, y: 2 } }
    const source = { a: { y: 3, z: 4 } }
    expect(deepMerge(target, source)).toEqual({ a: { x: 1, y: 3, z: 4 } })
  })

  it('replaces arrays (no merge)', () => {
    const target = { a: [1, 2] }
    const source = { a: [3, 4, 5] }
    expect(deepMerge(target, source)).toEqual({ a: [3, 4, 5] })
  })

  it('does not mutate target', () => {
    const target = { a: { x: 1 } }
    const source = { a: { y: 2 } }
    const result = deepMerge(target, source)
    expect(target).toEqual({ a: { x: 1 } })
    expect(result).toEqual({ a: { x: 1, y: 2 } })
  })

  it('deep clones source values', () => {
    const source = { a: { nested: [1, 2] } }
    const result = deepMerge({}, source)
    result.a.nested.push(3)
    expect(source.a.nested).toEqual([1, 2])
  })

  it('handles null source values', () => {
    expect(deepMerge({ a: 1 }, { a: null })).toEqual({ a: null })
  })
})
```

**Step 2: 테스트 실행 → FAIL 확인**

```bash
cd server && npx vitest run shared/utils/mergeUtils.test.js
```
Expected: FAIL

**Step 3: 구현 작성**

`server/shared/utils/mergeUtils.js`:

```javascript
/**
 * 깊은 객체 병합 (배열은 대체, 중첩 객체는 재귀 병합)
 * target을 변경하지 않고 새 객체를 반환
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function deepMerge(target, source) {
  const result = { ...target }
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key]) &&
        typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], source[key])
    } else {
      result[key] = JSON.parse(JSON.stringify(source[key]))
    }
  }
  return result
}

module.exports = { deepMerge }
```

**Step 4: 테스트 실행 → PASS 확인**

```bash
cd server && npx vitest run shared/utils/mergeUtils.test.js
```
Expected: 7 tests PASS

**Step 5: `ftpService.js`에서 로컬 `deepMerge` 제거, import로 교체**

`ftpService.js`에서:
- 상단에 `const { deepMerge } = require('../../shared/utils/mergeUtils')` 추가
- 기존 `function deepMerge(target, source) { ... }` 함수 전체 삭제

**Step 6: 전체 서버 테스트**

```bash
cd server && npm test
```
Expected: 기존 207 + 신규 16 = 223+ tests PASS

**Step 7: Commit**

```bash
git add server/shared/utils/mergeUtils.js server/shared/utils/mergeUtils.test.js server/features/clients/ftpService.js
git commit -m "refactor: deepMerge를 shared/utils/mergeUtils.js로 이동"
```

---

## Phase 1 Gate Check

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS (기존 207 + 신규 유틸 ~16)

---

# Phase 2: 서비스 레이어 중복 제거 + 버그 수정

## Task 2-1: `getAliveStatusWithVersions()` 헬퍼 추출

**Files:**
- Create: `server/features/clients/aliveStatusHelper.js`
- Create: `server/features/clients/aliveStatusHelper.test.js`
- Modify: `server/features/clients/controller.js:399-406, 430-437`

**Step 1: 테스트 작성**

`server/features/clients/aliveStatusHelper.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAliveStatusWithVersions, _setDeps } from './aliveStatusHelper.js'

describe('getAliveStatusWithVersions', () => {
  const mockGetBatchAliveStatus = vi.fn()
  const mockGetBatchAgentVersions = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    _setDeps({
      getBatchAliveStatus: mockGetBatchAliveStatus,
      getBatchAgentVersions: mockGetBatchAgentVersions,
    })
  })

  it('merges alive statuses with agent versions', async () => {
    mockGetBatchAliveStatus.mockResolvedValue({
      EQP01: { alive: true, uptimeSeconds: 3600 },
      EQP02: { alive: false },
    })
    mockGetBatchAgentVersions.mockResolvedValue({
      EQP01: { arsAgent: '1.0', resourceAgent: '2.0' },
    })

    const result = await getAliveStatusWithVersions(['EQP01', 'EQP02'], 'ars_agent')

    expect(result.EQP01.alive).toBe(true)
    expect(result.EQP01.agentVersion).toEqual({ arsAgent: '1.0', resourceAgent: '2.0' })
    expect(result.EQP02.agentVersion).toEqual({ arsAgent: null, resourceAgent: null })
  })

  it('calls both services in parallel', async () => {
    mockGetBatchAliveStatus.mockResolvedValue({})
    mockGetBatchAgentVersions.mockResolvedValue({})

    await getAliveStatusWithVersions(['EQP01'], 'ars_agent')

    expect(mockGetBatchAliveStatus).toHaveBeenCalledWith(['EQP01'], 'ars_agent')
    expect(mockGetBatchAgentVersions).toHaveBeenCalledWith(['EQP01'])
  })
})
```

**Step 2: 테스트 실행 → FAIL**

```bash
cd server && npx vitest run features/clients/aliveStatusHelper.test.js
```

**Step 3: 구현 작성**

`server/features/clients/aliveStatusHelper.js`:

```javascript
const { getBatchAliveStatus } = require('./agentAliveService')
const { getBatchAgentVersions } = require('./agentVersionService')

let deps = {}
function _setDeps(d) { deps = d }

function getAlive() {
  return deps.getBatchAliveStatus || getBatchAliveStatus
}
function getVersions() {
  return deps.getBatchAgentVersions || getBatchAgentVersions
}

async function getAliveStatusWithVersions(eqpIds, agentGroup) {
  const [statuses, versions] = await Promise.all([
    getAlive()(eqpIds, agentGroup),
    getVersions()(eqpIds),
  ])

  for (const eqpId of Object.keys(statuses)) {
    statuses[eqpId].agentVersion = versions[eqpId] || { arsAgent: null, resourceAgent: null }
  }

  return statuses
}

module.exports = { getAliveStatusWithVersions, _setDeps }
```

**Step 4: 테스트 실행 → PASS**

```bash
cd server && npx vitest run features/clients/aliveStatusHelper.test.js
```

**Step 5: `controller.js`에서 중복 merge 로직을 헬퍼로 교체**

`controller.js` 상단에 import 추가:
```javascript
const { getAliveStatusWithVersions } = require('./aliveStatusHelper')
```

`handleBatchActionStream` (lines 399-406) 교체:
```javascript
// 변경 전
const [aliveStatuses, agentVersions] = await Promise.all([
  getBatchAliveStatus(eqpIds, agentGroup),
  getBatchAgentVersions(eqpIds),
])
for (const eqpId of Object.keys(aliveStatuses)) {
  aliveStatuses[eqpId].agentVersion = agentVersions[eqpId] || { arsAgent: null, resourceAgent: null }
}
sse.send({ aliveStatuses })

// 변경 후
const aliveStatuses = await getAliveStatusWithVersions(eqpIds, agentGroup)
sse.send({ aliveStatuses })
```

`getBatchAliveStatusHandler` (lines 430-437) 교체:
```javascript
// 변경 전
const [statuses, versions] = await Promise.all([
  getBatchAliveStatus(eqpIds, agentGroup),
  getBatchAgentVersions(eqpIds),
])
for (const eqpId of Object.keys(statuses)) {
  statuses[eqpId].agentVersion = versions[eqpId] || { arsAgent: null, resourceAgent: null }
}
res.json(statuses)

// 변경 후
const statuses = await getAliveStatusWithVersions(eqpIds, agentGroup)
res.json(statuses)
```

기존 `getBatchAliveStatus`, `getBatchAgentVersions` import가 더 이상 controller에서 직접 사용되지 않으면 제거.

**Step 6: 전체 서버 테스트**

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS

**Step 7: Commit**

```bash
git add server/features/clients/aliveStatusHelper.js server/features/clients/aliveStatusHelper.test.js server/features/clients/controller.js
git commit -m "refactor: getAliveStatusWithVersions() 헬퍼 추출로 controller 중복 제거"
```

---

## Task 2-2: MongoDB 중복 조회 통합

**Files:**
- Create: `server/features/clients/clientInfoBatch.js`
- Create: `server/features/clients/clientInfoBatch.test.js`
- Modify: `server/features/clients/agentAliveService.js` — 직접 MongoDB 쿼리 → 외부 주입 받기
- Modify: `server/features/clients/agentVersionService.js` — 직접 MongoDB 쿼리 → 외부 주입 받기
- Modify: `server/features/clients/aliveStatusHelper.js` — 공유 조회 후 양쪽에 전달

**Step 1: 테스트 작성**

`server/features/clients/clientInfoBatch.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getClientInfoBatch, _setDeps } from './clientInfoBatch.js'

describe('getClientInfoBatch', () => {
  const mockModel = { find: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    _setDeps({ ClientModel: mockModel })
  })

  it('returns map of eqpId → client info', async () => {
    mockModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { eqpId: 'EQP01', process: 'ARS', eqpModel: 'M1', agentVersion: { arsAgent: '1.0' } },
          { eqpId: 'EQP02', process: 'ARS', eqpModel: 'M2', agentVersion: null },
        ])
      })
    })

    const result = await getClientInfoBatch(['EQP01', 'EQP02'])
    expect(result.EQP01.process).toBe('ARS')
    expect(result.EQP01.agentVersion.arsAgent).toBe('1.0')
    expect(result.EQP02.eqpModel).toBe('M2')
  })

  it('queries with superset fields (process, eqpModel, agentVersion)', async () => {
    mockModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([])
      })
    })

    await getClientInfoBatch(['EQP01'])
    expect(mockModel.find).toHaveBeenCalledWith({ eqpId: { $in: ['EQP01'] } })
  })

  it('returns empty map for empty input', async () => {
    const result = await getClientInfoBatch([])
    expect(result).toEqual({})
  })
})
```

**Step 2: 테스트 실행 → FAIL**

```bash
cd server && npx vitest run features/clients/clientInfoBatch.test.js
```

**Step 3: 구현 작성**

`server/features/clients/clientInfoBatch.js`:

```javascript
const Client = require('./model')

let deps = {}
function _setDeps(d) { deps = d }
function getModel() { return deps.ClientModel || Client }

/**
 * eqpIds에 해당하는 클라이언트 정보를 한 번에 조회
 * agentAliveService + agentVersionService 양쪽에서 필요한 필드를 모두 포함
 * @param {string[]} eqpIds
 * @returns {Promise<Object.<string, {eqpId, process, eqpModel, agentVersion}>>}
 */
async function getClientInfoBatch(eqpIds) {
  if (!eqpIds || eqpIds.length === 0) return {}

  const ClientModel = getModel()
  const clients = await ClientModel.find({ eqpId: { $in: eqpIds } })
    .select('eqpId process eqpModel agentVersion')
    .lean()

  const map = {}
  for (const c of clients) {
    map[c.eqpId] = c
  }
  return map
}

module.exports = { getClientInfoBatch, _setDeps }
```

**Step 4: 테스트 실행 → PASS**

```bash
cd server && npx vitest run features/clients/clientInfoBatch.test.js
```

**Step 5: `agentAliveService.js` 수정**

`getBatchAliveStatus`에 optional `clientInfoMap` 파라미터 추가:

```javascript
// 변경 전
async function getBatchAliveStatus(eqpIds, agentGroup) {
  // ...
  const ClientModel = getModel()
  const clients = await ClientModel.find({ eqpId: { $in: eqpIds } })
    .select('eqpId process eqpModel')
    .lean()
  const clientMap = {}
  for (const c of clients) { clientMap[c.eqpId] = c }

// 변경 후
async function getBatchAliveStatus(eqpIds, agentGroup, clientInfoMap) {
  // ...
  const clientMap = clientInfoMap || await _fetchClientMap(eqpIds)

// _fetchClientMap은 기존 MongoDB 로직을 유지 (하위 호환)
async function _fetchClientMap(eqpIds) {
  const ClientModel = getModel()
  const clients = await ClientModel.find({ eqpId: { $in: eqpIds } })
    .select('eqpId process eqpModel')
    .lean()
  const map = {}
  for (const c of clients) { map[c.eqpId] = c }
  return map
}
```

**Step 6: `agentVersionService.js` 수정**

동일한 패턴으로 `getBatchAgentVersions(eqpIds, clientInfoMap)` optional 파라미터 추가.

**Step 7: `aliveStatusHelper.js` 수정**

```javascript
const { getClientInfoBatch } = require('./clientInfoBatch')

async function getAliveStatusWithVersions(eqpIds, agentGroup) {
  const clientInfoMap = await getClientInfoBatch(eqpIds)
  const [statuses, versions] = await Promise.all([
    getAlive()(eqpIds, agentGroup, clientInfoMap),
    getVersions()(eqpIds, clientInfoMap),
  ])
  // ... merge logic
}
```

**Step 8: 기존 테스트 수정 및 전체 테스트**

기존 `agentAliveService.test.js`와 `agentVersionService.test.js`에서:
- `clientInfoMap`을 전달하지 않는 테스트 → 기존 동작 유지 (하위 호환)
- `clientInfoMap`을 전달하는 새 테스트 추가

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS

**Step 9: Commit**

```bash
git add server/features/clients/clientInfoBatch.js server/features/clients/clientInfoBatch.test.js \
  server/features/clients/agentAliveService.js server/features/clients/agentAliveService.test.js \
  server/features/clients/agentVersionService.js server/features/clients/agentVersionService.test.js \
  server/features/clients/aliveStatusHelper.js
git commit -m "perf: MongoDB 중복 조회 통합 — getClientInfoBatch()로 1회 조회"
```

---

## Task 2-3: `agentGroup` 검증 추가

**Files:**
- Modify: `server/features/clients/controller.js:423-424`

**Step 1: 구현 (간단한 1줄 추가)**

`controller.js`의 `getBatchAliveStatusHandler` 함수에서:

```javascript
// 변경 전
async function getBatchAliveStatusHandler(req, res) {
  const { eqpIds, agentGroup } = req.body

  if (!eqpIds || !Array.isArray(eqpIds) || eqpIds.length === 0) {
    throw ApiError.badRequest('eqpIds array is required')
  }

// 변경 후
async function getBatchAliveStatusHandler(req, res) {
  const { eqpIds, agentGroup } = req.body

  if (!eqpIds || !Array.isArray(eqpIds) || eqpIds.length === 0) {
    throw ApiError.badRequest('eqpIds array is required')
  }
  if (!agentGroup) {
    throw ApiError.badRequest('agentGroup is required')
  }
```

**Step 2: 전체 서버 테스트**

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS

**Step 3: Commit**

```bash
git add server/features/clients/controller.js
git commit -m "fix: getBatchAliveStatusHandler에 agentGroup 필수 검증 추가"
```

---

## Task 2-4: `getClientIpInfo()` 통합

**Files:**
- Create: `server/features/clients/clientRepository.js`
- Modify: `server/features/clients/controlService.js` — 로컬 `getClientIpInfo` 제거, import로 교체
- Modify: `server/features/clients/ftpService.js` — 로컬 `getClientIpInfo` 제거, import로 교체

**Step 1: 구현**

`server/features/clients/clientRepository.js`:

```javascript
const Client = require('./model')

/**
 * 클라이언트 IP 및 포트 정보 조회 (controlService + ftpService 공용)
 * ftpService는 eqpModel도 필요하므로 superset 필드를 조회
 */
async function getClientIpInfo(eqpId) {
  const client = await Client.findOne({ eqpId })
    .select('ipAddr ipAddrL eqpModel agentPorts')
    .lean()
  if (!client) {
    throw new Error(`Client not found: ${eqpId}`)
  }
  return {
    ipAddr: client.ipAddr,
    ipAddrL: client.ipAddrL || null,
    eqpModel: client.eqpModel,
    agentPorts: client.agentPorts || null,
  }
}

module.exports = { getClientIpInfo }
```

**Step 2: `controlService.js` 수정**

```javascript
// 상단 import 추가
const { getClientIpInfo } = require('./clientRepository')
// 로컬 getClientIpInfo 함수 삭제 (lines 19-34)
```

**Step 3: `ftpService.js` 수정**

```javascript
// 상단 import 추가
const { getClientIpInfo } = require('./clientRepository')
// 로컬 getClientIpInfo 함수 삭제 (lines 30-39)
```

**Step 4: 전체 서버 테스트**

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS (controlService 12개 + configBackupService 25개 포함)

**Step 5: Commit**

```bash
git add server/features/clients/clientRepository.js server/features/clients/controlService.js server/features/clients/ftpService.js
git commit -m "refactor: getClientIpInfo() 공유 clientRepository로 통합"
```

---

## Task 2-5: 미사용 `writeConfigFile` 삭제

**Files:**
- Modify: `server/features/clients/ftpService.js` — `writeConfigFile` 함수 삭제, `module.exports`에서 제거

**Step 1: 호출처 없음 확인**

```bash
cd server && grep -r "writeConfigFile" --include="*.js" .
```
Expected: `ftpService.js` 선언과 export만 나오고, 호출은 없음

**Step 2: 함수 및 export 삭제**

`ftpService.js`에서 `writeConfigFile` 함수(lines 139-153)와 `module.exports`의 `writeConfigFile` 항목 삭제.

**Step 3: 전체 서버 테스트**

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS

**Step 4: Commit**

```bash
git add server/features/clients/ftpService.js
git commit -m "refactor: 미사용 writeConfigFile 삭제 (writeConfigWithBackup으로 대체됨)"
```

---

## Task 2-6: `isFtpNotFoundError()` 4곳에 적용

**Files:**
- Modify: `server/features/clients/ftpService.js:181-182`
- Modify: `server/features/clients/configBackupService.js:101-102, 150-152`
- Modify: `server/features/clients/configController.js:210` (있다면)

**Step 1: 각 파일 상단에 import 추가**

```javascript
const { isFtpNotFoundError } = require('../../shared/utils/ftpErrors')
```

**Step 2: 인라인 체크를 유틸 호출로 교체**

```javascript
// 변경 전
if (err.code === 550 || err.message?.includes('No such file')) {

// 변경 후
if (isFtpNotFoundError(err)) {
```

**Step 3: 전체 서버 테스트**

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS (특히 configBackupService 25개)

**Step 4: Commit**

```bash
git add server/features/clients/ftpService.js server/features/clients/configBackupService.js server/features/clients/configController.js
git commit -m "refactor: FTP 550 에러 판별을 isFtpNotFoundError() 유틸로 통일"
```

---

## Task 2-7: `parseCommaSeparated()` 3곳에 적용

**Files:**
- Modify: `server/features/clients/controller.js` — 3곳의 인라인 파싱을 유틸 호출로 교체

**Step 1: 상단에 import 추가**

```javascript
const { parseCommaSeparated } = require('../../shared/utils/parseUtils')
```

**Step 2: 3곳 교체**

```javascript
// 변경 전 (lines 33-35, 55-57, 257-259)
const userProcessesArray = userProcesses
  ? userProcesses.split(',').map(p => p.trim()).filter(p => p)
  : null

// 변경 후
const userProcessesArray = parseCommaSeparated(userProcesses)
```

**Step 3: 전체 서버 테스트**

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS

**Step 4: Commit**

```bash
git add server/features/clients/controller.js
git commit -m "refactor: userProcesses 파싱을 parseCommaSeparated() 유틸로 통일"
```

---

## Task 2-8: Redis 상태 체크 `isRedisAvailable()` 사용

**Files:**
- Modify: `server/features/clients/agentAliveService.js`
- Modify: `server/features/clients/agentVersionService.js`
- Modify: `server/features/clients/agentAliveService.test.js` (Redis 비정상 상태 테스트 추가)

**Step 1: 테스트 추가**

`agentAliveService.test.js`에 새 테스트 추가:

```javascript
it('returns redisUnavailable when redis exists but status is not ready', async () => {
  _setDeps({
    redisClient: { status: 'connecting' },  // 비정상 상태
    isRedisAvailable: false,
    ClientModel: mockClientModel,
  })
  const result = await getBatchAliveStatus(['EQP01'], 'ars_agent')
  expect(result.EQP01.alive).toBeNull()
  expect(result.EQP01.redisUnavailable).toBe(true)
})
```

**Step 2: 테스트 실행 → FAIL**

```bash
cd server && npx vitest run agentAliveService.test.js
```

**Step 3: 구현 수정**

`agentAliveService.js`:

```javascript
// 변경 전
const { getRedisClient } = require('../../shared/db/redisConnection')
// ...
function getClient() {
  return deps.redisClient !== undefined ? deps.redisClient : getRedisClient()
}

// 변경 후
const { getRedisClient, isRedisAvailable } = require('../../shared/db/redisConnection')
// ...
function isAvailable() {
  if (deps.isRedisAvailable !== undefined) return deps.isRedisAvailable
  return isRedisAvailable()
}
function getClient() {
  return deps.redisClient !== undefined ? deps.redisClient : getRedisClient()
}
```

그리고 `getBatchAliveStatus`에서:

```javascript
// 변경 전
const redis = getClient()
if (!redis) {

// 변경 후
if (!isAvailable()) {
```

단, `mget` 호출 시에는 여전히 `getClient()`로 Redis 인스턴스를 가져옴.

`agentVersionService.js`에도 동일한 패턴 적용.

**Step 4: 테스트 실행 → PASS**

```bash
cd server && npx vitest run agentAliveService.test.js
cd server && npx vitest run agentVersionService.test.js
```

**Step 5: 전체 서버 테스트**

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS

**Step 6: Commit**

```bash
git add server/features/clients/agentAliveService.js server/features/clients/agentAliveService.test.js \
  server/features/clients/agentVersionService.js server/features/clients/agentVersionService.test.js
git commit -m "fix: Redis 상태 체크를 isRedisAvailable()로 개선 (connecting 상태 대응)"
```

---

## Phase 2 Gate Check

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS

---

# Phase 3: 프론트엔드 정리 + dead code 제거

## Task 3-1: `classifyServiceState()` 3곳에 적용

**Files:**
- Modify: `client/src/features/clients/components/ClientDataGrid.vue` — `serviceCellRenderer`
- Modify: `client/src/features/clients/components/service-status/ArsAgentStatus.vue` — `stateConfig`
- Modify: `client/src/features/clients/ClientsView.vue` — `statusCounts`, `handleSelectByStatus`

**Step 1: `ClientDataGrid.vue` — serviceCellRenderer 리팩토링**

```javascript
import { classifyServiceState } from '../utils/serviceState.js'

// serviceCellRenderer에서 classifyServiceState 사용
const serviceCellRenderer = (params) => {
  const value = params.value
  const state = classifyServiceState(value)

  const configs = {
    loading: { icon: '<span class="inline-block w-3 h-3 mr-1.5 border-2 border-gray-300 dark:border-gray-600 border-t-gray-500 dark:border-t-gray-400 rounded-full" style="animation: spin 1s linear infinite;"></span>', label: 'Loading...', cls: 'text-gray-400 dark:text-gray-500' },
    unreachable: { icon: '<span class="w-2 h-2 mr-1.5 rounded-full bg-gray-400"></span>', label: 'Unreachable', cls: 'text-gray-500 dark:text-gray-400 font-medium' },
    not_installed: { icon: '<span class="w-2 h-2 mr-1.5 rounded-full bg-amber-500"></span>', label: 'Not Installed', cls: 'text-amber-600 dark:text-amber-400 font-medium' },
    running: { icon: '<span class="w-2 h-2 mr-1.5 rounded-full bg-green-500 animate-pulse"></span>', label: 'Running', cls: 'text-green-600 dark:text-green-400 font-medium' },
    stopped: { icon: '<span class="w-2 h-2 mr-1.5 rounded-full bg-red-500"></span>', label: 'Stopped', cls: 'text-red-600 dark:text-red-400 font-medium' },
    unknown: { icon: '<span class="mr-1.5">&#8213;</span>', label: 'Unknown', cls: 'text-gray-400 dark:text-gray-500' },
  }

  const cfg = configs[state]
  return `<span class="inline-flex items-center text-xs ${cfg.cls}">${cfg.icon} ${cfg.label}</span>`
}
```

**Step 2: `ArsAgentStatus.vue` — stateConfig 리팩토링**

```javascript
import { classifyServiceState } from '../../utils/serviceState.js'

const stateConfig = computed(() => {
  const state = classifyServiceState(props.data)
  const configs = {
    unreachable: { bg: 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-dark-border', dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400', label: 'UNREACHABLE', pulse: false },
    not_installed: { bg: 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', label: 'NOT_INSTALLED', pulse: false },
    running: { bg: 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400', label: props.data?.state || 'RUNNING', pulse: true },
    stopped: { bg: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400', label: props.data?.state || 'STOPPED', pulse: false },
  }
  return configs[state] || null
})
```

**Step 3: `ClientsView.vue` — statusCounts + handleSelectByStatus 리팩토링**

```javascript
import { classifyServiceState } from './utils/serviceState.js'

const statusCounts = computed(() => {
  const counts = { running: 0, stopped: 0, unreachable: 0, notInstalled: 0 }
  clientsWithStatus.value.forEach(client => {
    const state = classifyServiceState(client.serviceStatus)
    if (state === 'unreachable') counts.unreachable++
    else if (state === 'not_installed') counts.notInstalled++
    else if (state === 'running') counts.running++
    else if (state === 'stopped') counts.stopped++
  })
  return counts
})

const handleSelectByStatus = (statusType) => {
  if (statusType === 'clear') { gridRef.value?.clearSelection(); return }
  const ids = clientsWithStatus.value
    .filter(client => {
      const state = classifyServiceState(client.serviceStatus)
      return state === statusType
    })
    .map(c => c.eqpId || c.id)
  gridRef.value?.restoreSelection(ids)
}
```

**Step 4: 기존 유틸 테스트 확인**

```bash
cd client && npx vitest run src/features/clients/utils/__tests__/serviceState.test.js
```
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/features/clients/components/ClientDataGrid.vue \
  client/src/features/clients/components/service-status/ArsAgentStatus.vue \
  client/src/features/clients/ClientsView.vue
git commit -m "refactor: 4-state 분류를 classifyServiceState() 유틸로 통일"
```

---

## Task 3-2: 로컬 toast → `useToast` 교체

**Files:**
- Modify: `client/src/features/clients/ClientsView.vue`

**Step 1: import 추가 + 로컬 toast 교체**

```javascript
// 추가
import { useToast } from '@/shared/composables/useToast'

// useToast 사용
const { toast, showToast: _showToast } = useToast()
```

기존 로컬 toast (lines 143-156) 삭제:
```javascript
// 삭제 대상
const toast = reactive({ show: false, message: '', type: 'success' })
const showToast = (message, type = 'success') => { ... }
```

**주의**: `useToast`의 `showToast`는 `(type, message)` 순서이고, 기존 로컬은 `(message, type)` 순서. 기존 `showToast` 호출처를 모두 찾아 인자 순서를 맞추거나 wrapper 사용:

```javascript
// 기존 호출과 호환되는 wrapper
const showToast = (message, type = 'success') => _showToast(type, message)
```

**Step 2: 기존 `toast.show` / `toast.message` / `toast.type` 참조 확인**

`useToast`의 `toast`는 `ref({ show, type, message })` → `toast.value.show` 형태.
기존 로컬 `reactive` → `toast.show` 형태.
템플릿에서 `toast.show` → `toast.show`로 동일 (ref는 템플릿에서 auto-unwrap).

**Step 3: 테스트 (수동 UI 검증 항목)**

- [ ] toast 메시지 정상 표시
- [ ] 3초 후 자동 사라짐
- [ ] 연속 호출 시 이전 toast가 정상적으로 교체됨

**Step 4: Commit**

```bash
git add client/src/features/clients/ClientsView.vue
git commit -m "refactor: ClientsView 로컬 toast를 공용 useToast()로 교체"
```

---

## Task 3-3: `useClientData` dead code 삭제

**Files:**
- Modify: `client/src/features/clients/composables/useClientData.js`

**Step 1: 호출처 없음 재확인**

`controlClients`, `updateClients`, `configClients` 가 호출되는 곳이 없는지 grep.

**Step 2: 삭제**

- `controlClients`, `updateClients`, `configClients` 함수 삭제
- `operating` ref 삭제 (다른 곳에서 사용하지 않는다면)
- `module.exports` / return 객체에서 해당 항목 제거

**Step 3: 전체 클라이언트 테스트**

```bash
cd client && npx vitest run
```
Expected: PASS

**Step 4: Commit**

```bash
git add client/src/features/clients/composables/useClientData.js
git commit -m "refactor: useClientData에서 미사용 batch control 함수 삭제"
```

---

## Task 3-4: `useResizableModal` composable 추출

**Files:**
- Create: `client/src/shared/composables/useResizableModal.js`
- Create: `client/src/shared/composables/__tests__/useResizableModal.test.js`
- Modify: `client/src/features/clients/components/UpdateSettingsModal.vue`
- Modify: 기타 동일 패턴 모달들

**Step 1: 테스트 작성**

`client/src/shared/composables/__tests__/useResizableModal.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest'
import { useResizableModal } from '../useResizableModal.js'
import { ref } from 'vue'

describe('useResizableModal', () => {
  it('returns drag and resize functions', () => {
    const modalRef = ref(null)
    const result = useResizableModal(modalRef, { defaultWidth: 800, defaultHeight: 600 })

    expect(result.startDrag).toBeTypeOf('function')
    expect(result.startResize).toBeTypeOf('function')
    expect(result.modalPos).toBeDefined()
    expect(result.customWidth).toBeDefined()
    expect(result.customHeight).toBeDefined()
  })

  it('clamps drag position to viewport bounds', () => {
    const modalRef = ref({ getBoundingClientRect: () => ({ left: 100, top: 100, width: 800, height: 600 }) })
    const { startDrag, modalPos } = useResizableModal(modalRef, { defaultWidth: 800, defaultHeight: 600 })

    // Simulate drag
    startDrag({ clientX: 100, clientY: 100, preventDefault: vi.fn() })
    // modalPos should be initialized from getBoundingClientRect
  })

  it('clamps resize to minimum dimensions', () => {
    const modalRef = ref({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) })
    const { customWidth, customHeight } = useResizableModal(modalRef, {
      defaultWidth: 800, defaultHeight: 600, minWidth: 500, minHeight: 400
    })

    expect(customWidth.value).toBe(800)
    expect(customHeight.value).toBe(600)
  })
})
```

**Step 2: 구현 작성**

`client/src/shared/composables/useResizableModal.js`:

```javascript
import { ref, reactive, onMounted, onUnmounted } from 'vue'

/**
 * 모달 drag/resize 공용 composable
 * @param {Ref} modalRef - 모달 DOM element ref
 * @param {object} options - { defaultWidth, defaultHeight, minWidth?, minHeight? }
 */
export function useResizableModal(modalRef, { defaultWidth, defaultHeight, minWidth = 500, minHeight = 400 }) {
  const customWidth = ref(defaultWidth)
  const customHeight = ref(defaultHeight)
  const modalPos = reactive({ x: null, y: null })
  const isMaximized = ref(false)

  let isDragging = false, dragStartX = 0, dragStartY = 0, dragStartPosX = 0, dragStartPosY = 0
  let isResizing = false, resizeStartX = 0, resizeStartY = 0, resizeStartW = 0, resizeStartH = 0

  const startDrag = (e) => {
    if (isMaximized.value) return
    isDragging = true
    dragStartX = e.clientX; dragStartY = e.clientY
    const rect = modalRef.value.getBoundingClientRect()
    dragStartPosX = rect.left; dragStartPosY = rect.top
    e.preventDefault()
  }

  const doDrag = (e) => {
    if (!isDragging) return
    modalPos.x = Math.max(0, Math.min(window.innerWidth - 100, dragStartPosX + (e.clientX - dragStartX)))
    modalPos.y = Math.max(0, Math.min(window.innerHeight - 50, dragStartPosY + (e.clientY - dragStartY)))
  }

  const stopDrag = () => { isDragging = false }

  const startResize = (e) => {
    isResizing = true
    resizeStartX = e.clientX; resizeStartY = e.clientY
    const rect = modalRef.value.getBoundingClientRect()
    resizeStartW = rect.width; resizeStartH = rect.height
    modalPos.x = rect.left; modalPos.y = rect.top
    e.preventDefault()
  }

  const doResize = (e) => {
    if (!isResizing) return
    customWidth.value = Math.max(minWidth, Math.min(window.innerWidth * 0.95, resizeStartW + (e.clientX - resizeStartX)))
    customHeight.value = Math.max(minHeight, Math.min(window.innerHeight * 0.95, resizeStartH + (e.clientY - resizeStartY)))
  }

  const stopResize = () => { isResizing = false }

  const onMouseMove = (e) => { doDrag(e); doResize(e) }
  const onMouseUp = () => { stopDrag(); stopResize() }

  onMounted(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  })

  const toggleMaximize = () => { isMaximized.value = !isMaximized.value }

  return {
    customWidth, customHeight, modalPos, isMaximized,
    startDrag, startResize, toggleMaximize,
  }
}
```

**Step 3: `UpdateSettingsModal.vue`에서 인라인 drag/resize 삭제, composable 사용**

```javascript
import { useResizableModal } from '@/shared/composables/useResizableModal'

const { customWidth, customHeight, modalPos, isMaximized, startDrag, startResize, toggleMaximize } = useResizableModal(modalRef, { defaultWidth: 900, defaultHeight: 700 })
```

기존 인라인 drag/resize 코드 블록(~20행) 삭제.

**Step 4: 테스트 실행**

```bash
cd client && npx vitest run src/shared/composables/__tests__/useResizableModal.test.js
```
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/shared/composables/useResizableModal.js \
  client/src/shared/composables/__tests__/useResizableModal.test.js \
  client/src/features/clients/components/UpdateSettingsModal.vue
git commit -m "refactor: useResizableModal composable 추출로 모달 drag/resize 중복 제거"
```

---

## Task 3-5: ConfigManagerModal props → 단일 객체

**Files:**
- Modify: `client/src/features/clients/ClientsView.vue:544-587`
- Modify: `client/src/features/clients/components/ConfigManagerModal.vue` (props 선언)

**Step 1: ConfigManagerModal.vue props 수정**

기존 25+ 개별 props → 단일 `configManager` prop:

```javascript
// 변경 전
const props = defineProps({
  canRead: Boolean,
  canWrite: Boolean,
  isOpen: Boolean,
  sourceClient: Object,
  // ... 25+ more
})

// 변경 후
const props = defineProps({
  canRead: Boolean,
  canWrite: Boolean,
  configManager: { type: Object, required: true },
})
```

내부에서 `props.isOpen` → `props.configManager.isOpen.value` 등으로 변경.
또는 setup에서 destructure:
```javascript
const cm = computed(() => props.configManager)
```

**Step 2: ClientsView.vue에서 props 전달 간소화**

```html
<!-- 변경 전: 25+ 개별 props -->
<ConfigManagerModal
  :can-read="canRead"
  :can-write="canWrite"
  :is-open="configManager.isOpen.value"
  :source-client="configManager.sourceClient.value"
  <!-- ... 25+ more -->
/>

<!-- 변경 후 -->
<ConfigManagerModal
  :can-read="canRead"
  :can-write="canWrite"
  :config-manager="configManager"
/>
```

**Step 3: UI 검증**

- [ ] Config 모달 열기
- [ ] 파일 선택/편집
- [ ] 저장
- [ ] 횡전개
- [ ] 백업 조회/복원

**Step 4: Commit**

```bash
git add client/src/features/clients/ClientsView.vue client/src/features/clients/components/ConfigManagerModal.vue
git commit -m "refactor: ConfigManagerModal 25+ props를 configManager 단일 객체로 간소화"
```

---

## Task 3-6: `serviceStatuses` + `aliveStatuses` 통합

**Files:**
- Modify: `client/src/features/clients/ClientsView.vue`

**Step 1: 두 개 ref를 단일 `clientStatusMap`으로 통합**

```javascript
// 변경 전
const serviceStatuses = ref({})
const aliveStatuses = ref({})

// 변경 후
const clientStatusMap = ref({})  // { [eqpId]: { serviceStatus, aliveStatus, agentVersion } }
```

**Step 2: SSE 콜백에서 직접 merge**

기존 SSE 콜백에서 `serviceStatuses.value[eqpId] = ...` 와 `aliveStatuses.value = ...`를 하나의 `clientStatusMap`으로 통합.

**Step 3: `clientsWithStatus` computed 단순화**

```javascript
const clientsWithStatus = computed(() => {
  return clients.value.map(client => {
    const eqpId = client.eqpId || client.id
    const status = clientStatusMap.value[eqpId] || {}
    return {
      ...client,
      serviceStatus: status.serviceStatus || null,
      aliveStatus: status.aliveStatus || null,
      agentVersion: status.agentVersion || null,
    }
  })
})
```

**Step 4: UI 검증**

- [ ] 상태 조회 정상
- [ ] 상태별 필터/선택 정상
- [ ] Alive 컬럼 정상

**Step 5: Commit**

```bash
git add client/src/features/clients/ClientsView.vue
git commit -m "refactor: serviceStatuses + aliveStatuses를 단일 clientStatusMap으로 통합"
```

---

## Phase 3 Gate Check

```bash
cd server && npm test
cd client && npx vitest run
```
Expected: 모든 테스트 PASS + UI 검증 체크리스트 전체 PASS

---

# Phase 4: 서버 구조 리팩토링

## Task 4-1: `clients/` 하위 디렉토리 분리

**Files:**
- 파일 이동만. 로직 변경 없음.

**구조:**
```
clients/
  model.js, service.js, validation.js, ftpService.js (공유)
  clientRepository.js, clientInfoBatch.js (공유)
  controller.js (core client 전용)
  aliveStatusHelper.js
  control/
    controlService.js
    agentAliveService.js (+test)
    agentVersionService.js (+test)
    strategies/
  config/
    configController.js
    configSettingsService.js, configSettingsModel.js
    configBackupService.js (+test)
    configTestController.js (+test)
  logs/
    logController.js
    logService.js
    logSettingsService.js, logSettingsModel.js
    logDownload.js (+test)
  updates/
    updateController.js (+test)
    updateService.js (+test)
    updateSettingsService.js (+test), updateSettingsModel.js
    updateSources/
```

**Step 1: 디렉토리 생성 + 파일 이동**

```bash
cd server/features/clients
mkdir -p control config logs updates
# git mv로 이동 (히스토리 보존)
```

**Step 2: import 경로 수정**

모든 이동된 파일의 `require()` 경로를 새 위치에 맞게 수정.
예: `control/agentAliveService.js`에서 `require('./model')` → `require('../model')`

**Step 3: `routes.js` import 경로 수정**

```javascript
const configController = require('./config/configController')
const logController = require('./logs/logController')
const updateController = require('./updates/updateController')
```

**Step 4: 전체 서버 테스트**

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS (import 경로만 변경, 로직 변경 없음)

**Step 5: Commit**

```bash
git add -A server/features/clients/
git commit -m "refactor: clients/ 하위 디렉토리를 5개 도메인으로 분리 (import 경로만 변경)"
```

---

## Task 4-2: `controller.js` barrel export 제거

**Files:**
- Modify: `server/features/clients/controller.js`

**Step 1: 하단 spread-merge 제거**

```javascript
// 삭제 대상 (controller.js 하단)
...require('./config/configController'),
...require('./logs/logController'),
...require('./updates/updateController')
```

**Step 2: `routes.js`에서 직접 import 확인**

`routes.js`가 이미 각 sub-controller를 직접 import하고 있으므로 barrel이 불필요.

**Step 3: 전체 서버 테스트**

```bash
cd server && npm test
```

**Step 4: Commit**

```bash
git add server/features/clients/controller.js
git commit -m "refactor: controller.js barrel export 제거 (routes가 직접 import)"
```

---

## Task 4-3: Phase-3 mock 함수 정리

**Files:**
- Modify: `server/features/clients/controller.js`
- Modify: `server/features/clients/routes.js` (해당 라우트가 있다면)

**Step 1: mock 함수 삭제 또는 TODO 마킹**

`controller.js`의 `controlClients`, `updateClientsSoftware`, `configureClients`에 명확한 TODO 주석 추가:

```javascript
// TODO: Phase 3 구현 시 실제 batch control 로직으로 교체
```

또는 라우트에서 사용되지 않으면 완전 삭제.

**Step 2: 전체 서버 테스트**

```bash
cd server && npm test
```

**Step 3: Commit**

```bash
git add server/features/clients/controller.js
git commit -m "refactor: Phase-3 mock 함수 정리 (TODO 마킹)"
```

---

## Task 4-4: `configController` 레이어 위반 수정

**Files:**
- Modify: `server/features/clients/config/configController.js`
- Modify: `server/features/clients/config/configBackupService.js` (서비스 메서드 추가)

**Step 1: `configBackupService`에 FTP 연결 포함 메서드 추가**

```javascript
// configBackupService.js에 추가
async function saveConfigWithBackup(eqpId, remotePath, content) {
  const { client: ftpClient } = await ftpService.connectFtp(eqpId)
  try {
    await writeConfigWithBackup(ftpClient, remotePath, content)
  } finally {
    ftpClient.close()
  }
}

async function getBackupList(eqpId, remotePath) {
  const { client: ftpClient } = await ftpService.connectFtp(eqpId)
  try {
    return await listBackups(ftpClient, remotePath)
  } finally {
    ftpClient.close()
  }
}

async function getBackupContent(eqpId, remotePath, backupName) {
  const { client: ftpClient } = await ftpService.connectFtp(eqpId)
  try {
    return await readBackup(ftpClient, remotePath, backupName)
  } finally {
    ftpClient.close()
  }
}
```

**Step 2: `configController`에서 직접 FTP 관리 제거**

```javascript
// 변경 전 (updateClientConfig)
const { client: ftpClient } = await ftpService.connectFtp(id)
try {
  await configBackupService.writeConfigWithBackup(ftpClient, config.path, content)
} finally { ftpClient.close() }

// 변경 후
await configBackupService.saveConfigWithBackup(id, config.path, content)
```

**Step 3: 테스트 추가 + 전체 테스트**

```bash
cd server && npm test
```
Expected: 기존 configBackupService 25개 + 신규 테스트 PASS

**Step 4: Commit**

```bash
git add server/features/clients/config/configController.js server/features/clients/config/configBackupService.js
git commit -m "refactor: configController에서 직접 FTP 연결 관리 제거 → 서비스 메서드로 위임"
```

---

## Task 4-5: Settings Service 팩토리 추출

**Files:**
- Create: `server/features/clients/createSettingsService.js`
- Create: `server/features/clients/createSettingsService.test.js`
- Modify: `server/features/clients/config/configSettingsService.js`
- Modify: `server/features/clients/logs/logSettingsService.js`

**주의**: `updateSettingsService`는 migration 로직이 복잡하므로 팩토리 적용에서 제외. `configSettings`와 `logSettings`만 팩토리화.

**Step 1: 테스트 작성**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSettingsService } from './createSettingsService.js'

describe('createSettingsService', () => {
  const mockModel = {
    createIndexes: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  }

  it('creates service with getByAgentGroup', async () => {
    const service = createSettingsService(mockModel, 'items', [])
    mockModel.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ items: [{ id: 1 }] }) })

    const result = await service.getByAgentGroup('ars_agent')
    expect(result).toEqual([{ id: 1 }])
  })

  it('returns empty array when document not found', async () => {
    const service = createSettingsService(mockModel, 'items', [])
    mockModel.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })

    const result = await service.getByAgentGroup('ars_agent')
    expect(result).toEqual([])
  })

  it('initialize creates indexes and seeds defaults', async () => {
    const defaults = [{ agentGroup: 'ars_agent', items: [] }]
    const service = createSettingsService(mockModel, 'items', defaults)
    mockModel.findOneAndUpdate.mockResolvedValue({})

    await service.initialize()
    expect(mockModel.createIndexes).toHaveBeenCalled()
    expect(mockModel.findOneAndUpdate).toHaveBeenCalledTimes(1)
  })
})
```

**Step 2: 구현**

`server/features/clients/createSettingsService.js`:

```javascript
/**
 * agentGroup 기반 설정 서비스 팩토리
 * configSettingsService / logSettingsService 공통 패턴 생성
 */
function createSettingsService(Model, fieldName, defaults) {
  async function initialize() {
    await Model.createIndexes()
    for (const def of defaults) {
      await Model.findOneAndUpdate(
        { agentGroup: def.agentGroup },
        { $setOnInsert: def },
        { upsert: true }
      )
    }
  }

  async function getByAgentGroup(agentGroup) {
    const doc = await Model.findOne({ agentGroup }).lean()
    return doc ? (doc[fieldName] || []) : []
  }

  async function getDocument(agentGroup) {
    return Model.findOne({ agentGroup }).lean()
  }

  return { initialize, getByAgentGroup, getDocument }
}

module.exports = { createSettingsService }
```

**Step 3: `configSettingsService`를 팩토리 기반으로 리팩토링**

기존 수동 함수들을 팩토리로 생성하되, `save` 같은 커스텀 로직은 별도 유지.

**Step 4: 전체 서버 테스트**

```bash
cd server && npm test
```

**Step 5: Commit**

```bash
git add server/features/clients/createSettingsService.js server/features/clients/createSettingsService.test.js \
  server/features/clients/config/configSettingsService.js server/features/clients/logs/logSettingsService.js
git commit -m "refactor: Settings Service 공통 패턴을 createSettingsService 팩토리로 추출"
```

---

## Task 4-6: `withFtp()` 헬퍼 추출 및 적용

**Files:**
- Modify: `server/features/clients/ftpService.js`

**Step 1: `withFtp` 헬퍼 정의**

```javascript
/**
 * FTP 연결 생성 → 작업 실행 → 항상 close
 * @param {string} eqpId
 * @param {function(BasicFtpClient): Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withFtp(eqpId, fn) {
  const { client: ftpClient } = await connectFtp(eqpId)
  try {
    return await fn(ftpClient)
  } finally {
    ftpClient.close()
  }
}
```

**Step 2: 6곳의 try/finally를 `withFtp`로 교체**

```javascript
// 변경 전
async function readConfigFile(eqpId, remotePath) {
  const { client: ftpClient } = await connectFtp(eqpId)
  try {
    // ... work
  } finally {
    ftpClient.close()
  }
}

// 변경 후
async function readConfigFile(eqpId, remotePath) {
  return withFtp(eqpId, async (ftpClient) => {
    // ... work
  })
}
```

**Step 3: 전체 서버 테스트**

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS

**Step 4: Commit**

```bash
git add server/features/clients/ftpService.js
git commit -m "refactor: FTP try/finally 보일러플레이트를 withFtp() 헬퍼로 통일"
```

---

## Phase 4 Gate Check

```bash
cd server && npm test
```
Expected: 모든 테스트 PASS

서버 기동 확인:
```bash
cd server && timeout 5 npm run dev || true
```

---

# Final Gate

```bash
cd server && npm test
cd client && npx vitest run
```
Expected: 서버 + 클라이언트 전체 테스트 100% PASS
