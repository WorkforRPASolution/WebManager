<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="handleCancel"
      ></div>

      <!-- Modal -->
      <div
        ref="modalRef"
        class="relative bg-white dark:bg-dark-card rounded-lg shadow-xl flex flex-col overflow-hidden"
        :style="modalStyle"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            HTML Editor
          </h3>
          <div class="flex items-center gap-2">
            <!-- Resize buttons -->
            <button
              @click="setSize('small')"
              :class="['p-1.5 rounded transition', currentSize === 'small' ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600']"
              title="Small"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" stroke-width="2" />
              </svg>
            </button>
            <button
              @click="setSize('medium')"
              :class="['p-1.5 rounded transition', currentSize === 'medium' ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600']"
              title="Medium"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="1" stroke-width="2" />
              </svg>
            </button>
            <button
              @click="setSize('large')"
              :class="['p-1.5 rounded transition', currentSize === 'large' ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600']"
              title="Large"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="1" stroke-width="2" />
              </svg>
            </button>
            <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
            <button
              @click="handleCancel"
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
        <div class="flex border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
          <button
            @click="activeTab = 'code'"
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
              HTML Code
            </span>
          </button>
          <button
            @click="activeTab = 'preview'"
            :class="[
              'px-4 py-2 text-sm font-medium transition border-b-2 -mb-px',
              activeTab === 'preview'
                ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            ]"
          >
            <span class="flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </span>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-hidden">
          <!-- HTML Code Tab -->
          <div v-show="activeTab === 'code'" class="h-full p-4">
            <textarea
              v-model="htmlContent"
              class="w-full h-full p-3 font-mono text-sm bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="Enter HTML content here..."
              spellcheck="false"
            ></textarea>
          </div>

          <!-- Preview Tab -->
          <div v-show="activeTab === 'preview'" class="h-full p-4">
            <div class="w-full h-full bg-white rounded-lg border border-gray-300 dark:border-dark-border overflow-hidden">
              <iframe
                ref="previewFrame"
                :srcdoc="previewHtml"
                sandbox="allow-same-origin"
                class="w-full h-full border-0"
              ></iframe>
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
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  initialContent: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

const modalRef = ref(null)
const resizeHandle = ref(null)
const previewFrame = ref(null)

const activeTab = ref('code')
const htmlContent = ref('')
const currentSize = ref('medium')

// Modal sizes
const sizes = {
  small: { width: 600, height: 500 },
  medium: { width: 900, height: 600 },
  large: { width: 1200, height: 800 }
}

// Custom dimensions (when resized manually)
const customWidth = ref(null)
const customHeight = ref(null)

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

// Wrap content for preview with basic styles
const previewHtml = computed(() => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          padding: 16px;
          margin: 0;
          line-height: 1.5;
          color: #333;
        }
        img { max-width: 100%; height: auto; }
        table { border-collapse: collapse; }
        td, th { padding: 8px; }
      </style>
    </head>
    <body>${htmlContent.value}</body>
    </html>
  `
})

const setSize = (size) => {
  currentSize.value = size
  customWidth.value = null
  customHeight.value = null
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

  const deltaX = e.clientX - startX
  const deltaY = e.clientY - startY

  customWidth.value = Math.max(400, Math.min(window.innerWidth * 0.95, startWidth + deltaX))
  customHeight.value = Math.max(300, Math.min(window.innerHeight * 0.95, startHeight + deltaY))
}

const stopResize = () => {
  isResizing = false
}

// Initialize content when modal opens
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    htmlContent.value = props.initialContent
    activeTab.value = 'code'
  }
})

const handleCancel = () => {
  emit('update:modelValue', false)
}

const handleSave = () => {
  emit('save', htmlContent.value)
  emit('update:modelValue', false)
}

// Handle Escape key
const handleKeyDown = (e) => {
  if (e.key === 'Escape' && props.modelValue) {
    handleCancel()
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
