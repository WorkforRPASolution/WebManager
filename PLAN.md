# WebManager 개발 계획

## 전체 Phase 요약

| Phase | 상태 | 내용 |
|-------|------|------|
| Phase 1 | ✅ 완료 | UI 개발 (Mock 데이터) |
| Phase 2 | ✅ 완료 | MongoDB 연결 |
| Phase 3 | ⏳ 대기 | Akka 서버 통합 |

---

# Phase 1 - UI 개발 (Mock 데이터) ✅ 완료

## Overview
Mock 데이터를 사용하여 WebManager의 전체 UI를 구현합니다.
MongoDB 연결 없이 프론트엔드 개발에 집중합니다.

---

## Step 1: 프로젝트 초기화

### 1.1 Frontend (Vue + Vite)
- [x] `client/` 디렉토리에 Vite + Vue 3 프로젝트 생성
- [x] 필수 패키지 설치
  - `vue-router` (라우팅)
  - `pinia` (상태관리)
  - `tailwindcss` (스타일링)
  - `axios` (HTTP 클라이언트)
- [x] Tailwind CSS 설정

### 1.2 Backend (Express)
- [x] `server/` 디렉토리에 Express 프로젝트 생성
- [x] 필수 패키지 설치
  - `express`
  - `cors`
  - `dotenv`
- [x] 기본 서버 설정

### 1.3 프로젝트 루트 설정
- [x] 루트 `package.json` 생성 (concurrently로 client/server 동시 실행)

---

## Step 2: Feature-based 폴더 구조 생성

### 2.1 Frontend 구조
```
client/src/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── clients/
│   ├── alerts/
│   └── settings/
├── shared/
│   ├── components/
│   ├── composables/
│   └── utils/
├── layouts/
├── router/
└── assets/
```

### 2.2 Backend 구조
```
server/
├── features/
│   ├── auth/
│   ├── dashboard/
│   └── clients/
├── shared/
│   ├── middleware/
│   └── mock/        # Mock 데이터
├── app.js
└── index.js
```

---

## Step 3: 공통 모듈 구현

### 3.1 레이아웃
- [x] `DefaultLayout.vue` - 헤더 + 사이드바 + 탭바 + 메인 콘텐츠 영역
- [x] `AuthLayout.vue` - 로그인 페이지용 (사이드바 없음)
- [x] `Header.vue` - 상단 헤더 + 메가 메뉴
- [x] `Sidebar.vue` - 선택된 MainMenu의 SubMenu 표시
- [x] `TabBar.vue` - 하단 탭 바 (다중 페이지 관리)

### 3.2 사이드바 컴포넌트
- [x] 로고 영역 (헤더로 이동)
- [x] 네비게이션 메뉴 (메가 메뉴로 구현)
- [x] 사용자 프로필 영역 (헤더 우측)
- [x] 활성 메뉴 하이라이트

### 3.3 다크/라이트 모드
- [x] `useTheme` composable 구현
- [x] 토글 버튼 컴포넌트
- [x] Tailwind dark mode 설정
- [x] localStorage에 테마 저장

### 3.4 공통 UI 컴포넌트
- [x] `BaseCard.vue` - 카드 컴포넌트
- [x] `BaseButton.vue` - 버튼 컴포넌트
- [x] `BaseInput.vue` - 입력 필드
- [x] `BaseSelect.vue` - 선택 드롭다운
- [x] `StatusBadge.vue` - 상태 배지
- [x] `ProgressBar.vue` - 프로그레스 바

---

## Step 4: 라우터 설정

### 4.1 라우트 구조
```javascript
/login              → LoginView (AuthLayout)
/                   → DashboardView (DefaultLayout)
/clients            → ClientsView (DefaultLayout)
/clients/:id        → ClientDetailView (DefaultLayout)
/alerts             → AlertsView (DefaultLayout)
/settings           → SettingsView (DefaultLayout)
```

### 4.2 네비게이션 가드
- [x] 로그인 여부 확인
- [x] 미인증 시 /login으로 리다이렉트

---

## Step 5: Mock 데이터 생성

### 5.1 클라이언트 Mock 데이터
- [x] Process 목록 (5~10개)
- [x] EqpModel 목록 (Process당 3~5개)
- [x] Client(EqpId) 목록 (총 50~100개)
- [x] 클라이언트 상세 정보 (CPU, Memory, Storage, Latency)
- [x] 로그 데이터

