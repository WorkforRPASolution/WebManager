import { describe, it, expect } from 'vitest'
import { parseArgs, stringifyArgs } from './shellArgs'

describe('parseArgs', () => {
  it('빈 문자열 → 빈 배열', () => {
    expect(parseArgs('')).toEqual([])
    expect(parseArgs('   ')).toEqual([])
  })

  it('공백 없는 토큰들 → 그대로 split', () => {
    expect(parseArgs('/c start')).toEqual(['/c', 'start'])
    expect(parseArgs('/y /force')).toEqual(['/y', '/force'])
  })

  it('연속된 공백/탭 → 단일 구분자처럼 처리', () => {
    expect(parseArgs('  /a   /b  ')).toEqual(['/a', '/b'])
    expect(parseArgs('/a\t/b')).toEqual(['/a', '/b'])
  })

  it('"..." 로 둘러싼 구간은 내부 공백을 보존하여 한 토큰', () => {
    expect(parseArgs('/c "C:\\Program Files\\x" /q')).toEqual([
      '/c', 'C:\\Program Files\\x', '/q'
    ])
  })

  it('빈 따옴표 "" 는 빈 토큰으로 보존 (start 의 empty-title)', () => {
    expect(parseArgs('/c start "" /MIN')).toEqual(['/c', 'start', '', '/MIN'])
  })

  it('연속된 따옴표 토큰', () => {
    expect(parseArgs('"a b" "c d"')).toEqual(['a b', 'c d'])
  })

  it('닫히지 않은 여는 따옴표 → 문자열 끝까지를 한 토큰으로 흡수', () => {
    // 사용자 실수 방어: 잘못된 따옴표가 토큰을 잘게 쪼개지 않도록 함
    expect(parseArgs('"unclosed')).toEqual(['unclosed'])
    expect(parseArgs('a "b c')).toEqual(['a', 'b c'])
  })

  it('실제 BbEmUnlk 케이스', () => {
    expect(parseArgs('/c start "" /MIN "C:\\Program Files\\AhnLab\\EPS\\BbEmUnlk.exe" /min:30')).toEqual([
      '/c', 'start', '', '/MIN', 'C:\\Program Files\\AhnLab\\EPS\\BbEmUnlk.exe', '/min:30'
    ])
  })

  it('msiexec 케이스', () => {
    expect(parseArgs('/i "C:\\tmp\\patch.msi" /qn')).toEqual([
      '/i', 'C:\\tmp\\patch.msi', '/qn'
    ])
  })
})

describe('stringifyArgs', () => {
  it('빈 배열 → 빈 문자열', () => {
    expect(stringifyArgs([])).toBe('')
  })

  it('공백 없는 토큰만 → raw join', () => {
    expect(stringifyArgs(['/c', 'start'])).toBe('/c start')
  })

  it('빈 문자열 토큰은 ""로 감싸기', () => {
    expect(stringifyArgs(['/c', '', '/MIN'])).toBe('/c "" /MIN')
  })

  it('공백 포함 토큰은 ""로 감싸기', () => {
    expect(stringifyArgs(['/c', 'C:\\Program Files\\x'])).toBe('/c "C:\\Program Files\\x"')
  })

  it('탭 포함 토큰도 감싸기', () => {
    expect(stringifyArgs(['a\tb'])).toBe('"a\tb"')
  })

  it('실제 BbEmUnlk 케이스 (라운드트립 대비)', () => {
    expect(stringifyArgs([
      '/c', 'start', '', '/MIN', 'C:\\Program Files\\AhnLab\\EPS\\BbEmUnlk.exe', '/min:30'
    ])).toBe('/c start "" /MIN "C:\\Program Files\\AhnLab\\EPS\\BbEmUnlk.exe" /min:30')
  })
})

describe('round-trip', () => {
  // parse → stringify → parse 라운드트립이 보존되어야 함
  const cases = [
    [],
    ['/c', 'start'],
    ['/y', '/force'],
    ['/c', 'start', '', '/MIN'],
    ['/c', 'C:\\Program Files\\x', '/q'],
    ['/c', 'start', '', '/MIN', 'C:\\Program Files\\AhnLab\\EPS\\BbEmUnlk.exe', '/min:30'],
    ['msiexec', '/i', 'C:\\tmp\\patch with space.msi', '/qn']
  ]

  cases.forEach((arr, idx) => {
    it(`case ${idx}: parseArgs(stringifyArgs(arr)) === arr`, () => {
      expect(parseArgs(stringifyArgs(arr))).toEqual(arr)
    })
  })
})

describe('inverse round-trip (정규화)', () => {
  // stringify(parse(s)) 는 입력 문자열을 정규화 (공백 압축, 따옴표 정책 반영) 한 결과와 동일
  it('잉여 공백은 단일 공백으로 정규화', () => {
    expect(stringifyArgs(parseArgs('  /a   /b  '))).toBe('/a /b')
  })

  it('토큰 구조 유지', () => {
    const s = '/c start "" /MIN "C:\\Path With Space\\app.exe" /min:30'
    expect(stringifyArgs(parseArgs(s))).toBe(s)
  })
})
