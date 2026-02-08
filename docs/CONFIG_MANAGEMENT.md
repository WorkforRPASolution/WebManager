# Config Management (FTP 기반)

Client PC의 Config 파일을 WebManager에서 원격으로 조회/수정/횡전개하는 기능.

## 개요

| 항목 | 내용 |
|------|------|
| Config 파일 수 | 최대 4개 (환경변수 설정) |
| 접속 방식 | FTP (ManagerAgent FTP Server) |
| 라우팅 | Avro RPC와 동일 (직접 or SOCKS5 proxy) |
| Config 포맷 | JSON |
| 적용 방식 | FTP 업로드만 (Client 재시작 안함) |
| Diff 표시 | Monaco DiffEditor |

---

## 아키텍처

```
[WebManager Frontend]
       │
       ▼
[WebManager Server]
       │
       ├─ ipAddrL 없음 → 직접 FTP → ipAddr:FTP_PORT (ManagerAgent)
       │
       └─ ipAddrL 있음 → SOCKS5 터널 경유 FTP
                          ipAddr:SOCKS_PROXY_PORT → ipAddrL:FTP_PORT
```

### FTP 라우팅 규칙

`socksHelper.js`를 공용으로 사용하여 Avro RPC와 동일한 라우팅 로직 적용:

| 조건 | 경로 |
|------|------|
| `ipAddrL` 없음 | WebManager → `ipAddr:FTP_PORT` (직접) |
| `ipAddrL` 있음 | WebManager → `ipAddr:SOCKS_PROXY_PORT` → `ipAddrL:FTP_PORT` (SOCKS5) |

---

## 환경변수

`server/.env`에 추가:

```env
# FTP Settings (ManagerAgent FTP Server, 기본 포트 7181)
FTP_PORT=7181
FTP_USER=ARS
FTP_PASS=ars2015!
FTP_TIMEOUT=30000

# Config file paths (relative to FTP home directory)
CONFIG_FILE_1_NAME=Main Config
CONFIG_FILE_1_PATH=/config/main.json
CONFIG_FILE_2_NAME=Process Config
CONFIG_FILE_2_PATH=/config/process.json
CONFIG_FILE_3_NAME=Network Config
CONFIG_FILE_3_PATH=/config/network.json
CONFIG_FILE_4_NAME=Schedule Config
CONFIG_FILE_4_PATH=/config/schedule.json
```

- Config 파일 경로는 FTP 홈 디렉토리 기준 상대 경로
- 최대 4개까지 설정 가능 (`CONFIG_FILE_1` ~ `CONFIG_FILE_4`)
- `_NAME` 없으면 해당 Config 슬롯 비활성화

---

## API 엔드포인트

| Method | Path | 설명 | 타임아웃 |
|--------|------|------|----------|
| `GET` | `/api/clients/config/settings` | Config 파일 설정 조회 (이름, 경로) | 기본 |
| `GET` | `/api/clients/by-model?eqpModel=X&excludeEqpId=Y` | 횡전개 대상 Client 목록 | 기본 |
| `GET` | `/api/clients/:id/config` | 4개 Config 파일 일괄 읽기 (FTP) | 60초 |
| `PUT` | `/api/clients/:id/config/:fileId` | 단일 Config 파일 저장 (FTP) | 60초 |
| `POST` | `/api/clients/config/deploy` | 횡전개 실행 (SSE 진행률) | SSE |

### 응답 형식

**GET /config/settings**
```json
[
  { "fileId": "config_1", "name": "Main Config", "path": "/config/main.json" },
  { "fileId": "config_2", "name": "Process Config", "path": "/config/process.json" }
]
```

**GET /:id/config**
```json
[
  {
    "fileId": "config_1",
    "name": "Main Config",
    "path": "/config/main.json",
    "content": "{ ... }",
    "error": null
  },
  {
    "fileId": "config_2",
    "name": "Process Config",
    "path": "/config/process.json",
    "content": null,
    "error": "File not found"
  }
]
```

**POST /config/deploy (SSE)**
```
data: {"completed":1,"total":5,"current":"EQP-002","status":"success","error":null}
data: {"completed":2,"total":5,"current":"EQP-003","status":"error","error":"FTP timeout"}
...
data: {"done":true,"total":5,"success":4,"failed":1,"results":[...]}
```

---

## 파일 구조

### Backend

```
server/
├── shared/utils/
│   └── socksHelper.js          # SOCKS5 소켓 생성 공용 유틸 (Avro RPC + FTP 공용)
└── features/clients/
    ├── ftpService.js            # FTP 접속, 파일 읽기/쓰기, 배포, 선택적 머지
    ├── controller.js            # +5 핸들러 (getConfigSettings, getClientsByModel, getClientConfigs, updateClientConfig, deployConfig)
    ├── routes.js                # +5 라우트
    └── service.js               # +getClientsByModel()
```

