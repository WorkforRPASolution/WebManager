import { describe, it, expect } from 'vitest'
import {
  decomposeLogType,
  composeLogType,
  formatSourceName,
  parseSourceName,
  buildAccessLogOutput,
  parseAccessLogInput,
  createDefaultTriggerStep,
  ACCESS_LOG_SCHEMA,
  TRIGGER_STEP_SCHEMA,
  TRIGGER_SCHEMA,
  DATE_AXIS_OPTIONS,
  LINE_AXIS_OPTIONS,
  POST_PROC_OPTIONS
} from '../configSchemas'

// ===========================================================================
// decomposeLogType / composeLogType
// ===========================================================================

describe('decomposeLogType', () => {
  const cases = [
    ['normal_single', { dateAxis: 'normal', lineAxis: 'single', postProc: 'none' }],
    ['date_single', { dateAxis: 'date', lineAxis: 'single', postProc: 'none' }],
    ['date_prefix_single', { dateAxis: 'date_prefix', lineAxis: 'single', postProc: 'none' }],
    ['normal_single_extract_append', { dateAxis: 'normal', lineAxis: 'single', postProc: 'extract_append' }],
    ['date_single_extract_append', { dateAxis: 'date', lineAxis: 'single', postProc: 'extract_append' }],
    ['date_prefix_single_extract_append', { dateAxis: 'date_prefix', lineAxis: 'single', postProc: 'extract_append' }],
    ['normal_multiline', { dateAxis: 'normal', lineAxis: 'multiline', postProc: 'none' }],
    ['date_multiline', { dateAxis: 'date', lineAxis: 'multiline', postProc: 'none' }],
    ['normal_multiline_extract_append', { dateAxis: 'normal', lineAxis: 'multiline', postProc: 'extract_append' }],
    ['date_multiline_extract_append', { dateAxis: 'date', lineAxis: 'multiline', postProc: 'extract_append' }]
  ]

  it.each(cases)('decomposes "%s" correctly', (logType, expected) => {
    expect(decomposeLogType(logType)).toEqual(expected)
  })

  it('returns defaults for undefined/null', () => {
    expect(decomposeLogType(undefined)).toEqual({ dateAxis: 'normal', lineAxis: 'single', postProc: 'none' })
    expect(decomposeLogType(null)).toEqual({ dateAxis: 'normal', lineAxis: 'single', postProc: 'none' })
  })

  it('returns defaults for invalid value', () => {
    expect(decomposeLogType('rolling')).toEqual({ dateAxis: 'normal', lineAxis: 'single', postProc: 'none' })
    expect(decomposeLogType('static')).toEqual({ dateAxis: 'normal', lineAxis: 'single', postProc: 'none' })
  })
})

describe('composeLogType', () => {
  it('roundtrip: 10 valid log types decompose and recompose correctly', () => {
    const types = [
      'normal_single', 'date_single', 'date_prefix_single',
      'normal_single_extract_append', 'date_single_extract_append', 'date_prefix_single_extract_append',
      'normal_multiline', 'date_multiline',
      'normal_multiline_extract_append', 'date_multiline_extract_append'
    ]
    for (const t of types) {
      expect(composeLogType(decomposeLogType(t))).toBe(t)
    }
  })

  it('defaults to normal_single when called with no args', () => {
    expect(composeLogType()).toBe('normal_single')
    expect(composeLogType({})).toBe('normal_single')
  })

  it('returns normal_single for invalid combination (date_prefix_multiline_extract_append is valid)', () => {
    // date_prefix + multiline without extract_append is NOT a valid combination
    expect(composeLogType({ dateAxis: 'date_prefix', lineAxis: 'multiline', postProc: 'none' })).toBe('normal_single')
  })
})

// ===========================================================================
// formatSourceName / parseSourceName
// ===========================================================================

describe('formatSourceName', () => {
  it('trigger purpose wraps with double underscores', () => {
    expect(formatSourceName('LogReadInfo', 'trigger')).toBe('__LogReadInfo__')
  })

  it('upload purpose uses raw name', () => {
    expect(formatSourceName('LogReadInfo', 'upload')).toBe('LogReadInfo')
  })

  it('empty baseName returns empty string', () => {
    expect(formatSourceName('', 'trigger')).toBe('')
  })
})

describe('parseSourceName', () => {
  it('parses __name__ as trigger', () => {
    expect(parseSourceName('__LogReadInfo__')).toEqual({ baseName: 'LogReadInfo', purpose: 'trigger' })
  })

  it('parses plain name as upload', () => {
    expect(parseSourceName('LogReadInfo')).toEqual({ baseName: 'LogReadInfo', purpose: 'upload' })
  })

  it('handles empty/null', () => {
    expect(parseSourceName('')).toEqual({ baseName: '', purpose: 'trigger' })
    expect(parseSourceName(null)).toEqual({ baseName: '', purpose: 'trigger' })
  })
})

