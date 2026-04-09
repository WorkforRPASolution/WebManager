# Issue: Log Tail 한글 인코딩 깨짐 (ManagerAgent 수정 필요)

## 상태: 미해결 — ManagerAgent 측 수정 필요

WebManager 단독으로는 해결 불가능. ManagerAgent의 stdout 처리 로직 수정이 선행되어야 함.

## 요약

Log Tail (실시간 tailing, SSE) 기능에서 비(非) UTF-8 인코딩(EUC-KR / CP949)으로 저장된
로그 파일의 한글이 mojibake 형태로 깨져 표시됨. Log Open (FTP 기반 파일 읽기)은 정상.

## 증상

| 항목 | 내용 |
|------|------|
| 원본 파일 내용 | `Log한글Test` |
| Log Open 표시 | `Log한글Test` (정상) |
| Log Tail 표시 | `Log�쒓�Test` (mojibake) |

`�` (U+FFFD replacement char)와 우연히 유효한 한글(`쒓`)이 섞여 있는 전형적인 mojibake 패턴.

## 원인

### 두 경로의 인코딩 처리 차이

| 경로 | 데이터 수집 방식 | 인코딩 처리 | 결과 |
|------|----------------|-----------|------|
| **Log Open** | FTP (`ftpService.readLogFile`) | raw `Buffer` → `decodeBuffer()` (UTF-8/EUC-KR/CP949 자동 폴백) | ✅ 정상 |
| **Log Tail** | RPC (`AvroRpcClient.runCommand`) | Avro `string` 타입 강제 → ManagerAgent가 이미 디코딩한 결과만 받음 | ❌ 깨짐 |

### Avro 프로토콜 제약

```js
// server/shared/avro/avroClient.js:20-28
{
  name: 'Response',
  type: 'record',
  fields: [
    { name: 'success', type: 'boolean' },
    { name: 'error',   type: 'string' },
    { name: 'output',  type: 'string' }  // ← UTF-8 강제
  ]
}
```

Avro `string` 타입은 UTF-8 인코딩을 강제하므로, ManagerAgent는 stdout 바이트를
Java String으로 변환한 후 Avro serializer에 전달해야 함. 이 시점에 어떤
charset으로 디코딩했는지에 따라 데이터가 손실/변형됨.

### ManagerAgent의 stdout 처리 (추정)

1. WinTail(`utils/tail`) 또는 Linux `tail`이 byte-level로 raw 바이트를 stdout으로 출력
   - WinTail은 `fopen("rb")` + `fread`/`fwrite`로 순수 바이트 복사 (`WinTail/src/tail.c:6-7` 주석: "Byte-level operation")
2. ManagerAgent(Java)가 `Process.getInputStream()`을 읽어서 Java String 생성
   - 이때 **platform default charset** 또는 **고정 UTF-8 charset**으로 디코딩됨
   - 파일이 CP949/EUC-KR인데 UTF-8로 디코딩하면 → invalid byte는 `\uFFFD`, 일부 시퀀스는 우연히 valid 글자로 해석
3. Avro가 이 "깨진 Java String"을 UTF-8로 재인코딩해서 WebManager로 전송
4. WebManager 측에서는 이미 손실된 바이트를 복구할 방법 없음

### 왜 Log Open은 정상인가?

FTP는 raw 바이트를 `Buffer`로 받기 때문에, `decodeBuffer()`가 UTF-8 검증 실패
시 EUC-KR/CP949 폴백을 시도하여 정확히 디코딩할 수 있음
(`server/shared/utils/decodeBuffer.js`).

## WebManager에서 시도 불가능한 이유

| 시도 | 결과 |
|------|------|
| `Buffer.from(output, 'latin1')` → `decodeBuffer()` | ❌ ManagerAgent가 latin1 호환으로 보존하지 않음. 이미 `\uFFFD` 섞인 문자열 |
| `Buffer.from(output, 'binary')` | ❌ 위와 동일 |
| `output` 문자열 후처리 | ❌ 원본 바이트 소실 — 복구 경로 없음 |

## 해결 방안 (ManagerAgent 수정)

