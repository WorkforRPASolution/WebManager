# LOG_TYPE_REFACTORING

## 1. 개요

### 배경

기존 log_type 처리 방식은 `VALID_LOG_TYPES` Set에 문자열을 나열하고 파싱하는 단순한 구조였다. 이 방식은 다음 세 가지 문제를 해결하지 못했다:

1. **구버전/신버전 이름 차이**: ARSAgent 버전에 따라 동일한 log_type이 서로 다른 이름을 사용한다. 예를 들어 `date_prefix_single`(신버전)과 `date_prefix_normal_single`(구버전)은 같은 동작을 가리킨다. 기존 방식으로는 양쪽 이름을 일관되게 관리할 수 없었다.

2. **date_suffix 추가**: 새로운 date 축 값인 `date_suffix`가 도입되면서, 기존 문자열 파싱 방식으로는 축(axis) 조합을 체계적으로 관리하기 어려워졌다.

3. **미지원 조합 제거**: `multiline + extract_append`, `date_prefix/date_suffix + multiline` 등 실제로는 지원되지 않는 조합이 기존 Set에 포함되어 있어 사용자가 잘못된 설정을 선택할 수 있었다.

### 해결 방향

문자열 Set 기반 파싱을 **LOG_TYPE_REGISTRY 매핑 테이블**로 전환했다. 각 log_type을 3개 축(date, line, postProc)으로 분해(decompose)하고, 축 조합에서 이름을 합성(compose)하는 구조로 변경했다. 버전 정보에 따라 canonical 또는 oldName을 선택하며, 불가능한 축 조합은 Registry에 등록하지 않아 원천 차단한다.

---

## 2. 변경 사항 요약

수정 파일 총 11개 (신규 2, 수정 9):

| 파일 | 작업 | 핵심 변경 |
|------|------|----------|
| `config-form/versionUtils.js` | 신규 | `compareVersions()`, `isNewLogTypeVersion()` — 버전 비교 유틸리티 |
| `config-form/__tests__/versionUtils.test.js` | 신규 | 9개 테스트 |
| `config-form/configSchemas.js` | 수정 | LOG_TYPE_REGISTRY(10항목), LOG_TYPE_NAME_MAP/AXIS_MAP, compose/decompose 리팩토링, `_originalLogType` 보존, date_suffix 지원 |
| `config-form/__tests__/configSchemas.test.js` | 수정 | 66개 테스트 (전면 업데이트) |
| `config-form/configDescription.js` | 수정 | 정적 LOG_TYPE_MAP을 `decomposeLogType` 기반 동적 설명으로 전환 |
| `config-form/AccessLogForm.vue` | 수정 | agentVersion prop 추가, 동적 축 옵션 필터링, 불가능 조합 자동 보정, 버전 전달 |
| `config-form/ConfigFormView.vue` | 수정 | agentVersion prop 전달 |
| `ConfigManagerModal.vue` | 수정 | activeAgentVersion prop 전달 |
| `composables/useConfigManager.js` | 수정 | `agentVersions` ref + mock 버전 할당 + `activeAgentVersion` computed |
| `ClientsView.vue` | 수정 | `:active-agent-version` prop 바인딩 |
| `server/features/clients/model.js` | 수정 | `agentVersion: String` 필드 추가 |

---

## 3. LOG_TYPE_REGISTRY 상세

### 유효 조합 (10개)

| # | canonical (신버전) | oldName (구버전) | date | line | postProc |
|---|---|---|---|---|---|
| 1 | `normal_single` | - | normal | single | none |
| 2 | `normal_single_extract_append` | `extract_append` | normal | single | extract_append |
| 3 | `normal_multiline` | - | normal | multiline | none |
| 4 | `date_single` | - | date | single | none |
| 5 | `date_single_extract_append` | - | date | single | extract_append |
| 6 | `date_multiline` | - | date | multiline | none |
| 7 | `date_prefix_single` | `date_prefix_normal_single` | date_prefix | single | none |
| 8 | `date_prefix_single_extract_append` | `date_prefix_normal_single_extract_append` | date_prefix | single | extract_append |
| 9 | `date_suffix_single` | `date_suffix_normal_single` | date_suffix | single | none |
| 10 | `date_suffix_single_extract_append` | `date_suffix_normal_single_extract_append` | date_suffix | single | extract_append |

### 제거된 조합 (8개)

- **multiline + extract_append** (4개): `normal_multiline_extract_append`, `date_multiline_extract_append`, `date_prefix_multiline_extract_append`, `date_suffix_multiline_extract_append` — extract_append 후처리는 single line 전용
- **date_prefix/date_suffix + multiline** (4개): `date_prefix_multiline`, `date_suffix_multiline`, `date_prefix_multiline_extract_append`, `date_suffix_multiline_extract_append` — date_prefix/date_suffix는 single line만 지원

