<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="handleClose"
    >
      <div class="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg mx-4">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Upload Image</h3>
          <button
            @click="handleClose"
            class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-4">
          <!-- Template Context Inputs -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Process</label>
              <input
                v-model="templateContext.process"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g. CVD"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
              <input
                v-model="templateContext.model"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g. MODEL1"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code</label>
              <input
                v-model="templateContext.code"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g. CODE1"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subcode</label>
              <input
                v-model="templateContext.subcode"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g. SUBCODE1"
              />
            </div>
          </div>

          <!-- Prefix Preview -->
          <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span class="text-xs text-gray-500 dark:text-gray-400">Image Prefix: </span>
            <span class="text-sm font-mono text-gray-900 dark:text-white">{{ prefixPreview }}</span>
          </div>

          <!-- Dropzone -->
          <div
            ref="dropzoneRef"
            @dragenter.prevent="isDragging = true"
            @dragover.prevent
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
            @click="openFileDialog"
            :class="[
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragging
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
            ]"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileSelect"
              multiple
            />
            <svg class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p class="text-gray-600 dark:text-gray-400 mb-2">
              <span class="font-medium text-primary-500">Click to upload</span> or drag and drop
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-500">{{ imageConfig.allowedExtensions.join(', ') }} up to {{ imageConfig.maxFileSizeMB }}MB</p>
          </div>

          <!-- Selected Files List -->
          <div v-if="selectedFiles.length > 0" class="space-y-2">
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Selected Files ({{ selectedFiles.length }})
            </div>
            <div class="max-h-32 overflow-y-auto space-y-1">
              <div
                v-for="(file, index) in selectedFiles"
                :key="index"
                class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span class="text-sm text-gray-700 dark:text-gray-300 truncate">{{ file.name }}</span>
                  <span class="text-xs text-gray-500 flex-shrink-0">({{ formatFileSize(file.size) }})</span>
                </div>
                <button
                  @click.stop="removeFile(index)"
                  class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
                >
                  <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-dark-border">
          <button
            @click="handleClose"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleUpload"
            :disabled="selectedFiles.length === 0 || uploading"
            class="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            <svg v-if="uploading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ uploading ? 'Uploading...' : 'Upload' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { imageConfig, loadImageConfig } from '@/shared/composables/useImageUpload'

loadImageConfig()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initialContext: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:modelValue', 'upload'])

const dropzoneRef = ref(null)
const fileInputRef = ref(null)
const isDragging = ref(false)
const selectedFiles = ref([])
const uploading = ref(false)

const templateContext = ref({
  process: '',
  model: '',
  code: '',
  subcode: ''
})

const prefixPreview = computed(() => {
  return `ARS_${templateContext.value.process || ''}_${templateContext.value.model || ''}_${templateContext.value.code || ''}_${templateContext.value.subcode || ''}`
})

// Watch for initial context
watch(() => props.initialContext, (newVal) => {
  if (newVal) {
    templateContext.value = {
      process: newVal.process || '',
      model: newVal.model || '',
      code: newVal.code || '',
      subcode: newVal.subcode || ''
    }
  }
}, { immediate: true })

// Reset on close
watch(() => props.modelValue, (isOpen) => {
  if (!isOpen) {
    selectedFiles.value = []
    uploading.value = false
  }
})

const openFileDialog = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = (event) => {
  const files = Array.from(event.target.files || [])
  addFiles(files)
  event.target.value = '' // Reset input
}

const handleDrop = (event) => {
  isDragging.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  addFiles(files)
}

const addFiles = (files) => {
  const imageFiles = files.filter(f => f.type.startsWith('image/'))

  for (const file of imageFiles) {
    if (file.size > imageConfig.maxFileSize) {
      console.warn(`File ${file.name} exceeds ${imageConfig.maxFileSizeMB}MB limit`)
      continue
    }
    // Avoid duplicates
    if (!selectedFiles.value.some(f => f.name === file.name && f.size === file.size)) {
      selectedFiles.value.push(file)
    }
  }
}

const removeFile = (index) => {
  selectedFiles.value.splice(index, 1)
}

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const handleClose = () => {
  if (!uploading.value) {
    emit('update:modelValue', false)
  }
}

const handleUpload = async () => {
  if (selectedFiles.value.length === 0 || uploading.value) return

  uploading.value = true
  try {
    const results = []
    for (const file of selectedFiles.value) {
      results.push({ file, context: { ...templateContext.value } })
    }
    emit('upload', results)
  } finally {
    uploading.value = false
    emit('update:modelValue', false)
  }
}
</script>
