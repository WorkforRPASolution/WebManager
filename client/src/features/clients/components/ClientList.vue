<script setup>
import { ref, onMounted, watch } from 'vue'
import { clientsApi } from '../../../shared/api'

const props = defineProps({
  process: {
    type: String,
    required: true
  },
  model: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['click'])

const clients = ref([])
const loading = ref(true)
const error = ref(null)

const getStatusClass = (status) => {
  switch (status?.toUpperCase()) {
    case 'ONLINE': return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
    case 'BUSY': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    case 'OFFLINE': return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
    case 'ERROR': return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    default: return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
  }
}

const fetchClients = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await clientsApi.getClients(props.process, props.model)
    clients.value = response.data.map(client => ({
      ...client,
      name: client.eqpId,
      ipAddr: client.ipAddress,
      cpu: Math.floor(Math.random() * 100),
      memory: Math.floor(Math.random() * 100),
    }))
  } catch (err) {
    console.error('Failed to fetch clients:', err)
    error.value = 'Failed to load clients'
  } finally {
    loading.value = false
  }
}

onMounted(fetchClients)

watch([() => props.process, () => props.model], fetchClients)
</script>

<template>
  <div class="p-6">
    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
      Clients ({{ process }} / {{ model }})
    </h3>

    <div v-if="loading" class="text-center py-8 text-gray-500">
      Loading clients...
    </div>

    <div v-else-if="error" class="text-center py-8 text-red-500">
      {{ error }}
    </div>

    <div v-else-if="clients.length === 0" class="text-center py-8 text-gray-500">
      No clients found
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-200 dark:border-dark-border">
            <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Equipment ID
            </th>
            <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Model
            </th>
            <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              IP Address
            </th>
            <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              OS Version
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="client in clients"
            :key="client.eqpId"
            @click="emit('click', client)"
            class="border-b border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-border cursor-pointer transition"
          >
            <td class="py-4 px-4">
              <span class="font-mono text-sm text-gray-900 dark:text-white">{{ client.eqpId }}</span>
            </td>
            <td class="py-4 px-4">
              <span class="text-gray-900 dark:text-white">{{ client.eqpModel }}</span>
            </td>
            <td class="py-4 px-4">
              <span class="font-mono text-sm text-gray-600 dark:text-gray-400">{{ client.ipAddr }}</span>
            </td>
            <td class="py-4 px-4">
              <span
                class="px-2 py-1 rounded-full text-xs font-medium uppercase"
                :class="getStatusClass(client.status)"
              >
                {{ client.status }}
              </span>
            </td>
            <td class="py-4 px-4">
              <span class="text-sm text-gray-600 dark:text-gray-400">{{ client.osVersion }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
