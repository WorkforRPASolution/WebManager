<template>
  <Teleport to="body">
    <div
      v-if="logViewer.isOpen.value"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="handleClose"
      ></div>

      <!-- Modal -->
      <div
        ref="modalRef"
        class="relative bg-white dark:bg-dark-card rounded-lg shadow-xl flex flex-col overflow-hidden"
        :style="modalStyle"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0">
          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Log Viewer - {{ clientLabel }}
            </h3>
          </div>
          <div class="flex items-center gap-2">
            <!-- Resize buttons -->
            <button
              v-for="size in ['small', 'medium', 'large']"
              :key="size"
              @click="setSize(size)"
              :class="['p-1.5 rounded transition', currentSize === size ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600']"
              :title="size.charAt(0).toUpperCase() + size.slice(1)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect :x="size === 'small' ? 6 : size === 'medium' ? 4 : 2" :y="size === 'small' ? 6 : size === 'medium' ? 4 : 2" :width="size === 'small' ? 12 : size === 'medium' ? 16 : 20" :height="size === 'small' ? 12 : size === 'medium' ? 16 : 20" rx="1" stroke-width="2" />
              </svg>
            </button>
            <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
            <button
              @click="handleClose"
              class="p-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              title="Close"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-hidden flex">
          <!-- Client sidebar (multi-mode only) -->
          <div v-if="logViewer.isMultiMode.value" class="w-48 border-r border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg flex flex-col shrink-0">
            <div class="px-3 py-2 border-b border-gray-200 dark:border-dark-border">
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clients ({{ logViewer.clientStatuses.value.length }})</span>
            </div>
            <div class="flex-1 overflow-y-auto">
              <button
                v-for="cs in logViewer.clientStatuses.value"
                :key="cs.eqpId"
                @click="logViewer.switchClient(cs.eqpId)"
                :class="[
                  'w-full text-left px-3 py-2 text-sm border-l-2 transition-colors',
                  cs.eqpId === logViewer.activeClientId.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-transparent hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-700 dark:text-gray-300'
                ]"
              >
                <div class="font-mono text-xs truncate">{{ cs.eqpId }}</div>
                <div class="flex items-center gap-1 mt-0.5">
                  <span v-if="cs.status === 'loaded'" class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  <span v-else-if="cs.status === 'loading'" class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                  <span v-else-if="cs.status === 'error'" class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  <span v-else class="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                  <span class="text-xs text-gray-400 truncate">{{ cs.eqpModel }}</span>
                </div>
              </button>
            </div>
          </div>

          <!-- Main content -->
          <div class="flex-1 overflow-hidden flex flex-col">
            <!-- Source selector + Refresh -->
            <div class="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0">
              <label class="text-sm text-gray-600 dark:text-gray-400">Source:</label>
              <select
                v-model="selectedSourceId"
                @change="logViewer.selectSource(selectedSourceId)"
                class="px-2 py-1 text-sm border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-card text-gray-900 dark:text-white"
              >
                <option v-for="src in logViewer.logSettings.value" :key="src.sourceId" :value="src.sourceId">{{ src.name }}</option>
              </select>
              <button
                @click="logViewer.loadFileList(logViewer.activeClientId.value)"
                class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                title="Refresh"
              >
                <svg class="w-4 h-4" :class="{'animate-spin': logViewer.filesLoading.value}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            <!-- Split: File list (top) + Editor (bottom) -->
            <div class="flex-1 overflow-hidden flex flex-col">
              <!-- File List -->
              <LogFileList
                :files="logViewer.files.value"
                :loading="logViewer.filesLoading.value"
                :error="logViewer.filesError.value"
                :selected-files="logViewer.selectedFiles.value"
                :tailing-files="logViewer.tailingFiles.value"
                @file-click="(file) => logViewer.openFile(logViewer.activeClientId.value, file)"
                @toggle-select="(path) => logViewer.toggleFileSelection(logViewer.activeClientId.value, path)"
                @select-all="(val) => logViewer.selectAllFiles(logViewer.activeClientId.value, val)"
                @delete-selected="handleDeleteSelected"
                @tail-selected="handleTailSelected"
              />

              <!-- Tab bar -->
              <div v-if="logViewer.openTabs.value.length > 0 || tailTabKeys.length > 0" class="flex items-center border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-2 shrink-0">
                <div class="flex items-center gap-1 flex-1 overflow-x-auto">
                  <!-- File tabs -->
                  <button
                    v-for="tab in logViewer.openTabs.value"
                    :key="tab.filePath"
                    @click="logViewer.activeTabId.value = tab.filePath"
                    :class="[
                      'group relative px-3 py-1.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap',
                      logViewer.activeTabId.value === tab.filePath
                        ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                        : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                    ]"
                  >
                    {{ tab.fileName }}
                    <span
                      @click.stop="logViewer.closeTab(logViewer.activeClientId.value, tab.filePath)"
                      class="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >&times;</span>
                  </button>
                  <!-- Tail tabs -->
                  <button
                    v-for="tKey in tailTabKeys"
                    :key="'tail-' + tKey"
                    @click="logViewer.activeTabId.value = 'tail:' + tailKeyToFilePath(tKey)"
                    :class="[
                      'group relative px-3 py-1.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap flex items-center',
                      logViewer.activeTabId.value === 'tail:' + tailKeyToFilePath(tKey)
                        ? 'text-green-600 dark:text-green-400 border-green-500'
                        : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                    ]"
                  >
                    <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block mr-1.5"></span>
                    {{ tailKeyToFileName(tKey) }}
                    <span
                      @click.stop="handleStopSingleTail(tKey)"
                      class="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >&times;</span>
                  </button>
                </div>
              </div>

              <!-- Editor / Content area -->
              <div class="flex-1 overflow-hidden">
                <!-- Loading -->
                <div v-if="isActiveTabLoading" class="h-full flex items-center justify-center">
                  <svg class="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>

                <!-- Tail View -->
                <div v-else-if="activeTailBuffer" class="h-full">
                  <LogTailView
                    :lines="activeTailBuffer.lines"
                    :file-name="activeTabFileName"
                    :truncated="activeTailBuffer.truncated"
                    :error="activeTailBuffer.error"
                    @stop="handleStopTail"
                    @clear="handleClearTail"
                  />
                </div>

                <!-- Monaco Editor (read-only) -->
                <div v-else-if="logViewer.activeTabContent.value" class="h-full p-1">
                  <div class="w-full h-full rounded border border-gray-300 dark:border-dark-border overflow-hidden">
                    <MonacoEditor
                      :modelValue="logViewer.activeTabContent.value"
                      language="plaintext"
                      :theme="isDark ? 'vs-dark' : 'vs'"
                      :read-only="true"
                      :options="{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', automaticLayout: true, scrollBeyondLastLine: false, readOnly: true }"
                    />
                  </div>
                </div>

                <!-- No tab open -->
                <div v-else class="h-full flex items-center justify-center">
                  <p class="text-gray-500 dark:text-gray-400">Click a file to view its content</p>
                </div>
              </div>

              <!-- Search Panel (collapsible) -->
              <LogSearchPanel
                v-if="showSearch"
                :client-cache="logViewer.clientCache.value"
                :selected-clients="logViewer.selectedClients.value"
                @go-to="handleSearchGoTo"
                @close="showSearch = false"
              />
            </div>
          </div>
        </div>

        <!-- Status Bar -->
        <div class="flex items-center justify-between px-4 py-1.5 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-xs text-gray-500 dark:text-gray-400 shrink-0">
          <div class="flex items-center gap-4">
            <span>{{ logViewer.totalOpenFiles.value }} files open</span>
            <span v-if="logViewer.isMultiMode.value">{{ logViewer.selectedClients.value.length }} clients</span>
            <span v-if="tailStream.tailing.value" class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Tailing
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="showSearch = !showSearch"
              :class="['px-2 py-0.5 rounded text-xs transition', showSearch ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700']"
            >
              Search All
            </button>
          </div>
        </div>

        <!-- Resize Handle -->
        <div
          class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          @mousedown="startResize"
        >
          <svg class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22H20V20H22V22ZM22 18H18V22H22V18ZM18 22H14V18H18V22ZM22 14H14V22H22V14Z" />
          </svg>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import MonacoEditor from '../../../shared/components/MonacoEditor.vue'
