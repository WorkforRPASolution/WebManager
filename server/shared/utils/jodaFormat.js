/**
 * Joda DateTime format utilities (CommonJS, server-side)
 *
 * Mirrors client/src/features/clients/components/config-form/shared/formatUtils.js
 * jodaSubdirFormat for the path-matching test feature.
 */

const TOKENS = [
  { token: 'yyyy', fmt: (d) => String(d.getFullYear()) },
  { token: 'MM', fmt: (d) => String(d.getMonth() + 1).padStart(2, '0') },
  { token: 'dd', fmt: (d) => String(d.getDate()).padStart(2, '0') },
  { token: 'HH', fmt: (d) => String(d.getHours()).padStart(2, '0') },
  { token: 'mm', fmt: (d) => String(d.getMinutes()).padStart(2, '0') },
  { token: 'ss', fmt: (d) => String(d.getSeconds()).padStart(2, '0') }
]

/**
 * Format a Joda DateTime format string to a concrete value for the given date.
 * Handles single-quote literal escaping per Joda rules:
 *   - 'literal' → literal text
 *   - '' inside literal → single quote
 *   - Tokens outside quotes: yyyy, MM, dd, HH, mm, ss
 *
 * @param {string} format - Joda format (e.g. "'\\'yyyy'\\'MM'\\'dd")
 * @param {Date} date - Date to format
 * @returns {string}
 */
function formatJoda(format, date = new Date()) {
  if (!format) return ''

  let result = ''
  let i = 0

  while (i < format.length) {
    // Quoted literal
    if (format[i] === "'") {
      i++ // skip opening quote
      while (i < format.length) {
        if (format[i] === "'" && i + 1 < format.length && format[i + 1] === "'") {
          result += "'"
          i += 2
        } else if (format[i] === "'") {
          i++ // skip closing quote
          break
        } else {
          result += format[i]
          i++
        }
      }
      continue
    }

    // Try tokens
    let matched = false
    for (const t of TOKENS) {
      if (format.substring(i, i + t.token.length) === t.token) {
        result += t.fmt(date)
        i += t.token.length
        matched = true
        break
      }
    }
    if (!matched) {
      result += format[i]
      i++
    }
  }

  return result
}

// Agent 의 매칭 규칙 (client testEngine.js 와 동일):
//   - prefix:   dateAxis === 'date_prefix' 일 때만 토큰/쿼트 해석
//   - suffix:   dateAxis === 'date_suffix' 일 때만 토큰/쿼트 해석
//   - wildcard: 모든 모드에서 리터럴
const TOKEN_RESOLVE_MAP = {
  prefix:   new Set(['date_prefix']),
  suffix:   new Set(['date_suffix']),
  wildcard: new Set(),
}

function shouldResolve(fieldRole, dateAxis) {
  if (!fieldRole) return true // legacy: 게이팅 미지정 시 기존 동작 유지
  return TOKEN_RESOLVE_MAP[fieldRole]?.has(dateAxis) ?? false
}

/**
 * Resolve any embedded Joda tokens in a string to concrete values.
 * Used for prefix/suffix/wildcard with date placeholders.
 *
 * @param {string} str
 * @param {Date} [date]
 * @param {Object} [opts]
 * @param {string} [opts.fieldRole] - 'prefix' | 'suffix' | 'wildcard'
 * @param {string} [opts.dateAxis] - 'normal' | 'date' | 'date_prefix' | 'date_suffix'
 * @returns {string}
 */
function resolveJodaTokens(str, date = new Date(), opts = {}) {
  if (!str) return str
  const { fieldRole, dateAxis } = opts
  if (!shouldResolve(fieldRole, dateAxis)) return str
  const hasTokens = TOKENS.some(t => str.includes(t.token))
  // single quote 도 Joda 문법(literal wrapping/escape) — 토큰이 없어도 quote 가 있으면 파서 통과 필요
  const hasQuote = str.includes("'")
  if (!hasTokens && !hasQuote) return str
  return formatJoda(str, date)
}

module.exports = {
  formatJoda,
  resolveJodaTokens
}
