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
          <span v-if="source.purpose === 'upload'" class="px-1.5 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Upload</span>
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
          {{ describeSource(source) }}
        </div>

        <!-- Purpose + Source Name -->
        <div class="grid grid-cols-3 gap-3">
          <FormField :schema="schema.fields.purpose">
            <select :value="source.purpose || 'trigger'" @change="handlePurposeChange(idx, $event.target.value)" :disabled="readOnly" class="form-input">
              <option v-for="opt in schema.fields.purpose.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </FormField>
          <div class="col-span-2">
            <FormField :schema="schema.fields.directory" label="소스 이름" description="고유 식별자입니다. 트리거에서 이 이름으로 참조합니다.">
              <div class="flex items-center gap-1">
                <span v-if="source.purpose !== 'upload'" class="text-xs text-gray-400 font-mono">__</span>
                <input type="text" :value="source.baseName || ''" @input="updateBaseName(idx, $event.target.value)" :disabled="readOnly" placeholder="LogReadInfo" class="form-input" />
                <span v-if="source.purpose !== 'upload'" class="text-xs text-gray-400 font-mono">__</span>
              </div>
            </FormField>
          </div>
        </div>

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

        <!-- 3-Axis Log Type Selection -->
        <div class="grid grid-cols-3 gap-3">
          <FormField label="날짜 모드" description="로그 파일의 날짜 기반 구성 방식입니다.">
            <select :value="getAxis(source, 'dateAxis')" @change="updateAxis(idx, 'dateAxis', $event.target.value)" :disabled="readOnly" class="form-input">
              <option v-for="opt in dateAxisOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </FormField>
          <FormField label="라인 모드" description="로그 라인 처리 방식입니다.">
            <select :value="getAxis(source, 'lineAxis')" @change="updateAxis(idx, 'lineAxis', $event.target.value)" :disabled="readOnly" class="form-input">
              <option v-for="opt in lineAxisOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </FormField>
          <FormField label="후처리" description="로그 전달 전 추가 처리입니다.">
            <select :value="getAxis(source, 'postProc')" @change="updateAxis(idx, 'postProc', $event.target.value)" :disabled="readOnly" class="form-input">
              <option v-for="opt in postProcOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </FormField>
        </div>
        <!-- Log type badge -->
        <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
          합성 결과: <span class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">{{ source.log_type || 'normal_single' }}</span>
        </div>

        <!-- Date Subdir Format (conditional) -->
        <div v-if="getAxis(source, 'dateAxis') !== 'normal'" class="grid grid-cols-2 gap-3">
          <FormField :schema="schema.fields.date_subdir_format">
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                <input type="checkbox" :checked="!source._omit_date_subdir_format" @change="updateField(idx, '_omit_date_subdir_format', !$event.target.checked)" :disabled="readOnly" class="rounded" />
                설정
              </label>
              <input type="text" :value="source.date_subdir_format" @input="updateField(idx, 'date_subdir_format', $event.target.value)" :disabled="readOnly || source._omit_date_subdir_format" :placeholder="schema.fields.date_subdir_format.placeholder" class="form-input" :class="{ 'opacity-40': source._omit_date_subdir_format }" />
            </div>
          </FormField>
        </div>

        <!-- Charset + Timing -->
        <div class="grid grid-cols-3 gap-3">
          <FormField :schema="schema.fields.charset">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <label class="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                  <input type="checkbox" :checked="!source._omit_charset" @change="updateField(idx, '_omit_charset', !$event.target.checked)" :disabled="readOnly" class="rounded" />
                  설정
                </label>
                <select :value="source.charset" @change="updateField(idx, 'charset', $event.target.value)" :disabled="readOnly || source._omit_charset" class="form-input" :class="{ 'opacity-40': source._omit_charset }">
                  <option v-for="opt in schema.fields.charset.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <input v-if="source.charset === '__custom__' && !source._omit_charset" type="text" :value="source._customCharset || ''" @input="updateField(idx, '_customCharset', $event.target.value)" :disabled="readOnly" placeholder="직접 입력 (예: Shift_JIS)" class="form-input text-xs" />
            </div>
          </FormField>
          <FormField :schema="schema.fields.access_interval">
            <input type="text" :value="source.access_interval" @input="updateField(idx, 'access_interval', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.access_interval.placeholder" class="form-input" />
          </FormField>
          <FormField :schema="schema.fields.batch_timeout" v-if="source.purpose === 'upload'">
            <input type="text" :value="source.batch_timeout" @input="updateField(idx, 'batch_timeout', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.batch_timeout.placeholder" class="form-input" />
          </FormField>
        </div>

        <!-- Batch Count (upload only) -->
        <div v-if="source.purpose === 'upload'" class="grid grid-cols-3 gap-3">
          <FormField :schema="schema.fields.batch_count">
            <input type="number" :value="source.batch_count" @input="updateField(idx, 'batch_count', Number($event.target.value))" :disabled="readOnly" :placeholder="schema.fields.batch_count.placeholder" class="form-input" />
          </FormField>
        </div>

        <!-- Boolean Toggles -->
        <div class="flex items-center gap-6 flex-wrap">
          <FormCheckbox :schema="schema.fields.reopen" :checked="source.reopen" @change="updateField(idx, 'reopen', $event)" :disabled="readOnly" />
          <div class="flex items-center gap-2">
            <label class="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" :checked="!source._omit_back" @change="updateField(idx, '_omit_back', !$event.target.checked)" :disabled="readOnly" class="rounded" />
            </label>
            <FormCheckbox :schema="schema.fields.back" :checked="source.back" @change="updateField(idx, 'back', $event)" :disabled="readOnly || source._omit_back" />
          </div>
          <div class="flex items-center gap-2">
            <label class="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" :checked="!source._omit_end" @change="updateField(idx, '_omit_end', !$event.target.checked)" :disabled="readOnly" class="rounded" />
            </label>
            <FormCheckbox :schema="schema.fields.end" :checked="source.end" @change="updateField(idx, 'end', $event)" :disabled="readOnly || source._omit_end" />
          </div>
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

        <!-- Multiline Settings (conditional) -->
        <div v-if="getAxis(source, 'lineAxis') === 'multiline'" class="border border-purple-200 dark:border-purple-800/50 rounded-lg bg-purple-50/30 dark:bg-purple-900/10 p-3 space-y-3">
          <h5 class="text-xs font-semibold text-purple-700 dark:text-purple-400">멀티라인 설정</h5>
          <div class="grid grid-cols-2 gap-3">
            <FormField :schema="schema.fields.startPattern">
              <input type="text" :value="source.startPattern" @input="updateField(idx, 'startPattern', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.startPattern.placeholder" class="form-input" />
            </FormField>
            <FormField :schema="schema.fields.endPattern">
              <input type="text" :value="source.endPattern" @input="updateField(idx, 'endPattern', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.endPattern.placeholder" class="form-input" />
            </FormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <FormField :schema="schema.fields.count">
              <input type="number" :value="source.count" @input="updateField(idx, 'count', $event.target.value ? Number($event.target.value) : null)" :disabled="readOnly" :placeholder="schema.fields.count.placeholder" class="form-input" />
            </FormField>
            <FormField :schema="schema.fields.priority">
              <select :value="source.priority" @change="updateField(idx, 'priority', $event.target.value)" :disabled="readOnly" class="form-input">
                <option v-for="opt in schema.fields.priority.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </FormField>
          </div>
        </div>

        <!-- Extract-Append Settings (conditional) -->
        <div v-if="getAxis(source, 'postProc') === 'extract_append'" class="border border-orange-200 dark:border-orange-800/50 rounded-lg bg-orange-50/30 dark:bg-orange-900/10 p-3 space-y-3">
          <h5 class="text-xs font-semibold text-orange-700 dark:text-orange-400">추출-삽입 설정</h5>
          <FormField :schema="schema.fields.extractPattern">
            <input type="text" :value="source.extractPattern" @input="updateField(idx, 'extractPattern', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.extractPattern.placeholder" class="form-input" />
          </FormField>
          <div class="grid grid-cols-2 gap-3">
            <FormField :schema="schema.fields.appendPos">
              <input type="number" :value="source.appendPos" @input="updateField(idx, 'appendPos', Number($event.target.value))" :disabled="readOnly" :placeholder="schema.fields.appendPos.placeholder" class="form-input" />
            </FormField>
            <FormField :schema="schema.fields.appendFormat">
              <input type="text" :value="source.appendFormat" @input="updateField(idx, 'appendFormat', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.appendFormat.placeholder" class="form-input" />
            </FormField>
          </div>
        </div>
      </div>

      <!-- Test Panel -->
      <AccessLogTestPanel v-if="expanded[idx]" :source="source" :eqpId="eqpId" :agentGroup="agentGroup" />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import {
  ACCESS_LOG_SCHEMA,
  createDefaultAccessLog,
  decomposeLogType,
  composeLogType,
  parseSourceName,
  formatSourceName,
  DATE_AXIS_OPTIONS,
  LINE_AXIS_OPTIONS,
  POST_PROC_OPTIONS,
  buildAccessLogOutput
} from './configSchemas'
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

