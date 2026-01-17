<script setup>
import { ref, onMounted, watch } from 'vue'
import { clientsApi } from '../../../shared/api'

const props = defineProps({
  process: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['select'])

const models = ref([])
const loading = ref(true)
const error = ref(null)

const fetchModels = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await clientsApi.getModels(props.process)
    const modelNames = response.data

    // Fetch client counts per model
    const modelsWithCount = await Promise.all(
      modelNames.map(async (name) => {
        try {
          const clientsRes = await clientsApi.getClients(props.process, name)
          return {
            name,
            count: clientsRes.data.length
          }
        } catch {
          return { name, count: 0 }
        }
      })
    )

    models.value = modelsWithCount
  } catch (err) {
    console.error('Failed to fetch models:', err)
    error.value = 'Failed to load models'
  } finally {
    loading.value = false
  }
}

onMounted(fetchModels)

watch(() => props.process, fetchModels)
</script>

<template>
  <div class="p-6">
    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
      Select Equipment Model ({{ process }})
    </h3>

    <div v-if="loading" class="text-center py-8 text-gray-500">
      Loading models...
    </div>

    <div v-else-if="error" class="text-center py-8 text-red-500">
      {{ error }}
    </div>

    <div v-else-if="models.length === 0" class="text-center py-8 text-gray-500">
      No models found
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <button
        v-for="model in models"
        :key="model.name"
        @click="emit('select', model.name)"
        class="p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition text-left group"
      >
        <div class="flex items-center justify-between">
          <span class="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
            {{ model.name }}
          </span>
          <svg class="w-5 h-5 text-gray-400 group-hover:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ model.count }}</span>
          <span class="text-sm text-gray-500 dark:text-gray-400">clients</span>
        </div>
      </button>
    </div>
  </div>
</template>
