<template>
  <div class="space-y-6">
    <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200">
      에이전트 설정 (ARSAgent)
    </h3>

    <!-- Description Info Box -->
    <div v-if="descriptionText" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
      <p class="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">{{ descriptionText }}</p>
    </div>

    <!-- ErrorTrigger + AccessLogLists (2-column) -->
    <div class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">활성 트리거 & 로그 소스</h4>
      </div>
      <div class="grid grid-cols-2 divide-x divide-gray-200 dark:divide-dark-border">
        <!-- ErrorTrigger (Left) -->
        <div class="px-4 py-3">
          <div class="flex items-center gap-2 mb-3">
            <h5 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ schema.sections.ErrorTrigger.label }}</h5>
            <span class="relative group">
              <svg class="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="absolute z-50 hidden group-hover:block top-full left-0 mt-1 w-72 p-2 text-xs font-normal text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg whitespace-normal">
                {{ schema.sections.ErrorTrigger.description }}
              </span>
            </span>
          </div>
          <div v-if="triggerNames.length === 0" class="text-sm text-gray-400 dark:text-gray-500 py-2">
            trigger.json에서 먼저 트리거를 추가해주세요.
          </div>
          <div v-else class="space-y-1">
            <label
              v-for="name in triggerNames"
              :key="name"
              class="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover cursor-pointer select-none transition"
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
        <!-- AccessLogLists (Right) -->
        <div class="px-4 py-3">
          <div class="flex items-center gap-2 mb-3">
            <h5 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ schema.sections.AccessLogLists.label }}</h5>
            <span class="relative group">
              <svg class="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="absolute z-50 hidden group-hover:block top-full left-0 mt-1 w-72 p-2 text-xs font-normal text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg whitespace-normal">
                {{ schema.sections.AccessLogLists.description }}
              </span>
            </span>
          </div>
          <div v-if="accessLogSources.length === 0" class="text-sm text-gray-400 dark:text-gray-500 py-2">
            AccessLog.json에서 먼저 소스를 추가해주세요.
          </div>
          <div v-else class="space-y-1">
            <label
              v-for="name in accessLogSources"
              :key="name"
              class="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover cursor-pointer select-none transition"
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

    <!-- CronTab Section -->
    <div class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
        <div class="flex items-center gap-2">
          <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ schema.sections.CronTab.label }}</h4>
          <span class="relative group">
            <svg class="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="absolute z-50 hidden group-hover:block top-full left-0 mt-1 w-72 p-2 text-xs font-normal text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg whitespace-normal">
              {{ schema.sections.CronTab.description }}
            </span>
          </span>
        </div>
      </div>
      <div class="p-4 space-y-3">
        <div v-if="!formData.CronTab || formData.CronTab.length === 0" class="text-sm text-gray-400 dark:text-gray-500 py-2 text-center">
          등록된 CronTab이 없습니다.
        </div>

        <div
          v-for="(cron, index) in formData.CronTab"
          :key="index"
          class="border border-gray-200 dark:border-dark-border rounded-lg"
        >
          <div
            class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-dark-bg cursor-pointer select-none"
            @click="toggleCronTabExpand(index)"
          >
            <div class="flex items-center gap-2">
              <svg
                class="w-4 h-4 text-gray-400 transition-transform"
                :class="{ 'rotate-90': expandedCronTabs.has(index) }"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ cronTabTitle(cron) }}</span>
            </div>
            <button
              v-if="!readOnly"
              type="button"
              class="p-1 text-gray-400 hover:text-red-500 transition-colors"
              title="삭제"
              @click.stop="removeCronTab(index)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          <div v-if="expandedCronTabs.has(index)" class="p-4 border-t border-gray-200 dark:border-dark-border space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div v-for="(fieldDef, fieldKey) in schema.cronTabFields" :key="fieldKey">
                <FormField :label="fieldDef.label" :description="fieldDef.description" :required="fieldDef.required">
                  <select
                    v-if="fieldDef.type === 'select'"
                    :value="cron[fieldKey]"
                    @change="updateCronTabField(index, fieldKey, $event.target.value)"
                    :disabled="readOnly"
                    class="form-input"
                  >
                    <option v-for="opt in fieldDef.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                  <div v-else-if="fieldDef.type === 'no-email'" class="flex items-center gap-4 py-1.5">
                    <label class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input type="checkbox" :checked="isNoEmailChecked(cron['no-email'], 'success')" @change="toggleCronTabNoEmail(index, 'success')" :disabled="readOnly" class="rounded text-primary-500" />
                      success
                    </label>
                    <label class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input type="checkbox" :checked="isNoEmailChecked(cron['no-email'], 'fail')" @change="toggleCronTabNoEmail(index, 'fail')" :disabled="readOnly" class="rounded text-primary-500" />
                      fail
                    </label>
                    <span v-if="cron['no-email']" class="text-xs text-gray-400 ml-auto">{{ cron['no-email'] }}</span>
                  </div>
                  <input
                    v-else-if="fieldDef.type === 'number'"
                    type="number"
                    :value="cron[fieldKey]"
                    @input="updateCronTabField(index, fieldKey, $event.target.value)"
                    :disabled="readOnly"
                    :placeholder="fieldDef.placeholder || ''"
                    class="form-input"
                  />
                  <input
                    v-else
                    type="text"
                    :value="cron[fieldKey]"
                    @input="updateCronTabField(index, fieldKey, $event.target.value)"
                    :disabled="readOnly"
                    :placeholder="fieldDef.placeholder || ''"
                    class="form-input"
                  />
                </FormField>
              </div>
            </div>

            <!-- Suspend Section (SA type) -->
            <SuspendResumeEditor
              v-if="cron.type === 'SA'"
              mode="suspend"
              :items="cron.suspend || []"
              :triggerNames="suspendableTriggerNames"
              :readOnly="readOnly"
              @add="addCronTabSuspendResumeItem(index, 'suspend')"
              @remove="(idx) => removeCronTabSuspendResumeItem(index, 'suspend', idx)"
              @update="(idx, prop, value) => updateCronTabSuspendResumeItem(index, 'suspend', idx, prop, value)"
            />

            <!-- Resume Section (RA type) -->
            <SuspendResumeEditor
              v-if="cron.type === 'RA'"
              mode="resume"
              :items="cron.resume || []"
              :triggerNames="suspendableTriggerNames"
              :readOnly="readOnly"
              @add="addCronTabSuspendResumeItem(index, 'resume')"
              @remove="(idx) => removeCronTabSuspendResumeItem(index, 'resume', idx)"
              @update="(idx, prop, value) => updateCronTabSuspendResumeItem(index, 'resume', idx, prop, value)"
            />
          </div>
        </div>

        <button
          v-if="!readOnly"
          type="button"
          class="w-full py-2 border-2 border-dashed border-gray-300 dark:border-dark-border rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-hover hover:border-primary-300 dark:hover:border-primary-700 transition"
          @click="addCronTab"
        >
          + CronTab 추가
        </button>
      </div>
    </div>

    <!-- Agent Settings Groups (required fields, groups 1-8) -->
    <div
      v-for="group in requiredGroups"
      :key="group.name"
      class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden"
    >
      <div class="px-4 py-3 bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ group.name }}</h4>
      </div>
      <div class="p-4 grid grid-cols-2 gap-4">
        <div v-for="fieldName in group.fields" :key="fieldName">
          <FormField :schema="schema.fields[fieldName]">
            <label v-if="schema.fields[fieldName].type === 'boolean'" class="flex items-center gap-2">
              <input
                type="checkbox"
                :checked="formData[fieldName]"
                @change="updateField(fieldName, $event.target.checked)"
                :disabled="readOnly"
                class="w-4 h-4 rounded border-gray-300 dark:border-dark-border text-primary-500 focus:ring-primary-500 dark:bg-dark-bg"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ formData[fieldName] ? '사용' : '미사용' }}</span>
            </label>

            <select
              v-else-if="schema.fields[fieldName].type === 'select'"
              :value="formData[fieldName]"
              @change="updateField(fieldName, $event.target.value)"
              :disabled="readOnly"
              class="form-input"
            >
              <option v-for="opt in schema.fields[fieldName].options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>

            <input
              v-else-if="schema.fields[fieldName].type === 'number'"
              type="number"
              :value="formData[fieldName]"
              @input="updateField(fieldName, $event.target.value)"
              :disabled="readOnly"
              class="form-input"
            />

            <input
              v-else
              type="text"
              :value="formData[fieldName]"
              @input="updateField(fieldName, $event.target.value)"
              :disabled="readOnly"
              :placeholder="schema.fields[fieldName].placeholder || schema.fields[fieldName].default || ''"
              class="form-input"
            />
          </FormField>
        </div>
      </div>
    </div>

    <!-- Optional Fields Group (group 9) -->
    <div class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ optionalGroup.name }}</h4>
      </div>
      <div class="p-4 grid grid-cols-2 gap-4">
        <div v-for="fieldName in optionalGroup.fields" :key="fieldName">
          <div class="flex items-center gap-2 mb-1">
            <input
              type="checkbox"
              :checked="!formData[`_omit_${fieldName}`]"
              @change="toggleOptional(fieldName, $event.target.checked)"
              :disabled="readOnly"
              class="w-3.5 h-3.5 rounded border-gray-300 dark:border-dark-border text-primary-500 focus:ring-primary-500 dark:bg-dark-bg"
            />
            <label class="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
              {{ schema.fields[fieldName].label }}
              <span v-if="schema.fields[fieldName].description" class="relative group">
                <svg class="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="absolute z-50 hidden group-hover:block top-full left-0 mt-1 w-64 p-2 text-xs font-normal text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg whitespace-normal">
                  {{ schema.fields[fieldName].description }}
                </span>
              </span>
            </label>
          </div>

          <label
            v-if="schema.fields[fieldName].type === 'boolean'"
            class="flex items-center gap-2"
            :class="{ 'opacity-60 cursor-not-allowed': formData[`_omit_${fieldName}`] }"
          >
            <input
              type="checkbox"
              :checked="formData[fieldName]"
              @change="updateField(fieldName, $event.target.checked)"
              :disabled="readOnly || formData[`_omit_${fieldName}`]"
              class="w-4 h-4 rounded border-gray-300 dark:border-dark-border text-primary-500 focus:ring-primary-500 dark:bg-dark-bg"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ formData[fieldName] ? '사용' : '미사용' }}</span>
          </label>

          <select
            v-else-if="schema.fields[fieldName].type === 'select'"
            :value="formData[fieldName]"
            @change="updateField(fieldName, $event.target.value)"
            :disabled="readOnly || formData[`_omit_${fieldName}`]"
            class="form-input"
            :class="{ 'opacity-60 cursor-not-allowed': formData[`_omit_${fieldName}`] }"
          >
            <option v-for="opt in schema.fields[fieldName].options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>

          <input
            v-else-if="schema.fields[fieldName].type === 'number'"
            type="number"
            :value="formData[fieldName]"
            @input="updateField(fieldName, $event.target.value)"
            :disabled="readOnly || formData[`_omit_${fieldName}`]"
            class="form-input"
            :class="{ 'opacity-60 cursor-not-allowed': formData[`_omit_${fieldName}`] }"
          />

          <input
            v-else
            type="text"
            :value="formData[fieldName]"
            @input="updateField(fieldName, $event.target.value)"
            :disabled="readOnly || formData[`_omit_${fieldName}`]"
            :placeholder="schema.fields[fieldName].placeholder || schema.fields[fieldName].default || ''"
            class="form-input"
            :class="{ 'opacity-60 cursor-not-allowed': formData[`_omit_${fieldName}`] }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import {
  ARSAGENT_SCHEMA,
  OPTIONAL_FIELDS,
  createDefaultCronTab,
  buildARSAgentOutput,
  parseARSAgentInput
} from './schema'
import { describeARSAgent } from './description'
import { isNoEmailChecked } from '../shared/formatUtils'
import FormField from '../shared/components/FormField.vue'
import SuspendResumeEditor from '../shared/components/SuspendResumeEditor.vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  readOnly: { type: Boolean, default: false },
  accessLogSources: { type: Array, default: () => [] },
  triggerNames: { type: Array, default: () => [] },
  triggerSourceMap: { type: Object, default: () => ({}) },
  suspendableTriggerNames: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue'])

