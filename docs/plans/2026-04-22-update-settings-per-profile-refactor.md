# UPDATE_SETTINGS — Per-Profile 문서 + REST 분리 리팩터

> **Status: 구현 완료 (2026-04-22)**. 운영자용 마이그레이션 runbook은 [../UPDATE_SETTINGS_SCHEMA_MIGRATION.md](../UPDATE_SETTINGS_SCHEMA_MIGRATION.md) 참조.
> 스키마 정의는 [../SCHEMA.md](../SCHEMA.md)의 UPDATE_SETTINGS 섹션 참조.

## Context

현재 `UPDATE_SETTINGS`는 `agentGroup`당 1 document에 `profiles[]` → `tasks[]`의 2중 중첩 배열을 담고 있다 (`server/features/clients/updateSettingsModel.js:33-42`). 운영 예상 규모(profile 10~20개)에서 MongoDB 16MB 한도와는 무관하지만, **구조적으로 다음 문제가 누적**되고 있다:

1. **저장 의미론이 RPC형 벌크 변경** — `PUT /api/clients/update-settings/:agentGroup`이 `{ profiles: [...] }` 전체를 받아 `$set`으로 치환 (`updateSettingsService.js:172-175`). 두 Admin이 서로 다른 profile을 동시 편집하면 **전송-레이어 last-write-wins**로 한쪽 작업이 통째로 사라진다.
2. **Audit 로그가 재구성적** — 서버가 새/구 배열을 diff해서 사용자 의도(생성/수정/삭제)를 추론한다 (`updateSettingsService.js:179-190`). 사용자 행동이 API 호출에 직접 표현되지 않는다.
3. **에러 처리가 all-or-nothing** — profile 1개의 validation 실패가 **전체 저장 실패**로 이어진다.
4. **프론트엔드 상태 기계가 무거움** — `UpdateSettingsModal.vue`(623라인)의 상당 부분이 "로컬 profiles 배열 + dirty tracking + 일괄 validate → Save" 패턴이다.
5. **Copy & Paste가 의미적으로 분리됨** — paste는 로컬 배열 변경이고, 실제 영속화는 사용자가 Save를 눌러야 일어남.

**목표**: DB를 `(agentGroup, profileId)` 복합키 per-document로 정규화하고, HTTP API를 per-profile REST CRUD로 분리하여 위 5개 문제를 동시에 해소한다. `updateService.deployUpdate`는 이미 `getProfile(agentGroup, profileId)`로 키 기반 조회 중이라(`updateService.js:79`) 배포 엔진 변경은 불필요하다.

---

## 설계

### 1. DB 스키마 (Backend)

**파일:** `server/features/clients/updateSettingsModel.js` (전면 재작성)

```js
// 신규: 1 document = 1 profile
const updateProfileSchema = new mongoose.Schema({
  agentGroup: { type: String, required: true, index: true },
  profileId:  { type: String, required: true },
  name:       { type: String, required: true },
  osVer:      { type: String, default: '' },
  version:    { type: String, default: '' },
  tasks:      { type: [taskSchema], default: [] },   // 기존 taskSchema 그대로 재사용
  source:     { type: mongoose.Schema.Types.Mixed, default: null },
  updatedBy:  { type: String, default: '' },
}, { timestamps: true, collection: 'UPDATE_SETTINGS' });

updateProfileSchema.index({ agentGroup: 1, profileId: 1 }, { unique: true });
```

- 컬렉션명은 `UPDATE_SETTINGS` 유지 (마이그레이션 후 동일 컬렉션 내 문서 형태만 변경).
- `taskSchema`는 기존 정의(`updateSettingsModel.js:11-22`) 그대로 재사용.
- `agentGroup` 단독 unique 인덱스 → `(agentGroup, profileId)` 복합 unique로 교체.

### 2. 마이그레이션 (One-shot 스크립트 + 부팅 가드)

