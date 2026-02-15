<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200">
        트리거 규칙 관리
      </h3>
      <button
        v-if="!readOnly"
        type="button"
        class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition"
        @click="addTrigger"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        트리거 추가
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="triggers.length === 0" class="text-center py-12 text-gray-400 dark:text-gray-500">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <p class="text-sm">등록된 트리거가 없습니다. 트리거를 추가해주세요.</p>
    </div>

    <!-- Trigger Cards -->
    <div v-for="(trig, ti) in triggers" :key="ti" class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
      <!-- Trigger Header -->
      <div
        class="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-dark-bg cursor-pointer select-none"
        @click="toggleExpand(ti)"
      >
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-90': expanded[ti] }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span class="font-medium text-sm text-gray-800 dark:text-gray-200">{{ trig.name || '(이름 없음)' }}</span>
          <span v-if="trig.source" class="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            {{ trig.source }}
          </span>
        </div>
        <button
          v-if="!readOnly"
          type="button"
          class="p-1 text-gray-400 hover:text-red-500 transition-colors"
          title="트리거 삭제"
          @click.stop="removeTrigger(ti)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <!-- Trigger Body -->
      <div v-show="expanded[ti]" class="px-4 py-4 space-y-4 border-t border-gray-200 dark:border-dark-border">
        <!-- Description -->
        <div v-if="describeTrig(trig)" class="mb-4 px-3 py-2.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg whitespace-pre-line">
          📋 {{ describeTrig(trig) }}
        </div>

        <!-- Trigger Name + Source -->
        <div class="grid grid-cols-2 gap-3">
          <FormField label="트리거 이름" :description="'이 트리거의 고유 이름입니다. ARSAgent.json에서 참조됩니다.'" :required="true">
            <input type="text" :value="trig.name" @input="updateTriggerField(ti, 'name', $event.target.value)" :disabled="readOnly" placeholder="LIMITATION_TEST" class="form-input" />
          </FormField>
          <FormField :label="triggerSchema.fields.source.label" :description="triggerSchema.fields.source.description" :required="true">
            <select :value="trig.source" @change="updateTriggerField(ti, 'source', $event.target.value)" :disabled="readOnly" class="form-input">
              <option value="">-- 로그 소스 선택 --</option>
              <option v-for="src in accessLogSources" :key="src" :value="src">{{ src }}</option>
            </select>
          </FormField>
        </div>

        <!-- Recipe Steps -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-400">레시피 스텝</h4>
            <button
              v-if="!readOnly"
              type="button"
              class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 border border-primary-300 dark:border-primary-700 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20 transition"
              @click="addStep(ti)"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              스텝 추가
            </button>
          </div>

          <div v-for="(step, si) in trig.recipe" :key="si">
            <!-- Step Card -->
            <div class="border border-blue-200 dark:border-blue-800/50 rounded-lg bg-blue-50/30 dark:bg-blue-900/10 p-3 space-y-3">
              <!-- Step Header -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white text-xs font-bold">{{ si + 1 }}</span>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ step.name || 'Step ' + (si + 1) }}</span>
                </div>
                <button
                  v-if="!readOnly"
                  type="button"
                  class="p-1 text-gray-400 hover:text-red-500 transition-colors text-xs"
                  @click="removeStep(ti, si)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Step Name + Type -->
              <div class="grid grid-cols-2 gap-3">
                <FormField :label="stepSchema.fields.name.label" :description="stepSchema.fields.name.description">
                  <input type="text" :value="step.name" @input="updateStepField(ti, si, 'name', $event.target.value)" :disabled="readOnly" :placeholder="'Step_' + (si + 1)" class="form-input" />
                </FormField>
                <FormField :label="stepSchema.fields.type.label" :description="stepSchema.fields.type.description">
                  <select :value="step.type" @change="updateStepField(ti, si, 'type', $event.target.value)" :disabled="readOnly" class="form-input">
                    <option v-for="opt in stepSchema.fields.type.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </FormField>
              </div>

              <!-- Trigger Patterns -->
              <FormField :label="stepSchema.fields.trigger.label" :description="stepSchema.fields.trigger.description">
                <FormTagInput
                  :modelValue="step.trigger || []"
                  @update:modelValue="updateStepField(ti, si, 'trigger', $event)"
                  objectKey="syntax"
                  :placeholder="stepSchema.fields.trigger.placeholder"
                  :readOnly="readOnly"
                />
              </FormField>

              <!-- Duration + Times -->
              <div class="grid grid-cols-2 gap-3">
                <FormField :label="stepSchema.fields.duration.label" :description="stepSchema.fields.duration.description">
                  <input type="text" :value="step.duration" @input="updateStepField(ti, si, 'duration', $event.target.value)" :disabled="readOnly" :placeholder="stepSchema.fields.duration.placeholder" class="form-input" />
                </FormField>
                <FormField :label="stepSchema.fields.times.label" :description="stepSchema.fields.times.description">
                  <input type="number" :value="step.times" @input="updateStepField(ti, si, 'times', Number($event.target.value))" :disabled="readOnly" min="1" placeholder="1" class="form-input" />
                </FormField>
              </div>

              <!-- Next Action -->
              <FormField :label="stepSchema.fields.next.label" :description="stepSchema.fields.next.description">
                <select :value="step.next" @change="updateStepField(ti, si, 'next', $event.target.value)" :disabled="readOnly" class="form-input">
                  <option value="">-- 선택 --</option>
                  <template v-for="(s, ssi) in trig.recipe" :key="ssi">
                    <option v-if="ssi !== si && s.name" :value="s.name">{{ s.name }} (다음 스텝)</option>
                  </template>
                  <option value="@script">@script (스크립트 실행)</option>
                </select>
              </FormField>

              <!-- Script Section (conditional) -->
              <div v-if="step.next === '@script'" class="border border-amber-200 dark:border-amber-800/50 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 p-3 space-y-3">
                <h5 class="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  스크립트 설정
                </h5>
                <div class="grid grid-cols-2 gap-3">
                  <FormField :label="scriptSchema.fields.name.label" :description="scriptSchema.fields.name.description">
                    <input type="text" :value="step.script?.name" @input="updateScriptField(ti, si, 'name', $event.target.value)" :disabled="readOnly" :placeholder="scriptSchema.fields.name.placeholder" class="form-input" />
                  </FormField>
                  <FormField :label="scriptSchema.fields.arg.label" :description="scriptSchema.fields.arg.description">
                    <input type="text" :value="step.script?.arg" @input="updateScriptField(ti, si, 'arg', $event.target.value)" :disabled="readOnly" :placeholder="scriptSchema.fields.arg.placeholder" class="form-input" />
                  </FormField>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <FormField :label="scriptSchema.fields['no-email'].label" :description="scriptSchema.fields['no-email'].description">
                    <input type="text" :value="step.script?.['no-email']" @input="updateScriptField(ti, si, 'no-email', $event.target.value)" :disabled="readOnly" :placeholder="scriptSchema.fields['no-email'].placeholder" class="form-input" />
                  </FormField>
                  <FormField :label="scriptSchema.fields.key.label" :description="scriptSchema.fields.key.description">
                    <input type="number" :value="step.script?.key" @input="updateScriptField(ti, si, 'key', Number($event.target.value))" :disabled="readOnly" :placeholder="scriptSchema.fields.key.placeholder" class="form-input" />
                  </FormField>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <FormField :label="scriptSchema.fields.timeout.label" :description="scriptSchema.fields.timeout.description">
                    <input type="text" :value="step.script?.timeout" @input="updateScriptField(ti, si, 'timeout', $event.target.value)" :disabled="readOnly" :placeholder="scriptSchema.fields.timeout.placeholder" class="form-input" />
                  </FormField>
                  <FormField :label="scriptSchema.fields.retry.label" :description="scriptSchema.fields.retry.description">
                    <input type="text" :value="step.script?.retry" @input="updateScriptField(ti, si, 'retry', $event.target.value)" :disabled="readOnly" :placeholder="scriptSchema.fields.retry.placeholder" class="form-input" />
                  </FormField>
                </div>
              </div>
            </div>

            <!-- Step Arrow -->
            <div v-if="si < trig.recipe.length - 1" class="flex justify-center py-1 text-primary-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Limitation Section -->
        <div class="border border-green-200 dark:border-green-800/50 rounded-lg bg-green-50/50 dark:bg-green-900/10 p-3 space-y-3">
          <h4 class="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            제한 설정 (Limitation)
            <span class="relative group">
              <svg class="w-3.5 h-3.5 text-green-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="absolute z-50 hidden group-hover:block bottom-full left-0 mb-1 w-64 p-2 text-xs font-normal text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg whitespace-normal">
                트리거가 과도하게 발동되는 것을 방지합니다. 지정된 기간 내 최대 횟수만큼만 발동됩니다.
              </span>
            </span>
          </h4>
          <div class="grid grid-cols-2 gap-3">
            <FormField :label="triggerSchema.limitation.times.label" :description="triggerSchema.limitation.times.description">
              <input type="number" :value="trig.limitation?.times" @input="updateLimitation(ti, 'times', Number($event.target.value))" :disabled="readOnly" min="1" placeholder="1" class="form-input" />
            </FormField>
            <FormField :label="triggerSchema.limitation.duration.label" :description="triggerSchema.limitation.duration.description">
              <input type="text" :value="trig.limitation?.duration" @input="updateLimitation(ti, 'duration', $event.target.value)" :disabled="readOnly" placeholder="1 minutes" class="form-input" />
            </FormField>
          </div>
        </div>
      </div>

      <!-- Test Panel -->
      <TriggerTestPanel v-if="expanded[ti]" :trigger="trig" />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { TRIGGER_SCHEMA, TRIGGER_STEP_SCHEMA, TRIGGER_SCRIPT_SCHEMA, createDefaultTrigger, createDefaultTriggerStep } from './configSchemas'