import LogFileList from './LogFileList.vue'
import LogSearchPanel from './LogSearchPanel.vue'
import LogTailView from './LogTailView.vue'
import { useTheme } from '../../../shared/composables/useTheme'
import { useLogTailStream } from '../composables/useLogTailStream'

const { isDark } = useTheme()

const props = defineProps({
  logViewer: { type: Object, required: true }
})

const emit = defineEmits(['close'])

// Local state
const selectedSourceId = ref(null)
const showSearch = ref(false)

// Tail stream composable
const tailStream = useLogTailStream()

// Sync local select with composable state
watch(() => props.logViewer.activeSourceId.value, (val) => {
  selectedSourceId.value = val
}, { immediate: true })

// Modal sizing (same as ConfigManagerModal)
const modalRef = ref(null)
const currentSize = ref('large')
const customWidth = ref(null)
const customHeight = ref(null)

const sizes = {
  small: { width: 700, height: 500 },
  medium: { width: 1000, height: 650 },
  large: { width: 1300, height: 800 }
}

const sidebarExtra = computed(() => props.logViewer.isMultiMode.value ? 192 : 0)

const modalStyle = computed(() => {
  const width = (customWidth.value || sizes[currentSize.value].width) + sidebarExtra.value
  const height = customHeight.value || sizes[currentSize.value].height
  return {
    width: `${width}px`,
    height: `${height}px`,
    maxWidth: '95vw',
    maxHeight: '95vh'
  }
})

