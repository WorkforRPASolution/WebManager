# WINTAIL_IMPLEMENTATION

## 1. 개요

### 배경

기존 실시간 Tail 기능은 PowerShell의 `Get-Content -Tail` 커맨드에 의존했다:

```
powershell -Command "Get-Content '파일' -Tail N -Encoding UTF8"
```

이 방식은 PowerShell 3.0 이상을 요구하며, Windows XP 환경에서는 동작하지 않는다. 현장 클라이언트 중 XP SP3을 사용하는 장비가 존재하므로 PowerShell 의존성을 제거해야 했다.

### 해결 방향

C (MinGW)로 정적 빌드한 경량 tail 바이너리를 도입했다. `${basePath}/utils/tail` 경로에 배치하여 Strategy 모듈이 직접 호출한다.

- **변경 전**: `powershell -Command "Get-Content '파일' -Tail N -Encoding UTF8"` (PowerShell 3.0+ 필요, XP 미지원)
- **변경 후**: `${basePath}/utils/tail -n N 파일` (C/MinGW 정적 바이너리, XP SP3 ~ Win11 전범위)

---

## 2. 기술 결정

### C (MinGW) 선택 근거

| 항목 | 값 |
|------|-----|
| 바이너리 크기 | 10~50KB (정적), 실제 빌드 124KB |
| DLL 의존 | 0 (완전 정적 링크) |
| 대상 아키텍처 | i686 (32bit) PE32 — XP SP3부터 동작 |
| 크로스빌드 | `i686-w64-mingw32-gcc -static` |

### 바이트 레벨 tail

UTF-8과 CP949(EUC-KR) 모두 줄바꿈 문자가 `0x0A`이다. 따라서 인코딩 변환 없이 바이트 단위로 `0x0A`를 세는 것만으로 올바른 tail 동작을 보장한다. 이는 PowerShell의 `-Encoding UTF8` 파라미터가 불필요해지는 근거이기도 하다.

### fseek(SEEK_END) 역방향 읽기

파일 끝에서 4KB 블록 단위로 역방향 읽기를 수행한다. 10MB+ 파일이라도 끝에서 수 KB만 읽으므로 I/O 비용이 파일 크기에 무관하다.

---

## 3. 변경 사항 요약

수정 파일 총 6개 (WebManager):

| 파일 | 작업 | 핵심 변경 |
|------|------|----------|
| `server/features/clients/strategies/arsAgentWinSc.js` | 수정 | `getTailCommand`: powershell 커맨드를 `utils/tail` 바이너리 호출로 교체 |
| `server/features/clients/strategies/resourceAgentWinSc.js` | 수정 | 동일 |
| `server/features/clients/strategies/arsAgentLinuxSystemd.js` | 수정 | `getTailCommand`에 `basePath` 파라미터 추가 (무시, 시그니처 통일) |
| `server/features/clients/strategies/resourceAgentLinuxSystemd.js` | 수정 | 동일 |
| `server/features/clients/logService.js` | 수정 | `getTailCommand` 호출 시 `currentBasePath` 전달 |
| `server/features/clients/strategies/__tests__/tail.test.js` | 신규 | vitest 단위 테스트 6개 |

---

## 4. Strategy 변경 상세

### 4A. getTailCommand 시그니처 변경

```
변경 전: getTailCommand(filePath, lines)
변경 후: getTailCommand(filePath, lines, basePath)
```

모든 Strategy가 동일한 시그니처를 갖도록 `basePath` 파라미터를 추가했다. linux_systemd 전략은 이 파라미터를 무시한다.

### 4B. win_sc Strategy 로직

```javascript
getTailCommand(filePath, lines, basePath) {
    const tailBin = basePath ? `${basePath}/utils/tail` : 'tail'
    return { commandLine: tailBin, args: ['-n', String(lines), filePath], timeout: 10000 }
}
```

- **Windows**: `basePath`가 `C:/EARS/EEGAgent`이면 `C:/EARS/EEGAgent/utils/tail` 경로를 사용한다. OS가 `tail.exe`를 자동 탐색한다.
- **Linux (fallback)**: `basePath`가 없으면 시스템 PATH의 `tail`을 사용한다.
- **Docker**: `/app/ManagerAgent/utils/tail` mock 스크립트를 호출한다.

### 4C. linux_systemd Strategy

`basePath` 파라미터를 추가만 하고 무시한다. 시스템 `tail`을 그대로 사용한다.

### 4D. logService.js 변경 (호출부)

