import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

/**
 * Stub localStorage for Node environment (auth.js reads it at store creation)
 */
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn()
})

/**
 * Mock vue-router: router.getRoutes() returns test routes
 */
const mockRoutes = []
vi.mock('../../../router', () => ({
  default: {
    getRoutes: () => mockRoutes
  }
}))

/**
 * Mock API module used by auth store
 */
vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  permissionsApi: { getAll: vi.fn(() => Promise.resolve({ data: [] })) }
}))

// Import stores AFTER mocks are registered
const { useMenuStore } = await import('../menu.js')
const { useAuthStore } = await import('../auth.js')

/**
 * Helper: build a route object matching the project convention
 */
function makeRoute(path, { mainMenu, subMenu, permission, allowedRoles, hidden } = {}) {
  return {
    path,
    meta: {
      requiresAuth: true,
      ...(allowedRoles ? { allowedRoles } : {}),
      menu: {
        mainMenu,
        mainMenuLabel: mainMenu,
        mainMenuIcon: 'settings',
        mainMenuOrder: 1,
        subMenu,
        subMenuLabel: subMenu,
        subMenuIcon: 'settings',
        subMenuOrder: 1,
        ...(permission ? { permission } : {}),
        ...(hidden ? { hidden: true } : {})
      }
    }
  }
}

describe('menuItems allowedRoles filtering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockRoutes.length = 0
  })

  it('allowedRoles가 없는 라우트는 모든 사용자에게 표시', () => {
    // route without allowedRoles
    mockRoutes.push(
      makeRoute('/dashboard', { mainMenu: 'dashboard', subMenu: 'overview' })
    )

    // level 3 (Operator) user
    const authStore = useAuthStore()
    authStore.user = { authorityManager: 3, permissions: {} }

    const menuStore = useMenuStore()
    expect(menuStore.menuItems.length).toBe(1)
    expect(menuStore.menuItems[0].subMenus[0].id).toBe('overview')
  })

  it('allowedRoles: [1] 라우트는 Admin(level 1)에게만 표시', () => {
    mockRoutes.push(
      makeRoute('/permissions', { mainMenu: 'system', subMenu: 'permissions', allowedRoles: [1] })
    )

    const authStore = useAuthStore()
    authStore.user = { authorityManager: 1, permissions: {} }

    const menuStore = useMenuStore()
    expect(menuStore.menuItems.length).toBe(1)
    expect(menuStore.menuItems[0].subMenus[0].id).toBe('permissions')
  })

  it('allowedRoles: [1] 라우트는 Non-Admin에게 미표시', () => {
    mockRoutes.push(
      makeRoute('/permissions', { mainMenu: 'system', subMenu: 'permissions', allowedRoles: [1] })
    )

    // level 2 (Conductor) user
    const authStore = useAuthStore()
    authStore.user = { authorityManager: 2, permissions: {} }

    const menuStore = useMenuStore()
    // system mainMenu should be filtered out entirely (no subMenus)
    expect(menuStore.menuItems.length).toBe(0)
  })

  it('allowedRoles: [1, 2] 라우트는 Admin과 Conductor에게 표시', () => {
    mockRoutes.push(
      makeRoute('/admin-page', { mainMenu: 'system', subMenu: 'admin-page', allowedRoles: [1, 2] })
    )

    // Admin (level 1)
    const authStore = useAuthStore()
    authStore.user = { authorityManager: 1, permissions: {} }
    const menuStore = useMenuStore()
    expect(menuStore.menuItems.length).toBe(1)

    // Conductor (level 2) — reset stores
    setActivePinia(createPinia())
    mockRoutes.length = 0
    mockRoutes.push(
      makeRoute('/admin-page', { mainMenu: 'system', subMenu: 'admin-page', allowedRoles: [1, 2] })
    )
    const authStore2 = useAuthStore()
    authStore2.user = { authorityManager: 2, permissions: {} }
    const menuStore2 = useMenuStore()
    expect(menuStore2.menuItems.length).toBe(1)

    // Operator (level 3) — should NOT see
    setActivePinia(createPinia())
    mockRoutes.length = 0
    mockRoutes.push(
      makeRoute('/admin-page', { mainMenu: 'system', subMenu: 'admin-page', allowedRoles: [1, 2] })
    )
    const authStore3 = useAuthStore()
    authStore3.user = { authorityManager: 3, permissions: {} }
    const menuStore3 = useMenuStore()
    expect(menuStore3.menuItems.length).toBe(0)
  })

  it('기존 permission 기반 필터링은 영향 없음', () => {
    // Route with permission but NO allowedRoles
    mockRoutes.push(
      makeRoute('/settings', { mainMenu: 'system', subMenu: 'settings', permission: 'settings' })
    )

    // User without 'settings' permission
    const authStore = useAuthStore()
    authStore.user = { authorityManager: 1, permissions: {} }

    const menuStore = useMenuStore()
    // permission check should filter it out (no 'settings' in permissions)
    expect(menuStore.menuItems.length).toBe(0)

    // User with 'settings' permission
    setActivePinia(createPinia())
    mockRoutes.length = 0
    mockRoutes.push(
      makeRoute('/settings', { mainMenu: 'system', subMenu: 'settings', permission: 'settings' })
    )
    const authStore2 = useAuthStore()
    authStore2.user = { authorityManager: 1, permissions: { settings: true } }
    const menuStore2 = useMenuStore()
    expect(menuStore2.menuItems.length).toBe(1)
  })
})
