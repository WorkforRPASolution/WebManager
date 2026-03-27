<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from '../../../shared/composables/useTheme'

const props = defineProps({
  name: { type: String, required: true },
  alt: { type: String, default: '' },
  caption: { type: String, default: '' }
})

const { isDark } = useTheme()
const imgRef = ref(null)
const loaded = ref(false)
const error = ref(false)
const expanded = ref(false)

const src = computed(() => {
  const theme = isDark.value ? 'dark' : 'light'
  return `/help-images/${theme}/${props.name}.png`
})

const fallbackSrc = computed(() => `/help-images/light/${props.name}.png`)

function handleError() {
  // 다크 이미지 실패 시 라이트 폴백
  if (isDark.value && !error.value) {
    error.value = true
  }
}

// Intersection Observer lazy loading
let observer = null
onMounted(() => {
  if (!imgRef.value) return
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        loaded.value = true
        observer?.disconnect()
      }
    },
    { rootMargin: '200px' }
  )
  observer.observe(imgRef.value)
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <figure ref="imgRef" class="my-6">
    <div
      v-if="loaded"
      class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden bg-gray-50 dark:bg-dark-bg cursor-pointer"
      @click="expanded = !expanded"
    >
      <img
        :src="error ? fallbackSrc : src"
        :alt="alt || name"
        class="w-full"
        :class="{ 'max-h-[500px] object-contain': !expanded }"
        @error="handleError"
      >
    </div>
    <div v-else class="h-64 bg-gray-100 dark:bg-dark-bg rounded-lg animate-pulse flex items-center justify-center">
      <span class="text-sm text-gray-400">Loading image...</span>
    </div>
    <figcaption v-if="caption" class="mt-2 text-center text-xs text-gray-500 dark:text-gray-400 italic">
      {{ caption }}
    </figcaption>
  </figure>
</template>
