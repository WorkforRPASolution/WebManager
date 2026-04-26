import { describe, it, expect } from 'vitest'
import { parseClipboardText } from '../useDataGridCellSelection'

describe('parseClipboardText', () => {
  it('returns [] for empty input', () => {
    expect(parseClipboardText('')).toEqual([])
    expect(parseClipboardText(null)).toEqual([])
    expect(parseClipboardText(undefined)).toEqual([])
  })

  it('parses single value with no separators', () => {
    expect(parseClipboardText('hello')).toEqual([['hello']])
  })

  it('parses single column vertical copy (LF)', () => {
    expect(parseClipboardText('a\nb\nc')).toEqual([['a'], ['b'], ['c']])
  })

  it('parses single column vertical copy (CRLF, Windows Excel)', () => {
    expect(parseClipboardText('a\r\nb\r\nc')).toEqual([['a'], ['b'], ['c']])
  })

  it('strips trailing newline added by Excel', () => {
    expect(parseClipboardText('a\nb\nc\n')).toEqual([['a'], ['b'], ['c']])
    expect(parseClipboardText('a\r\nb\r\nc\r\n')).toEqual([['a'], ['b'], ['c']])
  })

  it('strips multiple trailing newlines', () => {
    expect(parseClipboardText('a\nb\n\n\n')).toEqual([['a'], ['b']])
  })

  it('preserves middle empty rows in vertical copy', () => {
    // 엑셀에서 1~10 행 복사, 3~7 행이 빈값인 케이스
    const clipboard = '1\r\n2\r\n\r\n\r\n\r\n\r\n\r\n8\r\n9\r\n10'
    expect(parseClipboardText(clipboard)).toEqual([
      ['1'], ['2'], [''], [''], [''], [''], [''], ['8'], ['9'], ['10']
    ])
  })

  it('preserves middle empty rows even with trailing newline', () => {
    const clipboard = '1\r\n2\r\n\r\n\r\n\r\n\r\n\r\n8\r\n9\r\n10\r\n'
    const result = parseClipboardText(clipboard)
    expect(result).toHaveLength(10)
    expect(result[2]).toEqual([''])
    expect(result[6]).toEqual([''])
    expect(result[7]).toEqual(['8'])
    expect(result[9]).toEqual(['10'])
  })

  it('parses tab-delimited multi-column paste', () => {
    expect(parseClipboardText('a\tb\tc\nd\te\tf')).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f']
    ])
  })

  it('preserves middle empty rows in tab-delimited paste', () => {
    const clipboard = 'a\tb\r\n\r\nc\td'
    expect(parseClipboardText(clipboard)).toEqual([
      ['a', 'b'],
      [''],
      ['c', 'd']
    ])
  })

  it('preserves empty cells within a tab-delimited row', () => {
    expect(parseClipboardText('a\t\tc')).toEqual([['a', '', 'c']])
  })

  it('handles bare CR line endings (legacy Mac)', () => {
    expect(parseClipboardText('a\rb\rc')).toEqual([['a'], ['b'], ['c']])
  })
})
