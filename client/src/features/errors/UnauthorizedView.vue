<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-dark-bg">
    <div class="text-center">
      <div class="w-20 h-20 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
        <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
      <p class="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
        You don't have permission to access this page. Please contact your administrator if you believe this is an error.
      </p>
      <div class="flex gap-3 justify-center">
        <button
          @click="$router.go(-1)"
          class="px-4 py-2 bg-gray-200 dark:bg-dark-border hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
        >
          Go Back
        </button>
        <router-link
          to="/"
          class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        >
          Go to Dashboard
        </router-link>
      </div>
    </div>
  </div>
</template>