const schema = ARSAGENT_SCHEMA
const formData = ref({})
let isInternalUpdate = false

const requiredGroups = computed(() => schema.fieldGroups.slice(0, 8))
const optionalGroup = computed(() => schema.fieldGroups[8])

watch(() => props.modelValue, (newVal) => {
  if (isInternalUpdate) return
  formData.value = parseARSAgentInput(newVal || {})
}, { immediate: true, deep: true })

const descriptionText = computed(() => describeARSAgent(formData.value))

function emitChange() {
  isInternalUpdate = true
  const output = buildARSAgentOutput(formData.value)
  emit('update:modelValue', output)
  nextTick(() => { isInternalUpdate = false })
}

const selectedTriggers = computed(() =>
  (formData.value.ErrorTrigger || []).map(t => t.alid)
)

const selectedAccessLogs = computed(() =>
  formData.value.AccessLogLists || []
)

function toggleTrigger(name, checked) {
  let triggers = [...(formData.value.ErrorTrigger || [])]
  if (checked) {
    triggers.push({ alid: name })
    // 트리거의 source에 연결된 AccessLog 자동 선택
    const sources = props.triggerSourceMap[name] || []
    if (sources.length > 0) {
      const currentLogs = new Set(formData.value.AccessLogLists || [])
      for (const src of sources) {
        currentLogs.add(src)
      }
      formData.value.AccessLogLists = [...currentLogs]
    }
  } else {
    triggers = triggers.filter(t => t.alid !== name)
    // 해제된 트리거의 source 중, 남은 트리거가 아무도 사용하지 않는 AccessLog 자동 해제
    const removedSources = props.triggerSourceMap[name] || []
    if (removedSources.length > 0) {
      const remainingNames = new Set(triggers.map(t => t.alid))
      const stillUsed = new Set()
      for (const tn of remainingNames) {
        for (const src of (props.triggerSourceMap[tn] || [])) {
          stillUsed.add(src)
        }
      }
      formData.value.AccessLogLists = (formData.value.AccessLogLists || [])
        .filter(log => !removedSources.includes(log) || stillUsed.has(log))
    }
  }
  formData.value.ErrorTrigger = triggers
  emitChange()
}

