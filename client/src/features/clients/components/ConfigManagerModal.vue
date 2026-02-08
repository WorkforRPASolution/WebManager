<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
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
            <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Config Manager - {{ clientLabel }}
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

        <!-- Tab Bar + Toolbar -->
        <div class="flex items-center border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-2 shrink-0">
          <!-- File Tabs -->
          <div class="flex items-center gap-1 flex-1 overflow-x-auto">
            <button
              v-for="file in configFiles"
              :key="file.fileId"
              @click="selectFile(file.fileId)"
              :class="[
                'relative px-4 py-2 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap',
                activeFileId === file.fileId
                  ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                  : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
              ]"
            >
              {{ file.name }}
              <!-- Changed dot indicator -->
              <span
                v-if="changedFileIds.has(file.fileId)"
                class="absolute top-1.5 right-1 w-2 h-2 rounded-full bg-amber-500"
              ></span>
              <!-- Error indicator -->
              <span
                v-if="file.error"
                class="absolute top-1.5 right-1 w-2 h-2 rounded-full bg-red-500"
              ></span>
            </button>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-2 pl-4">
            <button
              @click="toggleDiff()"
              :disabled="!activeFile || !!activeFile.error"
              :class="[
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition',
                showDiff
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              ]"
              title="Toggle Diff View"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              Diff
            </button>

            <button
              @click="handleSave"
              :disabled="!canWrite || !activeFileHasChanges || saving"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save
            </button>

            <button
              v-if="canWrite"
              @click="toggleRollout()"
              :disabled="!activeFile || !!activeFile.error"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Deploy
            </button>
          </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-hidden flex">
          <!-- Main Editor Area -->
          <div class="flex-1 overflow-hidden">
            <!-- Loading State -->
            <div v-if="loading" class="h-full flex items-center justify-center">
              <div class="flex flex-col items-center gap-4">
                <svg class="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-gray-500 dark:text-gray-400">Loading config files via FTP...</p>
              </div>
            </div>

            <!-- Error State (file-level) -->
            <div v-else-if="activeFile?.error" class="h-full flex items-center justify-center p-8">
              <div class="text-center">
                <svg class="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p class="text-red-600 dark:text-red-400 font-medium">Failed to load {{ activeFile.name }}</p>
                <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">{{ activeFile.error }}</p>
              </div>
            </div>

            <!-- Global Error -->
            <div v-else-if="globalError && !activeFile" class="h-full flex items-center justify-center p-8">
              <div class="text-center">
                <svg class="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p class="text-red-600 dark:text-red-400">{{ globalError }}</p>
              </div>
            </div>

            <!-- Diff View -->
            <div v-else-if="showDiff && activeFile && !activeFile.error" class="h-full p-2">
              <div class="w-full h-full rounded border border-gray-300 dark:border-dark-border overflow-hidden">
                <MonacoDiffEditor
                  :original="activeOriginalContent"
                  :modified="activeContent"
                  language="json"
                  :theme="isDark ? 'vs-dark' : 'vs'"
                  :read-only="true"
                />
              </div>
            </div>

            <!-- Editor View -->
            <div v-else-if="activeFile && !activeFile.error" class="h-full p-2">
              <div class="w-full h-full rounded border border-gray-300 dark:border-dark-border overflow-hidden">
                <MonacoEditor
                  :modelValue="activeContent"
                  @update:modelValue="updateContent"
                  language="json"
                  :theme="isDark ? 'vs-dark' : 'vs'"
                  :options="{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    formatOnPaste: true,
                    readOnly: !canWrite
                  }"
                />
              </div>
            </div>

            <!-- No files -->
            <div v-else class="h-full flex items-center justify-center">
              <p class="text-gray-500 dark:text-gray-400">No config files available</p>
            </div>
          </div>

          <!-- Rollout Panel (slides in from right) -->
          <ConfigRolloutPanel
            v-if="showRollout && sourceClient"
            :source-client="sourceClient"
            :active-file="activeFile"
            :active-content="activeContent"
            :config-files="configFiles"
            @close="showRollout = false"
          />
        </div>

        <!-- Status Bar -->
        <div class="flex items-center justify-between px-4 py-1.5 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-xs text-gray-500 dark:text-gray-400 shrink-0">
          <div class="flex items-center gap-4">
            <span v-if="activeFileHasChanges" class="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Modified
            </span>
            <span v-else class="flex items-center gap-1 text-green-600 dark:text-green-400">
              <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              Saved
            </span>
          </div>
          <div class="flex items-center gap-4">
            <span v-if="error" class="text-red-500">{{ error }}</span>
            <span>{{ sourceClient?.eqpModel }}</span>
            <span>JSON</span>
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
import MonacoDiffEditor from '../../../shared/components/MonacoDiffEditor.vue'
import ConfigRolloutPanel from './ConfigRolloutPanel.vue'
import { useTheme } from '../../../shared/composables/useTheme'

const { isDark } = useTheme()

const props = defineProps({
  canWrite: { type: Boolean, default: false },
  isOpen: Boolean,
  sourceClient: Object,
  configFiles: Array,
  activeFileId: String,
  editedContents: Object,
  originalContents: Object,
  loading: Boolean,
  saving: Boolean,
  showDiff: Boolean,
  showRollout: { type: Boolean, default: false },
  error: String,
  activeFile: Object,
  activeContent: String,
  activeOriginalContent: String,
  hasChanges: Boolean,
  activeFileHasChanges: Boolean,
  changedFileIds: Set,
  globalError: String
})

const emit = defineEmits([
  'close',
  'select-file',
  'update-content',
  'save',
  'toggle-diff',
  'toggle-rollout'
])

// Modal sizing
const modalRef = ref(null)
const currentSize = ref('large')
const customWidth = ref(null)
const customHeight = ref(null)

const sizes = {
  small: { width: 700, height: 500 },
  medium: { width: 1000, height: 650 },
  large: { width: 1300, height: 800 }
}

const modalStyle = computed(() => {
  const width = customWidth.value || sizes[currentSize.value].width
  const height = customHeight.value || sizes[currentSize.value].height
  return {
    width: `${width}px`,
    height: `${height}px`,
    maxWidth: '95vw',
    maxHeight: '95vh'
  }
})

const clientLabel = computed(() => {
  if (!props.sourceClient) return ''
  const id = props.sourceClient.eqpId || props.sourceClient.id
  const model = props.sourceClient.eqpModel || ''
  return model ? `${id} (${model})` : id
})

const setSize = (size) => {
  currentSize.value = size
  customWidth.value = null
  customHeight.value = null
}

const handleClose = () => emit('close')
const selectFile = (fileId) => emit('select-file', fileId)
const updateContent = (content) => emit('update-content', content)
const handleSave = () => emit('save')
const toggleDiff = () => emit('toggle-diff')
const toggleRollout = () => emit('toggle-rollout')

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

// Keyboard shortcut
const handleKeyDown = (e) => {
  if (!props.isOpen) return
  if (e.key === 'Escape') {
    handleClose()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (props.activeFileHasChanges && !props.saving) {
      handleSave()
    }
  }
}

onMounted(() => {
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>