자동 마이그레이션을 `initializeUpdateSettings`에 넣지 **않는다**. 한 번 실행하면 영구 데드코드가 되고, 매 부팅마다 무용한 detect 쿼리가 돌기 때문 (현재 `packages → tasks` A/B 마이그레이션이 같은 이유로 누적된 부채). 대신 다음 두 단계로 분리:

#### 2-1. 일회성 마이그레이션 스크립트

**신규 파일:** `server/scripts/migrate-update-settings.js`

- `WEBMANAGER_DB_URI` 연결 후 `UPDATE_SETTINGS` 컬렉션 처리
- `--dry-run` 플래그: 변환 결과만 출력, DB 변경 없음
- `--yes` 플래그: 확인 프롬프트 생략 (CI/배포 자동화용)
- **Detect**: `profiles` 필드를 가진 문서를 검색
- **For each old doc**: `profiles[]`의 각 원소를 `(agentGroup, profileId)` 단일 문서로 `bulkWrite` upsert. profileId 누락 시 기존 `cleanProfiles`의 ID 자동 생성 로직(`updateSettingsService.js:45-65`) 재활용
- **Cleanup**: 신규 문서가 모두 저장된 것을 검증(count 일치)한 후에만 구 문서 삭제
- **Idempotency**: 같은 `(agentGroup, profileId)` 조합이 이미 신규 형태로 존재하면 skip — 재실행 안전
- **Logging**: before/after 카운트, 변환 요약, 실패 항목 winston 출력
- `package.json`에 `npm run migrate:update-settings` 등록
- **롤아웃 절차**: dev → staging → prod 순으로 운영자가 수동 실행
- **모든 환경 마이그레이션 완료 후 후속 PR로 스크립트 삭제** (TODO 주석으로 명시)

#### 2-2. 부팅 시 가드 (Loud failure)

**파일:** `server/features/clients/updateSettingsService.js` `initializeUpdateSettings()`에 5줄 추가

```js
const legacyCount = await UpdateSettings.countDocuments({ profiles: { $exists: true } });
if (legacyCount > 0) {
  log.error(`UPDATE_SETTINGS contains ${legacyCount} legacy documents. Run: npm run migrate:update-settings`);
  throw new Error('UPDATE_SETTINGS migration required');
}
```

- 운영자가 마이그레이션을 잊었을 때 **조용한 데이터 손실 대신 부팅 중단** → 시끄러운 실패 모드
- 가드 자체도 마이그레이션 완료 후 **후속 PR로 제거 가능** (선택)

#### 2-3. Dev 시드/픽스처

- 시드 스크립트가 UPDATE_SETTINGS를 채운다면 **신 shape로 직접 작성**
- 기존 구 shape 픽스처는 마이그레이션 스크립트 회귀 테스트 목적으로만 보존

#### 2-4. 범위 외

기존 `packages → tasks` 마이그레이션 두 단계(`updateSettingsService.js:67-156`)는 같은 데드코드 문제를 안고 있지만 **이번 PR 범위에서 제외**. 별도 정리 PR로 분리.

### 3. 서비스 레이어 (Backend)

**파일:** `server/features/clients/updateSettingsService.js` (재작성)

`createCrudService` 팩토리(`server/shared/utils/createCrudService.js`) 활용해 audit 자동 처리. 신규 export:

| 함수 | 시그니처 | 비고 |
|------|---------|------|
| `listProfiles(agentGroup)` | → `Profile[]` | `find({ agentGroup }).lean()` |
| `getProfile(agentGroup, profileId)` | → `Profile \| null` | 시그니처 유지 (배포 엔진 호환) |
| `createProfile(agentGroup, data, updatedBy)` | → `Profile` | profileId/taskId 자동 생성, audit `created` |
| `updateProfile(agentGroup, profileId, data, updatedBy)` | → `Profile` | `findOneAndUpdate`, audit `updated` (per-profile diff) |
| `deleteProfile(agentGroup, profileId, updatedBy)` | → `void` | audit `deleted` |

기존 `cleanProfiles`는 `cleanProfile`(단일 profile 정규화)로 분리. `sanitizeSource` 헬퍼는 그대로 재사용. 기존 `saveUpdateSettings`/`getDocument`/구 `cleanProfiles`는 **제거** (deprecated 윈도우 없음 — 마이그레이션과 동시 컷오버).