function toggleAccessLog(name, checked) {
  let logs = [...(formData.value.AccessLogLists || [])]
  if (checked) {
    logs.push(name)
  } else {
    logs = logs.filter(n => n !== name)
  }
  formData.value.AccessLogLists = logs
  emitChange()
}

const expandedCronTabs = ref(new Set())

function toggleCronTabExpand(index) {
  const next = new Set(expandedCronTabs.value)
  if (next.has(index)) {
    next.delete(index)
  } else {
    next.add(index)
  }
  expandedCronTabs.value = next
}

function addCronTab() {
  if (!formData.value.CronTab) formData.value.CronTab = []
  formData.value.CronTab.push(createDefaultCronTab())
  const next = new Set(expandedCronTabs.value)
  next.add(formData.value.CronTab.length - 1)
  expandedCronTabs.value = next
  emitChange()
}

function removeCronTab(index) {
  formData.value.CronTab.splice(index, 1)
  const next = new Set()
  for (const i of expandedCronTabs.value) {
    if (i < index) next.add(i)
    else if (i > index) next.add(i - 1)
  }
  expandedCronTabs.value = next
  emitChange()
}

function updateCronTabField(index, field, value) {
  formData.value.CronTab[index][field] = value
  emitChange()
}

function toggleCronTabNoEmail(index, option) {
  const current = (formData.value.CronTab[index]['no-email'] || '').split(';').map(s => s.trim()).filter(Boolean)
  const idx = current.indexOf(option)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(option)
  const ordered = []
  if (current.includes('success')) ordered.push('success')
  if (current.includes('fail')) ordered.push('fail')
  formData.value.CronTab[index]['no-email'] = ordered.join(';')
  emitChange()
}

