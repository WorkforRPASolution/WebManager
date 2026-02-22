<template>
  <div :class="containerClass" class="p-3 space-y-3">
    <h5 :class="titleClass" class="text-xs font-semibold flex items-center gap-1">
      <!-- Suspend icon (ban) -->
      <svg v-if="mode === 'suspend'" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
      <!-- Resume icon (play) -->
      <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {{ effectiveTitle }}
    </h5>
    <p :class="hintClass" class="text-xs">항목을 추가하지 않으면 모든 트리거가 대상입니다.</p>
    <div v-for="(item, idx) in items" :key="idx" :class="itemClass" class="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-dark-bg">
      <FormField label="트리거" class="flex-1">
        <select :value="item.name" @change="$emit('update', idx, 'name', $event.target.value)" :disabled="readOnly" class="form-input text-xs">
          <option value="">-- 선택 --</option>
          <option v-for="tn in triggerNames" :key="tn" :value="tn">{{ tn }}</option>
        </select>
      </FormField>
      <FormField v-if="mode === 'suspend'" label="기간 (선택)" class="flex-1">
        <input type="text" :value="item.duration || ''" @input="$emit('update', idx, 'duration', $event.target.value)" :disabled="readOnly" placeholder="예: 30 minutes" class="form-input text-xs" />
      </FormField>
      <button v-if="!readOnly" type="button" class="mt-4 p-1 text-gray-400 hover:text-red-500 transition-colors" @click="$emit('remove', idx)">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <button v-if="!readOnly" type="button" :class="addButtonClass" class="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition" @click="$emit('add')">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      항목 추가
    </button>
  </div>
</template>

<script setup>
import FormField from './FormField.vue'
import { computed } from 'vue'

const props = defineProps({
  mode: { type: String, required: true, validator: v => ['suspend', 'resume'].includes(v) },
  items: { type: Array, default: () => [] },
  triggerNames: { type: Array, default: () => [] },
  readOnly: { type: Boolean, default: false },
  title: { type: String, default: '' }
})

defineEmits(['add', 'remove', 'update'])

const defaultTitles = {
  suspend: '트리거 실행 제한 (Suspend)',
  resume: '트리거 실행 제한 해제 (Resume)'
}

const effectiveTitle = computed(() => props.title || defaultTitles[props.mode])

const containerClass = computed(() => props.mode === 'suspend'
  ? 'border border-orange-200 dark:border-orange-800/50 rounded-lg bg-orange-50/50 dark:bg-orange-900/10'
  : 'border border-teal-200 dark:border-teal-800/50 rounded-lg bg-teal-50/50 dark:bg-teal-900/10'
)

const titleClass = computed(() => props.mode === 'suspend'
  ? 'text-orange-700 dark:text-orange-400'
  : 'text-teal-700 dark:text-teal-400'
)

const hintClass = computed(() => props.mode === 'suspend'
  ? 'text-orange-600 dark:text-orange-400'
  : 'text-teal-600 dark:text-teal-400'
)

const itemClass = computed(() => props.mode === 'suspend'
  ? 'border border-orange-100 dark:border-orange-800/30'
  : 'border border-teal-100 dark:border-teal-800/30'
)

const addButtonClass = computed(() => props.mode === 'suspend'
  ? 'text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20'
  : 'text-teal-600 dark:text-teal-400 border border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20'
)
</script>

<style scoped>
@import '../form-input.css';
</style>
