# 이미지 호스팅 (Image Hosting)

## 개요

Email Template의 HTML에 이미지를 삽입하기 위한 이미지 호스팅 기능입니다.

### 목적
- Email Template HTML 에디터에서 이미지 삽입 지원
- Java Swing 클라이언트에서 이메일 발송 시 이미지 표시

### 제약사항
- **Java 1.6 HTTP URL만 지원**: Java 1.6 환경에서는 HTTPS 연결 시 최신 TLS 프로토콜을 지원하지 않아 연결 오류 발생 가능
- 이미지 URL은 반드시 HTTP 프로토콜 사용 필요 (프로덕션 환경)

---

## 아키텍처

### 환경별 구성

```
┌─────────────────────────────────────────────────────────────────┐
│                        개발 환경 (Local)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────┐  │
│  │   Browser    │────▶│  WebManager  │────▶│  Local Storage │  │
│  │   (Vue.js)   │     │   (Express)  │     │  (File System) │  │
│  └──────────────┘     └──────────────┘     └────────────────┘  │
│                              │                     │            │
│                              ▼                     ▼            │
│                    http://localhost:5001    server/uploads/     │
│                    /api/images/:id          images/             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  프로덕션 환경 (MongoDB 직접 저장)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────┐  │
│  │   Browser    │────▶│  WebManager  │────▶│    MongoDB     │  │
│  │   (Vue.js)   │     │   (Express)  │     │ (직접 저장)     │  │
│  └──────────────┘     └──────────────┘     └────────────────┘  │
│         │                                          │            │
│         │  업로드/삭제/목록: MongoDB 직접            │            │
│         │                                          │            │
│  ┌──────────────┐     ┌──────────────┐            │            │
│  │ Java Client  │────▶│ HttpWebServer │────────────┘            │
│  │  (Swing)     │     │ (조회 전용)   │                         │
│  └──────────────┘     └──────────────┘                         │
│         │  http://httpwebserver/ARS/EmailImage/                 │
│         │  {prefix}/{name} (HTTP only for Java 1.6)             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Storage 추상화 패턴

환경변수 `IMAGE_STORAGE`에 따라 스토리지 구현체가 자동 선택됩니다.

```javascript
// server/features/images/storage/index.js
const storageType = process.env.IMAGE_STORAGE || 'local';

if (storageType === 'httpwebserver') {
  storage = require('./httpWebServerStorage');
} else {
  storage = require('./localStorage');
}
```

모든 스토리지 구현체는 동일한 인터페이스를 제공합니다:

| 메서드 | 설명 |
|--------|------|
| `initialize()` | 스토리지 초기화 |
| `uploadImage(file, prefix)` | 이미지 업로드 (MongoDB 직접 저장), 메타데이터 반환 |
| `getImage(prefix, name)` | 이미지 바이너리 조회 (MongoDB 직접) |
| `deleteImage(prefix, name)` | 이미지 삭제 (MongoDB 직접) |
| `listImages(prefix)` | 이미지 목록 조회 (body 제외하여 성능 최적화) |
| `getImageUrl(prefix, name)` | HttpWebServer URL 생성 (이메일용) |

---

## HttpWebServer API 형식

Java 1.6 클라이언트에서 이메일 이미지를 조회할 때 사용됩니다.

```
GET    http://{HTTPWEBSERVER_URL}/ARS/EmailImage/{prefix}/{name}
```

> **Note**: 업로드/삭제는 WebManager에서 MongoDB로 직접 처리합니다. HttpWebServer는 Java 클라이언트의 이미지 조회 전용입니다.

### MongoDB 스키마 (EARS.EMAIL_IMAGE_REPOSITORY)

| Field | Type | Description |
|-------|------|-------------|
| prefix | String (PK) | `ARS_[process]_[model]_[code]_[subcode]` |
| name | String (PK) | UUID (확장자 제외) |
| fileName | String | 원본 파일명 (**camelCase**, required) |
| body | BinData | 이미지 바이너리 (required) |
| mimetype | String | MIME 타입 (WebManager 전용) |
| size | Number | 파일 크기 in bytes (WebManager 전용) |
| createdAt | Date | 생성 시각 (WebManager 전용) |

> **Note**: `fileName`, `body`는 EARS DB 공유 필드이며, `mimetype`, `size`, `createdAt`은 WebManager 전용 메타데이터입니다.

### prefix 생성 규칙

Email Template 정보를 기반으로 prefix가 생성됩니다:
- 형식: `ARS_${process}_${model}_${code}_${subcode}`
- 예시: `ARS_CVD_MODEL1_CODE1_SUBCODE1`

---

## API 엔드포인트

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/images` | 이미지 업로드 (file + prefix) | 필요 |
| GET | `/api/images?prefix=xxx` | 목록 조회 (prefix로 필터링) | 필요 |
| GET | `/api/images/:id` | 바이너리 조회 (local) | **불필요** |
| GET | `/api/images/:prefix/:name` | 바이너리 조회 (httpwebserver) | **불필요** |
| DELETE | `/api/images/:id` | 이미지 삭제 (local) | 필요 |
| DELETE | `/api/images/:prefix/:name` | 이미지 삭제 (httpwebserver) | 필요 |

