# Update Deploy 개선 사항

> 날짜: 2026-03-05

## 1. Deploy 예외 처리 개선

### 1-1. 설정 로딩 실패 시 사용자 피드백

**문제**: `loadSettings()` 실패 시 `console.error`만 출력되고 UI에 표시되지 않음

**수정**:
- `settingsError` ref 추가
- 로딩 실패 시 빨간 배너로 에러 메시지 표시

**파일**: `client/src/features/clients/components/UpdateModal.vue`

### 1-2. 전체 배포 실패 시 에러 메시지 표시

**문제**: 프로필 미존재, 소스 연결 실패 등 전체 실패 에러가 UI에 표시되지 않음

**수정**:
- Summary 영역에서 `result.error` 체크하여 "Deploy failed: ..." 배너 표시

**파일**: `client/src/features/clients/components/UpdateModal.vue`

### 1-3. Directory 태스크 부분 업로드 경고

**문제**: directory 태스크에서 파일 일부만 업로드 후 FTP 에러 발생 시, 불완전한 파일이 클라이언트에 남지만 메시지가 단순함

**수정**:
- 에러 메시지에 진행 상황 포함: `"Failed after uploading 2/5 files: connection lost"`

**파일**: `server/features/clients/updateService.js`

### 1-4. Cancel 후 상태 명확화

**문제**: Cancel 시 `result.value`가 null로 남아 "취소됨" 상태를 구분 불가

**수정**:
- `cancel()` 및 AbortError catch에서 `result = { done: true, cancelled: true }` 설정
- UI에서 "Deploy cancelled" 메시지 표시

**파일**:
- `client/src/features/clients/composables/useUpdateDeploy.js`
- `client/src/features/clients/components/UpdateModal.vue`

### 1-5. 서버 측 에러 로깅

**문제**: 배포 중 에러 및 SSE 연결 끊김 시 서버 로그에 기록 안 됨

**수정**:
- catch 블록에 `console.error` 추가
- SSE aborted 상태에서도 로깅

**파일**: `server/features/clients/updateController.js`

---

## 2. 모달 크기 조정 (Drag / Resize / Maximize)

ConfigManagerModal, LogViewerModal에 이미 있던 크기 조정 기능을 아래 4개 모달에 동일 패턴으로 적용.

| 모달 | 기본 크기 | 파일 |
|------|----------|------|
| UpdateModal | 768 x 600 | `client/.../components/UpdateModal.vue` |
| UpdateSettingsModal | 1024 x 650 | `client/.../components/UpdateSettingsModal.vue` |
| ConfigSettingsModal | 672 x 550 | `client/.../components/ConfigSettingsModal.vue` |
| LogSettingsModal | 768 x 550 | `client/.../components/LogSettingsModal.vue` |

### 기능
- **드래그**: 헤더 영역 드래그로 모달 위치 이동
- **리사이즈**: 우하단 핸들(↘)로 크기 조정
- **최대화/복원**: 헤더 더블클릭 또는 □ 버튼 (95vw x 95vh)
- **닫기 시 리셋**: 위치/크기/최대화 상태 모두 초기화

---

## 3. copyType 필드 제거 — sourcePath 기반 자동 판별

### 배경

기존에는 각 태스크에 `copyType: 'file' | 'directory'` 필드를 수동으로 지정해야 했음.
그러나 `sourcePath`만으로 판별 가능:
- `release/bin/agent.jar` → **file** (trailing `/` 없음)
- `release/config/` → **directory** (trailing `/` 있음)

### 변경 사항

| 위치 | 변경 |
|------|------|
| `server/.../updateService.js` | `isDirectoryTask(task)` 헬퍼 추가, `copyType` 참조 제거 |
| `server/.../updateSettingsModel.js` | `copyType` 스키마 필드 제거 |
| `server/.../updateSettingsService.js` | 정규화/마이그레이션에서 `copyType` 제거 |
| `client/.../UpdateSettingsModal.vue` | Copy Type 컬럼 제거 |
| `client/.../UpdateModal.vue` | `({{ task.copyType }})` 표시 제거 |

### 소스 브라우저 개선

**디렉토리 선택 기능 추가**: 기존에는 디렉토리를 클릭하면 내부로 진입만 가능했고, 디렉토리 자체를 sourcePath로 선택할 수 없었음.

- 하위 폴더 진입 후 하단에 **"Select this folder"** 버튼 표시
- 클릭 시 현재 경로(`browsePath`)가 `sourcePath`에 설정됨 (trailing `/` 포함)

**파일**: `client/.../components/UpdateSettingsModal.vue`

---

## 4. Update Source 접속 테스트

### 기능

FTP, MinIO 소스 설정 후 실제 접속이 되는지 확인하는 테스트 기능.

### 동작 흐름

```
[Test Connection 버튼] → POST /api/clients/update-source/test
  → createUpdateSource(config)
  → source.listFiles('')  (연결 시도 + 루트 파일 목록)
  → source.close()
  → { ok: true/false, message: "Connected successfully (3 items in root)" }
```

### 변경 파일

