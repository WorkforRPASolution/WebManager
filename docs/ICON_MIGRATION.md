# Icon Migration Guide — 기존 → 신규 아이소메트릭 레이어 아이콘

## 신규 아이콘 디자인

3개의 반투명 아이소메트릭 레이어가 겹치는 스택 디자인. WebManager 블루 테마에 맞춘 색상 배합.

| 레이어 | 역할 | 탑 면 | 왼쪽 면 | 오른쪽 면 | Opacity |
|--------|------|-------|---------|----------|---------|
| 하단 | 슬레이트 블루 (기반) | `#b4c8dc` | `#8aa0b8` | `#9eb4cc` | 0.90 |
| 중간 | 틸 (액센트) | `#48b0a8` | `#2c908a` | `#3aa09a` | 0.85 |
| 상단 | 프라이머리 블루 (브랜드) | `#5c9ee0` | `#3878c0` | `#4a8cd0` | 0.82 |

**원본 SVG** (`client/public/favicon.svg`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <!-- Layer 1 (bottom) - Slate Blue -->
  <g opacity="0.9">
    <polygon points="5,70 50,54 95,70 50,86" fill="#b4c8dc"/>
    <polygon points="5,70 50,86 50,92 5,76" fill="#8aa0b8"/>
    <polygon points="50,86 95,70 95,76 50,92" fill="#9eb4cc"/>
  </g>
  <!-- Layer 2 (middle) - Teal -->
  <g opacity="0.85">
    <polygon points="5,48 50,32 95,48 50,64" fill="#48b0a8"/>
    <polygon points="5,48 50,64 50,70 5,54" fill="#2c908a"/>
    <polygon points="50,64 95,48 95,54 50,70" fill="#3aa09a"/>
  </g>
  <!-- Layer 3 (top) - Primary Blue -->
  <g opacity="0.82">
    <polygon points="5,26 50,10 95,26 50,42" fill="#5c9ee0"/>
    <polygon points="5,26 50,42 50,48 5,32" fill="#3878c0"/>
    <polygon points="50,42 95,26 95,32 50,48" fill="#4a8cd0"/>
  </g>
</svg>
```

---

## 수정 대상 목록

### 1. Favicon (브라우저 탭 아이콘)

| 항목 | 값 |
|------|---|
| **파일** | `client/public/favicon.svg` |
| **참조** | `client/index.html` (line 5) |
| **크기** | viewBox `0 0 100 100` (브라우저가 16×16 ~ 32×32로 축소) |
| **상태** | ✅ 이미 신규 아이콘으로 교체됨 |

**index.html 참조 코드:**
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

---

### 2. Header 로고 (메인 헤더 좌측)

| 항목 | 값 |
|------|---|
| **파일** | `client/src/layouts/Header.vue` |
| **위치** | line 52-60 |
| **컨테이너** | `w-8 h-8` (32×32px), `bg-white/20 rounded` |
| **SVG 크기** | `w-5 h-5` (20×20px) |
| **배경** | 반투명 흰색 (`bg-white/20`) |

**기존 코드 (백업):**
```vue
<div class="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
  <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3"/>
    <circle cx="6" cy="6" r="2"/>
    <circle cx="18" cy="6" r="2"/>
    <circle cx="6" cy="18" r="2"/>
    <circle cx="18" cy="18" r="2"/>
  </svg>
</div>
```

**신규 코드 (교체 완료):**
```vue
<div class="w-8 h-8 rounded flex items-center justify-center">
  <svg class="w-7 h-7" viewBox="0 0 100 100">
    <g opacity="0.9">
      <polygon points="5,70 50,54 95,70 50,86" fill="#b4c8dc"/>
      <polygon points="5,70 50,86 50,92 5,76" fill="#8aa0b8"/>
      <polygon points="50,86 95,70 95,76 50,92" fill="#9eb4cc"/>
    </g>
    <g opacity="0.85">
      <polygon points="5,48 50,32 95,48 50,64" fill="#48b0a8"/>
      <polygon points="5,48 50,64 50,70 5,54" fill="#2c908a"/>
      <polygon points="50,64 95,48 95,54 50,70" fill="#3aa09a"/>
    </g>
    <g opacity="0.82">
      <polygon points="5,26 50,10 95,26 50,42" fill="#5c9ee0"/>
      <polygon points="5,26 50,42 50,48 5,32" fill="#3878c0"/>
      <polygon points="50,42 95,26 95,32 50,48" fill="#4a8cd0"/>
    </g>
  </svg>
</div>
```

**변경 포인트:**
- `bg-white/20` 제거 (아이콘 자체가 컬러풀)
- SVG 크기 `w-5 h-5` → `w-7 h-7` (아이소메트릭은 여백이 있어 약간 크게)
- `fill="currentColor"` → 각 레이어별 고정 색상
- `viewBox="0 0 24 24"` → `viewBox="0 0 100 100"`

---

### 3. Login 페이지 로고

| 항목 | 값 |
|------|---|
| **파일** | `client/src/features/auth/LoginView.vue` |
| **위치** | line 86-94 |
| **컨테이너** | `w-16 h-16` (64×64px), `bg-primary-500 rounded-xl` |
| **SVG 크기** | `w-10 h-10` (40×40px) |

**기존 코드 (백업):**
```vue
<div class="w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center mx-auto mb-4">
  <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3"/>
    <circle cx="6" cy="6" r="2"/>
    <circle cx="18" cy="6" r="2"/>
    <circle cx="6" cy="18" r="2"/>
    <circle cx="18" cy="18" r="2"/>
  </svg>
</div>
```

**신규 코드 (교체 완료):**
```vue
<div class="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
  <svg class="w-14 h-14" viewBox="0 0 100 100">
    <g opacity="0.9">
      <polygon points="5,70 50,54 95,70 50,86" fill="#b4c8dc"/>
      <polygon points="5,70 50,86 50,92 5,76" fill="#8aa0b8"/>
      <polygon points="50,86 95,70 95,76 50,92" fill="#9eb4cc"/>
    </g>
    <g opacity="0.85">
      <polygon points="5,48 50,32 95,48 50,64" fill="#48b0a8"/>
      <polygon points="5,48 50,64 50,70 5,54" fill="#2c908a"/>
      <polygon points="50,64 95,48 95,54 50,70" fill="#3aa09a"/>
    </g>
    <g opacity="0.82">
      <polygon points="5,26 50,10 95,26 50,42" fill="#5c9ee0"/>
      <polygon points="5,26 50,42 50,48 5,32" fill="#3878c0"/>
      <polygon points="50,42 95,26 95,32 50,48" fill="#4a8cd0"/>
    </g>
  </svg>
</div>
```

**변경 포인트:**
- `bg-primary-500` 제거 (아이콘 자체가 컬러풀)
- SVG 크기 `w-10 h-10` → `w-14 h-14`
- `fill="currentColor"` → 각 레이어별 고정 색상

---

### 4. Signup 페이지 로고

| 항목 | 값 |
|------|---|
| **파일** | `client/src/features/auth/SignupView.vue` |
| **위치** | line 314-322 |
| **컨테이너** | `w-16 h-16` (64×64px), `bg-primary-500 rounded-xl` |
| **SVG 크기** | `w-10 h-10` (40×40px) |

**기존 코드 (백업):**
```vue
<div class="w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center mx-auto mb-4">
  <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3"/>
    <circle cx="6" cy="6" r="2"/>
    <circle cx="18" cy="6" r="2"/>
    <circle cx="6" cy="18" r="2"/>
    <circle cx="18" cy="18" r="2"/>
  </svg>
</div>
```

**신규 코드:** Login과 동일 (위 3번 참조)

---

### 5. Password Reset 페이지 로고

| 항목 | 값 |
|------|---|
| **파일** | `client/src/features/auth/RequestPasswordResetView.vue` |
| **위치** | line 251-259 |
| **컨테이너** | `w-16 h-16` (64×64px), `bg-primary-500 rounded-xl` |
| **SVG 크기** | `w-10 h-10` (40×40px) |

**기존 코드 (백업):**
```vue
<div class="w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center mx-auto mb-4">
  <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3"/>
    <circle cx="6" cy="6" r="2"/>
    <circle cx="18" cy="6" r="2"/>
    <circle cx="6" cy="18" r="2"/>
    <circle cx="18" cy="18" r="2"/>
  </svg>
</div>
```

**신규 코드:** Login과 동일 (위 3번 참조)

---

## 크기별 정리

| 위치 | 컨테이너 | SVG 크기 | 비고 |
|------|---------|---------|------|
| Favicon | N/A | viewBox 100×100 | 브라우저가 자동 축소 |
| Header | `w-8 h-8` (32px) | `w-7 h-7` (28px) | 헤더 상단 좌측 |
| Login | `w-16 h-16` (64px) | `w-14 h-14` (56px) | 폼 상단 중앙 |
| Signup | `w-16 h-16` (64px) | `w-14 h-14` (56px) | 폼 상단 중앙 |
| PW Reset | `w-16 h-16` (64px) | `w-14 h-14` (56px) | 폼 상단 중앙 |

## 공통 변경 사항

1. **배경색 제거**: `bg-primary-500`, `bg-white/20` → 없음 (아이콘 자체 색상 사용)
2. **`fill="currentColor"` 제거**: 아이소메트릭 레이어는 고정 색상 사용
3. **viewBox 변경**: `0 0 24 24` → `0 0 100 100`
4. **SVG 크기 약간 확대**: 아이소메트릭 디자인은 내부 여백이 있어 기존 대비 약간 크게 설정
