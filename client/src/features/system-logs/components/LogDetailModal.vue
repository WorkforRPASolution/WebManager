<script setup>
import { computed } from 'vue'

const props = defineProps({
  log: { type: Object, default: null },
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const categoryBadgeClasses = {
  audit: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  auth: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  batch: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
}

function getBadgeClass(category) {
  return categoryBadgeClasses[category] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
}

function formatTimestamp(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatJson(value) {
  if (!value) return '-'
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  return JSON.stringify(value, null, 2)
}

const isAudit = computed(() => props.log?.category === 'audit')
const isError = computed(() => props.log?.category === 'error')
const isAuth = computed(() => props.log?.category === 'auth')
const isBatch = computed(() => props.log?.category === 'batch')
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && log"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click="emit('close')"
    >
      <div
        class="bg-white dark:bg-dark-card rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border w-full max-w-2xl max-h-[80vh] flex flex-col mx-4"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Log Detail</h2>
            <span
              class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
              :class="getBadgeClass(log.category)"
            >
              {{ log.category }}
            </span>
          </div>
          <button
            @click="emit('close')"
            class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <!-- Common fields -->
          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</p>
            <p class="text-sm text-gray-900 dark:text-white mt-1 font-mono">{{ log._id || '-' }}</p>
          </div>

          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</p>
            <p class="text-sm text-gray-900 dark:text-white mt-1">{{ log.category || '-' }}</p>
          </div>

          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Timestamp</p>
            <p class="text-sm text-gray-900 dark:text-white mt-1">{{ formatTimestamp(log.timestamp || log.createdAt) }}</p>
          </div>

          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User ID</p>
            <p class="text-sm text-gray-900 dark:text-white mt-1">{{ log.userId || '-' }}</p>
          </div>

          <!-- Audit fields -->
          <template v-if="isAudit">
            <div>
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Collection</p>
              <p class="text-sm text-gray-900 dark:text-white mt-1">{{ log.collectionName || '-' }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Document ID</p>
              <p class="text-sm text-gray-900 dark:text-white mt-1 font-mono">{{ log.documentId || '-' }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</p>
              <p class="text-sm text-gray-900 dark:text-white mt-1">{{ log.action || '-' }}</p>
            </div>
            <div v-if="log.changes">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Changes</p>
              <pre class="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 text-xs font-mono overflow-x-auto mt-1 text-gray-900 dark:text-white">{{ formatJson(log.changes) }}</pre>
            </div>
          </template>

          <!-- Error fields -->
          <template v-if="isError">
            <div>
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Error Type</p>
              <p class="text-sm text-gray-900 dark:text-white mt-1">{{ log.errorType || '-' }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Error Message</p>
              <p class="text-sm text-gray-900 dark:text-white mt-1">{{ log.errorMessage || '-' }}</p>
            </div>
            <div v-if="log.errorStack">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Error Stack</p>
              <pre class="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 text-xs font-mono overflow-x-auto mt-1 text-gray-900 dark:text-white whitespace-pre-wrap">{{ log.errorStack }}</pre>
            </div>
            <div v-if="log.requestInfo">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Request Info</p>
              <pre class="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 text-xs font-mono overflow-x-auto mt-1 text-gray-900 dark:text-white">{{ formatJson(log.requestInfo) }}</pre>
            </div>
          </template>

          <!-- Auth fields -->
          <template v-if="isAuth">
            <div>
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Auth Action</p>
              <p class="text-sm text-gray-900 dark:text-white mt-1">{{ log.authAction || '-' }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IP Address</p>
              <p class="text-sm text-gray-900 dark:text-white mt-1 font-mono">{{ log.ipAddress || '-' }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User Agent</p>
              <p class="text-sm text-gray-900 dark:text-white mt-1 text-xs break-all">{{ log.userAgent || '-' }}</p>
            </div>
          </template>

          <!-- Batch fields -->
          <template v-if="isBatch">
            <div>
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch Action</p>
              <p class="text-sm text-gray-900 dark:text-white mt-1">{{ log.batchAction || '-' }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch Period</p>
              <p class="text-sm text-gray-900 dark:text-white mt-1">{{ log.batchPeriod || '-' }}</p>
            </div>
            <div v-if="log.batchParams">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch Params</p>
              <pre class="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 text-xs font-mono overflow-x-auto mt-1 text-gray-900 dark:text-white">{{ formatJson(log.batchParams) }}</pre>
            </div>
            <div v-if="log.batchResult">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch Result</p>
              <pre class="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 text-xs font-mono overflow-x-auto mt-1 text-gray-900 dark:text-white">{{ formatJson(log.batchResult) }}</pre>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 dark:border-dark-border flex justify-end">
          <button
            @click="emit('close')"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-border rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
