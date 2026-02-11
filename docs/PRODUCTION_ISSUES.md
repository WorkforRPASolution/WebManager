# 프로덕션 배포 이슈 목록

> 검토일: 2026-02-10
> 목적: 프로덕션 배포 전 EARS DB 안전성 및 운영 안정성 검토

---

## 요약

| # | 이슈 | 심각도 | 영향도 | 상태 |
|---|------|--------|--------|------|
| 1 | ARS_USER_INFO `timestamps: true` | CRITICAL | HIGH | ✅ 수정 완료 |
| 2 | FTP 연결 누수 가능 | HIGH | 중간 | ✅ 수정 완료 |
| 3 | SOCKS 소켓 미정리 | HIGH | 중간 | ✅ 수정 완료 |
| 4 | DB 커넥션 풀 미설정 | HIGH | 낮음 | 🟡 권장 |
| 5 | Graceful shutdown 없음 | HIGH | 낮음 | ✅ 수정 완료 |
| 6 | 배치 작업 크기 제한 없음 | HIGH | 낮음 | 🟡 권장 |
| 7 | JWT Secret 하드코딩 기본값 | CRITICAL | - | 🟡 배포 시 .env 설정으로 해결 |
| 8 | FTP 비밀번호 평문 | CRITICAL | - | 🟡 배포 시 .env 설정으로 해결 |
| 9 | Rate Limiting 없음 | CRITICAL | - | 🟡 권장 |

---

## ✅ 수정 완료

### 이슈 1: ARS_USER_INFO `timestamps: true` (CRITICAL)

**파일**: `server/features/users/model.js`

**문제**: Mongoose `timestamps: true` 설정으로 인해 ARS_USER_INFO 문서에
`createdAt`, `updatedAt` 필드가 자동 추가됨. Akka 서버가 이 필드를 예상하지 않아
직렬화 오류 또는 예기치 않은 동작 발생 가능.

**수정 내용**:
- `timestamps: true` → `timestamps: false`로 변경
- 기존 문서의 `createdAt`, `updatedAt` 필드 `$unset`으로 제거
- `lastLoginAt` 필드도 WEBMANAGER_LOG 기반으로 전환 완료

---

### 이슈 2: FTP 연결 누수 가능 (HIGH) — ✅ 수정 완료

**파일**: `server/features/clients/ftpService.js`

**문제**:
`connectFtp()`에서 SOCKS 터널 소켓 생성 후, FTP 인증/그리팅 과정에서
에러 발생 시 터널 소켓이 정리되지 않음.

**수정 내용**:
- 터널 소켓 생성 후 FTP greeting/login 과정을 `try-catch`로 감싸서
  에러 시 `tunnelSocket.destroy()` + `ftpClient.close()` 호출
- Avro RPC 타임아웃 시에도 소켓 정리되도록 `avroClient.js` 수정
  - 타임아웃 시 `this.disconnect()` 호출
  - `settled` 플래그로 중복 resolve/reject 방지
  - 정상 응답 시 `clearTimeout(timer)`로 타이머 누수 방지

---

### 이슈 3: SOCKS 소켓 미정리 (HIGH) — ✅ 수정 완료

**파일**: `server/shared/utils/socksHelper.js`

**문제**:
`createDirectConnection()`에서 에러 발생 시 소켓을 destroy하지 않음.

**수정 내용**:
- `createDirectConnection()`의 error 핸들러에 `socket.destroy()` 추가
- `createSocksConnection()`은 SocksClient가 내부적으로 소켓을 정리하므로 변경 없음

---

## 🟡 권장 사항

### 이슈 4: DB 커넥션 풀 미설정 (HIGH)

**파일**: `server/shared/db/connection.js`

**문제**: `maxPoolSize`, `socketTimeoutMS` 등 미설정. Mongoose 기본값(100) 사용.

**영향도**: 낮음 - 현재 소수 관리자 사용 규모에서는 기본 풀로 충분.
동시 접속 수십 명 이상이 되면 커넥션 고갈 가능.

---

### 이슈 5: Graceful Shutdown 없음 (HIGH) — ✅ 수정 완료

**파일**: `server/index.js`

**문제**: SIGTERM/SIGINT 핸들러 없음. 서버 재시작 시 진행 중인
FTP 전송/SSE 스트림이 즉시 끊김.

**수정 내용**:
- SIGTERM/SIGINT 핸들러 등록 (중복 호출 방지 플래그)
- 종료 순서: `server.close()` → 5초 대기 → `server.closeAllConnections()` → `closeConnections()` → exit
- SSE의 `res.on('close')` 핸들러가 자동 호출되어 AbortController abort 등 정리
- 강제 종료 타임아웃 10초 (교착 상태 방지)

---

### 이슈 6: 배치 작업 크기 제한 없음 (HIGH)

**파일**: 여러 controller

**문제**: DELETE/UPDATE 배치 API에 배열 크기 제한 없음.

**영향도**: 낮음 - 내부 관리 도구이므로 외부 공격 가능성 낮음.
실수로 대량 요청 시 EARS DB에 부하 발생 가능.

---

### 이슈 7: JWT Secret 하드코딩 기본값 (CRITICAL)

**파일**: `server/shared/utils/jwt.js`

**문제**: `.env`에 JWT_SECRET이 없으면 코드의 기본값 문자열로 토큰 서명.

**조치**: 프로덕션 `.env`에 `crypto.randomBytes(32).toString('hex')` 결과를
JWT_SECRET으로 설정.

---

### 이슈 8: FTP 비밀번호 평문 (CRITICAL)

**파일**: `.env`

**문제**: FTP 비밀번호가 평문으로 저장됨.

**조치**: 프로덕션 환경에서는 Secrets Manager 또는 암호화된 환경변수 사용 권장.
최소한 `.env` 파일 권한을 600으로 제한.

---

### 이슈 9: Rate Limiting 없음 (CRITICAL)

**파일**: `server/app.js`

**문제**: 로그인 등 인증 엔드포인트에 요청 빈도 제한 없음.

**조치**: `express-rate-limit` 미들웨어 추가 권장.
내부망 전용이면 우선순위 낮춤.

---

## EARS DB 쓰기 작업 현황

WebManager가 EARS DB에 수행하는 쓰기 작업 목록:

| 컬렉션 | Create | Update | Delete | 용도 |
|--------|--------|--------|--------|------|
| ARS_USER_INFO | ✅ | ✅ (6곳) | ✅ | 사용자 관리, 인증 |
| EQP_INFO | ✅ | ✅ (2곳) | ✅ | 장비 기준정보 관리 |
| EMAIL_TEMPLATE_REPOSITORY | ✅ | ✅ | ✅ | 이메일 템플릿 관리 |
| EMAILINFO | ✅ | ✅ | ✅ | 이메일 정보 관리 |
| EMAIL_RECIPIENTS | ✅ | ✅ | ✅ | 이메일 수신자 관리 |

**안전 장치**:
- 모든 DELETE에 ID 배열 필수 검증 (빈 `{}` 삭제 불가)
- 모든 쓰기 API에 인증 + 권한 미들웨어 적용
- EARS connection `autoIndex: false` 설정 (인덱스 자동 생성 차단)
- 서버 시작 시 EARS DB에 쓰기 없음 (초기화는 모두 WEBMANAGER DB)

---

## 참고

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 배포 가이드
- [SECURITY_REVIEW.md](./SECURITY_REVIEW.md) - 이전 보안 검토 보고서
- [SCHEMA.md](./SCHEMA.md) - MongoDB 스키마
