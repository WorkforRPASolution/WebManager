/**
 * User Activity — Scenario Tab E2E Tests
 *
 * 테스트 계획:
 * ──────────────────────────────────────────────────────────
 * C1: 탭 전환 — Tool Usage → Scenario 탭 전환 정상 동작
 * C2: 페이지 구조 — KPI 4장, 차트 2개, Top10, 최근이력 영역 표시
 * C3: KPI 배지 — "고정" / "기간" 배지 올바른 표시
 * C4: 기간 필터 — period 변경 시 API 재호출 확인
 * C5: 공정 필터 — process 파라미터 전달 확인
 * C6: 커스텀 기간 — startDate 검증 (미래일 차단)
 * C7: 다크모드 — 테마 전환 후 차트 영역 존재 확인
 * C8: API 권한 — 인증 없이 접근 시 401/403
 * C9: API 응답 구조 — scenario-stats 응답 필드 검증
 * C10: 빈 데이터 UI — 데이터 없을 때 "데이터가 없습니다" 표시
 * ──────────────────────────────────────────────────────────
 */
import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './auth.setup.js'

const API = 'http://localhost:3000/api'

test.describe('User Activity — Scenario Tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  // ── C1: 탭 전환 ──
  test('C1: Tab 전환 — Tool Usage → Scenario 정상 전환', async ({ page }) => {
    await page.goto('/user-activity')
    await page.waitForLoadState('networkidle')

    // Tool Usage 탭 활성 확인
    const toolTab = page.locator('button', { hasText: 'Tool Usage' })
    await expect(toolTab).toBeVisible()

    // Scenario 탭 클릭
    const scenarioTab = page.locator('button', { hasText: 'Scenario' })
    await expect(scenarioTab).toBeVisible()
    // "(준비 중)" 뱃지가 없어야 함
    await expect(scenarioTab).not.toContainText('준비 중')
    await scenarioTab.click()

    // Scenario 탭 활성화 확인 (border-blue 클래스)
    await expect(scenarioTab).toHaveClass(/border-blue/)

    // 페이지 로드 대기 (필터바 표시)
    await expect(page.locator('button', { hasText: '조회' })).toBeVisible()
  })

  // ── C2: 페이지 구조 ──
  test('C2: 페이지 구조 — KPI, 차트, 테이블 영역 표시', async ({ page }) => {
    await page.goto('/user-activity')
    await page.waitForLoadState('networkidle')

    // Scenario 탭 이동
    await page.locator('button', { hasText: 'Scenario' }).click()
    await page.waitForLoadState('networkidle')

    // KPI 5장 카드 확인
    await expect(page.locator('text=전체 시나리오')).toBeVisible()
    await expect(page.locator('text=활성 시나리오')).toBeVisible()
    await expect(page.locator('text=성과 입력 시나리오')).toBeVisible()
    await expect(page.locator('text=수정 시나리오')).toBeVisible()
    await expect(page.locator('text=활동 작성자')).toBeVisible()

    // 차트 제목 확인
    await expect(page.locator('text=공정별 시나리오 현황')).toBeVisible()
    await expect(page.locator('text=공정별 성과 입력률')).toBeVisible()
    await expect(page.locator('text=Top 10 작성자')).toBeVisible()
    await expect(page.locator('text=최근 수정 이력')).toBeVisible()
  })

  // ── C3: KPI 배지 ──
  test('C3: KPI 카드 — "고정" / "기간" 배지 표시', async ({ page }) => {
    await page.goto('/user-activity')
    await page.waitForLoadState('networkidle')

    await page.locator('button', { hasText: 'Scenario' }).click()
    await page.waitForLoadState('networkidle')

    // KPI 카드 영역에서 "고정" 배지 3개 (전체, 활성, 성과 입력)
    const kpiGrid = page.locator('[data-testid="scenario-kpi-cards"]')
    const fixedBadges = kpiGrid.locator('span:text-is("고정")')
    await expect(fixedBadges).toHaveCount(3)

    // "기간" 배지 2개 (수정 시나리오, 활동 작성자)
    const periodBadges = kpiGrid.locator('span:text-is("기간")')
    await expect(periodBadges).toHaveCount(2)
  })

  // ── C4: 기간 필터 변경 → API 재호출 ──
  test('C4: 기간 필터 변경 → scenario-stats API 호출', async ({ page }) => {
    await page.goto('/user-activity')
    await page.waitForLoadState('networkidle')

    await page.locator('button', { hasText: 'Scenario' }).click()
    await page.waitForLoadState('networkidle')

    // 기간 드롭다운 열기
    const periodDropdown = page.locator('text=전체').first()
    await periodDropdown.click()

    // "최근 7일" 선택
    await page.locator('text=최근 7일').click()

    // API 호출 인터셉트
    const responsePromise = page.waitForResponse(resp =>
      resp.url().includes('/user-activity/scenario-stats') && resp.status() === 200
    )

    // 조회 클릭
    await page.locator('button', { hasText: '조회' }).click()

    const response = await responsePromise
    expect(response.url()).toContain('period=7d')
  })

  // ── C5: 공정 필터 → API에 process 파라미터 전달 ──
  test('C5: 공정 필터 → process 파라미터 전달', async ({ page }) => {
    await page.goto('/user-activity')
    await page.waitForLoadState('networkidle')

    await page.locator('button', { hasText: 'Scenario' }).click()
    await page.waitForLoadState('networkidle')

    // Process 멀티셀렉트 열기
    const processSelect = page.locator('text=전체 Process')
    if (await processSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await processSelect.click()

      // 첫 번째 옵션 선택 (있으면)
      const firstOption = page.locator('.multiselect-option').first()
      if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        const optionText = await firstOption.textContent()
        await firstOption.click()

        // API 호출 인터셉트
        const responsePromise = page.waitForResponse(resp =>
          resp.url().includes('/user-activity/scenario-stats')
        )

        await page.locator('button', { hasText: '조회' }).click()
        const response = await responsePromise
        expect(response.url()).toContain('process=')
      }
    }
  })

  // ── C6: 커스텀 기간 — 미래 날짜 차단 ──
  test('C6: 커스텀 기간 — 미래 시작일 에러 표시', async ({ page }) => {
    await page.goto('/user-activity')
    await page.waitForLoadState('networkidle')

    await page.locator('button', { hasText: 'Scenario' }).click()
    await page.waitForLoadState('networkidle')

    // 기간 드롭다운 → "시작일 지정"
    const periodDropdown = page.locator('text=전체').first()
    await periodDropdown.click()
    await page.locator('text=시작일 지정').click()

    // 미래 날짜 입력
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    await page.locator('input[type="date"]').fill(futureDate.toISOString().slice(0, 10))

    // 조회 클릭
    await page.locator('button', { hasText: '조회' }).click()

    // 에러 메시지 표시
    await expect(page.locator('text=미래일')).toBeVisible({ timeout: 5000 })
  })

  // ── C7: 다크모드 전환 ──
  test('C7: 다크모드 전환 후 Scenario 탭 정상 표시', async ({ page }) => {
    await page.goto('/user-activity')
    await page.waitForLoadState('networkidle')

    // 다크모드 토글 (헤더 영역)
    const themeToggle = page.locator('[data-testid="theme-toggle"], button[title*="모드"], button[aria-label*="theme"]').first()
    if (await themeToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await themeToggle.click()
      await page.waitForTimeout(500)
    }

    // Scenario 탭 이동
    await page.locator('button', { hasText: 'Scenario' }).click()
    await page.waitForLoadState('networkidle')

    // KPI 카드 정상 표시 확인
    await expect(page.locator('text=전체 시나리오')).toBeVisible()
    await expect(page.locator('text=공정별 시나리오 현황')).toBeVisible()
  })

  // ── C8: API 권한 — 인증 없이 접근 시 401 ──
  test('C8: API 권한 — 인증 없이 scenario-stats → 401', async ({ page }) => {
    const res = await page.request.get(`${API}/user-activity/scenario-stats?period=all`)
    expect([401, 403]).toContain(res.status())
  })

  // ── C9: API 응답 구조 검증 ──
  test('C9: API 응답 구조 — kpi/processSummary/topAuthors/recentModifications', async ({ page }) => {
    const loginRes = await page.request.post(`${API}/auth/login`, {
      data: { username: 'admin', password: 'admin' }
    })
    const { token } = await loginRes.json()

    const res = await page.request.get(`${API}/user-activity/scenario-stats?period=all`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.status()).toBe(200)

    const body = await res.json()

    // KPI 필드 확인
    expect(body.kpi).toBeDefined()
    expect(body.kpi).toHaveProperty('totalScenarios')
    expect(body.kpi).toHaveProperty('activeScenarios')
    expect(body.kpi).toHaveProperty('performanceFilled')
    expect(body.kpi).toHaveProperty('modifiedScenarios')
    expect(body.kpi).toHaveProperty('activeAuthors')
    expect(body.kpi).toHaveProperty('periodLabel')
    expect(typeof body.kpi.totalScenarios).toBe('number')
    expect(typeof body.kpi.activeScenarios).toBe('number')

    // 배열 필드 확인
    expect(Array.isArray(body.processSummary)).toBe(true)
    expect(Array.isArray(body.topAuthors)).toBe(true)
    expect(Array.isArray(body.recentModifications)).toBe(true)

    // period=7d API 호출
    const res7d = await page.request.get(`${API}/user-activity/scenario-stats?period=7d`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const body7d = await res7d.json()
    expect(body7d.kpi.periodLabel).toBe('최근 7일')

    // custom period without startDate → 400
    const resBad = await page.request.get(`${API}/user-activity/scenario-stats?period=custom`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(resBad.status()).toBe(400)
  })

  // ── C10: 빈 데이터 UI ──
  test('C10: 빈 데이터 → "데이터가 없습니다" 표시', async ({ page }) => {
    await page.goto('/user-activity')
    await page.waitForLoadState('networkidle')

    await page.locator('button', { hasText: 'Scenario' }).click()
    await page.waitForLoadState('networkidle')

    // SC_PROPERTY가 비어있으므로 빈 데이터 메시지 확인
    const emptyMessages = page.locator('text=데이터가 없습니다')
    // 차트 4개 중 빈 영역에서 표시 (최소 1개 이상)
    const count = await emptyMessages.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // KPI 카드 영역에서 값이 0으로 표시 확인
    const kpiGrid = page.locator('[data-testid="scenario-kpi-cards"]')
    // "전체 시나리오" 카드 안의 bold 텍스트 "0"
    const totalCard = kpiGrid.locator('div').filter({ hasText: '전체 시나리오' }).first()
    await expect(totalCard.locator('.text-2xl')).toContainText('0')
  })
})
