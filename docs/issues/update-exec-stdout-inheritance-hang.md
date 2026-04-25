# Issue: Update exec 태스크 — 자식 프로세스 stdout 상속으로 인한 RPC hang

## 상태: 운영 측 workaround 적용 확인 / 폼 파서 개선 예정

## 요약

UpdateSettings 의 exec 태스크로 외부 EXE(예: `BbEmUnlk.exe /min:30`)를 실행하면
`RPC call timeout after 30000ms` 에러로 실패. 정작 타깃 프로그램은 정상 실행되어
의도한 동작("30분 특정 모드 진입")은 수행되지만 WebManager 는 결과를 받지 못함.

ManagerAgent(서버)측 Apache Commons Exec 의 **PumpStreamHandler 가 자식 프로세스의
stdout 파이프에서 EOF 를 받지 못해 `executor.execute()` 가 영구 대기**하는 것이
근본 원인. ARSAgent Restart 처럼 자식을 남기지 않는 명령은 문제없이 동작.

## 환경

- 대상 파일(서버): `ManagerAgent/src/main/java/com/sec/eeg/avro/rpc/ExecCommandAvroImpl.java`
- 대상 파일(클라): `WebManager/server/shared/avro/avroClient.js`, `WebManager/server/features/clients/updateService.js`
- 대상 UI: `WebManager/client/src/features/clients/components/UpdateSettingsModal.vue`
- 재현 명령 예시: `C:\Program Files\AhnLab\EPS\BbEmUnlk.exe /min:30`

## 증상

| 항목 | 내용 |
|------|------|
| 클라이언트 에러 | `RPC call failed: RPC call timeout after 30000ms` |
| 타깃 프로세스 | 정상 실행됨 (자식이 백그라운드에서 30분간 유지) |
| WebManager UI | 해당 eqpId/task 가 `error` 로 표시 |
| 비교: ARSAgent Restart | 동일 RPC 경로인데 **정상 동작** |
| 비교: Config Save | FTP 경로라 무관, 정상 동작 |

## 결정적 로그 패턴

ManagerAgent 로그:

```
INFO | ExecCommandAvroImpl.java | 53 | command: C:\Program Files\AhnLab\EPS\BbEmUnlk.exe /min:30
(이후 output: ... / run command fail: ... 이 30초~30분간 찍히지 않음)
```

정상 흐름이라면 `command:` 바로 뒤에 `output:` 또는 `run command fail:` 중 하나가
수 초 내 찍혀야 함(`ExecCommandAvroImpl.java:47,51,53`). 둘 다 없다는 것은
`executor.execute()` 가 **반환조차 안 된 상태**라는 뜻.

## 재현 조건

- exec 태스크의 `commandLine` 이 **백그라운드 자식 프로세스를 spawn** 하는 EXE
- 자식이 부모(ManagerAgent)의 stdout/stderr 핸들을 상속
- 자식이 즉시 종료되지 않음 (수 초 이상 유지)
- 부모 본체는 먼저 종료

즉 다음을 만족하는 프로그램에서 재현:
1. GUI 또는 백그라운드 워커를 띄우고 본체는 빠르게 exit
2. 그 자식이 파이프 상속을 끊지 않음 (`DETACHED_PROCESS` / 새 콘솔 없이 기본 spawn)

## 원인 분석

### 서버측 실행 경로

`ExecCommandAvroImpl.java:27-46`:

```java
Executor executor = new DefaultExecutor();
executor.setExitValue(0);
ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
PumpStreamHandler streamHandler = new PumpStreamHandler(outputStream);
executor.setStreamHandler(streamHandler);
ExecuteWatchdog watchdog = new ExecuteWatchdog(request.getTimeout());
executor.setWatchdog(watchdog);
...
executor.execute(cmdLine);   // ← 동기 블로킹
```

### PumpStreamHandler 동작

`DefaultExecutor.execute()` 는 다음 세 조건이 모두 충족되어야 반환:

