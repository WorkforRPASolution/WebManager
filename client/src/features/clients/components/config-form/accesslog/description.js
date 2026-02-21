/**
 * accesslog/description.js
 *
 * Generates Korean descriptions for AccessLog configurations.
 */

import { decomposeLogType } from './schema'
import { parseDuration } from '../shared/formatUtils'

function getLogTypeDescription(logType) {
  const { dateAxis, lineAxis, postProc } = decomposeLogType(logType)
  const dateLabel = { normal: '일반', date: '날짜별', date_prefix: '날짜접두사', date_suffix: '날짜접미사' }[dateAxis] || dateAxis
  const lineLabel = lineAxis === 'multiline' ? '다중 라인' : '단일 라인'
  const procLabel = postProc === 'extract_append' ? ' + 추출-삽입' : ''
  return `${dateLabel} ${lineLabel}${procLabel}`
}

/**
 * Format a number with locale comma separators (e.g. 1000 → "1,000").
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
  if (num == null) return '0';
  return Number(num).toLocaleString('ko-KR');
}

/**
 * Build a glob-like file pattern string from AccessLog source fields.
 * @param {Object} source - AccessLog source configuration
 * @returns {string} glob-like pattern (e.g. "D:\EARS\Log\Log_yyyyMMdd*system*.txt")
 */
function buildFilePattern(source) {
  const dir = source.directory || ''
  let pattern = dir

  // Date subdir format
  if (source.date_subdir_format) {
    const sep = dir.includes('/') ? '/' : '\\'
    pattern += sep + '<' + source.date_subdir_format + '>'
  }

  // Separator before filename
  if (pattern && !pattern.endsWith('/') && !pattern.endsWith('\\')) {
    const sep = pattern.includes('/') ? '/' : '\\'
    pattern += sep
  }

  // Filename pattern: prefix + wildcard + suffix
  const prefix = source.prefix || ''
  const suffix = source.suffix || ''
  const wildcard = source.wildcard || ''

  if (prefix || suffix || wildcard) {
    pattern += prefix
    if (wildcard) {
      pattern += '*' + wildcard + '*'
      if (suffix) pattern += suffix
    } else {
      if (suffix) {
        pattern += '*' + suffix
      } else {
        pattern += '*'
      }
    }
  } else {
    pattern += '*'
  }

  return pattern
}

/**
 * Describe an AccessLog source object in Korean.
 * Produces a compact, user-friendly description.
 * @param {Object} source - AccessLog source configuration
 * @returns {string} Korean description
 */
function describeAccessLog(source) {
  const lines = [];

  // --- Line 1: Purpose tag ---
  if (source.name) {
    const isUpload = !source.name.match(/^__.*__$/)
    lines.push(isUpload ? '[Log Upload 용]' : '[Log Trigger 용]')
  }

  // --- Line 2: 감시 파일 — glob-like pattern ---
  let fileLine = '감시 파일: ' + buildFilePattern(source)

  // Exclude suffix
  if (source.exclude_suffix && source.exclude_suffix.length > 0) {
    fileLine += '  (제외: ' + source.exclude_suffix.join(', ') + ')'
  }

  lines.push(fileLine)

  // --- Line 3: 읽기 설정 — compact pipe-separated ---
  const readParts = []
  if (source.charset) readParts.push(source.charset)
  const interval = parseDuration(source.access_interval)
  if (interval) readParts.push(interval + ' 간격')
  else if (source.access_interval) readParts.push(source.access_interval + ' 간격')
  if (source.reopen) readParts.push('파일 재열기')
  // batch_count/batch_timeout: upload purpose only
  const isUpload = source.purpose === 'upload' || (source.name && !/^__.+__$/.test(source.name))
  if (isUpload && source.batch_count) readParts.push('배치 ' + formatNumber(source.batch_count) + '줄')
  if (isUpload && source.batch_timeout) {
    const bt = parseDuration(source.batch_timeout)
    if (bt) readParts.push('배치 타임아웃 ' + bt)
  }

  if (readParts.length > 0) {
    lines.push('읽기: ' + readParts.join(' | '))
  }

  // --- Line 4: 시작 동작 ---
  const startParts = []
  if (source.back === true) startParts.push('마지막 위치부터 이어 읽기')
  else if (source.back === false) startParts.push('처음부터 읽기')
  if (source.end === true) startParts.push('파일 끝부터 시작')

  if (startParts.length > 0) {
    lines.push('시작: ' + startParts.join(' | '))
  }

  // --- Blank line before advanced sections ---
  const hasMultiline = source.start_pattern || source.end_pattern || source.line_count
  const hasExtract = !!source.pathPattern
  const hasLogTime = !!source.log_time_pattern
  const hasLineGroup = source.line_group_count != null && source.line_group_count > 0
  if (hasMultiline || hasExtract || hasLogTime || hasLineGroup) {
    lines.push('')
  }

  // --- Line 5 (optional): 다중 라인 ---
  if (hasMultiline) {
    let mlText = '다중 라인: '

    // Block pattern description
    if (source.start_pattern && source.end_pattern) {
      mlText += `"${source.start_pattern}" ~ "${source.end_pattern}" 블록 수집`
    } else if (source.start_pattern) {
      mlText += `"${source.start_pattern}"부터 블록 수집`
    } else if (source.end_pattern) {
      mlText += `"${source.end_pattern}"까지 블록 수집`
    }

    // Count and priority
    if (source.line_count != null) {
      const priorityLabel = source.priority
        ? (source.priority === 'count' ? '라인 수' : '패턴') + ' 우선'
        : ''
      const countParts = [`최대 ${source.line_count}줄`]
      if (priorityLabel) countParts.push(priorityLabel)
      mlText += ' (' + countParts.join(', ') + ')'
    }

    lines.push(mlText)
  }

  // --- Line 6 (optional): 추출-삽입 ---
  if (hasExtract) {
    let eaText = `추출-삽입: "${source.pathPattern}"`
    if (source.appendFormat) {
      eaText += ` → "${source.appendFormat}"`
    }
    if (source.appendPos != null) {
      const posLabel = source.appendPos === 0 ? '로그 앞' : `위치: ${source.appendPos}`
      eaText += ` (${posLabel})`
    }
    lines.push(eaText)
  }

  // --- Log time filter ---
  if (hasLogTime) {
    let ltText = `시간 필터: "${source.log_time_pattern}"`
    if (source.log_time_format) {
      ltText += ` → ${source.log_time_format} (이전 시간 로그 스킵)`
    }
    lines.push(ltText)
  }

  // --- Line group ---
  if (hasLineGroup) {
    let lgText = `라인 그룹: ${source.line_group_count}줄 단위 (<<EOL>> 연결)`
    if (source.line_group_pattern) {
      lgText += `\n  대상: "${source.line_group_pattern}" 매칭 라인만`
    }
    lines.push(lgText)
  }

  return lines.join('\n');
}

export { describeAccessLog };
