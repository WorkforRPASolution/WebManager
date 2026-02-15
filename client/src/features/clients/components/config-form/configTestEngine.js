/**
 * configTestEngine.js
 *
 * Pure JavaScript utility providing testing/matching engines for:
 *  - AccessLog path matching
 *  - Trigger pattern matching
 */

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
    const dirPassed = normPath.startsWith(normDir)
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

  // Extract the remaining part after directory
  const remaining = normDir ? normPath.slice(normDir.length) : normPath

  // Extract filename: if date_subdir_format exists the remaining may include
  // date subdirectories, so always take the last segment after the final /
  let fileName
  if (src.date_subdir_format) {
    const lastSlash = remaining.lastIndexOf('/')
    fileName = lastSlash >= 0 ? remaining.slice(lastSlash + 1) : remaining
  } else {
    // Still grab the final segment in case the remaining includes extra path parts
    const lastSlash = remaining.lastIndexOf('/')
    fileName = lastSlash >= 0 ? remaining.slice(lastSlash + 1) : remaining
  }

  // --- Step: Prefix ---
  if (src.prefix) {
    const prefixPassed = fileName.startsWith(src.prefix)
    steps.push({
      label: 'Prefix',
      passed: prefixPassed,
      detail: prefixPassed
        ? `"${src.prefix}" 매칭`
        : `"${src.prefix}" 불일치 (파일명: "${fileName}")`
    })
    if (!prefixPassed) {
      return { matched: false, steps }
    }
  }

  // --- Step: Suffix ---
  if (src.suffix) {
    const suffixPassed = fileName.endsWith(src.suffix)
    steps.push({
      label: 'Suffix',
      passed: suffixPassed,
      detail: suffixPassed
        ? `"${src.suffix}" 매칭`
        : `"${src.suffix}" 불일치 (파일명: "${fileName}")`
    })
    if (!suffixPassed) {
      return { matched: false, steps }
    }
  }

  // --- Step: Wildcard ---
  if (src.prefix && src.suffix) {
    const middle = fileName.slice(src.prefix.length, fileName.length - src.suffix.length)
    if (src.wildcard) {
      const wcPassed = middle.includes(src.wildcard)
      steps.push({
        label: 'Wildcard',
        passed: wcPassed,
        detail: wcPassed
          ? `"${src.wildcard}" 매칭 (중간부: "${middle}")`
          : `"${src.wildcard}" 불일치 (중간부: "${middle}")`
      })
      if (!wcPassed) {
        return { matched: false, steps }
      }
    } else {
      // wildcard empty/undefined -> any middle part is OK
      steps.push({
        label: 'Wildcard',
        passed: true,
        detail: `와일드카드 없음 - 중간부 "${middle}" 허용`
      })
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
      try {
        return new RegExp(syntax).test(line)
      } catch {
        return false
      }
    case 'keyword':
      return line.toLowerCase().includes(syntax.toLowerCase())
    case 'exact':
      return line === syntax
    default:
      // Default to keyword matching
      return line.toLowerCase().includes(syntax.toLowerCase())
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
    if (step.next === '@script' || step.next === '@Script') {
      nextAction = step.script?.name ? `→ ${step.script.name} 실행` : '→ 스크립트 실행'
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
      // Step did not fire -> chain stops here
      break
    }

    // Determine next step
    if (step.next === '@script' || step.next === '@Script' || !step.next) {
      // Chain ends (script or empty)
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
  const allFired = stepResults.length > 0 && stepResults.every((s) => s.fired)
  const lastStep = stepResults.length > 0 ? stepResults[stepResults.length - 1] : null
  let message = ''

  if (stepResults.length === 0) {
    message = '레시피에 스텝이 없습니다'
  } else if (allFired) {
    const lastRecipeStep = recipe.find((s) => s.name === lastStep.name)
    if (lastRecipeStep && (lastRecipeStep.next === '@script' || lastRecipeStep.next === '@Script')) {
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
