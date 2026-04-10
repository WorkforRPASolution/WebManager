/**
 * User Management — 비밀번호 없이 사용자 생성 E2E 검증
 *
 * T1: API로 비밀번호 없이 사용자 생성 → accountStatus/passwordStatus/password 필드 부재
 * T2: 비밀번호 없는 사용자 로그인 시도 → NO_PASSWORD 에러
 * T3: Sign Up ID 중복 체크 — 비밀번호 없는 사용자 → 안내 메시지
 * T4: Sign Up ID 중복 체크 — 비밀번호 있는 사용자 → 기존 메시지
 * T5: 정리 (삭제)
 */

import { test, expect } from '@playwright/test'

const API = 'http://localhost:3000'
const TEST_SINGLEID = 'e2e_nopw_user_001'

async function getAuthHeader(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'admin', password: 'admin' }
  })
  const body = await res.json()
  return { Authorization: `Bearer ${body.token}` }
}

async function cleanup(request, headers) {
  const listRes = await request.get(`${API}/api/users`, {
    headers,
    params: { search: TEST_SINGLEID, pageSize: 50 }
  })
  const list = await listRes.json()
  const ids = (list.data || []).filter(d => d.singleid === TEST_SINGLEID).map(d => d._id)
  if (ids.length > 0) {
    await request.delete(`${API}/api/users`, {
      headers,
      data: { ids }
    })
  }
}

test.describe('User Management — 비밀번호 없이 사용자 생성', () => {
  let headers

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeader(request)
    await cleanup(request, headers)
  })

  test.afterAll(async ({ request }) => {
    if (!headers) headers = await getAuthHeader(request)
    await cleanup(request, headers)
  })

  test('T1: 비밀번호 없이 사용자 생성 → accountStatus/passwordStatus/password 필드 부재', async ({ request }) => {
    const createRes = await request.post(`${API}/api/users`, {
      headers,
      data: {
        users: [{
          name: 'E2E NoPW User',
          singleid: TEST_SINGLEID,
          line: 'L01',
          processes: ['TEST'],
          authorityManager: 0,
          authority: ''
        }]
      }
    })
    const body = await createRes.json()
    expect(createRes.ok()).toBeTruthy()
    expect(body.created).toBe(1)

    // 생성된 문서 확인
    const listRes = await request.get(`${API}/api/users`, {
      headers,
      params: { search: TEST_SINGLEID, pageSize: 50 }
    })
    const doc = (await listRes.json()).data.find(d => d.singleid === TEST_SINGLEID)
    expect(doc).toBeTruthy()
    expect(doc.name).toBe('E2E NoPW User')

    // 핵심: password, accountStatus, passwordStatus 필드 부재
    expect(doc).not.toHaveProperty('password')  // API에서 password 제외할 수 있음
    expect(doc).not.toHaveProperty('accountStatus')
    expect(doc).not.toHaveProperty('passwordStatus')
  })

  test('T2: 비밀번호 없는 사용자 로그인 시도 → NO_PASSWORD 에러', async ({ request }) => {
    const loginRes = await request.post(`${API}/api/auth/login`, {
      data: { username: TEST_SINGLEID, password: 'anything' }
    })
    const body = await loginRes.json()
    expect(body.success).toBeFalsy()
    expect(body.code).toBe('NO_PASSWORD')
  })

  test('T3: Sign Up ID 체크 — 비밀번호 없는 사용자 → 비밀번호 초기화 안내', async ({ request }) => {
    const checkRes = await request.get(`${API}/api/auth/check-id`, {
      params: { singleid: TEST_SINGLEID }
    })
    const body = await checkRes.json()
    expect(body.available).toBe(false)
    expect(body.message).toContain('비밀번호 초기화')
  })

  test('T4: Sign Up ID 체크 — 비밀번호 있는 사용자 → 기존 메시지', async ({ request }) => {
    // admin은 비밀번호가 있는 기존 사용자
    const checkRes = await request.get(`${API}/api/auth/check-id`, {
      params: { singleid: 'admin' }
    })
    const body = await checkRes.json()
    expect(body.available).toBe(false)
    expect(body.message).toContain('이미 사용 중인 ID')
  })
})
