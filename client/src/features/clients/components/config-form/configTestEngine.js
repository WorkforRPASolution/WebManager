/**
 * configTestEngine.js
 *
 * Pure JavaScript utility providing testing/matching engines for:
 *  - AccessLog path matching (testAccessLogPath)
 *  - Trigger pattern matching (testTriggerPattern, testTriggerWithFiles)
 *
 * ## Trigger Step Outcome Model
 *
 *  regex step:
 *    fired=true  → 발동 (패턴 매칭됨, 체인 진행)
 *    fired=false → 미발동 (체인 미완료)
 *
 *  delay step:
 *    fired=true,  cancelled=true  → 취소 (패턴 매칭됨 = 체인 리셋)
 *    fired=false, timedOut=true   → 타임아웃 (= 실제 발동, 체인 진행)
 *
 *  Duration reference: prevStepLastTimestamp (이전 step 완료 시점)
 *  Firing timestamp (delay timeout): prevStepTimestamp + delay.duration
 *
 *  상세 설계: docs/TRIGGER_TEST_ENGINE.md
 */

// ---------------------------------------------------------------------------
// 0. jodaSubdirFormat
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
// 0-1. resolveJodaTokens
// ---------------------------------------------------------------------------

/**
 * Check if a string contains Joda DateTime tokens and resolve them to current date.
 * Returns the original string if no tokens found.
 */
function resolveJodaTokens(str) {
  if (!str) return str
  const JODA_TOKENS = ['yyyy', 'MM', 'dd', 'HH', 'mm', 'ss']
  const hasTokens = JODA_TOKENS.some(t => str.includes(t))
  if (!hasTokens) return str
  const { format: fmt } = jodaSubdirFormat(str)
  return fmt(new Date())
}


// ---------------------------------------------------------------------------
// 1. testAccessLogPath
// ---------------------------------------------------------------------------

/**
 * Tests whether a given file path matches an AccessLog source configuration.
 *
 * @param {Object} source - { directory, prefix, wildcard, suffix, exclude_suffix, date_subdir_format }
 * @param {string} filePath - e.g. "D:\\Testlog\\TestLog_20260214.log"
 * @returns {{ matched: boolean, steps: Array<{ label: string, passed: boolean, detail: string }> }}
 */
export function testAccessLogPath(source, filePath) {
  const steps = []
  const src = source || {}

  // Normalize separators
  const normPath = (filePath || '').replace(/[\\/]+/g, '/')
  let normDir = (src.directory || '').replace(/[\\/]+/g, '/')
  // Ensure directory ends with /
  if (normDir && !normDir.endsWith('/')) {
    normDir += '/'
  }

  // --- Step: Directory ---
  if (normDir) {
    // Match when path starts with dir/ OR path is exactly the directory itself
    const dirPassed = normPath.startsWith(normDir) || (normPath + '/') === normDir
    steps.push({
      label: '디렉토리',
      passed: dirPassed,
      detail: dirPassed
        ? `"${src.directory}" 매칭`
        : `"${src.directory}" 불일치 (경로: "${filePath}")`
    })
    if (!dirPassed) {
      return { matched: false, steps }
    }
  }

  // --- Step: Filename filter check (at least one of prefix/suffix/wildcard required) ---
  if (!src.prefix && !src.suffix && !src.wildcard) {
    steps.push({
      label: '파일명 필터',
      passed: false,
      detail: 'prefix, suffix, wildcard 중 최소 1개 항목을 설정해야 합니다'
    })
    return { matched: false, steps }
  }

  // Extract the remaining part after directory
  const remaining = normDir ? normPath.slice(normDir.length) : normPath

  // Extract filename and optionally validate date subdirectory
  let fileName
  if (src.date_subdir_format) {
    const { format: formatDate } = jodaSubdirFormat(src.date_subdir_format)
    const expected = formatDate(new Date())
    // Normalize the expected value to use / separators (same as normPath)
    const normExpected = expected.replace(/[\\/]+/g, '/')
    // Strip leading / from expected if present
    const expectedClean = normExpected.startsWith('/') ? normExpected.slice(1) : normExpected

    const lastSlash = remaining.lastIndexOf('/')
    let subdirPart
    if (lastSlash >= 0) {
      subdirPart = remaining.slice(0, lastSlash)
      fileName = remaining.slice(lastSlash + 1)

      const subdirPassed = subdirPart === expectedClean
      steps.push({
        label: '날짜 서브디렉토리',
        passed: subdirPassed,
        detail: subdirPassed
          ? `"${subdirPart}" 매칭 (원본: "${src.date_subdir_format}")`
          : `"${subdirPart}" 불일치 (현재 날짜 기준 예상: "${expectedClean}")`
      })
      if (!subdirPassed) {
        return { matched: false, steps }
      }
    } else if (remaining) {
      // No slash — try matching entire remaining as subdirectory only (no filename)
      if (remaining === expectedClean) {
        subdirPart = remaining
        fileName = ''
        steps.push({
          label: '날짜 서브디렉토리',
          passed: true,
          detail: `"${remaining}" 매칭 (원본: "${src.date_subdir_format}")`
        })
      } else {
        // Doesn't match date format — file is directly in directory without subdirectory
        steps.push({
          label: '날짜 서브디렉토리',
          passed: false,
          detail: `서브디렉토리 없음 (예상 경로: "${src.directory}${expected}/...")`
        })
        return { matched: false, steps }
      }
    } else {
      // Empty remaining — no subdirectory at all
      steps.push({
        label: '날짜 서브디렉토리',
        passed: false,
        detail: `서브디렉토리 없음 (예상 경로: "${src.directory}${expected}")`
      })
      return { matched: false, steps }
    }
  } else {
    // No date_subdir_format — file should be directly in the directory
    if (remaining.includes('/')) {
      const lastSlash = remaining.lastIndexOf('/')
      const unexpectedSubdir = remaining.slice(0, lastSlash)
      steps.push({
        label: '서브디렉토리',
        passed: false,
        detail: `예상하지 않은 서브디렉토리 "${unexpectedSubdir}" (date_subdir_format 미설정)`
      })
      return { matched: false, steps }
    }
    fileName = remaining
  }

  // --- Step: Prefix ---
  if (src.prefix) {
    const resolvedPrefix = resolveJodaTokens(src.prefix)
    const prefixPassed = fileName.startsWith(resolvedPrefix)
    const isResolved = resolvedPrefix !== src.prefix
    steps.push({
      label: 'Prefix',
      passed: prefixPassed,
      detail: prefixPassed
        ? `"${resolvedPrefix}" 매칭${isResolved ? ` (원본: "${src.prefix}")` : ''}`
        : isResolved
          ? `파일명 "${fileName}" 불일치 (현재 날짜 기준 예상 접두사: "${resolvedPrefix}", 원본: "${src.prefix}")`
          : `"${src.prefix}" 불일치 (파일명: "${fileName}")`
    })
    if (!prefixPassed) {
      return { matched: false, steps }
    }
  }

  // --- Step: Suffix ---
  if (src.suffix) {
    const resolvedSuffix = resolveJodaTokens(src.suffix)
    const suffixPassed = fileName.endsWith(resolvedSuffix)
    const isResolved = resolvedSuffix !== src.suffix
    steps.push({
      label: 'Suffix',
      passed: suffixPassed,
      detail: suffixPassed
        ? `"${resolvedSuffix}" 매칭${isResolved ? ` (원본: "${src.suffix}")` : ''}`
        : isResolved
          ? `파일명 "${fileName}" 불일치 (현재 날짜 기준 예상 접미사: "${resolvedSuffix}", 원본: "${src.suffix}")`
          : `"${src.suffix}" 불일치 (파일명: "${fileName}")`
    })
    if (!suffixPassed) {
      return { matched: false, steps }
    }
  }

  // --- Step: Wildcard ---
  if (src.wildcard) {
    const resolvedWildcard = resolveJodaTokens(src.wildcard)
    const wcPassed = fileName.includes(resolvedWildcard)
    const isResolved = resolvedWildcard !== src.wildcard
    steps.push({
      label: 'Wildcard',
      passed: wcPassed,
      detail: wcPassed
        ? `"${resolvedWildcard}" 매칭 (파일명: "${fileName}")${isResolved ? ` (원본: "${src.wildcard}")` : ''}`
        : isResolved
          ? `파일명 "${fileName}" 불일치 (현재 날짜 기준 예상: "${resolvedWildcard}", 원본: "${src.wildcard}")`
          : `"${src.wildcard}" 불일치 (파일명: "${fileName}")`
    })
    if (!wcPassed) {
      return { matched: false, steps }
    }
  }

  // --- Step: Exclude suffix ---
  const excludeList = Array.isArray(src.exclude_suffix) ? src.exclude_suffix : []
  if (excludeList.length > 0) {
    const excludedBy = excludeList.find((es) => fileName.endsWith(es))
    const excludePassed = !excludedBy
    steps.push({
      label: '제외 대상',
      passed: excludePassed,
      detail: excludePassed
        ? '제외 대상 아님'
        : `"${excludedBy}" 제외 suffix에 해당 (파일명: "${fileName}")`
    })
    if (!excludePassed) {
      return { matched: false, steps }
    }
  } else {
    steps.push({
      label: '제외 대상',
      passed: true,
      detail: '제외 목록 없음'
    })
  }

  return { matched: true, steps }
}


