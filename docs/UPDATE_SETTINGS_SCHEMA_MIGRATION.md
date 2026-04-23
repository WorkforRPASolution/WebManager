# UPDATE_SETTINGS 스키마 마이그레이션 가이드

> **일회성 운영 작업**. 환경별로 한 번 실행 후 스크립트와 부팅 가드는 후속 PR에서 제거됩니다.
> 이 문서는 dev → staging → prod 롤아웃 시 운영자가 참조하는 runbook입니다.

## 마이그레이션 단계 요약

이 컬렉션은 **2단계 마이그레이션**으로 구성됩니다. 순서대로 실행해야 합니다.

| 단계 | 스크립트 | 목적 |
|------|---------|------|
| 1 | `migrate:update-settings` | 레거시 `profiles[]` nesting → per-profile document 변환 |
| 2 | `migrate:update-settings-unique` | `(agentGroup, profileId)` 허수 unique → `(agentGroup, name, osVer, version)` 진짜 unique 교체 |

단계 2는 단계 1이 완료된 환경에서만 실행합니다. 두 단계 모두 idempotent하므로 중간 실패 후 재실행 안전합니다.

---

## 배경

`UPDATE_SETTINGS` 컬렉션 구조를 **agentGroup당 1 doc + profiles[] 배열 중첩**에서
**(agentGroup, profileId) 복합키 per-document**로 정규화합니다.

### Before (legacy)

```javascript
// 1 document per agentGroup
{
  agentGroup: "ars_agent",
  profiles: [
    { profileId: "prof_1", name: "Win v2.0", tasks: [...], source: {...} },
    { profileId: "prof_2", name: "Linux v2.0", tasks: [...], source: {...} }
  ],
  updatedBy: "admin"
}
```

Unique index: `{ agentGroup: 1 }`

### After

```javascript
// N documents per agentGroup (1 per profile)
{ agentGroup: "ars_agent", profileId: "prof_1", name: "Win v2.0", tasks: [...], source: {...}, updatedBy: "admin" }
{ agentGroup: "ars_agent", profileId: "prof_2", name: "Linux v2.0", tasks: [...], source: {...}, updatedBy: "admin" }
```

Unique index: `{ agentGroup: 1, profileId: 1 }` (compound)

### 왜 바꾸나

- **동시 편집 손실 제거**: 서로 다른 profile을 편집하던 두 Admin의 변경이 더 이상 last-write-wins로 소실되지 않음
- **per-profile audit 로그**: `create` / `update` / `delete` 액션이 profile 단위로 분리 기록됨
- **에러 국소화**: profile 1개의 validation 실패가 다른 profile 저장을 막지 않음
- **REST 의미 일치**: `POST /profiles`, `PUT /profiles/:profileId`, `DELETE /profiles/:profileId`가 실제 비즈니스 액션과 1:1 매핑

---

## 사전 요구사항

- **서버 중단 필요**: 마이그레이션 중 애플리케이션이 UPDATE_SETTINGS에 쓰면 안 됨
- **DB 백업**: `mongodump`으로 `UPDATE_SETTINGS` 컬렉션 백업 권장 (아래 절차 참조)
- **신 버전 코드 배포 준비 완료**: 구 버전 서버는 신 shape 문서를 해석하지 못하므로, 마이그레이션 직후 신 버전으로 전환해야 함

### 1. 서버 중단

```bash
# PM2
pm2 stop webmanager-server

# nssm / systemd / Windows 서비스
# → 각 환경 절차에 따라
```

### 2. DB 백업

```bash
mongodump --uri="$WEBMANAGER_DB_URI" \
  --collection=UPDATE_SETTINGS \
  --out=./backup-$(date +%Y%m%d-%H%M%S)
```

롤백 필요 시 `mongorestore --drop --collection=UPDATE_SETTINGS ...`로 복원할 수 있습니다.

---

## 마이그레이션 실행

### 1단계 — Dry-run (변환 결과 미리보기)

실제 DB 변경 없이 몇 개 문서가 어떻게 확장되는지만 출력합니다.

```bash
cd server
npm run migrate:update-settings -- --dry-run
```

출력 예시:

