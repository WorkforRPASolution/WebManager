import { describe, it, expect } from 'vitest'
import {
  ARSAGENT_SCHEMA,
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
  CRONTAB_DEFAULTS,
  createDefaultCronTab,
  buildARSAgentOutput,
  parseARSAgentInput,
} from '../schema'

// ===========================================================================
// Cycle 1: Schema Constants + Field Definitions
// ===========================================================================

describe('ARSAGENT_SCHEMA', () => {
  // ── sections ──

  describe('sections', () => {
    it('has ErrorTrigger, AccessLogLists, CronTab keys', () => {
      expect(Object.keys(ARSAGENT_SCHEMA.sections)).toEqual(
        expect.arrayContaining(['ErrorTrigger', 'AccessLogLists', 'CronTab'])
      )
    })

    it('ErrorTrigger type is trigger-list', () => {
      expect(ARSAGENT_SCHEMA.sections.ErrorTrigger.type).toBe('trigger-list')
    })

    it('AccessLogLists type is source-list', () => {
      expect(ARSAGENT_SCHEMA.sections.AccessLogLists.type).toBe('source-list')
    })

    it('CronTab type is crontab-list', () => {
      expect(ARSAGENT_SCHEMA.sections.CronTab.type).toBe('crontab-list')
    })
  })

  // ── cronTabFields ──

  describe('cronTabFields', () => {
    it('has 7 fields: name, type, arg, no-email, key, timeout, retry', () => {
      const keys = Object.keys(ARSAGENT_SCHEMA.cronTabFields)
      expect(keys).toHaveLength(7)
      expect(keys).toEqual(expect.arrayContaining([
        'name', 'type', 'arg', 'no-email', 'key', 'timeout', 'retry'
      ]))
    })

    it('name is required', () => {
      expect(ARSAGENT_SCHEMA.cronTabFields.name.required).toBe(true)
    })

    it('type is required', () => {
      expect(ARSAGENT_SCHEMA.cronTabFields.type.required).toBe(true)
    })

    it('arg is not required', () => {
      expect(ARSAGENT_SCHEMA.cronTabFields.arg.required).toBe(false)
    })

    it('no-email is not required', () => {
      expect(ARSAGENT_SCHEMA.cronTabFields['no-email'].required).toBe(false)
    })

    it('key is not required', () => {
      expect(ARSAGENT_SCHEMA.cronTabFields.key.required).toBe(false)
    })

    it('timeout is not required', () => {
      expect(ARSAGENT_SCHEMA.cronTabFields.timeout.required).toBe(false)
    })

    it('retry is not required', () => {
      expect(ARSAGENT_SCHEMA.cronTabFields.retry.required).toBe(false)
    })

    it('type has options AR, SR, EN, PU', () => {
      const values = ARSAGENT_SCHEMA.cronTabFields.type.options.map(o => o.value)
      expect(values).toHaveLength(4)
      expect(values).toEqual(expect.arrayContaining(['AR', 'SR', 'EN', 'PU']))
    })
  })

  // ── fields ──

  describe('fields', () => {
    it('has exactly 31 fields (26 required + 5 optional)', () => {
      expect(Object.keys(ARSAGENT_SCHEMA.fields)).toHaveLength(31)
    })

    it('every REQUIRED_FIELDS entry has required: true', () => {
      for (const name of REQUIRED_FIELDS) {
        expect(ARSAGENT_SCHEMA.fields[name].required, `${name} should be required`).toBe(true)
      }
    })

    it('every OPTIONAL_FIELDS entry has required: false', () => {
      for (const name of OPTIONAL_FIELDS) {
        expect(ARSAGENT_SCHEMA.fields[name].required, `${name} should not be required`).toBe(false)
      }
    })

    it('every field has a type property', () => {
      for (const [name, def] of Object.entries(ARSAGENT_SCHEMA.fields)) {
        expect(def.type, `${name} should have type`).toBeDefined()
        expect(['text', 'number', 'boolean', 'duration', 'select']).toContain(def.type)
      }
    })

    it('every field has a label property', () => {
      for (const [name, def] of Object.entries(ARSAGENT_SCHEMA.fields)) {
        expect(def.label, `${name} should have label`).toBeDefined()
        expect(typeof def.label).toBe('string')
      }
    })

    it('number fields have type number', () => {
      const numberFields = [
        'AgentPort4RPC', 'AgentPort4ScreenProtector',
        'MouseEventDelay', 'MouseEventDelayDoubleClick',
        'TotalCpuPercentLimit', 'AgentCpuPercentLimit'
      ]
      for (const name of numberFields) {
        expect(ARSAGENT_SCHEMA.fields[name].type, `${name} should be number`).toBe('number')
      }
    })

    it('boolean fields have type boolean', () => {
      const booleanFields = [
        'IsSendAgentStatus2Redis', 'IsSnapshotRecordingOn',
        'IsSnapshotRecordingDuringRecovery', 'UseUploadLog',
        'PopupSrcLocalMode', 'UseDataBackup', 'UseRouter',
        'IsStandAloneMode', 'ShowEQPLog'
      ]
      for (const name of booleanFields) {
        expect(ARSAGENT_SCHEMA.fields[name].type, `${name} should be boolean`).toBe('boolean')
      }
    })

    it('VisionType has options thrift, grpc, http', () => {
      const values = ARSAGENT_SCHEMA.fields.VisionType.options.map(o => o.value)
      expect(values).toEqual(['thrift', 'grpc', 'http'])
    })

    it('CommandType has options http, grpc', () => {
      const values = ARSAGENT_SCHEMA.fields.CommandType.options.map(o => o.value)
      expect(values).toEqual(['http', 'grpc'])
    })
  })

  // ── fieldGroups ──

  describe('fieldGroups', () => {
    it('has 9 groups', () => {
      expect(ARSAGENT_SCHEMA.fieldGroups).toHaveLength(9)
    })

    it('covers all 31 fields total', () => {
      const allFields = ARSAGENT_SCHEMA.fieldGroups.flatMap(g => g.fields)
      expect(allFields).toHaveLength(31)
      const allDefined = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]
      expect(allFields.sort()).toEqual(allDefined.sort())
    })

    it('UseRouter and PrivateIPAddressPattern are in the same group', () => {
      const group = ARSAGENT_SCHEMA.fieldGroups.find(g => g.fields.includes('UseRouter'))
      expect(group.fields).toContain('PrivateIPAddressPattern')
    })

    it('group 9 contains all 5 optional fields', () => {
      const lastGroup = ARSAGENT_SCHEMA.fieldGroups[8]
      for (const name of OPTIONAL_FIELDS) {
        expect(lastGroup.fields, `group 9 should contain ${name}`).toContain(name)
      }
    })
  })
})