### 5.2 대시보드 Mock 데이터
- [x] 활성 클라이언트 수
- [x] 시스템 업타임
- [x] 에러 수
- [x] 네트워크 트래픽

### 5.3 Backend Mock API
- [x] `GET /api/dashboard/summary`
- [x] `GET /api/clients/processes`
- [x] `GET /api/clients/models?process=xxx`
- [x] `GET /api/clients?process=xxx&model=xxx`
- [x] `GET /api/clients/:id`
- [x] `GET /api/clients/:id/logs`

---

## Step 6: 페이지 구현

### 6.1 Login 페이지
- [x] 로그인 폼 (아이디, 비밀번호)
- [x] 로그인 버튼
- [x] Mock 인증 처리
- [x] 로그인 성공 시 Dashboard로 이동

### 6.2 Dashboard 페이지
- [x] KPI 카드 4개 (Active Clients, Uptime, Errors, Traffic)
- [x] 변화율 표시 (↑ ↓ 아이콘, 퍼센트)
- [x] 카드 색상/스타일 적용

### 6.3 Clients 페이지 (핵심)
- [x] **ProcessList 컴포넌트** - Process 목록 표시/선택
- [x] **ModelList 컴포넌트** - 선택된 Process의 EqpModel 목록
- [x] **ClientList 컴포넌트** - 선택된 Model의 Client 테이블
- [x] 계층 필터링 상태 관리 (Pinia store)
- [x] 클라이언트 클릭 시 상세 페이지 이동

### 6.4 Client Detail 페이지
- [x] 헤더 (클라이언트명, ID, IP, 상태)
- [x] 탭 네비게이션 (Overview, Configuration, Logs)
- [x] **Overview 탭**
  - [x] 시스템 리소스 카드 (CPU, Memory, Storage, Latency)
  - [x] 프로그레스 바 표시
- [x] **Logs 탭**
  - [x] 실시간 로그 스트림 UI
  - [x] 로그 레벨별 색상 (INFO: 흰색, WARN: 노랑, ERROR: 빨강)
- [x] 제어 버튼 (Force Stop, Restart Service)

### 6.5 Alerts 페이지 (기본)
- [x] 알림 목록 테이블
- [x] 알림 상태 (읽음/안읽음)

### 6.6 Settings 페이지 (기본)
- [x] 테마 설정
- [x] 기본 설정 폼

---

## Step 7: 스타일링 마무리

- [x] 반응형 디자인 (모바일/태블릿/데스크톱)
- [x] 호버/포커스 상태
- [x] 로딩 상태 표시
- [x] 에러 상태 표시

---

## Step 8: UI 레이아웃 변경 (추가 완료)

### 8.1 Pinia Store 추가
- [x] `menu.js` - 메뉴 구조 및 상태 관리
- [x] `tabs.js` - 탭 상태 관리

### 8.2 레이아웃 컴포넌트 변경
- [x] `Header.vue` 생성 - 상단 헤더 + 메가 메뉴
- [x] `Sidebar.vue` 수정 - 선택된 MainMenu의 SubMenu만 표시
- [x] `TabBar.vue` 생성 - 하단 탭 바
- [x] `DefaultLayout.vue` 수정 - 헤더/사이드바/탭바 통합

### 8.3 라우터 메타데이터 추가
- [x] 각 라우트에 mainMenu, subMenu, label 메타 정보 추가

---

## 구현 순서 (완료)

1. ✅ **프로젝트 초기화** (Step 1)
2. ✅ **폴더 구조 생성** (Step 2)
3. ✅ **레이아웃 + 사이드바** (Step 3.1, 3.2)
4. ✅ **다크/라이트 모드** (Step 3.3)
5. ✅ **라우터 설정** (Step 4)
6. ✅ **공통 컴포넌트** (Step 3.4)
7. ✅ **Login 페이지** (Step 6.1)
8. ✅ **Mock 데이터 + API** (Step 5)
9. ✅ **Dashboard 페이지** (Step 6.2)
10. ✅ **Clients 페이지** (Step 6.3)
11. ✅ **Client Detail 페이지** (Step 6.4)
12. ✅ **Alerts/Settings 페이지** (Step 6.5, 6.6)
13. ✅ **스타일링 마무리** (Step 7)
14. ✅ **UI 레이아웃 변경** (Step 8) - 메가 메뉴 + 사이드바 + 탭 바

