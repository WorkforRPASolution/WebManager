# Shared 컴포넌트 개발 가이드

## AG Grid 스크롤바 설정

### 배경

macOS에서 AG Grid의 네이티브 수평 스크롤바가 오버레이 스타일로 표시되어 사용자가 스크롤 가능 여부를 인지하기 어려운 문제가 있었습니다. CSS만으로는 macOS Safari/Chrome의 오버레이 스크롤바를 완전히 오버라이드할 수 없어, **JavaScript 기반 커스텀 스크롤바**를 구현하여 모든 OS에서 일관되게 표시되도록 했습니다.

### 현재 상태 (2026-01-22)

| 컴포넌트 | 커스텀 스크롤바 | 상태 |
|---------|----------------|------|
| MasterDataGrid | ✅ 적용 | 정상 |
| ClientDataGrid | ✅ 적용 | 정상 |
| UserDataGrid | ✅ 적용 | 정상 |
| EmailTemplateGrid | ✅ 적용 | 정상 |

---

## 새 DataGrid 추가 시 체크리스트

새로운 DataGrid 컴포넌트를 만들 때 아래 단계를 따르세요.

### 1. 필수 Import

```javascript
import { useCustomScrollbar } from '@/shared/composables/useCustomScrollbar'
import CustomHorizontalScrollbar from '@/shared/components/CustomHorizontalScrollbar.vue'
```

### 2. Template 구조

```vue
<template>
  <div class="flex flex-col w-full h-full">
    <!-- Grid Container: ag-grid-custom-scrollbar 클래스 필수 -->
    <div ref="gridContainer" class="flex-1 min-h-0 ag-grid-custom-scrollbar" tabindex="0">
      <AgGridVue
        :theme="gridTheme"
        :rowData="rowData"
        :columnDefs="columnDefs"
        :defaultColDef="defaultColDef"
        :alwaysShowHorizontalScroll="true"
        :suppressSizeToFit="true"
        @grid-ready="onGridReady"
        @displayed-columns-changed="handleColumnChange"
        @column-resized="handleColumnChange"
        style="width: 100%; height: 100%;"
      />
    </div>

    <!-- Custom Scrollbar: Grid 아래에 배치 -->
    <CustomHorizontalScrollbar
      :scrollState="scrollState"
      @scroll="handleCustomScroll"
    />
  </div>
</template>
```

### 3. Script Setup

```javascript
const gridContainer = ref(null)
const gridApi = ref(null)

// Custom Scrollbar 설정
const { scrollState, scrollTo, handleColumnChange } = useCustomScrollbar(gridContainer)

const handleCustomScroll = (scrollLeft) => {
  scrollTo(scrollLeft)
}

const onGridReady = (params) => {
  gridApi.value = params.api
  // 커스텀 스크롤바 초기화
  handleColumnChange()
}
```

### 4. 필수 AG Grid Props

| Prop | 값 | 설명 |
|------|-----|------|
| `alwaysShowHorizontalScroll` | `true` | 스크롤바 영역 항상 확보 |
| `suppressSizeToFit` | `true` | 컬럼 자동 축소 방지 (핵심!) |

### 5. 필수 AG Grid Events

| Event | Handler | 설명 |
|-------|---------|------|
| `@grid-ready` | `onGridReady` | 초기화 시 `handleColumnChange()` 호출 |
| `@displayed-columns-changed` | `handleColumnChange` | 컬럼 표시 변경 시 스크롤바 업데이트 |
| `@column-resized` | `handleColumnChange` | 컬럼 리사이즈 시 스크롤바 업데이트 |

### 6. CSS Import (선택)

공용 스타일이 필요한 경우:

```vue
<style>
@import '@/shared/styles/ag-grid-scroll.css';
</style>
```

---

## 관련 파일 구조

```
shared/
├── components/
│   ├── CustomHorizontalScrollbar.vue  # 커스텀 스크롤바 UI
│   └── BaseDataGridToolbar.vue        # DataGrid 툴바
├── composables/
│   ├── useCustomScrollbar.js          # 스크롤바 동기화 로직
│   ├── useTheme.js                    # 다크/라이트 테마
│   └── useToast.js                    # 토스트 알림
├── styles/
│   └── ag-grid-scroll.css             # AG Grid 스크롤 스타일
└── utils/
    └── dataGridValidation.js          # 유효성 검사
```

