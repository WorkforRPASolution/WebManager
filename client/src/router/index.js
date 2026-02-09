import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../shared/stores/auth'

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
 * - permission: 필요한 권한 키 (예: 'users', 'settings')
 * - allowedRoles: 접근 허용 역할 배열 (예: [1] = Admin만, [1, 2] = Admin + Conductor)
 */
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../features/auth/LoginView.vue'),
    meta: { layout: 'auth', requiresAuth: false }
  },
  {
    path: '/signup',
    name: 'Signup',
    component: () => import('../features/auth/SignupView.vue'),
    meta: { layout: 'auth', requiresAuth: false }
  },
  {
    path: '/request-password-reset',
    name: 'RequestPasswordReset',
    component: () => import('../features/auth/RequestPasswordResetView.vue'),
    meta: { layout: 'auth', requiresAuth: false }
  },
  {
    path: '/set-new-password',
    name: 'SetNewPassword',
    component: () => import('../features/auth/SetNewPasswordView.vue'),
    meta: { layout: 'auth', requiresAuth: true }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../features/dashboard/DashboardView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      permission: 'dashboard',
      menu: {
        mainMenu: 'dashboard',
        mainMenuLabel: 'Dashboard',
        mainMenuIcon: 'dashboard',
        mainMenuOrder: 1,
        subMenu: 'overview',
        subMenuLabel: 'Overview',
        subMenuIcon: 'grid_view',
        subMenuOrder: 1,
        permission: 'dashboard'
      }
    }
  },
  {
    path: '/clients',
    name: 'Clients',
    component: () => import('../features/clients/ClientsView.vue'),
    meta: {
      agentGroup: 'ars_agent',
      layout: 'default',
      requiresAuth: true,
      permission: 'clients',
      menu: {
        mainMenu: 'clients',
        mainMenuLabel: 'Clients',
        mainMenuIcon: 'devices',
        mainMenuOrder: 2,
        subMenu: 'client-list',
        subMenuLabel: 'ARSAgent',
        subMenuIcon: 'list',
        subMenuOrder: 1,
        permission: 'clients'
      }
    }
  },
  {
    path: '/clients/:id',
    name: 'ClientDetail',
    component: () => import('../features/clients/ClientDetailView.vue'),
    meta: {
      agentGroup: 'ars_agent',
      layout: 'default',
      requiresAuth: true,
      permission: 'clients',
      menu: {
        mainMenu: 'clients',
        subMenu: 'client-detail',
        subMenuLabel: 'Client Detail',
        hidden: true,  // 메뉴에 표시하지 않음
        permission: 'clients'
      }
    }
  },
  { 
    path: '/resource-clients', 
    name: 'ResourceClients', 
    component: () => import('../features/clients/ClientsView.vue'), 
    meta: { 
      agentGroup: 'resource_agent', 
      layout: 'default', 
      requiresAuth: true, 
      permission: 'clients', 
      menu: { 
        mainMenu: 'clients', 
        mainMenuLabel: 'Clients', 
        mainMenuIcon: 'devices', 
        mainMenuOrder: 2, 
        subMenu: 'resource-client-list', 
        subMenuLabel: 'ResourceAgent', 
        subMenuIcon: 'memory', 
        subMenuOrder: 2, 
        permission: 'clients' 
      } 
    } 
  }, 
  { 
    path: '/resource-clients/:id', 
    name: 'ResourceClientDetail', 
    component: () => import('../features/clients/ClientDetailView.vue'), 
    meta: { 
      agentGroup: 'resource_agent', 
      layout: 'default', 
      requiresAuth: true, 
      permission: 'clients', 
      menu: { 
        mainMenu: 'clients', 
        subMenu: 'resource-client-detail', 
        subMenuLabel: 'Resource Client Detail', 
        hidden: true, 
        permission: 'clients' 
      } 
    } 
  },
  {
    path: '/equipment-info',
    name: 'EquipmentInfo',
    component: () => import('../features/equipment-info/EquipmentInfoView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      permission: 'equipmentInfo',
      menu: {
        mainMenu: 'masterdata',
        mainMenuLabel: '기준정보 관리',
        mainMenuIcon: 'database',
        mainMenuOrder: 3,
        subMenu: 'equipment-info',
        subMenuLabel: 'Equipment Info',
        subMenuIcon: 'storage',
        subMenuOrder: 1,
        permission: 'equipmentInfo'
      }
    }
  },
  {
    path: '/email-template',
    name: 'EmailTemplate',
    component: () => import('../features/email-template/EmailTemplateView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      permission: 'emailTemplate',
      menu: {
        mainMenu: 'masterdata',
        mainMenuLabel: '기준정보 관리',
        mainMenuIcon: 'database',
        mainMenuOrder: 3,
        subMenu: 'email-template',
        subMenuLabel: 'Email Template',
        subMenuIcon: 'mail',
        subMenuOrder: 2,
        permission: 'emailTemplate'
      }
    }
  },
  // Popup Template Management
  {
    path: '/popup-template',
    name: 'PopupTemplate',
    component: () => import('../features/popup-template/PopupTemplateView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      permission: 'popupTemplate',
      menu: {
        mainMenu: 'masterdata',
        mainMenuLabel: '기준정보 관리',
        mainMenuIcon: 'database',
        mainMenuOrder: 3,
        subMenu: 'popup-template',
        subMenuLabel: 'Popup Template',
        subMenuIcon: 'web_asset',
        subMenuOrder: 2.5,
        permission: 'popupTemplate'
      }
    }
  },
  // Email Image Management
  {
    path: '/email-image',
    name: 'EmailImage',
    component: () => import('../features/email-image/EmailImageView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      permission: 'emailImage',
      menu: {
        mainMenu: 'masterdata',
        mainMenuLabel: '기준정보 관리',
        mainMenuIcon: 'database',
        mainMenuOrder: 3,
        subMenu: 'email-image',
        subMenuLabel: 'Email Image',
        subMenuIcon: 'image',
        subMenuOrder: 2.6,
        permission: 'emailImage'
      }
    }
  },
  // Email Recipients Management
  {
    path: '/email-recipients',
    name: 'EmailRecipients',
    component: () => import('../features/email-recipients/EmailRecipientsView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      permission: 'emailRecipients',
      menu: {
        mainMenu: 'masterdata',
        mainMenuLabel: '기준정보 관리',
        mainMenuIcon: 'database',
        mainMenuOrder: 3,
        subMenu: 'email-recipients',
        subMenuLabel: 'Email Recipients',
        subMenuIcon: 'forward_to_inbox',
        subMenuOrder: 3,
        permission: 'emailRecipients'
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
      permission: 'alerts',
      menu: {
        mainMenu: 'system',
        mainMenuLabel: 'System',
        mainMenuIcon: 'settings',
        mainMenuOrder: 4,
        subMenu: 'alerts',
        subMenuLabel: 'Alerts History',
        subMenuIcon: 'notifications',
        subMenuOrder: 2,
        permission: 'alerts'
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
      permission: 'settings',
      menu: {
        mainMenu: 'system',
        mainMenuLabel: 'System',
        mainMenuIcon: 'settings',
        mainMenuOrder: 4,
        subMenu: 'settings',
        subMenuLabel: 'Settings',
        subMenuIcon: 'tune',
        subMenuOrder: 1,
        permission: 'settings'
      }
    }
  },
  // Email Info Management
  {
    path: '/email-info',
    name: 'EmailInfo',
    component: () => import('../features/email-info/EmailInfoView.vue'),
    meta: {
      layout: 'default',
      requiresAuth: true,
      permission: 'emailInfo',
      menu: {
        mainMenu: 'masterdata',
        mainMenuLabel: '기준정보 관리',
        mainMenuIcon: 'database',
        mainMenuOrder: 3,
        subMenu: 'email-info',
        subMenuLabel: 'Email Info',
        subMenuIcon: 'contact_mail',
        subMenuOrder: 4,
        permission: 'emailInfo'
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
      permission: 'users',
      menu: {
        mainMenu: 'masterdata',
        mainMenuLabel: '기준정보 관리',
        mainMenuIcon: 'database',
        mainMenuOrder: 3,
        subMenu: 'user-management',
        subMenuLabel: 'User Management',
        subMenuIcon: 'users',
        subMenuOrder: 5,
        permission: 'users'
      }
    }
  },
  // Unauthorized
  {
    path: '/unauthorized',
    name: 'Unauthorized',
    component: () => import('../features/errors/UnauthorizedView.vue'),
    meta: { layout: 'blank', requiresAuth: false }
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation Guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Initialize auth state on first navigation
  if (!authStore.initialized) {
    await authStore.initialize()
  }

  const isAuthenticated = authStore.isAuthenticated

  // Redirect to login if auth required but not authenticated
  if (to.meta.requiresAuth && !isAuthenticated) {
    return next('/login')
  }

  // Redirect to dashboard if already authenticated and going to auth pages
  const authPages = ['/login', '/signup', '/request-password-reset']
  if (authPages.includes(to.path) && isAuthenticated) {
    return next('/')
  }

  // Check permission for the route
  if (to.meta.permission && isAuthenticated) {
    const hasPermission = authStore.hasPermission(to.meta.permission)
    if (!hasPermission) {
      return next('/unauthorized')
    }
  }

  // Check allowed roles for the route
  if (to.meta.allowedRoles && isAuthenticated) {
    const hasRole = authStore.hasRole(to.meta.allowedRoles)
    if (!hasRole) {
      return next('/unauthorized')
    }
  }

  next()
})

export default router
