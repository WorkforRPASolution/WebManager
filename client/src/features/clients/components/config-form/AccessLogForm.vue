<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200">
        로그 소스 관리
      </h3>
      <button
        v-if="!readOnly"
        type="button"
        class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition"
        @click="addSource"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        소스 추가
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="sources.length === 0" class="text-center py-12 text-gray-400 dark:text-gray-500">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
      <p class="text-sm">등록된 로그 소스가 없습니다. 소스를 추가해주세요.</p>
    </div>

    <!-- Source Cards -->
    <div v-for="(source, idx) in sources" :key="idx" class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
      <!-- Card Header -->
      <div
        class="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-dark-bg cursor-pointer select-none"
        @click="toggleExpand(idx)"
      >
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-90': expanded[idx] }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span class="px-2 py-0.5 text-xs font-medium rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            {{ source.name || '(이름 없음)' }}
          </span>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ source.directory || '' }}</span>
        </div>
        <button
          v-if="!readOnly"
          type="button"
          class="p-1 text-gray-400 hover:text-red-500 transition-colors"
          title="소스 삭제"
          @click.stop="removeSource(idx)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <!-- Card Body -->
      <div v-show="expanded[idx]" class="px-4 py-4 space-y-4 border-t border-gray-200 dark:border-dark-border">
        <!-- Description -->
        <div v-if="describeSource(source)" class="mb-4 px-3 py-2.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg whitespace-pre-line">
          📋 {{ describeSource(source) }}
        </div>

        <!-- Source Name -->
        <FormField :schema="schema.fields.directory" label="소스 이름" description="고유 식별자입니다. 트리거에서 이 이름으로 참조합니다. 예: __LogReadInfo__">
          <input type="text" :value="source.name" @input="updateField(idx, 'name', $event.target.value)" :disabled="readOnly" :placeholder="'__LogReadInfo__'" class="form-input" />
        </FormField>

        <!-- Directory -->
        <FormField :schema="schema.fields.directory">
          <input type="text" :value="source.directory" @input="updateField(idx, 'directory', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.directory.placeholder" class="form-input" />
        </FormField>

        <!-- File Pattern Row -->
        <div class="grid grid-cols-3 gap-3">
          <FormField :schema="schema.fields.prefix">
            <input type="text" :value="source.prefix" @input="updateField(idx, 'prefix', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.prefix.placeholder" class="form-input" />
          </FormField>
          <FormField :schema="schema.fields.wildcard">
            <input type="text" :value="source.wildcard" @input="updateField(idx, 'wildcard', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.wildcard.placeholder" class="form-input" />
          </FormField>
          <FormField :schema="schema.fields.suffix">
            <input type="text" :value="source.suffix" @input="updateField(idx, 'suffix', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.suffix.placeholder" class="form-input" />
          </FormField>
        </div>

        <!-- Log Type + Date Format -->
        <div class="grid grid-cols-2 gap-3">
          <FormField :schema="schema.fields.log_type">
            <select :value="source.log_type" @change="updateField(idx, 'log_type', $event.target.value)" :disabled="readOnly" class="form-input">
              <option v-for="opt in schema.fields.log_type.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </FormField>
          <FormField :schema="schema.fields.date_subdir_format">
            <input type="text" :value="source.date_subdir_format" @input="updateField(idx, 'date_subdir_format', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.date_subdir_format.placeholder" class="form-input" />
          </FormField>
        </div>

        <!-- Charset + Timing -->
        <div class="grid grid-cols-3 gap-3">
          <FormField :schema="schema.fields.charset">
            <select :value="source.charset" @change="updateField(idx, 'charset', $event.target.value)" :disabled="readOnly" class="form-input">
              <option v-for="opt in schema.fields.charset.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </FormField>
          <FormField :schema="schema.fields.access_interval">
            <input type="text" :value="source.access_interval" @input="updateField(idx, 'access_interval', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.access_interval.placeholder" class="form-input" />
          </FormField>
          <FormField :schema="schema.fields.batch_timeout">
            <input type="text" :value="source.batch_timeout" @input="updateField(idx, 'batch_timeout', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.batch_timeout.placeholder" class="form-input" />
          </FormField>
        </div>

        <!-- Batch Count -->
        <div class="grid grid-cols-3 gap-3">
          <FormField :schema="schema.fields.batch_count">
            <input type="number" :value="source.batch_count" @input="updateField(idx, 'batch_count', Number($event.target.value))" :disabled="readOnly" :placeholder="schema.fields.batch_count.placeholder" class="form-input" />
          </FormField>
        </div>

        <!-- Boolean Toggles -->
        <div class="flex items-center gap-6">
          <FormCheckbox :schema="schema.fields.reopen" :checked="source.reopen" @change="updateField(idx, 'reopen', $event)" :disabled="readOnly" />
          <FormCheckbox :schema="schema.fields.back" :checked="source.back" @change="updateField(idx, 'back', $event)" :disabled="readOnly" />
          <FormCheckbox :schema="schema.fields.end" :checked="source.end" @change="updateField(idx, 'end', $event)" :disabled="readOnly" />
        </div>

        <!-- Exclude Suffix -->
        <FormField :schema="schema.fields.exclude_suffix">
          <FormTagInput
            :modelValue="source.exclude_suffix || []"
            @update:modelValue="updateField(idx, 'exclude_suffix', $event)"
            :placeholder="schema.fields.exclude_suffix.placeholder"
            :readOnly="readOnly"
          />
        </FormField>
      </div>

      <!-- Test Panel -->
      <AccessLogTestPanel v-if="expanded[idx]" :source="source" :eqpId="eqpId" :agentGroup="agentGroup" />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { ACCESS_LOG_SCHEMA, createDefaultAccessLog } from './configSchemas'
import { describeAccessLog } from './configDescription'
import FormTagInput from './FormTagInput.vue'
import FormField from './FormField.vue'
import FormCheckbox from './FormCheckbox.vue'
import AccessLogTestPanel from './AccessLogTestPanel.vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  readOnly: { type: Boolean, default: false },
  eqpId: { type: String, default: '' },
  agentGroup: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const schema = ACCESS_LOG_SCHEMA
const expanded = reactive({})

// Object → Array 변환
const sources = computed(() => {
  return Object.entries(props.modelValue || {}).map(([name, config]) => ({
    name,
    ...config
  }))
})

function toggleExpand(idx) {
  expanded[idx] = !expanded[idx]
}

function describeSource(source) {
  return describeAccessLog(source)
}

function emitUpdate(newSources) {
  const obj = {}
  for (const source of newSources) {
    const { name, ...rest } = source
    obj[name || '(unnamed)'] = rest
  }
  emit('update:modelValue', obj)
}

function updateField(idx, field, value) {
  const updated = sources.value.map((s, i) => i === idx ? { ...s, [field]: value } : { ...s })
  emitUpdate(updated)
}

function addSource() {
  const newSource = createDefaultAccessLog(sources.value.length)
  const updated = [...sources.value.map(s => ({ ...s })), newSource]
  expanded[updated.length - 1] = true
  emitUpdate(updated)
}

function removeSource(idx) {
  const updated = sources.value.filter((_, i) => i !== idx)
  emitUpdate(updated)
}

</script>

<style scoped>
.form-input {
  @apply w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed;
}
</style>
