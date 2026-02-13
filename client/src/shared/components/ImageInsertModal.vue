<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="closeModal"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">이미지 삽입</h3>
            <button
              @click="closeModal"
              class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <!-- Upload Area -->
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">새 이미지 업로드</h4>
              <div
                ref="dropZone"
                class="border-2 border-dashed rounded-lg p-6 text-center transition-colors"
                :class="isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
                @dragenter.prevent="isDragging = true"
                @dragover.prevent
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
                @click="openFileDialog"
              >
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  class="hidden"
                  @change="handleFileSelect"
                />
                <div v-if="isUploading" class="flex flex-col items-center">
                  <svg class="animate-spin h-8 w-8 text-blue-500 mb-2" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="text-sm text-gray-600 dark:text-gray-400">업로드 중...</span>
                </div>
                <div v-else class="flex flex-col items-center">
                  <svg class="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span class="text-sm text-gray-600 dark:text-gray-400">이미지를 드래그하거나 클릭하여 선택</span>
                  <span class="text-xs text-gray-500 dark:text-gray-500 mt-1">(최대 {{ imageConfig.maxFileSizeMB }}MB, {{ imageConfig.allowedExtensions.join('/') }})</span>
                </div>
              </div>
              <p v-if="uploadError" class="mt-2 text-sm text-red-500">{{ uploadError }}</p>
            </div>

            <!-- Recent Images -->
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">최근 업로드 이미지</h4>
              <div v-if="isLoading" class="flex justify-center py-4">
                <svg class="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div v-else-if="images.length === 0" class="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                업로드된 이미지가 없습니다
              </div>
              <div v-else class="grid grid-cols-4 gap-2">
                <div
                  v-for="img in images"
                  :key="img.id"
                  class="relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-colors"
                  :class="selectedImage?.id === img.id
                    ? 'border-blue-500'
                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'"
                  @click="selectImage(img)"
                >
                  <img :src="img.url" :alt="img.filename" class="w-full h-full object-cover" />
                  <button
                    @click.stop="confirmDelete(img)"
                    class="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 hover:opacity-100 transition-opacity"
                    :class="{ 'opacity-100': selectedImage?.id === img.id }"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <p v-if="selectedImage" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                선택된 이미지: {{ selectedImage.filename }}
              </p>
            </div>

            <!-- Image Options -->
            <div v-if="selectedImage" class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">이미지 옵션</h4>
              <div class="space-y-3">
                <!-- Width -->
                <div class="flex items-center gap-4">
                  <label class="w-20 text-sm text-gray-600 dark:text-gray-400">너비:</label>
                  <select
                    v-model="imageOptions.width"
                    class="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="auto">auto</option>
                    <option value="100%">100%</option>
                    <option value="75%">75%</option>
                    <option value="50%">50%</option>
                    <option value="300px">300px</option>
                    <option value="200px">200px</option>
                  </select>
                </div>
                <!-- Align -->
                <div class="flex items-center gap-4">
                  <label class="w-20 text-sm text-gray-600 dark:text-gray-400">정렬:</label>
                  <select
                    v-model="imageOptions.align"
                    class="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="left">왼쪽</option>
                    <option value="center">가운데</option>
                    <option value="right">오른쪽</option>
                  </select>
                </div>
                <!-- Alt Text -->
                <div class="flex items-center gap-4">
                  <label class="w-20 text-sm text-gray-600 dark:text-gray-400">Alt 텍스트:</label>
                  <input
                    v-model="imageOptions.alt"
                    type="text"
                    placeholder="이미지 설명"
                    class="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              @click="closeModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              취소
            </button>
            <button
              @click="insertImage"
              :disabled="!selectedImage"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              삽입
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Delete Confirmation Modal -->
    <Transition name="modal">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
        @click.self="showDeleteConfirm = false"
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm">
          <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-2">이미지 삭제</h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            이 이미지를 삭제하시겠습니까?
          </p>
          <div class="flex justify-end gap-2">
            <button
              @click="showDeleteConfirm = false"
              class="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              취소
            </button>
            <button
              @click="handleDelete"
              class="px-3 py-1.5 text-sm text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { useImageUpload } from '@/shared/composables/useImageUpload'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  templateContext: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'insert'])

