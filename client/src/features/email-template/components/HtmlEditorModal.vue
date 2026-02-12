<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="handleCancel"
      ></div>

      <!-- Modal -->
      <div
        ref="modalRef"
        class="fixed bg-white dark:bg-dark-card rounded-lg shadow-xl flex flex-col overflow-hidden"
        :style="modalStyle"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0 select-none" :class="{ 'cursor-move': !isMaximized }" @mousedown="startDrag" @dblclick="toggleMaximize">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            HTML Editor
          </h3>
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
              @click="handleCancel"
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

        <!-- Tabs -->
        <div class="flex items-center border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
          <button
            @click="switchTab('visual')"
            :class="[
              'px-4 py-2 text-sm font-medium transition border-b-2 -mb-px',
              activeTab === 'visual'
                ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            ]"
          >
            <span class="flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Visual
            </span>
          </button>
          <button
            @click="switchTab('code')"
            :class="[
              'px-4 py-2 text-sm font-medium transition border-b-2 -mb-px',
              activeTab === 'code'
                ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            ]"
          >
            <span class="flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              HTML
            </span>
          </button>
          <!-- Insert Image Button -->
          <div class="flex-1"></div>
          <button
            @click="showImageModal = true"
            class="mr-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition flex items-center gap-1.5"
            title="이미지 삽입"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            이미지
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-hidden">
          <!-- HTML Code Tab -->
          <div v-show="activeTab === 'code'" class="h-full p-4">
            <div class="w-full h-full rounded-lg border border-gray-300 dark:border-dark-border overflow-hidden">
              <MonacoEditor
                v-model="htmlContent"
                language="html"
                :theme="isDark ? 'vs-dark' : 'vs'"
                :options="{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false
                }"
              />
            </div>
          </div>

          <!-- Visual Tab (TinyMCE) -->
          <div v-show="activeTab === 'visual'" class="h-full p-4">
            <div
              :class="[
                'w-full h-full rounded-lg border overflow-hidden tinymce-wrapper',
                isDark ? 'tinymce-dark border-dark-border' : 'border-gray-300'
              ]"
            >
              <TinyMceEditor
                v-if="tinymceReady"
                :key="tinymceKey"
                v-model="visualContent"
                :init="tinymceInit"
                @init="onTinymceInit"
              />
              <div v-else class="flex items-center justify-center h-full text-gray-500">
                Loading editor...
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
          <button
            @click="handleCancel"
            class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition"
          >
            Cancel
          </button>
          <button
            @click="handleSave"
            class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition"
          >
            Save
          </button>
        </div>

        <!-- Resize Handle -->
        <div
          ref="resizeHandle"
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

  <!-- Image Insert Modal -->
  <ImageInsertModal
    v-model="showImageModal"
    :template-context="templateContext"
    @insert="handleImageInsert"
  />
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import MonacoEditor from '../../../shared/components/MonacoEditor.vue'
import ImageInsertModal from '../../../shared/components/ImageInsertModal.vue'
import { useTheme } from '../../../shared/composables/useTheme'
import './tinymce-dark.css'

// TinyMCE imports (self-hosted)
import TinyMceEditor from '@tinymce/tinymce-vue'
import 'tinymce/tinymce'
import 'tinymce/themes/silver'
import 'tinymce/icons/default'
import 'tinymce/models/dom'
// Plugins
import 'tinymce/plugins/table'
import 'tinymce/plugins/image'
import 'tinymce/plugins/link'
import 'tinymce/plugins/lists'
import 'tinymce/plugins/code'
import 'tinymce/plugins/fullscreen'
// Skins - import CSS directly (required for Safari compatibility)
import 'tinymce/skins/ui/oxide/skin.css'
import 'tinymce/skins/content/default/content.css'

const { isDark } = useTheme()

// Image Modal
const showImageModal = ref(false)

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  initialContent: {
    type: String,
    default: ''
  },
  templateContext: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

const modalRef = ref(null)

const activeTab = ref('visual')
const htmlContent = ref('')  // Storage format (with @HttpWebServerAddress)
const visualContent = ref('')  // Display format (with actual API URL)

// TinyMCE state
const tinymceReady = ref(false)
const tinymceKey = ref(0)
const tinymceEditor = ref(null)

