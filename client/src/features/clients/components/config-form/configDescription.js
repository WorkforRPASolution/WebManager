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
 * Describe an AccessLog source object in Korean.
 * @param {Object} source - AccessLog source configuration
 * @returns {string} Korean description
 */
function describeAccessLog(source) {
  const lines = [];

  // --- Purpose tag ---
  if (source.name) {
    const isUpload = !source.name.match(/^__.*__$/)
    lines.push(isUpload ? '[Log Upload 용]' : '[Log Trigger 용]')
  }

  // --- Line 1: directory + file pattern ---
  const dir = source.directory || '';
  let patternParts = [];

  if (source.prefix) {
    patternParts.push(`"${source.prefix}"로 시작하고`);
  }
  if (source.suffix) {
    patternParts.push(`"${source.suffix}"로 끝나는`);
  }

  let wildcardNote = '';
  if (source.wildcard) {
    wildcardNote = ` (와일드카드: "${source.wildcard}")`;
  }

  let fileDesc;
  if (patternParts.length > 0) {
    fileDesc = `${patternParts.join(' ')} 파일을${wildcardNote}`;
  } else {
    fileDesc = `모든 파일을${wildcardNote}`;
  }

  lines.push(`${dir} 디렉토리에서 ${fileDesc}`);

  // --- Line 2: log type ---
  const logTypeLabel = LOG_TYPE_MAP[source.log_type] || source.log_type || '알 수 없는 방식';
  let logTypeLine = `${logTypeLabel}(${source.log_type}) 방식으로 감시합니다.`;

  if (source.date_subdir_format) {
    logTypeLine += ` (날짜 하위 디렉토리: ${source.date_subdir_format})`;
  }

  lines.push(logTypeLine);

  // --- Line 3: reading settings ---
  const charset = source.charset || 'UTF-8';
  const intervalKorean = parseDuration(source.access_interval);
  const intervalText = intervalKorean || source.access_interval || '?';
  const batchCount = formatNumber(source.batch_count);

  lines.push(`${charset} 인코딩, ${intervalText} 간격으로 최대 ${batchCount}줄씩 읽습니다.`);

  // --- Line 4: behavior options ---
  const behaviors = [];

  if (source.back === true) {
    behaviors.push('재시작 시 마지막 위치부터 이어 읽습니다.');
  } else if (source.back === false) {
    behaviors.push('재시작 시 처음부터 다시 읽습니다.');
  }

  if (source.end === true) {
    behaviors.push('최초 접근 시 파일 끝부터 읽기 시작합니다.');
  }

  if (source.reopen === true) {
    behaviors.push('매 주기마다 파일을 다시 엽니다.');
  }

  if (behaviors.length > 0) {
    let behaviorLine = behaviors.join(' ');

    // Exclude suffix
    if (source.exclude_suffix && source.exclude_suffix.length > 0) {
      behaviorLine += ` (${source.exclude_suffix.join(', ')} 파일은 제외)`;
    }

    lines.push(behaviorLine);
  } else if (source.exclude_suffix && source.exclude_suffix.length > 0) {
    lines.push(`(${source.exclude_suffix.join(', ')} 파일은 제외)`);
  }

  // --- Multiline settings ---
  if (source.startPattern || source.endPattern || source.count) {
    const mlParts = []
    if (source.startPattern) mlParts.push(`시작: "${source.startPattern}"`)
    if (source.endPattern) mlParts.push(`종료: "${source.endPattern}"`)
    if (source.count != null) mlParts.push(`수집 라인: ${source.count}줄`)
    if (source.priority) mlParts.push(`우선순위: ${source.priority === 'count' ? '라인 수' : '패턴'}`)
    lines.push(`멀티라인 설정: ${mlParts.join(', ')}`)
  }

  // --- Extract-append settings ---
  if (source.extractPattern) {
    const eaParts = [`추출: "${source.extractPattern}"`]
    if (source.appendFormat) eaParts.push(`포맷: "${source.appendFormat}"`)
    if (source.appendPos != null) eaParts.push(`위치: ${source.appendPos === 0 ? '로그 앞' : source.appendPos}`)
    lines.push(`추출-삽입 설정: ${eaParts.join(', ')}`)
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