// ===========================================================================
// REQUIRED_FIELDS / OPTIONAL_FIELDS
// ===========================================================================

describe('REQUIRED_FIELDS', () => {
  it('has 26 items', () => {
    expect(REQUIRED_FIELDS).toHaveLength(26)
  })
})

describe('OPTIONAL_FIELDS', () => {
  it('has 5 items', () => {
    expect(OPTIONAL_FIELDS).toHaveLength(5)
  })

  it('contains AgentPort4ScreenProtector, IsStandAloneMode, ShowEQPLog, VisionType, CommandType', () => {
    expect(OPTIONAL_FIELDS).toEqual(expect.arrayContaining([
      'AgentPort4ScreenProtector', 'IsStandAloneMode', 'ShowEQPLog',
      'VisionType', 'CommandType'
    ]))
  })
})

// ===========================================================================
// CRONTAB_DEFAULTS / createDefaultCronTab
// ===========================================================================

describe('CRONTAB_DEFAULTS', () => {
  it('has correct default values', () => {
    expect(CRONTAB_DEFAULTS).toEqual({
      name: '',
      type: 'AR',
      arg: '',
      'no-email': '',
      key: '',
      timeout: '',
      retry: ''
    })
  })
})

describe('createDefaultCronTab', () => {
  it('returns object matching CRONTAB_DEFAULTS', () => {
    expect(createDefaultCronTab()).toEqual(CRONTAB_DEFAULTS)
  })

  it('returns a new object each time', () => {
    const a = createDefaultCronTab()
    const b = createDefaultCronTab()
    expect(a).not.toBe(b)
  })
})

