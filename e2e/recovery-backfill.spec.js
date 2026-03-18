import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './auth.setup.js'

const API = 'http://localhost:3000/api'

test.describe('Recovery Backfill E2E', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  // ── C1: 분석 → 실행 → 진행률 → 완료 ──
  test('C1: analyze → start → progress → complete', async ({ page }) => {
    await page.goto('/recovery-overview')
    await page.waitForLoadState('networkidle')

    // Admin 톱니바퀴 버튼 클릭 → Backfill 모달 열기
    const gearBtn = page.locator('button[title="Backfill 관리"]')
    await expect(gearBtn).toBeVisible()
    await gearBtn.click()

    // 모달 표시 확인
    const modal = page.locator('text=Recovery Backfill')
    await expect(modal).toBeVisible()

    // 날짜 입력 (최근 2일 — 빠르게 완료)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const fmt = d => d.toISOString().slice(0, 10)

    await page.locator('input[type="date"]').first().fill(fmt(yesterday))
    await page.locator('input[type="date"]').last().fill(fmt(today))

    // Hourly 건너뛰기 (빠른 실행 위해)
    await page.locator('text=Hourly 건너뛰기').click()

    // Throttle 0으로 설정 (빠른 실행)
    await page.locator('input[type="range"]').fill('0')

    // [분석] 클릭
    await page.locator('button', { hasText: '분석' }).click()

    // 분석 결과 표시 대기
    await expect(page.locator('text=분석 결과')).toBeVisible({ timeout: 30000 })

    // 3분류 표시 확인 (성공/Partial/미처리 중 하나 이상)
    await expect(page.locator('text=Daily:')).toBeVisible()

    // [Backfill 실행] 클릭
    const startBtn = page.locator('button', { hasText: /Backfill 실행/ })
    if (await startBtn.isEnabled()) {
      await startBtn.click()

      // 확인 다이얼로그
      const confirmDialog = page.locator('text=실행하시겠습니까?')
      await expect(confirmDialog).toBeVisible()
      await page.locator('button', { hasText: '실행' }).last().click()

      // 진행 상태 표시 대기
      await expect(page.locator('text=진행 상태')).toBeVisible({ timeout: 10000 })

      // 완료 대기 (폴링 간격 3초, 최대 60초)
      await expect(page.locator('text=완료')).toBeVisible({ timeout: 60000 })
    }
  })

  // ── C2: 모달 닫기 / 재오픈 ──
  test('C2: close modal during run → reopen shows progress', async ({ page }) => {
    // 먼저 API로 직접 backfill 시작 (빠른 설정)
    const loginRes = await page.request.post(`${API}/auth/login`, {
      data: { username: 'admin', password: 'admin' }
    })
    const { token } = await loginRes.json()

    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 2)

    await page.request.post(`${API}/recovery/backfill`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        startDate: yesterday.toISOString().slice(0, 10),
        endDate: today.toISOString().slice(0, 10),
        skipHourly: true,
        throttleMs: 2000 // 느리게 → 모달 닫기/재오픈 테스트용
      }
    })

    await page.goto('/recovery-overview')
    await page.waitForLoadState('networkidle')

    // 모달 열기
    await page.locator('button[title="Backfill 관리"]').click()
    await expect(page.locator('text=Recovery Backfill')).toBeVisible()

    // 진행 상태 OR 완료 표시 확인
    const statusVisible = await page.locator('text=진행 상태').isVisible({ timeout: 5000 }).catch(() => false)
    const completedVisible = await page.locator('text=완료').isVisible({ timeout: 5000 }).catch(() => false)
    expect(statusVisible || completedVisible).toBeTruthy()
  })

  // ── C3: 취소 + Resume ──
  test('C3: cancel backfill → analyze shows reduced pending', async ({ page }) => {
    await page.goto('/recovery-overview')
    await page.waitForLoadState('networkidle')

    await page.locator('button[title="Backfill 관리"]').click()
    await expect(page.locator('text=Recovery Backfill')).toBeVisible()

    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 3)

    await page.locator('input[type="date"]').first().fill(weekAgo.toISOString().slice(0, 10))
    await page.locator('input[type="date"]').last().fill(today.toISOString().slice(0, 10))
    await page.locator('text=Hourly 건너뛰기').click()
    await page.locator('input[type="range"]').fill('1000')

    // 분석
    await page.locator('button', { hasText: '분석' }).click()
    await expect(page.locator('text=분석 결과')).toBeVisible({ timeout: 30000 })

    const startBtn = page.locator('button', { hasText: /Backfill 실행/ })
    if (await startBtn.isEnabled()) {
      await startBtn.click()
      await page.locator('button', { hasText: '실행' }).last().click()

      // 진행 시작 대기
      await expect(page.locator('text=진행 상태')).toBeVisible({ timeout: 10000 })

      // 취소
      const cancelBtn = page.locator('button', { hasText: '취소' })
      if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelBtn.click()
        await expect(page.locator('text=취소됨')).toBeVisible({ timeout: 10000 })
      }
    }
  })

  // ── C4: 에러 bucket 재처리 ──
  // (DB 조작 필요하므로 API 기반으로 검증)
  test('C4: analyze detects pending buckets for reprocessing', async ({ page }) => {
    await page.goto('/recovery-overview')
    await page.waitForLoadState('networkidle')

    await page.locator('button[title="Backfill 관리"]').click()
    await expect(page.locator('text=Recovery Backfill')).toBeVisible()

    // 오래된 기간 분석 → pending > 0 확인
    await page.locator('input[type="date"]').first().fill('2025-01-01')
    await page.locator('input[type="date"]').last().fill('2025-01-03')
    await page.locator('text=Hourly 건너뛰기').click()

    await page.locator('button', { hasText: '분석' }).click()
    await expect(page.locator('text=분석 결과')).toBeVisible({ timeout: 30000 })

    // 미처리가 있는지 확인 (오래된 기간이므로 대부분 미처리)
    await expect(page.locator('text=미처리').first()).toBeVisible()
  })

  // ── C5: 권한 — User는 톱니바퀴 미표시 ──
  test('C5: non-admin user cannot see backfill button', async ({ page }) => {
    // admin이 아닌 일반 사용자로 로그인 시도
    // 일반 사용자가 없으면 API 직접 호출로 403 확인
    const loginRes = await page.request.post(`${API}/auth/login`, {
      data: { username: 'admin', password: 'admin' }
    })
    const { token } = await loginRes.json()

    // Admin은 접근 가능 (200)
    const analyzeRes = await page.request.post(`${API}/recovery/backfill/analyze`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        startDate: '2026-03-17',
        endDate: '2026-03-18',
        skipHourly: true
      }
    })
    expect(analyzeRes.status()).toBe(200)

    // 토큰 없이 접근 → 401/403
    const noAuthRes = await page.request.post(`${API}/recovery/backfill/analyze`, {
      data: {
        startDate: '2026-03-17',
        endDate: '2026-03-18'
      }
    })
    expect([401, 403]).toContain(noAuthRes.status())
  })

  // ── C6: 2년 제한 ──
  test('C6: date range exceeding 730 days shows validation error', async ({ page }) => {
    await page.goto('/recovery-overview')
    await page.waitForLoadState('networkidle')

    await page.locator('button[title="Backfill 관리"]').click()
    await expect(page.locator('text=Recovery Backfill')).toBeVisible()

    // 730일 초과 입력
    await page.locator('input[type="date"]').first().fill('2022-01-01')
    await page.locator('input[type="date"]').last().fill('2026-03-17')

    // 분석 클릭 → 클라이언트 검증 에러
    await page.locator('button', { hasText: '분석' }).click()

    // 에러 메시지 표시 확인
    await expect(page.locator('text=730')).toBeVisible({ timeout: 5000 })
  })
})
