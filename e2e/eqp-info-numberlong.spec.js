/**
 * EQP_INFO NumberLong + null 제거 E2E 검증
 *
 * T1: API 신규 생성 → null 필드 부재 확인
 * T2: API 수정 → 수정 후에도 null 필드 부재 유지 확인
 */

import { test, expect } from '@playwright/test'

const API = 'http://localhost:3000'
const TEST_EQPID = 'E2E_LONG_TEST_001'

async function getAuthHeader(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'admin', password: 'admin' }
  })
  const body = await res.json()
  return { Authorization: `Bearer ${body.token}` }
}

async function cleanup(request, headers) {
  const listRes = await request.get(`${API}/api/clients/equipment-info`, {
    headers,
    params: { eqpIdSearch: TEST_EQPID }
  })
  const list = await listRes.json()
  const ids = (list.data || []).filter(d => d.eqpId === TEST_EQPID).map(d => d._id)
  if (ids.length > 0) {
    await request.delete(`${API}/api/clients/equipment-info`, {
      headers,
      data: { ids }
    })
  }
}

test.describe('EQP_INFO NumberLong + null 제거', () => {
  let headers

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeader(request)
    await cleanup(request, headers)
  })

  test.afterAll(async ({ request }) => {
    if (!headers) headers = await getAuthHeader(request)
    await cleanup(request, headers)
  })

  test('T1: 신규 생성 → 선택 필드 미입력 시 null 필드 부재', async ({ request }) => {
    // 생성 (선택 필드 미입력)
    const createRes = await request.post(`${API}/api/clients/equipment-info`, {
      headers,
      data: {
        clients: [{
          line: 'L01', lineDesc: 'TestLine', process: 'TEST',
          eqpModel: 'MODEL_E2E', eqpId: TEST_EQPID, category: 'CAT1',
          ipAddr: '10.0.0.99', emailcategory: 'TEST', osVer: 'Win10',
          onoff: 1, webmanagerUse: 1, usereleasemsg: 1, usetkincancel: 0
          // serviceType, snapshotTimeDiff, basePath, agentPorts → 미입력
        }]
      }
    })
    const createBody = await createRes.json()
    expect(createBody.created).toBe(1)

    // 검증: lean() 응답에서 필드 부재 = DB에 필드 없음
    const verifyRes = await request.get(`${API}/api/clients/equipment-info`, {
      headers, params: { eqpIdSearch: TEST_EQPID }
    })
    const doc = (await verifyRes.json()).data.find(d => d.eqpId === TEST_EQPID)
    expect(doc).toBeTruthy()

    // 값 검증
    expect(doc.onoff).toBe(1)
    expect(doc.localpc).toBe(0)  // ipAddrL 미입력 → 0
    expect(doc.webmanagerUse).toBe(1)
    expect(doc.usereleasemsg).toBe(1)
    expect(doc.usetkincancel).toBe(0)

    // null 필드 부재 검증 (lean 응답에서 undefined = DB에 필드 없음)
    expect(doc).not.toHaveProperty('serviceType')
    expect(doc).not.toHaveProperty('snapshotTimeDiff')
    expect(doc).not.toHaveProperty('basePath')
    expect(doc).not.toHaveProperty('agentPorts')
  })

  test('T2: 수정 후에도 null 필드 부재 유지', async ({ request }) => {
    // 기존 문서 조회
    const listRes = await request.get(`${API}/api/clients/equipment-info`, {
      headers, params: { eqpIdSearch: TEST_EQPID }
    })
    const doc = (await listRes.json()).data.find(d => d.eqpId === TEST_EQPID)
    expect(doc).toBeTruthy()

    // osVer만 수정 (나머지 그대로 전송 — AG Grid 동작과 동일)
    const updateRes = await request.put(`${API}/api/clients/equipment-info`, {
      headers,
      data: { clients: [{ ...doc, osVer: 'Win11' }] }
    })
    expect((await updateRes.json()).updated).toBe(1)

    // 수정 후 검증
    const verifyRes = await request.get(`${API}/api/clients/equipment-info`, {
      headers, params: { eqpIdSearch: TEST_EQPID }
    })
    const updated = (await verifyRes.json()).data.find(d => d.eqpId === TEST_EQPID)
    expect(updated.osVer).toBe('Win11')
    expect(updated.onoff).toBe(1)

    // null 필드 여전히 부재
    expect(updated).not.toHaveProperty('serviceType')
    expect(updated).not.toHaveProperty('snapshotTimeDiff')
    expect(updated).not.toHaveProperty('basePath')
  })
})