// ===========================================================================
// Cycle 2: buildARSAgentOutput
// ===========================================================================

describe('buildARSAgentOutput', () => {
  const fullFormData = {
    ErrorTrigger: [{ alid: 'TRIGGER_1' }, { alid: 'TRIGGER_2' }],
    AccessLogLists: ['__source1__', '__source2__'],
    CronTab: [{
      name: 'CronTab_Test', type: 'AR', arg: 'arg1;arg2',
      'no-email': 'success;fail', key: 1, timeout: '30 seconds', retry: '3 minutes'
    }],
    VirtualAddressList: '',
    AliveSignalInterval: '5 minutes',
    RedisPingInterval: '5 minutes',
    IsSendAgentStatus2Redis: false,
    AgentPort4RPC: 50100,
    ScenarioCheckInterval: '1 seconds',
    UpdateServerAddressInterval: '100 minutes',
    IgnoreEventBetweenTime: '300 milliseconds',
    TransferImagerInterval: '5 seconds',
    IsSnapshotRecordingOn: true,
    IsSnapshotRecordingDuringRecovery: false,
    SnapshotFormat: 'png',
    InformDialogSize: '800:280',
    MouseEventDelay: 300,
    MouseEventDelayDoubleClick: 50,
    CpuMonitoringInterval: '2 minutes',
    MemMonitoringInterval: '10 minutes',
    TotalCpuPercentLimit: 90,
    AgentCpuPercentLimit: 20,
    FileChangeMonitorInterval: '10 seconds',
    UseUploadLog: true,
    ResourceMonitorInterval: '2 minutes',
    PopupSrcLocalMode: false,
    UseDataBackup: false,
    UseRouter: false,
    PrivateIPAddressPattern: '',
    AgentPort4ScreenProtector: 32126,
    _omit_AgentPort4ScreenProtector: false,
    IsStandAloneMode: false,
    _omit_IsStandAloneMode: false,
    ShowEQPLog: false,
    _omit_ShowEQPLog: false,
    VisionType: 'thrift',
    _omit_VisionType: false,
    CommandType: 'http',
    _omit_CommandType: false
  }

  it('ErrorTrigger pass-through', () => {
    const out = buildARSAgentOutput(fullFormData)
    expect(out.ErrorTrigger).toEqual([{ alid: 'TRIGGER_1' }, { alid: 'TRIGGER_2' }])
  })

  it('AccessLogLists pass-through', () => {
    const out = buildARSAgentOutput(fullFormData)
    expect(out.AccessLogLists).toEqual(['__source1__', '__source2__'])
  })

  it('CronTab with all fields filled includes all', () => {
    const out = buildARSAgentOutput(fullFormData)
    expect(out.CronTab).toEqual([{
      name: 'CronTab_Test', type: 'AR', arg: 'arg1;arg2',
      'no-email': 'success;fail', key: 1, timeout: '30 seconds', retry: '3 minutes'
    }])
  })

  it('CronTab with empty arg omits arg', () => {
    const data = { ...fullFormData, CronTab: [{ name: 'Test', type: 'AR', arg: '', 'no-email': '', key: '', timeout: '', retry: '' }] }
    const out = buildARSAgentOutput(data)
    expect(out.CronTab[0]).not.toHaveProperty('arg')
  })

  it('CronTab with empty no-email omits no-email', () => {
    const data = { ...fullFormData, CronTab: [{ name: 'Test', type: 'AR', arg: '', 'no-email': '', key: '', timeout: '', retry: '' }] }
    const out = buildARSAgentOutput(data)
    expect(out.CronTab[0]).not.toHaveProperty('no-email')
  })

  it('CronTab with empty key omits key', () => {
    const data = { ...fullFormData, CronTab: [{ name: 'Test', type: 'AR', arg: '', 'no-email': '', key: '', timeout: '', retry: '' }] }
    const out = buildARSAgentOutput(data)
    expect(out.CronTab[0]).not.toHaveProperty('key')
  })

  it('CronTab with empty timeout omits timeout', () => {
    const data = { ...fullFormData, CronTab: [{ name: 'Test', type: 'AR', arg: '', 'no-email': '', key: '', timeout: '', retry: '' }] }
    const out = buildARSAgentOutput(data)
    expect(out.CronTab[0]).not.toHaveProperty('timeout')
  })

  it('CronTab with empty retry omits retry', () => {
    const data = { ...fullFormData, CronTab: [{ name: 'Test', type: 'AR', arg: '', 'no-email': '', key: '', timeout: '', retry: '' }] }
    const out = buildARSAgentOutput(data)
    expect(out.CronTab[0]).not.toHaveProperty('retry')
  })

  it('CronTab empty array passes through', () => {
    const data = { ...fullFormData, CronTab: [] }
    const out = buildARSAgentOutput(data)
    expect(out.CronTab).toEqual([])
  })

  it('required fields always present with defaults', () => {
    const out = buildARSAgentOutput({})
    for (const name of REQUIRED_FIELDS) {
      expect(out).toHaveProperty(name)
      expect(out[name]).toEqual(ARSAGENT_SCHEMA.fields[name].default)
    }
  })

  it('optional field with _omit_=false is included', () => {
    const data = { AgentPort4ScreenProtector: 32126, _omit_AgentPort4ScreenProtector: false }
    const out = buildARSAgentOutput(data)
    expect(out).toHaveProperty('AgentPort4ScreenProtector', 32126)
  })

  it('optional field with _omit_=true is excluded', () => {
    const data = { AgentPort4ScreenProtector: 32126, _omit_AgentPort4ScreenProtector: true }
    const out = buildARSAgentOutput(data)
    expect(out).not.toHaveProperty('AgentPort4ScreenProtector')
  })

  it('number type coercion: string to number', () => {
    const data = { ...fullFormData, AgentPort4RPC: '50100', MouseEventDelay: '300' }
    const out = buildARSAgentOutput(data)
    expect(out.AgentPort4RPC).toBe(50100)
    expect(typeof out.AgentPort4RPC).toBe('number')
    expect(out.MouseEventDelay).toBe(300)
    expect(typeof out.MouseEventDelay).toBe('number')
  })

  it('boolean type coercion', () => {
    const data = { ...fullFormData, IsSendAgentStatus2Redis: 1, UseUploadLog: 0 }
    const out = buildARSAgentOutput(data)
    expect(out.IsSendAgentStatus2Redis).toBe(true)
    expect(out.UseUploadLog).toBe(false)
  })

  it('VirtualAddressList empty string still included', () => {
    const out = buildARSAgentOutput({ ...fullFormData, VirtualAddressList: '' })
    expect(out).toHaveProperty('VirtualAddressList', '')
  })

  it('multiple CronTab entries handled correctly', () => {
    const data = {
      ...fullFormData,
      CronTab: [
        { name: 'Job1', type: 'AR', arg: 'a', 'no-email': '', key: '', timeout: '', retry: '' },
        { name: 'Job2', type: 'EN', arg: '', 'no-email': 'fail', key: 2, timeout: '10 seconds', retry: '' }
      ]
    }
    const out = buildARSAgentOutput(data)
    expect(out.CronTab).toHaveLength(2)
    expect(out.CronTab[0].name).toBe('Job1')
    expect(out.CronTab[0].arg).toBe('a')
    expect(out.CronTab[0]).not.toHaveProperty('no-email')
    expect(out.CronTab[1].name).toBe('Job2')
    expect(out.CronTab[1]['no-email']).toBe('fail')
    expect(out.CronTab[1].key).toBe(2)
    expect(out.CronTab[1]).not.toHaveProperty('retry')
  })

  it('CronTab key as number not string', () => {
    const data = { ...fullFormData, CronTab: [{ name: 'Test', type: 'AR', arg: '', 'no-email': '', key: '5', timeout: '', retry: '' }] }
    const out = buildARSAgentOutput(data)
    expect(out.CronTab[0].key).toBe(5)
    expect(typeof out.CronTab[0].key).toBe('number')
  })

  it('strips all _omit_* keys from output', () => {
    const out = buildARSAgentOutput(fullFormData)
    const omitKeys = Object.keys(out).filter(k => k.startsWith('_omit_'))
    expect(omitKeys).toHaveLength(0)
  })

  it('full roundtrip: parse then build preserves data', () => {
    const fullConfig = {
      ErrorTrigger: [{ alid: 'TRIGGER_1' }],
      AccessLogLists: ['__source1__'],
      CronTab: [{ name: 'Job1', type: 'AR', arg: 'a1', 'no-email': 'fail', key: 1, timeout: '30 seconds', retry: '3 minutes' }],
      VirtualAddressList: '',
      AliveSignalInterval: '5 minutes',
      RedisPingInterval: '5 minutes',
      IsSendAgentStatus2Redis: false,
      AgentPort4RPC: 50100,
      ScenarioCheckInterval: '1 seconds',
      UpdateServerAddressInterval: '100 minutes',
      IgnoreEventBetweenTime: '300 milliseconds',
      TransferImagerInterval: '5 seconds',
      IsSnapshotRecordingOn: true,
      IsSnapshotRecordingDuringRecovery: false,
      SnapshotFormat: 'png',
      InformDialogSize: '800:280',
      MouseEventDelay: 300,
      MouseEventDelayDoubleClick: 50,
      CpuMonitoringInterval: '2 minutes',
      MemMonitoringInterval: '10 minutes',
      TotalCpuPercentLimit: 90,
      AgentCpuPercentLimit: 20,
      FileChangeMonitorInterval: '10 seconds',
      UseUploadLog: true,
      ResourceMonitorInterval: '2 minutes',
      PopupSrcLocalMode: false,
      UseDataBackup: false,
      UseRouter: false,
      PrivateIPAddressPattern: '',
      AgentPort4ScreenProtector: 32126,
      IsStandAloneMode: false,
      ShowEQPLog: false,
      VisionType: 'thrift',
      CommandType: 'http'
    }
    const parsed = parseARSAgentInput(fullConfig)
    const rebuilt = buildARSAgentOutput(parsed)
    expect(rebuilt).toEqual(fullConfig)
  })
})

