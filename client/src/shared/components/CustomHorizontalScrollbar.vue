<template>
  <div
    v-if="hasScroll"
    class="custom-scrollbar"
    :class="{ 'custom-scrollbar--dark': isDark }"
  >
    <!-- Left Arrow Button -->
    <button
      class="custom-scrollbar__arrow custom-scrollbar__arrow--left"
      @mousedown="startScroll('left')"
      @mouseup="stopScroll"
      @mouseleave="stopScroll"
      @click.prevent
      :disabled="isAtStart"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>

    <!-- Track -->
    <div
      ref="trackRef"
      class="custom-scrollbar__track"
      @mousedown="handleTrackClick"
    >
      <!-- Thumb -->
      <div
        ref="thumbRef"
        class="custom-scrollbar__thumb"
        :style="thumbStyle"
        @mousedown.stop="startDrag"
      ></div>
    </div>

    <!-- Right Arrow Button -->
    <button
      class="custom-scrollbar__arrow custom-scrollbar__arrow--right"
      @mousedown="startScroll('right')"
      @mouseup="stopScroll"
      @mouseleave="stopScroll"
      @click.prevent
      :disabled="isAtEnd"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTheme } from '../composables/useTheme'

const { isDark } = useTheme()

const props = defineProps({
  scrollState: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['scroll'])

// Refs
const trackRef = ref(null)
const thumbRef = ref(null)

// Drag state
let isDragging = false
let dragStartX = 0
let dragStartScrollLeft = 0

// Scroll animation
let scrollInterval = null
const SCROLL_STEP = 40
const SCROLL_INTERVAL = 50

// Computed
const hasScroll = computed(() => props.scrollState.hasHorizontalScroll)

const isAtStart = computed(() => props.scrollState.scrollLeft <= 0)

const isAtEnd = computed(() => {
  const { scrollLeft, scrollWidth, clientWidth } = props.scrollState
  return scrollLeft >= scrollWidth - clientWidth - 1
})

const thumbStyle = computed(() => {
  const { scrollLeft, scrollWidth, clientWidth } = props.scrollState

  if (scrollWidth <= clientWidth) {
    return { display: 'none' }
  }

  // Thumb 크기: clientWidth / scrollWidth 비율
  const thumbRatio = clientWidth / scrollWidth
  const thumbWidthPercent = Math.max(thumbRatio * 100, 10) // 최소 10%

  // Thumb 위치: scrollLeft / (scrollWidth - clientWidth) 비율
  const maxScroll = scrollWidth - clientWidth
  const scrollRatio = maxScroll > 0 ? scrollLeft / maxScroll : 0
  const availableSpace = 100 - thumbWidthPercent
  const leftPercent = scrollRatio * availableSpace

  return {
    width: `${thumbWidthPercent}%`,
    left: `${leftPercent}%`
  }
})

// Methods
const scrollBy = (delta) => {
  const { scrollLeft, scrollWidth, clientWidth } = props.scrollState
  const maxScroll = scrollWidth - clientWidth
  const newScrollLeft = Math.max(0, Math.min(maxScroll, scrollLeft + delta))
  emit('scroll', newScrollLeft)
}

const startScroll = (direction) => {
  const delta = direction === 'left' ? -SCROLL_STEP : SCROLL_STEP
  scrollBy(delta)

  // Long press: 연속 스크롤
  scrollInterval = setInterval(() => {
    scrollBy(delta)
  }, SCROLL_INTERVAL)
}

const stopScroll = () => {
  if (scrollInterval) {
    clearInterval(scrollInterval)
    scrollInterval = null
  }
}

const handleTrackClick = (event) => {
  if (event.target === thumbRef.value) return

  const trackRect = trackRef.value.getBoundingClientRect()
  const clickX = event.clientX - trackRect.left
  const trackWidth = trackRect.width

  const { scrollWidth, clientWidth } = props.scrollState
  const maxScroll = scrollWidth - clientWidth

  // 클릭 위치에 해당하는 스크롤 위치 계산
  const clickRatio = clickX / trackWidth
  const newScrollLeft = clickRatio * maxScroll

  emit('scroll', newScrollLeft)
}

const startDrag = (event) => {
  isDragging = true
  dragStartX = event.clientX
  dragStartScrollLeft = props.scrollState.scrollLeft

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)

  // 텍스트 선택 방지
  event.preventDefault()
}

const handleDrag = (event) => {
  if (!isDragging || !trackRef.value) return

  const trackRect = trackRef.value.getBoundingClientRect()
  const trackWidth = trackRect.width
  const deltaX = event.clientX - dragStartX

  const { scrollWidth, clientWidth } = props.scrollState
  const maxScroll = scrollWidth - clientWidth

  // Track 픽셀 이동 → 스크롤 위치 변환
  const scrollPerPixel = maxScroll / (trackWidth * (1 - clientWidth / scrollWidth))
  const newScrollLeft = Math.max(0, Math.min(maxScroll, dragStartScrollLeft + deltaX * scrollPerPixel))

  emit('scroll', newScrollLeft)
}

const stopDrag = () => {
  isDragging = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

onUnmounted(() => {
  stopScroll()
  stopDrag()
})
</script>

<style scoped>
.custom-scrollbar {
  display: flex;
  align-items: center;
  height: 16px;
  background-color: #f1f5f9;
  border-top: 1px solid #e2e8f0;
  user-select: none;
}

.custom-scrollbar--dark {
  background-color: #1e293b;
  border-top-color: #334155;
}

/* Arrow Buttons */
.custom-scrollbar__arrow {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 100%;
  padding: 0;
  border: none;
  background-color: transparent;
  color: #64748b;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.custom-scrollbar__arrow:hover:not(:disabled) {
  background-color: #e2e8f0;
  color: #334155;
}

.custom-scrollbar__arrow:active:not(:disabled) {
  background-color: #cbd5e1;
}

.custom-scrollbar__arrow:disabled {
  color: #cbd5e1;
  cursor: default;
}

.custom-scrollbar--dark .custom-scrollbar__arrow {
  color: #94a3b8;
}

.custom-scrollbar--dark .custom-scrollbar__arrow:hover:not(:disabled) {
  background-color: #334155;
  color: #e2e8f0;
}

.custom-scrollbar--dark .custom-scrollbar__arrow:active:not(:disabled) {
  background-color: #475569;
}

.custom-scrollbar--dark .custom-scrollbar__arrow:disabled {
  color: #475569;
}

.custom-scrollbar__arrow svg {
  width: 12px;
  height: 12px;
}

/* Track */
.custom-scrollbar__track {
  flex: 1;
  position: relative;
  height: 10px;
  margin: 0 4px;
  background-color: #e2e8f0;
  border-radius: 5px;
  cursor: pointer;
}

.custom-scrollbar--dark .custom-scrollbar__track {
  background-color: #334155;
}

/* Thumb */
.custom-scrollbar__thumb {
  position: absolute;
  top: 1px;
  height: 8px;
  min-width: 30px;
  background-color: #94a3b8;
  border-radius: 4px;
  cursor: grab;
  transition: background-color 0.15s;
}

.custom-scrollbar__thumb:hover {
  background-color: #64748b;
}

.custom-scrollbar__thumb:active {
  background-color: #475569;
  cursor: grabbing;
}

.custom-scrollbar--dark .custom-scrollbar__thumb {
  background-color: #64748b;
}

.custom-scrollbar--dark .custom-scrollbar__thumb:hover {
  background-color: #94a3b8;
}

.custom-scrollbar--dark .custom-scrollbar__thumb:active {
  background-color: #cbd5e1;
}
</style>
