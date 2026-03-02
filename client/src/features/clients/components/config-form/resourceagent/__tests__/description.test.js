import { describe, it, expect } from 'vitest'
import { describeResourceAgent } from '../description'

describe('describeResourceAgent', () => {
  // ── kafka sender ──

  it('kafka sender → "Kafka 직접 전송"', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafka',
      Kafka: {
        Brokers: ['broker1:9092', 'broker2:9092'],
        Topic: 'factory-metrics'
      }
    })
    expect(desc).toContain('Kafka 직접 전송')
  })

  it('kafka sender shows broker count and addresses', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafka',
      Kafka: {
        Brokers: ['broker1:9092', 'broker2:9092']
      }
    })
    expect(desc).toContain('브로커: 2개')
    expect(desc).toContain('broker1:9092')
    expect(desc).toContain('broker2:9092')
  })

  it('kafka sender with single broker', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafka',
      Kafka: {
        Brokers: ['localhost:9092']
      }
    })
    expect(desc).toContain('브로커: 1개')
    expect(desc).toContain('localhost:9092')
  })

  // ── file sender ──

  it('file sender → "로컬 파일"', () => {
    const desc = describeResourceAgent({
      SenderType: 'file',
      File: { FilePath: 'log/metrics.jsonl' }
    })
    expect(desc).toContain('로컬 파일')
  })

  it('file sender shows filepath', () => {
    const desc = describeResourceAgent({
      SenderType: 'file',
      File: { FilePath: 'custom/path.jsonl' }
    })
    expect(desc).toContain('custom/path.jsonl')
  })

  // ── kafkarest sender ──

  it('kafkarest sender → "KafkaRest Proxy"', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafkarest'
    })
    expect(desc).toContain('KafkaRest Proxy')
  })

  // ── TLS/SASL display ──

  it('TLS enabled shows "TLS: 사용"', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafka',
      Kafka: {
        EnableTLS: true,
        SASLEnabled: false
      }
    })
    expect(desc).toContain('TLS: 사용')
  })

  it('SASL enabled shows mechanism', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafka',
      Kafka: {
        EnableTLS: false,
        SASLEnabled: true,
        SASLMechanism: 'SCRAM-SHA-256'
      }
    })
    expect(desc).toContain('SASL: SCRAM-SHA-256')
  })

  it('TLS + SASL both enabled', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafka',
      Kafka: {
        EnableTLS: true,
        SASLEnabled: true,
        SASLMechanism: 'PLAIN'
      }
    })
    expect(desc).toContain('TLS: 사용')
    expect(desc).toContain('SASL: PLAIN')
  })

  it('TLS and SASL both disabled → no TLS/SASL line', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafka',
      Kafka: {
        Brokers: ['localhost:9092'],
        EnableTLS: false,
        SASLEnabled: false
      }
    })
    expect(desc).not.toContain('TLS')
    expect(desc).not.toContain('SASL')
  })

  // ── Redis display ──

  it('Redis display shows port and DB', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafka',
      Redis: { Port: 6379, DB: 10 }
    })
    expect(desc).toContain('Redis: 포트 6379, DB 10')
  })

  it('Redis with custom port and DB', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafka',
      Redis: { Port: 6380, DB: 5 }
    })
    expect(desc).toContain('Redis: 포트 6380, DB 5')
  })

  // ── SOCKS display ──

  it('SOCKS with host:port', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafka',
      SocksProxy: { Host: '192.168.1.100', Port: 30000 }
    })
    expect(desc).toContain('SOCKS: 192.168.1.100:30000')
  })

  it('SOCKS with empty host → no SOCKS line', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafka',
      SocksProxy: { Host: '', Port: 0 }
    })
    expect(desc).not.toContain('SOCKS')
  })

  // ── empty/null config ──

  it('null config → "설정 없음"', () => {
    expect(describeResourceAgent(null)).toBe('설정 없음')
  })

  it('undefined config → "설정 없음"', () => {
    expect(describeResourceAgent(undefined)).toBe('설정 없음')
  })

  it('empty config → "기본 설정"', () => {
    expect(describeResourceAgent({})).toBe('기본 설정')
  })

  // ── full config ──

  it('full config produces multi-line description', () => {
    const desc = describeResourceAgent({
      SenderType: 'kafka',
      Kafka: {
        Brokers: ['broker1:9092', 'broker2:9092'],
        Topic: 'factory-metrics',
        EnableTLS: true,
        SASLEnabled: true,
        SASLMechanism: 'SCRAM-SHA-256',
        Timeout: '30s',
        FlushFrequency: '1s'
      },
      Redis: { Port: 6379, DB: 10 },
      SocksProxy: { Host: '192.168.1.100', Port: 30000 }
    })
    expect(desc).toContain('Kafka 직접 전송')
    expect(desc).toContain('브로커: 2개')
    expect(desc).toContain('TLS: 사용')
    expect(desc).toContain('SASL: SCRAM-SHA-256')
    expect(desc).toContain('Redis: 포트 6379, DB 10')
    expect(desc).toContain('SOCKS: 192.168.1.100:30000')
  })
})
