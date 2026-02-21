import { describe, it, expect } from 'vitest'
import {
  decomposeLogType,
  composeLogType,
  formatSourceName,
  parseSourceName,
  buildAccessLogOutput,
  parseAccessLogInput,
  ACCESS_LOG_SCHEMA,
  DATE_AXIS_OPTIONS,
  LINE_AXIS_OPTIONS,
  POST_PROC_OPTIONS,
  LOG_TYPE_REGISTRY
} from '../schema'

// ===========================================================================
// decomposeLogType / composeLogType
// ===========================================================================

describe('decomposeLogType', () => {
  const cases = [
    ['normal_single', { dateAxis: 'normal', lineAxis: 'single', postProc: 'none' }],
    ['normal_single_extract_append', { dateAxis: 'normal', lineAxis: 'single', postProc: 'extract_append' }],
    ['normal_multiline', { dateAxis: 'normal', lineAxis: 'multiline', postProc: 'none' }],
    ['date_single', { dateAxis: 'date', lineAxis: 'single', postProc: 'none' }],
    ['date_single_extract_append', { dateAxis: 'date', lineAxis: 'single', postProc: 'extract_append' }],
    ['date_multiline', { dateAxis: 'date', lineAxis: 'multiline', postProc: 'none' }],
    ['date_prefix_single', { dateAxis: 'date_prefix', lineAxis: 'single', postProc: 'none' }],
    ['date_prefix_single_extract_append', { dateAxis: 'date_prefix', lineAxis: 'single', postProc: 'extract_append' }],
    ['date_suffix_single', { dateAxis: 'date_suffix', lineAxis: 'single', postProc: 'none' }],
    ['date_suffix_single_extract_append', { dateAxis: 'date_suffix', lineAxis: 'single', postProc: 'extract_append' }],
  ]

  it.each(cases)('decomposes "%s" correctly', (logType, expected) => {
    expect(decomposeLogType(logType)).toEqual(expected)
  })

  it('recognizes old names (구버전 이름)', () => {
    expect(decomposeLogType('extract_append')).toEqual({ dateAxis: 'normal', lineAxis: 'single', postProc: 'extract_append' })
    expect(decomposeLogType('date_prefix_normal_single')).toEqual({ dateAxis: 'date_prefix', lineAxis: 'single', postProc: 'none' })
    expect(decomposeLogType('date_prefix_normal_single_extract_append')).toEqual({ dateAxis: 'date_prefix', lineAxis: 'single', postProc: 'extract_append' })
    expect(decomposeLogType('date_suffix_normal_single')).toEqual({ dateAxis: 'date_suffix', lineAxis: 'single', postProc: 'none' })
    expect(decomposeLogType('date_suffix_normal_single_extract_append')).toEqual({ dateAxis: 'date_suffix', lineAxis: 'single', postProc: 'extract_append' })
  })

  it('returns defaults for undefined/null', () => {
    expect(decomposeLogType(undefined)).toEqual({ dateAxis: 'normal', lineAxis: 'single', postProc: 'none' })
    expect(decomposeLogType(null)).toEqual({ dateAxis: 'normal', lineAxis: 'single', postProc: 'none' })
  })

  it('returns defaults for invalid value', () => {
    expect(decomposeLogType('rolling')).toEqual({ dateAxis: 'normal', lineAxis: 'single', postProc: 'none' })
    expect(decomposeLogType('static')).toEqual({ dateAxis: 'normal', lineAxis: 'single', postProc: 'none' })
  })

  it('returns defaults for removed types (multiline + extract_append)', () => {
    expect(decomposeLogType('normal_multiline_extract_append')).toEqual({ dateAxis: 'normal', lineAxis: 'single', postProc: 'none' })
    expect(decomposeLogType('date_multiline_extract_append')).toEqual({ dateAxis: 'normal', lineAxis: 'single', postProc: 'none' })
  })
})

