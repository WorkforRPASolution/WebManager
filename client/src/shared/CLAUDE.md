# Shared 컴포넌트 개발 가이드

## AG Grid 스크롤바 설정

### 문제점

AG Grid의 수평 스크롤바가 기능 수정 시 사라지는 문제가 반복 발생합니다.

**근본 원인:**
1. AG Grid는 **inline style로 동적으로 스크롤바를 제어**
2. 컬럼 총 너비 < 컨테이너 너비 → AG Grid가 `display: none` inline style 적용
3. CSS `!important`로 오버라이드해도 AG Grid가 다시 inline style 적용 → 충돌
4. 각 DataGrid 컴포넌트마다 **CSS가 중복되고 미세하게 달라** 일관성 없음

### 현재 상태 (문제 있음)

| 컴포넌트 | `suppressSizeToFit` | 비고 |
|---------|---------------------|------|
| UserDataGrid | ✅ 있음 | 스크롤 안정적 |
| MasterDataGrid | ❌ 없음 | **스크롤 불안정** |
| ClientDataGrid | ✅ 있음 | 스크롤 안정적 |
| EmailTemplateGrid | ❌ 없음 | **스크롤 불안정** |

### 필수 AG Grid Props

모든 DataGrid에 **반드시** 아래 props를 설정해야 합니다:

```vue
<AgGridVue
  :alwaysShowHorizontalScroll="true"
  :suppressSizeToFit="true"
  style="width: 100%; height: 100%;"
/>
```

| Prop | 값 | 설명 |
|------|-----|------|
| `alwaysShowHorizontalScroll` | `true` | 스크롤바 항상 표시 |
| `suppressSizeToFit` | `true` | 컬럼 자동 축소 방지 (핵심!) |

### CSS 스타일 가이드

#### 올바른 스타일 (권장)

```css
/* 수평 스크롤바 강제 표시 */
.ag-body-horizontal-scroll-viewport {
  overflow-x: scroll !important;
}

.ag-body-horizontal-scroll-viewport::-webkit-scrollbar {
  -webkit-appearance: none !important;
  height: 12px !important;
  display: block !important;
}

.ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
  border-radius: 6px !important;
  background-color: rgba(100, 100, 100, 0.5) !important;
}

/* 스크롤 영역 표시 */
.ag-body-horizontal-scroll {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  min-height: 12px !important;
}
```

#### 위험한 스타일 (사용 금지)

```css
/* ⚠️ 이 설정은 AG Grid 레이아웃을 망가뜨림 */
.ag-root,
.ag-root-wrapper {
  overflow: visible !important;  /* 절대 사용 금지! */
}
```

### 컬럼 너비 설정

스크롤이 발생하려면 **컬럼 총 너비 > 컨테이너 너비**여야 합니다.

```javascript
const columnDefs = ref([
  { field: 'name', width: 150, minWidth: 150 },  // minWidth 설정 권장
  { field: 'email', width: 200, minWidth: 200 },
  // ...
])
```

### 컨테이너 구조

부모 컴포넌트에서 **반드시 `min-h-0` 설정**:

```vue
<!-- 부모 View 컴포넌트 -->
<div class="flex-1 min-h-0">  <!-- min-h-0 필수! -->
  <SomeDataGrid />
</div>
```

### TODO: 리팩토링 계획

1. **공용 CSS 파일 생성**: `shared/styles/ag-grid-scroll.css`
2. **모든 DataGrid props 통일**: `suppressSizeToFit: true` 추가
3. **위험한 overflow 오버라이드 제거**
4. **scoped style 대신 global style 사용** (AG Grid가 Shadow DOM처럼 동작)

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