const clientLabel = computed(() => {
  const client = props.logViewer.activeClient?.value
  if (!client) return ''
  const id = client.eqpId || client.id
  const model = client.eqpModel || ''
  const base = model ? `${id} (${model})` : id
  if (props.logViewer.isMultiMode.value) {
    return `${base} - ${props.logViewer.selectedClients.value.length} clients`
  }
  return base
})

const isActiveTabLoading = computed(() => {
  const cache = props.logViewer.activeCache?.value
  const tabId = props.logViewer.activeTabId.value
  if (!cache || !tabId) return false
  if (tabId.startsWith('tail:')) return false
  return cache.contentLoading?.[tabId] || false
})

// Tail-related computed properties
const tailTabKeys = computed(() => {
  return [...tailStream.tailBuffers.keys()]
})

const activeTailBuffer = computed(() => {
  const tabId = props.logViewer.activeTabId.value
  if (!tabId || !tabId.startsWith('tail:')) return null
  const filePath = tabId.slice(5)
  const eqpId = props.logViewer.activeClientId.value
  const key = tailStream.getBufferKey(eqpId, filePath)
  return tailStream.tailBuffers.get(key) || null
})

const activeTabFileName = computed(() => {
  const tabId = props.logViewer.activeTabId.value
  if (!tabId) return ''
  if (tabId.startsWith('tail:')) {
    return tabId.slice(5).split('/').pop()
  }
  return tabId.split('/').pop()
})

// Helper: extract filePath from buffer key (eqpId:filePath)
function tailKeyToFilePath(key) {
  const colonIdx = key.indexOf(':')
  return colonIdx >= 0 ? key.slice(colonIdx + 1) : key
}

// Helper: extract file name from buffer key
function tailKeyToFileName(key) {
  const filePath = tailKeyToFilePath(key)
  return filePath.split('/').pop()
}

const setSize = (size) => {
  currentSize.value = size
  customWidth.value = null
  customHeight.value = null
}

const handleClose = () => {
  tailStream.stopTailing()
  tailStream.clearAllBuffers()
  emit('close')
}

const handleDeleteSelected = async () => {
  const count = props.logViewer.selectedFiles.value.size
  if (count === 0) return
  if (!confirm(`Delete ${count} file(s)? This cannot be undone.`)) return

  await props.logViewer.deleteSelectedFiles(props.logViewer.activeClientId.value)
}

const handleTailSelected = () => {
  const eqpId = props.logViewer.activeClientId.value
  const agentGroup = props.logViewer.currentAgentGroup.value
  const selected = props.logViewer.selectedFiles.value

  if (!selected || selected.size === 0) return

  const targets = [...selected].map(filePath => ({ eqpId, filePath, agentGroup }))

  tailStream.startTailing(targets)

  // Mark files as tailing in the logViewer cache
  const cache = props.logViewer.clientCache.value[eqpId]
  if (cache) {
    const newTailing = new Set(cache.tailingFiles)
    for (const filePath of selected) {
      newTailing.add(filePath)
    }
    props.logViewer.clientCache.value[eqpId] = { ...cache, tailingFiles: newTailing }
  }

  // Activate first tail tab
  const firstPath = [...selected][0]
  props.logViewer.activeTabId.value = `tail:${firstPath}`
}