```
=== UPDATE_SETTINGS migration ===
  Mode: DRY RUN (no writes)
  Legacy documents:   2
  Already migrated:   0

=== Result ===
  Legacy docs processed:     2
  Profiles expanded:         3
  New docs upserted:         0
  Legacy docs deleted:       0
```

- `Legacy documents`가 0이면 이미 마이그레이션 완료 상태 — 더 할 일 없음
- `Profiles expanded`는 변환 후 생성될 총 문서 수

### 2단계 — 실제 적용

`--yes`로 확인 프롬프트를 건너뛰거나, 대화형 프롬프트에 `y`를 입력합니다.

```bash
npm run migrate:update-settings -- --yes
```

성공 시 출력 예시:

```
=== Result ===
  Legacy docs processed:     2
  Profiles expanded:         3
  New docs upserted:         3
  Legacy docs deleted:       2
  ✓ Verification passed — no legacy documents remain.
```

### 스크립트가 수행하는 작업 순서

1. `profiles` 필드를 가진 문서를 검색 (`countDocuments` / `find`)
2. 구 인덱스 `agentGroup_1` (unique) drop — 신 compound unique와 충돌하므로 제거 필수. idempotent (이미 없으면 skip)
3. 각 legacy 문서의 `profiles[]`를 풀어 per-profile 문서를 `upsert` (`(agentGroup, profileId)` 키)
4. 신 문서 개수 검증 후에만 구 문서 `deleteOne`
5. 최종 `countDocuments({profiles: {$exists: true}})` === 0 확인

**멱등성 보장**: 재실행해도 이미 신 shape로 존재하면 skip하고 0건 처리. 일부 실패 시에도 구 문서가 남아 재실행 안전.

---

## 서버 재시작

### 부팅 가드

신 코드는 부팅 시 legacy 문서 존재 여부를 검사합니다.

```
[ERROR] UPDATE_SETTINGS contains N legacy documents. Run: npm run migrate:update-settings
[ERROR] Failed to start server: UPDATE_SETTINGS migration required
```

마이그레이션 없이 부팅을 시도하면 **즉시 실패**합니다 — 조용한 데이터 손실 대신 시끄러운 실패를 의도한 설계.

### 정상 기동

```
[INFO]   + UPDATE_SETTINGS collection ready
```

```bash
pm2 start webmanager-server
# 또는 해당 환경의 기동 명령
```

---

## 검증

### 1. 문서 수 및 인덱스 확인

MongoDB Compass 또는 mongosh:

```javascript
use WEB_MANAGER

// 신 shape 문서만 남았는지 (legacy 0개)
db.UPDATE_SETTINGS.countDocuments({ profiles: { $exists: true } })
// → 0

// 컬렉션 총 문서 수 (마이그레이션 전 legacy doc 수와 관련 없이, 총 profile 개수와 일치)
db.UPDATE_SETTINGS.countDocuments()

// 인덱스 확인 — 복합 unique만 있어야 함
db.UPDATE_SETTINGS.getIndexes()
// [
//   { name: "_id_", key: { _id: 1 } },
//   { name: "agentGroup_1_profileId_1", key: { agentGroup: 1, profileId: 1 }, unique: true }
// ]
```

### 2. UI 확인

1. 로그인 → Clients (ARSAgent) → 상단 "Update" 버튼 → UpdateSettings 모달 열림
2. 좌측 패널에 agentGroup의 모든 profile이 보여야 함
3. profile 선택 → 이름/버전 수정 → "Save Profile" → 정상 저장
4. "Add" → 이름 입력 → "Create Profile" → 새 profile 추가
5. "Delete" 버튼 → 확인 → 즉시 DELETE
6. DevTools Network 탭에서 각 동작이 다음 엔드포인트로 나가는지 확인:
   - `GET  /api/clients/update-settings/:agentGroup`
   - `POST /api/clients/update-settings/:agentGroup/profiles`
   - `PUT  /api/clients/update-settings/:agentGroup/profiles/:profileId`
   - `DELETE /api/clients/update-settings/:agentGroup/profiles/:profileId`

### 3. Deploy 회귀

UpdateModal에서 profile 선택 → tasks 체크 → Deploy → SSE 진행률 정상 → 에러 없음. (배포 엔진은 `getProfile(agentGroup, profileId)`만 쓰므로 변경 없음)

### 4. Audit 로그 분리 확인

System Logs 페이지 또는:

