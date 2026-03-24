<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] },
  pagination: {
    type: Object,
    default: () => ({ total: 0, page: 1, pageSize: 20, totalPages: 0, hasNextPage: false, hasPrevPage: false })
  },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['page-change', 'row-click'])

const categoryBadgeClasses = {
  audit: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  auth: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  batch: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  access: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  'eqp-redis': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
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

function getActionText(row) {
  switch (row.category) {
    case 'auth':
      return row.authAction || '-'
    case 'batch':
      return row.batchAction || '-'
    case 'error':
      return row.errorType || '-'
    case 'audit':
      return row.action || '-'
    case 'access':
      return row.pagePath || '-'
    case 'eqp-redis':
      return row.syncOperation || '-'
    default:
      return row.action || row.authAction || row.batchAction || row.errorType || '-'
  }
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return ''
  if (ms < 1000) return `${ms}ms`
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const remSec = sec % 60
  return `${min}m ${remSec}s`
}

function getMessageText(row) {
  switch (row.category) {
    case 'error':
      return row.errorMessage || '-'
    case 'audit': {
      const parts = []
      if (row.collectionName) parts.push(row.collectionName)
      if (row.targetType) parts.push(row.targetType)
      if (row.documentId) parts.push(row.documentId)
      if (row.targetId) parts.push(row.targetId)
      return parts.length > 0 ? parts.join(' / ') : '-'
    }
    case 'auth':
      return row.authAction ? describeAuthAction(row.authAction) : '-'
    case 'batch':
      return row.batchAction || '-'
    case 'access': {
      const parts = []
      if (row.pageName) parts.push(row.pageName)
      if (row.durationMs != null) parts.push(formatDuration(row.durationMs))
      return parts.length > 0 ? parts.join(' — ') : '-'
    }
    case 'eqp-redis': {
      const parts = []
      if (row.syncEqpId) parts.push(row.syncEqpId)
      if (row.syncError) parts.push(row.syncError)
      return parts.length > 0 ? parts.join(' — ') : '-'
    }
    default:
      return row.message || row.errorMessage || '-'
  }
}

function describeAuthAction(action) {
  const map = {
    login: 'User logged in',
    logout: 'User logged out',
    signup: 'New user registered',
    'password-change': 'Password changed',
    'password-reset-request': 'Password reset requested',
    'password-reset': 'Password reset completed'
  }
  return map[action] || action
}

const showingFrom = computed(() => {
  if (props.pagination.total === 0) return 0
  return (props.pagination.page - 1) * props.pagination.pageSize + 1
})

const showingTo = computed(() => {
  return Math.min(props.pagination.page * props.pagination.pageSize, props.pagination.total)
})

const visiblePages = computed(() => {
  const { page, totalPages } = props.pagination
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const pages = []
  pages.push(1)
  if (page > 3) pages.push('...')

  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (page < totalPages - 2) pages.push('...')
  if (totalPages > 1) pages.push(totalPages)

  return pages
})
</script>

<template>
  <div class="relative flex flex-col h-full">
    <!-- Loading overlay -->
    <div
      v-if="loading"
      class="absolute inset-0 bg-white/60 dark:bg-dark-card/60 z-10 flex items-center justify-center rounded-xl"
    >
      <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading...
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="!loading && data.length === 0"
      class="text-center py-12 text-gray-400 dark:text-gray-500 text-sm"
    >
      No logs found
    </div>

    <!-- Table -->
    <div v-else class="flex-1 min-h-0 overflow-auto">
      <table class="w-full text-sm text-left">
        <thead>
          <tr class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-dark-border sticky top-0 z-[1]">
            <th class="px-4 py-3 font-medium">Timestamp</th>
            <th class="px-4 py-3 font-medium">Category</th>
            <th class="px-4 py-3 font-medium">User</th>
            <th class="px-4 py-3 font-medium">Action / Type</th>
            <th class="px-4 py-3 font-medium">Message</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in data"
            :key="row._id || idx"
            class="border-b border-gray-100 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-dark-border/30 cursor-pointer transition-colors"
            @click="emit('row-click', row)"
          >
            <td class="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
              {{ formatTimestamp(row.timestamp || row.createdAt) }}
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                :class="getBadgeClass(row.category)"
              >
                {{ row.category }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
              {{ row.userId || '-' }}
            </td>
            <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
              {{ getActionText(row) }}
            </td>
            <td class="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-xs truncate" :title="getMessageText(row)">
              {{ getMessageText(row) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div
      v-if="pagination.total > 0"
      class="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-dark-border"
    >
      <!-- Left: result count -->
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Showing <span class="font-medium text-gray-700 dark:text-gray-200">{{ showingFrom }}</span>
        to <span class="font-medium text-gray-700 dark:text-gray-200">{{ showingTo }}</span>
        of <span class="font-medium text-gray-700 dark:text-gray-200">{{ pagination.total }}</span> results
      </p>

      <!-- Right: page buttons -->
      <div class="flex items-center gap-1">
        <!-- Prev -->
        <button
          :disabled="!pagination.hasPrevPage"
          @click="emit('page-change', pagination.page - 1)"
          class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-dark-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          :class="pagination.hasPrevPage
            ? 'bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border/50'
            : 'bg-white dark:bg-dark-card text-gray-400 dark:text-gray-500'"
        >
          Prev
        </button>

        <!-- Page numbers -->
        <template v-for="(p, idx) in visiblePages" :key="idx">
          <span
            v-if="p === '...'"
            class="px-2 py-1.5 text-sm text-gray-400 dark:text-gray-500"
          >...</span>
          <button
            v-else
            @click="emit('page-change', p)"
            class="px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors"
            :class="p === pagination.page
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-border/50'"
          >
            {{ p }}
          </button>
        </template>

        <!-- Next -->
        <button
          :disabled="!pagination.hasNextPage"
          @click="emit('page-change', pagination.page + 1)"
          class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-dark-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          :class="pagination.hasNextPage
            ? 'bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border/50'
            : 'bg-white dark:bg-dark-card text-gray-400 dark:text-gray-500'"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
