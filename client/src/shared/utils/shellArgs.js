// Shell-style 인자 토큰화/직렬화 유틸 (큰따옴표만 지원).
//
// UpdateSettingsModal exec 태스크의 Args 입력에서 공백 포함 인자를
// `"..."` 로 감싸 한 토큰으로 전달할 수 있게 한다. parseArgs ↔ stringifyArgs
// 는 라운드트립 보존되도록 짝지어져 있다.
//
// 정책:
// - 토큰 구분자: 공백/탭 (\s+)
// - 큰따옴표로 둘러싼 구간은 내부 공백을 보존하여 한 토큰
// - 빈 따옴표 "" 는 빈 토큰으로 보존 (예: `start ""` 의 empty-title)
// - 닫히지 않은 여는 따옴표는 문자열 끝까지를 한 토큰으로 흡수
//   (사용자 실수가 토큰을 잘게 쪼개지 않도록 함)
// - 작은따옴표 / 백슬래시 이스케이프는 비지원 (Windows cmd 규칙과 일치)

export function parseArgs(s) {
  if (!s) return []
  const out = []
  // 우선순위: 닫힌 따옴표 > 닫히지 않은 끝까지 따옴표 > 일반 토큰
  const re = /"([^"]*)"|"([^"]*)$|(\S+)/g
  let m
  while ((m = re.exec(s)) !== null) {
    if (m[1] !== undefined) out.push(m[1])
    else if (m[2] !== undefined) out.push(m[2])
    else out.push(m[3])
  }
  return out
}

export function stringifyArgs(arr) {
  return arr.map(t => (t === '' || /\s/.test(t)) ? `"${t}"` : t).join(' ')
}
