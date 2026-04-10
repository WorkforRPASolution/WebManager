/**
 * AGENT_INFO ↔ EQP_INFO 동기화 E2E 검증
 *
 * T1: EQP_INFO 생성 → agentInfoSync.synced 확인
 * T2: EQP_INFO 수정 (ipAddr 변경) → agentInfoSync.synced 확인
 * T3: EQP_INFO 삭제 → agentInfoSync.synced 확인
 */

import { test, expect } from '@playwright/test'

const API = 'http://localhost:3000'
const TEST_EQPID = 'E2E_AGENTSYNC_001'
const TEST_EQPID_RENAME = 'E2E_AGENTSYNC_002'

async function getAuthHeader(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'admin', password: 'admin' }
  })
  const body = await res.json()
  return { Authorization: `Bearer ${body.token}` }
}

async function cleanup(request, headers) {
  for (const eqpId of [TEST_EQPID, TEST_EQPID_RENAME]) {
    const listRes = await request.get(`${API}/api/clients/equipment-info`, {
      headers,
      params: { eqpIdSearch: eqpId }
    })
    const list = await listRes.json()
    const ids = (list.data || []).filter(d => d.eqpId === eqpId).map(d => d._id)
    if (ids.length > 0) {
      await request.delete(`${API}/api/clients/equipment-info`, {
        headers,
        data: { ids }
      })
    }
  }
}

test.describe('AGENT_INFO ↔ EQP_INFO 동기화', () => {
  let headers

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeader(request)
    await cleanup(request, headers)
  })

  test.afterAll(async ({ request }) => {
    if (!headers) headers = await getAuthHeader(request)
    await cleanup(request, headers)
  })

  test('T1: EQP_INFO 생성 → AGENT_INFO upsert (agentInfoSync 확인)', async ({ request }) => {
    const createRes = await request.post(`${API}/api/clients/equipment-info`, {
      headers,
      data: {
        clients: [{
          line: 'L01', lineDesc: 'TestLine', process: 'TEST',
          eqpModel: 'MODEL_E2E', eqpId: TEST_EQPID, category: 'CAT1',
          ipAddr: '10.0.0.50', emailcategory: 'TEST', osVer: 'Win10',
          onoff: 1, webmanagerUse: 1, usereleasemsg: 1, usetkincancel: 0
        }]
      }
    })
    const body = await createRes.json()
    expect(createRes.ok()).toBeTruthy()
    expect(body.created).toBe(1)

    // agentInfoSync 응답 확인
    expect(body.agentInfoSync).toBeTruthy()
    expect(body.agentInfoSync.synced).toBe(1)
    expect(body.agentInfoSync.failed).toBe(0)
  })

  test('T2: EQP_INFO 수정 (ipAddr 변경) → AGENT_INFO IpAddr 동기화', async ({ request }) => {
    // 기존 문서 조회
    const listRes = await request.get(`${API}/api/clients/equipment-info`, {
      headers, params: { eqpIdSearch: TEST_EQPID }
    })
    const doc = (await listRes.json()).data.find(d => d.eqpId === TEST_EQPID)
    expect(doc).toBeTruthy()

    // ipAddr 수정
    const updateRes = await request.put(`${API}/api/clients/equipment-info`, {
      headers,
      data: { clients: [{ ...doc, ipAddr: '10.0.0.99' }] }
    })
    const body = await updateRes.json()
    expect(updateRes.ok()).toBeTruthy()
    expect(body.updated).toBe(1)

    // agentInfoSync 응답 확인
    expect(body.agentInfoSync).toBeTruthy()
    expect(body.agentInfoSync.synced).toBe(1)
    expect(body.agentInfoSync.failed).toBe(0)
  })

  test('T3: EQP_INFO 수정 (변경 없음) → AGENT_INFO skip', async ({ request }) => {
    const listRes = await request.get(`${API}/api/clients/equipment-info`, {
      headers, params: { eqpIdSearch: TEST_EQPID }
    })
    const doc = (await listRes.json()).data.find(d => d.eqpId === TEST_EQPID)
    expect(doc).toBeTruthy()

    // 동일 데이터로 수정 (변경 없음)
    const updateRes = await request.put(`${API}/api/clients/equipment-info`, {
      headers,
      data: { clients: [{ ...doc }] }
    })
    const body = await updateRes.json()
    expect(updateRes.ok()).toBeTruthy()

    // 변경 없으므로 sync 0건
    expect(body.agentInfoSync).toBeTruthy()
    expect(body.agentInfoSync.synced).toBe(0)
  })

  test('T4: EQP_INFO 삭제 → AGENT_INFO 삭제', async ({ request }) => {
    const listRes = await request.get(`${API}/api/clients/equipment-info`, {
      headers, params: { eqpIdSearch: TEST_EQPID }
    })
    const doc = (await listRes.json()).data.find(d => d.eqpId === TEST_EQPID)
    expect(doc).toBeTruthy()

    const deleteRes = await request.delete(`${API}/api/clients/equipment-info`, {
      headers,
      data: { ids: [doc._id] }
    })
    const body = await deleteRes.json()
    expect(deleteRes.ok()).toBeTruthy()
    expect(body.deleted).toBe(1)

    // agentInfoSync 응답 확인
    expect(body.agentInfoSync).toBeTruthy()
    expect(body.agentInfoSync.synced).toBe(1)
    expect(body.agentInfoSync.failed).toBe(0)
  })
})
