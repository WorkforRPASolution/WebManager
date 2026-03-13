/**
 * Email Templates — centralized email template builders
 *
 * 기능별 builder 함수 추가 시 이 파일에 export만 추가.
 */

function _wrapLayout(bodyHtml) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
    <p style="color:#6b7280;font-size:12px;">본 메일은 WebManager 시스템에서 자동 발송되었습니다.</p>
  </div>`
}

function buildTempPasswordEmail(singleid, tempPassword) {
  return _wrapLayout(`
    <h2 style="color:#1f2937;margin:0 0 16px;">비밀번호 초기화 안내</h2>
    <p style="color:#374151;margin:0 0 12px;">
      <strong>${singleid}</strong> 님의 비밀번호가 초기화되었습니다.
    </p>
    <div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin:0 0 12px;">
      <p style="color:#92400e;margin:0 0 4px;font-size:13px;">임시 비밀번호</p>
      <p style="color:#92400e;margin:0;font-size:20px;font-family:monospace;letter-spacing:2px;font-weight:bold;">
        ${tempPassword}
      </p>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:0;">
      로그인 후 반드시 비밀번호를 변경해주세요.
    </p>`)
}

// TODO [Phase 2] 장기 미접속자 알림 템플릿
// function buildInactiveUserEmail(singleid, lastLoginAt, daysSince) {
//   return _wrapLayout(`...`)
// }

module.exports = { buildTempPasswordEmail }