import { describeTrigger } from './configDescription'
import FormTagInput from './FormTagInput.vue'
import FormField from './FormField.vue'
import TriggerTestPanel from './TriggerTestPanel.vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  readOnly: { type: Boolean, default: false },
  accessLogSources: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue'])

const triggerSchema = TRIGGER_SCHEMA
const stepSchema = TRIGGER_STEP_SCHEMA
const scriptSchema = TRIGGER_SCRIPT_SCHEMA
const expanded = reactive({})

// Object → Array 변환
const triggers = computed(() => {
  return Object.entries(props.modelValue || {}).map(([name, config]) => ({
    name,
    source: config.source || '',
    recipe: (config.recipe || []).map(r => ({
      name: r.name || '',
      type: r.type || 'regex',
      trigger: r.trigger || [],
      duration: r.duration || '',
      times: r.times || 1,
      next: r.next || '',
      script: r.script || { ...TRIGGER_SCRIPT_SCHEMA.defaults }
    })),
    limitation: {
      times: config.limitation?.times || 1,
      duration: config.limitation?.durtaion || config.limitation?.duration || '1 minutes'
    }
  }))
})

function toggleExpand(idx) {
  expanded[idx] = !expanded[idx]
}

function describeTrig(trig) {
  return describeTrigger(trig)
}