### 4. HTTP API (Backend)

**파일:** `server/features/clients/updateController.js`, `routes.js`

**신규 엔드포인트:**
```
GET    /api/clients/update-settings/:agentGroup                       # listProfiles → { agentGroup, profiles: [...] } (UI 호환)
POST   /api/clients/update-settings/:agentGroup/profiles              # createProfile
PUT    /api/clients/update-settings/:agentGroup/profiles/:profileId   # updateProfile
DELETE /api/clients/update-settings/:agentGroup/profiles/:profileId   # deleteProfile
```

**제거:** `PUT /api/clients/update-settings/:agentGroup` (전체 배열 replace)

GET 응답은 `{ agentGroup, profiles: [...] }` shape 유지 — 모달이 listing 시 해당 shape를 기대 (단순 collection 표현이라 의미론 충돌 없음).

### 5. 프론트엔드 (Client)

**파일:** `client/src/features/clients/api.js` (또는 `updateSettingsApi`가 정의된 파일)
- `getSettings(agentGroup)` 유지
- `createProfile(agentGroup, profile)` 추가
- `updateProfile(agentGroup, profileId, profile)` 추가
- `deleteProfile(agentGroup, profileId)` 추가
- `saveSettings(agentGroup, profiles)` **제거**

**파일:** `client/src/features/clients/components/UpdateSettingsModal.vue` (액션 기반 재설계)
- 로컬 profiles 배열 dirty tracking 제거
- "Add Profile" 클릭 → 즉시 `POST` → 응답으로 profileId 채움
- 각 profile 편집 폼에 개별 "Save Profile" 버튼 → 해당 profile만 `PUT`
- "Delete Profile" → 즉시 `DELETE` (확인 모달 유지)
- 모달 하단 일괄 "Save" 버튼 제거
- 검증은 per-profile (현재 `validate()` 로직을 단일 profile 단위로 재구성)
- 변경 후 모달 라인 수 감소 예상 (623 → ~400 추정)

**파일:** `client/src/features/clients/utils/updateProfileUtils.js`
- `createProfileFromSnapshot` 호출부에서 paste = `POST` 즉시 커밋으로 의미 변경
- `filterProfilesByClientOs`, `createProfileSnapshot` 시그니처는 유지 (UI 헬퍼 역할)

**파일:** `client/src/features/clients/components/UpdateModal.vue` — **변경 불필요** (이미 profileId 기반 선택)

### 6. 테스트 (TDD)

**수정:**
- `server/features/clients/updateSettingsService.test.js` — per-profile CRUD 테스트 신규, 기존 `saveUpdateSettings`/`cleanProfiles` 테스트 재구성
- `server/features/clients/updateController.test.js` — 4개 신규 엔드포인트 테스트, `PUT { profiles }` 테스트 제거
- `server/features/clients/updateService.test.js` — `getProfile` 호환 회귀 확인 (변경 최소)
- `client/.../updateProfiles.test.js` — paste 의미 변경 반영

**신규:**
- `server/scripts/migrate-update-settings.test.js` — 구 shape 시드 → 스크립트 실행 → 신 shape 검증 + idempotent 재실행 검증 + dry-run 검증
- 부팅 가드 테스트: 구 shape 잔존 시 `initializeUpdateSettings`가 throw 하는지 검증
- 동시 편집 회귀 테스트: 두 client가 서로 다른 profileId 동시 PUT → 모두 성공, 데이터 손실 없음

### 7. 문서

- `docs/SCHEMA.md` UPDATE_SETTINGS 섹션 (현 라인 576-686) 재작성: 신 스키마, 복합 인덱스, 마이그레이션 노트
- `WebManager/CLAUDE.md` API Endpoints 블록의 update-settings 항목 갱신 (4개 엔드포인트로 교체)

---

## 영향 받는 파일 (요약)