---

## 검증 방법

1. `npm run dev`로 프론트엔드/백엔드 동시 실행
2. 로그인 → Dashboard → Clients → Client Detail 플로우 테스트
3. 다크/라이트 모드 전환 테스트
4. 계층적 필터링 (Process → Model → Client) 동작 확인
5. 메가 메뉴 네비게이션 동작 확인
6. 사이드바 SubMenu 동작 확인 (접기/펼치기)
7. 탭 바 동작 확인 (열기/닫기/전환)

---
---

# Phase 2 - MongoDB 연결 ✅ 완료

## Overview
Mock 데이터를 실제 MongoDB 데이터로 교체합니다.

---

## Step 1: MongoDB 환경 설정

### 1.1 MongoDB 설치
- [x] macOS에 MongoDB 4.4.30 설치
- [x] MongoDB 서비스 시작
- [ ] MongoDB Compass 설치 (GUI 도구, 선택사항)

### 1.2 데이터베이스 설정
- [x] 데이터베이스 생성 (EARS)
- [x] 컬렉션 생성 (EQP_INFO)
- [x] 테스트 데이터 삽입 (71 clients)

---

## Step 2: 서버 MongoDB 연결

### 2.1 패키지 설치
```bash
cd server
npm install mongoose
```

### 2.2 DB 연결 설정
- [x] `server/shared/db/connection.js` - MongoDB 연결 모듈
- [x] `.env`에 MongoDB URI 추가
```
MONGODB_URI=mongodb://localhost:27017/webmanager
```

### 2.3 모델 정의
- [x] `server/features/clients/model.js` - Client 스키마 정의
```javascript
// MongoDBCollections.md 기반 스키마
const clientSchema = new Schema({
  line: String,
  lineDesc: String,
  process: String,
  eqpModel: String,
  eqpId: String,        // PK
  category: String,
  IpAddr: String,       // PK
  IpAddrL: String,
  localpcNunber: Number,
  emailcategory: String,
  osVer: String,
  onoffNunber: Number,
  webmanagerUse: Number,
  installdate: String,
  scFirstExcute: String,
  snapshotTimeDiff: Number,
  usereleasemsg: Number,
  usetkincancel: Number,
});
```

---

## Step 3: API 구현 (Mock → Real)

### 3.1 클라이언트 API
- [x] `GET /api/clients/processes` - distinct process 조회
```javascript
const processes = await Client.distinct('process');
```

- [ ] `GET /api/clients/models?process=xxx` - process별 eqpModel 목록
```javascript
const models = await Client.distinct('eqpModel', { process });
```

- [ ] `GET /api/clients?process=xxx&model=xxx` - 클라이언트 목록
```javascript
const clients = await Client.find({ process, eqpModel: model });
```

- [ ] `GET /api/clients/:id` - 클라이언트 상세
```javascript
const client = await Client.findOne({ eqpId: id });
```

### 3.2 대시보드 API
- [ ] `GET /api/dashboard/summary` - 집계 데이터
```javascript
const activeClients = await Client.countDocuments({ onoffNunber: 1 });
const totalClients = await Client.countDocuments();
```

---

## Step 4: 프론트엔드 API 연동

### 4.1 API 모듈 구현
- [ ] `client/src/features/clients/api.js`
- [ ] `client/src/features/dashboard/api.js`
- [ ] axios 인스턴스 설정 (baseURL, interceptors)

### 4.2 컴포넌트 수정
- [ ] ProcessList.vue - API 호출로 변경
- [ ] ModelList.vue - API 호출로 변경
- [ ] ClientList.vue - API 호출로 변경
- [ ] DashboardView.vue - API 호출로 변경

---

## Step 5: 인증 구현 (선택)

### 5.1 사용자 컬렉션
- [ ] users 컬렉션 생성
- [ ] 비밀번호 해싱 (bcrypt)

### 5.2 JWT 인증
- [ ] `npm install jsonwebtoken bcrypt`
- [ ] 로그인 시 JWT 발급
- [ ] API 요청 시 토큰 검증 미들웨어

---

## 검증 방법