const handleStopTail = () => {
  tailStream.stopTailing()
  clearTailingFlags()
  // Switch to last open file tab if available
  const tabs = props.logViewer.openTabs.value
  if (tabs.length > 0) {
    props.logViewer.activeTabId.value = tabs[tabs.length - 1].filePath
  } else {
    props.logViewer.activeTabId.value = null
  }
}

const handleClearTail = () => {
  const tabId = props.logViewer.activeTabId.value
  if (tabId?.startsWith('tail:')) {
    const filePath = tabId.slice(5)
    const eqpId = props.logViewer.activeClientId.value
    tailStream.clearBuffer(eqpId, filePath)
  }
}

const handleStopSingleTail = (bufferKey) => {
  const filePath = tailKeyToFilePath(bufferKey)
  const eqpId = props.logViewer.activeClientId.value

  // Remove from buffer
  tailStream.tailBuffers.delete(bufferKey)

  // Remove from tailing flags
  const cache = props.logViewer.clientCache.value[eqpId]
  if (cache) {
    const newTailing = new Set(cache.tailingFiles)
    newTailing.delete(filePath)
    props.logViewer.clientCache.value[eqpId] = { ...cache, tailingFiles: newTailing }
  }

  // If no more tail buffers, stop the stream
  if (tailStream.tailBuffers.size === 0) {
    tailStream.stopTailing()
  }

  // Switch active tab if the closed one was active
  const activeTab = props.logViewer.activeTabId.value
  if (activeTab === `tail:${filePath}`) {
    // Try to switch to another tail tab or file tab
    const remainingTailKeys = [...tailStream.tailBuffers.keys()]
    if (remainingTailKeys.length > 0) {
      props.logViewer.activeTabId.value = 'tail:' + tailKeyToFilePath(remainingTailKeys[0])
    } else {
      const tabs = props.logViewer.openTabs.value
      props.logViewer.activeTabId.value = tabs.length > 0 ? tabs[tabs.length - 1].filePath : null
    }
  }
}

function clearTailingFlags() {
  const eqpId = props.logViewer.activeClientId.value
  const cache = props.logViewer.clientCache.value[eqpId]
  if (cache) {
    props.logViewer.clientCache.value[eqpId] = { ...cache, tailingFiles: new Set() }
  }
}

const handleSearchGoTo = ({ eqpId, filePath, lineNum }) => {
  // Switch client if needed
  if (eqpId !== props.logViewer.activeClientId.value) {
    props.logViewer.switchClient(eqpId)
  }
  // Open file if not already open
  const cache = props.logViewer.clientCache.value[eqpId]
  const tab = cache?.openTabs?.find(t => t.filePath === filePath)
  if (!tab) {
    const file = cache?.files?.find(f => f.path === filePath)
    if (file) {
      props.logViewer.openFile(eqpId, file)
    }
  } else {
    props.logViewer.activeTabId.value = filePath
  }
  // TODO: scroll to lineNum in Monaco
}

// Resize functionality
let isResizing = false
let startX = 0
let startY = 0
let startWidth = 0
let startHeight = 0

const startResize = (e) => {
  isResizing = true
  startX = e.clientX
  startY = e.clientY
  const rect = modalRef.value.getBoundingClientRect()
  startWidth = rect.width
  startHeight = rect.height
  e.preventDefault()
}

const doResize = (e) => {
  if (!isResizing) return
  customWidth.value = Math.max(500, Math.min(window.innerWidth * 0.95, startWidth + (e.clientX - startX)))
  customHeight.value = Math.max(400, Math.min(window.innerHeight * 0.95, startHeight + (e.clientY - startY)))
}

const stopResize = () => { isResizing = false }

// Keyboard shortcut - ESC to close
const handleKeyDown = (e) => {
  if (!props.logViewer.isOpen.value) return
  if (e.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  tailStream.stopTailing()
  tailStream.clearAllBuffers()
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>
