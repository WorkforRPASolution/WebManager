/**
 * accesslog/testEngine.js
 *
 * Testing engines for AccessLog configurations:
 *  - Path matching (testAccessLogPath)
 *  - Multiline block extraction (testMultilineBlocks)
 *  - Extract-append processing (testExtractAppend)
 *  - Log time filter (testLogTimeFilter)
 *  - Line grouping (testLineGroup)
 */

import { jodaSubdirFormat, timestampFormatToRegex } from '../shared/formatUtils'


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
    if (src.start_pattern) {
      // Scala pattern match (case regex()) uses full-string matching
      const raw = src.start_pattern
      const anchored = (raw.startsWith('^') ? '' : '^') + raw + (raw.endsWith('$') ? '' : '$')
      startRe = new RegExp(anchored)
    }
  } catch (e) {
    errors.push(`start_pattern 정규식 오류: ${e.message}`)
  }
  try {
    if (src.end_pattern) {
      const raw = src.end_pattern
      const anchored = (raw.startsWith('^') ? '' : '^') + raw + (raw.endsWith('$') ? '' : '$')
      endRe = new RegExp(anchored)
    }
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
      // Java String.matches() / Scala .r match uses full-string matching
      const raw = autoEscapeBackslashes(src.pathPattern)
      const anchored = (raw.startsWith('^') ? '' : '^') + raw + (raw.endsWith('$') ? '' : '$')
      regex = new RegExp(anchored)
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


// ---------------------------------------------------------------------------
// 8. testLogTimeFilter
// ---------------------------------------------------------------------------

/**
 * Tests log time filter on log text.
 * Extracts timestamp from each line using log_time_pattern regex,
 * parses via log_time_format, and compares to track last_read_time.
 *
 * Lines with timestamps earlier than the last seen timestamp are marked 'skip'.
 * Lines with timestamps >= last seen are marked 'pass' and update last_read_time.
 * Lines without a matching timestamp are marked 'no-match' and pass through.
 *
 * @param {Object} source - { log_time_pattern, log_time_format }
 * @param {string} logText - multi-line log text
 * @returns {Object} { lines, summary, errors }
 */
export function testLogTimeFilter(source, logText) {
  const src = source || {}
  const textLines = (logText || '').split('\n')
  const errors = []
  const resultLines = []

  if (!src.log_time_pattern) {
    errors.push('log_time_pattern이 설정되지 않았습니다')
    return {
      lines: textLines.map((text, i) => ({
        lineNum: i + 1, text, extracted: null, parsedTime: null,
        status: 'no-match', reason: '패턴 미설정'
      })),
      summary: { total: textLines.length, passed: 0, skipped: 0, noTimestamp: textLines.length },
      errors
    }
  }

  let patternRe
  try {
    patternRe = new RegExp(src.log_time_pattern)
  } catch (e) {
    errors.push(`log_time_pattern 정규식 오류: ${e.message}`)
    return {
      lines: textLines.map((text, i) => ({
        lineNum: i + 1, text, extracted: null, parsedTime: null,
        status: 'no-match', reason: '정규식 오류'
      })),
      summary: { total: textLines.length, passed: 0, skipped: 0, noTimestamp: textLines.length },
      errors
    }
  }

  // Use timestampFormatToRegex for parsing the extracted time string
  const tsParser = src.log_time_format ? timestampFormatToRegex(src.log_time_format) : null

  let lastReadTime = null
  let passed = 0
  let skipped = 0
  let noTimestamp = 0

  for (let i = 0; i < textLines.length; i++) {
    const text = textLines[i]
    const match = patternRe.exec(text)

    if (!match) {
      resultLines.push({
        lineNum: i + 1, text, extracted: null, parsedTime: null,
        status: 'no-match', reason: '패턴 미매칭 (통과)'
      })
      noTimestamp++
      continue
    }

    // Use first capture group if available, otherwise full match
    const extracted = match[1] || match[0]
    let parsedTime = null

    if (tsParser && tsParser.regex) {
      const tsMatch = extracted.match(tsParser.regex)
      if (tsMatch) {
        parsedTime = tsParser.parse(tsMatch)
      }
    }

    if (!parsedTime) {
      resultLines.push({
        lineNum: i + 1, text, extracted, parsedTime: null,
        status: 'no-match', reason: '시간 파싱 실패 (통과)'
      })
      noTimestamp++
      continue
    }

    if (lastReadTime && parsedTime.getTime() < lastReadTime.getTime()) {
      resultLines.push({
        lineNum: i + 1, text, extracted, parsedTime,
        status: 'skip', reason: `이전 시간 (${extracted}) < 마지막 읽은 시간`
      })
      skipped++
    } else {
      resultLines.push({
        lineNum: i + 1, text, extracted, parsedTime,
        status: 'pass', reason: parsedTime.getTime() === lastReadTime?.getTime()
          ? `같은 시간 (${extracted}) — 전송`
          : `새 시간 (${extracted}) — 전송 + 갱신`
      })
      lastReadTime = parsedTime
      passed++
    }
  }

  return {
    lines: resultLines,
    summary: { total: textLines.length, passed, skipped, noTimestamp },
    errors
  }
}


// ---------------------------------------------------------------------------
// 9. testLineGroup
// ---------------------------------------------------------------------------

/**
 * Tests line grouping on log text.
 * Groups lines into chunks of line_group_count, concatenated with <<EOL>>.
 * If line_group_pattern is set, only matching lines are grouped;
 * non-matching lines go to the ungrouped list.
 *
 * Only complete groups (buffer reaches line_group_count) are included in groups[].
 * If there's a leftover buffer, summary.incompleteGroup = true.
 *
 * @param {Object} source - { line_group_count, line_group_pattern }
 * @param {string} logText - multi-line log text
 * @returns {Object} { groups, ungrouped, summary, errors }
 */
export function testLineGroup(source, logText) {
  const src = source || {}
  const textLines = (logText || '').split('\n')
  const errors = []
  const groups = []
  const ungrouped = []

  const count = parseInt(src.line_group_count, 10) || 1

  let patternRe = null
  if (src.line_group_pattern) {
    try {
      // Java String.matches() uses full-string matching (implicit ^...$)
      const raw = src.line_group_pattern
      const anchored = (raw.startsWith('^') ? '' : '^') + raw + (raw.endsWith('$') ? '' : '$')
      patternRe = new RegExp(anchored)
    } catch (e) {
      errors.push(`line_group_pattern 정규식 오류: ${e.message}`)
      return {
        groups: [],
        ungrouped: [],
        summary: { totalLines: textLines.length, groupCount: 0, ungroupedCount: 0, incompleteGroup: false },
        errors
      }
    }
  }

  // Handle empty input (split('') produces [''])
  if (textLines.length === 1 && textLines[0] === '') {
    return {
      groups: [],
      ungrouped: [],
      summary: { totalLines: 1, groupCount: 0, ungroupedCount: 0, incompleteGroup: false },
      errors
    }
  }

  let buffer = []

  for (let i = 0; i < textLines.length; i++) {
    const text = textLines[i]
    const lineNum = i + 1
    const matched = patternRe ? patternRe.test(text) : true

    if (!matched) {
      ungrouped.push({ lineNum, text })
      continue
    }

    buffer.push({ lineNum, text })

    if (buffer.length >= count) {
      groups.push({
        groupNum: groups.length + 1,
        lines: [...buffer],
        groupedText: buffer.map(l => l.text).join('<<EOL>>')
      })
      buffer = []
    }
  }

  const incompleteGroup = buffer.length > 0

  return {
    groups,
    ungrouped,
    summary: {
      totalLines: textLines.length,
      groupCount: groups.length,
      ungroupedCount: ungrouped.length,
      incompleteGroup
    },
    errors
  }
}
