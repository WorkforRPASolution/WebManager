import { createRouter, createWebHistory } from 'vue-router'

/**
 * 라우트 설정
 *
 * meta.menu 구조:
 * - mainMenu: MainMenu ID
 * - mainMenuLabel: MainMenu 표시 라벨
 * - mainMenuIcon: MainMenu 아이콘 (AppIcon name)
 * - mainMenuOrder: MainMenu 정렬 순서
 * - subMenu: SubMenu ID
 * - subMenuLabel: SubMenu 표시 라벨
 * - subMenuIcon: SubMenu 아이콘 (AppIcon name)
 * - subMenuOrder: SubMenu 정렬 순서
 * - hidden: true면 메뉴에 표시하지 않음 (예: ClientDetail)
 */
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../features/auth/LoginView.vue'),
    meta: { layout: 'auth', requiresAuth: false }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../features/dashboard/DashboardView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      menu: {
        mainMenu: 'dashboard',
        mainMenuLabel: 'Dashboard',
        mainMenuIcon: 'dashboard',
        mainMenuOrder: 1,
        subMenu: 'overview',
        subMenuLabel: 'Overview',
        subMenuIcon: 'grid_view',
        subMenuOrder: 1
      }
    }
  },
  {
    path: '/clients',
    name: 'Clients',
    component: () => import('../features/clients/ClientsView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      menu: {
        mainMenu: 'clients',
        mainMenuLabel: 'Clients',
        mainMenuIcon: 'devices',
        mainMenuOrder: 2,
        subMenu: 'client-list',
        subMenuLabel: 'Client List',
        subMenuIcon: 'list',
        subMenuOrder: 1
      }
    }
  },
  {
    path: '/clients/:id',
    name: 'ClientDetail',
    component: () => import('../features/clients/ClientDetailView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      menu: {
        mainMenu: 'clients',
        subMenu: 'client-detail',
        subMenuLabel: 'Client Detail',
        hidden: true  // 메뉴에 표시하지 않음
      }
    }
  },
  {
    path: '/master',
    name: 'Master',
    component: () => import('../features/master/MasterView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      menu: {
        mainMenu: 'system',
        mainMenuLabel: 'System',
        mainMenuIcon: 'settings',
        mainMenuOrder: 3,
        subMenu: 'master',
        subMenuLabel: 'Master Data',
        subMenuIcon: 'storage',
        subMenuOrder: 1
      }
    }
  },
  {
    path: '/alerts',
    name: 'Alerts',
    component: () => import('../features/alerts/AlertsView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      menu: {
        mainMenu: 'system',
        subMenu: 'alerts',
        subMenuLabel: 'Alerts History',
        subMenuIcon: 'notifications',
        subMenuOrder: 2
      }
    }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../features/settings/SettingsView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      menu: {
        mainMenu: 'system',
        subMenu: 'settings',
        subMenuLabel: 'Settings',
        subMenuIcon: 'tune',
        subMenuOrder: 3
      }
    }
  },
  // Users Management
  {
    path: '/users',
    name: 'Users',
    component: () => import('../features/users/UsersView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      menu: {
        mainMenu: 'users',
        mainMenuLabel: 'Users',
        mainMenuIcon: 'users',
        mainMenuOrder: 4,
        subMenu: 'user-list',
        subMenuLabel: 'User List',
        subMenuIcon: 'list',
        subMenuOrder: 1
      }
    }
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation Guard
router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('token')

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