| 위치 | 변경 |
|------|------|
| `server/.../updateService.js` | `testSourceConnection(sourceConfig)` 함수 추가 |
| `server/.../updateService.test.js` | 접속 성공/실패/close 에러 3개 테스트 |
| `server/.../updateController.js` | `testSourceConnection` 핸들러 추가 |
| `server/.../routes.js` | `POST /api/clients/update-source/test` 라우트 추가 |
| `client/.../api.js` | `updateSettingsApi.testSourceConnection(source)` 추가 (timeout 15s) |
| `client/.../UpdateSettingsModal.vue` | FTP/MinIO 선택 시 "Test Connection" 버튼 + 결과 표시 |

### UI

- Local 타입에서는 버튼 숨김
- FTP/MinIO 선택 시 소스 설정 하단에 버튼 표시
- 테스트 중 스피너 표시, 결과는 초록(성공)/빨강(실패) 텍스트
- 소스 타입 변경 시 결과 초기화

---

## 5. Exec 태스크 + stopOnFail (2026-03-05)

### Task 타입

| 타입 | 설명 | 필수 필드 |
|------|------|----------|
| `copy` | FTP를 통한 파일/디렉토리 업로드 | `sourcePath`, `targetPath` |
| `exec` | Avro RPC를 통한 원격 명령 실행 | `commandLine` |

### 실행 모델

기존 flat 병렬 실행에서 **eqpId별 순차, eqpId간 병렬**로 변경:

```
for each eqpId (병렬, concurrency=3):
  for each task (순차):
    copy → FTP 업로드
    exec → controlService.resolveCommandPath() → controlService.executeRaw()
    if failed && task.stopOnFail → 나머지 태스크 status: 'skipped'
```

### exec 상대경로 해석

`commandLine`이 `./` 또는 `.\`로 시작하면 클라이언트의 `basePath`를 기반으로 절대경로 변환:
- `./bin/install.bat` → `C:/ARS/bin/install.bat` (basePath=`C:/ARS`)
- 절대경로(`C:/Windows/taskkill.exe`)나 PATH 명령어(`net`)는 그대로 전달

### stopOnFail

- `true`: 해당 태스크 실패 시 같은 eqpId의 후속 태스크 모두 `skipped` 처리
- `false` (기본): 실패해도 다음 태스크 계속 실행
- 다른 eqpId에는 영향 없음 (EQP_01 실패해도 EQP_02는 정상 진행)

### 변경 파일

| # | 파일 | 변경 |
|---|------|------|
| 1 | `server/.../updateService.js` | eqpId별 순차 실행, exec 분기, stopOnFail, resolveCommandPath 호출 |
| 2 | `server/.../updateService.test.js` | exec 성공/실패, stopOnFail, 순차 실행, 상대경로 해석 테스트 (10개 추가) |
| 3 | `server/.../controlService.js` | `resolveCommandPath()` 함수 추가 |
| 4 | `server/.../updateSettingsModel.js` | `type`, `stopOnFail`, `commandLine`, `args`, `timeout` 필드 추가 |
| 5 | `server/.../updateSettingsService.js` | cleanProfiles에 exec 필드 정규화 추가 |
| 6 | `server/.../updateController.js` | 태스크 타입별 검증 (copy: sourcePath/targetPath, exec: commandLine) |
| 7 | `client/.../UpdateSettingsModal.vue` | 카드형 태스크 UI, Type 드롭다운, exec 필드, stopOnFail 체크박스 |
| 8 | `client/.../UpdateModal.vue` | exec 태스크 표시, skipped 상태, Deploy 버튼 완료 후 유지 |

---

## 6. Modal UX 개선 (2026-03-05)

- **저장 후 자동 닫기 제거**: UpdateSettingsModal, ConfigSettingsModal, LogSettingsModal — 저장 성공 후 모달이 열려있음
- **Deploy 버튼 유지**: UpdateModal — 배포 완료 후에도 Deploy 버튼 표시, `updateDeploy.reset()` 호출로 재배포 가능

---

## 수정 파일 전체 목록

| # | 파일 | 변경 |
|---|------|------|
| 1 | `server/features/clients/updateService.js` | directory 부분 업로드 에러 메시지, `isDirectoryTask()`, `testSourceConnection()` |
| 2 | `server/features/clients/updateService.test.js` | 부분 업로드 + 접속 테스트 테스트 추가 |
| 3 | `server/features/clients/updateController.js` | 에러 로깅, `testSourceConnection` 핸들러 |
| 4 | `server/features/clients/updateSettingsModel.js` | `copyType` 필드 제거 |
| 5 | `server/features/clients/updateSettingsService.js` | `copyType` 정규화/마이그레이션 제거 |
| 6 | `server/features/clients/updateSettingsService.test.js` | `copyType` 테스트 제거 |
| 7 | `server/features/clients/routes.js` | `/update-source/test` 라우트 추가 |
| 8 | `client/src/features/clients/api.js` | `testSourceConnection` API 추가 |
| 9 | `client/src/features/clients/composables/useUpdateDeploy.js` | cancel 상태 명확화 |
| 10 | `client/src/features/clients/components/UpdateModal.vue` | 에러 UI + 리사이즈 + copyType 제거 |
| 11 | `client/src/features/clients/components/UpdateSettingsModal.vue` | 리사이즈 + copyType 제거 + 폴더 선택 + 접속 테스트 |
| 12 | `client/src/features/clients/components/ConfigSettingsModal.vue` | 리사이즈 |
| 13 | `client/src/features/clients/components/LogSettingsModal.vue` | 리사이즈 |

## 테스트

```bash
cd WebManager/server && npm test   # 126 tests, 8 files — all pass
```
