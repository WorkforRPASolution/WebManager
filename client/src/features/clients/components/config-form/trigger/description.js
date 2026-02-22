/**
 * trigger/description.js
 *
 * Generates Korean descriptions for Trigger configurations.
 */

import { parseDuration } from '../shared/formatUtils'

const TRIGGER_TYPE_MAP = {
  regex: '정규식',
  delay: '지연(취소)',
};

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

  // --- MULTI class description ---
  if (trigger.class === 'MULTI') {
    lines.push('  [MULTI] 다중 인스턴스 추적: step_01 캡처값별 독립 체인')
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
      } else if (step.next === '@suspend') {
        const items = step.suspend
        if (!items || items.length === 0) {
          nextText = '모든 트리거 실행 제한'
        } else {
          const details = items.map(item => {
            const dur = parseDuration(item.duration)
            return dur ? `${item.name}(${dur})` : item.name
          }).join(', ')
          nextText = `트리거 실행 제한: ${details}`
        }
      } else if (step.next === '@resume') {
        const items = step.resume
        if (!items || items.length === 0) {
          nextText = '모든 트리거 실행 제한 해제'
        } else {
          const details = items.map(item => item.name).join(', ')
          nextText = `트리거 실행 제한 해제: ${details}`
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

export { describeTrigger };
