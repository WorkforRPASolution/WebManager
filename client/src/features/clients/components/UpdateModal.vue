<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="!deploying && handleClose()"
      ></div>

      <!-- Modal -->
      <div
        ref="modalRef"
        class="fixed bg-white dark:bg-dark-card rounded-lg shadow-xl flex flex-col overflow-hidden"
        :style="modalStyle"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0 select-none" :class="{ 'cursor-move': !isMaximized }" @mousedown="startDrag" @dblclick="toggleMaximize">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Software Update
            </h3>
          </div>
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
            <button v-if="!deploying"
              @click="handleClose"
              @mousedown.stop
              class="p-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              title="Close"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="settingsLoading" class="flex-1 flex items-center justify-center py-12">
          <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading settings...</span>
          </div>
        </div>

        <!-- Settings Load Error -->
        <div v-else-if="settingsError" class="flex-1 flex items-center justify-center p-6">
          <div class="w-full p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p class="text-sm font-medium text-red-700 dark:text-red-300">Failed to load update settings</p>
            <p class="text-sm text-red-600 dark:text-red-400 mt-1">{{ settingsError }}</p>
          </div>
        </div>

        <div v-else class="flex-1 overflow-auto p-4 space-y-4">
          <!-- Target Clients -->
          <div>
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Target Clients ({{ targetClients.length }})
            </h4>
            <div class="flex flex-wrap gap-2">
              <span v-for="client in targetClients" :key="client.eqpId"
                class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                {{ client.eqpId }}
              </span>
            </div>
          </div>

          <!-- Profile Selection -->
          <div>
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Select Profile</h4>
            <select v-model="selectedProfileId"
              class="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500">
              <option :value="null" disabled>-- Select a profile --</option>
              <option v-for="p in filteredProfiles" :key="p.profileId" :value="p.profileId">
                {{ p.name }}{{ p.osVer ? ` (${p.osVer})` : ' (All OS)' }}{{ p.version ? ` v${p.version}` : '' }}
              </option>
            </select>
            <p v-if="filteredProfiles.length === 0" class="mt-1 text-amber-500 text-sm">
              No profiles matching client OS ({{ clientOsVersions.join(', ') }})
            </p>
          </div>

          <!-- Task Selection -->
          <div>
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Select Tasks</h4>
            <div v-if="availableTasks.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
              No tasks configured. Please configure Update Settings first.
            </div>
            <div v-else class="space-y-2">
              <label v-for="task in availableTasks" :key="task.taskId"
                class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors"
                :class="selectedTaskIds.includes(task.taskId)
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg'">
                <input type="checkbox" :value="task.taskId" v-model="selectedTaskIds"
                  class="w-4 h-4 text-green-500 rounded border-gray-300 focus:ring-green-500" />
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ task.name }}</span>
                    <span class="px-1.5 py-0 text-[10px] font-medium rounded"
                      :class="task.type === 'exec'
                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'">
                      {{ task.type }}
                    </span>
                    <span v-if="task.stopOnFail"
                      class="px-1.5 py-0 text-[10px] font-medium rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                      stop-on-fail
                    </span>
                  </div>
                  <div v-if="task.type === 'exec'" class="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {{ task.commandLine }}{{ task.args?.length ? ' ' + task.args.join(' ') : '' }}
                  </div>
                  <div v-else class="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {{ task.sourcePath }} &rarr; {{ task.targetPath }}
                  </div>
                </div>
                <span v-if="task.description" class="text-xs text-gray-400">{{ task.description }}</span>
              </label>
            </div>
          </div>

          <!-- Deploy Progress -->
          <div v-if="deploying || updateDeploy.result.value">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Deploy Progress</h4>
            <div class="space-y-1.5">
              <div v-for="item in progressItems" :key="`${item.eqpId}-${item.taskId}`"
                class="flex items-center gap-3 px-3 py-2 rounded text-sm"
                :class="{
                  'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300': item.status === 'success',
                  'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300': item.status === 'error',
                  'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500': item.status === 'skipped',
                  'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300': item.status === 'uploading'
                }">
                <span class="font-mono">{{ item.eqpId }}</span>
                <span class="text-gray-400">{{ item.taskId }}</span>
                <span class="flex-1"></span>
                <span v-if="item.status === 'success'" class="font-medium">Done</span>
                <span v-else-if="item.status === 'error'" class="font-medium">{{ item.error }}</span>
                <span v-else-if="item.status === 'skipped'" class="font-medium">Skipped</span>
                <span v-else class="font-medium">Deploying...</span>
              </div>
            </div>

            <!-- Summary -->
            <div v-if="updateDeploy.result.value" class="mt-3 p-3 rounded-lg"
              :class="resultBannerClass">
              <!-- Cancelled -->
              <p v-if="updateDeploy.result.value.cancelled" class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Deploy cancelled
              </p>
              <!-- Overall error (no progress items — e.g. profile not found, source connect fail) -->
              <p v-else-if="updateDeploy.result.value.error" class="text-sm font-medium text-red-700 dark:text-red-300">
                Deploy failed: {{ updateDeploy.result.value.error }}
              </p>
              <!-- Normal completion -->
              <p v-else class="text-sm font-medium"
                :class="updateDeploy.result.value.failed > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'">
                Completed: {{ updateDeploy.result.value.success || 0 }} success, {{ updateDeploy.result.value.failed || 0 }} failed
                (total {{ updateDeploy.result.value.total || 0 }})
              </p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-dark-border">
          <button v-if="deploying" @click="updateDeploy.cancel()"
            class="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
            Cancel Deploy
          </button>
          <button v-if="!deploying" @click="handleClose"
            class="px-4 py-2 text-sm bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors">
            Close
          </button>
          <button v-if="!deploying"
            @click="handleDeploy"
            :disabled="!selectedProfileId || selectedTaskIds.length === 0"
            class="flex items-center gap-2 px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Deploy
          </button>
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
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { updateSettingsApi } from '../api'
import { useUpdateDeploy } from '../composables/useUpdateDeploy'
import { filterProfilesByClientOs } from '../composables/updateProfileUtils'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  agentGroup: { type: String, default: '' },
  targetClients: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'deployed'])