// ---------------------------------------------------------------------------
// 2. timestampFormatToRegex
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
// 4. parseDurationMs
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
// Helper: format elapsed time in Korean
// ---------------------------------------------------------------------------

function formatElapsedKorean(ms) {
  if (ms == null) return null
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}초`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (sec === 0) return `${min}분`
  return `${min}분 ${sec}초`
}

function formatDurationKorean(str) {
  if (!str) return null
  const ms = parseDurationMs(str)
  if (!ms) return str
  return formatElapsedKorean(ms)
}


// ---------------------------------------------------------------------------
// Helper: extract syntax from a trigger item (object or string)
// ---------------------------------------------------------------------------

function getTriggerSyntax(item) {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object' && item.syntax != null) return item.syntax
  return ''
}


// ---------------------------------------------------------------------------
// Helper: convert <<name>> syntax in trigger patterns to named capture groups
// ---------------------------------------------------------------------------

function convertSyntaxToRegex(syntax) {
  if (!syntax) return syntax
  let result = syntax
  // Rule 1: (<<name>>pattern) → (?<name>pattern) — named capture with custom pattern in parentheses
  result = result.replace(/\(<<(\w+)>>([^)]*)\)/g, '(?<$1>$2)')
  // Rule 2: <<name>> → (?<name>[^\s]+) — standalone named capture (default pattern)
  result = result.replace(/<<(\w+)>>/g, '(?<$1>[^\\s]+)')
  // Rule 3: (<<name>pattern) → (?<name>pattern) — alternate single-bracket syntax
  result = result.replace(/\(<<(\w+)>/g, '(?<$1>')
  return result
}

// ---------------------------------------------------------------------------
// Helper: parse params string → array of conditions
// Format: "ParamComparisionMatcher[count]@[compare_value],[op],[extract_value_name];..."
// ---------------------------------------------------------------------------

function parseParams(paramsStr) {
  if (!paramsStr) return null
  const match = paramsStr.match(/^ParamComparisionMatcher(\d+)@(.+)$/)
  if (!match) return null
  return match[2].split(';').map(c => {
    const m = c.match(/^([\d.]+),(EQ|NEQ|GT|GTE|LT|LTE),(\w+)$/i)
    if (!m) return null
    return { compareValue: parseFloat(m[1]), op: m[2].toLowerCase(), varName: m[3] }
  }).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Helper: evaluate params conditions against extracted named groups
// ---------------------------------------------------------------------------

function evaluateParams(conditions, groups) {
  if (!conditions || conditions.length === 0) return true
  return conditions.every(c => {
    const val = parseFloat(groups?.[c.varName])
    if (isNaN(val)) return false
    switch (c.op) {
      case 'eq': return val === c.compareValue
      case 'neq': return val !== c.compareValue
      case 'gt': return val > c.compareValue
      case 'gte': return val >= c.compareValue
      case 'lt': return val < c.compareValue
      case 'lte': return val <= c.compareValue
      default: return false
    }
  })
}


// ---------------------------------------------------------------------------
// Helper: try matching a single line against a pattern (with params support)
// ---------------------------------------------------------------------------

function matchLineWithParams(line, triggerItem, type) {
  const syntax = getTriggerSyntax(triggerItem)
  if (!syntax) return { matched: false, groups: null, paramsResult: null }

  const converted = convertSyntaxToRegex(syntax)

  try {
    const regex = new RegExp(converted)
    const execResult = regex.exec(line)

    if (!execResult) return { matched: false, groups: null, paramsResult: null }

    const groups = execResult.groups || {}

    // Check params conditions if present
    const paramsStr = (typeof triggerItem === 'object' && triggerItem) ? triggerItem.params : null
    const conditions = parseParams(paramsStr)
    let paramsResult = null

    if (conditions && conditions.length > 0) {
      const passed = evaluateParams(conditions, groups)
      paramsResult = {
        conditions,
        passed,
        details: conditions.map(c => {
          const extractedVal = parseFloat(groups?.[c.varName])
          const ok = !isNaN(extractedVal) && evaluateParams([c], groups)
          return {
            varName: c.varName,
            extractedValue: isNaN(extractedVal) ? null : extractedVal,
            op: c.op,
            compareValue: c.compareValue,
            passed: ok
          }
        })
      }
      return { matched: passed, groups, paramsResult }
    }

    return { matched: true, groups, paramsResult }
  } catch (e) {
    return { matched: false, groups: null, paramsResult: null, error: e.message }
  }
}


// ---------------------------------------------------------------------------
// 3. executeOneChain (internal helper)
// ---------------------------------------------------------------------------

/**
 * Execute one chain run from the given line offset.
 * Returns { stepResults, allFired, lineOffset, firingTimestamp }.
 *
 * @param {Array} recipe - recipe steps
 * @param {Array} lines - all log lines
 * @param {number} startLineOffset - line index to start scanning from
 * @param {Object|null} tsParser - timestamp parser { regex, parse }
 * @param {Function} parseTimestamp - function(line) => Date|null
 * @returns {Object} { stepResults, allFired, lineOffset, firingTimestamp }
 */
function executeOneChain(recipe, lines, startLineOffset, tsParser, parseTimestamp) {
  const stepResults = []
  let currentStepIndex = 0
  let lineOffset = startLineOffset
  let resetCount = 0
  let prevStepLastTimestamp = null

  while (currentStepIndex < recipe.length && lineOffset <= lines.length) {
    const step = recipe[currentStepIndex]
    const stepName = step.name || `Step_${currentStepIndex + 1}`
    const stepType = step.type || 'keyword'
    const triggerItems = Array.isArray(step.trigger) ? step.trigger : []
    const patterns = triggerItems.map(getTriggerSyntax).filter(Boolean)
    const requiredTimes = parseInt(step.times, 10) || 1
    const durationStr = step.duration || null
    const durationMs = parseDurationMs(durationStr)

    const matches = []
    const rejectedMatches = []  // regex matched but params failed
    const regexErrors = new Set()  // regex syntax errors (deduplicated)
    let fired = false
    let durationCheck = null

    // For delay steps: check if pattern matches within duration from previous step
    const isDelay = step.type === 'delay'
    let delayTimedOut = false

    // Determine next action labels
    let nextAction = ''
    let delayTimeoutAction = ''  // what happens on delay timeout (actual next action)

    if (step.next === '@script' || step.next === '@Script') {
      nextAction = step.script?.name ? `→ ${step.script.name} 실행` : '→ 코드 기반 시나리오 실행'
    } else if (step.next === '@recovery') {
      nextAction = '→ 시나리오 실행'
    } else if (step.next === '@notify') {
      nextAction = '→ 메일 발송'
    } else if (step.next === '@popup') {
      nextAction = '→ PopUp 실행'
    } else if (step.next) {
      nextAction = `→ ${step.next}로 이동`
    } else {
      nextAction = '→ 종료'
    }

    if (isDelay) {
      delayTimeoutAction = nextAction  // save actual next action for timeout case
      nextAction = '→ 체인 리셋'       // default label = reset (when fired)
    }

    let testedLineCount = 0

    // Scan lines from lineOffset
    for (let li = lineOffset; li < lines.length; li++) {
      const line = lines[li]
      testedLineCount++
      const timestamp = parseTimestamp(line)

      // For delay steps with duration: check if we've exceeded the time window
      if (isDelay && durationMs && prevStepLastTimestamp && timestamp) {
        const elapsed = timestamp.getTime() - prevStepLastTimestamp.getTime()
        if (elapsed > durationMs) {
          // Past duration window → timeout (delay didn't fire = normal path)
          delayTimedOut = true
          durationCheck = {
            elapsed: formatElapsedKorean(elapsed),
            limit: formatDurationKorean(durationStr),
            passed: false,
            message: `${formatDurationKorean(durationStr)} 초과 → 타임아웃 (정상 진행)`
          }
          lineOffset = li  // don't consume this line, next step starts here
          break
        }
      }

      // Try each trigger item (with params support)
      let matchedPattern = null
      let matchResult = null
      for (let pi = 0; pi < triggerItems.length; pi++) {
        const item = triggerItems[pi]
        const result = matchLineWithParams(line, item, stepType)
        if (result.matched) {
          matchedPattern = patterns[pi]
          matchResult = result
          break
        }
        // Regex matched but params failed → record as rejected
        if (!result.matched && result.groups) {
          rejectedMatches.push({
            lineNum: li + 1,
            line,
            pattern: patterns[pi],
            timestamp: timestamp || null,
            groups: result.groups,
            paramsResult: result.paramsResult,
            reason: 'params_failed'
          })
        }
        // Regex syntax error → record once per pattern
        if (result.error) {
          regexErrors.add(`${patterns[pi]}: ${result.error}`)
        }
      }

      if (matchedPattern) {
        matches.push({
          lineNum: li + 1,
          line,
          pattern: matchedPattern,
          timestamp: timestamp || null,
          groups: matchResult.groups,
          paramsResult: matchResult.paramsResult
        })

        // Check if step should fire
        if (matches.length >= requiredTimes) {
          if (durationMs && tsParser && tsParser.regex) {
            const windowStart = matches.length - requiredTimes
            const firstTs = matches[windowStart].timestamp
            const lastTs = matches[matches.length - 1].timestamp
            const refTs = prevStepLastTimestamp || firstTs

            if (refTs && lastTs) {
              const elapsed = lastTs.getTime() - refTs.getTime()
              if (isDelay) {
                // For delay: elapsed is measured from prevStepLastTimestamp
                if (elapsed <= durationMs) {
                  fired = true
                  durationCheck = {
                    elapsed: formatElapsedKorean(elapsed),
                    limit: formatDurationKorean(durationStr),
                    passed: true,
                    message: `${formatDurationKorean(durationStr)} 내 매칭 → 체인 리셋`
                  }
                  lineOffset = li + 1
                  break
                } else {
                  // Pattern matched but AFTER duration → timeout
                  delayTimedOut = true
                  durationCheck = {
                    elapsed: formatElapsedKorean(elapsed),
                    limit: formatDurationKorean(durationStr),
                    passed: false,
                    message: `${formatDurationKorean(durationStr)} 초과 → 타임아웃 (정상 진행)`
                  }
                  lineOffset = li  // don't consume, next step starts here
                  break
                }
              } else if (elapsed <= durationMs) {
                fired = true
                durationCheck = {
                  elapsed: formatElapsedKorean(elapsed),
                  limit: formatDurationKorean(durationStr),
                  passed: true
                }
                lineOffset = li + 1
                break
              } else {
                matches.splice(0, 1)
                durationCheck = {
                  elapsed: formatElapsedKorean(elapsed),
                  limit: formatDurationKorean(durationStr),
                  passed: false,
                  message: `${formatDurationKorean(durationStr)} 내 추가 매칭 필요`
                }
              }
            } else {
              fired = true
              durationCheck = {
                elapsed: null,
                limit: formatDurationKorean(durationStr),
                passed: true,
                message: '타임스탬프 파싱 불가 - duration 체크 생략'
              }
              lineOffset = li + 1
              break
            }
          } else {
            fired = true
            lineOffset = li + 1
            break
          }
        }
      }
    }

    if (!fired && durationMs && matches.length > 0 && !durationCheck) {
      durationCheck = {
        elapsed: null,
        limit: formatDurationKorean(durationStr),
        passed: false,
        message: `${formatDurationKorean(durationStr)} 내 ${requiredTimes}회 매칭 필요`
      }
    }

    // After scan loop - handle delay timeout for non-timestamp case
    if (isDelay && !fired && !delayTimedOut) {
      // No more lines, no timestamp-based timeout → treat as timeout
      durationCheck = durationCheck || {
        elapsed: null,
        limit: durationStr ? formatDurationKorean(durationStr) : null,
        passed: false,
        message: '로그 끝 → 타임아웃 (정상 진행)'
      }
    }

    // For delay timeout: show actual next action instead of "체인 리셋"
    if (isDelay && !fired) {
      nextAction = delayTimeoutAction || nextAction
    }

    // For delay steps: pattern match = cancellation, not a real firing
    const cancelled = isDelay && fired

    stepResults.push({
      name: stepName,
      type: stepType,
      patterns,
      required: {
        times: requiredTimes,
        duration: durationStr || null
      },
      fired,
      cancelled,
      timedOut: isDelay && !fired,
      matchCount: matches.length,
      matches,
      rejectedMatches,
      regexErrors: [...regexErrors],
      testedLineCount,
      nextAction,
      durationCheck
    })

    if (!fired) {
      if (step.type === 'delay' && step.next) {
        // Delay timeout: check if next is a terminal action
        const terminalActions = ['@script', '@Script', '@recovery', '@notify', '@popup']
        if (terminalActions.includes(step.next)) {
          // Terminal action reached via timeout → chain is complete
          break
        }
        const nextStepIdx = recipe.findIndex((s) => s.name === step.next)
        if (nextStepIdx >= 0) {
          currentStepIndex = nextStepIdx
          continue
        }
      }
      break
    }

    if (step.type === 'delay') {
      if (step.next) {
        stepResults[stepResults.length - 1].resetChain = true
        stepResults[stepResults.length - 1].nextAction = '→ 체인 리셋'

        resetCount = (resetCount || 0) + 1
        if (resetCount > 100) {
          break
        }
        currentStepIndex = 0
        prevStepLastTimestamp = null
        lineOffset = stepResults[stepResults.length - 1].matches.length > 0
          ? lineOffset
          : lineOffset
        continue
      }
      break
    }

    if (step.next === '@script' || step.next === '@Script' || step.next === '@recovery' || step.next === '@notify' || step.next === '@popup' || !step.next) {
      break
    }

    const nextStepIdx = recipe.findIndex((s) => s.name === step.next)
    if (nextStepIdx >= 0) {
      const stepMatches = stepResults[stepResults.length - 1].matches
      if (stepMatches.length > 0 && stepMatches[stepMatches.length - 1].timestamp) {
        prevStepLastTimestamp = stepMatches[stepMatches.length - 1].timestamp
      }
      currentStepIndex = nextStepIdx
    } else {
      break
    }
  }

  const allCompleted = stepResults.length > 0 && stepResults.every((s) => s.fired || (s.type === 'delay' && !s.fired))
  const lastStep = stepResults.length > 0 ? stepResults[stepResults.length - 1] : null
  // For delay timeout with terminal action: chain is triggered even though delay didn't fire
  const lastStepIsDelayTimeout = lastStep && lastStep.type === 'delay' && !lastStep.fired
  const terminalActions = ['@script', '@Script', '@recovery', '@notify', '@popup']
  const lastStepHasTerminalNext = lastStep && lastStep.name && (() => {
    const recipeStep = recipe.find(s => s.name === lastStep.name)
    return recipeStep && terminalActions.includes(recipeStep.next)
  })()
  const allFired = allCompleted && lastStep && (lastStep.fired || (lastStepIsDelayTimeout && lastStepHasTerminalNext))

  let firingTimestamp = null
  if (allFired && lastStep) {
    if (lastStep.fired && lastStep.matches.length > 0) {
      // Regex step: timestamp of last match
      firingTimestamp = lastStep.matches[lastStep.matches.length - 1].timestamp || null
    } else if (lastStepIsDelayTimeout && stepResults.length > 1) {
      // Delay timeout: compute timeout moment = prevStep timestamp + delay duration
      const prevStep = stepResults[stepResults.length - 2]
      const delayRecipeStep = recipe.find(s => s.name === lastStep.name)
      const delayDurationMs = parseDurationMs(delayRecipeStep?.duration)

      if (prevStep.matches.length > 0 && prevStep.matches[prevStep.matches.length - 1].timestamp) {
        const prevTs = prevStep.matches[prevStep.matches.length - 1].timestamp
        if (delayDurationMs) {
          // Timeout moment = previous step completion + delay duration
          firingTimestamp = new Date(prevTs.getTime() + delayDurationMs)
        } else {
          firingTimestamp = prevTs
        }
      }
    }
  }

  return { stepResults, allFired, lineOffset, firingTimestamp }
}


// ---------------------------------------------------------------------------
// 3b. testTriggerPattern
// ---------------------------------------------------------------------------

/**
 * Tests trigger pattern matching against input log text.
 *
 * @param {Object} trigger - { recipe: [...steps], limitation }
 * @param {string} logText - multi-line log text
 * @param {string|null} timestampFormat - e.g. "yyyy-MM-dd HH:mm:ss"
 * @returns {Object} result with steps[], finalResult, firings[], and limitation
 */
export { convertSyntaxToRegex, parseParams, evaluateParams }


// ---------------------------------------------------------------------------
// MULTI trigger class support
// ---------------------------------------------------------------------------

/**
 * Replace @<<name>>@ references with captured group values.
 * Special regex chars in values are escaped.
 * Must be called BEFORE convertSyntaxToRegex().
 */
export function substituteMultiCaptures(syntax, capturedGroups) {
  if (!syntax) return ''
  if (!capturedGroups) return syntax
  return syntax.replace(/@<<(\w+)>>@/g, (match, name) => {
    if (capturedGroups[name] !== undefined) {
      // Escape special regex characters in the value
      return String(capturedGroups[name]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    return match // leave unchanged if not found
  })
}

const MAX_MULTI_INSTANCES = 20

/**
 * Match a line for a MULTI instance's current step, substituting captures.
 */
function matchLineForMulti(line, triggerItems, capturedGroups) {
  for (let pi = 0; pi < triggerItems.length; pi++) {
    const item = triggerItems[pi]
    const syntax = getTriggerSyntax(item)
    if (!syntax) continue

    // Substitute @<<name>>@ references BEFORE regex conversion
    const substituted = substituteMultiCaptures(syntax, capturedGroups)
    const converted = convertSyntaxToRegex(substituted)

    try {
      const regex = new RegExp(converted)
      const execResult = regex.exec(line)
      if (execResult) {
        return { matched: true, groups: execResult.groups || {} }
      }
    } catch (e) {
      // regex error, skip
    }
  }
  return { matched: false, groups: null }
}

/**
 * Execute MULTI chain logic for a trigger with class='MULTI'.
 *
 * @param {Object} trigger - trigger config with recipe and class='MULTI'
 * @param {string[]} lines - log lines
 * @param {Object|null} tsParser - timestamp parser
 * @param {Function} parseTimestamp - function(line) => Date|null
 * @returns {Object} MULTI result with instances
 */
function executeMultiChain(trigger, lines, tsParser, parseTimestamp) {
  const recipe = Array.isArray(trigger.recipe) ? trigger.recipe : []
  if (recipe.length === 0) {
    return {
      multiInstances: [],
      multiSummary: { totalCreated: 0, fired: 0, cancelled: 0, incomplete: 0 }
    }
  }

  const step01 = recipe[0]
  const step01Triggers = Array.isArray(step01.trigger) ? step01.trigger : []

  let instances = []
  let nextId = 1

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const timestamp = parseTimestamp(line)

    // 1. Process active instances (check their current step)
    for (const inst of instances) {
      if (inst.status !== 'active') continue

      const currentStepIdx = inst.currentStepIdx
      if (currentStepIdx >= recipe.length) continue
      const step = recipe[currentStepIdx]
      const stepTriggers = Array.isArray(step.trigger) ? step.trigger : []
      const isDelay = step.type === 'delay'
      const durationMs = parseDurationMs(step.duration)

      if (isDelay) {
        // Check timeout first
        if (durationMs && inst.prevStepTimestamp && timestamp) {
          const elapsed = timestamp.getTime() - inst.prevStepTimestamp.getTime()
          if (elapsed > durationMs) {
            // Timeout -> fired
            inst.status = 'fired'
            inst.firingTimestamp = new Date(inst.prevStepTimestamp.getTime() + durationMs)
            inst.stepResults.push({
              name: step.name,
              type: 'delay',
              timedOut: true,
              cancelled: false,
              message: `타임아웃 (${step.duration} 초과)`
            })
            continue
          }
        }

        // Check cancel pattern
        const matchResult = matchLineForMulti(line, stepTriggers, inst.capturedGroups)
        if (matchResult.matched) {
          inst.status = 'cancelled'
          inst.stepResults.push({
            name: step.name,
            type: 'delay',
            timedOut: false,
            cancelled: true,
            lineNum: li + 1,
            line,
            message: `패턴 매칭 → 취소`
          })
          continue
        }
      } else {
        // regex step (steps beyond step_01)
        const matchResult = matchLineForMulti(line, stepTriggers, inst.capturedGroups)
        if (matchResult.matched) {
          inst.stepResults.push({
            name: step.name,
            type: step.type,
            matched: true,
            lineNum: li + 1,
            line
          })
          inst.prevStepTimestamp = timestamp

          // Check if terminal
          const terminalActions = ['@script', '@Script', '@recovery', '@notify', '@popup']
          if (terminalActions.includes(step.next) || !step.next) {
            inst.status = 'fired'
            inst.firingTimestamp = timestamp
          } else {
            // Move to next step
            const nextStepIdx = recipe.findIndex(s => s.name === step.next)
            if (nextStepIdx >= 0) {
              inst.currentStepIdx = nextStepIdx
            } else {
              inst.status = 'fired'
              inst.firingTimestamp = timestamp
            }
          }
        }
      }
    }

    // 2. Check step_01 for new instances
    if (instances.filter(i => i.status === 'active').length < MAX_MULTI_INSTANCES) {
      for (const item of step01Triggers) {
        const syntax = getTriggerSyntax(item)
        if (!syntax) continue
        const converted = convertSyntaxToRegex(syntax)
        try {
          const regex = new RegExp(converted)
          const execResult = regex.exec(line)
          if (execResult && execResult.groups && Object.keys(execResult.groups).length > 0) {
            const groups = { ...execResult.groups }
            // Use the first captured group value as the key
            const capturedKey = Object.values(groups)[0] || ''

            // Don't create duplicate active instances for the same key
            const existingActive = instances.find(i => i.capturedKey === capturedKey && i.status === 'active')
            if (existingActive) continue

            const inst = {
              id: nextId++,
              capturedGroups: groups,
              capturedKey,
              startLineNum: li + 1,
              status: 'active',
              currentStepIdx: 0, // will be advanced below
              prevStepTimestamp: timestamp,
              stepResults: [{
                name: step01.name,
                type: step01.type,
                matched: true,
                lineNum: li + 1,
                line
              }],
              firingTimestamp: null
            }

            // Advance past step_01
            const terminalActions = ['@script', '@Script', '@recovery', '@notify', '@popup']
            if (terminalActions.includes(step01.next) || !step01.next) {
              inst.status = 'fired'
              inst.firingTimestamp = timestamp
            } else {
              const nextStepIdx = recipe.findIndex(s => s.name === step01.next)
              if (nextStepIdx >= 0) {
                inst.currentStepIdx = nextStepIdx
              } else {
                inst.status = 'fired'
                inst.firingTimestamp = timestamp
              }
            }

            instances.push(inst)
          }
        } catch (e) {
          // regex error
        }
      }
    }
  }

  // EOF: handle remaining active instances
  for (const inst of instances) {
    if (inst.status !== 'active') continue

    const currentStepIdx = inst.currentStepIdx
    if (currentStepIdx >= recipe.length) {
      inst.status = 'fired'
      continue
    }
    const step = recipe[currentStepIdx]

    if (step.type === 'delay') {
      // Delay step at EOF
      // If instance was created on the very last line, no subsequent lines were
      // checked for the delay step, so the instance remains active (incomplete)
      if (inst.startLineNum >= lines.length) {
        // No lines were processed after creation -> remain active
        // (status stays 'active', will be counted as incomplete)
      } else {
        // At least one line was processed after creation -> timeout (fired)
        const durationMs = parseDurationMs(step.duration)
        if (inst.prevStepTimestamp && durationMs) {
          inst.firingTimestamp = new Date(inst.prevStepTimestamp.getTime() + durationMs)
        }
        inst.status = 'fired'
        inst.stepResults.push({
          name: step.name,
          type: 'delay',
          timedOut: true,
          cancelled: false,
          message: '로그 끝 → 타임아웃'
        })
      }
    } else {
      // Regex step at EOF -> incomplete
      inst.status = 'incomplete'
    }
  }

  const fired = instances.filter(i => i.status === 'fired').length
  const cancelled = instances.filter(i => i.status === 'cancelled').length
  const incomplete = instances.filter(i => i.status === 'incomplete' || i.status === 'active').length

  return {
    multiInstances: instances.map(i => ({
      id: i.id,
      capturedGroups: i.capturedGroups,
      capturedKey: i.capturedKey,
      startLineNum: i.startLineNum,
      status: i.status,
      stepResults: i.stepResults,
      firingTimestamp: i.firingTimestamp
    })),
    multiSummary: {
      totalCreated: instances.length,
      fired,
      cancelled,
      incomplete
    }
  }
}

export function testTriggerPattern(trigger, logText, timestampFormat) {
  const trig = trigger || {}
  const recipe = Array.isArray(trig.recipe) ? trig.recipe : []
  const lines = (logText || '').split('\n')

  // Timestamp parsing setup
  let tsParser = null
  if (timestampFormat) {
    tsParser = timestampFormatToRegex(timestampFormat)
  }

  function parseTimestamp(line) {
    if (!tsParser || !tsParser.regex) return null
    const m = line.match(tsParser.regex)
    return m ? tsParser.parse(m) : null
  }

  // MULTI class branch
  if (trig.class === 'MULTI') {
    const multiResult = executeMultiChain(trig, lines, tsParser, parseTimestamp)
    const hasFired = multiResult.multiSummary.fired > 0

    let message = ''
    if (multiResult.multiInstances.length === 0) {
      message = 'step_01 패턴에 매칭되는 라인이 없습니다'
    } else if (hasFired) {
      message = `${multiResult.multiSummary.fired}건 발동, ${multiResult.multiSummary.cancelled}건 취소`
      if (multiResult.multiSummary.incomplete > 0) {
        message += `, ${multiResult.multiSummary.incomplete}건 미완료`
      }
    } else {
      message = `${multiResult.multiInstances.length}건 생성, 발동 없음`
    }

    return {
      steps: [],
      finalResult: {
        triggered: hasFired,
        message
      },
      firings: [],
      limitation: null,
      isMulti: true,
      multiInstances: multiResult.multiInstances,
      multiSummary: multiResult.multiSummary
    }
  }

  // Limitation config
  const hasLimitation = !!(trig.limitation && trig.limitation.duration)
  const limitTimes = (trig.limitation?.times != null) ? trig.limitation.times : Infinity
  const limitDurationStr = trig.limitation?.duration || null
  const limitDurationMs = parseDurationMs(limitDurationStr)

  // If no limitation configured, run chain once (existing behavior)
  if (!hasLimitation) {
    const chainResult = executeOneChain(recipe, lines, 0, tsParser, parseTimestamp)

    let message = ''
    const lastStep = chainResult.stepResults.length > 0
      ? chainResult.stepResults[chainResult.stepResults.length - 1]
      : null

    if (chainResult.stepResults.length === 0) {
      message = '레시피에 스텝이 없습니다'
    } else if (chainResult.allFired) {
      const lastRecipeStep = recipe.find((s) => s.name === lastStep.name)
      if (lastRecipeStep && ['@script', '@Script', '@recovery', '@notify', '@popup'].includes(lastRecipeStep.next)) {
        message = `모든 스텝 완료 - ${lastStep.nextAction}`
      } else {
        message = '모든 스텝 매칭 완료'
      }
    } else if (lastStep && !lastStep.fired) {
      message = `${lastStep.name}에서 대기 중 (${lastStep.matchCount}/${lastStep.required.times}회)`
    }

    return {
      steps: chainResult.stepResults,
      finalResult: {
        triggered: chainResult.allFired,
        message
      },
      firings: chainResult.allFired
        ? [{ steps: chainResult.stepResults, fired: true, suppressed: false, firingTimestamp: chainResult.firingTimestamp }]
        : [],
      limitation: null
    }
  }

  // With limitation: run chain repeatedly and apply limitation logic
  const firings = []
  let globalLineOffset = 0
  const MAX_FIRINGS = 100

  while (globalLineOffset < lines.length && firings.length < MAX_FIRINGS) {
    const chainResult = executeOneChain(recipe, lines, globalLineOffset, tsParser, parseTimestamp)

    if (chainResult.allFired) {
      const firingTs = chainResult.firingTimestamp

      // Check limitation
      let suppressed = false
      if (limitDurationMs && firingTs) {
        const recentFirings = firings.filter(f =>
          !f.suppressed && f.firingTimestamp &&
          (firingTs.getTime() - f.firingTimestamp.getTime()) <= limitDurationMs
        )
        if (recentFirings.length >= limitTimes) {
          suppressed = true
        }
      }

      firings.push({
        steps: chainResult.stepResults,
        fired: true,
        suppressed,
        firingTimestamp: firingTs,
        incomplete: false
      })

      if (chainResult.lineOffset > globalLineOffset) {
        globalLineOffset = chainResult.lineOffset
      } else {
        globalLineOffset++
      }
    } else {
      firings.push({
        steps: chainResult.stepResults,
        fired: false,
        suppressed: false,
        firingTimestamp: null,
        incomplete: true
      })
      break
    }
  }

  // Build final result
  const completedFirings = firings.filter(f => !f.incomplete)
  const allowedFirings = completedFirings.filter(f => !f.suppressed)
  const suppressedFirings = completedFirings.filter(f => f.suppressed)
  const triggered = allowedFirings.length > 0

  let message = ''
  if (firings.length === 0) {
    message = '레시피에 스텝이 없습니다'
  } else if (completedFirings.length === 0) {
    const lastFiring = firings[firings.length - 1]
    const lastStep = lastFiring.steps.length > 0 ? lastFiring.steps[lastFiring.steps.length - 1] : null
    if (lastStep && !lastStep.fired) {
      message = `${lastStep.name}에서 대기 중 (${lastStep.matchCount}/${lastStep.required.times}회)`
    }
  } else {
    const firstFiring = firings[0]
    const lastStep = firstFiring.steps[firstFiring.steps.length - 1]
    const lastRecipeStep = recipe.find((s) => s.name === lastStep.name)
    const actionSuffix = lastRecipeStep && ['@script', '@Script', '@recovery', '@notify', '@popup'].includes(lastRecipeStep.next)
      ? ` - ${lastStep.nextAction}`
      : ''

    if (suppressedFirings.length === 0) {
      message = `모든 스텝 완료${actionSuffix} (${completedFirings.length}회 발동, 제한 내)`
    } else {
      const limitLabel = formatDurationKorean(limitDurationStr) || limitDurationStr
      message = `모든 스텝 완료${actionSuffix} (${completedFirings.length}회 감지, ${allowedFirings.length}회 발동, ${suppressedFirings.length}회 억제 — ${limitLabel} 내 최대 ${limitTimes}회)`
    }
  }

  return {
    steps: firings.length > 0 ? firings[0].steps : [],
    finalResult: {
      triggered,
      message
    },
    firings: firings.map(f => ({
      steps: f.steps,
      fired: f.fired,
      suppressed: f.suppressed,
      firingTimestamp: f.firingTimestamp
    })),
    limitation: {
      times: limitTimes === Infinity ? null : limitTimes,
      duration: limitDurationStr,
      durationFormatted: formatDurationKorean(limitDurationStr),
      totalFirings: completedFirings.length,
      allowedFirings: allowedFirings.length,
      suppressedFirings: suppressedFirings.length
    }
  }
}


// ---------------------------------------------------------------------------
// 5. testTriggerWithFiles
// ---------------------------------------------------------------------------

/**
 * Same as testTriggerPattern but accepts an array of files.
 * Concatenates contents and tracks which file each line belongs to.
 *
 * @param {Object} trigger - { recipe: [...steps], limitation }
 * @param {Array<{ name: string, content: string }>} files
 * @param {string|null} timestampFormat
 * @returns {Object} same as testTriggerPattern with additional file info in matches
 */
export function testTriggerWithFiles(trigger, files, timestampFormat) {
  const fileArr = Array.isArray(files) ? files : []

  // Build combined text and line-to-file mapping
  const allLines = []
  const lineFileMap = [] // index -> { fileName, localLineNum }

  for (const file of fileArr) {
    const content = file.content || ''
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      lineFileMap.push({
        fileName: file.name || 'unknown',
        localLineNum: i + 1
      })
      allLines.push(lines[i])
    }
  }

  const combinedText = allLines.join('\n')

  // Run the regular trigger test
  const result = testTriggerPattern(trigger, combinedText, timestampFormat)

  // Augment matches with file info
  for (const stepResult of result.steps) {
    stepResult.matches = stepResult.matches.map((m) => {
      const globalIdx = m.lineNum - 1
      const fileInfo = lineFileMap[globalIdx] || { fileName: 'unknown', localLineNum: m.lineNum }
      return {
        ...m,
        globalLineNum: m.lineNum,
        lineNum: fileInfo.localLineNum,
        fileName: fileInfo.fileName
      }
    })
    if (stepResult.rejectedMatches) {
      stepResult.rejectedMatches = stepResult.rejectedMatches.map((m) => {
        const globalIdx = m.lineNum - 1
        const fileInfo = lineFileMap[globalIdx] || { fileName: 'unknown', localLineNum: m.lineNum }
        return {
          ...m,
          globalLineNum: m.lineNum,
          lineNum: fileInfo.localLineNum,
          fileName: fileInfo.fileName
        }
      })
    }
  }

  return result
}


// ---------------------------------------------------------------------------
// 6. testMultilineBlocks
// ---------------------------------------------------------------------------

/**
 * Tests multiline block extraction from log text.
 *
 * @param {Object} source - { start_pattern, end_pattern, line_count, priority }
 * @param {string} text - multi-line log text
 * @returns {Object} { blocks, skippedLines, summary, errors }
 */
export function testMultilineBlocks(source, text) {
  const src = source || {}
  const lines = (text || '').split('\n')
  const blocks = []
  const skippedLines = []
  const errors = []

  // Validate regex patterns
  let startRe = null
  let endRe = null
  try {
    if (src.start_pattern) startRe = new RegExp(src.start_pattern)
  } catch (e) {
    errors.push(`start_pattern 정규식 오류: ${e.message}`)
  }
  try {
    if (src.end_pattern) endRe = new RegExp(src.end_pattern)
  } catch (e) {
    errors.push(`end_pattern 정규식 오류: ${e.message}`)
  }

  if (!startRe || errors.length > 0) {
    // Can't process without valid start_pattern
    for (let i = 0; i < lines.length; i++) {
      skippedLines.push({ lineNum: i + 1, text: lines[i] })
    }
    return {
      blocks,
      skippedLines,
      summary: { totalLines: lines.length, blockCount: 0, skippedCount: lines.length },
      errors
    }
  }

  const maxCount = (src.line_count != null && src.line_count > 0) ? src.line_count : Infinity
  const priority = src.priority || 'count'

  let state = 'SCANNING' // SCANNING or COLLECTING
  let currentBlock = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    const matchesStart = startRe.test(line)
    const matchesEnd = endRe ? endRe.test(line) : false

    if (state === 'SCANNING') {
      if (matchesStart) {
        currentBlock = {
          blockNum: blocks.length + 1,
          startLine: lineNum,
          endLine: lineNum,
          lines: [{ lineNum, text: line, role: 'start' }],
          terminatedBy: null,
          lineCount: 1
        }
        state = 'COLLECTING'
        // Note: no immediate count check here — matches real Scala code
      } else {
        skippedLines.push({ lineNum, text: line })
      }
    } else {
      // COLLECTING: Scala match order — start_pattern → end_pattern → default

      if (matchesStart) {
        // case start_pattern()
        if (priority === 'count' && maxCount !== Infinity) {
          // Count priority: start_pattern treated as content (no new block)
          currentBlock.lines.push({ lineNum, text: line, role: 'content' })
          currentBlock.lineCount++
          currentBlock.endLine = lineNum
          if (currentBlock.lineCount >= maxCount) {
            currentBlock.terminatedBy = 'count'
            blocks.push(currentBlock)
            currentBlock = null
            state = 'SCANNING'
          }
        } else {
          // Pattern priority (or line_count not set): flush current block, start new
          currentBlock.terminatedBy = 'startPattern'
          currentBlock.endLine = currentBlock.lines[currentBlock.lines.length - 1].lineNum
          blocks.push(currentBlock)
          currentBlock = {
            blockNum: blocks.length + 1,
            startLine: lineNum,
            endLine: lineNum,
            lines: [{ lineNum, text: line, role: 'start' }],
            terminatedBy: null,
            lineCount: 1
          }
        }
      } else if (matchesEnd) {
        // case end_pattern() — always terminates block (regardless of priority)
        currentBlock.lines.push({ lineNum, text: line, role: 'end' })
        currentBlock.lineCount++
        currentBlock.endLine = lineNum
        currentBlock.terminatedBy = 'endPattern'
        blocks.push(currentBlock)
        currentBlock = null
        state = 'SCANNING'
      } else {
        // case _ (default) — empty line or count reached terminates block
        currentBlock.lines.push({ lineNum, text: line, role: 'content' })
        currentBlock.lineCount++
        currentBlock.endLine = lineNum
        if (line === '' || currentBlock.lineCount >= maxCount) {
          currentBlock.terminatedBy = line === '' ? 'emptyLine' : 'count'
          blocks.push(currentBlock)
          currentBlock = null
          state = 'SCANNING'
        }
      }
    }
  }

  // EOF: close any open block
  if (currentBlock) {
    currentBlock.terminatedBy = 'eof'
    currentBlock.endLine = currentBlock.lines[currentBlock.lines.length - 1].lineNum
    blocks.push(currentBlock)
  }

  return {
    blocks,
    skippedLines,
    summary: {
      totalLines: lines.length,
      blockCount: blocks.length,
      skippedCount: skippedLines.length
    },
    errors
  }
}


/**
 * Auto-escape backslashes in a regex pattern that are NOT part of recognized regex escapes.
 * Handles Windows paths where users type single \ in form inputs.
 * e.g., ".*\Log\test" → ".*\\Log\\test" (matches literal backslash)
 */
function autoEscapeBackslashes(pattern) {
  const validEscapeChars = /^[dDwWsSnrtfvbB0-9cxupP.*+?(){}\[\]|^$\\\/]$/
  let result = ''
  let i = 0
  while (i < pattern.length) {
    if (pattern[i] === '\\' && i + 1 < pattern.length) {
      const next = pattern[i + 1]
      if (validEscapeChars.test(next)) {
        result += '\\' + next
        i += 2
      } else {
        // Not a recognized regex escape → escape the backslash
        result += '\\\\' + next
        i += 2
      }
    } else {
      result += pattern[i]
      i++
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// 7. testExtractAppend
// ---------------------------------------------------------------------------

/**
 * Tests extract-append processing on log text.
 *
 * @param {Object} source - { pathPattern, appendPos, appendFormat }
 * @param {string} filePath - file absolute path to extract from
 * @param {string} logText - multi-line log text
 * @returns {Object} { extraction, formatting, lines, summary }
 */
export function testExtractAppend(source, filePath, logText) {
  const src = source || {}
  const logLines = (logText || '').split('\n')

  // Step 1: Extract groups from filePath
  const extraction = {
    pattern: src.pathPattern ? autoEscapeBackslashes(src.pathPattern) : '',
    matched: false,
    groups: [],
    error: null
  }

  let regex = null
  try {
    if (src.pathPattern) {
      regex = new RegExp(autoEscapeBackslashes(src.pathPattern))
    }
  } catch (e) {
    extraction.error = e.message
  }

  if (regex && filePath) {
    const match = regex.exec(filePath)
    if (match) {
      extraction.matched = true
      // Extract capture groups (up to 5)
      for (let g = 1; g <= 5 && g < match.length; g++) {
        extraction.groups.push(match[g] !== undefined ? match[g] : '')
      }
    }
  }

  // Step 2: Build resolved format string
  const appendFormat = src.appendFormat || ''
  let resolved = appendFormat
  for (let g = 0; g < 5; g++) {
    const placeholder = `@${g + 1}`
    const value = g < extraction.groups.length ? extraction.groups[g] : ''
    resolved = resolved.split(placeholder).join(value)
  }

  const appendPos = src.appendPos != null ? src.appendPos : 0

  const formatting = {
    appendFormat,
    resolved,
    appendPos
  }

  // Step 3: Apply to each log line
  const resultLines = logLines.map((line, idx) => {
    let result = line
    if (extraction.matched && resolved) {
      if (appendPos <= 0) {
        result = resolved + line
      } else if (appendPos >= line.length) {
        result = line + resolved
      } else {
        result = line.slice(0, appendPos) + resolved + line.slice(appendPos)
      }
    }
    return {
      lineNum: idx + 1,
      original: line,
      result
    }
  })

  return {
    extraction,
    formatting,
    lines: resultLines,
    summary: {
      totalLines: logLines.length,
      groupCount: extraction.groups.length
    }
  }
}
