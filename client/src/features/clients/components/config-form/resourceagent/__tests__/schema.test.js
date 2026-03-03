import { describe, it, expect } from 'vitest'
import {
  RESOURCEAGENT_SCHEMA,
  parseResourceAgentInput,
  buildResourceAgentOutput
} from '../schema'

// ===========================================================================
// Cycle 1: Schema Constants + Field Definitions
// ===========================================================================

describe('RESOURCEAGENT_SCHEMA', () => {
  // ── fields ──

  describe('fields', () => {
    it('has exactly 33 fields', () => {
      expect(Object.keys(RESOURCEAGENT_SCHEMA.fields)).toHaveLength(33)
    })

    it('every field has type, label, description', () => {
      for (const [name, def] of Object.entries(RESOURCEAGENT_SCHEMA.fields)) {
        expect(def.type, `${name} should have type`).toBeDefined()
        expect(def.label, `${name} should have label`).toBeDefined()
        expect(typeof def.label).toBe('string')
        expect(def.description, `${name} should have description`).toBeDefined()
        expect(typeof def.description).toBe('string')
      }
    })

    it('every field has a valid type', () => {
      const validTypes = ['text', 'number', 'boolean', 'select', 'password', 'go-duration']
      for (const [name, def] of Object.entries(RESOURCEAGENT_SCHEMA.fields)) {
        expect(validTypes, `${name} has invalid type: ${def.type}`).toContain(def.type)
      }
    })
  })

  // ── fieldGroups ──

  describe('fieldGroups', () => {
    it('has 7 groups', () => {
      expect(RESOURCEAGENT_SCHEMA.fieldGroups).toHaveLength(7)
    })

    it('covers 25 visible fields (TLS/SASL 8개 숨김)', () => {
      const allFields = RESOURCEAGENT_SCHEMA.fieldGroups.flatMap(g => g.fields)
      expect(allFields).toHaveLength(25)
      const hiddenFields = [
        'Kafka.EnableTLS', 'Kafka.TLSCertFile', 'Kafka.TLSKeyFile', 'Kafka.TLSCAFile',
        'Kafka.SASLEnabled', 'Kafka.SASLMechanism', 'Kafka.SASLUser', 'Kafka.SASLPassword'
      ]
      const schemaFields = Object.keys(RESOURCEAGENT_SCHEMA.fields).filter(f => !hiddenFields.includes(f))
      expect(allFields.sort()).toEqual(schemaFields.sort())
    })

    it('group "전송 방식" has SenderType', () => {
      const group = RESOURCEAGENT_SCHEMA.fieldGroups.find(g => g.name === '전송 방식')
      expect(group).toBeDefined()
      expect(group.fields).toEqual(['SenderType'])
    })

    it('group "파일 출력" has showWhen for file SenderType', () => {
      const group = RESOURCEAGENT_SCHEMA.fieldGroups.find(g => g.name === '파일 출력')
      expect(group).toBeDefined()
      expect(group.showWhen).toEqual({ field: 'SenderType', value: 'file' })
      expect(group.fields).toContain('File.FilePath')
      expect(group.fields).toContain('File.Format')
    })

    it('Kafka 연결 group has showWhen for kafka SenderType', () => {
      const kafkaGroup = RESOURCEAGENT_SCHEMA.fieldGroups.find(g => g.name === 'Kafka 연결')
      expect(kafkaGroup).toBeDefined()
      expect(kafkaGroup.showWhen).toEqual({ field: 'SenderType', value: 'kafka' })
      expect(kafkaGroup.fields).toContain('Kafka.BrokerPort')
      expect(kafkaGroup.fields).toContain('Kafka.Timeout')
      // TLS/SASL 필드는 보안 이슈 대응 시 추가 예정
      expect(kafkaGroup.fields).not.toContain('Kafka.EnableTLS')
      expect(kafkaGroup.fields).not.toContain('Kafka.SASLEnabled')
    })

    it('배치/재시도 group has showWhen for kafka+kafkarest', () => {
      const batchGroup = RESOURCEAGENT_SCHEMA.fieldGroups.find(g => g.name === '배치/재시도')
      expect(batchGroup).toBeDefined()
      expect(batchGroup.showWhen).toEqual({ field: 'SenderType', values: ['kafka', 'kafkarest'] })
      expect(batchGroup.fields).toContain('Batch.FlushFrequency')
      expect(batchGroup.fields).toContain('Batch.MaxBatchSize')
    })

    it('Redis, SOCKS Proxy, 네트워크/검색 groups have no showWhen', () => {
      const names = ['Redis', 'SOCKS Proxy', '네트워크/검색']
      for (const name of names) {
        const group = RESOURCEAGENT_SCHEMA.fieldGroups.find(g => g.name === name)
        expect(group, `${name} group should exist`).toBeDefined()
        expect(group.showWhen, `${name} should not have showWhen`).toBeUndefined()
      }
    })
  })

  // ── select field options ──

  describe('select field options', () => {
    it('SenderType options: kafkarest, kafka (disabled), file', () => {
      const values = RESOURCEAGENT_SCHEMA.fields.SenderType.options.map(o => o.value)
      expect(values).toEqual(['kafkarest', 'kafka', 'file'])
      const kafkaOpt = RESOURCEAGENT_SCHEMA.fields.SenderType.options.find(o => o.value === 'kafka')
      expect(kafkaOpt.disabled).toBe(true)
    })

    it('Kafka.Compression options: none, gzip, snappy, lz4, zstd', () => {
      const values = RESOURCEAGENT_SCHEMA.fields['Kafka.Compression'].options.map(o => o.value)
      expect(values).toEqual(['none', 'gzip', 'snappy', 'lz4', 'zstd'])
    })

    it('Kafka.RequiredAcks options: 0, 1, -1', () => {
      const values = RESOURCEAGENT_SCHEMA.fields['Kafka.RequiredAcks'].options.map(o => o.value)
      expect(values).toEqual([0, 1, -1])
    })

    it('Kafka.SASLMechanism options: PLAIN, SCRAM-SHA-256, SCRAM-SHA-512', () => {
      const values = RESOURCEAGENT_SCHEMA.fields['Kafka.SASLMechanism'].options.map(o => o.value)
      expect(values).toEqual(['PLAIN', 'SCRAM-SHA-256', 'SCRAM-SHA-512'])
    })

    it('ResourceMonitorTopic options: process, model, all', () => {
      const values = RESOURCEAGENT_SCHEMA.fields.ResourceMonitorTopic.options.map(o => o.value)
      expect(values).toEqual(['process', 'model', 'all'])
    })

    it('File.Format options: grok, json', () => {
      const values = RESOURCEAGENT_SCHEMA.fields['File.Format'].options.map(o => o.value)
      expect(values).toEqual(['grok', 'json'])
    })
  })

  // ── password fields ──

  describe('password fields', () => {
    it('Kafka.SASLPassword is password type', () => {
      expect(RESOURCEAGENT_SCHEMA.fields['Kafka.SASLPassword'].type).toBe('password')
    })

    it('Redis.Password is password type', () => {
      expect(RESOURCEAGENT_SCHEMA.fields['Redis.Password'].type).toBe('password')
    })
  })

  // ── go-duration fields ──

  describe('go-duration fields', () => {
    it('Batch.RetryBackoff is go-duration type', () => {
      expect(RESOURCEAGENT_SCHEMA.fields['Batch.RetryBackoff'].type).toBe('go-duration')
    })

    it('Batch.FlushFrequency is go-duration type', () => {
      expect(RESOURCEAGENT_SCHEMA.fields['Batch.FlushFrequency'].type).toBe('go-duration')
    })

    it('Kafka.Timeout is go-duration type', () => {
      expect(RESOURCEAGENT_SCHEMA.fields['Kafka.Timeout'].type).toBe('go-duration')
    })
  })

  // ── conditional fields ──

  describe('conditional fields', () => {
    it('TLS 3 fields have conditional on Kafka.EnableTLS', () => {
      const tlsFields = ['Kafka.TLSCertFile', 'Kafka.TLSKeyFile', 'Kafka.TLSCAFile']
      for (const name of tlsFields) {
        const def = RESOURCEAGENT_SCHEMA.fields[name]
        expect(def.conditional, `${name} should have conditional`).toEqual({
          field: 'Kafka.EnableTLS',
          value: true
        })
      }
    })

    it('SASL 3 fields have conditional on Kafka.SASLEnabled', () => {
      const saslFields = ['Kafka.SASLMechanism', 'Kafka.SASLUser', 'Kafka.SASLPassword']
      for (const name of saslFields) {
        const def = RESOURCEAGENT_SCHEMA.fields[name]
        expect(def.conditional, `${name} should have conditional`).toEqual({
          field: 'Kafka.SASLEnabled',
          value: true
        })
      }
    })

    it('non-conditional fields do not have conditional property', () => {
      const nonConditional = ['SenderType', 'Kafka.BrokerPort', 'Kafka.EnableTLS', 'Kafka.SASLEnabled', 'Redis.Port']
      for (const name of nonConditional) {
        expect(RESOURCEAGENT_SCHEMA.fields[name].conditional, `${name} should not have conditional`).toBeUndefined()
      }
    })
  })

  // ── Kafka.BrokerPort field ──

  describe('Kafka.BrokerPort field', () => {
    it('Kafka.BrokerPort is number type', () => {
      expect(RESOURCEAGENT_SCHEMA.fields['Kafka.BrokerPort'].type).toBe('number')
    })

    it('Kafka.BrokerPort default is 9092', () => {
      expect(RESOURCEAGENT_SCHEMA.fields['Kafka.BrokerPort'].default).toBe(9092)
    })
  })
})

