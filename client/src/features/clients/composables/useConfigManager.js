import { ref, computed } from 'vue'
import { clientConfigApi } from '../api'

export function useConfigManager() {
  // Multi-client state
  const selectedClients = ref([])
  const activeClientId = ref(null)
  const clientCache = ref({})  // { [eqpId]: { configFiles, editedContents, originalContents, loading, error, loaded } }

  // Shared state
  const isOpen = ref(false)
  const configSettings = ref([])
  const activeFileId = ref(null)
  const saving = ref(false)
  const showDiff = ref(false)
  const showRollout = ref(false)
  const viewMode = ref('json') // 'json' | 'form'
  const currentAgentGroup = ref(null)
  const agentVersions = ref({})

  // Backup state
  const backups = ref([])
  const loadingBackups = ref(false)
  const backupError = ref(null)

  // Derived from cache for active client
  const sourceClient = computed(() =>
    selectedClients.value.find(c => (c.eqpId || c.id) === activeClientId.value) || null
  )

  const configFiles = computed(() =>
    clientCache.value[activeClientId.value]?.configFiles || []
  )

  const editedContents = computed(() =>
    clientCache.value[activeClientId.value]?.editedContents || {}
  )

  const originalContents = computed(() =>
    clientCache.value[activeClientId.value]?.originalContents || {}
  )

  const loading = computed(() =>
    clientCache.value[activeClientId.value]?.loading || false
  )

  const error = computed(() =>
    clientCache.value[activeClientId.value]?.error || null
  )

  // Existing computed (derive from cache-based computed above, no changes needed)
  const activeFile = computed(() =>
    configFiles.value.find(f => f.fileId === activeFileId.value) || null
  )

  const activeContent = computed(() =>
    editedContents.value[activeFileId.value] ?? ''
  )

  const activeOriginalContent = computed(() =>
    originalContents.value[activeFileId.value] ?? ''
  )

  const hasChanges = computed(() => {
    for (const file of configFiles.value) {
      if (editedContents.value[file.fileId] !== originalContents.value[file.fileId]) {
        return true
      }
    }
    return false
  })

  const activeFileHasChanges = computed(() => {
    if (!activeFileId.value) return false
    return editedContents.value[activeFileId.value] !== originalContents.value[activeFileId.value]
  })

  const changedFileIds = computed(() => {
    const ids = new Set()
    for (const file of configFiles.value) {
      if (editedContents.value[file.fileId] !== originalContents.value[file.fileId]) {
        ids.add(file.fileId)
      }
    }
    return ids
  })

  // Multi-client computed
  const isMultiMode = computed(() => selectedClients.value.length > 1)

  const clientStatuses = computed(() =>
    selectedClients.value.map(c => {
      const id = c.eqpId || c.id
      const cache = clientCache.value[id]
      return {
        eqpId: id,
        eqpModel: c.eqpModel,
        status: cache?.loaded ? 'loaded' : cache?.loading ? 'loading' : cache?.error ? 'error' : 'pending',
        hasChanges: cache?.loaded
          ? Object.keys(cache.editedContents).some(fid => cache.editedContents[fid] !== cache.originalContents[fid])
          : false
      }
    })
  )

  const activeAgentVersion = computed(() => agentVersions.value[activeClientId.value] || '')

  // Invalidate cache for specific clients so they reload on next access
  function invalidateClientCaches(eqpIds) {
    for (const eqpId of eqpIds) {
      const entry = clientCache.value[eqpId]
      if (entry) {
        clientCache.value[eqpId] = {
          ...entry,
          loaded: false,
          loading: false
        }
      }
    }
  }

  // Refresh configs for deployed target clients (invalidate + reload active)
  async function refreshAfterDeploy(eqpIds) {
    invalidateClientCaches(eqpIds)
    // If active client was a deploy target, reload it immediately
    if (eqpIds.includes(activeClientId.value)) {
      await loadClientConfigs(activeClientId.value)
    }
  }

  // Internal: load configs for a single client into cache
  async function loadClientConfigs(eqpId) {
    const entry = clientCache.value[eqpId]
    if (entry?.loaded || entry?.loading) return

    clientCache.value[eqpId] = {
      ...clientCache.value[eqpId],
      loading: true,
      error: null
    }

    try {
      const configsRes = await clientConfigApi.getConfigs(eqpId, currentAgentGroup.value)
      const files = configsRes.data
      const edited = {}
      const original = {}
      for (const file of files) {
        const content = file.content || ''
        edited[file.fileId] = content
        original[file.fileId] = content
      }

      clientCache.value[eqpId] = {
        configFiles: files,
        editedContents: edited,
        originalContents: original,
        loading: false,
        error: null,
        loaded: true
      }
      // agentVersion은 openConfig 시 alive status에서 초기화됨
    } catch (err) {
      clientCache.value[eqpId] = {
        ...clientCache.value[eqpId],
        loading: false,
        error: err.response?.data?.message || err.message || 'Failed to load configs',
        loaded: false
      }
    }
  }

  // Open config for one or multiple clients
  async function openConfig(clients, agentGroup) {
    const clientList = Array.isArray(clients) ? clients : [clients]
    selectedClients.value = clientList
    activeClientId.value = clientList[0].eqpId || clientList[0].id
    currentAgentGroup.value = agentGroup
    showDiff.value = false
    showRollout.value = false
    activeFileId.value = null

    // Initialize cache entries + populate version from alive status data
    clientCache.value = {}
    for (const c of clientList) {
      const id = c.eqpId || c.id
      clientCache.value[id] = {
        configFiles: [],
        editedContents: {},
        originalContents: {},
        loading: false,
        error: null,
        loaded: false
      }
      agentVersions.value[id] = c.agentVersion || ''
    }

    try {
      // Load config settings first
      const settingsRes = await clientConfigApi.getSettings(agentGroup)
      configSettings.value = settingsRes.data

      // If no config settings registered, show error and don't open modal
      if (!configSettings.value || configSettings.value.length === 0) {
        // Store error in the first client's cache so error computed picks it up
        clientCache.value[activeClientId.value] = {
          ...clientCache.value[activeClientId.value],
          error: 'No config file settings found for this agent group. Please register settings in "Config File Settings" first.'
        }
        return
      }

      // Open modal only after confirming settings exist
      isOpen.value = true

      // Load first client's configs eagerly
      await loadClientConfigs(activeClientId.value)

      // Select first file of the loaded client
      const firstClientFiles = clientCache.value[activeClientId.value]?.configFiles || []
      if (firstClientFiles.length > 0) {
        activeFileId.value = firstClientFiles[0].fileId
      }
    } catch (err) {
      clientCache.value[activeClientId.value] = {
        ...clientCache.value[activeClientId.value],
        error: err.response?.data?.message || err.message || 'Failed to load configs'
      }
    }
  }

  // Switch to a different client
  async function switchClient(eqpId) {
    activeClientId.value = eqpId
    showDiff.value = false
    showRollout.value = false

    // Load if not cached
    await loadClientConfigs(eqpId)

    // Reset active file to the first file of this client
    const files = clientCache.value[eqpId]?.configFiles || []
    activeFileId.value = files.length > 0 ? files[0].fileId : null
  }

  function closeConfig() {
    isOpen.value = false
    selectedClients.value = []
    activeClientId.value = null
    clientCache.value = {}
    configSettings.value = []
    activeFileId.value = null
    showDiff.value = false
    showRollout.value = false
    viewMode.value = 'json'
    saving.value = false
  }

  function selectFile(fileId) {
    activeFileId.value = fileId
    showDiff.value = false
  }

  function updateContent(content) {
    if (activeFileId.value && activeClientId.value) {
      const entry = clientCache.value[activeClientId.value]
      if (entry) {
        entry.editedContents[activeFileId.value] = content
        // Trigger reactivity by replacing the cache entry
        clientCache.value[activeClientId.value] = { ...entry }
      }
    }
  }

  async function saveCurrentFile() {
    if (!activeFileId.value || !activeClientId.value) return

    // Capture IDs at call time to avoid race conditions if user switches tab/client during save
    const eqpId = activeClientId.value
    const fileId = activeFileId.value

    saving.value = true
    const entry = clientCache.value[eqpId]
    if (entry) {
      entry.error = null
      clientCache.value[eqpId] = { ...entry }
    }

    try {
      const content = entry.editedContents[fileId]

      // Validate JSON before saving
      try {
        JSON.parse(content)
      } catch {
        const errMsg = 'Invalid JSON format. Please fix syntax errors before saving.'
        if (entry) {
          entry.error = errMsg
          clientCache.value[eqpId] = { ...entry }
        }
        saving.value = false
        return
      }

      await clientConfigApi.updateConfig(eqpId, fileId, content, currentAgentGroup.value)

      // Update original to match saved content
      const latestEntry = clientCache.value[eqpId]
      if (latestEntry) {
        latestEntry.originalContents[fileId] = content
        clientCache.value[eqpId] = { ...latestEntry }
      }

      return { success: true }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to save config'
      const latestEntry = clientCache.value[eqpId]
      if (latestEntry) {
        latestEntry.error = errMsg
        clientCache.value[eqpId] = { ...latestEntry }
      }
      return { success: false, error: errMsg }
    } finally {
      saving.value = false
    }
  }

  function discardCurrentFile() {
    if (!activeFileId.value || !activeClientId.value) return
    const eqpId = activeClientId.value
    const fileId = activeFileId.value
    const entry = clientCache.value[eqpId]
    if (entry) {
      const newEntry = {
        ...entry,
        editedContents: {
          ...entry.editedContents,
          [fileId]: entry.originalContents[fileId]
        }
      }
      // Replace entire ref value to guarantee reactivity propagation
      clientCache.value = { ...clientCache.value, [eqpId]: newEntry }
    }
  }

  function toggleDiff() {
    showDiff.value = !showDiff.value
  }

  function toggleRollout() {
    showRollout.value = !showRollout.value
  }

  async function loadBackups() {
    if (!activeFileId.value || !activeClientId.value) return
    loadingBackups.value = true
    backupError.value = null
    try {
      const res = await clientConfigApi.getBackups(activeClientId.value, activeFileId.value, currentAgentGroup.value)
      backups.value = res.data
    } catch (err) {
      backupError.value = err.response?.data?.error || err.message || 'Failed to load backups'
      backups.value = []
    } finally {
      loadingBackups.value = false
    }
  }

  async function restoreBackup(backupName) {
    if (!activeFileId.value || !activeClientId.value) return
    backupError.value = null
    try {
      const res = await clientConfigApi.getBackupContent(
        activeClientId.value, activeFileId.value, backupName, currentAgentGroup.value
      )
      updateContent(res.data.content)
      return { success: true }
    } catch (err) {
      backupError.value = err.response?.data?.error || err.message || 'Failed to restore backup'
      return { success: false, error: backupError.value }
    }
  }

  return {
    // State
    isOpen,
    sourceClient,
    configFiles,
    configSettings,
    activeFileId,
    editedContents,
    originalContents,
    loading,
    saving,
    showDiff,
    showRollout,
    viewMode,
    error,
    currentAgentGroup,
    agentVersions,

    // Multi-client state
    selectedClients,
    activeClientId,
    isMultiMode,
    clientStatuses,

    // Backup state
    backups,
    loadingBackups,
    backupError,

    // Computed
    activeFile,
    activeContent,
    activeOriginalContent,
    hasChanges,
    activeFileHasChanges,
    changedFileIds,
    activeAgentVersion,

    // Methods
    openConfig,
    closeConfig,
    selectFile,
    updateContent,
    saveCurrentFile,
    discardCurrentFile,
    switchClient,
    toggleDiff,
    toggleRollout,
    loadBackups,
    restoreBackup,
    refreshAfterDeploy
  }
}