1. 자식 프로세스가 exit
2. PumpStreamHandler 의 stdout pump 스레드가 EOF 수신 후 종료
3. stderr pump 스레드도 동일

**stdout pump 는 자식 프로세스의 stdout 핸들이 완전히 닫힐 때까지 read 블로킹**.
외부 EXE 가 자체 백그라운드 자식에게 stdout 을 상속시키면(Windows 의 기본 동작),
본체 프로세스가 exit 해도 상속한 자식이 stdout 핸들을 계속 열어둠 → pump 영구 대기.

### Watchdog 이 안 통하는 이유

`ExecuteWatchdog(30000)` 은 30초 후 부모 PID 에 `Process.destroy()` (Windows:
`TerminateProcess`) 호출. 그런데 본체는 이미 exit 한 상태라 kill 할 대상이 없음.
descendants 는 PID 만으로는 추적 불가능하므로 같이 죽이지 않음 → **watchdog 발동해도
pump hang 은 해소되지 않음**.

결과적으로 `executor.execute()` 는 자식 프로세스가 자연 종료되어 stdout 핸들을
닫을 때까지(`/min:30` 기준 30분) 반환되지 않음.

### 클라이언트측 타임아웃

`server/shared/avro/avroClient.js:91-97`:

```javascript
const timer = setTimeout(() => {
  if (!settled) {
    settled = true
    this.disconnect()
    reject(new Error(`RPC call timeout after ${timeout}ms`))
  }
}, timeout + 5000)
```

그래서 클라이언트는 `timeout + 5000ms` 후 에러로 reject. 기본 30초 타임아웃
(`updateSettingsModel.js:22`)이면 35초 뒤 "RPC call timeout" 으로 보임.

### 왜 ARSAgent Restart 는 되는가

`sc start/stop`, `systemctl restart` 같은 서비스 매니저 경유 명령은 OS 의 SCM 이
서비스 프로세스를 자체적으로 관리하며 **호출 프로세스(ManagerAgent)의 파이프를
상속하지 않음**. 그래서 `sc` 본체가 exit 하면 stdout 도 즉시 닫히고 pump 가 풀림.

### 타임라인 (재현 케이스 기준)

```
T+0s       : WebManager → ManagerAgent RunCommand RPC (timeout=30s)
T+0s       : ManagerAgent → spawn BbEmUnlk.exe
T+0.1s     : BbEmUnlk 본체 exit, 백그라운드 자식은 30분간 유지
T+0.1s     : 자식이 stdout 상속 → PumpStreamHandler 대기 시작
T+30s      : Watchdog 발동 → PID destroy 시도 (대상 프로세스 없음, 무효)
T+35s      : WebManager 클라이언트 타임아웃 → "RPC call timeout" 에러
T+30min    : 자식 자연 종료 → stdout 닫힘 → pump 반환 → execute() 반환
             (이때는 이미 RPC 세션 종료됨, ManagerAgent 로그에만 output: 늦게 찍힘)
```

## 운영측 workaround (코드 수정 없이)

타깃 명령을 `cmd /c start` 로 감싸 **새 콘솔을 분리**해서 stdout 상속을 끊음.

UpdateSettings 폼 입력:

- **Command**: `cmd`
- **Args**: `/c start /MIN C:\PROGRA~1\AhnLab\EPS\BbEmUnlk.exe /min:30`
- **Timeout**: 10 (초) — detach 후 즉시 반환되므로 짧게 설정

포인트:
- `start` 는 새 콘솔 창에서 명령을 띄워 stdout/stderr 상속을 끊음
- `/MIN` 은 새 창을 최소화 상태로 (선택)
- `/B` 는 붙이지 말 것 — 같은 콘솔을 공유해서 상속이 유지되어 증상 재현됨
- **경로에 공백이 있으면 8.3 단축명 사용** (예: `Program Files` → `PROGRA~1`). 현재 폼의
  args 파서가 따옴표를 지원하지 않아 공백 포함 경로를 하나의 인자로 입력할 수 없음