**Backend (수정):**
- `server/features/clients/updateSettingsModel.js`
- `server/features/clients/updateSettingsService.js`
- `server/features/clients/updateController.js`
- `server/features/clients/routes.js`
- `server/package.json` (`migrate:update-settings` npm script 등록)

**Backend (신규):**
- `server/scripts/migrate-update-settings.js` (일회성, 롤아웃 후 삭제 예정)
- `server/scripts/migrate-update-settings.test.js`

**Backend (검증만, 변경 없음):**
- `server/features/clients/updateService.js` (`getProfile` 호출 호환)
- `server/features/clients/agentInfoSyncService.js` (UPDATE_SETTINGS 미참조 확인됨)
- `server/index.js` (`initializeUpdateSettings` 호출 그대로)

**Frontend (수정):**
- `client/src/features/clients/api.js` (또는 updateSettingsApi 위치)
- `client/src/features/clients/components/UpdateSettingsModal.vue`
- `client/src/features/clients/utils/updateProfileUtils.js`

**Tests (수정 + 신규):**
- 위 7번 항목 참조

**Docs (수정):**
- `docs/SCHEMA.md`
- `WebManager/CLAUDE.md`

---

## 재사용 자산

- `createCrudService` (`server/shared/utils/createCrudService.js`) — audit 로깅 자동 처리
- `taskSchema` (현 `updateSettingsModel.js:11-22`) — 신 스키마에 그대로 재사용
- `sanitizeSource` (현 `updateSettingsService.js` 내부) — source 필드 정제 로직 보존
- `cleanProfile` (현 `cleanProfiles`에서 단일 profile 정규화 로직 분리)
- 기존 마이그레이션 패턴 (`updateSettingsService.js:67-156` packages→tasks A/B) — 신 단계 C도 동일 구조로 작성
- `useToast` composable — 모달 액션 결과 알림에 그대로 사용

---

## 빌드 시퀀스

1. **Schema** — `updateSettingsModel.js` 신 스키마 작성 + 기존 `taskSchema` 분리 export
2. **Migration script + 부팅 가드** — `scripts/migrate-update-settings.js` + 테스트 + `initializeUpdateSettings` 가드 5줄 추가
3. **Service** — per-profile CRUD 함수 + `createCrudService` 통합 + 단위 테스트
4. **Controller + Routes** — 4개 엔드포인트 + 컨트롤러 테스트
5. **Backend 회귀** — `updateService.test.js` + 통합 테스트로 배포 엔진 무영향 확인
6. **Frontend api 레이어** — 신규 4개 메서드 추가
7. **UpdateSettingsModal 재설계** — 액션 기반 UX, 일괄 Save 제거
8. **updateProfileUtils paste 변경** — 즉시 POST
9. **수동 UI 테스트** (검증 섹션 참조)
10. **문서 갱신** — SCHEMA.md + CLAUDE.md (마이그레이션 절차 명시)
11. **Cleanup** — 구 `saveUpdateSettings`/`getDocument` 제거 (PR 동일 커밋)
12. **롤아웃 후속 PR** (별도) — 모든 환경 마이그레이션 완료 확인 후 `scripts/migrate-update-settings.js` 및 부팅 가드 제거

---

## 검증

### 자동화
```bash
cd server && npm test -- updateSettings updateController updateService migrate-update-settings
cd client && npm test -- UpdateSettingsModal updateProfiles
```
- 마이그레이션 스크립트 idempotency + dry-run 테스트 통과
- 부팅 가드 테스트 통과 (구 shape 잔존 시 throw)
- 동시 편집 회귀 테스트 통과
- 기존 배포 엔진 테스트 회귀 없음

