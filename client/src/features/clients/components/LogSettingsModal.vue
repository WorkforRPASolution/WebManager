<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="handleClose"></div>

      <!-- Modal -->
      <div
        ref="modalRef"
        class="fixed bg-white dark:bg-dark-card rounded-lg shadow-xl flex flex-col overflow-hidden"
        :style="modalStyle"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0 select-none" :class="{ 'cursor-move': !isMaximized }" @mousedown="startDrag" @dblclick="toggleMaximize">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Log Source Settings</h3>
          </div>
          <div class="flex items-center gap-2">
            <button @click="toggleMaximize" @mousedown.stop
              class="p-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              :title="isMaximized ? 'Restore' : 'Maximize'">
              <svg v-if="!isMaximized" class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1" /></svg>
              <svg v-else class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="1" width="11" height="11" rx="1" /><rect x="1" y="4" width="11" height="11" rx="1" /></svg>
            </button>
            <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
            <button @click="handleClose" @mousedown.stop
              class="p-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition" title="Close">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex-1 flex items-center justify-center py-12">
          <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading...</span>
          </div>
        </div>

        <!-- Content -->
        <div v-else class="flex-1 overflow-auto p-4">
          <!-- Toolbar -->
          <div class="flex items-center justify-between mb-4">
            <button
              @click="addNewRow"
              class="flex items-center gap-2 px-3 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
            <span class="text-sm text-gray-500 dark:text-gray-400">
              {{ items.length }} source(s)
            </span>
          </div>

          <!-- Table -->
          <div class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-dark-bg">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-1/4">
                    Name
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Path
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-1/5">
                    Keyword
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-28">
                    Encoding
                  </th>
                  <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-dark-border">
                <tr
                  v-for="(item, index) in items"
                  :key="item._key"
                  class="transition-colors"
                >
                  <td class="px-4 py-2">
                    <input
                      v-model="item.name"
                      @input="changed = true"
                      class="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      :class="{ 'border-red-500': item._nameError }"
                      placeholder="e.g., Agent Log"
                    />
                    <p v-if="item._nameError" class="mt-1 text-xs text-red-500">{{ item._nameError }}</p>
                  </td>
                  <td class="px-4 py-2">
                    <input
                      v-model="item.path"
                      @input="changed = true"
                      class="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                      :class="{ 'border-red-500': item._pathError }"
                      placeholder="e.g., log/ARSAgent"
                    />
                    <p v-if="item._pathError" class="mt-1 text-xs text-red-500">{{ item._pathError }}</p>
                  </td>
                  <td class="px-4 py-2">
                    <input
                      v-model="item.keyword"
                      @input="changed = true"
                      class="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                      :class="{ 'border-red-500': item._keywordError }"
                      placeholder="e.g., arsagent"
                    />
                    <p v-if="item._keywordError" class="mt-1 text-xs text-red-500">{{ item._keywordError }}</p>
                  </td>
                  <td class="px-4 py-2">
                    <select
                      v-model="item.encoding"
                      @change="changed = true"
                      class="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="utf-8">UTF-8</option>
                      <option value="euc-kr">EUC-KR</option>
                      <option value="cp949">CP949</option>
                    </select>
                  </td>
                  <td class="px-4 py-2 text-center">
                    <button
                      @click="removeItem(index)"
                      class="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Delete"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
                <tr v-if="items.length === 0">
                  <td colspan="5" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No log sources. Click "Add" to create one.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Error message -->
          <p v-if="saveError" class="mt-3 text-sm text-red-500">{{ saveError }}</p>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-dark-border">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            <span v-if="changed" class="text-amber-500">Unsaved changes</span>
          </div>
          <div class="flex gap-3">
            <button
              @click="handleClose"
              class="px-4 py-2 text-sm bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleSave"
              :disabled="!changed || saving"
              class="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Save
            </button>
          </div>
        </div>

        <!-- Resize Handle -->
        <div class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize" @mousedown="startResize">
          <svg class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22H20V20H22V22ZM22 18H18V22H22V18ZM18 22H14V18H18V22ZM22 14H14V22H22V14Z" />
          </svg>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { logApi } from '../api'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  agentGroup: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'saved'])

// Modal sizing
const modalRef = ref(null)
const isMaximized = ref(false)
const modalPos = reactive({ x: null, y: null })
const customWidth = ref(null)
const customHeight = ref(null)
const DEFAULT_WIDTH = 768
const DEFAULT_HEIGHT = 550

