# Process 기반 필터 권한 시스템

## 개요

WebManager의 모든 데이터 관리 페이지에서는 사용자의 **Process 권한**에 따라 필터 옵션과 데이터가 제한됩니다.
이 문서는 필터 권한 시스템의 동작 방식과 구현 방법을 설명합니다.

---

## 핵심 규칙

### 1. Process 필터 목록 = DB 데이터 ∩ 사용자 권한 (교집합)

```
표시되는 Process = (DB에 실제 존재하는 Process) ∩ (사용자가 권한을 가진 Process)
```

| 조건 | 결과 |
|------|------|
| 교집합이 있으면 | 해당 Process 목록 표시 |
| 교집합이 비어있으면 | **빈 목록 표시** (사용자 권한 목록 표시 금지) |

### 2. 전체 조회 권한 조건 (아래 중 하나 만족 시)

- `authorityManager === 1` (Admin)
- `processes` 배열에 `"MASTER"` 포함

### 3. 하위 필터 (Model, Line, Code 등) 동작

- **Process 선택 시**: 선택된 Process에 해당하는 항목만 표시
- **Process 미선택 시**: 사용자 권한 Process에 해당하는 항목만 표시

---

## 예시 시나리오

### 시나리오 1: Equipment Info 페이지

**사용자 권한**: `processes: ["IMP", "ETCH"]`

**DB 데이터 (EQP_INFO)**:
| process | eqpModel | line |
|---------|----------|------|
| IMP | MODEL-A | FAB1 |
| IMP | MODEL-B | FAB2 |
| CVD | MODEL-C | FAB1 |
| PHOTO | MODEL-D | FAB3 |

**필터 표시 결과**:
- **Process 필터**: `["IMP"]` (DB에 IMP만 있고, ETCH는 없음)
- **Model 필터** (Process 미선택): `["MODEL-A", "MODEL-B"]` (IMP에 해당)
- **Line 필터** (Process 미선택): `["FAB1", "FAB2"]` (IMP에 해당)

---

### 시나리오 2: Email Template 페이지

**사용자 권한**: `processes: ["IMP"]`

**DB 데이터 (EMAIL_TEMPLATE)**:
| process | model | code |
|---------|-------|------|
| CVD | EVT9 | ALERT |
| PHOTO | EVT9 | WARNING |

**필터 표시 결과**:
- **Process 필터**: `[]` (빈 목록 - IMP 데이터 없음)
- **Model 필터**: `[]` (빈 목록)
- **Code 필터**: `[]` (빈 목록)

> ⚠️ **주의**: 교집합이 비어있어도 사용자 권한 목록(`["IMP"]`)을 표시하면 안 됨!

---

### 시나리오 3: Email Info 페이지 (Category 파싱)

**사용자 권한**: `processes: ["ETCH"]`

**DB 데이터 (EMAILINFO)**:
| category | project |
|----------|---------|
| EMAIL-ETCH-MODEL-A-ALERT | ARS |
| EMAIL-CVD-MODEL-B-WARNING | ARS |

**Category 구조**: `EMAIL-{process}-{model}-{type}`

**필터 표시 결과**:
- **Process 필터**: `["ETCH"]` (category에서 추출 후 권한 필터링)
- **Model 필터**: `["MODEL-A"]` (ETCH에 해당하는 model만)

---

### 시나리오 4: 관리자 (Admin) 사용자

**사용자**: `authorityManager: 1` (Admin)

**필터 표시 결과**:
- 모든 페이지에서 **DB의 모든 데이터** 표시
- `userProcesses` 파라미터가 `null`로 전달되어 필터링 없음

---

## 구현 구조

### 클라이언트 측

#### 1. processFilter.js (Pinia Store)

```javascript
// 사용자 권한 목록 가져오기
const getUserProcessList = () => {
  const user = authStore.user
  if (!user) return []

  // processes 배열 우선, 없으면 process 문자열 파싱
  if (Array.isArray(user.processes) && user.processes.length > 0) {
    return [...user.processes]
  }
  if (user.process && typeof user.process === 'string') {
    return user.process.split(';').map(p => p.trim()).filter(Boolean)
  }
  return []
}

// 전체 조회 가능 여부
const canViewAllProcesses = computed(() => {
  const user = authStore.user
  if (!user) return false
  if (user.authorityManager == 1) return true  // Admin
  if (getUserProcesses(user).includes('MASTER')) return true
  return false
})
```

#### 2. FilterBar 컴포넌트 패턴