### 수동 (마이그레이션 + UI)
1. 구 shape 시드된 dev DB 준비 → `cd server && npm run migrate:update-settings -- --dry-run` 결과 확인
2. `cd server && npm run migrate:update-settings -- --yes` 실제 실행 → before/after 카운트 일치 확인 → MongoDB Compass로 신 shape 확인
3. 가드 테스트: 마이그레이션 안 한 dev DB로 서버 시작 → 부팅이 즉시 중단되고 winston error 메시지 출력 확인
4. 마이그레이션 후 서버 정상 부팅 → UpdateSettingsModal 열기:
   - "Add Profile" → 즉시 새 profile 생성 (Network 탭에서 POST 확인, profileId 응답 확인)
   - profile 필드 편집 + "Save Profile" → 해당 profile만 PUT (다른 profile 영향 없음)
   - "Delete Profile" → DELETE 호출 후 모달 새로고침
   - 기존 profile Copy & Paste → 새 profile이 즉시 서버에 생성되는지 확인
5. 두 브라우저 탭에서 같은 agentGroup 모달 열기:
   - 탭 A: profile 1 편집 + Save
   - 탭 B: profile 2 편집 + Save (탭 A 변경 미인지 상태)
   - 두 변경 모두 DB에 보존됨 (구 구조에서는 손실)
6. UpdateModal에서 배포 실행:
   - profile 선택 → tasks 체크 → Deploy → SSE 진행률 정상 → 회귀 없음
7. SystemLogs(Audit) 페이지:
   - `createProfile` / `updateProfile` / `deleteProfile` 액션 항목이 분리되어 표시되는지 확인

### 마이그레이션 롤백 시나리오
- 스크립트 실행 전 운영 절차로 `UPDATE_SETTINGS` 컬렉션 mongodump 백업 필수
- 실패 시: 스크립트는 신 문서 count 검증 후에만 구 문서 삭제하므로 부분 실패 시 구 문서가 남아 재실행 가능 (idempotent)
- 완전 롤백 필요 시: mongorestore로 백업 복원 + 코드 롤백 (이전 버전 배포)

---

## 구현 완료 후 원본 계획 대비 변경 사항

계획 작성 시점의 의도와 실제 구현 간 의미 있는 deviation:

1. **`createCrudService` 팩토리 미사용** — 이 팩토리는 `_id` 기반 배열 CRUD에 최적화되어 있고, `(agentGroup, profileId)` 복합키·단일 리소스 조작 패턴과 맞지 않음. 대신 `webmanagerLogModel`의 `createAuditLog` + `calculateChanges`를 직접 호출하여 per-profile audit 로그를 기록 (기존 service 코드가 이미 쓰던 패턴).

2. **Paste 동작은 "즉시 POST"가 아닌 "로컬 NEW placeholder + Save Profile"** — 원 계획은 paste = 즉시 persistence였으나, Add Profile과 의미 대칭성을 위해 둘 다 로컬 placeholder를 만들고 사용자가 "Save Profile"(신규) / "Create Profile"(신규, 미저장) 버튼으로 명시적으로 commit하도록 통일. `createProfileFromSnapshot` util이 `_dirty: true`를 포함해 반환.

3. **부팅 가드 순서 재조정** — 계획에서는 `await UpdateSettings.createIndexes()` 뒤에 가드를 배치했으나, 구 `agentGroup_1` unique 인덱스가 신 compound unique와 충돌하여 `createIndexes()`가 "Index already exists with different options"로 실패하므로 가드가 트리거되지 못함. 가드를 `createIndexes()` **앞으로** 이동하고, 마이그레이션 스크립트에 구 인덱스 `dropIndex('agentGroup_1')` 단계를 추가 (idempotent).

4. **단일 필드 인덱스 `{ agentGroup: 1 }` 제거** — 계획에서는 목록 조회용으로 별도 선언했으나, MongoDB 복합 인덱스 leftmost-prefix 매칭으로 `find({ agentGroup })` 쿼리가 커버되므로 불필요. 스키마에서 제거.

5. **검증 단계에서 Playwright E2E로 확장** — 계획의 "수동 UI 테스트"를 Playwright MCP로 자동 실행. 부팅 가드 확인 → dry-run → 마이그레이션 → 로그인 → 모달 CRUD → 동시 편집 회귀(Promise.all 병렬 PUT으로 양쪽 변경 보존 확인) → Audit 로그 확인까지 전 경로 스크립트화.
