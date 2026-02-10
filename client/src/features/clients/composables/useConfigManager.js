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
  const currentAgentGroup = ref(null)

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

    // Initialize cache entries
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

    saving.value = true
    const entry = clientCache.value[activeClientId.value]
    if (entry) {
      entry.error = null
      clientCache.value[activeClientId.value] = { ...entry }
    }

    try {
      const content = entry.editedContents[activeFileId.value]

      // Validate JSON before saving
      try {
        JSON.parse(content)
      } catch {
        const errMsg = 'Invalid JSON format. Please fix syntax errors before saving.'
        if (entry) {
          entry.error = errMsg
          clientCache.value[activeClientId.value] = { ...entry }
        }
        saving.value = false
        return
      }

      await clientConfigApi.updateConfig(activeClientId.value, activeFileId.value, content, currentAgentGroup.value)

      // Update original to match saved content
      if (entry) {
        entry.originalContents[activeFileId.value] = content
        clientCache.value[activeClientId.value] = { ...entry }
      }

      return { success: true }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to save config'
      if (entry) {
        entry.error = errMsg
        clientCache.value[activeClientId.value] = { ...entry }
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
    error,
    currentAgentGroup,

    // Multi-client state
    selectedClients,
    activeClientId,
    isMultiMode,
    clientStatuses,

    // Computed
    activeFile,
    activeContent,
    activeOriginalContent,
    hasChanges,
    activeFileHasChanges,
    changedFileIds,

    // Methods
    openConfig,
    closeConfig,
    selectFile,
    updateContent,
    saveCurrentFile,
    discardCurrentFile,
    switchClient,
    toggleDiff,
    toggleRollout
  }
}
