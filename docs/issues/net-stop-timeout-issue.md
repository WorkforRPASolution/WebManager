# Issue: net stop 명령 Java ManagerAgent timeout

## 상태: 수정 완료 (테스트 대기)

## 요약

Windows 서비스 제어를 `sc stop` (비동기) → `net stop` (동기)으로 전환했으나,
Java ManagerAgent의 ExecuteWatchdog가 `net stop` 프로세스를 timeout으로 강제 종료하여
RPC 응답이 "timeout" 에러로 반환됨. 실제 서비스는 정상 중지됨.

## 환경

- OS: Windows (한글)
- 브랜치: `refactor/service-control-sc-to-net`
- 대상 파일: `arsAgentWinSc.js`, `resourceAgentWinSc.js`

## 증상

| 항목 | 내용 |
|------|------|
| 명령 | `net stop ARSAgent` |
| 설정 timeout | 45000ms (strategy) → Java request로 전달 |
| 실제 에러 발생 시점 | ~10초 후 |
| 에러 내용 | Avro RPC callback에서 `err = "timeout"` (string) |
| 서비스 실제 상태 | 정상 중지됨 (SCM이 stop 신호를 먼저 수신했으므로) |
| UI 표시 | Failed + status: unknown |

## 재현 조건

- 항상 재현되지 않음 (간헐적)
- `net stop`이 빠르게 완료되면 (서비스가 즉시 중지) → 정상 성공
- `net stop`이 Java watchdog timeout보다 오래 걸리면 → timeout 에러

## 성공 시 RPC 응답

```json
{
  "success": true,
  "error": "",
  "output": "ARSAgent 서비스를 멈춥니다....\r\nARSAgent 서비스를 잘 멈추었습니다.\r\n\r\n"
}
```

## 실패 시 RPC 응답

```
executeRaw THREW → err = "timeout" (string, not Error object)
```

- Avro RPC callback의 `err` 파라미터가 문자열 `"timeout"`
- `err.message`가 `undefined` (string이므로 `.message` 프로퍼티 없음)
- JS측 safety timeout (50s)이 아닌, Java측에서 반환한 에러

## 원인 분석

### 디버깅 이력

1. `controlService.js`에 DEBUG 로그 추가 → 성공 시 rpcResult 확인
2. `executeRaw` try-catch 추가 → 실패 시 `RPC call failed: undefined` 확인
3. `avroClient.js`에 err 객체 상세 로그 → `err = "timeout"` (string) 확인
4. Java ManagerAgent 소스 확인 → **Java는 정상** (`request.getTimeout()` 사용)

### 근본 원인: avsc 라이브러리 RPC 호출 timeout

Java ManagerAgent 코드 (`ExecCommandAvroImpl.java`):
```java
ExecuteWatchdog watchdog = new ExecuteWatchdog(request.getTimeout()); // 45000ms 정상 사용
```

**Java는 request의 timeout을 정확히 사용하고 있었음.** 문제는 JS측 `avsc` 라이브러리.

`avroClient.js`에서 RPC 호출 시 avsc per-call timeout을 지정하지 않음:
```javascript
// Before (기본 timeout ~10초 적용)
this.client.RunCommand(request, (err, response) => { ... })
```

avsc 라이브러리의 기본 RPC 호출 timeout이 ~10초이므로,
Java ExecuteWatchdog (45s)보다 avsc timeout (~10s)이 먼저 도달하여 에러 반환.

### Timeout 체인 (수정 전)

```
net stop (SCM 대기: ~30s)
  → Java ExecuteWatchdog: 45s ✅
    → avsc RPC call timeout: ~10s ❌ ← 여기서 먼저 timeout!
      → JS safety setTimeout: 50s ✅
```

### Timeout 체인 (수정 후)

```
net stop (SCM 대기: ~30s)
  → Java ExecuteWatchdog: 45s
    → avsc RPC call timeout: 50s (timeout + 5000)
      → JS safety setTimeout: 50s (timeout + 5000)
```

## 적용된 수정

### `server/shared/avro/avroClient.js`

avsc RPC 호출 시 per-call timeout 옵션 추가:

```javascript
// Before
this.client.RunCommand(request, (err, response) => { ... })

// After
this.client.RunCommand(request, { timeout: timeout + 5000 }, (err, response) => { ... })
```

### `server/features/clients/controlService.js`

디버그용 try-catch 및 로그 추가 (테스트 완료 후 제거 예정):

```javascript
let rpcResult
try {
  rpcResult = await executeRaw(eqpId, commandLine, cmd.args, cmd.timeout)
} catch (err) {
  console.error(`[DEBUG] ${eqpId} ${action} executeRaw THREW:`, err.message)
  throw err
}
console.log(`[DEBUG] ${eqpId} ${action} rpcResult:`, JSON.stringify(rpcResult))
```

## 디버그 코드 위치 (테스트 후 제거 필요)

| 파일 | 위치 | 내용 |
|------|------|------|
| `server/features/clients/controlService.js` | executeRaw 전후 | try-catch + DEBUG 로그 |
| `server/shared/avro/avroClient.js` | RPC callback | err 객체 상세 로그 |

## TODO

- [ ] 테스트 PC에서 stop/start/restart 정상 동작 확인
- [ ] 확인 후 디버그 로그 제거
- [ ] main 브랜치에 머지
