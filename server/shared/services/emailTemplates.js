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

function buildVerificationCodeEmail(code, expiresMinutes) {
  return _wrapLayout(`
    <h2 style="color:#1f2937;margin:0 0 16px;">인증 코드 안내</h2>
    <p style="color:#374151;margin:0 0 12px;">
      비밀번호 초기화를 위한 인증 코드입니다.
    </p>
    <div style="background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:16px;margin:0 0 12px;">
      <p style="color:#1e40af;margin:0 0 4px;font-size:13px;">인증 코드</p>
      <p style="color:#1e40af;margin:0;font-size:28px;font-family:monospace;letter-spacing:4px;font-weight:bold;">
        ${code}
      </p>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:0;">
      이 코드는 ${expiresMinutes}분 후 만료됩니다. 본인이 요청하지 않았다면 이 메일을 무시해주세요.
    </p>`)
}

function buildSignupNotificationEmail(userName, userId, department, processes) {
  const processStr = Array.isArray(processes) ? processes.join(', ') : processes
  const deptRow = department
    ? `<tr><td style="color:#6b7280;padding:4px 12px 4px 0;">부서</td><td style="color:#1f2937;padding:4px 0;">${department}</td></tr>`
    : ''

  return _wrapLayout(`
    <h2 style="color:#1f2937;margin:0 0 16px;">신규 가입 요청</h2>
    <p style="color:#374151;margin:0 0 12px;">
      새로운 사용자가 가입을 요청했습니다. User Management 페이지에서 승인해주세요.
    </p>
    <table style="border-collapse:collapse;margin:0 0 16px;">
      <tr><td style="color:#6b7280;padding:4px 12px 4px 0;">이름</td><td style="color:#1f2937;padding:4px 0;font-weight:bold;">${userName}</td></tr>
      <tr><td style="color:#6b7280;padding:4px 12px 4px 0;">User ID</td><td style="color:#1f2937;padding:4px 0;font-family:monospace;">${userId}</td></tr>
      ${deptRow}
      <tr><td style="color:#6b7280;padding:4px 12px 4px 0;">Process</td><td style="color:#1f2937;padding:4px 0;">${processStr}</td></tr>
    </table>`)
}

module.exports = { buildTempPasswordEmail, buildVerificationCodeEmail, buildSignupNotificationEmail }
