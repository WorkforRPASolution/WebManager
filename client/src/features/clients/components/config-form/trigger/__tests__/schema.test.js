import { describe, it, expect } from 'vitest'
import {
  TRIGGER_STEP_SCHEMA,
  TRIGGER_SCHEMA,
  createDefaultTriggerStep,
  createDefaultTrigger
} from '../schema'

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

// ===========================================================================
// TRIGGER_SCHEMA.classField
// ===========================================================================

describe('TRIGGER_SCHEMA.classField', () => {
  it('classField exists in TRIGGER_SCHEMA', () => {
    expect(TRIGGER_SCHEMA.classField).toBeDefined()
  })

  it('classField has MULTI and none options', () => {
    const options = TRIGGER_SCHEMA.classField.options
    expect(options).toBeDefined()
    expect(options.some(o => o.value === 'MULTI')).toBe(true)
    expect(options.some(o => o.value === 'none')).toBe(true)
  })

  it('classField type is select', () => {
    expect(TRIGGER_SCHEMA.classField.type).toBe('select')
  })

  it('createDefaultTrigger does NOT include class field', () => {
    const trigger = createDefaultTrigger()
    expect(trigger.class).toBeUndefined()
  })
})
