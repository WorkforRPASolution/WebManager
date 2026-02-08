import { ref, computed } from 'vue'
import { clientConfigApi } from '../api'

export function useConfigManager() {
  // State
  const isOpen = ref(false)
  const sourceClient = ref(null)
  const configFiles = ref([])
  const configSettings = ref([])
  const activeFileId = ref(null)
  const editedContents = ref({})   // { fileId: content }
  const originalContents = ref({}) // { fileId: content }
  const loading = ref(false)
  const saving = ref(false)
  const showDiff = ref(false)
  const showRollout = ref(false)
  const error = ref(null)

  // Computed
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

  // Methods
  async function openConfig(client) {
    sourceClient.value = client
    isOpen.value = true
    loading.value = true
    error.value = null
    showDiff.value = false
    showRollout.value = false
    editedContents.value = {}
    originalContents.value = {}
    configFiles.value = []

    try {
      // Load config settings first
      const settingsRes = await clientConfigApi.getSettings()
      configSettings.value = settingsRes.data

      // Load config files via FTP
      const configsRes = await clientConfigApi.getConfigs(client.eqpId || client.id)
      configFiles.value = configsRes.data

      // Initialize contents
      for (const file of configFiles.value) {
        const content = file.content || ''
        editedContents.value[file.fileId] = content
        originalContents.value[file.fileId] = content
      }

      // Select first file
      if (configFiles.value.length > 0) {
        activeFileId.value = configFiles.value[0].fileId
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || 'Failed to load configs'
    } finally {
      loading.value = false
    }
  }

  function closeConfig() {
    isOpen.value = false
    sourceClient.value = null
    configFiles.value = []
    editedContents.value = {}
    originalContents.value = {}
    activeFileId.value = null
    showDiff.value = false
    showRollout.value = false
    error.value = null
  }

  function selectFile(fileId) {
    activeFileId.value = fileId
    showDiff.value = false
  }

  function updateContent(content) {
    if (activeFileId.value) {
      editedContents.value[activeFileId.value] = content
    }
  }

  async function saveCurrentFile() {
    if (!activeFileId.value || !sourceClient.value) return

    saving.value = true
    error.value = null

    try {
      const content = editedContents.value[activeFileId.value]

      // Validate JSON before saving
      try {
        JSON.parse(content)
      } catch {
        error.value = 'Invalid JSON format. Please fix syntax errors before saving.'
        saving.value = false
        return
      }

      const eqpId = sourceClient.value.eqpId || sourceClient.value.id
      await clientConfigApi.updateConfig(eqpId, activeFileId.value, content)

      // Update original to match saved content
      originalContents.value[activeFileId.value] = content

      return { success: true }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || 'Failed to save config'
      return { success: false, error: error.value }
    } finally {
      saving.value = false
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
    toggleDiff,
    toggleRollout
  }
}
