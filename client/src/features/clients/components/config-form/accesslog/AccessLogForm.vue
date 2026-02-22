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
    <div
      v-for="(source, idx) in sources" :key="idx"
      class="border rounded-lg overflow-hidden transition-colors"
      :class="draggingIdx === idx ? 'opacity-50 border-gray-300 dark:border-dark-border' : dragOverIdx === idx && draggingIdx >= 0 && draggingIdx !== idx ? 'border-primary-400 dark:border-primary-500 bg-primary-50/30 dark:bg-primary-900/10' : 'border-gray-200 dark:border-dark-border'"
      @dragover.prevent="draggingIdx >= 0 && (dragOverIdx = idx)"
      @drop="onDrop(idx)"
    >
      <!-- Card Header -->
      <div
        class="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-dark-bg cursor-pointer select-none"
        @click="toggleExpand(idx)"
      >
        <div class="flex items-center gap-2">
          <span
            v-if="!readOnly"
            draggable="true"
            class="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500"
            @dragstart="onDragStart(idx, $event)"
            @dragend="onDragEnd"
            @click.stop
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
              <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
              <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
            </svg>
          </span>
          <svg class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-90': expanded[idx] }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span class="px-2 py-0.5 text-xs font-medium rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            {{ source.name || '(이름 없음)' }}
          </span>
          <span v-if="source.purpose === 'upload'" class="px-1.5 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Upload</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ source.directory || '' }}</span>
        </div>
        <div v-if="!readOnly" class="flex items-center gap-0.5">
          <button
            type="button"
            class="p-1 transition-colors"
            :class="idx === 0 ? 'text-gray-200 dark:text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-primary-500'"
            title="위로 이동"
            :disabled="idx === 0"
            @click.stop="moveSource(idx, -1)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            class="p-1 transition-colors"
            :class="idx === sources.length - 1 ? 'text-gray-200 dark:text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-primary-500'"
            title="아래로 이동"
            :disabled="idx === sources.length - 1"
            @click.stop="moveSource(idx, 1)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
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
      </div>

      <!-- Card Body -->
      <div v-show="expanded[idx]" class="px-4 py-4 space-y-4 border-t border-gray-200 dark:border-dark-border">
        <!-- Description -->
        <div v-if="describeAccessLog(source)" class="mb-4 px-3 py-2.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg whitespace-pre-line">
          {{ describeAccessLog(source) }}
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
              <option v-for="opt in getLineAxisOptions(source)" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </FormField>
          <FormField label="후처리" description="로그 전달 전 추가 처리입니다.">
            <select :value="getAxis(source, 'postProc')" @change="updateAxis(idx, 'postProc', $event.target.value)" :disabled="readOnly" class="form-input">
              <option v-for="opt in getPostProcOptions(source)" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </FormField>
        </div>
        <!-- Log type badge -->
        <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
          합성 결과: <span class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">{{ source.log_type || 'normal_single' }}</span>
        </div>

        <!-- Date Subdir Format (required when date axis is date/date_prefix) -->
        <div v-if="getAxis(source, 'dateAxis') !== 'normal'" class="grid grid-cols-2 gap-3">
          <FormField :schema="schema.fields.date_subdir_format">
            <input type="text" :value="source.date_subdir_format" @input="updateField(idx, 'date_subdir_format', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.date_subdir_format.placeholder" class="form-input" />
          </FormField>
        </div>

        <!-- Charset + Timing -->
        <div class="grid grid-cols-3 gap-3">
          <FormField :schema="schema.fields.charset">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <label class="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                  <input type="checkbox" :checked="!source._omit_charset" @change="handleCharsetToggle(idx, $event.target.checked)" :disabled="readOnly" class="rounded" />
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
              <input type="checkbox" :checked="!source._omit_back" @change="handleBoolToggle(idx, 'back', $event.target.checked)" :disabled="readOnly" class="rounded" />
            </label>
            <FormCheckbox :schema="schema.fields.back" :checked="source.back" @change="updateField(idx, 'back', $event)" :disabled="readOnly || source._omit_back" />
          </div>
          <div class="flex items-center gap-2">
            <label class="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" :checked="!source._omit_end" @change="handleBoolToggle(idx, 'end', $event.target.checked)" :disabled="readOnly" class="rounded" />
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

        <!-- Log Time Filter (teal, optional) -->
        <div v-if="!source._omit_log_time" class="border border-teal-200 dark:border-teal-800/50 rounded-lg bg-teal-50/30 dark:bg-teal-900/10 p-3 space-y-3">
          <div class="flex items-center justify-between">
            <h5 class="text-xs font-semibold text-teal-700 dark:text-teal-400">로그 시간 필터</h5>
            <button v-if="!readOnly" type="button" class="text-xs text-gray-400 hover:text-red-500 transition" @click="removeLogTime(idx)">삭제</button>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <FormField :schema="schema.fields.log_time_pattern">
              <input type="text" :value="source.log_time_pattern" @input="updateField(idx, 'log_time_pattern', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.log_time_pattern.placeholder" class="form-input" />
            </FormField>
            <FormField :schema="schema.fields.log_time_format">
              <input type="text" :value="source.log_time_format" @input="updateField(idx, 'log_time_format', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.log_time_format.placeholder" class="form-input" />
            </FormField>
          </div>
        </div>
        <button
          v-else-if="!readOnly"
          type="button"
          class="w-full py-2 border-2 border-dashed border-teal-200 dark:border-teal-800/50 rounded-lg text-xs text-teal-500 dark:text-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-900/10 transition"
          @click="addLogTime(idx)"
        >
          + 로그 시간 필터 추가 (선택)
        </button>

        <!-- Line Group (indigo, optional, trigger only) -->
        <template v-if="source.purpose !== 'upload'">
          <div v-if="!source._omit_line_group" class="border border-indigo-200 dark:border-indigo-800/50 rounded-lg bg-indigo-50/30 dark:bg-indigo-900/10 p-3 space-y-3">
            <div class="flex items-center justify-between">
              <h5 class="text-xs font-semibold text-indigo-700 dark:text-indigo-400">라인 그룹핑</h5>
              <button v-if="!readOnly" type="button" class="text-xs text-gray-400 hover:text-red-500 transition" @click="removeLineGroup(idx)">삭제</button>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <FormField :schema="schema.fields.line_group_count">
                <input type="number" :value="source.line_group_count" @input="updateField(idx, 'line_group_count', $event.target.value ? Number($event.target.value) : null)" :disabled="readOnly" :placeholder="schema.fields.line_group_count.placeholder" class="form-input" />
              </FormField>
              <FormField :schema="schema.fields.line_group_pattern">
                <input type="text" :value="source.line_group_pattern" @input="updateField(idx, 'line_group_pattern', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.line_group_pattern.placeholder" class="form-input" />
              </FormField>
            </div>
          </div>
          <button
            v-else-if="!readOnly"
            type="button"
            class="w-full py-2 border-2 border-dashed border-indigo-200 dark:border-indigo-800/50 rounded-lg text-xs text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition"
            @click="addLineGroup(idx)"
          >
            + 라인 그룹핑 추가 (선택)
          </button>
        </template>

        <!-- Multiline Settings (conditional) -->
        <div v-if="getAxis(source, 'lineAxis') === 'multiline'" class="border border-purple-200 dark:border-purple-800/50 rounded-lg bg-purple-50/30 dark:bg-purple-900/10 p-3 space-y-3">
          <h5 class="text-xs font-semibold text-purple-700 dark:text-purple-400">멀티라인 설정</h5>
          <div class="grid grid-cols-2 gap-3">
            <FormField :schema="schema.fields.start_pattern">
              <input type="text" :value="source.start_pattern" @input="updateField(idx, 'start_pattern', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.start_pattern.placeholder" class="form-input" />
            </FormField>
            <FormField :schema="schema.fields.end_pattern">
              <input type="text" :value="source.end_pattern" @input="updateField(idx, 'end_pattern', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.end_pattern.placeholder" class="form-input" />
            </FormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <FormField :schema="schema.fields.line_count">
              <input type="number" :value="source.line_count" @input="updateField(idx, 'line_count', $event.target.value ? Number($event.target.value) : null)" :disabled="readOnly" :placeholder="schema.fields.line_count.placeholder" class="form-input" />
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
          <FormField :schema="schema.fields.pathPattern">
            <input type="text" :value="source.pathPattern" @input="updateField(idx, 'pathPattern', $event.target.value)" :disabled="readOnly" :placeholder="schema.fields.pathPattern.placeholder" class="form-input" />
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
import { computed, reactive, ref } from 'vue'
import {
  ACCESS_LOG_SCHEMA,
  createDefaultAccessLog,
  decomposeLogType,
  composeLogType,
  parseSourceName,
  formatSourceName,
  parseAccessLogInput,
  DATE_AXIS_OPTIONS,
  LINE_AXIS_OPTIONS,
  POST_PROC_OPTIONS,
  buildAccessLogOutput
} from './schema'
import { describeAccessLog } from './description'
import FormTagInput from '../shared/components/FormTagInput.vue'
import FormField from '../shared/components/FormField.vue'
import FormCheckbox from '../shared/components/FormCheckbox.vue'
import AccessLogTestPanel from './AccessLogTestPanel.vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  readOnly: { type: Boolean, default: false },
  eqpId: { type: String, default: '' },
  agentGroup: { type: String, default: '' },
  agentVersion: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const schema = ACCESS_LOG_SCHEMA