describe('composeLogType', () => {
  it('roundtrip: all 10 registry entries decompose and recompose correctly', () => {
    for (const entry of LOG_TYPE_REGISTRY) {
      expect(composeLogType(decomposeLogType(entry.canonical))).toBe(entry.canonical)
    }
  })

  it('defaults to normal_single when called with no args', () => {
    expect(composeLogType()).toBe('normal_single')
    expect(composeLogType({})).toBe('normal_single')
  })

  it('returns normal_single for invalid combinations', () => {
    // date_prefix + multiline
    expect(composeLogType({ dateAxis: 'date_prefix', lineAxis: 'multiline', postProc: 'none' })).toBe('normal_single')
    // date_suffix + multiline
    expect(composeLogType({ dateAxis: 'date_suffix', lineAxis: 'multiline', postProc: 'none' })).toBe('normal_single')
    // multiline + extract_append
    expect(composeLogType({ dateAxis: 'normal', lineAxis: 'multiline', postProc: 'extract_append' })).toBe('normal_single')
  })

  it('returns old name when version is old and oldName exists', () => {
    expect(composeLogType({ dateAxis: 'normal', lineAxis: 'single', postProc: 'extract_append' }, { version: '6.8.5.24' }))
      .toBe('extract_append')
    expect(composeLogType({ dateAxis: 'date_prefix', lineAxis: 'single', postProc: 'none' }, { version: '6.0.0.0' }))
      .toBe('date_prefix_normal_single')
    expect(composeLogType({ dateAxis: 'date_suffix', lineAxis: 'single', postProc: 'none' }, { version: '6.8.0.0' }))
      .toBe('date_suffix_normal_single')
  })

  it('returns canonical name when version is new and oldName exists', () => {
    expect(composeLogType({ dateAxis: 'normal', lineAxis: 'single', postProc: 'extract_append' }, { version: '7.0.0.0' }))
      .toBe('normal_single_extract_append')
    expect(composeLogType({ dateAxis: 'date_prefix', lineAxis: 'single', postProc: 'none' }, { version: '7.1.0.0' }))
      .toBe('date_prefix_single')
  })

  it('returns canonical name when version is not provided', () => {
    expect(composeLogType({ dateAxis: 'normal', lineAxis: 'single', postProc: 'extract_append' }))
      .toBe('normal_single_extract_append')
    expect(composeLogType({ dateAxis: 'date_prefix', lineAxis: 'single', postProc: 'none' }))
      .toBe('date_prefix_single')
  })

  it('returns canonical name when entry has no oldName', () => {
    expect(composeLogType({ dateAxis: 'normal', lineAxis: 'single', postProc: 'none' }, { version: '6.0.0.0' }))
      .toBe('normal_single')
    expect(composeLogType({ dateAxis: 'date', lineAxis: 'single', postProc: 'none' }, { version: '6.0.0.0' }))
      .toBe('date_single')
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
    expect(ACCESS_LOG_SCHEMA.fields.start_pattern).toBeDefined()
    expect(ACCESS_LOG_SCHEMA.fields.end_pattern).toBeDefined()
    expect(ACCESS_LOG_SCHEMA.fields.line_count).toBeDefined()
    expect(ACCESS_LOG_SCHEMA.fields.priority).toBeDefined()
  })

  it('has extract-append fields', () => {
    expect(ACCESS_LOG_SCHEMA.fields.pathPattern).toBeDefined()
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
  it('DATE_AXIS_OPTIONS has 4 options including date_suffix', () => {
    expect(DATE_AXIS_OPTIONS).toHaveLength(4)
    expect(DATE_AXIS_OPTIONS.map(o => o.value)).toEqual(['normal', 'date', 'date_prefix', 'date_suffix'])
  })

  it('LINE_AXIS_OPTIONS has 2 options', () => {
    expect(LINE_AXIS_OPTIONS).toHaveLength(2)
  })

  it('POST_PROC_OPTIONS has 2 options', () => {
    expect(POST_PROC_OPTIONS).toHaveLength(2)
  })
})

// ===========================================================================
// LOG_TYPE_REGISTRY
// ===========================================================================

describe('LOG_TYPE_REGISTRY', () => {
  it('has exactly 10 entries', () => {
    expect(LOG_TYPE_REGISTRY).toHaveLength(10)
  })

  it('all canonical names are unique', () => {
    const names = LOG_TYPE_REGISTRY.map(e => e.canonical)
    expect(new Set(names).size).toBe(names.length)
  })

  it('does not contain multiline + extract_append combinations', () => {
    const multilineEA = LOG_TYPE_REGISTRY.filter(e => e.line === 'multiline' && e.postProc === 'extract_append')
    expect(multilineEA).toHaveLength(0)
  })

  it('contains date_suffix entries', () => {
    const dateSuffix = LOG_TYPE_REGISTRY.filter(e => e.date === 'date_suffix')
    expect(dateSuffix).toHaveLength(2)
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
    expect(out.start_pattern).toBeUndefined()
    expect(out.pathPattern).toBeUndefined()
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
      start_pattern: '.*START.*',
      end_pattern: '.*END.*',
      line_count: 10,
      priority: 'pattern'
    }
    const out = buildAccessLogOutput(source)
    expect(out.start_pattern).toBe('.*START.*')
    expect(out.end_pattern).toBe('.*END.*')
    expect(out.line_count).toBe(10)
    expect(out.priority).toBe('pattern')
  })

  it('extract_append log_type includes pathPattern/appendPos/appendFormat', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'normal_single_extract_append',
      pathPattern: '.*Log\\\\([0-9]+).*',
      appendPos: 0,
      appendFormat: '@1 '
    }
    const out = buildAccessLogOutput(source)
    expect(out.pathPattern).toBe('.*Log\\\\([0-9]+).*')
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

  it('wildcard is always present in output even when empty/undefined', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      prefix: 'app',
      suffix: '.log',
      log_type: 'normal_single'
      // wildcard not set
    }
    const out = buildAccessLogOutput(source)
    expect(out).toHaveProperty('wildcard')
    expect(out.wildcard).toBe('')
  })

  it('date_suffix with date_subdir_format — includes date_subdir_format', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'date_suffix_single',
      date_subdir_format: 'yyyyMMdd'
    }
    const out = buildAccessLogOutput(source)
    expect(out.date_subdir_format).toBe('yyyyMMdd')
  })

  it('preserves _originalLogType when axes unchanged', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'extract_append',
      _originalLogType: 'extract_append'
    }
    const out = buildAccessLogOutput(source)
    expect(out.log_type).toBe('extract_append')
  })

  it('uses version-based compose when axes changed from original', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'date_single',
      _originalLogType: 'extract_append'
    }
    const out = buildAccessLogOutput(source, { version: '6.8.0.0' })
    expect(out.log_type).toBe('date_single')
  })

  it('uses version-based old name when axes changed and version is old', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'normal_single_extract_append',
      _originalLogType: 'normal_single'
    }
    const out = buildAccessLogOutput(source, { version: '6.8.0.0' })
    expect(out.log_type).toBe('extract_append')
  })

  // ── log_time fields ──

  it('_omit_log_time=false includes log_time_pattern/log_time_format', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'normal_single',
      log_time_pattern: '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}',
      log_time_format: 'yyyy-MM-dd HH:mm:ss',
      _omit_log_time: false
    }
    const out = buildAccessLogOutput(source)
    expect(out.log_time_pattern).toBe('[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}')
    expect(out.log_time_format).toBe('yyyy-MM-dd HH:mm:ss')
  })

  it('_omit_log_time=true excludes log_time_pattern/log_time_format', () => {
    const source = {
      name: '__TestLog__',
      directory: 'C:/logs',
      log_type: 'normal_single',
      log_time_pattern: '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}',
      log_time_format: 'yyyy-MM-dd HH:mm:ss',
      _omit_log_time: true
    }
    const out = buildAccessLogOutput(source)
    expect(out.log_time_pattern).toBeUndefined()
    expect(out.log_time_format).toBeUndefined()
  })

  // ── line_group fields ──

  it('_omit_line_group=false + trigger purpose includes line_group_count/line_group_pattern', () => {
    const source = {
      name: '__TriggerLog__',
      directory: 'C:/logs',
      log_type: 'normal_single',
      line_group_count: 5,
      line_group_pattern: '.*ERROR.*',
      _omit_line_group: false
    }
    const out = buildAccessLogOutput(source)
    expect(out.line_group_count).toBe(5)
    expect(out.line_group_pattern).toBe('.*ERROR.*')
  })

  it('_omit_line_group=false + upload purpose excludes line_group_count/line_group_pattern', () => {
    const source = {
      name: 'UploadLog',
      directory: 'C:/logs',
      log_type: 'normal_single',
      line_group_count: 5,
      line_group_pattern: '.*ERROR.*',
      _omit_line_group: false
    }
    const out = buildAccessLogOutput(source)
    expect(out.line_group_count).toBeUndefined()
    expect(out.line_group_pattern).toBeUndefined()
  })

  it('line_group fields use defaults when not set and not omitted', () => {
    const source = {
      name: '__TriggerLog__',
      directory: 'C:/logs',
      log_type: 'normal_single',
      _omit_line_group: false
      // line_group_count and line_group_pattern not set
    }
    const out = buildAccessLogOutput(source)
    expect(out.line_group_count).toBe(1)
    expect(out.line_group_pattern).toBe('')
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

  it('stores _originalLogType from config', () => {
    const result = parseAccessLogInput('__Test__', { directory: 'C:/logs', log_type: 'extract_append' })
    expect(result._originalLogType).toBe('extract_append')
  })

  it('stores null _originalLogType when log_type not in config', () => {
    const result = parseAccessLogInput('__Test__', { directory: 'C:/logs' })
    expect(result._originalLogType).toBeNull()
  })

  // ── _omit_log_time ──

  it('config with log_time_pattern → _omit_log_time=false', () => {
    const result = parseAccessLogInput('__Test__', {
      directory: 'C:/logs',
      log_time_pattern: '[0-9]{4}-[0-9]{2}-[0-9]{2}'
    })
    expect(result._omit_log_time).toBe(false)
  })

  it('config without log_time_pattern → _omit_log_time=true', () => {
    const result = parseAccessLogInput('__Test__', { directory: 'C:/logs' })
    expect(result._omit_log_time).toBe(true)
  })

  it('config with empty log_time_pattern → _omit_log_time=false (roundtrip)', () => {
    const result = parseAccessLogInput('__Test__', {
      directory: 'C:/logs',
      log_time_pattern: '',
      log_time_format: ''
    })
    expect(result._omit_log_time).toBe(false)
  })

  // ── _omit_line_group ──

  it('config with line_group_count → _omit_line_group=false', () => {
    const result = parseAccessLogInput('__Test__', {
      directory: 'C:/logs',
      line_group_count: 3
    })
    expect(result._omit_line_group).toBe(false)
  })

  it('config without line_group_count → _omit_line_group=true', () => {
    const result = parseAccessLogInput('__Test__', { directory: 'C:/logs' })
    expect(result._omit_line_group).toBe(true)
  })
})
