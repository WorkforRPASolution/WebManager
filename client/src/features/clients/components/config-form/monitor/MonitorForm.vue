<template>
  <div class="space-y-6">
    <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200">
      모니터 설정 (Monitor)
    </h3>

    <!-- Description Info Box -->
    <div v-if="descriptionText" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
      <p class="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">{{ descriptionText }}</p>
    </div>

    <!-- 전체 활성화/비활성화 버튼 -->
    <div v-if="!readOnly" class="flex gap-2">
      <button
        type="button"
        class="px-3 py-1.5 text-xs font-medium rounded-lg border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition"
        @click="enableAll"
      >
        전체 활성화
      </button>
      <button
        type="button"
        class="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
        @click="disableAll"
      >
        전체 비활성화
      </button>
    </div>

    <!-- Collector Groups -->
    <div
      v-for="group in COLLECTOR_GROUPS"
      :key="group.name"
      class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden"
    >
      <!-- Group Header -->
      <div
        class="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border cursor-pointer select-none"
        @click="toggleGroup(group.name)"
      >
        <svg
          class="w-4 h-4 text-gray-400 transition-transform"
          :class="{ 'rotate-90': expandedGroups.has(group.name) }"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ group.name }}</h4>
        <span class="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {{ countActiveInGroup(group) }}/{{ group.collectors.length }}
        </span>
      </div>

      <!-- Group Content -->
      <div v-if="expandedGroups.has(group.name)" class="p-4 space-y-3">
        <div
          v-for="collectorName in group.collectors"
          :key="collectorName"
          class="border border-gray-200 dark:border-dark-border rounded-lg"
        >
          <!-- Collector Header: Enabled + Name + Interval -->
          <div class="flex items-center gap-3 px-3 py-2">
            <input
              type="checkbox"
              :checked="formData[collectorName]?.Enabled"
              @change="updateCollectorField(collectorName, 'Enabled', $event.target.checked)"
              :disabled="readOnly"
              class="w-4 h-4 rounded border-gray-300 dark:border-dark-border text-primary-500 focus:ring-primary-500 dark:bg-dark-bg"
            />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px]">{{ collectorName }}</span>
            <div class="flex items-center gap-2 ml-auto">
              <label class="text-xs text-gray-500 dark:text-gray-400">주기:</label>
              <input
                type="text"
                :value="formData[collectorName]?.Interval"
                @input="updateCollectorField(collectorName, 'Interval', $event.target.value)"
                :disabled="readOnly || !formData[collectorName]?.Enabled"
                class="form-input w-24 text-center"
                :class="{ 'opacity-60 cursor-not-allowed': !formData[collectorName]?.Enabled }"
                placeholder="30s"
              />
            </div>
          </div>

          <!-- Collector Special Fields (only when Enabled) -->
          <div
            v-if="formData[collectorName]?.Enabled && hasSpecialFields(collectorName)"
            class="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-dark-border space-y-3"
          >
            <div
              v-for="(fieldDef, fieldName) in COLLECTOR_SPECIAL_FIELDS[collectorName]"
              :key="fieldName"
            >
              <!-- Number field (TopN) -->
              <FormField v-if="fieldDef.type === 'number'" :label="fieldDef.label">
                <input
                  type="number"
                  :value="formData[collectorName]?.[fieldName]"
                  @input="updateCollectorField(collectorName, fieldName, $event.target.value)"
                  :disabled="readOnly"
                  class="form-input w-24"
                  min="1"
                />
              </FormField>

              <!-- Array field (tags) -->
              <FormField v-else-if="fieldDef.type === 'array'" :label="fieldDef.label">
                <FormTagInput
                  :modelValue="formData[collectorName]?.[fieldName] || []"
                  @update:modelValue="updateCollectorField(collectorName, fieldName, $event)"
                  :readOnly="readOnly"
                  :placeholder="`${fieldDef.label} 추가 (Enter)`"
                />
              </FormField>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import {
  COLLECTOR_NAMES,
  COLLECTOR_GROUPS,
  COLLECTOR_SPECIAL_FIELDS,
  parseMonitorInput,
  buildMonitorOutput
} from './schema'
import { describeMonitor } from './description'
import FormField from '../shared/components/FormField.vue'
import FormTagInput from '../shared/components/FormTagInput.vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  readOnly: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const formData = ref({})
let isInternalUpdate = false

// 모든 그룹 기본 펼침
const expandedGroups = ref(new Set(COLLECTOR_GROUPS.map(g => g.name)))

watch(() => props.modelValue, (newVal) => {
  if (isInternalUpdate) return
  formData.value = parseMonitorInput(newVal || {})
}, { immediate: true, deep: true })

const descriptionText = computed(() => describeMonitor(props.modelValue))

function emitChange() {
  isInternalUpdate = true
  const output = buildMonitorOutput(formData.value)
  emit('update:modelValue', output)
  nextTick(() => { isInternalUpdate = false })
}

function updateCollectorField(collectorName, field, value) {
  if (!formData.value[collectorName]) return
  if (field === 'Enabled') {
    formData.value[collectorName].Enabled = Boolean(value)
  } else if (field === 'TopN' || COLLECTOR_SPECIAL_FIELDS[collectorName]?.[field]?.type === 'number') {
    formData.value[collectorName][field] = value === '' ? '' : value
  } else {
    formData.value[collectorName][field] = value
  }
  emitChange()
}

function hasSpecialFields(collectorName) {
  return !!COLLECTOR_SPECIAL_FIELDS[collectorName]
}

function countActiveInGroup(group) {
  return group.collectors.filter(name => formData.value[name]?.Enabled).length
}

function toggleGroup(groupName) {
  const next = new Set(expandedGroups.value)
  if (next.has(groupName)) {
    next.delete(groupName)
  } else {
    next.add(groupName)
  }
  expandedGroups.value = next
}

function enableAll() {
  for (const name of COLLECTOR_NAMES) {
    if (formData.value[name]) {
      formData.value[name].Enabled = true
    }
  }
  emitChange()
}

function disableAll() {
  for (const name of COLLECTOR_NAMES) {
    if (formData.value[name]) {
      formData.value[name].Enabled = false
    }
  }
  emitChange()
}
</script>

<style scoped>
@import '../shared/form-input.css';
</style>