// ===========================================================================
// ACCESS_LOG_SCHEMA
// ===========================================================================

describe('ACCESS_LOG_SCHEMA', () => {
  it('has purpose field', () => {
    expect(ACCESS_LOG_SCHEMA.fields.purpose).toBeDefined()
    expect(ACCESS_LOG_SCHEMA.fields.purpose.options).toHaveLength(2)
  })

  it('has multiline fields', () => {
    expect(ACCESS_LOG_SCHEMA.fields.startPattern).toBeDefined()
    expect(ACCESS_LOG_SCHEMA.fields.endPattern).toBeDefined()
    expect(ACCESS_LOG_SCHEMA.fields.count).toBeDefined()
    expect(ACCESS_LOG_SCHEMA.fields.priority).toBeDefined()
  })

  it('has extract-append fields', () => {
    expect(ACCESS_LOG_SCHEMA.fields.extractPattern).toBeDefined()
    expect(ACCESS_LOG_SCHEMA.fields.appendPos).toBeDefined()
    expect(ACCESS_LOG_SCHEMA.fields.appendFormat).toBeDefined()
  })

  it('charset has UCS-2 LE BOM and __custom__', () => {
    const options = ACCESS_LOG_SCHEMA.fields.charset.options.map(o => o.value)
    expect(options).toContain('UCS-2 LE BOM')
    expect(options).toContain('__custom__')
    expect(options).not.toContain('ISO-8859-1')
  })

  it('wildcard description says "사용하지 않음" not "모든 파일"', () => {
    expect(ACCESS_LOG_SCHEMA.fields.wildcard.description).toContain('사용하지 않')
    expect(ACCESS_LOG_SCHEMA.fields.wildcard.description).not.toContain('모든 파일')
  })

  it('back description mentions 파일 크기', () => {
    expect(ACCESS_LOG_SCHEMA.fields.back.description).toContain('파일 크기')
  })

  it('defaults log_type is normal_single', () => {
    expect(ACCESS_LOG_SCHEMA.defaults.log_type).toBe('normal_single')
  })

  it('does NOT have log_type field in fields (replaced by 3-axis)', () => {
    expect(ACCESS_LOG_SCHEMA.fields.log_type).toBeUndefined()
  })
})

// ===========================================================================
// Axis option constants
// ===========================================================================

describe('axis options', () => {
  it('DATE_AXIS_OPTIONS has 3 options', () => {
    expect(DATE_AXIS_OPTIONS).toHaveLength(3)
    expect(DATE_AXIS_OPTIONS.map(o => o.value)).toEqual(['normal', 'date', 'date_prefix'])
  })

  it('LINE_AXIS_OPTIONS has 2 options', () => {
    expect(LINE_AXIS_OPTIONS).toHaveLength(2)
  })

  it('POST_PROC_OPTIONS has 2 options', () => {
    expect(POST_PROC_OPTIONS).toHaveLength(2)
  })
})

// ===========================================================================
// buildAccessLogOutput
// ===========================================================================