// URL conversion utilities
const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`

// Convert storage URL to display URL (for Visual tab)
const toDisplayUrl = (html) => {
  if (!html) return ''
  return html.replace(
    /http:\/\/@HttpWebServerAddress\/ARS\/EmailImage\//g,
    `${API_BASE_URL}/images/`
  )
}

// Convert display URL back to storage URL (for saving)
const toStorageUrl = (html) => {
  if (!html) return ''
  const escaped = API_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(
    new RegExp(`${escaped}/images/`, 'g'),
    'http://@HttpWebServerAddress/ARS/EmailImage/'
  )
}

// Modal sizing
const isMaximized = ref(false)
const modalPos = reactive({ x: null, y: null })
const customWidth = ref(null)
const customHeight = ref(null)

const DEFAULT_WIDTH = 900
const DEFAULT_HEIGHT = 600

const modalStyle = computed(() => {
  if (isMaximized.value) {
    return {
      left: '2.5vw',
      top: '2.5vh',
      width: '95vw',
      height: '95vh'
    }
  }

  const w = customWidth.value || DEFAULT_WIDTH
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

const toggleMaximize = () => {
  isMaximized.value = !isMaximized.value
}

// Drag functionality
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let dragStartPosX = 0
let dragStartPosY = 0

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

// TinyMCE configuration
const tinymceInit = computed(() => ({
  height: '100%',
  menubar: true,
  statusbar: false,  // Remove bottom status bar (bezel)
  plugins: 'table image link lists code fullscreen',
  toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist | table link | image | code fullscreen',
  // Font options
  font_family_formats: 'Arial=arial,helvetica,sans-serif; Georgia=georgia,palatino; Times New Roman=times new roman,times; Verdana=verdana,geneva; Courier New=courier new,courier; 맑은 고딕=Malgun Gothic; 나눔고딕=NanumGothic; 돋움=Dotum; 굴림=Gulim',
  font_size_formats: '8pt 9pt 10pt 11pt 12pt 14pt 16pt 18pt 24pt 36pt 48pt',
  content_style: `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      padding: 16px;
      margin: 0;
      background-color: ${isDark.value ? '#111827' : '#ffffff'};
      color: ${isDark.value ? '#e5e7eb' : '#333333'};
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid ${isDark.value ? '#374151' : '#ddd'}; padding: 8px; }
  `,
  // Email-friendly settings
  valid_elements: '*[*]',
  extended_valid_elements: 'style,link[href|rel]',
  // Skin: false because CSS is imported directly (Safari compatibility)
  skin: false,
  content_css: false,
  // Disable auto-upload (we use our own image modal)
  automatic_uploads: false,
  images_upload_handler: () => Promise.reject('Use the image button to insert images'),
  // Prevent URL conversion - keep URLs as-is
  relative_urls: false,
  remove_script_host: false,
  convert_urls: false,
  // Disable promotion/branding
  promotion: false,
  branding: false,
  // License key not needed for self-hosted (MIT licensed)
  license_key: 'gpl'
}))

const onTinymceInit = (event) => {
  tinymceEditor.value = event.target
}

// Tab switching with content sync
const switchTab = (tab) => {
  if (tab === activeTab.value) return

  if (activeTab.value === 'code' && tab === 'visual') {
    // Code -> Visual: Convert to display URL for TinyMCE
    visualContent.value = toDisplayUrl(htmlContent.value)
  } else if (activeTab.value === 'visual' && tab === 'code') {
    // Visual -> Code: Convert back to storage URL
    if (tinymceEditor.value) {
      htmlContent.value = toStorageUrl(tinymceEditor.value.getContent())
    }
  }

  activeTab.value = tab
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
  // Anchor top-left so resize doesn't shift position
  modalPos.x = rect.left
  modalPos.y = rect.top
  e.preventDefault()
}

const doResize = (e) => {
  if (!isResizing) return
  customWidth.value = Math.max(400, Math.min(window.innerWidth * 0.95, startWidth + (e.clientX - startX)))
  customHeight.value = Math.max(300, Math.min(window.innerHeight * 0.95, startHeight + (e.clientY - startY)))
}

const stopResize = () => { isResizing = false }

// Initialize content when modal opens
watch(() => props.modelValue, async (newVal) => {
  if (newVal) {
    htmlContent.value = props.initialContent
    visualContent.value = toDisplayUrl(props.initialContent)
    activeTab.value = 'visual'

    // Initialize TinyMCE after a short delay
    await nextTick()
    tinymceReady.value = true
    tinymceKey.value++ // Force re-render to apply new theme
  } else {
    // Cleanup on close
    tinymceReady.value = false
    tinymceEditor.value = null
  }
})

// Watch theme changes to update TinyMCE
watch(isDark, () => {
  if (props.modelValue && tinymceReady.value) {
    tinymceKey.value++ // Force TinyMCE re-render with new theme
  }
})

const handleCancel = () => {
  modalPos.x = null
  modalPos.y = null
  emit('update:modelValue', false)
}

const handleSave = () => {
  let finalContent = htmlContent.value

  // If on Visual tab, get content from TinyMCE and convert to storage format
  if (activeTab.value === 'visual' && tinymceEditor.value) {
    finalContent = toStorageUrl(tinymceEditor.value.getContent())
  }

  emit('save', finalContent)
  emit('update:modelValue', false)
}

// Handle image insertion
const handleImageInsert = (imageData) => {
  if (activeTab.value === 'visual' && tinymceEditor.value) {
    // Visual tab: Convert to display URL and insert into TinyMCE
    const displayHtmlTag = toDisplayUrl(imageData.htmlTag)
    tinymceEditor.value.insertContent(displayHtmlTag)
  } else {
    // Code tab: Insert storage URL format
    htmlContent.value = htmlContent.value + '\n' + imageData.htmlTag
  }
}

// Combined mouse handlers
const onMouseMove = (e) => {
  doDrag(e)
  doResize(e)
}

const onMouseUp = () => {
  stopDrag()
  stopResize()
}

// Keyboard shortcut
const handleKeyDown = (e) => {
  if (!props.modelValue) return
  if (e.key === 'Escape') {
    handleCancel()
  }
}

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>
