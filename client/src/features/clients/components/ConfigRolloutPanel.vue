<template>
  <div class="w-80 border-l border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg flex flex-col overflow-hidden shrink-0">
    <!-- Panel Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border">
      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Deploy Config</h4>
      <button
        @click="$emit('close')"
        class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Panel Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Source Info -->
      <div class="space-y-1">
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source</div>
        <div class="text-sm text-gray-800 dark:text-gray-200">{{ sourceClient?.eqpId }}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ activeFile?.name }}</div>
      </div>

      <!-- Deploy Mode -->
      <div class="space-y-2">
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Deploy Mode</div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" v-model="deployMode" value="full" class="text-primary-500 focus:ring-primary-500" />
          <span class="text-sm text-gray-700 dark:text-gray-300">Full file</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" v-model="deployMode" value="selective" class="text-primary-500 focus:ring-primary-500" />
          <span class="text-sm text-gray-700 dark:text-gray-300">Selected keys only</span>
        </label>
      </div>

      <!-- JSON Key Selection (selective mode) -->
      <div v-if="deployMode === 'selective'" class="space-y-2">
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Select Keys</div>
        <div class="max-h-48 overflow-y-auto bg-white dark:bg-dark-card rounded border border-gray-200 dark:border-dark-border p-2">
          <JsonTreeSelector
            :json="activeContent"
            :selected-keys="selectedKeys"
            @update:selectedKeys="selectedKeys = $event"
          />
        </div>
        <p v-if="selectedKeys.size === 0" class="text-xs text-amber-600 dark:text-amber-400">
          Select at least one key to deploy
        </p>
      </div>

      <!-- Targets -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            Targets ({{ sourceClient?.eqpModel }})
          </div>
          <button
            v-if="!loadingTargets"
            @click="loadTargets"
            class="text-xs text-primary-500 hover:text-primary-600"
          >
            Refresh
          </button>
        </div>

        <!-- Loading -->
        <div v-if="loadingTargets" class="flex items-center gap-2 text-sm text-gray-500 py-2">
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading targets...
        </div>

        <!-- Target List -->
        <div v-else-if="targets.length > 0" class="space-y-1">
          <!-- Select All -->
          <label class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
            <input
              type="checkbox"
              :checked="allTargetsSelected"
              @change="toggleAllTargets"
              class="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
            />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select All ({{ targets.length }})
            </span>
          </label>

          <div class="max-h-48 overflow-y-auto space-y-0.5">
            <label
              v-for="target in targets"
              :key="target.eqpId"
              class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              <input
                type="checkbox"
                :checked="selectedTargets.has(target.eqpId)"
                @change="toggleTarget(target.eqpId)"
                class="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
              />
              <span class="text-xs font-mono text-gray-700 dark:text-gray-300">{{ target.eqpId }}</span>
              <span class="text-xs text-gray-400">{{ target.ipAddress }}</span>
            </label>
          </div>
        </div>

        <!-- No targets -->
        <div v-else class="text-sm text-gray-500 dark:text-gray-400 py-2">
          No other clients with model "{{ sourceClient?.eqpModel }}"
        </div>
      </div>

      <!-- Deploy Progress -->
      <ConfigDeployProgress
        v-if="deploying || deployResult"
        :deploying="deploying"
        :progress="deployProgress"
        :deploy-result="deployResult"
        :client-results="clientResults"
      />
    </div>

    <!-- Panel Footer -->
    <div class="px-4 py-3 border-t border-gray-200 dark:border-dark-border">
      <button
        @click="executeDeploy"
        :disabled="!canDeploy || deploying"
        class="w-full py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg v-if="deploying" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        {{ deploying ? 'Deploying...' : 'Execute Deploy' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { clientConfigApi } from '../api'
import JsonTreeSelector from './JsonTreeSelector.vue'
import ConfigDeployProgress from './ConfigDeployProgress.vue'

const props = defineProps({
  sourceClient: Object,
  activeFile: Object,
  activeContent: String,
  configFiles: Array,
  agentGroup: String,
  selectedClientIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['close'])

// State
const deployMode = ref('full')
const selectedKeys = ref(new Set())
const targets = ref([])
const selectedTargets = ref(new Set())
const loadingTargets = ref(false)
const deploying = ref(false)
const deployProgress = ref({ completed: 0, total: 0 })
const deployResult = ref(null)
const clientResults = ref([])

// Computed
const allTargetsSelected = computed(() =>
  targets.value.length > 0 && targets.value.every(t => selectedTargets.value.has(t.eqpId))
)

const canDeploy = computed(() => {
  if (selectedTargets.value.size === 0) return false
  if (deployMode.value === 'selective' && selectedKeys.value.size === 0) return false
  return true
})

// Methods
async function loadTargets() {
  if (!props.sourceClient?.eqpModel) return

  loadingTargets.value = true
  try {
    const res = await clientConfigApi.getClientsByModel(
      props.sourceClient.eqpModel,
      props.sourceClient.eqpId || props.sourceClient.id
    )
    targets.value = res.data
    // Pre-select: if selectedClientIds provided, select only those; otherwise select all
    if (props.selectedClientIds.length > 0) {
      const preSelectSet = new Set(props.selectedClientIds)
      selectedTargets.value = new Set(
        targets.value.filter(t => preSelectSet.has(t.eqpId)).map(t => t.eqpId)
      )
    } else {
      selectedTargets.value = new Set(targets.value.map(t => t.eqpId))
    }
  } catch {
    targets.value = []
  } finally {
    loadingTargets.value = false
  }
}

function toggleAllTargets() {
  if (allTargetsSelected.value) {
    selectedTargets.value = new Set()
  } else {
    selectedTargets.value = new Set(targets.value.map(t => t.eqpId))
  }
}

function toggleTarget(eqpId) {
  const newSet = new Set(selectedTargets.value)
  if (newSet.has(eqpId)) {
    newSet.delete(eqpId)
  } else {
    newSet.add(eqpId)
  }
  selectedTargets.value = newSet
}

async function executeDeploy() {
  if (!canDeploy.value || !props.activeFile) return

  deploying.value = true
  deployResult.value = null
  clientResults.value = []
  deployProgress.value = { completed: 0, total: selectedTargets.value.size }

  const targetEqpIds = Array.from(selectedTargets.value)
  const sourceEqpId = props.sourceClient.eqpId || props.sourceClient.id
  const fileId = props.activeFile.fileId

  try {
    const API_URL = import.meta.env.VITE_API_URL || '/api'
    const token = localStorage.getItem('token')

    const body = {
      sourceEqpId,
      fileId,
      targetEqpIds,
      mode: deployMode.value,
      selectedKeys: deployMode.value === 'selective' ? Array.from(selectedKeys.value) : undefined,
      agentGroup: props.agentGroup
    }

    const response = await fetch(`${API_URL}/clients/config/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse SSE events
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.done) {
              deployResult.value = data
            } else {
              deployProgress.value = {
                completed: data.completed,
                total: data.total
              }
              clientResults.value = [
                ...clientResults.value,
                { eqpId: data.current, status: data.status, error: data.error }
              ]
            }
          } catch { /* ignore parse errors */ }
        }
      }
    }
  } catch (err) {
    deployResult.value = { error: err.message, done: true, success: 0, failed: targetEqpIds.length }
  } finally {
    deploying.value = false
  }
}

// Load targets on mount
onMounted(loadTargets)

// Reload targets when source client changes
watch(() => props.sourceClient?.eqpModel, loadTargets)
</script>