describe('buildAccessLogOutput', () => {
  it('basic normal_single — includes core fields only', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      prefix: 'app',
      suffix: '.log',
      log_type: 'normal_single',
      access_interval: '10 seconds',
      reopen: true
    }
    const out = buildAccessLogOutput(source)
    expect(out.directory).toBe('C:/logs')
    expect(out.log_type).toBe('normal_single')
    expect(out.startPattern).toBeUndefined()
    expect(out.extractPattern).toBeUndefined()
    expect(out.date_subdir_format).toBeUndefined()
  })

  it('date_single with date_subdir_format — includes date_subdir_format', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'date_single',
      date_subdir_format: 'yyyyMMdd'
    }
    const out = buildAccessLogOutput(source)
    expect(out.date_subdir_format).toBe('yyyyMMdd')
  })

  it('_omit_date_subdir_format=true excludes date_subdir_format', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'date_single',
      date_subdir_format: 'yyyyMMdd',
      _omit_date_subdir_format: true
    }
    const out = buildAccessLogOutput(source)
    expect(out.date_subdir_format).toBeUndefined()
  })

  it('_omit_charset=true excludes charset', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'normal_single',
      charset: 'UTF-8',
      _omit_charset: true
    }
    const out = buildAccessLogOutput(source)
    expect(out.charset).toBeUndefined()
  })

  it('_omit_back/end=true excludes back/end', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'normal_single',
      back: true,
      end: false,
      _omit_back: true,
      _omit_end: true
    }
    const out = buildAccessLogOutput(source)
    expect(out.back).toBeUndefined()
    expect(out.end).toBeUndefined()
  })

  it('multiline log_type includes startPattern/endPattern/count/priority', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'normal_multiline',
      startPattern: '.*START.*',
      endPattern: '.*END.*',
      count: 10,
      priority: 'pattern'
    }
    const out = buildAccessLogOutput(source)
    expect(out.startPattern).toBe('.*START.*')
    expect(out.endPattern).toBe('.*END.*')
    expect(out.count).toBe(10)
    expect(out.priority).toBe('pattern')
  })

  it('extract_append log_type includes extractPattern/appendPos/appendFormat', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'normal_single_extract_append',
      extractPattern: '.*Log\\\\([0-9]+).*',
      appendPos: 0,
      appendFormat: '@1 '
    }
    const out = buildAccessLogOutput(source)
    expect(out.extractPattern).toBe('.*Log\\\\([0-9]+).*')
    expect(out.appendPos).toBe(0)
    expect(out.appendFormat).toBe('@1 ')
  })

  it('upload purpose includes batch_count/batch_timeout', () => {
    const source = {
      name: 'UploadLog',
      directory: 'C:/logs',
      log_type: 'normal_single',
      batch_count: 500,
      batch_timeout: '10 seconds'
    }
    const out = buildAccessLogOutput(source)
    expect(out.batch_count).toBe(500)
    expect(out.batch_timeout).toBe('10 seconds')
  })

  it('trigger purpose excludes batch_count/batch_timeout', () => {
    const source = {
      name: '__TriggerLog__',
      directory: 'C:/logs',
      log_type: 'normal_single',
      batch_count: 500,
      batch_timeout: '10 seconds'
    }
    const out = buildAccessLogOutput(source)
    expect(out.batch_count).toBeUndefined()
    expect(out.batch_timeout).toBeUndefined()
  })
})

// ===========================================================================
// parseAccessLogInput
// ===========================================================================

describe('parseAccessLogInput', () => {
  it('parses trigger source name', () => {
    const result = parseAccessLogInput('__LogReadInfo__', { directory: 'C:/logs', charset: 'UTF-8' })
    expect(result.baseName).toBe('LogReadInfo')
    expect(result.purpose).toBe('trigger')
    expect(result.directory).toBe('C:/logs')
    expect(result._omit_charset).toBe(false)
  })

  it('parses upload source name', () => {
    const result = parseAccessLogInput('UploadLog', { directory: 'C:/logs' })
    expect(result.baseName).toBe('UploadLog')
    expect(result.purpose).toBe('upload')
  })

  it('sets _omit flags for missing fields', () => {
    const result = parseAccessLogInput('__Test__', { directory: 'C:/logs' })
    expect(result._omit_charset).toBe(true) // charset not in config
    expect(result._omit_back).toBe(true)    // back not in config
    expect(result._omit_end).toBe(true)     // end not in config
    expect(result._omit_date_subdir_format).toBe(true)
  })

  it('preserves existing config values and adds defaults for missing', () => {
    const result = parseAccessLogInput('__Test__', {
      directory: 'C:/logs',
      log_type: 'date_multiline',
      startPattern: '.*START.*'
    })
    expect(result.log_type).toBe('date_multiline')
    expect(result.startPattern).toBe('.*START.*')
    expect(result.suffix).toBe('.txt') // from defaults
  })
})

// ===========================================================================
// TRIGGER_STEP_SCHEMA
// ===========================================================================

describe('TRIGGER_STEP_SCHEMA', () => {
  it('type options are regex and delay only', () => {
    const options = TRIGGER_STEP_SCHEMA.fields.type.options.map(o => o.value)
    expect(options).toEqual(['regex', 'delay'])
    expect(options).not.toContain('keyword')
    expect(options).not.toContain('exact')
  })

  it('has detail field', () => {
    expect(TRIGGER_STEP_SCHEMA.fields.detail).toBeDefined()
  })
})

// ===========================================================================
// TRIGGER_SCHEMA
// ===========================================================================

describe('TRIGGER_SCHEMA', () => {
  it('source type is multi-select-source', () => {
    expect(TRIGGER_SCHEMA.fields.source.type).toBe('multi-select-source')
  })
})

// ===========================================================================
// createDefaultTriggerStep
// ===========================================================================

describe('createDefaultTriggerStep', () => {
  it('includes detail: {} in defaults', () => {
    const step = createDefaultTriggerStep(0)
    expect(step.detail).toEqual({})
    expect(step.type).toBe('regex')
    expect(step.name).toBe('Step_1')
  })
})
