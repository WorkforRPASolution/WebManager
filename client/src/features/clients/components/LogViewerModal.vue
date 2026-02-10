<template>
  <Teleport to="body">
    <div
      v-if="logViewer.isOpen.value"
      class="fixed inset-0 z-50"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="handleClose"
      ></div>

      <!-- Modal -->
      <div
        ref="modalRef"
        class="fixed bg-white dark:bg-dark-card rounded-lg shadow-xl flex flex-col overflow-hidden"
        :style="modalStyle"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0 select-none" :class="{ 'cursor-move': !isMaximized }" @mousedown="startDrag" @dblclick="toggleMaximize">
          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Log Viewer - {{ clientLabel }}
            </h3>
          </div>
          <div class="flex items-center gap-2">
            <!-- Maximize/Restore toggle -->
            <button
              @click="toggleMaximize"
              @mousedown.stop
              class="p-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              :title="isMaximized ? 'Restore' : 'Maximize'"
            >
              <svg v-if="!isMaximized" class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="2" width="12" height="12" rx="1" />
              </svg>
              <svg v-else class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="4" y="1" width="11" height="11" rx="1" />
                <rect x="1" y="4" width="11" height="11" rx="1" />
              </svg>
            </button>
            <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
            <button
              @click="handleClose"
              @mousedown.stop
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

              <!-- File View Section (collapsible) -->
              <div class="flex flex-col overflow-hidden" :style="fileViewCollapsed ? 'height: 28px' : 'flex: 1'">
                <!-- File View Header (integrates tab bar) -->
                <div class="flex items-center border-b border-gray-200 dark:border-dark-border bg-gray-100 dark:bg-dark-bg px-2 shrink-0">
                  <button @click="fileViewCollapsed = !fileViewCollapsed" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mr-1 shrink-0">
                    <svg class="w-3.5 h-3.5 transition-transform" :class="fileViewCollapsed ? '-rotate-90' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <span class="text-xs font-medium text-gray-600 dark:text-gray-400 mr-2 shrink-0">Content</span>

                  <!-- Tab bar with scroll navigation -->
                  <div v-if="!fileViewCollapsed && (logViewer.openTabs.value.length > 0 || tailTabKeys.length > 0)" class="flex items-center flex-1 min-w-0">
                    <!-- Left scroll button -->
                    <button
                      v-show="tabScrollState.canScrollLeft"
                      @click="scrollTabs('left')"
                      class="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
                      title="Scroll left"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <!-- Scrollable tab container -->
                    <div
                      ref="tabContainerRef"
                      @wheel.prevent="handleTabWheel"
                      @scroll="updateTabScrollState"
                      class="flex items-center gap-1 flex-1 overflow-x-auto min-w-0 scrollbar-hide"
                    >
                      <!-- File tabs (global, composite key) -->
                      <button
                        v-for="tab in logViewer.openTabs.value"
                        :key="logViewer.makeTabKey(tab.eqpId, tab.filePath)"
                        @click="logViewer.activeTabId.value = logViewer.makeTabKey(tab.eqpId, tab.filePath)"
                        :class="[
                          'group relative px-3 py-1.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap',
                          logViewer.activeTabId.value === logViewer.makeTabKey(tab.eqpId, tab.filePath)
                            ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                            : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                        ]"
                      >
                        <span v-if="logViewer.isMultiMode.value" class="text-gray-400 mr-1">{{ tab.eqpId }} &gt;</span>
                        {{ tab.fileName }}
                        <span
                          @click.stop="logViewer.closeTab(tab.eqpId, tab.filePath)"
                          class="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >&times;</span>
                      </button>
                      <!-- Tail tabs -->
                      <button
                        v-for="tKey in tailTabKeys"
                        :key="'tail-' + tKey"
                        @click="logViewer.activeTabId.value = 'tail:' + tKey"
                        :class="[
                          'group relative px-3 py-1.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap flex items-center',
                          logViewer.activeTabId.value === 'tail:' + tKey
                            ? 'text-green-600 dark:text-green-400 border-green-500'
                            : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                        ]"
                      >
                        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block mr-1.5"></span>
                        <span v-if="logViewer.isMultiMode.value" class="text-gray-400 mr-1">{{ tailKeyToEqpId(tKey) }} &gt;</span>
                        {{ tailKeyToFileName(tKey) }}
                        <span
                          @click.stop="handleStopSingleTail(tKey)"
                          class="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >&times;</span>
                      </button>
                    </div>

                    <!-- Right scroll button -->
                    <button
                      v-show="tabScrollState.canScrollRight"
                      @click="scrollTabs('right')"
                      class="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
                      title="Scroll right"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Editor / Content area (hidden when collapsed) -->
                <div v-show="!fileViewCollapsed" class="flex-1 overflow-hidden">
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
                        ref="monacoEditorRef"
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
              </div>

              <!-- Vertical Drag Divider -->
              <div
                v-if="showSearch"
                class="h-1 shrink-0 cursor-row-resize bg-gray-200 dark:bg-dark-border hover:bg-primary-300 dark:hover:bg-primary-700 transition-colors"
                @mousedown="startDividerDrag"
              ></div>

              <!-- Search Section (collapsible) -->
              <div
                v-if="showSearch"
                class="flex flex-col overflow-hidden shrink-0"
                :style="searchCollapsed ? 'height: 28px' : `height: ${searchPanelHeight}px`"
              >
                <!-- Search Section Header -->
                <div class="flex items-center gap-2 px-3 py-1 border-b border-gray-200 dark:border-dark-border bg-gray-100 dark:bg-dark-bg shrink-0">
                  <button @click="searchCollapsed = !searchCollapsed" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 shrink-0">
                    <svg class="w-3.5 h-3.5 transition-transform" :class="searchCollapsed ? '-rotate-90' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <span class="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">Search</span>
                  <button @click="handleSearchClose" class="ml-auto p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <!-- Search Panel Content (hidden when collapsed) -->
                <div v-show="!searchCollapsed" class="flex-1 overflow-hidden">
                  <LogSearchPanel
                    :global-contents="searchGlobalContents"
                    :global-open-tabs="searchGlobalOpenTabs"
                    :selected-clients="logViewer.selectedClients.value"
                    @go-to="handleSearchGoTo"
                    @searched="handleSearched"
                    @close="handleSearchClose"
                  />
                </div>
              </div>
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
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import * as monaco from 'monaco-editor'
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

