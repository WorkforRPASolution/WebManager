import { ref, computed, watch } from 'vue'
import { fetchSSEStream } from '@/shared/utils/sseStreamParser'
import { configCompareApi } from '../api'
import {
  flattenJson,
  buildKeyTree,
  computeDiff,
  filterDiffOnly
} from '../utils/configCompareUtils'

export function useConfigCompare() {
  // ─── State ─────────────────────────────────────────────
  const isOpen = ref(false)
  const loading = ref(false)
  const currentAgentGroup = ref(null)

  // 선택된 클라이언트 목록 [{ eqpId, ... }]
  const selectedClients = ref([])

  // 클라이언트별 config 데이터 { [eqpId]: { configs: [...], error: null } }
  const clientData = ref({})

  // 로딩 진행률 { [eqpId]: 'pending' | 'loaded' | 'error' }
  const loadingStatus = ref({})

  // 활성 파일 탭
  const activeFileId = ref(null)

  // Baseline 클라이언트 ID
  const baselineEqpId = ref(null)

  // 필터
  const diffOnly = ref(false)
  const searchQuery = ref('')

  // 접기/펼치기 상태 Set<fullPath>
  const collapsedPaths = ref(new Set())

  // SSE abort
  let abortController = null

  // ─── Computed: config 파일 탭 목록 ─────────────────────
  const configFiles = computed(() => {
    // 첫 번째 성공 클라이언트에서 파일 목록 가져오기
    for (const client of selectedClients.value) {
      const eqpId = client.eqpId || client.id
      const data = clientData.value[eqpId]
      if (data?.configs?.length) {
        return data.configs.map(c => ({ fileId: c.fileId, name: c.name }))
      }
    }
    return []
  })

  // ─── Computed: 현재 파일의 클라이언트별 flattened maps ──
  const clientFlatMaps = computed(() => {
    const maps = {}
    for (const client of selectedClients.value) {
      const eqpId = client.eqpId || client.id
      const data = clientData.value[eqpId]
      if (!data?.configs) continue

      const configFile = data.configs.find(c => c.fileId === activeFileId.value)
      if (!configFile?.content) continue

      try {
        const parsed = JSON.parse(configFile.content)
        maps[eqpId] = flattenJson(parsed)
      } catch {
        // JSON 파싱 실패 → 빈 map
        maps[eqpId] = new Map()
      }
    }
    return maps
  })

  // ─── Computed: 모든 키 합집합 ──────────────────────────
  const allKeys = computed(() => {
    const keySet = new Set()
    for (const flatMap of Object.values(clientFlatMaps.value)) {
      for (const key of flatMap.keys()) keySet.add(key)
    }
    return [...keySet].sort()
  })

  // ─── Computed: 키 트리 ─────────────────────────────────
  const keyTree = computed(() => {
    const keySets = Object.values(clientFlatMaps.value).map(m => [...m.keys()])
    if (keySets.length === 0) return []
    return buildKeyTree(keySets)
  })

  // ─── Computed: diff 결과 ───────────────────────────────
  const diffResult = computed(() => {
    if (!baselineEqpId.value || Object.keys(clientFlatMaps.value).length === 0) {
      return new Map()
    }
    return computeDiff(baselineEqpId.value, clientFlatMaps.value, allKeys.value)
  })

  // ─── Computed: diff-only 필터된 키 집합 ─────────────────
  const diffKeys = computed(() => {
    return filterDiffOnly(diffResult.value)
  })

  // ─── Computed: 검색 필터된 키 집합 ──────────────────────
  const searchFilteredKeys = computed(() => {
    if (!searchQuery.value.trim()) return null // null = 필터 없음
    const q = searchQuery.value.toLowerCase()
    const matched = new Set()
    for (const key of allKeys.value) {
      if (key.toLowerCase().includes(q)) {
        matched.add(key)
        // 부모 경로 포함
        const parts = key.split('.')
        for (let i = 1; i < parts.length; i++) {
          matched.add(parts.slice(0, i).join('.'))
        }
      }
    }
    return matched
  })

  // ─── Computed: eqpIds (순서 보장) ──────────────────────
  const eqpIds = computed(() =>
    selectedClients.value.map(c => c.eqpId || c.id)
  )

  // ─── Computed: 로딩 진행률 ─────────────────────────────
  const loadingProgress = computed(() => {
    const total = eqpIds.value.length
    if (total === 0) return { total: 0, loaded: 0, failed: 0 }
    let loaded = 0
    let failed = 0
    for (const eqpId of eqpIds.value) {
      const status = loadingStatus.value[eqpId]
      if (status === 'loaded') loaded++
      else if (status === 'error') failed++
    }
    return { total, loaded, failed }
  })

  // ─── Methods ───────────────────────────────────────────

  function open(clients, agentGroup) {
    selectedClients.value = clients
    currentAgentGroup.value = agentGroup
    baselineEqpId.value = clients[0]?.eqpId || clients[0]?.id || null
    activeFileId.value = null
    clientData.value = {}
    loadingStatus.value = {}
    diffOnly.value = false
    searchQuery.value = ''
    collapsedPaths.value = new Set()
    isOpen.value = true
    loading.value = true

    // 초기 상태
    for (const client of clients) {
      const eqpId = client.eqpId || client.id
      loadingStatus.value[eqpId] = 'pending'
    }

    fetchConfigs()
  }

  function close() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    isOpen.value = false
    loading.value = false
  }

  async function fetchConfigs() {
    if (abortController) abortController.abort()
    abortController = new AbortController()

    try {
      await fetchSSEStream(
        configCompareApi.url,
        {
          eqpIds: eqpIds.value,
          agentGroup: currentAgentGroup.value
        },
        {
          onMessage: (data) => {
            if (data.type === 'progress') {
              loadingStatus.value = {
                ...loadingStatus.value,
                [data.eqpId]: data.status
              }
              if (data.status === 'loaded' && data.configs) {
                clientData.value = {
                  ...clientData.value,
                  [data.eqpId]: { configs: data.configs, error: null }
                }
              } else if (data.status === 'error') {
                clientData.value = {
                  ...clientData.value,
                  [data.eqpId]: { configs: null, error: data.error }
                }
              }
            }
          },
          onDone: () => {
            loading.value = false
            // 첫 번째 파일 탭 자동 선택
            if (!activeFileId.value && configFiles.value.length > 0) {
              activeFileId.value = configFiles.value[0].fileId
            }
          },
          signal: abortController.signal
        }
      )
    } catch (err) {
      if (err.name !== 'AbortError') {
        loading.value = false
      }
    }
  }

  function setBaseline(eqpId) {
    baselineEqpId.value = eqpId
  }

  function toggleDiffOnly() {
    diffOnly.value = !diffOnly.value
  }

  function toggleCollapse(fullPath) {
    const next = new Set(collapsedPaths.value)
    if (next.has(fullPath)) {
      next.delete(fullPath)
    } else {
      next.add(fullPath)
    }
    collapsedPaths.value = next
  }

  function expandAll() {
    collapsedPaths.value = new Set()
  }

  function collapseAll() {
    // 모든 비-리프 키를 접기
    const paths = new Set()
    const collectNonLeaf = (nodes) => {
      for (const node of nodes) {
        if (node.children.length > 0) {
          paths.add(node.fullPath)
          collectNonLeaf(node.children)
        }
      }
    }
    collectNonLeaf(keyTree.value)
    collapsedPaths.value = paths
  }

  // 노드가 보여야 하는지 판단
  function isNodeVisible(node) {
    // diff-only 필터
    if (diffOnly.value) {
      // 리프 노드: diffKeys에 있어야
      if (node.isLeaf && !diffKeys.value.has(node.fullPath)) return false
      // 비-리프 노드: diffKeys에 있어야 (자식 중 하나라도 diff가 있으면 포함됨)
      if (!node.isLeaf && !diffKeys.value.has(node.fullPath)) return false
    }

    // 검색 필터
    if (searchFilteredKeys.value !== null) {
      if (!searchFilteredKeys.value.has(node.fullPath)) return false
    }

    // 부모가 접힌 상태면 숨김
    const parts = node.fullPath.split('.')
    for (let i = 1; i < parts.length; i++) {
      const ancestorPath = parts.slice(0, i).join('.')
      if (collapsedPaths.value.has(ancestorPath)) return false
    }

    return true
  }

  // ─── Computed: 표시할 플랫 노드 목록 ───────────────────
  const visibleRows = computed(() => {
    const rows = []
    const walk = (nodes) => {
      for (const node of nodes) {
        if (!isNodeVisible(node)) continue
        rows.push(node)
        if (node.children.length > 0 && !collapsedPaths.value.has(node.fullPath)) {
          walk(node.children)
        }
      }
    }
    walk(keyTree.value)
    return rows
  })

  // ─── Computed: 에러 클라이언트 목록 ────────────────────
  const errorClients = computed(() => {
    return eqpIds.value.filter(id => loadingStatus.value[id] === 'error')
  })

  // ─── Computed: 성공 클라이언트 (비교 가능) ──────────────
  const loadedClients = computed(() => {
    return selectedClients.value.filter(c => {
      const eqpId = c.eqpId || c.id
      return loadingStatus.value[eqpId] === 'loaded'
    })
  })

  return {
    // State
    isOpen,
    loading,
    selectedClients,
    clientData,
    loadingStatus,
    activeFileId,
    baselineEqpId,
    diffOnly,
    searchQuery,
    collapsedPaths,

    // Computed
    configFiles,
    clientFlatMaps,
    keyTree,
    diffResult,
    diffKeys,
    eqpIds,
    loadingProgress,
    visibleRows,
    errorClients,
    loadedClients,

    // Methods
    open,
    close,
    setBaseline,
    toggleDiffOnly,
    toggleCollapse,
    expandAll,
    collapseAll,
    setActiveFile: (fileId) => { activeFileId.value = fileId },
    setSearchQuery: (q) => { searchQuery.value = q }
  }
}
