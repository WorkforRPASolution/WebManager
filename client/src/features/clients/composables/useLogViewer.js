import { ref, computed, reactive } from 'vue'
import { logApi } from '../api'

export function useLogViewer() {
  // Multi-client state
  const selectedClients = ref([])     // Array of client objects from grid selection
  const activeClientId = ref(null)    // Currently active client's eqpId
  const currentAgentGroup = ref(null) // Current agentGroup from route meta

  // Modal state
  const isOpen = ref(false)
  const logSettings = ref([])         // LOG_SETTINGS logSources array
  const activeSourceId = ref(null)    // Selected source's sourceId (e.g., 'log_1')

  // Per-client state cache (file list related only)
  const clientCache = ref({})
  // Structure: { [eqpId]: {
  //   files: [],           // file list from FTP
  //   filesLoading: false,
  //   filesError: null,
  //   selectedFiles: Set(), // checked file paths for delete/tail
  //   tailingFiles: Set(),  // files currently being tailed
  //  }}

  // --- Global tab/content state (unified across all clients) ---
  const globalOpenTabs = ref([])
  // Each item: { eqpId, filePath, fileName, sourceId }

  const globalContents = ref({})
  // Key: 'eqpId:filePath', Value: string

  const globalContentLoading = ref({})
  // Key: 'eqpId:filePath', Value: boolean

  // Composite key helpers
  function makeTabKey(eqpId, filePath) {
    return `${eqpId}:${filePath}`
  }

  function parseTabKey(key) {
    const idx = key.indexOf(':')
    return { eqpId: key.substring(0, idx), filePath: key.substring(idx + 1) }
  }

  // Global counters
  const totalOpenFiles = computed(() => globalOpenTabs.value.length)

  const MAX_OPEN_FILES = 20
  const MAX_CONCURRENT_TAILS = 5

  // Active client derived state
  const activeClient = computed(() =>
    selectedClients.value.find(c => (c.eqpId || c.id) === activeClientId.value) || null
  )

  const activeCache = computed(() =>
    clientCache.value[activeClientId.value] || null
  )

  const files = computed(() => activeCache.value?.files || [])
  const filesLoading = computed(() => activeCache.value?.filesLoading || false)
  const filesError = computed(() => activeCache.value?.filesError || null)
  const openTabs = computed(() => globalOpenTabs.value)
  const selectedFiles = computed(() => activeCache.value?.selectedFiles || new Set())
  const tailingFiles = computed(() => activeCache.value?.tailingFiles || new Set())

  // Active tab state
  const activeTabId = ref(null)  // composite key 'eqpId:filePath' (or 'tail:eqpId:filePath' for tail tabs)

  const activeTabContent = computed(() => {
    if (!activeTabId.value) return ''
    return globalContents.value[activeTabId.value] || ''
  })

  const activeTabLoading = computed(() => {
    if (!activeTabId.value) return false
    return globalContentLoading.value[activeTabId.value] || false
  })

  const isMultiMode = computed(() => selectedClients.value.length > 1)

  const clientStatuses = computed(() =>
    selectedClients.value.map(c => {
      const id = c.eqpId || c.id
      const cache = clientCache.value[id]
      const openTabCount = globalOpenTabs.value.filter(t => t.eqpId === id).length
      return {
        eqpId: id,
        eqpModel: c.eqpModel,
        name: c.name || id,
        status: cache?.filesLoading ? 'loading' : cache?.filesError ? 'error' : cache?.files?.length > 0 ? 'loaded' : 'pending',
        openTabCount
      }
    })
  )

  // ---- Methods ----

  function initClientCache(eqpId) {
    if (!clientCache.value[eqpId]) {
      clientCache.value[eqpId] = {
        files: [],
        filesLoading: false,
        filesError: null,
        selectedFiles: new Set(),
        tailingFiles: new Set()
      }
    }
  }

  async function openLogViewer(clients, agentGroup) {
    const clientList = Array.isArray(clients) ? clients : [clients]
    selectedClients.value = clientList
    activeClientId.value = clientList[0].eqpId || clientList[0].id
    currentAgentGroup.value = agentGroup
    activeSourceId.value = null
    activeTabId.value = null

    // Initialize cache
    clientCache.value = {}
    globalOpenTabs.value = []
    globalContents.value = {}
    globalContentLoading.value = {}
    for (const c of clientList) {
      initClientCache(c.eqpId || c.id)
    }

    try {
      // Load log settings
      const res = await logApi.getSettings(agentGroup)
      logSettings.value = res.data?.logSources || []

      if (logSettings.value.length === 0) {
        const id = activeClientId.value
        clientCache.value[id] = { ...clientCache.value[id], filesError: 'No log settings found. Please configure log settings.' }
        return
      }

      // Auto-select first source
      activeSourceId.value = logSettings.value[0].sourceId

      isOpen.value = true

      // Auto-load file list for first client + first source
      await loadFileList(activeClientId.value)
    } catch (err) {
      const id = activeClientId.value
      if (clientCache.value[id]) {
        clientCache.value[id] = { ...clientCache.value[id], filesError: err.response?.data?.message || err.message }
      }
    }
  }

  async function loadFileList(eqpId) {
    const cache = clientCache.value[eqpId]
    if (!cache) return

    clientCache.value[eqpId] = { ...cache, filesLoading: true, filesError: null }

    try {
      const res = await logApi.getFileList(eqpId, currentAgentGroup.value)
      // Filter by active source if sourceId is set
      let fileList = res.data || []
      if (activeSourceId.value) {
        fileList = fileList.filter(f => f.sourceId === activeSourceId.value || !f.sourceId)
      }

      clientCache.value[eqpId] = {
        ...clientCache.value[eqpId],
        files: fileList,
        filesLoading: false,
        filesError: null
      }
    } catch (err) {
      clientCache.value[eqpId] = {
        ...clientCache.value[eqpId],
        files: [],
        filesLoading: false,
        filesError: err.response?.data?.message || err.message
      }
    }
  }

  async function openFile(eqpId, file) {
    if (totalOpenFiles.value >= MAX_OPEN_FILES) {
      return { error: `Maximum ${MAX_OPEN_FILES} files can be open at once` }
    }

    const tabKey = makeTabKey(eqpId, file.path)

    // Check if already open
    const existing = globalOpenTabs.value.find(t => makeTabKey(t.eqpId, t.filePath) === tabKey)
    if (existing) {
      activeTabId.value = tabKey
      return
    }

    // Add tab
    globalOpenTabs.value = [...globalOpenTabs.value, {
      eqpId,
      filePath: file.path,
      fileName: file.name,
      sourceId: file.sourceId
    }]
    globalContentLoading.value = { ...globalContentLoading.value, [tabKey]: true }
    activeTabId.value = tabKey

    // Lazy download
    try {
      const res = await logApi.getFileContent(eqpId, file.path)
      globalContents.value = { ...globalContents.value, [tabKey]: res.data.content || '' }
    } catch (err) {
      globalContents.value = { ...globalContents.value, [tabKey]: `Error loading file: ${err.message}` }
    } finally {
      globalContentLoading.value = { ...globalContentLoading.value, [tabKey]: false }
    }
  }

  function closeTab(eqpId, filePath) {
    const tabKey = makeTabKey(eqpId, filePath)

    globalOpenTabs.value = globalOpenTabs.value.filter(t => makeTabKey(t.eqpId, t.filePath) !== tabKey)

    const newContents = { ...globalContents.value }
    delete newContents[tabKey]
    globalContents.value = newContents

    const newLoading = { ...globalContentLoading.value }
    delete newLoading[tabKey]
    globalContentLoading.value = newLoading

    // Switch to another tab if current was closed
    if (activeTabId.value === tabKey) {
      const tabs = globalOpenTabs.value
      activeTabId.value = tabs.length > 0 ? makeTabKey(tabs[tabs.length - 1].eqpId, tabs[tabs.length - 1].filePath) : null
    }
  }

  function toggleFileSelection(eqpId, filePath) {
    const cache = clientCache.value[eqpId]
    if (!cache) return

    const newSelected = new Set(cache.selectedFiles)
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath)
    } else {
      newSelected.add(filePath)
    }
    clientCache.value[eqpId] = { ...cache, selectedFiles: newSelected }
  }

  function selectAllFiles(eqpId, select) {
    const cache = clientCache.value[eqpId]
    if (!cache) return

    const newSelected = select ? new Set(cache.files.filter(f => !f.error).map(f => f.path)) : new Set()
    clientCache.value[eqpId] = { ...cache, selectedFiles: newSelected }
  }

  async function deleteSelectedFiles(eqpId) {
    const cache = clientCache.value[eqpId]
    if (!cache || cache.selectedFiles.size === 0) return

    const paths = [...cache.selectedFiles]

    try {
      const res = await logApi.deleteFiles(eqpId, paths)
      const results = res.data.results || []

      // Close tabs for deleted files
      for (const r of results) {
        if (r.success) {
          closeTab(eqpId, r.path)
        }
      }

      // Clear selection and refresh file list
      clientCache.value[eqpId] = { ...clientCache.value[eqpId], selectedFiles: new Set() }
      await loadFileList(eqpId)

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      return { successCount, failCount }
    } catch (err) {
      return { error: err.message }
    }
  }

  function selectSource(sourceId) {
    activeSourceId.value = sourceId
    // Reload file list for active client with new source filter
    if (activeClientId.value) {
      loadFileList(activeClientId.value)
    }
  }

  async function switchClient(eqpId) {
    activeClientId.value = eqpId
    // Do NOT reset activeTabId - tabs are global now, file list only switches

    // Load if not already loaded
    const cache = clientCache.value[eqpId]
    if (cache && !cache.files.length && !cache.filesLoading) {
      await loadFileList(eqpId)
    }
    // activeTabId stays as-is (global)
  }

  function closeLogViewer() {
    isOpen.value = false
    selectedClients.value = []
    activeClientId.value = null
    activeSourceId.value = null
    activeTabId.value = null
    clientCache.value = {}
    globalOpenTabs.value = []
    globalContents.value = {}
    globalContentLoading.value = {}
    logSettings.value = []
    currentAgentGroup.value = null
  }

  return {
    // State
    isOpen,
    selectedClients,
    activeClientId,
    currentAgentGroup,
    logSettings,
    activeSourceId,
    activeTabId,
    clientCache,

    // Global tab state
    globalOpenTabs,
    globalContents,
    globalContentLoading,

    // Computed
    activeClient,
    activeCache,
    files,
    filesLoading,
    filesError,
    openTabs,
    selectedFiles,
    tailingFiles,
    activeTabContent,
    activeTabLoading,
    isMultiMode,
    clientStatuses,
    totalOpenFiles,

    // Constants
    MAX_OPEN_FILES,
    MAX_CONCURRENT_TAILS,

    // Helpers
    makeTabKey,
    parseTabKey,

    // Methods
    openLogViewer,
    loadFileList,
    openFile,
    closeTab,
    toggleFileSelection,
    selectAllFiles,
    deleteSelectedFiles,
    selectSource,
    switchClient,
    closeLogViewer
  }
}