// Computed wrappers for LogSearchPanel props (safe null handling)
const searchGlobalContents = computed(() => props.logViewer.globalContents?.value || {})
const searchGlobalOpenTabs = computed(() => props.logViewer.openTabs?.value || [])

// Local state
const selectedSourceId = ref(null)
const showSearch = ref(false)
const fileViewCollapsed = ref(false)
const searchCollapsed = ref(false)
const searchPanelHeight = ref(200)
const monacoEditorRef = ref(null)
const tabContainerRef = ref(null)
const tabScrollState = reactive({ canScrollLeft: false, canScrollRight: false })
let currentDecorations = []

// Divider drag state
let isDividerDragging = false
let dividerStartY = 0
let dividerStartHeight = 0

const startDividerDrag = (e) => {
  isDividerDragging = true
  dividerStartY = e.clientY
  dividerStartHeight = searchPanelHeight.value
  e.preventDefault()
}

const doDividerDrag = (e) => {
  if (!isDividerDragging) return
  const delta = dividerStartY - e.clientY
  searchPanelHeight.value = Math.max(60, Math.min(500, dividerStartHeight + delta))
}

const stopDividerDrag = () => { isDividerDragging = false }

// Tail stream composable
const tailStream = useLogTailStream()

// Sync local select with composable state
watch(() => props.logViewer.activeSourceId.value, (val) => {
  selectedSourceId.value = val
}, { immediate: true })

// Modal sizing
const modalRef = ref(null)
const isMaximized = ref(false)
const modalPos = reactive({ x: null, y: null })
const customWidth = ref(null)
const customHeight = ref(null)

const DEFAULT_WIDTH = 1000
const DEFAULT_HEIGHT = 650

// Drag state
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let dragStartPosX = 0
let dragStartPosY = 0

const sidebarExtra = computed(() => props.logViewer.isMultiMode.value ? 192 : 0)

