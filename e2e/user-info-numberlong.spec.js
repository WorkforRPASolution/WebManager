/**
 * ARS_USER_INFO NumberLong + null 제거 E2E 검증
 *
 * T1: 회원가입 API → authorityManager/accessnum NumberLong + passwordResetRequestedAt 부재
 * T2: 사용자 수정 API → authorityManager NumberLong 유지
 * T3: 비밀번호 리셋 요청 → passwordResetRequestedAt Date 생성
 * T4: 비밀번호 리셋 승인 → passwordResetRequestedAt $unset (필드 제거)
 */

import { test, expect } from '@playwright/test'

const API = 'http://localhost:3000'
const TEST_SINGLEID = 'e2e_long_test_user'

async function getAuthHeader(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'admin', password: 'admin' }
  })
  const body = await res.json()
  return { Authorization: `Bearer ${body.token}` }
}

async function findTestUser(request, headers) {
  const res = await request.get(`${API}/api/users`, {
    headers,
    params: { search: TEST_SINGLEID }
  })
  const body = await res.json()
  return (body.data || []).find(u => u.singleid === TEST_SINGLEID)
}

async function cleanup(request, headers) {
  const user = await findTestUser(request, headers)
  if (user) {
    await request.delete(`${API}/api/users`, {
      headers,
      data: { ids: [user._id] }
    })
  }
}

test.describe('ARS_USER_INFO NumberLong + null 제거', () => {
  let headers

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeader(request)
    await cleanup(request, headers)
  })

  test.afterAll(async ({ request }) => {
    if (!headers) headers = await getAuthHeader(request)
    await cleanup(request, headers)
  })

  test('T1: 사용자 생성 → NumberLong + null 필드 부재', async ({ request }) => {
    // Admin이 사용자 직접 생성
    const createRes = await request.post(`${API}/api/users`, {
      headers,
      data: {
        users: [{
          name: 'E2E Test',
          singleid: TEST_SINGLEID,
          password: 'TestPass123',
          line: 'L01',
          process: 'TEST',
          processes: ['TEST'],
          authorityManager: 0,
          authority: ''
        }]
      }
    })
    const createBody = await createRes.json()
    expect(createBody.created).toBe(1)

    // 검증
    const user = await findTestUser(request, headers)
    expect(user).toBeTruthy()

    // 값 검증 (promoteLongs로 JS number 반환)
    expect(user.authorityManager).toBe(0)

    // null 필드 부재 (lean 응답에서 undefined = DB 필드 없음)
    expect(user).not.toHaveProperty('passwordResetRequestedAt')
  })

  test('T2: 사용자 수정 → authorityManager NumberLong 유지', async ({ request }) => {
    const user = await findTestUser(request, headers)
    expect(user).toBeTruthy()

    // authorityManager 변경 (0 → 3)
    const updateRes = await request.put(`${API}/api/users`, {
      headers,
      data: {
        users: [{ _id: user._id, authorityManager: 3, note: 'updated by e2e' }]
      }
    })
    const updateBody = await updateRes.json()
    expect(updateBody.updated).toBe(1)

    // 검증
    const updated = await findTestUser(request, headers)
    expect(updated.authorityManager).toBe(3)
    expect(updated.note).toBe('updated by e2e')

    // null 필드 여전히 부재
    expect(updated).not.toHaveProperty('passwordResetRequestedAt')
  })

  test('T3: 비밀번호 리셋 요청 → passwordResetRequestedAt 생성', async ({ request }) => {
    // 비밀번호 리셋 요청
    const resetRes = await request.post(`${API}/api/auth/request-password-reset`, {
      headers,
      data: { singleid: TEST_SINGLEID }
    })
    const resetBody = await resetRes.json()
    expect(resetBody.success).toBe(true)

    // 검증: passwordResetRequestedAt이 Date로 생성됨
    const user = await findTestUser(request, headers)
    expect(user).toBeTruthy()
    expect(user.passwordResetRequestedAt).toBeTruthy()
    expect(user.passwordStatus).toBe('reset_requested')
  })

  test('T4: 비밀번호 리셋 승인 → passwordResetRequestedAt 제거', async ({ request }) => {
    const user = await findTestUser(request, headers)
    expect(user).toBeTruthy()
    expect(user.passwordResetRequestedAt).toBeTruthy()

    // Admin이 비밀번호 리셋 승인 (임시 비밀번호 발급)
    const approveRes = await request.put(`${API}/api/users/${user._id}/approve-reset`, {
      headers
    })
    const approveBody = await approveRes.json()
    expect(approveBody.success).toBe(true)

    // 검증: passwordResetRequestedAt이 $unset으로 제거됨
    const updated = await findTestUser(request, headers)
    expect(updated).toBeTruthy()
    expect(updated).not.toHaveProperty('passwordResetRequestedAt')
    expect(updated.passwordStatus).toBe('must_change')
  })
})