---

## 4. 핵심 메커니즘

### 4A. 버전 기반 이름 결정

```
isNewLogTypeVersion(version)
  └─ version >= NEW_LOG_TYPE_THRESHOLD ('7.0.0.0') → true (canonical 이름)
  └─ version < '7.0.0.0' 또는 null/undefined   → false (oldName 이름)
```

`composeLogType(axes, { version })` 함수가 3축 조합에서 Registry를 조회한 뒤, version 파라미터에 따라 canonical 또는 oldName을 반환한다.

- `version`이 `null` 또는 `undefined`인 경우: `isNewLogTypeVersion()`이 `false`를 반환하므로 oldName 분기를 타지만, entry에 oldName이 없으면 canonical을 반환한다.
- `compareVersions()`: dot-separated 세그먼트를 숫자로 비교 (`7.0.0.0` vs `6.8.5.24`). 세그먼트 수가 다르면 부족한 쪽을 0으로 패딩한다.

### 4B. 원본 이름 보존 (`_originalLogType`)

config 파일을 로드하여 폼에 표시할 때와 저장할 때의 흐름:

```
[로드 시] parseAccessLogInput()
  └─ config.log_type → _originalLogType에 저장
  └─ decomposeLogType(config.log_type) → 3축(source, lineAxis, postProc)으로 분해하여 폼 표시

[저장 시] buildAccessLogOutput()
  └─ 3축이 변경되지 않았는가?
      ├─ YES → _originalLogType 그대로 출력 (이름 변경 없음)
      └─ NO  → composeLogType(axes, { version }) 호출하여 새 이름 생성
```

**목적**: 사용자가 log_type 관련 축을 변경하지 않고 다른 필드(예: directory, prefix)만 수정한 뒤 저장하면, 기존 config에 기록된 log_type 이름이 그대로 유지된다. canonical/oldName 전환으로 인한 의도치 않은 이름 변경을 방지한다.

`_originalLogType`은 `_omit_*` 패턴과 동일하게 `buildAccessLogOutput`의 내부 로직에서만 사용되며, 최종 JSON 출력에는 포함되지 않는다.

### 4C. 동적 축 옵션 필터링

사용자가 한 축의 값을 변경하면 다른 축의 가용 옵션이 동적으로 필터링된다:

```
getLineAxisOptions(source)
  └─ source가 date_prefix 또는 date_suffix → ['single'] 만 반환
  └─ 그 외 (normal, date)                  → ['single', 'multiline'] 반환

getPostProcOptions(lineAxis)
  └─ lineAxis가 multiline → ['none'] 만 반환
  └─ lineAxis가 single    → ['none', 'extract_append'] 반환
```

`updateAxis()` 함수는 불가능한 조합이 발생하면 자동 보정한다:

- 예: lineAxis가 `multiline`인 상태에서 source를 `date_prefix`로 변경 → lineAxis를 `single`로 자동 보정
- 예: lineAxis가 `multiline`이고 postProc이 `extract_append`인 상태 → postProc을 `none`으로 자동 보정 (이 경우는 Registry에 등록되지 않은 조합이므로 발생할 수 없지만 방어 코드로 포함)

---

## 5. Props 체인 (버전 전달 경로)

버전 정보가 composable에서 최하위 폼 컴포넌트까지 전달되는 경로:

```
useConfigManager.js
  │  agentVersions: ref({})           ← eqpId별 버전 저장
  │  activeAgentVersion: computed()   ← 현재 선택된 클라이언트의 버전
  │
  ▼
ClientsView.vue
  │  :active-agent-version="configManager.activeAgentVersion.value"
  │
  ▼
ConfigManagerModal.vue
  │  props: { activeAgentVersion: String }
  │
  ▼
ConfigFormView.vue
  │  props: { agentVersion: String }
  │
  ▼
AccessLogForm.vue
     props: { agentVersion: String }
     └─ composeLogType(axes, { version: agentVersion })
     └─ buildAccessLogOutput(..., { version: agentVersion })
```

---

## 6. Mock 구현 상태 및 실제 구현 가이드

> **이 섹션은 매우 중요하다.** 현재 버전 조회가 mock 상태이며, 실제 구현 시 아래 3단계를 따라야 한다.

### 6A. 현재 Mock 상태

현재 3곳이 mock/placeholder 상태이다:

#### (1) `useConfigManager.js` — 하드코딩된 버전

```js
// useConfigManager.js, loadClientConfigs() 내부
// TODO: RPC로 실제 버전 조회 (현재 mock)
agentVersions.value[eqpId] = '6.8.5.24'
```

