import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTabsStore = defineStore('tabs', () => {
  // 열린 탭 목록
  const tabs = ref([])

  // 현재 활성 탭 ID
  const activeTabId = ref(null)

  // 현재 활성 탭
  const activeTab = computed(() => {
    return tabs.value.find(tab => tab.id === activeTabId.value)
  })

  // 탭 열기 (이미 열려있으면 활성화만)
  function openTab(route) {
    const tabId = route.path
    const existingTab = tabs.value.find(tab => tab.id === tabId)

    if (existingTab) {
      activeTabId.value = tabId
      return existingTab
    }

    const newTab = {
      id: tabId,
      path: route.path,
      label: route.meta?.label || route.name || 'New Tab',
      mainMenu: route.meta?.mainMenu || 'dashboard',
      closable: true
    }

    tabs.value.push(newTab)
    activeTabId.value = tabId

    return newTab
  }

  // 탭 닫기
  function closeTab(tabId) {
    const index = tabs.value.findIndex(tab => tab.id === tabId)
    if (index === -1) return null

    const closedTab = tabs.value[index]
    tabs.value.splice(index, 1)

    // 닫은 탭이 활성 탭이었으면 다른 탭 활성화
    if (activeTabId.value === tabId) {
      if (tabs.value.length > 0) {
        // 이전 탭 또는 다음 탭 활성화
        const newIndex = Math.min(index, tabs.value.length - 1)
        activeTabId.value = tabs.value[newIndex].id
        return tabs.value[newIndex]
      } else {
        activeTabId.value = null
        return null
      }
    }

    return closedTab
  }

  // 탭 활성화
  function setActiveTab(tabId) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      activeTabId.value = tabId
      return tab
    }
    return null
  }

  // 모든 탭 닫기
  function closeAllTabs() {
    tabs.value = []
    activeTabId.value = null
  }

  // 다른 탭 모두 닫기
  function closeOtherTabs(tabId) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      tabs.value = [tab]
      activeTabId.value = tabId
    }
  }

  // 탭 존재 여부 확인
  function hasTab(tabId) {
    return tabs.value.some(tab => tab.id === tabId)
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    openTab,
    closeTab,
    setActiveTab,
    closeAllTabs,
    closeOtherTabs,
    hasTab
  }
})
