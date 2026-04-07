import { describe, it, expect } from 'vitest'
import iconv from 'iconv-lite'
import { decodeBuffer } from './decodeBuffer.js'

describe('decodeBuffer', () => {
  it('UTF-8 텍스트를 정상 디코딩한다', () => {
    const buf = Buffer.from('hello 안녕하세요', 'utf-8')
    expect(decodeBuffer(buf, 'utf-8')).toBe('hello 안녕하세요')
  })

  it('encoding 생략 시 UTF-8 기본값을 사용한다', () => {
    const buf = Buffer.from('test', 'utf-8')
    expect(decodeBuffer(buf)).toBe('test')
  })

  it('EUC-KR 버퍼를 euc-kr 인코딩으로 정상 디코딩한다', () => {
    const buf = iconv.encode('자기소개 - 테스트', 'euc-kr')
    expect(decodeBuffer(buf, 'euc-kr')).toBe('자기소개 - 테스트')
  })

  it('EUC-KR 버퍼를 UTF-8로 읽으면 자동 폴백하여 한글을 복원한다', () => {
    const korean = '자기소개 - 테스트'
    const buf = iconv.encode(korean, 'euc-kr')
    const result = decodeBuffer(buf, 'utf-8')
    expect(result).toBe(korean)
    expect(result).not.toContain('\uFFFD')
  })

  it('CP949 버퍼를 UTF-8로 읽으면 자동 폴백하여 한글을 복원한다', () => {
    const korean = '똠방각하'
    const buf = iconv.encode(korean, 'cp949')
    const result = decodeBuffer(buf, 'utf-8')
    expect(result).toBe(korean)
  })

  it('encoding 없이 EUC-KR 버퍼를 전달하면 자동 폴백한다', () => {
    const korean = '한글 로그 메시지'
    const buf = iconv.encode(korean, 'euc-kr')
    const result = decodeBuffer(buf)
    expect(result).toBe(korean)
  })

  it('ASCII 전용 텍스트는 폴백 없이 정상 반환한다', () => {
    const buf = Buffer.from('plain ascii text', 'utf-8')
    expect(decodeBuffer(buf, 'utf-8')).toBe('plain ascii text')
  })

  it('latin1 인코딩은 폴백 없이 그대로 반환한다', () => {
    const buf = Buffer.from([0xC0, 0xE9, 0xF1])
    const result = decodeBuffer(buf, 'latin1')
    expect(result).toBe(buf.toString('latin1'))
  })

  it('알 수 없는 인코딩은 UTF-8 폴백 후 필요 시 한글 자동 감지한다', () => {
    const korean = '테스트 로그'
    const buf = iconv.encode(korean, 'euc-kr')
    const result = decodeBuffer(buf, 'unknown-encoding-xyz')
    expect(result).toBe(korean)
  })

  it('실제 깨짐 패턴: JSON 로그 안의 한글이 복원된다', () => {
    const json = '{"@UserInfo":"자기소개 - ","__priority__":10,"ALTXT":"default"}'
    const buf = iconv.encode(json, 'euc-kr')
    const result = decodeBuffer(buf, 'utf-8')
    expect(result).toContain('자기소개')
    expect(result).not.toContain('\uFFFD')
  })
})
