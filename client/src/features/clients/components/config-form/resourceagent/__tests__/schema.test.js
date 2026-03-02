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
    it('has exactly 34 fields', () => {
      expect(Object.keys(RESOURCEAGENT_SCHEMA.fields)).toHaveLength(34)
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
      const validTypes = ['text', 'number', 'boolean', 'select', 'password', 'go-duration', 'array']
      for (const [name, def] of Object.entries(RESOURCEAGENT_SCHEMA.fields)) {
        expect(validTypes, `${name} has invalid type: ${def.type}`).toContain(def.type)
      }
    })
  })

  // ── fieldGroups ──

  describe('fieldGroups', () => {
    it('has 6 groups', () => {
      expect(RESOURCEAGENT_SCHEMA.fieldGroups).toHaveLength(6)
    })

    it('covers all 34 fields total', () => {
      const allFields = RESOURCEAGENT_SCHEMA.fieldGroups.flatMap(g => g.fields)
      expect(allFields).toHaveLength(34)
      const schemaFields = Object.keys(RESOURCEAGENT_SCHEMA.fields)
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

    it('Kafka 설정 group has showWhen for kafka SenderType', () => {
      const kafkaGroup = RESOURCEAGENT_SCHEMA.fieldGroups.find(g => g.name === 'Kafka 설정')
      expect(kafkaGroup).toBeDefined()
      expect(kafkaGroup.showWhen).toEqual({ field: 'SenderType', value: 'kafka' })
      expect(kafkaGroup.fields).toContain('Kafka.Brokers')
      expect(kafkaGroup.fields).toContain('Kafka.EnableTLS')
      expect(kafkaGroup.fields).toContain('Kafka.SASLEnabled')
      expect(kafkaGroup.fields).toContain('Kafka.Timeout')
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
    it('SenderType options: kafkarest, kafka, file', () => {
      const values = RESOURCEAGENT_SCHEMA.fields.SenderType.options.map(o => o.value)
      expect(values).toEqual(['kafkarest', 'kafka', 'file'])
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

    it('File.Format options: "", json, legacy', () => {
      const values = RESOURCEAGENT_SCHEMA.fields['File.Format'].options.map(o => o.value)
      expect(values).toEqual(['', 'json', 'legacy'])
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
    it('Kafka.RetryBackoff is go-duration type', () => {
      expect(RESOURCEAGENT_SCHEMA.fields['Kafka.RetryBackoff'].type).toBe('go-duration')
    })

    it('Kafka.FlushFrequency is go-duration type', () => {
      expect(RESOURCEAGENT_SCHEMA.fields['Kafka.FlushFrequency'].type).toBe('go-duration')
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
      const nonConditional = ['SenderType', 'Kafka.Brokers', 'Kafka.EnableTLS', 'Kafka.SASLEnabled', 'Redis.Port']
      for (const name of nonConditional) {
        expect(RESOURCEAGENT_SCHEMA.fields[name].conditional, `${name} should not have conditional`).toBeUndefined()
      }
    })
  })

  // ── array field ──

  describe('array field', () => {
    it('Kafka.Brokers is array type', () => {
      expect(RESOURCEAGENT_SCHEMA.fields['Kafka.Brokers'].type).toBe('array')
    })

    it('Kafka.Brokers default is ["localhost:9092"]', () => {
      expect(RESOURCEAGENT_SCHEMA.fields['Kafka.Brokers'].default).toEqual(['localhost:9092'])
    })
  })
})

// ===========================================================================
// Cycle 2: buildResourceAgentOutput
// ===========================================================================

describe('buildResourceAgentOutput', () => {
  it('kafka mode: includes Kafka, excludes File', () => {
    const formData = {
      SenderType: 'kafka',
      'Kafka.Brokers': ['broker1:9092'],
      'Redis.Port': 50001,
      'Redis.DB': 10,
    }
    const out = buildResourceAgentOutput(formData)
    expect(out.SenderType).toBe('kafka')
    expect(out.Kafka.Brokers).toEqual(['broker1:9092'])
    expect(out.Redis.Port).toBe(50001)
    expect(out.File).toBeUndefined()
  })

  it('file mode: includes File, excludes Kafka', () => {
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
  })

  it('kafkarest mode: excludes both Kafka and File', () => {
    const formData = { SenderType: 'kafkarest' }
    const out = buildResourceAgentOutput(formData)
    expect(out.SenderType).toBe('kafkarest')
    expect(out.Kafka).toBeUndefined()
    expect(out.File).toBeUndefined()
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
      'Kafka.MaxRetries': '5',
      'Kafka.FlushMessages': '200',
      'Kafka.BatchSize': '32768',
      'Kafka.RequiredAcks': '1',
      'SocksProxy.Port': '30000',
    }
    const out = buildResourceAgentOutput(formData)
    expect(out.Redis.Port).toBe(6380)
    expect(typeof out.Redis.Port).toBe('number')
    expect(out.Redis.DB).toBe(5)
    expect(out.ServiceDiscoveryPort).toBe(50010)
    expect(out.TimeDiffSyncInterval).toBe(7200)
    expect(out.Kafka.MaxRetries).toBe(5)
    expect(out.Kafka.FlushMessages).toBe(200)
    expect(out.Kafka.BatchSize).toBe(32768)
    expect(out.Kafka.RequiredAcks).toBe(1)
    expect(out.SocksProxy.Port).toBe(30000)
  })

  it('coerces boolean fields (kafka mode)', () => {
    const formData = {
      SenderType: 'kafka',
      'Kafka.EnableTLS': true,
      'Kafka.SASLEnabled': false,
    }
    const out = buildResourceAgentOutput(formData)
    expect(out.Kafka.EnableTLS).toBe(true)
    expect(typeof out.Kafka.EnableTLS).toBe('boolean')
    expect(out.Kafka.SASLEnabled).toBe(false)
  })

  it('coerces boolean fields (file mode)', () => {
    const formData = {
      SenderType: 'file',
      'File.Console': true,
      'File.Pretty': false,
    }
    const out = buildResourceAgentOutput(formData)
    expect(out.File.Console).toBe(true)
    expect(out.File.Pretty).toBe(false)
  })

  it('preserves array fields', () => {
    const formData = {
      SenderType: 'kafka',
      'Kafka.Brokers': ['broker1:9092', 'broker2:9092']
    }
    const out = buildResourceAgentOutput(formData)
    expect(out.Kafka.Brokers).toEqual(['broker1:9092', 'broker2:9092'])
    expect(Array.isArray(out.Kafka.Brokers)).toBe(true)
  })

  it('empty formData defaults to kafka (includes Kafka, excludes File)', () => {
    const out = buildResourceAgentOutput({})
    expect(out.SenderType).toBe('kafka')
    expect(out.Kafka.Brokers).toEqual(['localhost:9092'])
    expect(out.Kafka.Compression).toBe('snappy')
    expect(out.Kafka.RequiredAcks).toBe(1)
    expect(out.Redis.Port).toBe(50001)
    expect(out.Redis.DB).toBe(10)
    expect(out.SocksProxy.Host).toBe('')
    expect(out.File).toBeUndefined()
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
        Brokers: ['b1:9092'],
        Compression: 'gzip',
        RequiredAcks: -1,
        MaxRetries: 5,
        RetryBackoff: '200ms',
        FlushFrequency: '1s',
        FlushMessages: 200,
        BatchSize: 32768,
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
      Redis: { Port: 6380, Password: 'redis-pass', DB: 5 },
      SocksProxy: { Host: '192.168.1.100', Port: 30000 },
      File: {
        FilePath: 'custom/path.jsonl',
        MaxSizeMB: 100,
        MaxBackups: 5,
        Console: false,
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
    expect(result['Kafka.Brokers']).toEqual(['b1:9092'])
    expect(result['Kafka.Compression']).toBe('gzip')
    expect(result['Kafka.RequiredAcks']).toBe(-1)
    expect(result['Kafka.EnableTLS']).toBe(true)
    expect(result['Kafka.TLSCertFile']).toBe('/cert.pem')
    expect(result['Kafka.SASLEnabled']).toBe(true)
    expect(result['Kafka.SASLMechanism']).toBe('SCRAM-SHA-256')
    expect(result['Kafka.SASLUser']).toBe('admin')
    expect(result['Kafka.SASLPassword']).toBe('secret')
    expect(result['Redis.Port']).toBe(6380)
    expect(result['Redis.Password']).toBe('redis-pass')
    expect(result['Redis.DB']).toBe(5)
    expect(result['SocksProxy.Host']).toBe('192.168.1.100')
    expect(result['SocksProxy.Port']).toBe(30000)
    expect(result['File.FilePath']).toBe('custom/path.jsonl')
    expect(result['File.MaxSizeMB']).toBe(100)
    expect(result['File.Console']).toBe(false)
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
    expect(result.SenderType).toBe('kafka')
    expect(result['Kafka.Brokers']).toEqual(['localhost:9092'])
    expect(result['Kafka.Compression']).toBe('snappy')
    expect(result['Kafka.RequiredAcks']).toBe(1)
    expect(result['Kafka.MaxRetries']).toBe(3)
    expect(result['Kafka.RetryBackoff']).toBe('100ms')
    expect(result['Kafka.FlushFrequency']).toBe('500ms')
    expect(result['Kafka.FlushMessages']).toBe(100)
    expect(result['Kafka.BatchSize']).toBe(16384)
    expect(result['Kafka.Timeout']).toBe('10s')
    expect(result['Kafka.EnableTLS']).toBe(false)
    expect(result['Kafka.TLSCertFile']).toBe('')
    expect(result['Kafka.TLSKeyFile']).toBe('')
    expect(result['Kafka.TLSCAFile']).toBe('')
    expect(result['Kafka.SASLEnabled']).toBe(false)
    expect(result['Kafka.SASLMechanism']).toBe('')
    expect(result['Kafka.SASLUser']).toBe('')
    expect(result['Kafka.SASLPassword']).toBe('')
    expect(result['Redis.Port']).toBe(50001)
    expect(result['Redis.Password']).toBe('')
    expect(result['Redis.DB']).toBe(10)
    expect(result['SocksProxy.Host']).toBe('')
    expect(result['SocksProxy.Port']).toBe(0)
    expect(result['File.FilePath']).toBe('log/ResourceAgent/metrics.jsonl')
    expect(result['File.MaxSizeMB']).toBe(10)
    expect(result['File.MaxBackups']).toBe(3)
    expect(result['File.Console']).toBe(true)
    expect(result['File.Pretty']).toBe(false)
    expect(result['File.Format']).toBe('')
    expect(result.VirtualAddressList).toBe('')
    expect(result.ServiceDiscoveryPort).toBe(50009)
    expect(result.ResourceMonitorTopic).toBe('process')
    expect(result.TimeDiffSyncInterval).toBe(3600)
    expect(result.PrivateIPAddressPattern).toBe('')
  })

  it('empty config produces all defaults', () => {
    const result = parseResourceAgentInput({})
    // Verify all 35 fields are present
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
    expect(result['Kafka.Brokers']).toEqual(['localhost:9092']) // default
    expect(result['Redis.DB']).toBe(15)
    expect(result['Redis.Port']).toBe(50001) // default
  })
})

// ===========================================================================
// Cycle 4: Roundtrip
// ===========================================================================

describe('Roundtrip: build(parse(config))', () => {
  it('kafka mode: Kafka included, File excluded', () => {
    const inputConfig = {
      SenderType: 'kafka',
      Kafka: {
        Brokers: ['localhost:9092'],
        Compression: 'snappy',
        RequiredAcks: 1,
        MaxRetries: 3,
        RetryBackoff: '100ms',
        FlushFrequency: '500ms',
        FlushMessages: 100,
        BatchSize: 16384,
        Timeout: '10s',
        EnableTLS: false,
        TLSCertFile: '',
        TLSKeyFile: '',
        TLSCAFile: '',
        SASLEnabled: false,
        SASLMechanism: 'PLAIN',
        SASLUser: '',
        SASLPassword: ''
      },
      VirtualAddressList: '',
      ServiceDiscoveryPort: 50009,
      ResourceMonitorTopic: '',
      TimeDiffSyncInterval: 3600,
      Redis: { Port: 50001, Password: '', DB: 10 },
      PrivateIPAddressPattern: '',
      SocksProxy: { Host: '', Port: 0 }
    }

    const parsed = parseResourceAgentInput(inputConfig)
    const rebuilt = buildResourceAgentOutput(parsed)
    expect(rebuilt.Kafka).toEqual(inputConfig.Kafka)
    expect(rebuilt.File).toBeUndefined()
    expect(rebuilt.SenderType).toBe('kafka')
    expect(rebuilt.Redis).toEqual(inputConfig.Redis)
  })

  it('file mode: File included, Kafka excluded', () => {
    const inputConfig = {
      SenderType: 'file',
      File: {
        FilePath: 'custom/metrics.jsonl',
        MaxSizeMB: 100,
        MaxBackups: 5,
        Console: false,
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
    expect(rebuilt.SenderType).toBe('file')
  })

  it('roundtrip preserves empty string ResourceMonitorTopic', () => {
    const config = { SenderType: 'kafka', ResourceMonitorTopic: '' }
    const parsed = parseResourceAgentInput(config)
    const rebuilt = buildResourceAgentOutput(parsed)
    expect(rebuilt.ResourceMonitorTopic).toBe('')
  })
})
