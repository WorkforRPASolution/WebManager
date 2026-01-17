<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ProcessList from './components/ProcessList.vue'
import ModelList from './components/ModelList.vue'
import ClientList from './components/ClientList.vue'

const router = useRouter()

const selectedProcess = ref(null)
const selectedModel = ref(null)

const handleProcessSelect = (process) => {
  selectedProcess.value = process
  selectedModel.value = null
}

const handleModelSelect = (model) => {
  selectedModel.value = model
}

const handleClientClick = (client) => {
  router.push(`/clients/${client.eqpId}`)
}

const handleBack = () => {
  if (selectedModel.value) {
    selectedModel.value = null
  } else if (selectedProcess.value) {
    selectedProcess.value = null
  }
}

const breadcrumbs = computed(() => {
  const items = [{ label: 'All Processes', value: null }]
  if (selectedProcess.value) {
    items.push({ label: selectedProcess.value, value: 'process' })
  }
  if (selectedModel.value) {
    items.push({ label: selectedModel.value, value: 'model' })
  }
  return items
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Manage and monitor your clients</p>
    </div>

    <!-- Breadcrumbs -->
    <div class="flex items-center gap-2 mb-6 text-sm">
      <template v-for="(item, index) in breadcrumbs" :key="index">
        <button
          v-if="index < breadcrumbs.length - 1"
          @click="index === 0 ? (selectedProcess = null, selectedModel = null) : (index === 1 ? selectedModel = null : null)"
          class="text-primary-500 hover:text-primary-600"
        >
          {{ item.label }}
        </button>
        <span v-else class="text-gray-900 dark:text-white font-medium">
          {{ item.label }}
        </span>
        <svg v-if="index < breadcrumbs.length - 1" class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </template>
    </div>

    <!-- Back Button -->
    <button
      v-if="selectedProcess"
      @click="handleBack"
      class="mb-4 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
      </svg>
      <span>Back</span>
    </button>

    <!-- Content -->
    <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border">
      <!-- Process List -->
      <ProcessList
        v-if="!selectedProcess"
        @select="handleProcessSelect"
      />

      <!-- Model List -->
      <ModelList
        v-else-if="!selectedModel"
        :process="selectedProcess"
        @select="handleModelSelect"
      />

      <!-- Client List -->
      <ClientList
        v-else
        :process="selectedProcess"
        :model="selectedModel"
        @click="handleClientClick"
      />
    </div>
  </div>
</template>
