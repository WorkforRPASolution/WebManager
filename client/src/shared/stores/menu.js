import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import router from '../../router'

export const useMenuStore = defineStore('menu', () => {
  /**
   * 라우트에서 메뉴 구조 자동 생성
   * router/index.js의 meta.menu 정보를 기반으로 메뉴를 빌드합니다.
   */
  const menuItems = computed(() => {
    const routes = router.getRoutes()
    const mainMenuMap = new Map()

    routes.forEach(route => {
      const menu = route.meta?.menu
      if (!menu || menu.hidden) return

      const mainMenuId = menu.mainMenu
      if (!mainMenuId) return

      // MainMenu가 없으면 생성
      if (!mainMenuMap.has(mainMenuId)) {
        mainMenuMap.set(mainMenuId, {
          id: mainMenuId,
          label: menu.mainMenuLabel || mainMenuId,
          icon: menu.mainMenuIcon || 'settings',
          order: menu.mainMenuOrder || 99,
          subMenus: []
        })
      }

      // MainMenu 정보 업데이트 (더 구체적인 정보가 있으면)
      const mainMenu = mainMenuMap.get(mainMenuId)
      if (menu.mainMenuLabel && !mainMenu.label) {
        mainMenu.label = menu.mainMenuLabel
      }
      if (menu.mainMenuIcon && mainMenu.icon === 'settings') {
        mainMenu.icon = menu.mainMenuIcon
      }
      if (menu.mainMenuOrder && mainMenu.order === 99) {
        mainMenu.order = menu.mainMenuOrder
      }

      // SubMenu 추가
      if (menu.subMenu) {
        const subMenuExists = mainMenu.subMenus.some(s => s.id === menu.subMenu)
        if (!subMenuExists) {
          mainMenu.subMenus.push({
            id: menu.subMenu,
            label: menu.subMenuLabel || menu.subMenu,
            path: route.path,
            icon: menu.subMenuIcon || 'settings',
            order: menu.subMenuOrder || 99
          })
        }
      }
    })

    // Map을 배열로 변환하고 정렬
    const result = Array.from(mainMenuMap.values())
      .sort((a, b) => a.order - b.order)
      .map(mainMenu => ({
        ...mainMenu,
        subMenus: mainMenu.subMenus.sort((a, b) => a.order - b.order)
      }))

    return result
  })

  // 현재 활성 MainMenu
  const activeMainMenu = ref('dashboard')

  // 사이드바 접힘 상태
  const sidebarCollapsed = ref(false)

  // 메가 메뉴 열림 상태
  const megaMenuOpen = ref(false)

  // 현재 MainMenu의 SubMenu 목록
  const currentSubMenus = computed(() => {
    const menu = menuItems.value.find(m => m.id === activeMainMenu.value)
    return menu ? menu.subMenus : []
  })

  // 현재 MainMenu 정보
  const currentMainMenu = computed(() => {
    return menuItems.value.find(m => m.id === activeMainMenu.value)
  })

  // MainMenu 변경
  function setActiveMainMenu(menuId) {
    activeMainMenu.value = menuId
    megaMenuOpen.value = false
  }

  // 사이드바 토글
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  // 메가 메뉴 토글
  function toggleMegaMenu() {
    megaMenuOpen.value = !megaMenuOpen.value
  }

  // 메가 메뉴 닫기
  function closeMegaMenu() {
    megaMenuOpen.value = false
  }

  // 경로로 MainMenu 찾기
  function findMainMenuByPath(path) {
    for (const menu of menuItems.value) {
      const subMenu = menu.subMenus.find(sub => sub.path === path || path.startsWith(sub.path + '/'))
      if (subMenu) {
        return menu.id
      }
    }
    // 동적 라우트 체크 (예: /clients/123 -> clients)
    const routes = router.getRoutes()
    for (const route of routes) {
      if (route.meta?.menu?.mainMenu) {
        const routePath = route.path.replace(/:[^/]+/g, '[^/]+')
        const regex = new RegExp(`^${routePath}$`)
        if (regex.test(path)) {
          return route.meta.menu.mainMenu
        }
      }
    }
    return 'dashboard'
  }

  return {
    menuItems,
    activeMainMenu,
    sidebarCollapsed,
    megaMenuOpen,
    currentSubMenus,
    currentMainMenu,
    setActiveMainMenu,
    toggleSidebar,
    toggleMegaMenu,
    closeMegaMenu,
    findMainMenuByPath
  }
})
