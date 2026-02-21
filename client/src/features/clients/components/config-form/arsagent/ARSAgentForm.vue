<template>
  <div class="space-y-6">
    <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200">
      에이전트 설정 (ARSAgent)
    </h3>

    <!-- ErrorTrigger Section -->
    <div class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
        <div class="flex items-center gap-2">
          <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ arsSchema.sections.ErrorTrigger.label }}</h4>
          <span class="relative group">
            <svg class="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="absolute z-50 hidden group-hover:block bottom-full left-0 mb-1 w-72 p-2 text-xs font-normal text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg whitespace-normal">
              {{ arsSchema.sections.ErrorTrigger.description }}
            </span>
          </span>
        </div>
      </div>
      <div class="px-4 py-3">
        <div v-if="triggerNames.length === 0" class="text-sm text-gray-400 dark:text-gray-500 py-2">
          등록된 트리거가 없습니다. trigger.json 탭에서 먼저 트리거를 추가해주세요.
        </div>
        <div v-else class="space-y-2">
          <label
            v-for="name in triggerNames"
            :key="name"
            class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover cursor-pointer select-none transition"
            :class="{ 'opacity-60 cursor-not-allowed': readOnly }"
          >
            <input
              type="checkbox"
              :checked="selectedTriggers.includes(name)"
              @change="toggleTrigger(name, $event.target.checked)"
              :disabled="readOnly"
              class="w-4 h-4 rounded border-gray-300 dark:border-dark-border text-primary-500 focus:ring-primary-500 dark:bg-dark-bg"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ name }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- AccessLogLists Section -->
    <div class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
        <div class="flex items-center gap-2">
          <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ arsSchema.sections.AccessLogLists.label }}</h4>
          <span class="relative group">
            <svg class="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="absolute z-50 hidden group-hover:block bottom-full left-0 mb-1 w-72 p-2 text-xs font-normal text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg whitespace-normal">
              {{ arsSchema.sections.AccessLogLists.description }}
            </span>
          </span>
        </div>
      </div>
      <div class="px-4 py-3">
        <div v-if="accessLogSources.length === 0" class="text-sm text-gray-400 dark:text-gray-500 py-2">
          등록된 로그 소스가 없습니다. AccessLog.json 탭에서 먼저 소스를 추가해주세요.
        </div>
        <div v-else class="space-y-2">
          <label
            v-for="name in accessLogSources"
            :key="name"
            class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover cursor-pointer select-none transition"
            :class="{ 'opacity-60 cursor-not-allowed': readOnly }"
          >
            <input
              type="checkbox"
              :checked="selectedAccessLogs.includes(name)"
              @change="toggleAccessLog(name, $event.target.checked)"
              :disabled="readOnly"
              class="w-4 h-4 rounded border-gray-300 dark:border-dark-border text-primary-500 focus:ring-primary-500 dark:bg-dark-bg"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ name }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ARSAGENT_SCHEMA } from './schema'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  readOnly: { type: Boolean, default: false },
  accessLogSources: { type: Array, default: () => [] },
  triggerNames: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue'])

const arsSchema = ARSAGENT_SCHEMA

const selectedTriggers = computed(() =>
  (props.modelValue?.ErrorTrigger || []).map(t => t.alid)
)

const selectedAccessLogs = computed(() =>
  props.modelValue?.AccessLogLists || []
)

function toggleTrigger(name, checked) {
  let triggers = [...(props.modelValue?.ErrorTrigger || [])]
  if (checked) {
    triggers.push({ alid: name })
  } else {
    triggers = triggers.filter(t => t.alid !== name)
  }
  emit('update:modelValue', {
    ...props.modelValue,
    ErrorTrigger: triggers
  })
}

function toggleAccessLog(name, checked) {
  let logs = [...(props.modelValue?.AccessLogLists || [])]
  if (checked) {
    logs.push(name)
  } else {
    logs = logs.filter(n => n !== name)
  }
  emit('update:modelValue', {
    ...props.modelValue,
    AccessLogLists: logs
  })
}
</script>