function emitUpdate(newTriggers) {
  const obj = {}
  for (const trig of newTriggers) {
    let name = trig.name || 'Unnamed_Trigger'
    // 중복 key 방지: 같은 이름이 이미 있으면 suffix 추가
    let uniqueName = name
    let counter = 2
    while (Object.prototype.hasOwnProperty.call(obj, uniqueName)) {
      uniqueName = `${name}_${counter++}`
    }
    obj[uniqueName] = {
      source: trig.source,
      recipe: trig.recipe.map(step => {
        const s = {
          name: step.name,
          type: step.type,
          trigger: step.trigger,
          duration: step.duration,
          times: step.times,
          next: step.next
        }
        if (step.next === '@script') {
          s.script = { ...step.script }
        }
        return s
      }),
      limitation: {
        times: trig.limitation.times,
        // 원본 typo 유지: "durtaion"
        durtaion: trig.limitation.duration
      }
    }
  }
  emit('update:modelValue', obj)
}

function cloneTriggers() {
  return triggers.value.map(t => ({
    ...t,
    recipe: t.recipe.map(r => ({ ...r, trigger: [...r.trigger], script: { ...r.script } })),
    limitation: { ...t.limitation }
  }))
}

function updateTriggerField(ti, field, value) {
  const updated = cloneTriggers()
  updated[ti][field] = value
  emitUpdate(updated)
}

function updateStepField(ti, si, field, value) {
  const updated = cloneTriggers()
  updated[ti].recipe[si][field] = value
  emitUpdate(updated)
}

function updateScriptField(ti, si, field, value) {
  const updated = cloneTriggers()
  updated[ti].recipe[si].script = { ...updated[ti].recipe[si].script, [field]: value }
  emitUpdate(updated)
}

function updateLimitation(ti, field, value) {
  const updated = cloneTriggers()
  updated[ti].limitation[field] = value
  emitUpdate(updated)
}

function addTrigger() {
  const updated = cloneTriggers()
  const existingNames = new Set(updated.map(t => t.name))
  let newName = 'New_Trigger'
  let counter = 1
  while (existingNames.has(newName)) {
    newName = `New_Trigger_${++counter}`
  }
  const newTrig = createDefaultTrigger()
  newTrig.name = newName
  updated.push(newTrig)
  expanded[updated.length - 1] = true
  emitUpdate(updated)
}

function removeTrigger(ti) {
  const updated = cloneTriggers().filter((_, i) => i !== ti)
  emitUpdate(updated)
}

function addStep(ti) {
  const updated = cloneTriggers()
  updated[ti].recipe.push(createDefaultTriggerStep(updated[ti].recipe.length))
  emitUpdate(updated)
}

function removeStep(ti, si) {
  const updated = cloneTriggers()
  updated[ti].recipe.splice(si, 1)
  emitUpdate(updated)
}

</script>

<style scoped>
.form-input {
  @apply w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed;
}
</style>
