# Trigger 패턴 매칭 테스트 — 전체 매칭 결과 표시 Design

Trigger 패턴 매칭 테스트 패널이 매칭된 라인을 1건만 보여주는 UX 문제를 해결한다. 발동(firing) 결과 표시는 그대로 유지하면서, 입력 데이터에 패턴이 총 몇 줄 매칭되는지를 명시하고 모든 매칭 라인을 안전하게 펼쳐볼 수 있게 한다.

## Context

`TriggerTestPanel.vue`의 패턴 매칭 테스트는 텍스트/파일 입력에 대해 trigger recipe를 시뮬레이션해 발동 여부를 확인하는 도구다. 현재 동작:

- `executeOneChain()`은 `matches.length >= requiredTimes` 조건이 충족되면 즉시 `break`로 스캔을 중단한다 ([testEngine.js:285](../../client/src/features/clients/components/config-form/trigger/testEngine.js#L285))
- 기본 `times=1`이므로, 입력 로그에 매칭 라인이 4건 있어도 첫 매칭에서 break → step 카드에 매칭 라인이 1건만 표시
- limitation 미설정 시 체인 1회만 실행되어 firing 단위 반복도 없음
- limitation 설정 시 firings 데이터에 step별 매칭 라인이 들어있으나, UI([TriggerTestPanel.vue:285](../../client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue#L285))는 timestamp + 상태만 한 줄로 요약

사용자 입장에서는 **"여러 라인이 매칭되는데 화면엔 1건만 보임 → 버그?"** 로 오해할 수 있다. 특히 파일 시뮬레이션은 운영 로그에서 패턴이 어디어디 매칭되는지 검증하려는 의도가 강하므로, 첫 매칭만 보여주는 것은 의도와 어긋난다.

## 목표

1. 사용자가 "왜 1줄만 보이는지" 의문을 갖지 않게 한다 — **펼치기 없이도 "총 N줄 매칭" 카운트가 보여야 함**
2. 매칭 라인 본문을 펼쳐서 모두 확인할 수 있게 한다 — **디버깅 용도에 부합**
3. 매칭 수가 매우 많아도 화면이 깨지지 않게 한다 — **페이지네이션 + 메모리 상한**
4. 기존 발동(firing) 의미와 표시는 그대로 유지한다 — **회귀 위험 최소화**

## 비목표 (Out of Scope)

- 발동 로직 자체의 변경 (matches.length >= requiredTimes에서 break하는 동작은 유지)
- limitation의 firings[1..N] 본문 표시 — 기존 timestamp 리스트 유지
- MULTI 클래스 트리거의 표시 변경 — 인스턴스 추적 UI는 별도 영역으로 그대로
- delay 타입 step의 표시 변경 — 의미 다름 (취소 패턴)
- 트리거 폼 자체나 설정 저장 로직

## 설계 결정

### 엔진 변경 — 별도 분석 함수 추가

`executeOneChain()` 본체는 건드리지 않는다. 발동 로직과 분리된 새 함수를 둔다.

```js
// testEngine.js
export function analyzeAllMatches(recipe, lines, options = {})
// → returns: { stepAnalyses: [{ stepName, totalMatches, matchedLines, truncated }] }
```

- recipe의 각 step(단, type !== 'delay')에 대해, 해당 step의 trigger 패턴 전체를 lines 전체에 적용
- 각 라인이 매칭되면 `{ lineNum, line, pattern, fileName?, isFiringLine }`로 수집
- **수집 상한**: 패턴별 매칭 라인 본문 최대 1000건. 초과 시 `truncated=true`, `totalMatches`는 계속 증가
- `isFiringLine`: 발동 카드에 표시된 그 라인이면 true (UI에서 강조용). limitation 케이스에서는 모든 firing의 발동 라인(`firings[i].steps[stepIndex].matches[0]`)에 대해 마킹 — 사용자가 "어느 라인이 발동을 트리거했는지" 한눈에 보도록
- `testTriggerPattern()`/`testTriggerWithFiles()` 결과 객체에 `fullAnalysis: { stepAnalyses }` 필드 추가

성능 영향: 라인 단위 정규식 매칭이라 1만 줄 정도는 수십 ms. 큰 비용 없음.

### 적용 범위

| 케이스 | 적용 여부 |
|--------|----------|
| limitation 없음, recipe regex step | **적용** |
| limitation 있음 (firings[0] 기준) | **적용** (firings[1..N] 본문은 변경 없음) |
| MULTI 클래스 | **미적용** (기존 인스턴스 카드 유지) |
| delay 타입 step | **미적용** (의미 다름) |
| 0건 매칭 step | 패널 미렌더 + 헤더 배지도 미렌더 (기존 "매칭 없음" 안내 유지) |

### UI 변경 — TriggerTestPanel.vue

#### A. step 카드 헤더에 카운트 배지 (항상 노출)

기존 헤더:
```
step_01 (keyword): 1/1회 매칭 → 발동 ✅
```

신규 헤더:
```
step_01 (keyword): 1/1회 매칭 → 발동 ✅  [총 247줄 매칭]
```

- 배지는 작고 중립 색상 (회색 border)
- 배지 hover 시 툴팁: "발동 조건 충족 후 스캔이 중단되지만, 패턴 자체는 입력에서 N줄 매칭됨"
- 매칭 0건이면 배지 미표시

#### B. step 카드 하단에 "전체 매칭 분석" 패널 (기본 접힘)

```
▶ 전체 매칭 분석 · 247줄 매칭 (입력 1500줄 중)
```

펼친 상태:
- 매칭 라인 첫 10줄 표시 (`isFiringLine=true`인 라인은 녹색 강조 + "(발동)" 라벨)
- 라인 형식: `Line N "본문" ← pattern` (기존 step matches와 동일)
- 하단에 `+ 더 보기 (10/247)` 버튼 — 클릭마다 10줄씩 추가
- truncated일 때: 마지막에 `"… 외 N+ 매칭됨 (수집 상한 초과)"` 안내
- 패널 자체에 `max-height: 240px; overflow-y: auto` — 페이지 자체는 안전

#### C. 적용되지 않는 케이스의 표시

- delay step: 기존 그대로 (배지/패널 모두 없음)
- MULTI: 기존 multi 인스턴스 영역 그대로
- limitation의 firings[1..N]: 기존 timestamp 한 줄 요약 그대로

### 안전장치

- **엔진 수집 상한**: 패턴별 1000건. 초과는 카운트만 증가, 본문 미보관
- **라인 길이**: 표시 시 CSS truncate (기존 `class="truncate"` 적용 중)
- **패널 max-height**: 240px + overflow:auto — 페이지 길이 폭주 방지
- **펼침 점진 렌더**: v-for의 slice로 10개씩만 렌더 — DOM 노드 폭증 방지
- **0건 매칭 분기**: 배지/패널 모두 미렌더 — 빈 UI 노출 방지

## 데이터 구조

`testTriggerPattern()`/`testTriggerWithFiles()` 반환 객체 확장:

```js
{
  steps: [...],            // 기존 그대로
  finalResult: {...},      // 기존 그대로
  firings: [...],          // 기존 그대로
  limitation: {...},       // 기존 그대로
  isMulti: false,          // 기존 그대로
  fullAnalysis: {          // ← 신규
    stepAnalyses: [
      {
        stepName: 'step_01',
        stepType: 'keyword',
        totalMatches: 247,
        matchedLines: [
          { lineNum: 1, line: '...', pattern: '...', fileName: 'app.log', isFiringLine: true },
          { lineNum: 5, line: '...', pattern: '...', fileName: 'app.log', isFiringLine: false },
          // ... 최대 1000건
        ],
        truncated: false
      }
    ]
  }
}
```

`isMulti=true` 또는 step.type='delay'인 step은 `stepAnalyses`에서 제외.

## 테스트 전략

`testEngine.test.js`에 다음 케이스 추가:

1. **카운트 정확성**: 패턴이 N건 매칭되는 입력에서 `totalMatches === N`
2. **isFiringLine 마킹**: limitation 없음, 첫 매칭 라인만 `isFiringLine=true`
3. **수집 상한 (1000건)**: 1500건 매칭 입력에서 `matchedLines.length === 1000 && truncated === true && totalMatches === 1500`
4. **delay step 제외**: stepAnalyses에 delay step 없음
5. **MULTI 클래스 제외**: `fullAnalysis === undefined` 또는 `stepAnalyses === []`
6. **0건 매칭 step**: `totalMatches === 0`, UI는 미렌더 (Vue 컴포넌트 단위 테스트로 검증)
7. **multi-step recipe**: 각 step별로 분리된 분석 결과
8. **파일 시뮬레이션**: `fileName`이 정확히 채워짐
9. **limitation 케이스**: firings 결과와 별개로 fullAnalysis 채워짐

UI 단위 테스트 (`TriggerTestPanel.test.js`가 있다면):

10. 카운트 배지 렌더 — 배지 텍스트 검증
11. 패널 접힘 → 펼침 토글
12. "더 보기" 클릭 시 10줄씩 추가 렌더
13. 0건 매칭 시 배지/패널 미렌더

## 호환성

- 결과 객체에 필드 추가만 하므로 기존 소비자(있다면) 영향 없음
- `executeOneChain()`/`testTriggerPattern()` 시그니처 변경 없음
- 기존 step matches 표시는 그대로 — 회귀 위험 0

## 변경 파일 (예상)

- `client/src/features/clients/components/config-form/trigger/testEngine.js` — `analyzeAllMatches()` 함수 추가, `testTriggerPattern()`/`testTriggerWithFiles()` 끝에서 호출 후 `fullAnalysis` 필드 추가
- `client/src/features/clients/components/config-form/trigger/TriggerTestPanel.vue` — step 카드 헤더에 배지, 카드 하단에 "전체 매칭 분석" 패널, "더 보기" 상태 관리
- `client/src/features/clients/components/config-form/trigger/__tests__/testEngine.test.js` — 신규 케이스 추가