```javascript
db.WEBMANAGER_LOG.find({
  collectionName: "UPDATE_SETTINGS"
}).sort({ timestamp: -1 }).limit(5)
```

profile CRUD 액션이 `create` / `update` / `delete`로 분리되어 `documentId: "agentGroup:profileId"` 형식으로 기록되는지 확인.

---

## 문제 해결

### 부팅 실패: "UPDATE_SETTINGS migration required"

→ 마이그레이션 미실행. `npm run migrate:update-settings -- --yes` 실행 후 재기동.

### 부팅 실패: "Index with name: agentGroup_1 already exists with different options"

→ 구 unique 인덱스가 남아 있음. 마이그레이션 스크립트를 다시 실행하면 `dropIndex('agentGroup_1')`가 idempotent하게 정리함. 직접 제거하려면:

```javascript
db.UPDATE_SETTINGS.dropIndex("agentGroup_1")
```

### 마이그레이션 스크립트가 errors를 리포트함

```
=== Result ===
  ...
  Errors:                    1
    - {"agentGroup":"...","message":"..."}
```

- `dropIndex ... failed` → 무시 가능 (idempotent)
- `verification failed: expected N found M` → 일부 profileId의 upsert 실패. 에러 메시지를 보고 원인 해결 후 재실행 (idempotent)
- 복구 불가 시 mongorestore로 백업 복원

### 운영 중 레거시 문서가 다시 생김

이는 구 버전 서버가 여전히 돌아가는 경우에만 가능합니다. 구 버전 인스턴스를 모두 내리고 마이그레이션을 재실행하세요. 코드 롤백이 필요한 경우 전체 버전을 구 버전으로 되돌리고 DB도 백업에서 복원해야 합니다.

---

## 단계 2 — Unique index 강화 (`migrate:update-settings-unique`)

### 배경

단계 1 후 unique index는 `(agentGroup, profileId)`지만, `profileId`는 시스템이 발급하는 UUID이기 때문에 이 조합은 **절대 충돌할 수 없는 허수 unique** — DB 제약이 실질적으로 아무것도 방어하지 않습니다.

사용자가 UpdateModal dropdown에서 profile을 고를 때 보는 식별자는 `{name} ({osVer||'All OS'}) v{version}`입니다. 이 화면 문자열이 **완전히 동일한 두 profile이 DB에 공존할 수 있어** 잘못된 배포 위험이 있습니다.

단계 2는 unique를 `(agentGroup, name, osVer, version)`으로 교체해 화면 문자열 유일성을 DB 레벨로 끌어올립니다. `profileId`는 REST URL과 audit documentId 식별자로 유지되며 non-unique lookup index로 재생성됩니다.

### 2-1. Dry-run으로 중복 사전 점검

```bash
cd server
npm run migrate:update-settings-unique -- --dry-run
```

출력 시나리오:

- `✓ New unique index already present — nothing to do.` → 이미 완료 상태, 할 일 없음
- `Duplicate ... groups: 0` + `✓ No duplicates. Apply mode would swap the index.` → 안전, 다음 단계 진행
- `⚠ Duplicates block the new unique index:` → **수동 정리 필요** (아래 2-2 참조)

### 2-2. 중복이 발견된 경우 수동 정리

출력에 나열된 그룹 각각에 대해:

```
agentGroup=ars_agent  name="Win v2.0"  osVer="Windows 11"  version="2.0"  count=2
  [0] profileId=prof_a1b2  updatedAt=2026-03-01T...
  [1] profileId=prof_c3d4  updatedAt=2026-04-10T...
```

가장 최신 `updatedAt`을 기준으로 유지할 profile을 결정하고, 나머지는 MongoDB Compass 또는 mongosh로 직접 삭제하거나 Web UI에서 이름을 변경합니다.

```javascript
db.UPDATE_SETTINGS.deleteOne({ _id: ObjectId("...") })  // 중복 profileId의 _id
```

정리 후 dry-run을 재실행해 0 확인 후 apply 진행.

### 2-3. 실제 적용

```bash
npm run migrate:update-settings-unique -- --yes
```

성공 시 출력:
```
=== Result ===
  Legacy index dropped:      true
  New unique index created:  true
  ✓ Unique index swap complete.
```

### 2-4. 검증

