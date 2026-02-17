/**
 * configDescription.js
 *
 * Generates Korean descriptions for AccessLog and Trigger config entries.
 */

const LOG_TYPE_MAP = {
  normal_single: '일반 단일 라인',
  date_single: '날짜별 단일 라인',
  date_prefix_single: '날짜접두사 단일 라인',
  normal_single_extract_append: '일반 단일 라인 + 추출-삽입',
  date_single_extract_append: '날짜별 단일 라인 + 추출-삽입',
  date_prefix_single_extract_append: '날짜접두사 단일 라인 + 추출-삽입',
  normal_multiline: '일반 다중 라인',
  date_multiline: '날짜별 다중 라인',
  normal_multiline_extract_append: '일반 다중 라인 + 추출-삽입',
  date_multiline_extract_append: '날짜별 다중 라인 + 추출-삽입',
};

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
  const hasMultiline = source.startPattern || source.endPattern || source.count
  const hasExtract = !!source.extractPattern
  if (hasMultiline || hasExtract) {
    lines.push('')
  }

  // --- Line 5 (optional): 다중 라인 ---
  if (hasMultiline) {
    let mlText = '다중 라인: '

    // Block pattern description
    if (source.startPattern && source.endPattern) {
      mlText += `"${source.startPattern}" ~ "${source.endPattern}" 블록 수집`
    } else if (source.startPattern) {
      mlText += `"${source.startPattern}"부터 블록 수집`
    } else if (source.endPattern) {
      mlText += `"${source.endPattern}"까지 블록 수집`
    }

    // Count and priority
    if (source.count != null) {
      const priorityLabel = source.priority
        ? (source.priority === 'count' ? '라인 수' : '패턴') + ' 우선'
        : ''
      const countParts = [`최대 ${source.count}줄`]
      if (priorityLabel) countParts.push(priorityLabel)
      mlText += ' (' + countParts.join(', ') + ')'
    }

    lines.push(mlText)
  }

  // --- Line 6 (optional): 추출-삽입 ---
  if (hasExtract) {
    let eaText = `추출-삽입: "${source.extractPattern}"`
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

      // Pattern text
      let patternText = '';
      if (step.trigger && step.trigger.length > 0) {
        const patterns = step.trigger.map(getTriggerPattern);
        if (patterns.length === 1) {
          patternText = `"${patterns[0]}"`;
        } else if (patterns.length <= 3) {
          patternText = patterns.map(p => `"${p}"`).join(', ');
        } else {
          patternText = patterns.slice(0, 2).map(p => `"${p}"`).join(', ') + ` 외 ${patterns.length - 2}개`;
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
        nextText = '스크립트 실행'
      } else if (step.next === '@recovery') {
        nextText = '복구 실행'
      } else if (step.next === '@notify') {
        nextText = '알림 전송'
      } else if (step.next === '@popup') {
        nextText = '팝업 표시'
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