const modalStyle = computed(() => {
  if (isMaximized.value) {
    return {
      left: '2.5vw',
      top: '2.5vh',
      width: '95vw',
      height: '95vh'
    }
  }

  const w = (customWidth.value || DEFAULT_WIDTH) + sidebarExtra.value
  const h = customHeight.value || DEFAULT_HEIGHT

  return {
    left: modalPos.x !== null ? `${modalPos.x}px` : `calc(50vw - ${w / 2}px)`,
    top: modalPos.y !== null ? `${modalPos.y}px` : `calc(50vh - ${h / 2}px)`,
    width: `${w}px`,
    height: `${h}px`,
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
  return props.logViewer.activeTabLoading?.value || false
})

// Tail-related computed properties
const tailTabKeys = computed(() => {
  return [...tailStream.tailBuffers.keys()]
})

const activeTailBuffer = computed(() => {
  const tabId = props.logViewer.activeTabId.value
  if (!tabId || !tabId.startsWith('tail:')) return null
  const bufferKey = tabId.slice(5)  // 'tail:' removed -> 'eqpId:filePath'
  return tailStream.tailBuffers.get(bufferKey) || null
})

const activeTabFileName = computed(() => {
  const tabId = props.logViewer.activeTabId.value
  if (!tabId) return ''
  if (tabId.startsWith('tail:')) {
    // tail:eqpId:filePath -> extract filePath part
    const bufferKey = tabId.slice(5)
    return tailKeyToFileName(bufferKey)
  }
  // composite key eqpId:filePath -> extract filePath part
  const parsed = props.logViewer.parseTabKey(tabId)
  return parsed.filePath.split('/').pop()
})

// Helper: extract eqpId from buffer key (eqpId:filePath)
function tailKeyToEqpId(key) {
  const idx = key.indexOf(':')
  return idx >= 0 ? key.substring(0, idx) : ''
}

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

const toggleMaximize = () => {
  isMaximized.value = !isMaximized.value
}

const handleClose = () => {
  modalPos.x = null
  modalPos.y = null
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

  // Activate first tail tab (tail:eqpId:filePath)
  const firstPath = [...selected][0]
  props.logViewer.activeTabId.value = `tail:${eqpId}:${firstPath}`
}

const handleStopTail = () => {
  tailStream.stopTailing()
  clearTailingFlags()
  // Switch to last open file tab if available
  const tabs = props.logViewer.openTabs.value
  if (tabs.length > 0) {
    const last = tabs[tabs.length - 1]
    props.logViewer.activeTabId.value = props.logViewer.makeTabKey(last.eqpId, last.filePath)
  } else {
    props.logViewer.activeTabId.value = null
  }
}

const handleClearTail = () => {
  const tabId = props.logViewer.activeTabId.value
  if (tabId?.startsWith('tail:')) {
    const bufferKey = tabId.slice(5) // 'eqpId:filePath'
    const { eqpId, filePath } = props.logViewer.parseTabKey(bufferKey)
    tailStream.clearBuffer(eqpId, filePath)
  }
}

const handleStopSingleTail = (bufferKey) => {
  const { eqpId, filePath } = props.logViewer.parseTabKey(bufferKey)

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
  if (activeTab === `tail:${bufferKey}`) {
    // Try to switch to another tail tab or file tab
    const remainingTailKeys = [...tailStream.tailBuffers.keys()]
    if (remainingTailKeys.length > 0) {
      props.logViewer.activeTabId.value = 'tail:' + remainingTailKeys[0]
    } else {
      const tabs = props.logViewer.openTabs.value
      if (tabs.length > 0) {
        const last = tabs[tabs.length - 1]
        props.logViewer.activeTabId.value = props.logViewer.makeTabKey(last.eqpId, last.filePath)
      } else {
        props.logViewer.activeTabId.value = null
      }
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
  // Switch client in sidebar for file list display
  if (eqpId !== props.logViewer.activeClientId.value) {
    props.logViewer.switchClient(eqpId)
  }
  // Activate the tab (using composite key)
  const tabKey = props.logViewer.makeTabKey(eqpId, filePath)
  const existing = props.logViewer.openTabs.value.find(t =>
    props.logViewer.makeTabKey(t.eqpId, t.filePath) === tabKey
  )
  if (!existing) {
    const cache = props.logViewer.clientCache.value[eqpId]
    const file = cache?.files?.find(f => f.path === filePath)
    if (file) {
      props.logViewer.openFile(eqpId, file)
    }
  } else {
    props.logViewer.activeTabId.value = tabKey
  }
  // Scroll to line and apply highlights for current tab
  nextTick(() => {
    applyHighlights()
    scrollToLine(lineNum)
  })
}

// Store search results for highlight application on tab switch
let lastSearchResults = []

function handleSearched(results) {
  lastSearchResults = results || []
  applyHighlights()
}

function handleSearchClose() {
  showSearch.value = false
  lastSearchResults = []
  clearHighlights()
}

function applyHighlights() {
  if (!monacoEditorRef.value) return
  const editor = monacoEditorRef.value.getEditor()
  if (!editor) return

  const activeTabKey = props.logViewer.activeTabId.value
  if (!activeTabKey) {
    currentDecorations = editor.deltaDecorations(currentDecorations, [])
    return
  }

  // Filter search results for current active tab
  const { eqpId, filePath } = props.logViewer.parseTabKey(activeTabKey)
  const matchingLines = lastSearchResults.filter(r => r.eqpId === eqpId && r.filePath === filePath)

  if (matchingLines.length === 0) {
    currentDecorations = editor.deltaDecorations(currentDecorations, [])
    return
  }

  // Create decorations for all matching lines
  const decorations = matchingLines.map(r => ({
    range: new monaco.Range(r.lineNum, 1, r.lineNum, 1),
    options: {
      isWholeLine: true,
      className: 'log-search-highlight-line',
      overviewRuler: {
        color: '#fbbf24',
        position: monaco.editor.OverviewRulerLane.Full
      }
    }
  }))

  currentDecorations = editor.deltaDecorations(currentDecorations, decorations)
}

function clearHighlights() {
  if (!monacoEditorRef.value) return
  const editor = monacoEditorRef.value.getEditor()
  if (editor) {
    currentDecorations = editor.deltaDecorations(currentDecorations, [])
  }
}

function scrollToLine(lineNum) {
  if (!monacoEditorRef.value) return
  const editor = monacoEditorRef.value.getEditor()
  if (!editor) return
  editor.revealLineInCenter(lineNum)
}

// Re-apply highlights when switching tabs
watch(() => props.logViewer.activeTabId.value, () => {
  if (lastSearchResults.length > 0) {
    nextTick(() => applyHighlights())
  }
})

// Update tab scroll state when tabs change
watch(() => props.logViewer.openTabs.value.length, () => {
  nextTick(() => updateTabScrollState())
}, { flush: 'post' })

// Tab scroll navigation
function updateTabScrollState() {
  const el = tabContainerRef.value
  if (!el) {
    tabScrollState.canScrollLeft = false
    tabScrollState.canScrollRight = false
    return
  }
  tabScrollState.canScrollLeft = el.scrollLeft > 0
  tabScrollState.canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

function scrollTabs(direction) {
  const el = tabContainerRef.value
  if (!el) return
  const amount = 200
  el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
}

function handleTabWheel(e) {
  const el = tabContainerRef.value
  if (!el) return
  el.scrollLeft += e.deltaY || e.deltaX
  updateTabScrollState()
}

// Drag functionality
const startDrag = (e) => {
  if (isMaximized.value) return
  isDragging = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  const rect = modalRef.value.getBoundingClientRect()
  dragStartPosX = rect.left
  dragStartPosY = rect.top
  e.preventDefault()
}

const doDrag = (e) => {
  if (!isDragging) return
  modalPos.x = Math.max(0, Math.min(window.innerWidth - 100, dragStartPosX + (e.clientX - dragStartX)))
  modalPos.y = Math.max(0, Math.min(window.innerHeight - 50, dragStartPosY + (e.clientY - dragStartY)))
}

const stopDrag = () => { isDragging = false }

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
  // Anchor top-left so resize doesn't shift position
  modalPos.x = rect.left
  modalPos.y = rect.top
  e.preventDefault()
}

const doResize = (e) => {
  if (!isResizing) return
  customWidth.value = Math.max(500, Math.min(window.innerWidth * 0.95, startWidth + (e.clientX - startX)))
  customHeight.value = Math.max(400, Math.min(window.innerHeight * 0.95, startHeight + (e.clientY - startY)))
}

const stopResize = () => { isResizing = false }

// Combined mouse handlers
const onMouseMove = (e) => {
  doDrag(e)
  doResize(e)
  doDividerDrag(e)
}

const onMouseUp = () => {
  stopDrag()
  stopResize()
  stopDividerDrag()
}

// Keyboard shortcut - ESC to close
const handleKeyDown = (e) => {
  if (!props.logViewer.isOpen.value) return
  if (e.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  tailStream.stopTailing()
  tailStream.clearAllBuffers()
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style>
.log-search-highlight-line {
  background-color: rgba(251, 191, 36, 0.3) !important;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