const updateDeploy = useUpdateDeploy()
const deploying = computed(() => updateDeploy.deploying.value)

// Modal sizing
const modalRef = ref(null)
const isMaximized = ref(false)
const modalPos = reactive({ x: null, y: null })
const customWidth = ref(null)
const customHeight = ref(null)

const DEFAULT_WIDTH = 768
const DEFAULT_HEIGHT = 600

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

// Resize
let isResizing = false
let resizeStartX = 0
let resizeStartY = 0
let resizeStartW = 0
let resizeStartH = 0

const startResize = (e) => {
  isResizing = true
  resizeStartX = e.clientX
  resizeStartY = e.clientY
  const rect = modalRef.value.getBoundingClientRect()
  resizeStartW = rect.width
  resizeStartH = rect.height
  modalPos.x = rect.left
  modalPos.y = rect.top
  e.preventDefault()
}
const doResize = (e) => {
  if (!isResizing) return
  customWidth.value = Math.max(400, Math.min(window.innerWidth * 0.95, resizeStartW + (e.clientX - resizeStartX)))
  customHeight.value = Math.max(300, Math.min(window.innerHeight * 0.95, resizeStartH + (e.clientY - resizeStartY)))
}
const stopResize = () => { isResizing = false }

// Combined mouse handlers
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

const settingsLoading = ref(false)
const settingsError = ref(null)
const allProfiles = ref([])
const clientOsVersions = computed(() =>
  [...new Set(props.targetClients.map(c => c.osVersion).filter(Boolean))]
)
const filteredProfiles = computed(() =>
  filterProfilesByClientOs(allProfiles.value, clientOsVersions.value)
)
const selectedProfileId = ref(null)
const availableTasks = computed(() =>
  filteredProfiles.value.find(p => p.profileId === selectedProfileId.value)?.tasks || []
)
const selectedTaskIds = ref([])
const progressItems = ref([])
const resultBannerClass = computed(() => {
  const r = updateDeploy.result.value
  if (!r) return ''
  if (r.cancelled) return 'bg-gray-100 dark:bg-gray-800'
  if (r.error) return 'bg-red-50 dark:bg-red-900/20'
  if (r.failed > 0) return 'bg-amber-50 dark:bg-amber-900/20'
  return 'bg-green-50 dark:bg-green-900/20'
})

watch(() => props.modelValue, async (v) => {
  if (v && props.agentGroup) {
    updateDeploy.reset()
    progressItems.value = []
    selectedTaskIds.value = []
    selectedProfileId.value = null
    settingsError.value = null
    await loadSettings()
  }
})

watch(selectedProfileId, () => {
  selectedTaskIds.value = availableTasks.value.map(t => t.taskId)
})

async function loadSettings() {
  settingsLoading.value = true
  try {
    const response = await updateSettingsApi.getSettings(props.agentGroup)
    allProfiles.value = response.data?.profiles || []
    // Auto-select first filtered profile
    selectedProfileId.value = filteredProfiles.value[0]?.profileId || null
  } catch (error) {
    console.error('Failed to load update settings:', error)
    settingsError.value = error.message || 'Unknown error'
    allProfiles.value = []
  } finally {
    settingsLoading.value = false
  }
}

async function handleDeploy() {
  const targetEqpIds = props.targetClients.map(c => c.eqpId || c.id)
  updateDeploy.reset()
  progressItems.value = []

  await updateDeploy.deploy(
    props.agentGroup,
    selectedProfileId.value,
    selectedTaskIds.value,
    targetEqpIds,
    (data) => {
      // Update or add progress item
      const key = `${data.eqpId}-${data.taskId}`
      const existing = progressItems.value.find(
        p => `${p.eqpId}-${p.taskId}` === key
      )
      if (existing) {
        Object.assign(existing, data)
      } else {
        progressItems.value.push({ ...data })
      }
    }
  )

  if (updateDeploy.result.value && !updateDeploy.result.value.error) {
    emit('deployed')
  }
}

function handleClose() {
  if (!deploying.value) {
    modalPos.x = null
    modalPos.y = null
    customWidth.value = null
    customHeight.value = null
    isMaximized.value = false
    emit('update:modelValue', false)
  }
}
</script>