1. MongoDB 연결 확인 (`mongosh`로 데이터 조회)
2. API 테스트 (Postman 또는 curl)
3. 프론트엔드에서 실제 데이터 표시 확인
4. 계층적 필터링이 실제 데이터로 동작하는지 확인

---
---

# Phase 3 - Akka 서버 통합 ⏳ 대기

## Overview
Akka 기반 메인 서버와 WebManager를 연동하여 실시간 데이터 및 제어 기능을 구현합니다.

---

## Step 1: Akka 서버 연동 분석

### 1.1 통신 방식 확인
- [ ] Akka 서버의 REST API 엔드포인트 목록 파악
- [ ] 인증 방식 확인 (API Key, JWT 등)
- [ ] 응답 데이터 형식 분석

### 1.2 필요한 API 목록
- [ ] 클라이언트 상태 조회 API
- [ ] 클라이언트 리소스 (CPU, Memory 등) 조회 API
- [ ] 클라이언트 로그 조회 API
- [ ] 클라이언트 제어 API (restart, stop)

---

## Step 2: 실시간 데이터 연동

### 2.1 폴링 방식
- [ ] 주기적 API 호출로 데이터 갱신 (5~10초 간격)
- [ ] 프론트엔드 auto-refresh 기능

### 2.2 WebSocket 방식 (선택)
- [ ] Akka 서버 WebSocket 지원 시
- [ ] `socket.io` 또는 native WebSocket 사용
- [ ] 실시간 로그 스트리밍
- [ ] 실시간 상태 업데이트

---

## Step 3: 제어 기능 구현

### 3.1 클라이언트 제어 API
- [ ] `POST /api/clients/:id/restart` - Akka 서버로 재시작 명령 전달
- [ ] `POST /api/clients/:id/stop` - Akka 서버로 정지 명령 전달

### 3.2 명령 결과 처리
- [ ] 비동기 명령 결과 확인
- [ ] 성공/실패 알림 표시
- [ ] 상태 자동 갱신

---

## Step 4: 실시간 로그 스트리밍

### 4.1 로그 API 연동
- [ ] Akka 서버 로그 API 호출
- [ ] 로그 레벨 필터링
- [ ] 로그 검색 기능

### 4.2 실시간 로그 표시
- [ ] 새 로그 자동 추가
- [ ] 스크롤 위치 유지
- [ ] 로그 다운로드 기능

---

## Step 5: 대시보드 실시간 데이터

### 5.1 집계 데이터 연동
- [ ] 활성 클라이언트 수 (Akka 서버에서 조회)
- [ ] 시스템 전체 상태
- [ ] 에러/경고 카운트

### 5.2 차트/그래프 추가 (선택)
- [ ] 시간별 트래픽 차트
- [ ] 리소스 사용량 히스토리
- [ ] Chart.js 또는 ApexCharts 사용

---

## Step 6: 알림 시스템

### 6.1 알림 수신
- [ ] Akka 서버에서 알림 이벤트 수신
- [ ] 알림 저장 (MongoDB)

### 6.2 알림 표시
- [ ] 실시간 알림 팝업
- [ ] 사이드바 배지 업데이트
- [ ] 알림 히스토리 페이지

---

## 검증 방법

1. Akka 서버 실행 상태에서 테스트
2. 클라이언트 상태가 실시간으로 반영되는지 확인
3. 제어 명령 (restart/stop) 실제 동작 확인
4. 로그 스트리밍 테스트
5. 알림 수신 테스트

---

## 참고: Akka 서버 API 예상 형식

```
# 클라이언트 상태
GET /akka/clients/:eqpId/status
Response: { status: "ONLINE", cpu: 45, memory: 60, ... }

# 클라이언트 로그
GET /akka/clients/:eqpId/logs?limit=100
Response: [{ timestamp, level, message }, ...]

# 클라이언트 제어
POST /akka/clients/:eqpId/restart
POST /akka/clients/:eqpId/stop
Response: { success: true, message: "Command sent" }
```

---

# 다음 단계 체크리스트

Phase 2 시작 전:
- [ ] MongoDB 로컬 설치 완료
- [ ] 테스트용 클라이언트 데이터 준비

Phase 3 시작 전:
- [ ] Akka 서버 API 문서 확보
- [ ] Akka 서버 테스트 환경 준비