const dateAxisOptions = DATE_AXIS_OPTIONS
const lineAxisOptions = LINE_AXIS_OPTIONS
const postProcOptions = POST_PROC_OPTIONS

// Object -> Array conversion with schema parsing
const sources = computed(() => {
  return Object.entries(props.modelValue || {}).map(([name, config]) => {
    const { baseName, purpose } = parseSourceName(name)
    const axes = decomposeLogType(config.log_type)
    return {
      name,
      baseName,
      purpose,
      ...ACCESS_LOG_SCHEMA.defaults,
      ...config,
      _omit_charset: !config.charset,
      _omit_back: config.back === undefined || config.back === null,
      _omit_end: config.end === undefined || config.end === null,
      _omit_date_subdir_format: config.date_subdir_format === undefined
    }
  })
})

function toggleExpand(idx) {
  expanded[idx] = !expanded[idx]
}

function describeSource(source) {
  return describeAccessLog(source)
}

function getAxis(source, axis) {
  const axes = decomposeLogType(source.log_type)
  return axes[axis]
}

function updateAxis(idx, axis, value) {
  const source = sources.value[idx]
  const current = decomposeLogType(source.log_type)
  current[axis] = value
  const newLogType = composeLogType(current)
  updateField(idx, 'log_type', newLogType)
}