const expanded = reactive({})
const draggingIdx = ref(-1)
const dragOverIdx = ref(-1)

const dateAxisOptions = DATE_AXIS_OPTIONS

function getLineAxisOptions(source) {
  const dateAxis = getAxis(source, 'dateAxis')
  if (dateAxis === 'date_prefix' || dateAxis === 'date_suffix')
    return LINE_AXIS_OPTIONS.filter(o => o.value === 'single')
  return LINE_AXIS_OPTIONS
}

function getPostProcOptions(source) {
  const lineAxis = getAxis(source, 'lineAxis')
  if (lineAxis === 'multiline')
    return POST_PROC_OPTIONS.filter(o => o.value === 'none')
  return POST_PROC_OPTIONS
}

// Object -> Array conversion with schema parsing
const sources = computed(() => {
  return Object.entries(props.modelValue || {}).map(([name, config]) => parseAccessLogInput(name, config))
})

function toggleExpand(idx) {
  expanded[idx] = !expanded[idx]
}

function getAxis(source, axis) {
  const axes = decomposeLogType(source.log_type)
  return axes[axis]
}

function updateAxis(idx, axis, value) {
  const source = sources.value[idx]
  const current = decomposeLogType(source.log_type)
  current[axis] = value

  // 불가능한 조합 자동 보정
  if ((current.dateAxis === 'date_prefix' || current.dateAxis === 'date_suffix') && current.lineAxis === 'multiline')
    current.lineAxis = 'single'
  if (current.lineAxis === 'multiline' && current.postProc === 'extract_append')
    current.postProc = 'none'

  const newLogType = composeLogType(current, { version: props.agentVersion })
  // When switching to/from date modes, auto-manage _omit_date_subdir_format
  if (axis === 'dateAxis') {
    const updated = sources.value.map((s, i) => i === idx
      ? { ...s, log_type: newLogType, _omit_date_subdir_format: value === 'normal' }
      : { ...s })
    emitUpdate(updated)
  } else {
    updateField(idx, 'log_type', newLogType)
  }
}