### 옵션 A: Avro 프로토콜 `output: 'string'` → `'bytes'` 변경 (권장)

가장 근본적 해결.

**변경 사항**:
- ManagerAgent: RunCommand 응답의 `output` 필드를 `byte[]` 그대로 저장
- WebManager `avroClient.js`: 프로토콜 타입을 `'bytes'`로 변경
- WebManager `logService.js`: `Buffer` 수신 후 `decodeBuffer(buf, encoding)` 적용
  (인코딩은 `logSettings.encoding`에서 가져옴 — 이미 Log Open에서 사용 중)

**장점**:
- Log Tail뿐 아니라 모든 RPC 결과(서비스 제어, 파일 목록 등)에서 한글/비-ASCII 데이터 안전하게 전송
- WebManager가 Log Open과 완전히 동일한 인코딩 처리 경로 사용 가능

**단점**:
- **Breaking change**: ManagerAgent와 WebManager를 동시 배포해야 함
- 기존 배포된 모든 ManagerAgent 업데이트 필요

### 옵션 B: ManagerAgent가 stdout을 ISO-8859-1(latin1)로 디코딩

Avro `string` 타입은 유지하되, 1바이트=1문자 보존.

**변경 사항**:
- ManagerAgent: `InputStreamReader(stdout, StandardCharsets.ISO_8859_1)` 사용
  → 모든 바이트가 Java String에 보존됨 (U+0000 ~ U+00FF)
- Avro가 이 문자열을 UTF-8로 재인코딩 → WebManager에 UTF-8 bytes로 도착
- WebManager: `Buffer.from(output, 'latin1')` 로 원본 바이트 복원 후 `decodeBuffer(buf, encoding)` 적용

**장점**:
- Avro 프로토콜 변경 없음
- 기존 호환성 유지 (텍스트 기반 RPC 결과는 계속 동작)

**단점**:
- WebManager 측에서 `output`이 latin1 인코딩된 raw bytes라는 규약을 알아야 함 → 암묵적 계약
- 다른 RPC 호출(서비스 제어 등)과 일관성 깨짐 (같은 필드가 경우에 따라 UTF-8 string이거나 latin1 bytes)

### 옵션 C: ManagerAgent가 명시적 encoding 파라미터 수용

RPC 요청에 `encoding` 필드 추가. ManagerAgent가 그 charset으로 stdout 디코딩 후 UTF-8로 재인코딩.

**장점**:
- Avro 프로토콜 부분 변경 (필드 추가, backward compatible 가능성)
- 호출자가 의도를 명시

**단점**:
- ManagerAgent가 charset 해석 로직을 관리해야 함
- 프로토콜 변경 여전히 필요

### 권장

**옵션 A**. 모든 RPC 결과의 바이트 안정성을 보장하고, WebManager 측에서 Log Open과
동일한 `decodeBuffer()` 경로를 재사용할 수 있음. Breaking change지만 한 번의 일괄
배포로 근본 해결.

## 임시 조치

현재 WebManager에서 적용 가능한 조치 없음. 사용자에게는 다음과 같이 안내:

- **Log Open 기능 사용 권장**: EUC-KR/CP949 파일의 한글 로그를 확인할 때는
  Tail 대신 Log Open 사용
- **로그 파일을 UTF-8로 저장**: 가능한 경우 agent 측에서 로그를 UTF-8로 기록하도록 전환

## 관련 파일

### WebManager (수정 대상 — ManagerAgent 수정 후)
- `server/shared/avro/avroClient.js:20-28` — Avro 프로토콜 정의
- `server/features/clients/logService.js:260-320` — Tail 응답 처리
- `server/shared/utils/decodeBuffer.js` — 재사용 가능한 인코딩 자동 감지 로직

### 외부 (수정 필요)
- ManagerAgent (Java) — stdout 처리 로직 또는 Avro 응답 생성 로직
- `WinTail/src/tail.c` — 이미 byte-level 동작이므로 수정 불필요

## 참고

- 사용자 보고: 2026-04-08
- 재현 로그: `Log한글Test` → `Log�쒓�Test`
- Log Open 정상 동작 확인됨 (동일 파일)