- `cmd /c` 는 `start` 호출 후 즉시 종료 → ManagerAgent 의 `executor.execute()` 도
  즉시 반환 → RPC 응답 정상 수신

### 확인된 동작 명령 (2026-04-23)

```
Command: cmd
Args:    /c start /MIN C:\PROGRA~1\AhnLab\EPS\BbEmUnlk.exe /min:30
```

실제 장비에서 정상 동작 확인. RPC 즉시 반환되고, BbEmUnlk 는 백그라운드에서
30분 모드 유지.

## 8.3 단축명을 쓸 수 없는 환경

레지스트리 `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\NtfsDisable8dot3NameCreation = 1`
로 8.3 생성이 꺼진 볼륨에서는 `PROGRA~1` 같은 단축명이 존재하지 않음. 이 경우
공백 포함 경로를 따옴표로 묶어야 하는데, **현재 UpdateSettingsModal 의 args 입력이
공백으로만 split** 하기 때문에 입력 불가 → 폼 파서 개선이 필요 (아래 "개선 예정" 참조).

임시 우회책: 타깃 장비에 경유용 배치 파일(`wrap-bbemunlk.bat`)을 미리 배포한 뒤
exec 태스크에서 그 배치를 호출. 다만 이 배치 파일 배포 자체가 copy 태스크로
이루어져야 하므로 닭-달걀 문제 있음. 권장하지 않음.

## 근본 해결안

### 1. 폼 파서 개선 (클라이언트, 가장 현실적)

`UpdateSettingsModal.vue:807` 의 `split(/\s+/)` 을 따옴표를 존중하는 shell-style
파서로 교체. 사용자가 다음과 같이 입력 가능하도록:

```
/c start "" /MIN "C:\Program Files\AhnLab\EPS\BbEmUnlk.exe" /min:30
```

로드 시 `args` 배열 → 공백 포함 토큰은 따옴표로 감싸 `_argsText` 로 역변환
(라운드트립 지원). 별도 플랜 문서 참조: `/Users/hyunkyungmin/.claude/plans/shell-style-effervescent-lemur.md`.

### 2. Task 에 `detach: true` 플래그 추가 (클라이언트 + 서버)

UpdateSettings UI 에 "Fire and forget" 체크박스를 노출하고, 서버
(`updateService.deployTaskToClient`) 에서 이 플래그가 켜지면 OS 별로 자동 래핑:

- Windows: `cmd /c start "" ...`
- Linux: `nohup ... >/dev/null 2>&1 &`

사용자가 OS 별 detach 문법을 외우지 않아도 됨.

### 3. ManagerAgent 측 근본 수정 (서버, 큰 작업)

`ExecCommandAvroImpl` 를 Apache Commons Exec 의 `PumpStreamHandler` 대신
`ProcessBuilder` + `Redirect.DISCARD` 로 리라이트. 자식이 stdout 을 상속해도
바로 `/dev/null` 로 흘려 pump block 이 원천 차단됨. 단 output 은 버려지므로
"output 을 받아야 하는 exec" 용도와 분리된 API 가 필요할 수 있음.

우선순위: **1 → 2 → 3**. 1 이 적용되면 운영자가 수동 래핑을 정확히 할 수 있게
되고, 2 가 적용되면 실수 여지가 사라지고, 3 은 자식이 상속하는 다른 엣지 케이스
(예: GUI 설치 프로그램)까지 커버.

## 참고

- Apache Commons Exec 관련 JIRA: [EXEC-33](https://issues.apache.org/jira/browse/EXEC-33),
  [EXEC-52](https://issues.apache.org/jira/browse/EXEC-52),
  [EXEC-62](https://issues.apache.org/jira/browse/EXEC-62)
- 이전에 이 이슈의 **다른 면**을 다룬 문서: `docs/issues/net-stop-timeout-issue.md`
  (avsc 라이브러리 자체의 기본 per-call timeout 문제 — 현재 이슈와 별개)