### 업로드 (POST /api/images)

**Request:**
```
Content-Type: multipart/form-data

file: <binary>
prefix: ARS_CVD_MODEL1_CODE1_SUBCODE1
```

**Response:**
```json
{
  "success": true,
  "image": {
    "id": "uuid-string",
    "prefix": "ARS_CVD_MODEL1_CODE1_SUBCODE1",
    "name": "uuid-string",
    "filename": "원본파일명.png",
    "mimetype": "image/png",
    "size": 12345,
    "createdAt": "2026-01-28T10:00:00.000Z",
    "url": "http://httpwebserver/ARS/EmailImage/ARS_CVD_MODEL1_CODE1_SUBCODE1/uuid-string"
  }
}
```

### 목록 조회 (GET /api/images?prefix=xxx)

**Response:**
```json
{
  "success": true,
  "images": [
    {
      "id": "uuid-string",
      "prefix": "ARS_CVD_MODEL1_CODE1_SUBCODE1",
      "name": "uuid-string",
      "filename": "image.png",
      "mimetype": "image/png",
      "size": 12345,
      "createdAt": "2026-01-28T10:00:00.000Z",
      "url": "http://httpwebserver/ARS/EmailImage/ARS_CVD_MODEL1_CODE1_SUBCODE1/uuid-string"
    }
  ]
}
```

### 이미지 조회 (GET /api/images/:prefix/:name)

**Response:**
- Content-Type: 이미지 MIME 타입
- Cache-Control: `public, max-age=31536000` (1년)
- Body: 이미지 바이너리

---

## 파일 구조

```
server/features/images/
├── routes.js              # Express 라우터 정의
├── controller.js          # 요청/응답 처리
├── service.js             # 비즈니스 로직, URL 생성
├── validation.js          # Multer 설정, 파일 검증
├── model.js               # EMAIL_IMAGE_REPOSITORY Mongoose 모델
└── storage/
    ├── index.js              # 스토리지 추상화 (환경별 선택)
    ├── localStorage.js       # 로컬 파일 시스템 스토리지
    └── httpWebServerStorage.js # HttpWebServer REST API 스토리지

client/src/shared/
├── components/
│   └── ImageInsertModal.vue    # 이미지 삽입 모달
├── composables/
│   └── useImageUpload.js       # 이미지 업로드 composable
└── api/
    └── index.js                # imagesApi 정의
```

---

## 환경 변수

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `IMAGE_STORAGE` | `local` | 스토리지 타입 (`local` \| `httpwebserver`) |
| `HTTPWEBSERVER_URL` | `http://127.0.0.1:8080` | HttpWebServer URL (프로덕션) |

### .env 예시

```bash
# 개발 환경
IMAGE_STORAGE=local

# 프로덕션 환경
IMAGE_STORAGE=httpwebserver
HTTPWEBSERVER_URL=http://127.0.0.1:8080
```

---

## Frontend 컴포넌트

### ImageInsertModal.vue

Email Template 에디터에서 이미지를 삽입하기 위한 모달 컴포넌트입니다.

**기능:**
- 드래그 앤 드롭 / 클릭으로 이미지 업로드
- 업로드된 이미지 갤러리 (썸네일 표시)
- **템플릿별 이미지 필터링** (prefix 기반)
- 이미지 선택 및 삭제
- 너비/정렬/Alt 텍스트 옵션 설정
- HTML `<img>` 태그 자동 생성

**사용법:**
```vue
<template>
  <ImageInsertModal
    v-model="showModal"
    :template-context="{ process: 'CVD', model: 'MODEL1', code: 'CODE1', subcode: 'SUB1' }"
    @insert="handleInsert"
  />
</template>

<script setup>
const handleInsert = ({ url, alt, width, align, htmlTag }) => {
  // htmlTag를 에디터에 삽입
}
</script>
```

**Props:**
| Prop | Type | 설명 |
|------|------|------|
| `modelValue` | `Boolean` | 모달 표시 여부 (v-model) |
| `templateContext` | `Object` | 템플릿 컨텍스트 `{ process, model, code, subcode }` |

**Events:**
| Event | Payload | 설명 |
|-------|---------|------|
| `insert` | `{ url, alt, width, align, htmlTag }` | 이미지 삽입 시 |

### useImageUpload Composable

이미지 업로드 관련 로직을 재사용 가능한 composable로 분리했습니다.

