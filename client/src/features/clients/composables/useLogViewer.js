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
  
  // Per-client state cache
  const clientCache = ref({})
  // Structure: { [eqpId]: { 
  //   files: [],           // file list from FTP
  //   filesLoading: false,
  //   filesError: null,
  //   openTabs: [],         // [{id, fileName, filePath, sourceId}]
  //   contents: {},         // { [filePath]: string }
  //   contentLoading: {},   // { [filePath]: boolean }
  //   selectedFiles: Set(), // checked file paths for delete/tail
  //   tailingFiles: Set(),  // files currently being tailed
  //  }}

  // Global counters
  const totalOpenFiles = computed(() => {
    let count = 0
    for (const key of Object.keys(clientCache.value)) {
      count += (clientCache.value[key]?.openTabs?.length || 0)
    }
    return count
  })
  
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
  const openTabs = computed(() => activeCache.value?.openTabs || [])
  const selectedFiles = computed(() => activeCache.value?.selectedFiles || new Set())
  const tailingFiles = computed(() => activeCache.value?.tailingFiles || new Set())
  
  // Active tab state
  const activeTabId = ref(null)  // filePath of active tab (or 'tail:filepath' for tail tabs)
  
  const activeTabContent = computed(() => {
    if (!activeTabId.value || !activeClientId.value) return ''
    return activeCache.value?.contents?.[activeTabId.value] || ''
  })
  
  const isMultiMode = computed(() => selectedClients.value.length > 1)
  
  const clientStatuses = computed(() =>
    selectedClients.value.map(c => {
      const id = c.eqpId || c.id
      const cache = clientCache.value[id]
      return {
        eqpId: id,
        eqpModel: c.eqpModel,
        name: c.name || id,
        status: cache?.filesLoading ? 'loading' : cache?.filesError ? 'error' : cache?.files?.length > 0 ? 'loaded' : 'pending',
        openTabCount: cache?.openTabs?.length || 0
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
        openTabs: [],
        contents: {},
        contentLoading: {},
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
    
    const cache = clientCache.value[eqpId]
    if (!cache) return
    
    // Check if already open
    const existing = cache.openTabs.find(t => t.filePath === file.path)
    if (existing) {
      activeTabId.value = file.path
      return
    }
    
    // Add tab
    const newTab = { id: file.path, fileName: file.name, filePath: file.path, sourceId: file.sourceId }
    const newTabs = [...cache.openTabs, newTab]
    const newContentLoading = { ...cache.contentLoading, [file.path]: true }
    
    clientCache.value[eqpId] = { ...cache, openTabs: newTabs, contentLoading: newContentLoading }
    activeTabId.value = file.path
    
    // Lazy download
    try {
      const res = await logApi.getFileContent(eqpId, file.path)
      const updatedCache = clientCache.value[eqpId]
      clientCache.value[eqpId] = {
        ...updatedCache,
        contents: { ...updatedCache.contents, [file.path]: res.data.content || '' },
        contentLoading: { ...updatedCache.contentLoading, [file.path]: false }
      }
    } catch (err) {
      const updatedCache = clientCache.value[eqpId]
      clientCache.value[eqpId] = {
        ...updatedCache,
        contents: { ...updatedCache.contents, [file.path]: `Error loading file: ${err.message}` },
        contentLoading: { ...updatedCache.contentLoading, [file.path]: false }
      }
    }
  }
  
  function closeTab(eqpId, filePath) {
    const cache = clientCache.value[eqpId]
    if (!cache) return
    
    const newTabs = cache.openTabs.filter(t => t.filePath !== filePath)
    const newContents = { ...cache.contents }
    delete newContents[filePath]
    const newContentLoading = { ...cache.contentLoading }
    delete newContentLoading[filePath]
    
    clientCache.value[eqpId] = { ...cache, openTabs: newTabs, contents: newContents, contentLoading: newContentLoading }
    
    // Switch to another tab if current was closed
    if (activeTabId.value === filePath) {
      activeTabId.value = newTabs.length > 0 ? newTabs[newTabs.length - 1].filePath : null
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
    activeTabId.value = null
    
    // Load if not already loaded
    const cache = clientCache.value[eqpId]
    if (cache && !cache.files.length && !cache.filesLoading) {
      await loadFileList(eqpId)
    }
    
    // Restore last active tab
    if (cache?.openTabs?.length > 0) {
      activeTabId.value = cache.openTabs[cache.openTabs.length - 1].filePath
    }
  }
  
  function closeLogViewer() {
    isOpen.value = false
    selectedClients.value = []
    activeClientId.value = null
    activeSourceId.value = null
    activeTabId.value = null
    clientCache.value = {}
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
    isMultiMode,
    clientStatuses,
    totalOpenFiles,
    
    // Constants
    MAX_OPEN_FILES,
    MAX_CONCURRENT_TAILS,
    
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
