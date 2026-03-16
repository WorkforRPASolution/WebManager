/**
 * emailTemplates — tests (TDD)
 */

import { describe, it, expect } from 'vitest'
import { buildTempPasswordEmail, buildVerificationCodeEmail, buildSignupNotificationEmail } from './emailTemplates.js'

describe('buildTempPasswordEmail', () => {
  const result = buildTempPasswordEmail('testuser', 'Abc12345')

  it('출력에 singleid 포함', () => {
    expect(result).toContain('testuser')
  })

  it('출력에 tempPassword 포함', () => {
    expect(result).toContain('Abc12345')
  })

  it('공용 레이아웃 푸터 포함', () => {
    expect(result).toContain('WebManager 시스템에서 자동 발송')
  })

  it('미치환 템플릿 변수 없음', () => {
    expect(result).not.toContain('${')
  })

  it('HTML 태그 포함 (이메일 본문)', () => {
    expect(result).toContain('<div')
  })
})

describe('buildSignupNotificationEmail', () => {
  it('HTML에 사용자 정보 포함', () => {
    const html = buildSignupNotificationEmail('홍길동', 'hong', 'Engineering', ['CVD', 'ETCH'])

    expect(html).toContain('홍길동')
    expect(html).toContain('hong')
    expect(html).toContain('Engineering')
    expect(html).toContain('CVD')
    expect(html).toContain('ETCH')
  })

  it('User Management 승인 안내 포함', () => {
    const html = buildSignupNotificationEmail('홍길동', 'hong', '', ['CVD'])

    expect(html).toContain('User Management')
    expect(html).toContain('승인')
  })

  it('department 미입력 시에도 정상 생성', () => {
    const html = buildSignupNotificationEmail('홍길동', 'hong', '', ['CVD'])

    expect(html).toContain('홍길동')
    expect(html).toBeTruthy()
  })

  it('_wrapLayout 래핑 포함 (자동 발송 문구)', () => {
    const html = buildSignupNotificationEmail('홍길동', 'hong', '', ['CVD'])

    expect(html).toContain('자동 발송')
  })
})

describe('buildVerificationCodeEmail', () => {
  const result = buildVerificationCodeEmail('123456', 5)

  it('출력에 인증 코드 + 만료 시간 포함', () => {
    expect(result).toContain('123456')
    expect(result).toContain('5분')
  })

  it('공용 레이아웃 푸터 포함', () => {
    expect(result).toContain('WebManager 시스템에서 자동 발송')
  })
})
