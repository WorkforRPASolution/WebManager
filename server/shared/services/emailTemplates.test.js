/**
 * emailTemplates — tests (TDD)
 */

import { describe, it, expect } from 'vitest'
import { buildTempPasswordEmail, buildVerificationCodeEmail } from './emailTemplates.js'

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