// ===========================================================================
// Cycle 2: buildResourceAgentOutput
// ===========================================================================

describe('buildResourceAgentOutput', () => {
  it('kafka mode: includes Kafka + Batch, excludes File', () => {
    const formData = {
      SenderType: 'kafka',
      'Kafka.BrokerPort': 9092,
      'Batch.FlushMessages': 100,
      'Redis.Port': 6379,
      'Redis.DB': 10,
    }
    const out = buildResourceAgentOutput(formData)
    expect(out.SenderType).toBe('kafka')
    expect(out.Kafka.BrokerPort).toBe(9092)
    expect(out.Batch.FlushMessages).toBe(100)
    expect(out.Redis.Port).toBe(6379)
    expect(out.File).toBeUndefined()
  })

  it('file mode: includes File, excludes Kafka + Batch', () => {
    const formData = {
      SenderType: 'file',
      'File.FilePath': 'custom/path.jsonl',
      'File.MaxSizeMB': 20,
    }
    const out = buildResourceAgentOutput(formData)
    expect(out.SenderType).toBe('file')
    expect(out.File.FilePath).toBe('custom/path.jsonl')
    expect(out.File.MaxSizeMB).toBe(20)
    expect(out.Kafka).toBeUndefined()
    expect(out.Batch).toBeUndefined()
  })

  it('kafkarest mode: includes Batch, excludes Kafka and File', () => {
    const formData = { SenderType: 'kafkarest' }
    const out = buildResourceAgentOutput(formData)
    expect(out.SenderType).toBe('kafkarest')
    expect(out.Kafka).toBeUndefined()
    expect(out.File).toBeUndefined()
    expect(out.Batch).toBeDefined()
    expect(out.Redis).toBeDefined()
    expect(out.SocksProxy).toBeDefined()
  })

  it('coerces number fields from string to number', () => {
    const formData = {
      SenderType: 'kafka',
      'Redis.Port': '6380',
      'Redis.DB': '5',
      ServiceDiscoveryPort: '50010',
      TimeDiffSyncInterval: '7200',
      'Kafka.BrokerPort': '9093',
      'Kafka.RequiredAcks': '1',
      'Batch.MaxRetries': '3',
      'Batch.FlushMessages': '200',
      'Batch.MaxBatchSize': '1000',
      'SocksProxy.Port': '30000',
    }
    const out = buildResourceAgentOutput(formData)
    expect(out.Redis.Port).toBe(6380)
    expect(typeof out.Redis.Port).toBe('number')
    expect(out.Redis.DB).toBe(5)
    expect(out.ServiceDiscoveryPort).toBe(50010)
    expect(out.TimeDiffSyncInterval).toBe(7200)
    expect(out.Kafka.BrokerPort).toBe(9093)
    expect(out.Kafka.RequiredAcks).toBe(1)
    expect(out.Batch.MaxRetries).toBe(3)
    expect(out.Batch.FlushMessages).toBe(200)
    expect(out.Batch.MaxBatchSize).toBe(1000)
    expect(out.SocksProxy.Port).toBe(30000)
  })

  it('TLS/SASL fields are excluded from output (hidden)', () => {
    const formData = {
      SenderType: 'kafka',
      'Kafka.EnableTLS': true,
      'Kafka.SASLEnabled': true,
      'Kafka.SASLMechanism': 'PLAIN',
    }
    const out = buildResourceAgentOutput(formData)
    expect(out.Kafka.EnableTLS).toBeUndefined()
    expect(out.Kafka.SASLEnabled).toBeUndefined()
    expect(out.Kafka.SASLMechanism).toBeUndefined()
  })

  it('coerces boolean fields (file mode)', () => {
    const formData = {
      SenderType: 'file',
      'File.Pretty': false,
    }
    const out = buildResourceAgentOutput(formData)
    expect(out.File.Pretty).toBe(false)
  })

  it('empty formData defaults to kafkarest (includes Batch, excludes Kafka + File)', () => {
    const out = buildResourceAgentOutput({})
    expect(out.SenderType).toBe('kafkarest')
    expect(out.Kafka).toBeUndefined()
    expect(out.File).toBeUndefined()
    expect(out.Batch.FlushFrequency).toBe('30s')
    expect(out.Batch.FlushMessages).toBe(100)
    expect(out.Batch.MaxBatchSize).toBe(500)
    expect(out.Batch.MaxRetries).toBe(2)
    expect(out.Batch.RetryBackoff).toBe('500ms')
    expect(out.Redis.Port).toBe(50001)
    expect(out.Redis.DB).toBe(10)
    expect(out.SocksProxy.Host).toBe('')
    expect(out.VirtualAddressList).toBe('')
    expect(out.ServiceDiscoveryPort).toBe(50009)
    expect(out.ResourceMonitorTopic).toBe('process')
  })

  it('top-level fields go directly to output', () => {
    const formData = {
      VirtualAddressList: '10.0.0.1',
      ServiceDiscoveryPort: 50010,
      ResourceMonitorTopic: 'model',
      TimeDiffSyncInterval: 1800,
      PrivateIPAddressPattern: '192\\.168\\..*'
    }
    const out = buildResourceAgentOutput(formData)
    expect(out.VirtualAddressList).toBe('10.0.0.1')
    expect(out.ServiceDiscoveryPort).toBe(50010)
    expect(out.ResourceMonitorTopic).toBe('model')
    expect(out.TimeDiffSyncInterval).toBe(1800)
    expect(out.PrivateIPAddressPattern).toBe('192\\.168\\..*')
  })

  it('RequiredAcks select value coerced to number', () => {
    const formData = { SenderType: 'kafka', 'Kafka.RequiredAcks': '-1' }
    const out = buildResourceAgentOutput(formData)
    expect(out.Kafka.RequiredAcks).toBe(-1)
    expect(typeof out.Kafka.RequiredAcks).toBe('number')
  })
})