---

## CustomHorizontalScrollbar 컴포넌트

### 기능

- 좌/우 화살표 버튼 (클릭 및 롱클릭 지원)
- 드래그 가능한 thumb
- Track 클릭 시 해당 위치로 스크롤
- 다크/라이트 모드 자동 지원
- 스크롤이 필요 없을 때 자동 숨김

### Props

| Prop | Type | 설명 |
|------|------|------|
| `scrollState` | `Object` | `useCustomScrollbar`에서 제공하는 스크롤 상태 |

### Events

| Event | Payload | 설명 |
|-------|---------|------|
| `scroll` | `number` | 새로운 scrollLeft 값 |

---

## useCustomScrollbar Composable

### 사용법

```javascript
import { useCustomScrollbar } from '@/shared/composables/useCustomScrollbar'

// gridContainer는 AG Grid를 감싸는 div의 ref
const gridContainer = ref(null)

const {
  scrollState,      // 현재 스크롤 상태 (reactive)
  scrollTo,         // 스크롤 위치 설정 함수
  handleColumnChange, // 컬럼 변경 시 호출
  updateScrollState,  // 수동 상태 업데이트
  initialize        // 수동 초기화
} = useCustomScrollbar(gridContainer)
```

### scrollState 구조

```javascript
{
  scrollLeft: number,        // 현재 스크롤 위치
  scrollWidth: number,       // 전체 스크롤 가능 너비
  clientWidth: number,       // 보이는 영역 너비
  hasHorizontalScroll: boolean  // 스크롤 필요 여부
}
```

---

## 컬럼 너비 설정

스크롤이 발생하려면 **컬럼 총 너비 > 컨테이너 너비**여야 합니다.

```javascript
const columnDefs = ref([
  { field: 'name', width: 150, minWidth: 150 },  // minWidth 설정 권장
  { field: 'email', width: 200, minWidth: 200 },
  // ...
])
```

---

## 컨테이너 구조 (부모 View)

부모 컴포넌트에서 **반드시 `min-h-0` 설정**:

```vue
<!-- 부모 View 컴포넌트 -->
<div class="flex-1 min-h-0">  <!-- min-h-0 필수! -->
  <SomeDataGrid />
</div>
```

---

## 주의사항

### 위험한 CSS (사용 금지)

```css
/* ⚠️ 이 설정은 AG Grid 레이아웃을 망가뜨림 */
.ag-root,
.ag-root-wrapper {
  overflow: visible !important;  /* 절대 사용 금지! */
}
```

### 커스텀 스크롤바 클래스

`.ag-grid-custom-scrollbar` 클래스가 Grid 컨테이너에 있어야 네이티브 스크롤바가 숨겨집니다. 이 클래스가 없으면 네이티브 스크롤바와 커스텀 스크롤바가 동시에 표시됩니다.

---

## 기타 공용 컴포넌트

### BaseDataGridToolbar

DataGrid 상단 툴바 공용 컴포넌트.

**위치**: `shared/components/BaseDataGridToolbar.vue`

**Props**:
- `hasChanges`: 변경사항 존재 여부
- `hasSelection`: 선택된 행 존재 여부
- `showAdd`, `showDelete`, `showSave`, `showCancel`: 버튼 표시 여부

### useToast

토스트 알림 composable.

**사용법**:
```javascript
import { useToast } from '@/shared/composables/useToast'

const { showSuccess, showError, showWarning } = useToast()

showSuccess('저장되었습니다')
showError('오류가 발생했습니다')
```

### dataGridValidation

DataGrid 유효성 검사 유틸리티.

**위치**: `shared/utils/dataGridValidation.js`

**사용법**:
```javascript
import { validateRequired, validateEmail } from '@/shared/utils/dataGridValidation'

const errors = validateRequired(value, 'fieldName')
```