```javascript
// 변경 전:
const tailCmd = strategy.getTailCommand(fullPath, LOG_TAIL_BATCH_LINES)

// 변경 후:
const tailCmd = strategy.getTailCommand(fullPath, LOG_TAIL_BATCH_LINES, currentBasePath)
```

`currentBasePath`는 기존 per-client basePath 3단계 fallback(`client.basePath` -> `LOG_REMOTE_BASE_PATH` -> 상대경로)으로 결정된 값이다.

---

## 5. WinTail 프로젝트 (별도)

> 경로: `ARS/WinTail/` — 별도 프로젝트, git 미등록

| 파일 | 설명 |
|------|------|
| `src/tail.c` | C 소스 (~100줄), `fseek(SEEK_END)` + 역방향 4KB 블록 읽기 |
| `Makefile` | native (`gcc`) + cross (`i686-w64-mingw32-gcc -static`) |
| `tests/` | shell 테스트 13개 (basic 7, large 3, encoding 3) |
| `build/tail.exe` | 124KB PE32 정적 바이너리 (MinGW 크로스빌드) |

---

## 6. Docker 변경

### Dockerfile 수정

`/app/ManagerAgent/utils/tail` mock 스크립트를 추가했다:

```bash
#!/bin/sh
exec /usr/bin/tail "$@"
```

Docker 컨테이너 내부에서는 실제 `tail.exe` 대신 Linux 시스템 `tail`로 위임한다. Strategy가 `${basePath}/utils/tail -n 50 파일` 형태로 호출하면 이 mock 스크립트가 시스템 tail을 실행한다.

---

## 7. 배포 안내

### Windows 클라이언트

1. `tail.exe` (124KB)를 `${EEG_BASE}/utils/` 디렉토리에 배치한다.
2. 실제 경로 예시: `C:\EARS\EEGAgent\utils\tail.exe`
3. 별도 설치나 DLL 배포 불필요 (완전 정적 링크).

### Docker 테스트 환경

Dockerfile에서 mock 스크립트가 자동 생성되므로 추가 작업 없음.

---

## 8. 검증 결과

### WinTail 단위 테스트: 13/13 PASS

| 카테고리 | 테스트 수 | 내용 |
|---------|----------|------|
| basic | 7 | 기본 tail 동작, 빈 파일, 줄 수 부족 등 |
| large | 3 | 10MB+ 파일 역방향 읽기 |
| encoding | 3 | UTF-8, CP949, 혼합 인코딩 |

### Vitest 단위 테스트: 6/6 PASS

`strategies/__tests__/tail.test.js` — 4개 Strategy의 `getTailCommand` 반환값 검증.

### Docker E2E 테스트: 6/6 PASS

| # | 시나리오 | 결과 |
|---|---------|------|
| 1 | Direct Tail (UTF-8) | PASS |
| 2 | SOCKS Tail | PASS |
| 3 | UTF-8 인코딩 검증 | PASS |
| 4 | 10MB 대용량 파일 | PASS |
| 5 | 존재하지 않는 파일 (NotFound) | PASS |
| 6 | MD5 diff (변경 감지) | PASS |

### 추가 검증

| 항목 | 결과 |
|------|------|
| API utils/tail 경로 검증 | PASS |
| Docker 로그 증적: `/app/ManagerAgent/utils/tail -n 50 <file>` | PASS |

---

## 9. 주의사항

1. **XP 호환**: `tail.exe`는 i686 (32bit) PE32로 빌드되었다. XP SP3부터 Win11까지 전범위에서 동작한다. 64bit Windows에서도 WoW64를 통해 정상 실행된다.

2. **인코딩**: 바이트 레벨 처리이므로 UTF-8, CP949, EUC-KR 모두 정상 동작한다. 줄바꿈 `0x0A` 기반 카운팅은 이들 인코딩에서 모두 안전하다.

3. **동시 실행**: `LOG_MAX_CONCURRENT_TAILS=5` 제한이 있으나, 경량 바이너리(124KB)이고 실행 시간이 수십 ms 수준이므로 부담 없다.

4. **basePath 없는 경우**: `basePath`가 `null`이면 시스템 PATH의 `tail`을 사용한다. Linux 환경에서 별도 바이너리 배포 없이도 호환된다.

5. **PowerShell 제거 영향**: PowerShell `-Encoding UTF8` 파라미터가 사라지지만, 바이트 레벨 tail은 인코딩에 무관하므로 기능적 차이가 없다. 단, PowerShell이 수행하던 BOM 처리가 필요한 경우는 별도 확인이 필요하다.