// ===========================================================================
// Cycle 3: parseResourceAgentInput
// ===========================================================================

describe('parseResourceAgentInput', () => {
  it('flattens nested config to dot-notation formData', () => {
    const config = {
      SenderType: 'kafka',
      Kafka: {
        BrokerPort: 9093,
        Compression: 'gzip',
        RequiredAcks: -1,
        Timeout: '30s',
        EnableTLS: true,
        TLSCertFile: '/cert.pem',
        TLSKeyFile: '/key.pem',
        TLSCAFile: '/ca.pem',
        SASLEnabled: true,
        SASLMechanism: 'SCRAM-SHA-256',
        SASLUser: 'admin',
        SASLPassword: 'secret'
      },
      Batch: {
        FlushFrequency: '1m',
        FlushMessages: 200,
        MaxBatchSize: 1000,
        MaxRetries: 5,
        RetryBackoff: '1s'
      },
      Redis: { Port: 6380, Password: 'redis-pass', DB: 5 },
      SocksProxy: { Host: '192.168.1.100', Port: 30000 },
      File: {
        FilePath: 'custom/path.jsonl',
        MaxSizeMB: 100,
        MaxBackups: 5,
        Pretty: true,
        Format: 'json'
      },
      VirtualAddressList: '10.0.0.1',
      ServiceDiscoveryPort: 50010,
      ResourceMonitorTopic: 'model',
      TimeDiffSyncInterval: 1800,
      PrivateIPAddressPattern: '10\\..*'
    }
    const result = parseResourceAgentInput(config)
    expect(result.SenderType).toBe('kafka')
    expect(result['Kafka.BrokerPort']).toBe(9093)
    expect(result['Kafka.Compression']).toBe('gzip')
    expect(result['Kafka.RequiredAcks']).toBe(-1)
    expect(result['Kafka.EnableTLS']).toBe(true)
    expect(result['Kafka.TLSCertFile']).toBe('/cert.pem')
    expect(result['Kafka.SASLEnabled']).toBe(true)
    expect(result['Kafka.SASLMechanism']).toBe('SCRAM-SHA-256')
    expect(result['Kafka.SASLUser']).toBe('admin')
    expect(result['Kafka.SASLPassword']).toBe('secret')
    expect(result['Batch.FlushFrequency']).toBe('1m')
    expect(result['Batch.FlushMessages']).toBe(200)
    expect(result['Batch.MaxBatchSize']).toBe(1000)
    expect(result['Batch.MaxRetries']).toBe(5)
    expect(result['Batch.RetryBackoff']).toBe('1s')
    expect(result['Redis.Port']).toBe(6380)
    expect(result['Redis.Password']).toBe('redis-pass')
    expect(result['Redis.DB']).toBe(5)
    expect(result['SocksProxy.Host']).toBe('192.168.1.100')
    expect(result['SocksProxy.Port']).toBe(30000)
    expect(result['File.FilePath']).toBe('custom/path.jsonl')
    expect(result['File.MaxSizeMB']).toBe(100)
    expect(result['File.Pretty']).toBe(true)
    expect(result['File.Format']).toBe('json')
    expect(result.VirtualAddressList).toBe('10.0.0.1')
    expect(result.ServiceDiscoveryPort).toBe(50010)
    expect(result.ResourceMonitorTopic).toBe('model')
    expect(result.TimeDiffSyncInterval).toBe(1800)
    expect(result.PrivateIPAddressPattern).toBe('10\\..*')
  })

  it('missing fields get defaults', () => {
    const result = parseResourceAgentInput({})
    expect(result.SenderType).toBe('kafkarest')
    expect(result['Kafka.BrokerPort']).toBe(9092)
    expect(result['Kafka.Compression']).toBe('snappy')
    expect(result['Kafka.RequiredAcks']).toBe(1)
    expect(result['Kafka.Timeout']).toBe('10s')
    expect(result['Kafka.EnableTLS']).toBe(false)
    expect(result['Kafka.TLSCertFile']).toBe('')
    expect(result['Kafka.TLSKeyFile']).toBe('')
    expect(result['Kafka.TLSCAFile']).toBe('')
    expect(result['Kafka.SASLEnabled']).toBe(false)
    expect(result['Kafka.SASLMechanism']).toBe('')
    expect(result['Kafka.SASLUser']).toBe('')
    expect(result['Kafka.SASLPassword']).toBe('')
    expect(result['Batch.FlushFrequency']).toBe('30s')
    expect(result['Batch.FlushMessages']).toBe(100)
    expect(result['Batch.MaxBatchSize']).toBe(500)
    expect(result['Batch.MaxRetries']).toBe(2)
    expect(result['Batch.RetryBackoff']).toBe('500ms')
    expect(result['Redis.Port']).toBe(50001)
    expect(result['Redis.Password']).toBe('')
    expect(result['Redis.DB']).toBe(10)
    expect(result['SocksProxy.Host']).toBe('')
    expect(result['SocksProxy.Port']).toBe(0)
    expect(result['File.FilePath']).toBe('log/ResourceAgent/metrics.log')
    expect(result['File.MaxSizeMB']).toBe(10)
    expect(result['File.MaxBackups']).toBe(3)
    expect(result['File.Pretty']).toBe(false)
    expect(result['File.Format']).toBe('grok')
    expect(result.VirtualAddressList).toBe('')
    expect(result.ServiceDiscoveryPort).toBe(50009)
    expect(result.ResourceMonitorTopic).toBe('process')
    expect(result.TimeDiffSyncInterval).toBe(3600)
    expect(result.PrivateIPAddressPattern).toBe('')
  })

  it('empty config produces all defaults', () => {
    const result = parseResourceAgentInput({})
    const schemaFields = Object.keys(RESOURCEAGENT_SCHEMA.fields)
    for (const fieldName of schemaFields) {
      expect(result, `${fieldName} should be in result`).toHaveProperty(fieldName)
    }
  })

  it('partial nested config merges with defaults', () => {
    const config = {
      Kafka: { Compression: 'gzip' },
      Redis: { DB: 15 }
    }
    const result = parseResourceAgentInput(config)
    expect(result['Kafka.Compression']).toBe('gzip')
    expect(result['Kafka.BrokerPort']).toBe(9092) // default
    expect(result['Redis.DB']).toBe(15)
    expect(result['Redis.Port']).toBe(50001) // default
  })
})