// ===========================================================================
// Cycle 3: parseARSAgentInput
// ===========================================================================

describe('parseARSAgentInput', () => {
  const fullConfig = {
    ErrorTrigger: [{ alid: 'TRIGGER_1' }],
    AccessLogLists: ['__source1__'],
    CronTab: [{ name: 'Job1', type: 'AR' }],
    VirtualAddressList: '',
    AliveSignalInterval: '5 minutes',
    RedisPingInterval: '5 minutes',
    IsSendAgentStatus2Redis: false,
    AgentPort4RPC: 50100,
    ScenarioCheckInterval: '1 seconds',
    UpdateServerAddressInterval: '100 minutes',
    IgnoreEventBetweenTime: '300 milliseconds',
    TransferImagerInterval: '5 seconds',
    IsSnapshotRecordingOn: true,
    IsSnapshotRecordingDuringRecovery: false,
    SnapshotFormat: 'png',
    InformDialogSize: '800:280',
    MouseEventDelay: 300,
    MouseEventDelayDoubleClick: 50,
    CpuMonitoringInterval: '2 minutes',
    MemMonitoringInterval: '10 minutes',
    TotalCpuPercentLimit: 90,
    AgentCpuPercentLimit: 20,
    FileChangeMonitorInterval: '10 seconds',
    UseUploadLog: true,
    ResourceMonitorInterval: '2 minutes',
    PopupSrcLocalMode: false,
    UseDataBackup: false,
    UseRouter: false,
    PrivateIPAddressPattern: '',
    AgentPort4ScreenProtector: 32126,
    IsStandAloneMode: false,
    ShowEQPLog: false,
    VisionType: 'thrift',
    CommandType: 'http'
  }

  it('full config produces correct form data with _omit_* flags', () => {
    const result = parseARSAgentInput(fullConfig)
    expect(result.VirtualAddressList).toBe('')
    expect(result.AgentPort4RPC).toBe(50100)
    expect(result._omit_AgentPort4ScreenProtector).toBe(false)
    expect(result._omit_VisionType).toBe(false)
  })

  it('optional field present sets _omit_*=false', () => {
    const result = parseARSAgentInput(fullConfig)
    for (const name of OPTIONAL_FIELDS) {
      expect(result[`_omit_${name}`], `_omit_${name} should be false`).toBe(false)
    }
  })

  it('optional field missing sets _omit_*=true', () => {
    const config = { ...fullConfig }
    delete config.AgentPort4ScreenProtector
    delete config.VisionType
    const result = parseARSAgentInput(config)
    expect(result._omit_AgentPort4ScreenProtector).toBe(true)
    expect(result._omit_VisionType).toBe(true)
    expect(result.AgentPort4ScreenProtector).toBe(32126)
    expect(result.VisionType).toBe('thrift')
  })

  it('optional boolean false sets _omit_*=false (present means not omitted)', () => {
    const config = { ...fullConfig, IsStandAloneMode: false, ShowEQPLog: false }
    const result = parseARSAgentInput(config)
    expect(result._omit_IsStandAloneMode).toBe(false)
    expect(result._omit_ShowEQPLog).toBe(false)
  })

  it('required field missing fills default', () => {
    const config = { ...fullConfig }
    delete config.AgentPort4RPC
    delete config.MouseEventDelay
    const result = parseARSAgentInput(config)
    expect(result.AgentPort4RPC).toBe(50100)
    expect(result.MouseEventDelay).toBe(300)
  })

  it('CronTab array preserved', () => {
    const result = parseARSAgentInput(fullConfig)
    expect(result.CronTab).toEqual([{ name: 'Job1', type: 'AR' }])
  })

  it('empty CronTab preserved', () => {
    const result = parseARSAgentInput({ ...fullConfig, CronTab: [] })
    expect(result.CronTab).toEqual([])
  })

  it('missing CronTab defaults to []', () => {
    const config = { ...fullConfig }
    delete config.CronTab
    const result = parseARSAgentInput(config)
    expect(result.CronTab).toEqual([])
  })

  it('ErrorTrigger/AccessLogLists default to []', () => {
    const config = { ...fullConfig }
    delete config.ErrorTrigger
    delete config.AccessLogLists
    const result = parseARSAgentInput(config)
    expect(result.ErrorTrigger).toEqual([])
    expect(result.AccessLogLists).toEqual([])
  })

  it('roundtrip: build(parse(fullConfig)) equals fullConfig', () => {
    const parsed = parseARSAgentInput(fullConfig)
    const rebuilt = buildARSAgentOutput(parsed)
    expect(rebuilt).toEqual(fullConfig)
  })

  it('partial config fills defaults', () => {
    const result = parseARSAgentInput({ AliveSignalInterval: '10 minutes' })
    expect(result.AliveSignalInterval).toBe('10 minutes')
    expect(result.AgentPort4RPC).toBe(50100)
    expect(result.VirtualAddressList).toBe('')
  })

  it('number field preserved as number', () => {
    const result = parseARSAgentInput(fullConfig)
    expect(typeof result.AgentPort4RPC).toBe('number')
    expect(typeof result.MouseEventDelay).toBe('number')
  })

  it('boolean field preserved as boolean', () => {
    const result = parseARSAgentInput(fullConfig)
    expect(typeof result.IsSendAgentStatus2Redis).toBe('boolean')
    expect(typeof result.UseUploadLog).toBe('boolean')
  })

  it('unknown fields preserved (pass-through)', () => {
    const config = { ...fullConfig, CustomField: 'custom_value', AnotherUnknown: 42 }
    const result = parseARSAgentInput(config)
    expect(result.CustomField).toBe('custom_value')
    expect(result.AnotherUnknown).toBe(42)
  })

  it('_omit_ uses in operator, NOT truthiness check', () => {
    const config = { ...fullConfig, IsStandAloneMode: false, AgentPort4ScreenProtector: 0 }
    const result = parseARSAgentInput(config)
    expect(result._omit_IsStandAloneMode).toBe(false)
    expect(result._omit_AgentPort4ScreenProtector).toBe(false)
  })
})
