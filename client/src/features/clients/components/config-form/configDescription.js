/**
 * configDescription.js
 *
 * Generates Korean descriptions for AccessLog and Trigger config entries.
 */

import { decomposeLogType } from './configSchemas'

function getLogTypeDescription(logType) {
  const { dateAxis, lineAxis, postProc } = decomposeLogType(logType)
  const dateLabel = { normal: '일반', date: '날짜별', date_prefix: '날짜접두사', date_suffix: '날짜접미사' }[dateAxis] || dateAxis
  const lineLabel = lineAxis === 'multiline' ? '다중 라인' : '단일 라인'
  const procLabel = postProc === 'extract_append' ? ' + 추출-삽입' : ''
  return `${dateLabel} ${lineLabel}${procLabel}`
}

const TRIGGER_TYPE_MAP = {
  regex: '정규식',
  delay: '지연(취소)',
};

/**
 * Parse a duration string like "10 seconds" or "1 minutes" into Korean.
 * @param {string} str - Duration string (e.g. "10 seconds", "1 minutes")
 * @returns {string|null} Korean duration string or null if empty
 */
function parseDuration(str) {
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
  if (hasMultiline || hasExtract) {
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

  return lines.join('\n');
}

/**
 * Extract the pattern text from a trigger item.
 * Trigger items can be objects with { syntax } or plain strings.
 * @param {Object|string} item
 * @returns {string}
 */
function getTriggerPattern(item) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && item.syntax != null) return item.syntax;
  return String(item);
}

/**
 * Describe params conditions for a trigger item in Korean.
 * @param {Object|string} item - trigger item (may have params field)
 * @returns {string} Korean description of params conditions, or empty string
 */
function describeParamsCondition(item) {
  if (!item || typeof item !== 'object' || !item.params) return '';
  const match = item.params.match(/^ParamComparisionMatcher(\d+)@(.+)$/);
  if (!match) return '';
  const OP_MAP = { eq: '같음', neq: '다름', gt: '초과', gte: '이상', lt: '미만', lte: '이하' };
  const conditions = match[2].split(';').map(c => {
    const m = c.match(/^([\d.]+),(EQ|NEQ|GT|GTE|LT|LTE),(\w+)$/i);
    if (!m) return null;
    return `${m[3]} ${m[1]} ${OP_MAP[m[2].toLowerCase()] || m[2]}`;
  }).filter(Boolean);
  if (conditions.length === 0) return '';
  return `[조건: ${conditions.join(', ')}]`;
}

/**
 * Describe a Trigger object in Korean.
 * @param {Object} trigger - Trigger configuration
 * @returns {string} Korean description
 */
function describeTrigger(trigger) {
  const lines = [];

  // --- Line 1: source (may be comma-separated) ---
  const sources = (trigger.source || '').split(',').map(s => s.trim()).filter(Boolean)
  if (sources.length > 1) {
    lines.push(`${sources.length}개 로그 소스를 감시합니다: ${sources.join(', ')}`)
  } else {
    lines.push(`"${trigger.source || ''}" 로그 소스를 감시합니다.`)
  }

  // --- Recipe steps ---
  if (trigger.recipe && trigger.recipe.length > 0) {
    trigger.recipe.forEach((step, index) => {
      const stepNum = index + 1;
      const typeLabel = TRIGGER_TYPE_MAP[step.type] || step.type || '알 수 없는';

      // Pattern text (with params conditions)
      let patternText = '';
      if (step.trigger && step.trigger.length > 0) {
        const patternsWithParams = step.trigger.map(item => {
          const pat = getTriggerPattern(item);
          const paramDesc = describeParamsCondition(item);
          return paramDesc ? `"${pat}" ${paramDesc}` : `"${pat}"`;
        });
        if (patternsWithParams.length === 1) {
          patternText = patternsWithParams[0];
        } else if (patternsWithParams.length <= 3) {
          patternText = patternsWithParams.join(', ');
        } else {
          patternText = patternsWithParams.slice(0, 2).join(', ') + ` 외 ${patternsWithParams.length - 2}개`;
        }
      }

      // Duration + times condition
      const durationKorean = parseDuration(step.duration);
      const times = step.times || 1;
      let conditionText;
      if (durationKorean) {
        conditionText = `${durationKorean} 내 ${times}회 매칭되면`;
      } else {
        conditionText = `${times}회 매칭되면`;
      }

      // Next action
      let nextText;
      if (step.type === 'delay') {
        nextText = '체인 리셋'
      } else if (step.next === '@script' && step.script) {
        nextText = `${step.script.name} 실행`;

        const details = [];
        if (step.script.arg) {
          details.push(`인자: ${step.script.arg}`);
        }
        if (step.script.timeout) {
          const timeoutKorean = parseDuration(step.script.timeout);
          details.push(`타임아웃: ${timeoutKorean || step.script.timeout}`);
        }

        if (details.length > 0) {
          const padding = `  ${''.padStart(`Step ${stepNum}: `.length)}`;
          nextText += `\n${padding}(${details.join(', ')})`;
        }
      } else if (step.next === '@script' || step.next === '@Script') {
        nextText = '코드 기반 시나리오 실행'
      } else if (step.next === '@recovery') {
        nextText = '시나리오 실행'
      } else if (step.next === '@notify') {
        nextText = '메일 발송'
      } else if (step.next === '@popup') {
        nextText = 'PopUp 실행'
        // Show detail.no-email if present
        if (step.detail && step.detail['no-email']) {
          nextText += ` (no-email: ${step.detail['no-email']})`
        }
      } else if (step.next) {
        nextText = `${step.next}로 이동`;
      } else {
        nextText = '체인 종료';
      }

      lines.push(`  Step ${stepNum}: ${typeLabel} ${patternText} 패턴이 ${conditionText} → ${nextText}`);
    });
  }

  // --- Limitation ---
  if (trigger.limitation) {
    const limDuration = parseDuration(trigger.limitation.duration);
    const limTimes = trigger.limitation.times || 1;

    if (limDuration) {
      lines.push(`  제한: ${limDuration} 내 최대 ${limTimes}회만 발동`);
    } else {
      lines.push(`  제한: 최대 ${limTimes}회만 발동`);
    }
  }

  return lines.join('\n');
}

export { describeAccessLog, describeTrigger };
