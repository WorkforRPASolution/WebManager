<script setup>
import { ref, computed, watch } from 'vue'
import EarsUserSearch from '../../../shared/components/EarsUserSearch.vue'
import { mapEarsUserToRow } from '../composables/earsUserMapping'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'close'])

const pendingUser = ref(null)
const preview = computed(() => pendingUser.value ? mapEarsUserToRow(pendingUser.value) : null)

function handleSelect(user) {
  pendingUser.value = user
}

function handleClear() {
  pendingUser.value = null
}

function confirm() {
  if (!pendingUser.value) return
  emit('select', pendingUser.value)
  emit('close')
}

function close() {
  emit('close')
}

// Reset state when modal opens
watch(() => props.visible, (v) => {
  if (v) pendingUser.value = null
})

function onKeydown(e) {
  if (e.key === 'Escape') close()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[9999] flex items-center justify-center" @keydown="onKeydown">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="close" />

      <!-- Modal -->
      <div class="relative bg-white dark:bg-dark-card rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border w-full max-w-3xl mx-4 flex flex-col max-h-[80vh]">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-dark-border">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">EARS 사용자 검색</h3>
          <button
            class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition"
            @click="close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <EarsUserSearch @select="handleSelect" @clear="handleClear" />

          <!-- Preview -->
          <div v-if="preview" class="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 space-y-1.5">
            <p class="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">입력 미리보기</p>
            <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <span class="text-gray-500 dark:text-gray-400">User ID</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ preview.singleid }}</span>
              <span class="text-gray-500 dark:text-gray-400">Name</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ preview.name }}</span>
              <span class="text-gray-500 dark:text-gray-400">Department</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ preview.department || '-' }}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-dark-border">
          <button
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
            @click="close"
          >
            취소
          </button>
          <button
            :disabled="!pendingUser"
            class="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            @click="confirm"
          >
            선택
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