// Compute prefix from template context
const prefix = computed(() => {
  if (!props.templateContext) {
    return 'DEFAULT'
  }
  const { process, model, code, subcode } = props.templateContext
  const parts = ['ARS', process, model, code, subcode].filter(Boolean)
  return parts.join('_')
})

const { isUploading, uploadError, imageConfig, uploadImage, fetchImages, deleteImage } = useImageUpload()

const fileInput = ref(null)
const isDragging = ref(false)
const isLoading = ref(false)
const images = ref([])
const selectedImage = ref(null)
const showDeleteConfirm = ref(false)
const imageToDelete = ref(null)

const imageOptions = reactive({
  width: 'auto',
  align: 'left',
  alt: ''
})

// Load images when modal opens
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    await loadImages()
  } else {
    // Reset state when modal closes
    selectedImage.value = null
    imageOptions.width = 'auto'
    imageOptions.align = 'left'
    imageOptions.alt = ''
  }
})

const loadImages = async () => {
  isLoading.value = true
  try {
    images.value = await fetchImages(prefix.value)
  } finally {
    isLoading.value = false
  }
}

const openFileDialog = () => {
  fileInput.value?.click()
}

const handleFileSelect = async (event) => {
  const file = event.target.files?.[0]
  if (file) {
    await upload(file)
  }
  // Reset input
  event.target.value = ''
}

const handleDrop = async (event) => {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) {
    await upload(file)
  }
}

const upload = async (file) => {
  if (file.size > imageConfig.maxFileSize) {
    uploadError.value = `파일 크기가 ${imageConfig.maxFileSizeMB}MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)`
    return
  }
  try {
    // templateContext에서 개별 필드 추출하여 context 객체로 전달
    const context = props.templateContext || {}
    const result = await uploadImage(file, prefix.value, context)
    images.value.unshift(result)
    selectedImage.value = result
    imageOptions.alt = file.name.replace(/\.[^/.]+$/, '') // Use filename as default alt
  } catch (error) {
    // Error is handled in useImageUpload
  }
}

const selectImage = (img) => {
  selectedImage.value = img
  // filename이 없을 경우 name 또는 빈 문자열 사용
  const filename = img.filename || img.name || ''
  imageOptions.alt = filename.replace(/\.[^/.]+$/, '')
}

const confirmDelete = (img) => {
  imageToDelete.value = img
  showDeleteConfirm.value = true
}

const handleDelete = async () => {
  if (imageToDelete.value) {
    const img = imageToDelete.value
    const success = await deleteImage(img.prefix, img.name || img.id)
    if (success) {
      images.value = images.value.filter(i => i.id !== img.id)
      if (selectedImage.value?.id === img.id) {
        selectedImage.value = null
      }
    }
  }
  showDeleteConfirm.value = false
  imageToDelete.value = null
}

// HTML 특수문자 이스케이프 (XSS 방지)
const escapeHtml = (str) => {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const generateHtmlTag = () => {
  if (!selectedImage.value) return ''

  const { width, align, alt } = imageOptions
  // HTML 삽입용 URL: emailUrl 사용 (이메일 클라이언트에서 접근 가능한 HttpWebServer URL)
  const url = selectedImage.value.emailUrl || selectedImage.value.url

  let style = 'max-width: 100%;'

  if (width !== 'auto') {
    style = `width: ${width};`
  }

  if (align === 'center') {
    style += ' display: block; margin: 0 auto;'
  } else if (align === 'right') {
    style += ' float: right; margin-left: 10px;'
  }

  // XSS 방지: alt 텍스트 이스케이프
  return `<img src="${url}" alt="${escapeHtml(alt)}" style="${style.trim()}">`
}

const insertImage = () => {
  if (!selectedImage.value) return

  const htmlTag = generateHtmlTag()

  emit('insert', {
    url: selectedImage.value.url,  // 썸네일용 (WebManager API)
    emailUrl: selectedImage.value.emailUrl || selectedImage.value.url,  // HTML 삽입용 (HttpWebServer)
    alt: imageOptions.alt,
    width: imageOptions.width,
    align: imageOptions.align,
    htmlTag
  })

  closeModal()
}

const closeModal = () => {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