function handlePurposeChange(idx, newPurpose) {
  const source = sources.value[idx]
  const newName = formatSourceName(source.baseName || 'LogReadInfo', newPurpose)
  const updated = sources.value.map((s, i) => i === idx ? { ...s, purpose: newPurpose, name: newName } : { ...s })
  emitUpdate(updated)
}

function updateBaseName(idx, newBaseName) {
  const source = sources.value[idx]
  const newName = formatSourceName(newBaseName, source.purpose || 'trigger')
  const updated = sources.value.map((s, i) => i === idx ? { ...s, baseName: newBaseName, name: newName } : { ...s })
  emitUpdate(updated)
}

function emitUpdate(newSources) {
  const obj = {}
  for (const source of newSources) {
    const key = source.name || '(unnamed)'
    const { name, baseName, purpose, _omit_charset, _omit_back, _omit_end, _omit_date_subdir_format, _customCharset, ...rest } = source
    // Build clean output using buildAccessLogOutput
    const output = buildAccessLogOutput({ ...rest, name: key, _omit_charset, _omit_back, _omit_end, _omit_date_subdir_format })
    // If charset is __custom__, use the custom value
    if (rest.charset === '__custom__' && _customCharset && !_omit_charset) {
      output.charset = _customCharset
    }
    obj[key] = output
  }
  emit('update:modelValue', obj)
}

function updateField(idx, field, value) {
  const updated = sources.value.map((s, i) => i === idx ? { ...s, [field]: value } : { ...s })
  emitUpdate(updated)
}

function addSource() {
  const newSource = {
    ...createDefaultAccessLog(sources.value.length),
    baseName: `LogReadInfo${sources.value.length > 0 ? '_' + (sources.value.length + 1) : ''}`,
    purpose: 'trigger',
    _omit_charset: true,
    _omit_back: true,
    _omit_end: true,
    _omit_date_subdir_format: true
  }
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