```javascript
const fetchProcesses = async () => {
  // 관리자가 아니면 userProcesses 전달
  const userProcesses = processFilterStore.canViewAllProcesses
    ? null
    : processFilterStore.getUserProcessList()

  const response = await api.getProcesses(userProcesses)
  processes.value = response.data  // 서버에서 이미 필터링됨
}

const fetchModels = async (processFilter) => {
  const userProcesses = processFilterStore.canViewAllProcesses
    ? null
    : processFilterStore.getUserProcessList()

  // Process 선택 시: processFilter로 필터링
  // Process 미선택 시: userProcesses로 필터링
  const response = await api.getModels(processFilter, userProcesses)
  models.value = response.data
}
```

### 서버 측

#### 1. Service 함수 패턴

```javascript
async function getProcesses(userProcesses) {
  const allProcesses = await Model.distinct('process')

  // userProcesses가 있으면 교집합 반환
  if (userProcesses && userProcesses.length > 0) {
    const upperUserProcesses = userProcesses.map(p => p.toUpperCase())
    return allProcesses.filter(p =>
      upperUserProcesses.includes(p.toUpperCase())
    ).sort()
  }

  return allProcesses.sort()
}

async function getModels(processFilter, userProcesses) {
  const query = {}

  if (processFilter) {
    // 명시적 Process 선택
    query.process = { $in: processFilter.split(',') }
  } else if (userProcesses && userProcesses.length > 0) {
    // Process 미선택 시 사용자 권한으로 필터링
    query.process = { $in: userProcesses }
  }

  return await Model.distinct('model', query)
}
```

#### 2. Controller 패턴

```javascript
async function getProcesses(req, res) {
  const { userProcesses } = req.query

  // 콤마 구분 문자열 → 배열 파싱
  const userProcessesArray = userProcesses
    ? userProcesses.split(',').map(p => p.trim()).filter(p => p)
    : null

  const processes = await service.getProcesses(userProcessesArray)
  res.json(processes)
}
```

---

## 페이지별 적용 현황

| 페이지 | Process | Model | Line | Code | 비고 |
|--------|---------|-------|------|------|------|
| Equipment Info | ✅ | ✅ | ✅ | - | EQP_INFO 테이블 |
| Email Template | ✅ | ✅ | - | ✅ | EMAIL_TEMPLATE 테이블 |
| Email Recipients | ✅ | ✅ | - | ✅ | EMAIL_RECIPIENTS 테이블 |
| Email Info | ✅ | ✅ | - | - | Category에서 파싱 |
| User Management | ✅ | - | ✅ | - | ARS_USER_INFO 테이블 |
| Clients | ✅ | ✅ | - | - | EQP_INFO 테이블 공유 |

---

## 데이터 조회 권한 필터링

필터 옵션뿐만 아니라 **실제 데이터 조회**에도 동일한 권한 필터링이 적용됩니다.

### 검색 시 userProcesses 적용

```javascript
// FilterBar handleSearch
const handleSearch = () => {
  const userProcesses = processFilterStore.canViewAllProcesses
    ? null
    : processFilterStore.getUserProcessList()

  emit('filter-change', {
    processes: selectedProcesses.value,
    models: selectedModels.value,
    // ... 기타 필터
    userProcesses  // 데이터 조회 시에도 권한 필터링
  })
}
```

### 서버 쿼리 빌드

```javascript
function buildQuery(filters) {
  const query = {}

  // 명시적 Process 선택이 없을 때만 userProcesses 적용
  if (filters.userProcesses?.length > 0 && !filters.process) {
    query.process = { $in: filters.userProcesses }
  }

  return query
}
```

---

## 주의사항

### 1. 클라이언트 vs 서버 필터링

| 방식 | 장점 | 단점 |
|------|------|------|
| 클라이언트 필터링 | 구현 간단 | 타이밍 이슈, 보안 취약 |
| **서버 필터링 (권장)** | 안정적, 보안 강화 | API 수정 필요 |

> 현재 구현: **서버 측 필터링** (userProcesses 파라미터 전달)

### 2. Vue Proxy 객체 주의

```javascript
// ❌ 잘못된 방식 - Proxy 객체 그대로 전달
params.userProcesses = authStore.user.processes.join(',')

// ✅ 올바른 방식 - 스프레드로 일반 배열 변환
params.userProcesses = [...authStore.user.processes].join(',')
```

### 3. 대소문자 비교

Process 비교 시 항상 **대소문자 무시**:

```javascript
const upperUserProcesses = userProcesses.map(p => p.toUpperCase())
return allProcesses.filter(p => upperUserProcesses.includes(p.toUpperCase()))
```

---

## 관련 파일

### 클라이언트
- `client/src/shared/stores/processFilter.js` - 권한 필터 스토어
- `client/src/features/*/components/*FilterBar.vue` - 각 페이지 필터바
- `client/src/features/*/api.js` - API 호출

### 서버
- `server/features/*/service.js` - 비즈니스 로직 (필터링)
- `server/features/*/controller.js` - 요청 파라미터 파싱
- `server/shared/middleware/authMiddleware.js` - 권한 미들웨어