function handlePurposeChange(idx, newPurpose) {
  const source = sources.value[idx]
  const newName = formatSourceName(source.baseName || 'LogReadInfo', newPurpose)
  const updated = sources.value.map((s, i) => i === idx ? { ...s, purpose: newPurpose, name: newName } : { ...s })
  emitUpdate(updated)
}

function handleCharsetToggle(idx, checked) {
  // checked = true means user wants to enable charset
  const omit = !checked
  const source = sources.value[idx]
  const updates = { _omit_charset: omit }
  // When enabling and no charset value is set, default to UTF-8
  if (!omit && !source.charset) {
    updates.charset = 'UTF-8'
  }
  const updated = sources.value.map((s, i) => i === idx ? { ...s, ...updates } : { ...s })
  emitUpdate(updated)
}

function addLogTime(idx) {
  const updated = sources.value.map((s, i) => i === idx ? { ...s, _omit_log_time: false, log_time_pattern: '', log_time_format: '' } : { ...s })
  emitUpdate(updated)
}

function removeLogTime(idx) {
  const updated = sources.value.map((s, i) => i === idx ? { ...s, _omit_log_time: true, log_time_pattern: '', log_time_format: '' } : { ...s })
  emitUpdate(updated)
}

function addLineGroup(idx) {
  const updated = sources.value.map((s, i) => i === idx ? { ...s, _omit_line_group: false, line_group_count: 1, line_group_pattern: '' } : { ...s })
  emitUpdate(updated)
}

