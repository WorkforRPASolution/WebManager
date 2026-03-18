/**
 * Auth helper for E2E tests.
 * Logs in via API and injects tokens into localStorage.
 */
export async function loginAsAdmin(page) {
  const res = await page.request.post('http://localhost:3000/api/auth/login', {
    data: { username: 'admin', password: 'admin' }
  })
  const body = await res.json()
  if (!body.token) throw new Error(`Login failed: ${body.error || 'no token'}`)

  await page.goto('http://localhost:5173')
  await page.evaluate(({ token, refreshToken, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('user', JSON.stringify(user))
  }, body)

  // Reload to pick up auth state
  await page.reload()
  await page.waitForLoadState('networkidle')
}