- `loadClientConfigs(eqpId)` 호출 시 모든 클라이언트에 `'6.8.5.24'`를 하드코딩으로 할당한다.
- `6.8.5.24 < 7.0.0.0`이므로 현재는 **항상 구버전(oldName) 이름**이 사용된다.
- 실제로 RPC를 통해 각 클라이언트의 ARSAgent 버전을 조회해야 한다.

#### (2) `versionUtils.js` — placeholder 임계값

```js
// versionUtils.js
const NEW_LOG_TYPE_THRESHOLD = '7.0.0.0'  // TODO: 실제 임계 버전 확정
```

- 신버전 log_type canonical 이름을 지원하는 최소 ARSAgent 버전이 `7.0.0.0`으로 설정되어 있다.
- 실제 ARSAgent 릴리스에서 canonical log_type을 지원하기 시작하는 버전이 확정되면 이 값을 업데이트해야 한다.

#### (3) `server/features/clients/model.js` — 미사용 필드

```js
// model.js (EQP_INFO 스키마)
agentVersion: { type: String },
```

- EQP_INFO 도큐먼트에 `agentVersion` 필드가 추가되었으나, 현재 아무 코드에서도 이 필드에 값을 기록하지 않는다.
- 추후 서버에서 RPC로 조회한 버전을 캐싱하는 용도로 사용할 예정이다.

### 6B. 실제 구현 시 해야 할 작업 — 3단계

#### Step 1: ARSAgent 팀과 협의

1. `NEW_LOG_TYPE_THRESHOLD` 실제 임계 버전을 확정한다.
2. 해당 버전부터 canonical log_type 이름(`date_prefix_single` 등)을 지원하는지 ARSAgent 팀에 확인한다.
3. 확정된 버전으로 `versionUtils.js`의 `NEW_LOG_TYPE_THRESHOLD` 상수를 업데이트한다.

#### Step 2: 서버 — RPC 버전 조회 API 추가

ManagerAgent에 ARSAgent 버전 조회 RPC 커맨드가 있어야 한다.

**(1) `controlService.js`에 `getAgentVersion(eqpId, agentGroup)` 함수 추가**

Strategy 패턴을 활용한다. 기존 `detectBasePath`와 유사한 패턴으로 구현한다:

- 방법 A: `strategy.getVersionCommand()` 메서드 추가. 예를 들어 `sc qc ARSAgent` 출력에서 버전 문자열을 파싱하거나, 별도 RPC 커맨드를 정의한다.
- 방법 B: ManagerAgent에 전용 Avro RPC 메서드(`getVersion`)가 있다면 직접 호출한다.

**(2) `controller.js`에 버전 조회 엔드포인트 추가**

두 가지 옵션 중 선택:

- **Option A** (별도 엔드포인트): `GET /api/clients/:id/agent-version?agentGroup=ars_agent`
  ```js
  // controller.js
  router.get('/:id/agent-version', async (req, res) => {
    const { id } = req.params
    const { agentGroup } = req.query
    const version = await controlService.getAgentVersion(id, agentGroup)
    res.json({ version })
  })
  ```

- **Option B** (기존 status 응답에 포함): `batchExecuteActionStream`의 status 응답에 version 필드를 추가한다. RPC status 응답 자체에 버전 정보가 포함된다면 이 방법이 효율적이다.

**(3) 조회된 버전을 EQP_INFO.agentVersion에 캐싱**

```js
// controlService.js 또는 controller.js
await Equipment.findByIdAndUpdate(eqpId, { agentVersion: version })
```

캐싱하면 다음번 config 로드 시 RPC 호출 없이 DB에서 바로 읽을 수 있다. 다만 Agent 업데이트 후 캐시 무효화 전략도 고려해야 한다.

#### Step 3: 프론트엔드 — mock 제거 및 실제 호출

**(1) `useConfigManager.js` 수정 — Option A (별도 API 호출)**

```js
async function loadClientConfigs(eqpId) {
  // ... 기존 config 로드 로직 ...

  // 실제 버전 조회
  try {
    const { data } = await api.get(`/clients/${eqpId}/agent-version`, {
      params: { agentGroup: currentAgentGroup.value }
    })
    agentVersions.value[eqpId] = data.version || ''
  } catch (err) {
    // 버전 조회 실패 시 빈 문자열
    // → isNewLogTypeVersion('') returns false
    // → 안전하게 구버전 이름 사용 (6C 참조)
    agentVersions.value[eqpId] = ''
    console.warn(`Failed to get agent version for ${eqpId}:`, err.message)
  }
}
```

**(2) `useConfigManager.js` 수정 — Option B (status 응답에서 추출)**

