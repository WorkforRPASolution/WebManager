<template>
  <Teleport to="body">
    <div v-if="compare.isOpen.value" class="fixed inset-0 z-50">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="compare.close()"></div>

      <!-- Modal -->
      <div
        ref="modalRef"
        class="fixed bg-white dark:bg-dark-card rounded-lg shadow-xl flex flex-col overflow-hidden"
        :style="modalStyle"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0 select-none"
          :class="{ 'cursor-move': !isMaximized }"
          @mousedown="startDrag"
          @dblclick="toggleMaximize"
        >
          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Config Compare - {{ compare.loadedClients.value.length }} clients
            </h3>
          </div>
          <div class="flex items-center gap-2">
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
              @click="compare.close()"
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

        <!-- File Tabs -->
        <div class="flex items-center border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-2 shrink-0">
          <div class="flex items-center gap-1 overflow-x-auto">
            <button
              v-for="file in compare.configFiles.value"
              :key="file.fileId"
              @click="compare.setActiveFile(file.fileId)"
              :class="[
                'px-4 py-2 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap',
                compare.activeFileId.value === file.fileId
                  ? 'text-primary-600 dark:text-primary-400 border-primary-500'
                  : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
              ]"
            >
              {{ file.name }}
            </button>
          </div>
        </div>

        <!-- Loading overlay OR content -->
        <template v-if="compare.loading.value">
          <CompareLoadingOverlay
            :eqp-ids="compare.eqpIds.value"
            :loading-status="compare.loadingStatus.value"
            :progress="compare.loadingProgress.value"
          />
        </template>

        <template v-else>
          <!-- Toolbar -->
          <CompareToolbar
            :baseline-eqp-id="compare.baselineEqpId.value"
            :clients="compare.loadedClients.value"
            :diff-only="compare.diffOnly.value"
            :search-query="compare.searchQuery.value"
            @update:baseline-eqp-id="compare.setBaseline"
            @toggle-diff-only="compare.toggleDiffOnly"
            @search="compare.setSearchQuery"
            @expand-all="compare.expandAll"
            @collapse-all="compare.collapseAll"
          />

          <!-- Error banner -->
          <div
            v-if="compare.errorClients.value.length > 0"
            class="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400"
          >
            Failed to load: {{ compare.errorClients.value.join(', ') }}
          </div>

          <!-- Matrix View -->
          <CompareMatrixView
            :visible-rows="compare.visibleRows.value"
            :eqp-ids="loadedEqpIds"
            :baseline-eqp-id="compare.baselineEqpId.value"
            :diff-result="compare.diffResult.value"
            :client-flat-maps="compare.clientFlatMaps.value"
            :collapsed-paths="compare.collapsedPaths.value"
            :diff-only="compare.diffOnly.value"
            @toggle-collapse="compare.toggleCollapse"
          />
        </template>

        <!-- Resize handle -->
        <div
          class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          @mousedown.prevent="startResize"
        >
          <svg class="w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14Z" />
          </svg>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import CompareLoadingOverlay from './CompareLoadingOverlay.vue'
import CompareToolbar from './CompareToolbar.vue'
import CompareMatrixView from './CompareMatrixView.vue'

const props = defineProps({
  compare: { type: Object, required: true }
})

// Only show eqpIds that loaded successfully
const loadedEqpIds = computed(() =>
  props.compare.eqpIds.value.filter(id => props.compare.loadingStatus.value[id] === 'loaded')
)

// ─── Modal sizing & drag ─────────────────────────────────
const modalRef = ref(null)
const isMaximized = ref(false)
const modalPos = reactive({ x: null, y: null })
const customWidth = ref(null)
const customHeight = ref(null)

const DEFAULT_WIDTH = 1100
const DEFAULT_HEIGHT = 700

const modalStyle = computed(() => {
  if (isMaximized.value) {
    return { left: '2.5vw', top: '2.5vh', width: '95vw', height: '95vh' }
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

const toggleMaximize = () => { isMaximized.value = !isMaximized.value }

// Drag
let isDragging = false
let dragStartX = 0, dragStartY = 0, dragStartPosX = 0, dragStartPosY = 0

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

// Resize
let isResizing = false
let startX = 0, startY = 0, startWidth = 0, startHeight = 0

const startResize = (e) => {
  isResizing = true
  startX = e.clientX
  startY = e.clientY
  const rect = modalRef.value.getBoundingClientRect()
  startWidth = rect.width
  startHeight = rect.height
  modalPos.x = rect.left
  modalPos.y = rect.top
  e.preventDefault()
}

const doResize = (e) => {
  if (!isResizing) return
  customWidth.value = Math.max(600, startWidth + (e.clientX - startX))
  customHeight.value = Math.max(400, startHeight + (e.clientY - startY))
}

const stopResize = () => { isResizing = false }

const onMouseMove = (e) => { doDrag(e); doResize(e) }
const onMouseUp = () => { stopDrag(); stopResize() }

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})
</script>
