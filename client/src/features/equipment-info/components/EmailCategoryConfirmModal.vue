<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="handleNo"
    >
      <div class="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg">
        <!-- Header -->
        <div class="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <svg class="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Email Info 등록 필요
          </h3>
        </div>

        <!-- Content -->
        <div class="px-6 py-4">
          <p class="text-gray-700 dark:text-gray-300 mb-4">
            다음 Email Category는 등록된 Email Info가 없습니다:
          </p>
          <ul class="bg-gray-50 dark:bg-dark-border rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
            <li v-for="cat in categories" :key="cat" class="text-sm font-mono text-gray-800 dark:text-gray-200 py-1">
              {{ cat }}
            </li>
          </ul>
          <p class="text-gray-700 dark:text-gray-300 mb-2">
            새로 등록하시겠습니까?
          </p>
          <p class="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01" />
            </svg>
            "아니오"를 선택하면 데이터 저장이 취소됩니다.
          </p>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-dark-border">
          <button
            @click="handleNo"
            class="px-4 py-2 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            아니오
          </button>
          <button
            @click="handleYes"
            class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            예, 등록합니다
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  modelValue: Boolean,
  categories: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const handleYes = () => {
  emit('update:modelValue', false)
  emit('confirm')
}

const handleNo = () => {
  emit('update:modelValue', false)
  emit('cancel')
}
</script>