const modalStyle = computed(() => {
  if (isMaximized.value) return { left: '2.5vw', top: '2.5vh', width: '95vw', height: '95vh' }
  const w = customWidth.value || DEFAULT_WIDTH
  const h = customHeight.value || DEFAULT_HEIGHT
  return {
    left: modalPos.x !== null ? `${modalPos.x}px` : `calc(50vw - ${w / 2}px)`,
    top: modalPos.y !== null ? `${modalPos.y}px` : `calc(50vh - ${h / 2}px)`,
    width: `${w}px`, height: `${h}px`, maxWidth: '95vw', maxHeight: '95vh'
  }
})
const toggleMaximize = () => { isMaximized.value = !isMaximized.value }

let isDragging = false, dragStartX = 0, dragStartY = 0, dragStartPosX = 0, dragStartPosY = 0
const startDrag = (e) => {
  if (isMaximized.value) return
  isDragging = true; dragStartX = e.clientX; dragStartY = e.clientY
  const rect = modalRef.value.getBoundingClientRect(); dragStartPosX = rect.left; dragStartPosY = rect.top; e.preventDefault()
}
const doDrag = (e) => { if (!isDragging) return; modalPos.x = Math.max(0, Math.min(window.innerWidth - 100, dragStartPosX + (e.clientX - dragStartX))); modalPos.y = Math.max(0, Math.min(window.innerHeight - 50, dragStartPosY + (e.clientY - dragStartY))) }
const stopDrag = () => { isDragging = false }

let isResizing = false, resizeStartX = 0, resizeStartY = 0, resizeStartW = 0, resizeStartH = 0
const startResize = (e) => {
  isResizing = true; resizeStartX = e.clientX; resizeStartY = e.clientY
  const rect = modalRef.value.getBoundingClientRect(); resizeStartW = rect.width; resizeStartH = rect.height
  modalPos.x = rect.left; modalPos.y = rect.top; e.preventDefault()
}
const doResize = (e) => { if (!isResizing) return; customWidth.value = Math.max(400, Math.min(window.innerWidth * 0.95, resizeStartW + (e.clientX - resizeStartX))); customHeight.value = Math.max(300, Math.min(window.innerHeight * 0.95, resizeStartH + (e.clientY - resizeStartY))) }
const stopResize = () => { isResizing = false }

const onMouseMove = (e) => { doDrag(e); doResize(e) }
const onMouseUp = () => { stopDrag(); stopResize() }
onMounted(() => { document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp) })
onUnmounted(() => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) })

// State
const loading = ref(false)
const saving = ref(false)
const changed = ref(false)
const saveError = ref(null)
const items = ref([])
let keyCounter = 0

// Load data when modal opens
watch(() => props.modelValue, async (newValue) => {
  if (newValue && props.agentGroup) {
    await loadData()
  }
})

async function loadData() {
  loading.value = true
  changed.value = false
  saveError.value = null
  try {
    const response = await logApi.getSettings(props.agentGroup)
    const doc = response.data
    items.value = (doc.logSources || []).map(s => ({
      _key: `k_${keyCounter++}`,
      sourceId: s.sourceId,
      name: s.name,
      path: s.path,
      keyword: s.keyword || '',
      encoding: s.encoding || 'utf-8',
      _nameError: null,
      _pathError: null,
      _keywordError: null
    }))
  } catch (error) {
    console.error('Failed to load log settings:', error)
    items.value = []
  } finally {
    loading.value = false
  }
}

function addNewRow() {
  items.value.push({
    _key: `k_${keyCounter++}`,
    sourceId: null,
    name: '',
    path: '',
    keyword: '',
    encoding: 'utf-8',
    _nameError: null,
    _pathError: null,
    _keywordError: null
  })
  changed.value = true
}

function removeItem(index) {
  items.value.splice(index, 1)
  changed.value = true
}

function validate() {
  let valid = true
  for (const item of items.value) {
    item._nameError = null
    item._pathError = null
    item._keywordError = null

    if (!item.name || !item.name.trim()) {
      item._nameError = 'Name is required'
      valid = false
    }
    if (!item.path || !item.path.trim()) {
      item._pathError = 'Path is required'
      valid = false
    }
    if (!item.keyword || !item.keyword.trim()) {
      item._keywordError = 'Keyword is required'
      valid = false
    }
  }
  return valid
}

async function handleSave() {
  if (!validate()) return

  saving.value = true
  saveError.value = null
  try {
    const logSources = items.value.map(item => ({
      sourceId: item.sourceId,
      name: item.name.trim(),
      path: item.path.trim(),
      keyword: item.keyword.trim(),
      encoding: item.encoding || 'utf-8'
    }))
    await logApi.saveSettings(props.agentGroup, { logSources })
    changed.value = false
    emit('saved')
  } catch (error) {
    saveError.value = error.response?.data?.message || error.message || 'Failed to save'
  } finally {
    saving.value = false
  }
}

function handleClose() {
  modalPos.x = null; modalPos.y = null; customWidth.value = null; customHeight.value = null; isMaximized.value = false
  emit('update:modelValue', false)
}
</script>