**사용법:**
```javascript
import { useImageUpload } from '@/shared/composables/useImageUpload'

const {
  isUploading,    // 업로드 중 여부
  uploadProgress, // 업로드 진행률
  uploadError,    // 에러 메시지
  uploadImage,    // 업로드 함수
  fetchImages,    // 목록 조회 함수
  deleteImage     // 삭제 함수
} = useImageUpload()

// 업로드 (with prefix)
const result = await uploadImage(file, 'ARS_CVD_MODEL1_CODE1_SUB1')

// 목록 조회 (with prefix filter)
const images = await fetchImages('ARS_CVD_MODEL1_CODE1_SUB1')

// 삭제 (with prefix and name)
const success = await deleteImage('ARS_CVD_MODEL1_CODE1_SUB1', 'uuid-string')
```

---

## 이미지 삽입 흐름

```
┌──────────────────────────────────────────────────────────────────────┐
│                      이미지 삽입 워크플로우                            │
└──────────────────────────────────────────────────────────────────────┘

1. 템플릿 선택 → HTML 편집 모달 열기
   └─▶ templateContext 전달 (process, model, code, subcode)

2. 이미지 삽입 버튼 클릭 → 이미지 모달 열기
   └─▶ GET /api/images?prefix=ARS_{process}_{model}_{code}_{subcode}
       └─▶ 해당 템플릿의 이미지만 표시

3. 썸네일 표시
   └─▶ <img :src="image.url">
       └─▶ HttpWebServer URL로 직접 이미지 로드

4. 새 이미지 업로드
   └─▶ POST /api/images (FormData with prefix)
       └─▶ 업로드 완료 → 갤러리에 추가 및 자동 선택

5. 이미지 선택 + 옵션 설정
   └─▶ 너비: auto, 100%, 75%, 50%, 300px, 200px
   └─▶ 정렬: 왼쪽, 가운데, 오른쪽
   └─▶ Alt 텍스트: 기본값은 파일명

6. 삽입 버튼 클릭
   └─▶ HTML <img> 태그 생성 (HttpWebServer URL 포함)
       └─▶ @insert 이벤트로 에디터에 전달
```

---

## 생성되는 HTML 형식

### 기본 (너비: auto, 정렬: 왼쪽)
```html
<img src="http://httpwebserver/ARS/EmailImage/ARS_CVD_MODEL1_CODE1_SUB1/uuid" alt="이미지 설명" style="max-width: 100%;">
```

### 너비 지정 (예: 50%)
```html
<img src="http://httpwebserver/ARS/EmailImage/ARS_CVD_MODEL1_CODE1_SUB1/uuid" alt="이미지 설명" style="width: 50%;">
```

### 가운데 정렬
```html
<img src="http://httpwebserver/ARS/EmailImage/ARS_CVD_MODEL1_CODE1_SUB1/uuid" alt="이미지 설명" style="width: 50%; display: block; margin: 0 auto;">
```

### 오른쪽 정렬
```html
<img src="http://httpwebserver/ARS/EmailImage/ARS_CVD_MODEL1_CODE1_SUB1/uuid" alt="이미지 설명" style="width: 50%; float: right; margin-left: 10px;">
```

---

## 파일 제한

| 항목 | 제한 |
|------|------|
| 최대 파일 크기 | 5MB |
| 허용 형식 | JPEG, PNG, GIF, WebP |
| MIME 타입 | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |

---

## 검증 방법

### 1. Backend 테스트 (IMAGE_STORAGE=local)

```bash
# 업로드 테스트
curl -X POST http://localhost:5001/api/images \
  -F "file=@test.png" \
  -F "prefix=ARS_TEST_MODEL_CODE_SUB"

# 목록 조회
curl http://localhost:5001/api/images?prefix=ARS_TEST_MODEL_CODE_SUB

# 삭제
curl -X DELETE http://localhost:5001/api/images/ARS_TEST_MODEL_CODE_SUB/{name}
```

### 2. Frontend 테스트

1. Email Template 페이지 열기
2. 템플릿 선택 후 HTML 편집 모달 열기
3. 이미지 삽입 버튼 클릭
4. 이미지 업로드 확인
5. 업로드된 이미지가 해당 템플릿 prefix로 필터링되는지 확인
6. 이미지 삽입 후 HTML에 올바른 URL이 포함되는지 확인

### 3. HttpWebServer 연동 테스트 (프로덕션 모드)

```bash
IMAGE_STORAGE=httpwebserver HTTPWEBSERVER_URL=http://localhost:8080 npm run dev
```

- 실제 HttpWebServer가 실행 중이어야 테스트 가능

---

## 참고사항

### UTF-8 파일명 처리
Multer는 파일명을 Latin1로 전달하므로, controller에서 UTF-8로 디코딩합니다.

```javascript
function decodeFilename(filename) {
  return Buffer.from(filename, 'latin1').toString('utf8');
}
```

### 캐싱
이미지 조회 시 `Cache-Control: public, max-age=31536000` 헤더로 1년간 캐싱됩니다.

### 인증
이미지 바이너리 조회 (`GET /api/images/:prefix/:name`)는 인증 없이 접근 가능합니다. 이는 이메일 클라이언트에서 이미지를 표시하기 위함입니다.
