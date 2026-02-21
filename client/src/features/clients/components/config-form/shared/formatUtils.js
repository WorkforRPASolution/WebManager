/**
 * shared/formatUtils.js
 *
 * Shared formatting/parsing utilities used across accesslog and trigger domains.
 */

// ---------------------------------------------------------------------------
// jodaSubdirFormat
// ---------------------------------------------------------------------------

/**
 * Parse a Joda DateTime format string, returning a regex for matching
 * and a formatter function that produces the actual string for a given Date.
 *
 * Joda rules:
 *  - Text inside single quotes is literal ('\\' → \)
 *  - '' inside a quoted section = literal single quote
 *  - Tokens: yyyy, MM, dd, HH, mm, ss
 *
 * @param {string} format - e.g. "'\\'yyyy'\\'MM'\\'dd"
 * @returns {{ regex: RegExp, format: (date: Date) => string }}
 */
export function jodaSubdirFormat(format) {
  if (!format) return { regex: null, format: () => '' }

  let regexStr = ''
  let i = 0

  const TOKENS = [
    { token: 'yyyy', regex: '\\d{4}', fmt: (d) => String(d.getFullYear()) },
    { token: 'MM', regex: '\\d{2}', fmt: (d) => String(d.getMonth() + 1).padStart(2, '0') },
    { token: 'dd', regex: '\\d{2}', fmt: (d) => String(d.getDate()).padStart(2, '0') },
    { token: 'HH', regex: '\\d{2}', fmt: (d) => String(d.getHours()).padStart(2, '0') },
    { token: 'mm', regex: '\\d{2}', fmt: (d) => String(d.getMinutes()).padStart(2, '0') },
    { token: 'ss', regex: '\\d{2}', fmt: (d) => String(d.getSeconds()).padStart(2, '0') },
  ]

  // For the format function, build an array of segments
  const segments = [] // { type: 'literal', value } or { type: 'token', fmt }

  while (i < format.length) {
    // Quoted literal
    if (format[i] === "'") {
      i++ // skip opening quote
      let literal = ''
      while (i < format.length) {
        if (format[i] === "'" && i + 1 < format.length && format[i + 1] === "'") {
          literal += "'"
          i += 2
        } else if (format[i] === "'") {
          i++ // skip closing quote
          break
        } else {
          literal += format[i]
          i++
        }
      }
      // Escape for regex
      regexStr += literal.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')
      segments.push({ type: 'literal', value: literal })
      continue
    }

    // Try tokens
    let matched = false
    for (const t of TOKENS) {
      if (format.substring(i, i + t.token.length) === t.token) {
        regexStr += t.regex
        segments.push({ type: 'token', fmt: t.fmt })
        i += t.token.length
        matched = true
        break
      }
    }

    if (!matched) {
      // literal character
      regexStr += format[i].replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')
      segments.push({ type: 'literal', value: format[i] })
      i++
    }
  }

  const regex = new RegExp('^' + regexStr + '$')

  const formatFn = (date) => {
    return segments.map(seg => seg.type === 'literal' ? seg.value : seg.fmt(date)).join('')
  }

  return { regex, format: formatFn }
}


// ---------------------------------------------------------------------------
// timestampFormatToRegex
// ---------------------------------------------------------------------------

const FORMAT_TOKENS = [
  { token: 'yyyy', regex: '(\\d{4})', field: 'year' },
  { token: 'MM', regex: '(\\d{2})', field: 'month' },
  { token: 'dd', regex: '(\\d{2})', field: 'day' },
  { token: 'HH', regex: '(\\d{2})', field: 'hour' },
  { token: 'mm', regex: '(\\d{2})', field: 'minute' },
  { token: 'ss', regex: '(\\d{2})', field: 'second' },
  { token: 'SSS', regex: '(\\d{3})', field: 'millisecond' }
]

/**
 * Escape a character for use in a regex.
 */
function escapeRegexChar(ch) {
  return ch.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')
}

/**
 * Converts a timestamp format string to a regex and parser function.
 *
 * @param {string} format - e.g. "yyyy-MM-dd HH:mm:ss"
 * @returns {{ regex: RegExp, parse: (match: RegExpMatchArray) => Date }}
 */
export function timestampFormatToRegex(format) {
  if (!format) {
    return { regex: null, parse: () => null }
  }

  // Build regex and record which capture group maps to which field
  let regexStr = ''
  let groupIndex = 0
  const groupMap = {} // groupIndex -> field name
  let i = 0

  while (i < format.length) {
    let matched = false
    // Try to match the longest token first (SSS before ss issue is avoided
    // because SSS comes before ss in the token list, and we always try
    // longest match by checking token length)
    for (const { token, regex, field } of FORMAT_TOKENS) {
      if (format.substring(i, i + token.length) === token) {
        groupIndex++
        groupMap[groupIndex] = field
        regexStr += regex
        i += token.length
        matched = true
        break
      }
    }
    if (!matched) {
      regexStr += escapeRegexChar(format[i])
      i++
    }
  }

  const regex = new RegExp(regexStr)

  const parse = (match) => {
    if (!match) return null
    const parts = {
      year: 2000,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0
    }
    for (const [idx, field] of Object.entries(groupMap)) {
      const val = parseInt(match[parseInt(idx)], 10)
      if (!isNaN(val)) {
        parts[field] = val
      }
    }
    return new Date(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond
    )
  }

  return { regex, parse }
}


// ---------------------------------------------------------------------------
// parseDurationMs
// ---------------------------------------------------------------------------

/**
 * Convert a duration string to milliseconds.
 *   "10 seconds" -> 10000
 *   "1 minutes"  -> 60000
 *   "2 hours"    -> 7200000
 *
 * @param {string|null|undefined} str
 * @returns {number} milliseconds, or 0 if empty/null
 */
export function parseDurationMs(str) {
  if (!str || typeof str !== 'string') return 0
  const trimmed = str.trim().toLowerCase()
  if (!trimmed) return 0

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)$/i)
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = match[2].toLowerCase()

  if (/^(s|sec|secs|second|seconds)$/.test(unit)) return Math.round(value * 1000)
  if (/^(m|min|mins|minute|minutes)$/.test(unit)) return Math.round(value * 60 * 1000)
  if (/^(h|hr|hrs|hour|hours)$/.test(unit)) return Math.round(value * 3600 * 1000)
  return 0
}


// ---------------------------------------------------------------------------
// parseDuration (from configDescription.js)
// ---------------------------------------------------------------------------

/**
 * Parse a duration string like "10 seconds" or "1 minutes" into Korean.
 * @param {string} str - Duration string (e.g. "10 seconds", "1 minutes")
 * @returns {string|null} Korean duration string or null if empty
 */
export function parseDuration(str) {
  if (!str || !str.trim()) return null;

  const match = str.trim().match(/^(\d+)\s*(seconds?|minutes?|hours?)$/i);
  if (!match) return str;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('second')) return `${value}초`;
  if (unit.startsWith('minute')) return `${value}분`;
  if (unit.startsWith('hour')) return `${value}시간`;

  return str;
}
