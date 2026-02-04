<template>
  <Teleport to="body">
    <div
      v-if="modelValue && image"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      @click.self="handleClose"
    >
      <div class="relative max-w-4xl max-h-[90vh] mx-4">
        <!-- Close Button -->
        <button
          @click="handleClose"
          class="absolute -top-10 right-0 p-2 text-white/80 hover:text-white transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Image -->
        <img
          :src="image.url"
          :alt="image.filename"
          class="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />

        <!-- Info Bar -->
        <div class="mt-4 p-4 bg-white/10 backdrop-blur-sm rounded-lg text-white">
          <div class="flex flex-wrap items-center gap-4 text-sm">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span class="font-medium">{{ image.filename }}</span>
            </div>
            <div class="text-white/60">{{ formatFileSize(image.size) }}</div>
            <div class="text-white/60">{{ image.mimetype }}</div>
          </div>

          <div class="mt-2 flex flex-wrap gap-2">
            <span class="px-2 py-1 bg-white/20 rounded text-xs">{{ image.process }}</span>
            <span class="px-2 py-1 bg-white/20 rounded text-xs">{{ image.model }}</span>
            <span class="px-2 py-1 bg-white/20 rounded text-xs">{{ image.code }}</span>
            <span v-if="image.subcode" class="px-2 py-1 bg-white/20 rounded text-xs">{{ image.subcode }}</span>
          </div>

          <!-- Copy URL Buttons -->
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              @click="copyUrl(image.url)"
              class="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy URL
            </button>
            <button
              v-if="image.emailUrl"
              @click="copyUrl(image.emailUrl)"
              class="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Copy Email URL
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  image: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue'])

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const copyUrl = async (url) => {
  try {
    await navigator.clipboard.writeText(url)
  } catch (error) {
    console.error('Failed to copy URL:', error)
  }
}

const handleClose = () => {
  emit('update:modelValue', false)
}
</script>
