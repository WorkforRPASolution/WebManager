<template>
  <div class="flex items-center justify-between p-4 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
    <!-- Left side - Action buttons -->
    <div class="flex items-center gap-2">
      <!-- All Status Button -->
      <button
        @click="$emit('refresh')"
        :disabled="loading"
        class="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg :class="['w-4 h-4', loading ? 'animate-spin' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        All Status
      </button>

      <!-- Status Button -->
      <button
        @click="$emit('control', 'status')"
        :disabled="selectedCount === 0 || operating"
        class="flex items-center gap-1.5 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Status
      </button>

      <!-- Start Button -->
      <button
        v-if="canWrite"
        @click="$emit('control', 'start')"
        :disabled="selectedCount === 0 || operating"
        class="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        </svg>
        Start
      </button>

      <!-- Stop Button -->
      <button
        v-if="canWrite"
        @click="$emit('control', 'stop')"
        :disabled="selectedCount === 0 || operating"
        class="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
        Stop
      </button>

      <!-- Force Kill Button -->
      <button
        v-if="canWrite"
        @click="$emit('control', 'kill')"
        :disabled="selectedCount === 0 || operating"
        class="flex items-center gap-1.5 px-3 py-2 bg-red-700 hover:bg-red-800 text-white font-medium rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9" />
        </svg>
        Force Kill
      </button>

      <!-- Restart Button -->
      <button
        v-if="canWrite"
        @click="$emit('control', 'restart')"
        :disabled="selectedCount === 0 || operating"
        class="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Restart
      </button>

      <div v-if="canWrite || canDelete" class="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

      <!-- Update Button -->
      <button
        v-if="canDelete"
        @click="$emit('update')"
        :disabled="selectedCount === 0 || operating"
        class="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Update
      </button>

      <!-- Update Settings Button -->
      <button
        v-if="isAdmin"
        @click="$emit('update-settings')"
        :disabled="operating"
        class="flex items-center p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        title="Update Settings"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </button>

      <!-- Config Button -->
      <button
        v-if="canWrite"
        @click="$emit('config')"
        :disabled="selectedCount === 0 || operating"
        class="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Config
      </button>

      <!-- Config Settings Button -->
      <button
        v-if="isAdmin"
        @click="$emit('config-settings')"
        :disabled="operating"
        class="flex items-center p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        title="Config File Settings"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      <!-- Log Button -->
      <button
        v-if="canRead"
        @click="$emit('log')"
        :disabled="selectedCount === 0 || operating"
        class="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Log
      </button>

      <!-- Log Settings Button -->
      <button
        v-if="isAdmin"
        @click="$emit('log-settings')"
        :disabled="operating"
        class="flex items-center p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        title="Log Source Settings"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>

    </div>

    <!-- Right side - Status info and Pagination -->
    <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
      <!-- Total count -->
      <span>Total: {{ totalCount }} clients</span>

      <!-- Page size selector -->
      <div class="flex items-center gap-2">
        <span>Rows:</span>
        <select
          :value="pageSize"
          @change="$emit('page-size-change', Number($event.target.value))"
          class="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="75">75</option>
          <option :value="100">100</option>
        </select>
      </div>

      <!-- Pagination controls (server-side) -->
      <div v-if="totalPages > 1" class="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
        <button
          @click="$emit('page-change', 1)"
          :disabled="currentPage === 1"
          class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="First page"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
        <button
          @click="$emit('page-change', currentPage - 1)"
          :disabled="currentPage === 1"
          class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span class="px-2">
          Page {{ currentPage }} of {{ totalPages }}
        </span>

        <button
          @click="$emit('page-change', currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next page"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          @click="$emit('page-change', totalPages)"
          :disabled="currentPage === totalPages"
          class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Last page"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  canRead: {
    type: Boolean,
    default: false
  },
  canWrite: {
    type: Boolean,
    default: false
  },
  canDelete: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  selectedCount: {
    type: Number,
    default: 0
  },
  operating: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  totalCount: {
    type: Number,
    default: 0
  },
  pageSize: {
    type: Number,
    default: 25
  },
  currentPage: {
    type: Number,
    default: 1
  },
  totalPages: {
    type: Number,
    default: 1
  }
})

defineEmits(['control', 'update', 'config', 'config-settings', 'log', 'log-settings', 'update-settings', 'refresh', 'page-size-change', 'page-change'])
</script>