function updateField(fieldName, value) {
  const fieldDef = schema.fields[fieldName]
  if (fieldDef.type === 'boolean') {
    formData.value[fieldName] = value
  } else if (fieldDef.type === 'number') {
    formData.value[fieldName] = value === '' ? '' : value
  } else {
    formData.value[fieldName] = value
  }
  emitChange()
}

function toggleOptional(fieldName, enabled) {
  formData.value[`_omit_${fieldName}`] = !enabled
  emitChange()
}

function addCronTabSuspendResumeItem(index, field) {
  const item = field === 'suspend' ? { name: '', duration: '' } : { name: '' }
  if (!formData.value.CronTab[index][field]) formData.value.CronTab[index][field] = []
  formData.value.CronTab[index][field].push(item)
  emitChange()
}

function removeCronTabSuspendResumeItem(index, field, idx) {
  formData.value.CronTab[index][field].splice(idx, 1)
  emitChange()
}

function updateCronTabSuspendResumeItem(index, field, idx, prop, value) {
  formData.value.CronTab[index][field][idx] = { ...formData.value.CronTab[index][field][idx], [prop]: value }
  emitChange()
}

function cronTabTitle(cron) {
  const typeLabel = schema.cronTabFields.type.options.find(o => o.value === cron.type)?.label || cron.type
  return cron.name ? `${cron.name} (${typeLabel})` : typeLabel
}
</script>

<style scoped>
@import '../shared/form-input.css';
</style>
