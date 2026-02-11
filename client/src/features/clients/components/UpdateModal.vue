<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="!deploying && handleClose()"
    >
      <div class="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Software Update
          </h3>
          <button v-if="!deploying" @click="handleClose"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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

          <!-- Package Selection -->
          <div>
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Select Packages</h4>
            <div v-if="availablePackages.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
              No packages configured. Please configure Update Settings first.
            </div>
            <div v-else class="space-y-2">
              <label v-for="pkg in availablePackages" :key="pkg.packageId"
                class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors"
                :class="selectedPackageIds.includes(pkg.packageId)
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg'">
                <input type="checkbox" :value="pkg.packageId" v-model="selectedPackageIds"
                  class="w-4 h-4 text-green-500 rounded border-gray-300 focus:ring-green-500" />
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-900 dark:text-white">{{ pkg.name }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {{ pkg.targetPath }} ({{ pkg.targetType }})
                  </div>
                </div>
                <span v-if="pkg.description" class="text-xs text-gray-400">{{ pkg.description }}</span>
              </label>
            </div>
          </div>

          <!-- Deploy Progress -->
          <div v-if="deploying || updateDeploy.result.value">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Deploy Progress</h4>
            <div class="space-y-1.5">
              <div v-for="item in progressItems" :key="`${item.eqpId}-${item.packageId}`"
                class="flex items-center gap-3 px-3 py-2 rounded text-sm"
                :class="{
                  'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300': item.status === 'success',
                  'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300': item.status === 'error',
                  'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300': item.status === 'uploading'
                }">
                <span class="font-mono">{{ item.eqpId }}</span>
                <span class="text-gray-400">{{ item.packageId }}</span>
                <span class="flex-1"></span>
                <span v-if="item.status === 'success'" class="font-medium">Done</span>
                <span v-else-if="item.status === 'error'" class="font-medium">{{ item.error }}</span>
                <span v-else class="font-medium">Uploading...</span>
              </div>
            </div>

            <!-- Summary -->
            <div v-if="updateDeploy.result.value" class="mt-3 p-3 rounded-lg"
              :class="updateDeploy.result.value.failed > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20'">
              <p class="text-sm font-medium"
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
          <button v-if="!deploying && !updateDeploy.result.value"
            @click="handleDeploy"
            :disabled="selectedPackageIds.length === 0 || availablePackages.length === 0"
            class="flex items-center gap-2 px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Deploy
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { updateSettingsApi } from '../api'
import { useUpdateDeploy } from '../composables/useUpdateDeploy'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  agentGroup: { type: String, default: '' },
  targetClients: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'deployed'])

const updateDeploy = useUpdateDeploy()
const deploying = computed(() => updateDeploy.deploying.value)

const settingsLoading = ref(false)
const availablePackages = ref([])
const selectedPackageIds = ref([])
const progressItems = ref([])

watch(() => props.modelValue, async (v) => {
  if (v && props.agentGroup) {
    updateDeploy.reset()
    progressItems.value = []
    selectedPackageIds.value = []
    await loadSettings()
  }
})

async function loadSettings() {
  settingsLoading.value = true
  try {
    const response = await updateSettingsApi.getSettings(props.agentGroup)
    availablePackages.value = response.data?.packages || []
    // Auto-select all packages
    selectedPackageIds.value = availablePackages.value.map(p => p.packageId)
  } catch (error) {
    console.error('Failed to load update settings:', error)
    availablePackages.value = []
  } finally {
    settingsLoading.value = false
  }
}

async function handleDeploy() {
  const targetEqpIds = props.targetClients.map(c => c.eqpId || c.id)
  progressItems.value = []

  await updateDeploy.deploy(
    props.agentGroup,
    selectedPackageIds.value,
    targetEqpIds,
    (data) => {
      // Update or add progress item
      const key = `${data.eqpId}-${data.packageId}`
      const existing = progressItems.value.find(
        p => `${p.eqpId}-${p.packageId}` === key
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
    emit('update:modelValue', false)
  }
}
</script>
