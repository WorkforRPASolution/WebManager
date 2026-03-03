<template>
  <div class="space-y-6">
    <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200">
      리소스 에이전트 설정 (ResourceAgent)
    </h3>

    <!-- Description Info Box -->
    <div v-if="descriptionText" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
      <p class="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">{{ descriptionText }}</p>
    </div>

    <!-- Field Groups -->
    <div
      v-for="group in visibleGroups"
      :key="group.name"
      class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden"
    >
      <div class="px-4 py-3 bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ group.name }}</h4>
      </div>
      <div class="p-4 grid grid-cols-2 gap-4">
        <div v-for="fieldName in visibleFields(group)" :key="fieldName">
          <FormField :schema="schema.fields[fieldName]">
            <!-- boolean → checkbox -->
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

            <!-- select → dropdown -->
            <select
              v-else-if="schema.fields[fieldName].type === 'select'"
              :value="formData[fieldName]"
              @change="updateField(fieldName, $event.target.value)"
              :disabled="readOnly"
              class="form-input"
            >
              <option v-for="opt in schema.fields[fieldName].options" :key="String(opt.value)" :value="opt.value" :disabled="opt.disabled">{{ opt.label }}</option>
            </select>

            <!-- password → password input -->
            <input
              v-else-if="schema.fields[fieldName].type === 'password'"
              type="password"
              :value="formData[fieldName]"
              @input="updateField(fieldName, $event.target.value)"
              :disabled="readOnly"
              :placeholder="schema.fields[fieldName].default || ''"
              class="form-input"
              autocomplete="off"
            />

            <!-- array → FormTagInput -->
            <FormTagInput
              v-else-if="schema.fields[fieldName].type === 'array'"
              :modelValue="formData[fieldName] || []"
              @update:modelValue="updateField(fieldName, $event)"
              :readOnly="readOnly"
              :placeholder="schema.fields[fieldName].placeholder || 'host:port 입력 후 Enter'"
            />

            <!-- number → number input -->
            <input
              v-else-if="schema.fields[fieldName].type === 'number'"
              type="number"
              :value="formData[fieldName]"
              @input="updateField(fieldName, $event.target.value)"
              :disabled="readOnly"
              class="form-input"
            />

            <!-- text / go-duration → text input -->
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
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import {
  RESOURCEAGENT_SCHEMA,
  parseResourceAgentInput,
  buildResourceAgentOutput
} from './schema'
import { describeResourceAgent } from './description'
import FormField from '../shared/components/FormField.vue'
import FormTagInput from '../shared/components/FormTagInput.vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  readOnly: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const schema = RESOURCEAGENT_SCHEMA
const formData = ref({})
let isInternalUpdate = false

watch(() => props.modelValue, (newVal) => {
  if (isInternalUpdate) return
  formData.value = parseResourceAgentInput(newVal || {})
}, { immediate: true, deep: true })

const descriptionText = computed(() => describeResourceAgent(props.modelValue))

function emitChange() {
  isInternalUpdate = true
  const output = buildResourceAgentOutput(formData.value)
  emit('update:modelValue', output)
  nextTick(() => { isInternalUpdate = false })
}

function updateField(fieldName, value) {
  const fieldDef = schema.fields[fieldName]
  if (fieldDef.type === 'boolean') {
    formData.value[fieldName] = value
  } else if (fieldDef.type === 'number') {
    formData.value[fieldName] = value === '' ? '' : value
  } else if (fieldDef.type === 'array') {
    formData.value[fieldName] = value
  } else {
    formData.value[fieldName] = value
  }
  emitChange()
}

/**
 * Compute visible groups based on showWhen conditions.
 */
const visibleGroups = computed(() => {
  return schema.fieldGroups.filter(group => {
    if (!group.showWhen) return true
    const val = formData.value[group.showWhen.field]
    if (group.showWhen.values) {
      return group.showWhen.values.includes(val)
    }
    return val === group.showWhen.value
  })
})

/**
 * Filter visible fields within a group based on conditional property.
 */
function visibleFields(group) {
  return group.fields.filter(fieldName => {
    const fieldDef = schema.fields[fieldName]
    if (!fieldDef.conditional) return true
    return formData.value[fieldDef.conditional.field] === fieldDef.conditional.value
  })
}
</script>

<style scoped>
@import '../shared/form-input.css';
</style>