// ===========================================================================
// Cycle 4: Roundtrip
// ===========================================================================

describe('Roundtrip: build(parse(config))', () => {
  it('kafka mode: Kafka (no TLS/SASL) + Batch included, File excluded', () => {
    const inputConfig = {
      SenderType: 'kafka',
      Kafka: {
        BrokerPort: 9092,
        Compression: 'snappy',
        RequiredAcks: 1,
        Timeout: '10s'
      },
      Batch: {
        FlushFrequency: '30s',
        FlushMessages: 100,
        MaxBatchSize: 500,
        MaxRetries: 2,
        RetryBackoff: '500ms'
      },
      VirtualAddressList: '',
      ServiceDiscoveryPort: 50009,
      ResourceMonitorTopic: '',
      TimeDiffSyncInterval: 3600,
      Redis: { Port: 6379, Password: '', DB: 10 },
      PrivateIPAddressPattern: '',
      SocksProxy: { Host: '', Port: 0 }
    }

    const parsed = parseResourceAgentInput(inputConfig)
    const rebuilt = buildResourceAgentOutput(parsed)
    // TLS/SASL fields excluded from output
    expect(rebuilt.Kafka).toEqual(inputConfig.Kafka)
    expect(rebuilt.Kafka.EnableTLS).toBeUndefined()
    expect(rebuilt.Kafka.SASLEnabled).toBeUndefined()
    expect(rebuilt.Batch).toEqual(inputConfig.Batch)
    expect(rebuilt.File).toBeUndefined()
    expect(rebuilt.SenderType).toBe('kafka')
    expect(rebuilt.Redis).toEqual(inputConfig.Redis)
  })

  it('file mode: File included, Kafka + Batch excluded', () => {
    const inputConfig = {
      SenderType: 'file',
      File: {
        FilePath: 'custom/metrics.log',
        MaxSizeMB: 100,
        MaxBackups: 5,
        Pretty: true,
        Format: 'json'
      },
      Redis: { Port: 6380, Password: 'redis-pass', DB: 5 },
      SocksProxy: { Host: '192.168.1.100', Port: 30000 },
      VirtualAddressList: '10.0.0.1',
      ServiceDiscoveryPort: 50010,
      ResourceMonitorTopic: 'model',
      TimeDiffSyncInterval: 1800,
      PrivateIPAddressPattern: '10\\..*'
    }

    const parsed = parseResourceAgentInput(inputConfig)
    const rebuilt = buildResourceAgentOutput(parsed)
    expect(rebuilt.File).toEqual(inputConfig.File)
    expect(rebuilt.Kafka).toBeUndefined()
    expect(rebuilt.Batch).toBeUndefined()
    expect(rebuilt.SenderType).toBe('file')
  })

  it('roundtrip preserves empty string ResourceMonitorTopic', () => {
    const config = { SenderType: 'kafka', ResourceMonitorTopic: '' }
    const parsed = parseResourceAgentInput(config)
    const rebuilt = buildResourceAgentOutput(parsed)
    expect(rebuilt.ResourceMonitorTopic).toBe('')
  })
})
