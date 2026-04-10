import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './auth.setup.js'

test.describe('Recovery by Category E2E', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('C1: 페이지 접근 및 KPI 카드 렌더링', async ({ page }) => {
    await page.goto('/recovery-by-category')
    await page.waitForLoadState('networkidle')

    // 페이지 타이틀 확인
    await expect(page.getByRole('heading', { name: 'Recovery by Category', level: 1 })).toBeVisible({ timeout: 15000 })

    // KPI 카드 4장 확인 — paragraph 태그 내에서 검색 (테이블 헤더와 구분)
    const main = page.getByRole('main')
    await expect(main.locator('p:text("Total Executions")')).toBeVisible({ timeout: 15000 })
    await expect(main.locator('p:text("Success Rate")')).toBeVisible()
    await expect(main.locator('p:text("Categories")')).toBeVisible()
    // Uncategorized는 KPI 카드와 테이블 모두에 있으므로 p 태그로 한정
    await expect(main.locator('p:text("Uncategorized")').first()).toBeVisible()
  })

  test('C2: Category Comparison 차트 렌더링', async ({ page }) => {
    await page.goto('/recovery-by-category')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /Category Comparison/ })).toBeVisible({ timeout: 15000 })
    const charts = page.locator('canvas')
    await expect(charts.first()).toBeVisible({ timeout: 10000 })
  })

  test('C3: Category Trend 차트 렌더링', async ({ page }) => {
    await page.goto('/recovery-by-category')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /Category Trend/ })).toBeVisible({ timeout: 15000 })
  })

  test('C4: Category Summary 테이블에 카테고리명 표시', async ({ page }) => {
    await page.goto('/recovery-by-category')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Category Summary' })).toBeVisible({ timeout: 15000 })

    // 테이블 셀에서 카테고리명 확인
    await expect(page.getByRole('cell', { name: /PM/ })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('cell', { name: /Vision/ })).toBeVisible()
    await expect(page.getByRole('cell', { name: /Alarm/ })).toBeVisible()
  })

  test('C5: 테이블 행 클릭으로 확장/축소', async ({ page }) => {
    await page.goto('/recovery-by-category')
    await page.waitForLoadState('networkidle')

    const pmRow = page.locator('tr', { hasText: 'PM' }).first()
    await expect(pmRow).toBeVisible({ timeout: 15000 })
    await pmRow.click()
    await expect(pmRow).toHaveClass(/bg-blue/)

    await pmRow.click()
    await expect(pmRow).not.toHaveClass(/bg-blue/)
  })

  test('C6: 기간 변경 시 데이터 갱신', async ({ page }) => {
    await page.goto('/recovery-by-category')
    await page.waitForLoadState('networkidle')

    const main = page.getByRole('main')
    await expect(main.locator('p:text("Total Executions")')).toBeVisible({ timeout: 15000 })

    // 이전 기간 버튼 클릭
    const prevBtn = page.getByRole('button', { name: '이전 기간' })
    if (await prevBtn.isVisible()) {
      await prevBtn.click()
      await page.getByRole('button', { name: '조회' }).click()
      await page.waitForLoadState('networkidle')
      await expect(main.locator('p:text("Total Executions")')).toBeVisible({ timeout: 15000 })
    }
  })

  test('C7: Admin 전용 Category 관리 버튼', async ({ page }) => {
    await page.goto('/recovery-by-category')
    await page.waitForLoadState('networkidle')

    // 데이터 로드 대기
    await expect(page.getByRole('heading', { name: 'Recovery by Category', level: 1 })).toBeVisible({ timeout: 15000 })
    await page.waitForLoadState('networkidle')

    const categoryBtn = page.getByRole('button', { name: /Category/ }).last()
    await expect(categoryBtn).toBeVisible({ timeout: 15000 })
  })

  test('C8: Category Mapping 모달 열기/닫기', async ({ page }) => {
    await page.goto('/recovery-by-category')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Recovery by Category', level: 1 })).toBeVisible({ timeout: 15000 })
    await page.waitForLoadState('networkidle')

    // Category 관리 버튼 (title 속성으로 구분)
    const categoryBtn = page.locator('button[title="Category Name 관리"]')
    if (await categoryBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await categoryBtn.click()
    } else {
      // title 없으면 텍스트로 찾기 — main 영역 내 Category 버튼
      const mainCatBtn = page.getByRole('main').getByRole('button', { name: /Category/ })
      await expect(mainCatBtn).toBeVisible({ timeout: 5000 })
      await mainCatBtn.click()
    }

    // 모달 타이틀
    const modalTitle = page.locator('h2', { hasText: 'Scenario Category Mapping' })
    await expect(modalTitle).toBeVisible({ timeout: 5000 })

    // Cancel 닫기
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(modalTitle).not.toBeVisible()
  })

  test('C9: 사이드바 메뉴에 Recovery by Category 링크', async ({ page }) => {
    await page.goto('/recovery-by-category')
    await page.waitForLoadState('networkidle')

    const sidebarLink = page.getByRole('link', { name: 'Recovery by Category' })
    await expect(sidebarLink).toBeVisible({ timeout: 10000 })
  })
})
