/**
 * configTestEngine.js
 *
 * Pure JavaScript utility providing testing/matching engines for:
 *  - AccessLog path matching
 *  - Trigger pattern matching
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
// Helper: try matching a single line against a pattern
// ---------------------------------------------------------------------------

function matchLine(line, syntax, type) {
  if (!syntax) return false

  switch (type) {
    case 'regex':
    case 'delay':
      try {
        return new RegExp(syntax).test(line)
      } catch {
        return false
      }
    default:
      // Default to regex matching
      try {
        return new RegExp(syntax).test(line)
      } catch {
        return false
      }
  }
}


// ---------------------------------------------------------------------------
// 3. testTriggerPattern
// ---------------------------------------------------------------------------

/**
 * Tests trigger pattern matching against input log text.
 *
 * @param {Object} trigger - { recipe: [...steps], limitation }
 * @param {string} logText - multi-line log text
 * @param {string|null} timestampFormat - e.g. "yyyy-MM-dd HH:mm:ss"
 * @returns {Object} result with steps[] and finalResult
 */
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

  // Build step lookup by name
  const stepByName = {}
  for (const step of recipe) {
    if (step.name) stepByName[step.name] = step
  }

  // Process steps
  const stepResults = []
  let currentStepIndex = 0
  let lineOffset = 0
  let resetCount = 0

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
    let fired = false
    let durationCheck = null

    // Determine next action label
    let nextAction = ''
    if (step.type === 'delay') {
      nextAction = '→ 체인 리셋'
    } else if (step.next === '@script' || step.next === '@Script') {
      nextAction = step.script?.name ? `→ ${step.script.name} 실행` : '→ 스크립트 실행'
    } else if (step.next === '@recovery') {
      nextAction = '→ 복구 실행'
    } else if (step.next === '@notify') {
      nextAction = '→ 알림 전송'
    } else if (step.next === '@popup') {
      nextAction = '→ 팝업 표시'
    } else if (step.next) {
      nextAction = `→ ${step.next}로 이동`
    } else {
      nextAction = '→ 종료'
    }

    // Scan lines from lineOffset
    for (let li = lineOffset; li < lines.length; li++) {
      const line = lines[li]
      const timestamp = parseTimestamp(line)

      // Try each pattern
      let matchedPattern = null
      for (const pat of patterns) {
        if (matchLine(line, pat, stepType)) {
          matchedPattern = pat
          break
        }
      }

      if (matchedPattern) {
        matches.push({
          lineNum: li + 1,
          line,
          pattern: matchedPattern,
          timestamp: timestamp || null
        })

        // Check if step should fire
        if (matches.length >= requiredTimes) {
          if (durationMs && tsParser && tsParser.regex) {
            // Duration check: time between first relevant match and last match
            const windowStart = matches.length - requiredTimes
            const firstTs = matches[windowStart].timestamp
            const lastTs = matches[matches.length - 1].timestamp

            if (firstTs && lastTs) {
              const elapsed = lastTs.getTime() - firstTs.getTime()
              if (elapsed <= durationMs) {
                fired = true
                durationCheck = {
                  elapsed: formatElapsedKorean(elapsed),
                  limit: formatDurationKorean(durationStr),
                  passed: true
                }
                lineOffset = li + 1
                break
              } else {
                // Sliding window: drop the earliest match and continue
                matches.splice(0, 1)
                durationCheck = {
                  elapsed: formatElapsedKorean(elapsed),
                  limit: formatDurationKorean(durationStr),
                  passed: false,
                  message: `${formatDurationKorean(durationStr)} 내 추가 매칭 필요`
                }
              }
            } else {
              // No timestamps available on matches - fire without duration check
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
            // No duration requirement -> fire immediately
            fired = true
            lineOffset = li + 1
            break
          }
        }
      }
    }

    // If we didn't fire and exhausted lines, update durationCheck for reporting
    if (!fired && durationMs && matches.length > 0 && !durationCheck) {
      durationCheck = {
        elapsed: null,
        limit: formatDurationKorean(durationStr),
        passed: false,
        message: `${formatDurationKorean(durationStr)} 내 ${requiredTimes}회 매칭 필요`
      }
    }

    stepResults.push({
      name: stepName,
      type: stepType,
      patterns,
      required: {
        times: requiredTimes,
        duration: durationStr || null
      },
      fired,
      matchCount: matches.length,
      matches,
      nextAction,
      durationCheck
    })

    if (!fired) {
      // Step did not fire -> for delay type this means timeout, proceed to next
      if (step.type === 'delay' && step.next) {
        // Delay timeout: proceed to next step (delay didn't cancel the chain)
        const nextStepIdx = recipe.findIndex((s) => s.name === step.next)
        if (nextStepIdx >= 0) {
          currentStepIndex = nextStepIdx
          continue
        }
      }
      // Chain stops here for non-delay steps, or when next step not found
      break
    }

    // Step fired
    if (step.type === 'delay') {
      // Delay step fired -> cancellation condition met
      if (step.next) {
        // Has a pending action to cancel -> reset chain to step 0
        stepResults[stepResults.length - 1].resetChain = true
        stepResults[stepResults.length - 1].nextAction = '→ 체인 리셋'

        // Guard against infinite loops
        resetCount = (resetCount || 0) + 1
        if (resetCount > 100) {
          break
        }
        currentStepIndex = 0
        lineOffset = stepResults[stepResults.length - 1].matches.length > 0
          ? lineOffset  // continue from where we were
          : lineOffset
        continue
      }
      // No pending action -> delay fired as simple pattern match, chain ends
      break
    }

    // Determine next step (non-delay)
    if (step.next === '@script' || step.next === '@Script' || step.next === '@recovery' || step.next === '@notify' || step.next === '@popup' || !step.next) {
      // Chain ends (action or empty)
      break
    }

    // Find next step by name
    const nextStepIdx = recipe.findIndex((s) => s.name === step.next)
    if (nextStepIdx >= 0) {
      currentStepIndex = nextStepIdx
    } else {
      // Next step not found -> chain ends
      break
    }
  }

  // Build final result
  // For delay steps that didn't fire (timeout), the chain correctly proceeds past them
  // so they count as "passed through" rather than "failed to match"
  const allCompleted = stepResults.length > 0 && stepResults.every((s) => s.fired || (s.type === 'delay' && !s.fired))
  const lastStep = stepResults.length > 0 ? stepResults[stepResults.length - 1] : null
  // The chain is triggered only if the last step actually fired (or timed-out delay was intermediate)
  const allFired = allCompleted && lastStep && lastStep.fired
  let message = ''

  if (stepResults.length === 0) {
    message = '레시피에 스텝이 없습니다'
  } else if (allFired) {
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
    steps: stepResults,
    finalResult: {
      triggered: allFired,
      message
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
  }

  return result
}