function removeLineGroup(idx) {
  const updated = sources.value.map((s, i) => i === idx ? { ...s, _omit_line_group: true, line_group_count: null, line_group_pattern: '' } : { ...s })
  emitUpdate(updated)
}

function handleBoolToggle(idx, field, checked) {
  const omit = !checked
  const source = sources.value[idx]
  const updates = { [`_omit_${field}`]: omit }
  // When enabling and value is null/undefined, default to false
  if (!omit && (source[field] === null || source[field] === undefined)) {
    updates[field] = false
  }
  const updated = sources.value.map((s, i) => i === idx ? { ...s, ...updates } : { ...s })
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
    const { name, baseName, purpose, _omit_charset, _omit_back, _omit_end, _omit_date_subdir_format, _omit_log_time, _omit_line_group, _customCharset, _originalLogType, ...rest } = source
    // Build clean output using buildAccessLogOutput
    const output = buildAccessLogOutput({ ...rest, name: key, _omit_charset, _omit_back, _omit_end, _omit_date_subdir_format, _omit_log_time, _omit_line_group, _originalLogType }, { version: props.agentVersion })
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
    _omit_date_subdir_format: true,
    _omit_log_time: true,
    _omit_line_group: true
  }
  const updated = [...sources.value.map(s => ({ ...s })), newSource]
  expanded[updated.length - 1] = true
  emitUpdate(updated)
}

function moveSource(idx, direction) {
  const newIdx = idx + direction
  if (newIdx < 0 || newIdx >= sources.value.length) return
  const updated = sources.value.map(s => ({ ...s }))
  const temp = updated[idx]
  updated[idx] = updated[newIdx]
  updated[newIdx] = temp
  const tempExp = expanded[idx]
  expanded[idx] = expanded[newIdx]
  expanded[newIdx] = tempExp
  emitUpdate(updated)
}

function onDragStart(idx, event) {
  draggingIdx.value = idx
  event.dataTransfer.effectAllowed = 'move'
}

function onDrop(targetIdx) {
  const fromIdx = draggingIdx.value
  dragOverIdx.value = -1
  draggingIdx.value = -1
  if (fromIdx < 0 || fromIdx === targetIdx) return
  const updated = sources.value.map(s => ({ ...s }))
  const oldExp = {}
  for (let i = 0; i < updated.length; i++) oldExp[i] = !!expanded[i]
  const [item] = updated.splice(fromIdx, 1)
  updated.splice(targetIdx, 0, item)
  const indices = sources.value.map((_, i) => i)
  const [movedOrig] = indices.splice(fromIdx, 1)
  indices.splice(targetIdx, 0, movedOrig)
  for (let i = 0; i < indices.length; i++) expanded[i] = oldExp[indices[i]]
  emitUpdate(updated)
}

function onDragEnd() {
  draggingIdx.value = -1
  dragOverIdx.value = -1
}

function removeSource(idx) {
  const updated = sources.value.filter((_, i) => i !== idx)
  emitUpdate(updated)
}

</script>

<style scoped>
@import '../shared/form-input.css';
</style>