기존 status 조회 시 version 정보가 함께 오는 경우:

```js
// status 응답에 version이 포함된 경우
agentVersions.value[eqpId] = statusResult.version || ''
```

**(3) `versionUtils.js` 상수 업데이트**

```js
// Step 1에서 확정된 버전으로 교체
const NEW_LOG_TYPE_THRESHOLD = '확정된_버전'
```

### 6C. 버전 조회 불가 시 안전 동작 (Fallback 정책)

현재 설계에서 버전을 알 수 없을 때의 동작:

```
isNewLogTypeVersion(null)      → false
isNewLogTypeVersion(undefined) → false
isNewLogTypeVersion('')        → false
```

그러나 `composeLogType`의 현재 로직은 다음과 같다:

```js
// 현재 로직
if (version && entry.oldName) {
  return isNewLogTypeVersion(version) ? entry.canonical : entry.oldName
}
return entry.canonical
```

- `version`이 falsy(`null`, `undefined`, `''`)이면 첫 번째 if를 건너뛰고 **canonical 이름을 반환**한다.
- 즉 **버전 불명 시 canonical(신버전) 이름**이 사용된다.

만약 **버전 불명 시 구버전 이름**을 사용하는 정책으로 변경하려면:

```js
// 구버전 이름 우선 정책
if (entry.oldName && (!version || !isNewLogTypeVersion(version))) {
  return entry.oldName
}
return entry.canonical
```

이 fallback 정책은 ARSAgent 팀과 협의하여 결정해야 한다. 고려 사항:

- **canonical 우선 (현재)**: 신버전 Agent에서 구버전 이름을 받을 위험 없음. 단, 구버전 Agent가 canonical 이름을 인식하지 못할 수 있음.
- **oldName 우선 (대안)**: 구버전 Agent 호환성 보장. 단, 신버전 Agent에서 불필요하게 구버전 이름을 계속 사용하게 됨.

---

## 7. 검증 결과

### 단위 테스트: 292/292 PASS (4 test files)

| 파일 | 테스트 수 | 상태 |
|------|----------|------|
| `versionUtils.test.js` | 9 | PASS |
| `configSchemas.test.js` | 66 | PASS |
| `configDescription.test.js` | 72 | PASS |
| `configTestEngine.test.js` | 145 | PASS |

### 브라우저 검증: 7/7 PASS

| # | 시나리오 | 결과 |
|---|---------|------|
| 1 | date_suffix 선택 후 JSON Preview에 올바른 log_type 반영 (구버전 oldName) | PASS |
| 2 | Discard 클릭 시 원본 log_type 복원 | PASS |
| 3 | 축 미변경 + 다른 필드(directory 등) 변경 후 저장 시 원본 log_type 보존 | PASS |
| 4 | date_suffix 선택 시 라인 모드에서 multiline 옵션 필터링 (single만 표시) | PASS |
| 5 | normal 모드에서 multiline 옵션 정상 표시 | PASS |
| 6 | multiline 선택 시 후처리에서 extract_append 필터링 (none만 표시) | PASS |
| 7 | 자동 보정: multiline 상태에서 date_prefix 선택 시 lineAxis가 single로 보정 | PASS |

---

## 8. 주의사항

1. **`_originalLogType` 출력 제외**: `_omit_*` 패턴과 동일하게 `buildAccessLogOutput` 내부 로직에서만 참조되며, 최종 JSON 출력에는 포함되지 않는다.

2. **제거된 조합의 기존 config 처리**: 기존 config에 `multiline + extract_append` 같은 제거된 조합이 저장되어 있으면, `decomposeLogType()`이 해당 이름을 Registry에서 찾지 못하고 기본값(`normal`, `single`, `none`)을 반환한다. 저장 시 `normal_single`로 변경된다. 이는 의도된 동작이다.

3. **date_subdir_format 활성화 조건**: date_suffix가 추가되면서, `date_subdir_format` 필드가 활성화되는 source 축 값이 `date`, `date_prefix`, `date_suffix` 3가지로 확장되었다.

4. **configDescription.js 연동**: `getLogTypeDescription()` 함수도 기존 정적 `LOG_TYPE_MAP` 대신 `decomposeLogType()` 기반 동적 설명을 생성하므로, date_suffix 등 새로운 축 값에 대한 설명이 자동으로 지원된다.

5. **Registry에 없는 이름**: `decomposeLogType()`에 알 수 없는 log_type 문자열이 입력되면 기본 축 값(`{ source: 'normal', lineAxis: 'single', postProc: 'none' }`)을 반환한다. 이는 방어적 설계이며, 사용자에게 별도 경고를 표시하지는 않는다.
