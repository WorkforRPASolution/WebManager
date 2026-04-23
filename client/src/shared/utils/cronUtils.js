/**
 * cronUtils — Quartz 6/7-field cron expression helpers.
 *
 * Backed by `cron-parser` (v5, supports Quartz seconds field + `?` placeholder)
 * and `cronstrue` (i18n including Korean).
 */

import { CronExpressionParser } from 'cron-parser'
import cronstrue from 'cronstrue/i18n'

export const FIELD_LABELS = {
  second: '초',
  minute: '분',
  hour: '시',
  dayOfMonth: '일',
  month: '월',
  dayOfWeek: '요일',
  year: '년'
}

export const FIELD_ORDER = ['second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek', 'year']

export const CRON_PRESETS = [
  { label: '매 분', expression: '0 * * * * ?' },
  { label: '매 5분', expression: '0 */5 * * * ?' },
  { label: '매 10분', expression: '0 */10 * * * ?' },
  { label: '매 시 정각', expression: '0 0 * * * ?' },
  { label: '매일 자정', expression: '0 0 0 * * ?' },
  { label: '매일 09:00', expression: '0 0 9 * * ?' },
  { label: '매주 월요일 09:00', expression: '0 0 9 ? * MON' },
  { label: '매월 1일 00:00', expression: '0 0 0 1 * ?' }
]

function normalizeWhitespace(str) {
  return (str || '').trim().split(/\s+/).filter(Boolean)
}

export function parseCronString(str) {
  const tokens = normalizeWhitespace(str)
  if (tokens.length !== 6 && tokens.length !== 7) {
    return { ok: false, error: 'Quartz cron은 6~7개 field를 요구합니다.' }
  }
  const fields = {
    second: tokens[0],
    minute: tokens[1],
    hour: tokens[2],
    dayOfMonth: tokens[3],
    month: tokens[4],
    dayOfWeek: tokens[5]
  }
  if (tokens.length === 7) fields.year = tokens[6]
  return { ok: true, fields }
}

export function composeCronString(fields) {
  const parts = [
    fields.second || '*',
    fields.minute || '*',
    fields.hour || '*',
    fields.dayOfMonth || '*',
    fields.month || '*',
    fields.dayOfWeek || '*'
  ]
  if (fields.year) parts.push(fields.year)
  return parts.join(' ')
}

function normalizeExpression(str) {
  return normalizeWhitespace(str).join(' ')
}

export function matchPreset(str) {
  const normalized = normalizeExpression(str)
  const found = CRON_PRESETS.find(p => p.expression === normalized)
  return found ? found.label : null
}

export function computeNextFires(expr, count = 3) {
  const parsed = parseCronString(expr)
  if (!parsed.ok) return { ok: false, error: parsed.error, fires: [] }

  try {
    const it = CronExpressionParser.parse(expr)
    const fires = []
    for (let i = 0; i < count; i++) {
      fires.push(it.next().toDate())
    }
    return { ok: true, fires }
  } catch (err) {
    return { ok: false, error: err.message || 'Parse failed', fires: [] }
  }
}

export function describeCron(expr, locale = 'ko') {
  try {
    return cronstrue.toString(expr, {
      locale,
      use24HourTimeFormat: true,
      throwExceptionOnParseError: true
    })
  } catch {
    return null
  }
}
