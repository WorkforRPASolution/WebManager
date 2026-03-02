# ResourceAgent Config 파일 스키마 레퍼런스

> ResourceAgent가 사용하는 2개 설정 파일의 구조, 필드 규격, 관계를 정의합니다.
> Form View 개발 및 유효성 검증 로직 구현 시 참조용 문서입니다.

## 목차

1. [개요](#1-개요)
2. [공통 규격](#2-공통-규격)
3. [ResourceAgent.json](#3-resourceagentjson)
4. [Monitor.json](#4-monitorjson)
5. [전체 예시](#5-전체-예시)

---

## 1. 개요

ResourceAgent는 공장 내 PC의 하드웨어 자원 사용률(CPU, Memory, Disk, Network, 온도 등)을 수집하여 Kafka/KafkaRest/File로 전송하는 Go 기반 경량 모니터링 에이전트입니다. 동작을 제어하는 2개 JSON 설정 파일이 있습니다:

| 파일 | 역할 | 위치 |
|------|------|------|
| **ResourceAgent.json** | 전송 방식, Kafka/Redis 연결, 네트워크 설정 | `conf/ResourceAgent/` |
| **Monitor.json** | 14개 Collector의 활성화/주기/특수 옵션 (Hot Reload 지원) | `conf/ResourceAgent/` |

> **파일 위치**: basePath 기준 상대경로 `conf/ResourceAgent/`. 예: `D:\EARS\EEGAgent\conf\ResourceAgent\ResourceAgent.json`

**핵심 동작 흐름**: ResourceAgent.json에서 전송 설정 로드 → Monitor.json에서 Collector별 수집 설정 로드 → Scheduler가 주기적으로 Collector 실행 → Sender가 메트릭 전송

**설정 로드 순서**: `DefaultConfig()` 기본값 생성 → JSON 파일 로드 → `Merge()`로 non-zero 값만 덮어쓰기

---

## 2. 공통 규격

### 2.1 Duration 포맷

시간 관련 필드는 JSON에서 **문자열**로 표현하며, Go `time.ParseDuration()` 형식을 따릅니다:

| 단위 | 축약 | 예시 | 설명 |
|------|------|------|------|
| 나노초 | `ns` | `"500ns"` | 나노초 |
| 마이크로초 | `us`, `µs` | `"100us"` | 마이크로초 |
| 밀리초 | `ms` | `"100ms"` | 밀리초 |
| 초 | `s` | `"30s"` | 초 |
| 분 | `m` | `"5m"` | 분 |
| 시 | `h` | `"1h"` | 시 |

복합 표현도 가능합니다: `"1h30m"`, `"5m30s"`

> **EARS와의 차이**: EARS는 `"10 seconds"`, `"1 minutes"` 형식(공백 + 복수형 단위)을 사용하지만, ResourceAgent는 Go 표준 duration 형식(`"10s"`, `"1m"`)을 사용합니다. 두 형식은 호환되지 않습니다.

### 2.2 JSON 구조 패턴

- **키 명명 규칙**: PascalCase (`SenderType`, `MaxRetries`, `FlushFrequency`)
  - EARS의 camelCase/snake_case와 다름
- **중첩 구조**: 섹션별 Object로 그룹화 (`Kafka`, `Redis`, `File`, `SocksProxy`)
- **최상위 구조**: ResourceAgent.json은 단일 Object, Monitor.json은 `Collectors` 키 하나를 가진 Object

### 2.3 설정 병합 (Merge) 로직

설정 로드 시 아래 순서로 병합됩니다:

1. `DefaultConfig()` / `DefaultMonitorConfig()`로 기본값 생성
2. JSON 파일에서 `rawConfig` / `rawMonitorConfig`로 파싱
3. Duration 문자열을 `time.ParseDuration()`으로 변환
4. `Merge()`로 non-zero 값만 기본값에 덮어쓰기

**Merge 규칙**:
- `string`: 빈 문자열 `""`이면 기본값 유지, 값이 있으면 덮어쓰기
- `int`: `0`이면 기본값 유지, non-zero면 덮어쓰기
- `bool`: 항상 덮어쓰기 (JSON 파일의 값이 우선)
- `[]string`: 빈 배열이면 기본값 유지, 요소가 있으면 덮어쓰기
- `map[string]string`: 키 단위로 병합 (기존 키 보존, 새 키 추가/덮어쓰기)
- `time.Duration`: `0`이면 기본값 유지, non-zero면 덮어쓰기

### 2.4 파일 타입 감지

WebManager Form View에서 파일명으로 타입을 판별합니다 (대소문자 무시):

| 파일명 패턴 | 타입 |
|------------|------|
| `resourceagent.json` | `resourceagent` |
| `monitor.json` | `resourceagent_monitor` |

---

## 3. ResourceAgent.json

### 3.1 전체 구조

```json
{
  "SenderType": "string (enum)",
  "File": { ... },
  "Kafka": { ... },
  "Batch": { ... },
  "VirtualAddressList": "string",
  "Redis": { ... },
  "PrivateIPAddressPattern": "string",
  "SocksProxy": { ... },
  "ServiceDiscoveryPort": number,
  "ResourceMonitorTopic": "string (enum)",
  "TimeDiffSyncInterval": number
}
```

### 3.2 SenderType

#### `SenderType`
| 속성 | 값 |
|------|-----|
| 타입 | `string` (enum) |
| 기본값 | `"kafka"` |
| 허용값 | `"kafka"`, `"kafkarest"`, `"file"` |
| 설명 | 메트릭 전송 방식 선택 |
| JSON 키 | `SenderType` |

| 값 | 동작 |
|-----|------|
| `"kafka"` | sarama 라이브러리로 Kafka 직접 전송 |
| `"kafkarest"` | ServiceDiscovery로 KafkaRest Proxy 주소를 받아 HTTP POST 전송 |
| `"file"` | 로컬 파일에 메트릭 JSON 기록 (Redis/SOCKS/ServiceDiscovery 불필요) |

### 3.3 File 섹션

`SenderType`이 `"file"`일 때 사용하는 파일 출력 설정입니다.

#### `File.FilePath`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `"log/ResourceAgent/metrics.jsonl"` |
| 설명 | 메트릭 출력 파일 경로 (basePath 기준 상대경로) |
| JSON 키 | `File.FilePath` |

#### `File.MaxSizeMB`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `50` |
| 설명 | 단일 파일 최대 크기 (MB). 초과 시 로테이션 |
| JSON 키 | `File.MaxSizeMB` |

#### `File.MaxBackups`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `3` |
| 설명 | 로테이션 시 유지할 백업 파일 수 |
| JSON 키 | `File.MaxBackups` |

#### `File.Console`
| 속성 | 값 |
|------|-----|
| 타입 | `boolean` |
| 기본값 | `true` |
| 설명 | 콘솔(stdout)에도 메트릭을 출력할지 여부 |
| JSON 키 | `File.Console` |
| 비고 | 디버깅/개발 시 `true`, 운영 환경에서는 `false` 권장 |

#### `File.Pretty`
| 속성 | 값 |
|------|-----|
| 타입 | `boolean` |
| 기본값 | `false` |
| 설명 | JSON 출력 시 들여쓰기 적용 여부 |
| JSON 키 | `File.Pretty` |
| 비고 | `true`면 가독성 좋지만 파일 크기 증가 |

#### `File.Format`
| 속성 | 값 |
|------|-----|
| 타입 | `string` (enum) |
| 기본값 | `""` (빈 문자열 → `"grok"` 동작) |
| 허용값 | `"json"`, `"grok"` (`"legacy"`도 `"grok"`으로 자동 매핑) |
| 설명 | 파일 출력 포맷 |
| JSON 키 | `File.Format` |

| 값 | 동작 |
|-----|------|
| `"json"` | EARSRow를 ParsedDataList JSON으로 기록 (Kafka direct/JSON mapper와 동일) |
| `"grok"` | EARS Grok 호환 평문 포맷으로 기록 (KafkaRest와 동일) |
| `"legacy"` | `"grok"`의 별칭 (하위호환) |

### 3.4 Kafka 섹션

`SenderType`이 `"kafka"`일 때 사용하는 Kafka 연결 설정입니다. 4개 핵심 필드와 8개 선택적 TLS/SASL 필드로 구성됩니다. 토픽명은 `ResourceMonitorTopic` 설정에 의해 결정됩니다.

> **TLS/SASL 필드 생략 가능**: 현재 프로덕션 환경(Kafka 2.5.0, PLAINTEXT)에서는 TLS/SASL을 사용하지 않습니다. Go의 `bool` 기본값이 `false`이므로, `EnableTLS`와 `SASLEnabled`를 JSON에서 생략하면 자동으로 비활성화됩니다. TLS/SASL이 불필요한 환경에서는 아래 8개 필드를 설정 파일에서 모두 제거해도 됩니다.

> **배치 필드 분리**: 이전에는 `MaxRetries`, `RetryBackoff`, `FlushFrequency`, `FlushMessages`, `BatchSize` 5개 배치 필드가 Kafka 섹션에 포함되어 있었습니다. 이제 이 필드들은 독립된 `Batch` 섹션으로 이동되었습니다. **하위 호환**: 기존 JSON에서 Kafka 섹션에 배치 필드를 유지해도 자동으로 `Batch` 섹션 값으로 fallback 파싱됩니다. 단, `Batch` 섹션이 함께 존재하면 `Batch` 섹션이 우선합니다.

#### `Kafka.Brokers`
| 속성 | 값 |
|------|-----|
| 타입 | `array` of `string` |
| 기본값 | `["localhost:9092"]` |
| 설명 | Kafka 브로커 주소 목록 (`host:port` 형식) |
| JSON 키 | `Kafka.Brokers` |
| 예시 | `["broker1:9092", "broker2:9092"]` |

#### `Kafka.Compression`
| 속성 | 값 |
|------|-----|
| 타입 | `string` (enum) |
| 기본값 | `"snappy"` |
| 허용값 | `"none"`, `"gzip"`, `"snappy"`, `"lz4"`, `"zstd"` |
| 설명 | Kafka 메시지 압축 방식 |
| JSON 키 | `Kafka.Compression` |

#### `Kafka.RequiredAcks`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `1` |
| 허용값 | `0` (NoResponse), `1` (WaitForLocal), `-1` (WaitForAll) |
| 설명 | 프로듀서가 요구하는 브로커 응답 수준 |
| JSON 키 | `Kafka.RequiredAcks` |

#### `Kafka.Timeout` (duration)
| 속성 | 값 |
|------|-----|
| 타입 | `string` (duration) |
| 기본값 | `"10s"` |
| 설명 | Kafka 연결/요청 타임아웃 |
| JSON 키 | `Kafka.Timeout` |

#### `Kafka.EnableTLS` (선택적 — 생략 시 `false`)
| 속성 | 값 |
|------|-----|
| 타입 | `boolean` |
| 기본값 | `false` |
| 설명 | TLS 암호화 활성화 여부 |
| JSON 키 | `Kafka.EnableTLS` |
| 비고 | PLAINTEXT 환경에서는 JSON에서 이 필드를 생략해도 됩니다 |

#### `Kafka.TLSCertFile`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | TLS 클라이언트 인증서 파일 경로 |
| JSON 키 | `Kafka.TLSCertFile` |
| 비고 | `EnableTLS`가 `true`일 때만 유효 |

#### `Kafka.TLSKeyFile`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | TLS 클라이언트 키 파일 경로 |
| JSON 키 | `Kafka.TLSKeyFile` |
| 비고 | `EnableTLS`가 `true`일 때만 유효 |

#### `Kafka.TLSCAFile`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | TLS CA 인증서 파일 경로 |
| JSON 키 | `Kafka.TLSCAFile` |
| 비고 | `EnableTLS`가 `true`일 때만 유효 |

#### `Kafka.SASLEnabled` (선택적 — 생략 시 `false`)
| 속성 | 값 |
|------|-----|
| 타입 | `boolean` |
| 기본값 | `false` |
| 설명 | SASL 인증 활성화 여부 |
| JSON 키 | `Kafka.SASLEnabled` |
| 비고 | SASL 미사용 시 JSON에서 이 필드와 하위 3개 필드를 모두 생략 가능 |

#### `Kafka.SASLMechanism`
| 속성 | 값 |
|------|-----|
| 타입 | `string` (enum) |
| 기본값 | `""` |
| 허용값 | `"PLAIN"`, `"SCRAM-SHA-256"`, `"SCRAM-SHA-512"` |
| 설명 | SASL 인증 메커니즘 |
| JSON 키 | `Kafka.SASLMechanism` |
| 비고 | `SASLEnabled`가 `true`일 때만 유효 |

#### `Kafka.SASLUser`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | SASL 인증 사용자명 |
| JSON 키 | `Kafka.SASLUser` |
| 비고 | `SASLEnabled`가 `true`일 때만 유효 |

#### `Kafka.SASLPassword`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | SASL 인증 비밀번호 |
| JSON 키 | `Kafka.SASLPassword` |
| 비고 | `SASLEnabled`가 `true`일 때만 유효. Form View에서 마스킹 처리 필요 |

### 3.5 Batch 섹션

`SenderType`이 `"kafka"` 또는 `"kafkarest"`일 때 공통으로 사용하는 배치/flush 설정입니다. 5개 필드로 구성됩니다.

- **kafka**: sarama 프로듀서의 Flush/Retry 설정에 매핑
- **kafkarest**: `BufferedHTTPTransport`의 내부 flush loop 설정에 사용

#### `Batch.FlushFrequency` (duration)
| 속성 | 값 |
|------|-----|
| 타입 | `string` (duration) |
| 기본값 | `"30s"` |
| 설명 | 배치 flush 주기. 이 주기마다 버퍼에 쌓인 레코드를 전송 |
| JSON 키 | `Batch.FlushFrequency` |
| 비고 | ResourceData는 실시간성이 중요하지 않아 30초 기본값 사용 |

#### `Batch.FlushMessages`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `100` |
| 설명 | flush 트리거 메시지 수. 버퍼에 이 수만큼 쌓이면 주기와 무관하게 즉시 전송 |
| JSON 키 | `Batch.FlushMessages` |

#### `Batch.MaxBatchSize`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `500` |
| 설명 | 한 번의 HTTP POST/produce 호출에 포함할 최대 레코드 수. 초과 시 분할 전송 |
| JSON 키 | `Batch.MaxBatchSize` |
| 비고 | 이전 Kafka 섹션의 `BatchSize`(bytes 단위)와 달리 레코드 수 단위 |

#### `Batch.MaxRetries`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `2` |
| 설명 | 전송 실패 시 최대 재시도 횟수 |
| JSON 키 | `Batch.MaxRetries` |

#### `Batch.RetryBackoff` (duration)
| 속성 | 값 |
|------|-----|
| 타입 | `string` (duration) |
| 기본값 | `"500ms"` |
| 설명 | 재시도 간 대기 시간 |
| JSON 키 | `Batch.RetryBackoff` |

### 3.6 Redis 섹션

EQP_INFO 조회에 사용하는 Redis 연결 설정입니다. `SenderType`이 `"file"`이면 사용하지 않습니다.

#### `Redis.Port`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `6379` |
| 설명 | Redis 포트. 호스트는 감지된 서버 IP 사용 |
| JSON 키 | `Redis.Port` |

#### `Redis.Password`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` (빈 문자열 → 내부적으로 `"visuallove"` 사용) |
| 설명 | Redis 비밀번호. 비어있으면 `DefaultRedisPassword` 상수 사용 |
| JSON 키 | `Redis.Password` |
| 비고 | Form View에서 마스킹 처리 필요 |

#### `Redis.DB`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `10` |
| 설명 | Redis DB 번호 (0~15) |
| JSON 키 | `Redis.DB` |

### 3.7 SocksProxy 섹션

SOCKS5 프록시 설정입니다. 에이전트가 프록시를 통해 서버에 접속해야 할 때 사용합니다.

#### `SocksProxy.Host`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | SOCKS5 프록시 호스트 주소 |
| JSON 키 | `SocksProxy.Host` |
| 비고 | 비어있으면 프록시 미사용 (직접 연결) |

#### `SocksProxy.Port`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `0` |
| 설명 | SOCKS5 프록시 포트 |
| JSON 키 | `SocksProxy.Port` |
| 비고 | `Host`가 설정되어 있을 때만 유효 |

### 3.8 최상위 필드

#### `VirtualAddressList`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | IP 감지에 사용할 가상 주소 목록 (쉼표 구분) |
| JSON 키 | `VirtualAddressList` |
| 예시 | `"10.0.0.1,10.0.0.2"` |
| 비고 | 비어있으면 자동 IP 감지 사용 |

#### `ServiceDiscoveryPort`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `50009` |
| 설명 | ServiceDiscovery HTTP 서비스 포트. KafkaRest Proxy 주소 등을 조회 |
| JSON 키 | `ServiceDiscoveryPort` |
| 비고 | `SenderType`이 `"file"`이면 사용하지 않음 |

#### `ResourceMonitorTopic`
| 속성 | 값 |
|------|-----|
| 타입 | `string` (enum) |
| 기본값 | `"process"` |
| 허용값 | `"process"`, `"model"`, `"all"` |
| 설명 | Kafka/KafkaRest 토픽 명명 모드. EQP_INFO 기반으로 토픽명 자동 생성. `SenderType`이 `"kafka"` 또는 `"kafkarest"`일 때 사용 |
| JSON 키 | `ResourceMonitorTopic` |

| 값 | 생성되는 토픽명 | 설명 |
|-----|---------------|------|
| `"process"` | `tp_{Process}_all_resource` | Process별 토픽 (기본) |
| `"model"` | `tp_{Process}_{EqpModel}_resource` | Process+EqpModel별 토픽 |
| `"all"` | `tp_all_all_resource` | 전체 단일 토픽 |

#### `TimeDiffSyncInterval`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수, 초 단위) |
| 기본값 | `3600` |
| 설명 | 서버와의 시간차 동기화 주기 (초) |
| JSON 키 | `TimeDiffSyncInterval` |
| 비고 | 기본 1시간(3600초). Duration 포맷이 아닌 정수형 초 단위 |

#### `PrivateIPAddressPattern`
| 속성 | 값 |
|------|-----|
| 타입 | `string` |
| 기본값 | `""` |
| 설명 | 사설 IP 대역 패턴. IP 감지 시 이 패턴에 매칭되는 IP를 우선 선택 |
| JSON 키 | `PrivateIPAddressPattern` |
| 예시 | `"10\\..*"`, `"192\\.168\\..*"` |
| 비고 | Go 정규표현식. 비어있으면 기본 사설 IP 대역 규칙 사용 |

### 3.9 런타임 전용 필드 (JSON 미포함)

아래 필드는 Go 구조체에 존재하지만 JSON에서 직렬화/역직렬화되지 않습니다 (`json:"-"`). Form View에 표시하지 않습니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `KafkaRestAddress` | `string` | ServiceDiscovery로 받은 KafkaRest Proxy 주소 |
| `EqpInfo` | `*EqpInfoConfig` | Redis에서 조회한 장비 정보 (Process, EqpModel, EqpID, Line 등) |

---

## 4. Monitor.json

### 4.1 전체 구조

```json
{
  "Collectors": {
    "<CollectorName>": {
      "Enabled": boolean,
      "Interval": "duration string",
      // Collector별 특수 필드 (선택)
    }
  }
}
```

최상위에 `Collectors` 키 하나만 존재하며, 그 안에 Collector 이름(PascalCase)을 키로 하는 설정 객체가 들어갑니다.

### 4.2 Collector 공통 필드

모든 Collector에 공통으로 적용되는 필드입니다.

#### `Enabled`
| 속성 | 값 |
|------|-----|
| 타입 | `boolean` |
| 기본값 | Collector별 상이 (Monitor.json 예시 참조) |
| 설명 | Collector 활성화 여부. `false`면 해당 Collector 실행 안 함 |
| JSON 키 | `Collectors.<Name>.Enabled` |

#### `Interval` (duration)
| 속성 | 값 |
|------|-----|
| 타입 | `string` (duration) |
| 기본값 | Collector별 상이 (아래 테이블 참조) |
| 설명 | 메트릭 수집 주기 |
| JSON 키 | `Collectors.<Name>.Interval` |
| 비고 | Go `time.ParseDuration()` 형식. 예: `"30s"`, `"60s"`, `"300s"` |

### 4.3 Collector별 상세

#### 14개 Collector 요약

| # | Collector | JSON 키 | 기본 주기 | 특수 필드 | 설명 |
|---|-----------|---------|----------|----------|------|
| 1 | CPU | `CPU` | `"30s"` | - | CPU 사용률 |
| 2 | Memory | `Memory` | `"30s"` | - | 메모리 사용률 |
| 3 | Disk | `Disk` | `"60s"` | `Disks[]` | 디스크 사용률 |
| 4 | Network | `Network` | `"30s"` | `Interfaces[]` | 네트워크 I/O |
| 5 | Temperature | `Temperature` | `"60s"` | `IncludeZones[]` | CPU/시스템 온도 |
| 6 | Fan | `Fan` | `"60s"` | `IncludeZones[]` | 팬 속도 |
| 7 | GPU | `GPU` | `"60s"` | `IncludeZones[]` | GPU 사용률/온도 |
| 8 | Voltage | `Voltage` | `"60s"` | `IncludeZones[]` | 전압 센서 |
| 9 | MotherboardTemp | `MotherboardTemp` | `"60s"` | `IncludeZones[]` | 메인보드 온도 |
| 10 | StorageSmart | `StorageSmart` | `"300s"` | `Disks[]` | S.M.A.R.T. 정보 |
| 11 | CPUProcess | `CPUProcess` | `"60s"` | `TopN`, `WatchProcesses[]` | 프로세스별 CPU 사용률 |
| 12 | MemoryProcess | `MemoryProcess` | `"60s"` | `TopN`, `WatchProcesses[]` | 프로세스별 메모리 사용률 |
| 13 | Uptime | `Uptime` | `"300s"` | - | 부팅 시각/가동 시간 |
| 14 | ProcessWatch | `ProcessWatch` | `"60s"` | `RequiredProcesses[]`, `ForbiddenProcesses[]` | 필수/금지 프로세스 감시 |

#### 특수 필드 상세

##### `Disks`
| 속성 | 값 |
|------|-----|
| 타입 | `array` of `string` |
| 기본값 | `[]` (빈 배열 → 전체 디스크) |
| 사용 Collector | `Disk`, `StorageSmart` |
| 설명 | 모니터링 대상 디스크 필터. 비어있으면 모든 디스크 수집 |
| JSON 키 | `Collectors.<Name>.Disks` |
| 예시 | `["C:", "D:"]` (Windows), `["/dev/sda", "/dev/sdb"]` (Linux) |

##### `Interfaces`
| 속성 | 값 |
|------|-----|
| 타입 | `array` of `string` |
| 기본값 | `[]` (빈 배열 → 전체 인터페이스) |
| 사용 Collector | `Network` |
| 설명 | 모니터링 대상 네트워크 인터페이스 필터. 비어있으면 모든 인터페이스 수집 |
| JSON 키 | `Collectors.Network.Interfaces` |
| 예시 | `["Ethernet", "Wi-Fi"]` (Windows), `["eth0", "ens33"]` (Linux) |

##### `IncludeZones`
| 속성 | 값 |
|------|-----|
| 타입 | `array` of `string` |
| 기본값 | `[]` (빈 배열 → 전체 zone) |
| 사용 Collector | `Temperature`, `Fan`, `GPU`, `Voltage`, `MotherboardTemp` |
| 설명 | 모니터링 대상 센서 zone 필터. 비어있으면 모든 zone 수집 |
| JSON 키 | `Collectors.<Name>.IncludeZones` |
| 예시 | `["CPU Package", "CPU Core #1"]` |
| 비고 | Windows에서는 LhmHelper가 보고하는 센서 이름, Linux에서는 thermal_zone 이름 |

##### `TopN`
| 속성 | 값 |
|------|-----|
| 타입 | `number` (정수) |
| 기본값 | `10` |
| 사용 Collector | `CPUProcess`, `MemoryProcess` |
| 설명 | CPU/메모리 사용률 상위 N개 프로세스를 수집 |
| JSON 키 | `Collectors.<Name>.TopN` |

##### `WatchProcesses`
| 속성 | 값 |
|------|-----|
| 타입 | `array` of `string` |
| 기본값 | `[]` (빈 배열) |
| 사용 Collector | `CPUProcess`, `MemoryProcess` |
| 설명 | TopN과 별도로 항상 추적할 프로세스 이름 목록 |
| JSON 키 | `Collectors.<Name>.WatchProcesses` |
| 예시 | `["earsagent.exe", "ResourceAgent.exe"]` |
| 비고 | TopN에 포함되지 않더라도 이 목록의 프로세스는 항상 수집 |

##### `RequiredProcesses`
| 속성 | 값 |
|------|-----|
| 타입 | `array` of `string` |
| 기본값 | `[]` (빈 배열) |
| 사용 Collector | `ProcessWatch` |
| 설명 | 실행 중이어야 하는 필수 프로세스 목록. 미실행 시 경고 |
| JSON 키 | `Collectors.ProcessWatch.RequiredProcesses` |
| 예시 | `["earsagent.exe", "svchost.exe"]` |

##### `ForbiddenProcesses`
| 속성 | 값 |
|------|-----|
| 타입 | `array` of `string` |
| 기본값 | `[]` (빈 배열) |
| 사용 Collector | `ProcessWatch` |
| 설명 | 실행되면 안 되는 금지 프로세스 목록. 실행 감지 시 경고 |
| JSON 키 | `Collectors.ProcessWatch.ForbiddenProcesses` |
| 예시 | `["TeamViewer.exe", "AnyDesk.exe"]` |

### 4.4 Collector 그룹별 분류

Form View 구현 시 참고할 수 있는 논리적 그룹입니다:

| 그룹 | Collector | 공통점 |
|------|-----------|--------|
| **기본 시스템** | CPU, Memory, Uptime | 특수 필드 없음, 단순 활성화/주기 설정 |
| **디스크** | Disk, StorageSmart | `Disks[]` 필터 공유 |
| **네트워크** | Network | `Interfaces[]` 필터 고유 |
| **하드웨어 센서** | Temperature, Fan, GPU, Voltage, MotherboardTemp | `IncludeZones[]` 필터 공유 |
| **프로세스 순위** | CPUProcess, MemoryProcess | `TopN` + `WatchProcesses[]` 공유 |
| **프로세스 감시** | ProcessWatch | `RequiredProcesses[]` + `ForbiddenProcesses[]` 고유 |

---

## 5. 전체 예시

### 5.1 ResourceAgent.json

```json
{
  "SenderType": "kafka",
  "File": {
    "FilePath": "log/ResourceAgent/metrics.jsonl",
    "MaxSizeMB": 50,
    "MaxBackups": 3,
    "Console": true,
    "Pretty": false,
    "Format": "grok"
  },
  "Kafka": {
    "Brokers": ["localhost:9092"],
    "Compression": "snappy",
    "RequiredAcks": 1,
    "Timeout": "10s"
  },
  "Batch": {
    "FlushFrequency": "30s",
    "FlushMessages": 100,
    "MaxBatchSize": 500,
    "MaxRetries": 2,
    "RetryBackoff": "500ms"
  },
  "VirtualAddressList": "",
  "ServiceDiscoveryPort": 50009,
  "ResourceMonitorTopic": "",
  "TimeDiffSyncInterval": 3600,
  "Redis": {
    "Port": 6379,
    "Password": "",
    "DB": 10
  },
  "PrivateIPAddressPattern": "",
  "SocksProxy": {
    "Host": "",
    "Port": 0
  }
}
```

### 5.2 Monitor.json

```json
{
  "Collectors": {
    "CPU": {
      "Enabled": true,
      "Interval": "30s"
    },
    "Memory": {
      "Enabled": true,
      "Interval": "30s"
    },
    "Disk": {
      "Enabled": true,
      "Interval": "60s",
      "Disks": []
    },
    "Network": {
      "Enabled": true,
      "Interval": "30s",
      "Interfaces": []
    },
    "Temperature": {
      "Enabled": true,
      "Interval": "60s",
      "IncludeZones": []
    },
    "Fan": {
      "Enabled": true,
      "Interval": "60s",
      "IncludeZones": []
    },
    "GPU": {
      "Enabled": true,
      "Interval": "60s",
      "IncludeZones": []
    },
    "Voltage": {
      "Enabled": true,
      "Interval": "60s",
      "IncludeZones": []
    },
    "MotherboardTemp": {
      "Enabled": true,
      "Interval": "60s",
      "IncludeZones": []
    },
    "StorageSmart": {
      "Enabled": true,
      "Interval": "300s",
      "Disks": []
    },
    "CPUProcess": {
      "Enabled": true,
      "Interval": "60s",
      "TopN": 10,
      "WatchProcesses": []
    },
    "MemoryProcess": {
      "Enabled": true,
      "Interval": "60s",
      "TopN": 10,
      "WatchProcesses": []
    },
    "Uptime": {
      "Enabled": true,
      "Interval": "300s"
    },
    "ProcessWatch": {
      "Enabled": true,
      "Interval": "60s",
      "RequiredProcesses": [],
      "ForbiddenProcesses": []
    }
  }
}
```

---

## 소스 참조

| 파일 | 용도 |
|------|------|
| `ResourceAgent/internal/config/config.go` | Go 구조체 정의, `DefaultConfig()`, `Merge()` 로직 |
| `ResourceAgent/internal/config/loader.go` | JSON 파싱, `rawConfig` → `Config` 변환, duration 문자열 파싱 |
| `ResourceAgent/conf/ResourceAgent/ResourceAgent.json` | 실제 config 예시 |
| `ResourceAgent/conf/ResourceAgent/Monitor.json` | 실제 monitor config 예시 |
