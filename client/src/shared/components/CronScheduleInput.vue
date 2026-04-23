<template>
  <div class="cron-schedule-input space-y-2">
    <div class="flex items-end gap-3 flex-wrap">
      <!-- 6 split inputs -->
      <div class="flex items-end gap-1.5">
        <div v-for="key in FIELD_ORDER.slice(0, 6)" :key="key" class="flex flex-col">
          <label class="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 text-center">{{ FIELD_LABELS[key] }}</label>
          <input
            type="text"
            :value="internalFields[key]"
            @input="onFieldInput(key, $event.target.value)"
            :disabled="readOnly"
            class="w-14 px-2 py-1 text-sm text-center border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed font-mono"
            :class="parseError ? 'border-red-400' : ''"
          />
        </div>
      </div>

      <!-- Preset dropdown -->
      <div class="flex flex-col">
        <label class="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">프리셋</label>
        <select
          :value="currentPresetLabel || '__custom__'"
          @change="onPresetChange($event.target.value)"
          :disabled="readOnly"
          class="px-2 py-1 text-sm border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <option value="__custom__">사용자 정의</option>
          <option v-for="p in CRON_PRESETS" :key="p.expression" :value="p.label">{{ p.label }}</option>
        </select>
      </div>
    </div>

    <!-- Parse error -->
    <p v-if="parseError" class="text-xs text-red-500">{{ parseError }}</p>

    <!-- Human-readable description -->
    <p v-else-if="humanDescription" class="text-xs text-gray-600 dark:text-gray-400">
      <span class="font-medium text-gray-500 dark:text-gray-500">설명:</span> {{ humanDescription }}
    </p>

    <!-- Next fires preview -->
    <p v-if="!parseError && nextFiresText" class="text-xs text-gray-500 dark:text-gray-500">
      <span class="font-medium">다음 발화:</span> {{ nextFiresText }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  FIELD_LABELS, FIELD_ORDER, CRON_PRESETS,
  parseCronString, composeCronString, matchPreset, computeNextFires, describeCron
} from '@/shared/utils/cronUtils'

const props = defineProps({
  modelValue: { type: String, default: '' },
  readOnly: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'invalid'])

const internalFields = ref({
  second: '*', minute: '*', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*'
})
const parseError = ref(null)

// Sync modelValue → internal fields on external change.
// Token-level parse populates the 6 inputs; Quartz-semantic validation is done
// via computeNextFires so that e.g. "0 abc * * * ?" (6 tokens but abc is not a
// valid minute) is flagged as an error.
watch(
  () => props.modelValue,
  (val) => {
    const parsed = parseCronString(val)
    if (parsed.ok) {
      internalFields.value = { ...internalFields.value, ...parsed.fields }
    }
    const nextFires = computeNextFires(val, 1)
    if (!nextFires.ok) {
      parseError.value = parsed.error || '잘못된 cron 표현식입니다.'
      emit('invalid', parseError.value)
    } else {
      parseError.value = null
      emit('invalid', null)
    }
  },
  { immediate: true }
)

function onFieldInput(key, value) {
  internalFields.value = { ...internalFields.value, [key]: value.trim() }
  const composed = composeCronString(internalFields.value)
  // Validate: attempt cron-parser. If it fails, still emit (user might be mid-edit)
  // but flag via parseError.
  const nextFires = computeNextFires(composed, 1)
  if (!nextFires.ok) {
    parseError.value = '잘못된 cron 표현식입니다.'
    emit('invalid', parseError.value)
  } else {
    parseError.value = null
    emit('invalid', null)
  }
  emit('update:modelValue', composed)
}

function onPresetChange(label) {
  if (label === '__custom__') return  // no-op; user will edit fields manually
  const preset = CRON_PRESETS.find(p => p.label === label)
  if (!preset) return
  const parsed = parseCronString(preset.expression)
  if (parsed.ok) {
    internalFields.value = { ...internalFields.value, ...parsed.fields }
    parseError.value = null
    emit('update:modelValue', preset.expression)
    emit('invalid', null)
  }
}

const currentPresetLabel = computed(() => matchPreset(props.modelValue))

const humanDescription = computed(() => describeCron(props.modelValue))

const nextFiresText = computed(() => {
  const result = computeNextFires(props.modelValue, 3)
  if (!result.ok) return null
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    timeZone: 'Asia/Seoul'
  })
  return result.fires.map(d => fmt.format(d)).join(', ')
})
</script>
