<script setup>
import { ref, onMounted } from 'vue'
import { clientsApi } from '../../../shared/api'

const emit = defineEmits(['select'])

const processes = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const response = await clientsApi.getProcesses()
    // Transform to include count (we'll fetch count separately or estimate)
    const processNames = response.data

    // Fetch client counts per process
    const processesWithCount = await Promise.all(
      processNames.map(async (name) => {
        try {
          const clientsRes = await clientsApi.getClients(name)
          return {
            name,
            count: clientsRes.data.length,
            status: 'active'
          }
        } catch {
          return { name, count: 0, status: 'active' }
        }
      })
    )

    processes.value = processesWithCount
  } catch (err) {
    console.error('Failed to fetch processes:', err)
    error.value = 'Failed to load processes'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="p-6">
    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
      Select Process
    </h3>

    <div v-if="loading" class="text-center py-8 text-gray-500">
      Loading processes...
    </div>

    <div v-else-if="error" class="text-center py-8 text-red-500">
      {{ error }}
    </div>

    <div v-else-if="processes.length === 0" class="text-center py-8 text-gray-500">
      No processes found
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <button
        v-for="process in processes"
        :key="process.name"
        @click="emit('select', process.name)"
        class="p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition text-left group"
      >
        <div class="flex items-center justify-between">
          <span class="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
            {{ process.name }}
          </span>
          <svg class="w-5 h-5 text-gray-400 group-hover:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ process.count }}</span>
          <span class="text-sm text-gray-500 dark:text-gray-400">clients</span>
        </div>
      </button>
    </div>
  </div>
</template>