### Frontend

```
client/src/
├── shared/components/
│   └── MonacoDiffEditor.vue     # Monaco Diff Editor 공용 컴포넌트
└── features/clients/
    ├── api.js                   # +clientConfigApi (60초 타임아웃)
    ├── composables/
    │   └── useConfigManager.js  # Config 상태 관리 composable
    └── components/
        ├── ConfigManagerModal.vue    # Config 관리 풀스크린 모달
        ├── ConfigRolloutPanel.vue    # 횡전개 대상 선택 패널
        ├── ConfigDeployProgress.vue  # 배포 진행률 표시
        ├── JsonTreeSelector.vue      # JSON 키 트리 체크박스
        └── JsonTreeNode.vue          # JSON 트리 노드 (재귀)
```

---

## UI 구성

### Config Manager Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ [Config icon] Config Manager - EQP-001 (ModelX)    [S][M][L][X] │
├─────────────────────────────────────────────────────────────────┤
│ [Main Config] [Process Config] [Network Config] [Schedule Config]│
│                                       [Diff] [Save] [Deploy]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│     Monaco Editor (JSON)  또는  Monaco DiffEditor               │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ ● Modified                                    ModelX  JSON       │
└─────────────────────────────────────────────────────────────────┘
```

- **진입점**: Client List 툴바 Config 버튼 / Client Detail Configuration 탭
- **크기 프리셋**: S(700x500) / M(1000x650) / L(1300x800) + 드래그 리사이즈
- **단축키**: `Ctrl+S` 저장, `Esc` 닫기
- **변경 표시**: 탭에 amber dot으로 변경된 파일 표시

### 횡전개 (Deploy) 패널

Config Manager 모달 내 오른쪽 슬라이드 패널:

```
┌────────────────────────┐
│ Deploy Config     [X]  │
├────────────────────────┤
│ Source: EQP-001        │
│ File: Main Config      │
├────────────────────────┤
│ Deploy Mode:           │
│ ○ Full file            │
│ ● Selected keys only   │
│   [JSON Key Tree]      │
├────────────────────────┤
│ Targets (ModelX):      │
│ ☑ Select All (23)      │
│ ☑ EQP-002  10.0.0.2   │
│ ...                    │
├────────────────────────┤
│ [Progress Bar]         │
│ 3/5 - EQP-004: OK     │
├────────────────────────┤
│ [Execute Deploy]       │
└────────────────────────┘
```

---

## 횡전개 (Deploy) 상세

### 배포 모드

| 모드 | 설명 |
|------|------|
| **Full file** | Source Config 전체를 Target에 덮어쓰기 |
| **Selected keys** | Source에서 선택한 JSON 키만 Target에 머지 |

### 선택적 머지 로직

1. Source JSON에서 선택된 키만 추출
2. 각 Target Client의 현재 Config를 FTP로 읽기
3. Target Config에 선택된 키만 deep merge
4. 머지된 결과를 FTP로 업로드

```
Source: { "database": { "host": "new" }, "logging": { "level": "debug" } }
Selected keys: ["database"]

Target (before): { "database": { "host": "old", "port": 5432 }, "logging": { "level": "info" } }
Target (after):  { "database": { "host": "new", "port": 5432 }, "logging": { "level": "info" } }
```

### 동시 처리

- 기본 5개 병렬 처리 (`concurrency` 파라미터)
- SSE로 실시간 진행률 전송
- 개별 Client 실패 시 나머지 계속 진행

---

## 기술적 주의사항

### FTP + SOCKS5 호환성

`basic-ftp` passive mode에서 데이터 채널도 SOCKS를 통해야 하나, `basic-ftp`이 데이터 연결 시 새 소켓을 직접 생성함. 현재 SOCKS 경유 FTP는 control connection만 터널링.

**대안 (SOCKS 경유 시 문제 발생하면)**:
- Avro RPC의 `RunCommand`로 `cat`/파일 읽기 명령 실행
- `ftpService.js`의 `connectFtp()` 내 SOCKS 부분만 교체

### 타임아웃 설정

| 위치 | 값 | 이유 |
|------|-----|------|
| FTP 클라이언트 (`FTP_TIMEOUT`) | 30초 | FTP 연결/전송 타임아웃 |
| Frontend API (`clientConfigApi`) | 60초 | 4개 파일 순차 읽기 |
| 기본 API (`api/index.js`) | 10초 | 일반 API 호출 |

### JSON 유효성 검사

Config 파일 저장 전 `JSON.parse()` 로 검증. 유효하지 않으면 저장 차단 후 에러 메시지 표시.

---

## 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `basic-ftp` | latest | FTP 클라이언트 |
| `socks` | ^2.8.7 | SOCKS5 프록시 (기존) |
| `monaco-editor` | (기존) | JSON 편집 + Diff 뷰 |