MongoDB Compass 또는 mongosh:

```javascript
db.UPDATE_SETTINGS.getIndexes()
// 기대 결과:
// [
//   { name: "_id_", key: { _id: 1 } },
//   { name: "agentGroup_name_osVer_version_unique",
//     key: { agentGroup: 1, name: 1, osVer: 1, version: 1 }, unique: true },
//   { name: "agentGroup_1_profileId_1", key: { agentGroup: 1, profileId: 1 } }
// ]
```

부팅 가드가 신 unique index 부재 시 즉시 throw하므로, 서버가 정상 기동하면 단계 2도 성공적으로 적용된 것입니다.

### 2-5. 문제 해결

**부팅 실패: "UPDATE_SETTINGS unique index migration required"**

→ 단계 2 미실행. `npm run migrate:update-settings-unique -- --yes` 실행 후 재기동.

**apply 시 E11000 duplicate key**

→ dry-run을 건너뛰고 apply를 돌려서 중복이 걸린 케이스. 스크립트는 실패 후 상태를 남기지 않으므로, dry-run으로 중복 확인 후 재시도.

---

## 롤백

### 코드만 롤백 (DB는 신 shape 유지)

**불가능**. 구 버전 서버는 신 shape 문서(`profileId`는 있지만 `profiles` 필드가 없는 document)를 인식하지 못합니다.

### 완전 롤백 (DB + 코드)

1. 서버 중단
2. `mongorestore --drop --collection=UPDATE_SETTINGS` 백업 복원
3. 구 버전 코드 배포
4. 서버 재기동

---

## 롤아웃 후 정리

모든 환경(dev, staging, prod)에서 마이그레이션이 완료되고 **신 버전 서버가 안정적으로 운영**된 후:

1. 후속 PR에서 다음 파일들 삭제/제거:
   - `server/scripts/migrate-update-settings.js`
   - `server/scripts/migrate-update-settings.test.js`
   - `server/scripts/tighten-update-settings-unique.js`
   - `server/scripts/tighten-update-settings-unique.test.js`
   - `server/scripts/scan-update-settings-duplicates.js`
   - `server/scripts/lib/scanUpdateSettingsDuplicates.js`
   - `server/scripts/lib/scanUpdateSettingsDuplicates.test.js`
   - `server/package.json`의 `migrate:update-settings` / `migrate:update-settings-unique` 스크립트 항목
   - `server/features/clients/updateSettingsService.js`의 부팅 가드 2개 블록 (legacy shape + new unique index 체크)
   - `docs/UPDATE_SETTINGS_SCHEMA_MIGRATION.md` (이 문서)
2. `docs/SCHEMA.md` UPDATE_SETTINGS 섹션에서 "마이그레이션" 소단락 제거 또는 historical note로 축약
3. `docs/DEPLOYMENT.md` 업그레이드 섹션의 포인터 제거

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `server/scripts/migrate-update-settings.js` | 단계 1: 레거시 `profiles[]` → per-profile 변환 (일회성) |
| `server/scripts/migrate-update-settings.test.js` | 단계 1 단위 테스트 (idempotent + dropIndex 검증) |
| `server/scripts/tighten-update-settings-unique.js` | 단계 2: unique index 강화 스크립트 (일회성) |
| `server/scripts/tighten-update-settings-unique.test.js` | 단계 2 단위 테스트 (중복 차단 + idempotent + index swap) |
| `server/scripts/scan-update-settings-duplicates.js` | 중복 사전 점검 (read-only) |
| `server/scripts/lib/scanUpdateSettingsDuplicates.js` | 중복 aggregate 공용 모듈 |
| `server/features/clients/updateSettingsModel.js` | 신 스키마 (per-profile document) |
| `server/features/clients/updateSettingsService.js` | 부팅 가드 + per-profile CRUD |
| `server/features/clients/updateController.js` | 4개 REST 엔드포인트 |
| `server/features/clients/routes.js` | 라우트 등록 |
| `client/src/features/clients/api.js` | 프론트 `updateSettingsApi` per-profile 메서드 |
| `client/src/features/clients/components/UpdateSettingsModal.vue` | 액션 기반 모달 (per-profile Save) |
| `docs/SCHEMA.md` | UPDATE_SETTINGS 스키마 정의 |
