# 데이터 안전성 검토 보고서

> 검토일: 2026-01-20
> 목적: 운영 시스템 적용 전 데이터 삭제/변경 버그 검토

---

## 요약

| 구분 | 상태 | 비고 |
|------|------|------|
| API 엔드포인트 | ✅ 안전 | 모든 DELETE에 ID 검증 있음 |
| 스크립트 | 🔴 위험 | seedData.js 전체 삭제 가능 |
| 입력 검증 | ✅ 안전 | 필수 필드, 형식, 중복 검사 |
| 권한 검증 | 🟡 미흡 | 인증 미들웨어 없음 |
| 감사 로깅 | 🟡 미흡 | 변경 이력 추적 불가 |

---

## 🔴 즉시 수정 필요

### 1. seedData.js 전체 삭제 위험

**파일**: `server/scripts/seedData.js:55`

```javascript
// 현재 코드 - 위험!
const deleteResult = await Client.deleteMany({});
```

**문제점**:
- 빈 객체 `{}`는 컬렉션의 **모든 문서를 삭제**
- 운영 환경에서 실수로 실행 시 전체 데이터 손실
- 환경 확인이나 확인 프롬프트 없음

**수정 방안**:
```javascript
// 1. 환경 확인 추가
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Cannot run seed script in production');
  process.exit(1);
}

// 2. 확인 프롬프트 추가
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const answer = await new Promise(resolve => {
  rl.question('⚠️  This will DELETE ALL existing data. Type "DELETE" to confirm: ', resolve);
});

if (answer !== 'DELETE') {
  console.log('Aborted.');
  process.exit(0);
}

// 3. 삭제 실행
const deleteResult = await Client.deleteMany({});
```

---

## 🟡 개선 권장 사항

### 2. 권한 검증 미들웨어 추가

**현재 상태**: DELETE/UPDATE API에 인증 검사 없음

**영향받는 파일**:
- `server/features/clients/routes.js`
- `server/features/email-template/routes.js`
- `server/features/users/routes.js`

**수정 방안**:
```javascript
// server/shared/middleware/auth.js
const isAuthenticated = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

module.exports = { isAuthenticated, isAdmin };
```

```javascript
// 라우트에 적용
const { isAuthenticated, isAdmin } = require('../../shared/middleware/auth');

router.delete('/master', isAuthenticated, isAdmin, asyncHandler(deleteMasterData));
router.put('/master', isAuthenticated, asyncHandler(updateMasterData));
```

---

### 3. 감사 로깅 추가

**현재 상태**: 데이터 변경 이력 추적 불가

**수정 방안**:
```javascript
// server/shared/utils/auditLog.js
const logAudit = async (action, collection, details, userId) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    action,      // 'CREATE', 'UPDATE', 'DELETE'
    collection,  // 'Client', 'EmailTemplate', 'User'
    userId,
    details      // { ids: [...], count: N }
  }));

  // 또는 MongoDB에 저장
  // await AuditLog.create({ ... });
};

module.exports = { logAudit };
```

```javascript
// 삭제 시 로깅 추가
const { logAudit } = require('../../shared/utils/auditLog');

async function deleteClients(ids, userId) {
  const result = await Client.deleteMany({ _id: { $in: ids } });

  await logAudit('DELETE', 'Client', {
    ids,
    deletedCount: result.deletedCount
  }, userId);

  return { deleted: result.deletedCount };
}
```

---

### 4. 배치 작업 트랜잭션 지원

**현재 상태**: 배치 업데이트 중 실패 시 일부만 처리됨

**영향받는 파일**:
- `server/features/clients/service.js:255-293` (updateClients)

**수정 방안**:
```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // 배치 작업 수행
  const bulkOps = clientsData.map(data => ({
    updateOne: {
      filter: { _id: data._id },
      update: { $set: data }
    }
  }));

  const result = await Client.bulkWrite(bulkOps, { session });

  await session.commitTransaction();
  return { updated: result.modifiedCount };
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

### 5. 배치 업데이트 성능 최적화

**현재 상태**: N+1 쿼리 (반복문에서 개별 updateOne 호출)

**파일**: `server/features/clients/service.js:262-290`

```javascript
// 현재 코드 - 비효율적
for (let i = 0; i < clientsData.length; i++) {
  const result = await Client.updateOne({ _id }, { $set: updateData });
}
```

**수정 방안**:
```javascript
// bulkWrite 사용
const bulkOps = clientsData
  .filter(data => data._id)
  .map(data => ({
    updateOne: {
      filter: { _id: data._id },
      update: { $set: data }
    }
  }));

const result = await Client.bulkWrite(bulkOps);
return { updated: result.modifiedCount };
```

---

## ✅ 안전하게 구현된 부분

### API 삭제 엔드포인트

모든 DELETE API에서 다음 검증이 구현되어 있음:

```javascript
// 예: clients/controller.js
if (!ids || !Array.isArray(ids) || ids.length === 0) {
  throw ApiError.badRequest('ids array is required');
}

// $in 연산자로 조건부 삭제만 수행
await Client.deleteMany({ _id: { $in: ids } });
```

| 엔드포인트 | 검증 | 상태 |
|-----------|------|------|
| DELETE /api/clients/master | ID 배열 필수, 빈 배열 거부 | ✅ |
| DELETE /api/email-template | ID 배열 필수, 빈 배열 거부 | ✅ |
| DELETE /api/users/:id | 단일 ID 필수 | ✅ |
| DELETE /api/users | ID 배열 필수, 빈 배열 거부 | ✅ |

### 입력 검증

- **clients/validation.js**: IP 형식, 날짜 형식, 중복 검사
- **email-template/routes.js**: 필수 필드, 길이 제한
- **users/routes.js**: 이메일 형식, 역할 화이트리스트

### 보안 설정

- **helmet**: 보안 헤더 자동 설정
- **CORS**: 화이트리스트 기반 origin 관리
- **bcrypt**: 비밀번호 해싱 (SALT_ROUNDS=12)
- **JSON 제한**: 10MB (DoS 방지)

---

## 작업 우선순위

| 우선순위 | 작업 | 예상 작업량 |
|---------|------|-----------|
| 1 (필수) | seedData.js 환경 확인 추가 | 30분 |
| 2 (권장) | 권한 검증 미들웨어 추가 | 2시간 |
| 3 (권장) | 감사 로깅 추가 | 1시간 |
| 4 (선택) | 배치 작업 트랜잭션 | 2시간 |
| 5 (선택) | bulkWrite 최적화 | 1시간 |

---

## 결론

**운영 시스템 적용 전 최소 필수 작업**:
1. seedData.js에 운영 환경 실행 차단 추가

**API를 통한 전체 삭제는 현재 불가능**하므로, 일반적인 사용 시나리오에서는 안전합니다.
