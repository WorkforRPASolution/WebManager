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
    <div
      v-for="(trig, ti) in triggers" :key="ti"
      class="border rounded-lg overflow-hidden transition-colors"
      :class="draggingIdx === ti ? 'opacity-50 border-gray-300 dark:border-dark-border' : dragOverIdx === ti && draggingIdx >= 0 && draggingIdx !== ti ? 'border-primary-400 dark:border-primary-500 bg-primary-50/30 dark:bg-primary-900/10' : 'border-gray-200 dark:border-dark-border'"
      @dragover.prevent="draggingIdx >= 0 && (dragOverIdx = ti)"
      @drop="onDrop(ti)"
    >
      <!-- Trigger Header -->
      <div
        class="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-dark-bg cursor-pointer select-none"
        @click="toggleExpand(ti)"
      >
        <div class="flex items-center gap-2">
          <span
            v-if="!readOnly"
            draggable="true"
            class="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500"
            @dragstart="onDragStart(ti, $event)"
            @dragend="onDragEnd"
            @click.stop
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
              <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
              <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
            </svg>
          </span>
          <svg class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-90': expanded[ti] }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span class="font-medium text-sm text-gray-800 dark:text-gray-200">{{ trig.name || '(이름 없음)' }}</span>
          <span v-if="trig.source" class="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            {{ trig.source }}
          </span>
        </div>
        <div v-if="!readOnly" class="flex items-center gap-0.5">
          <button
            type="button"
            class="p-1 transition-colors"
            :class="ti === 0 ? 'text-gray-200 dark:text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-primary-500'"
            title="위로 이동"
            :disabled="ti === 0"
            @click.stop="moveTrigger(ti, -1)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            class="p-1 transition-colors"
            :class="ti === triggers.length - 1 ? 'text-gray-200 dark:text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-primary-500'"
            title="아래로 이동"
            :disabled="ti === triggers.length - 1"
            @click.stop="moveTrigger(ti, 1)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
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
      </div>

      <!-- Trigger Body -->
      <div v-show="expanded[ti]" class="px-4 py-4 space-y-4 border-t border-gray-200 dark:border-dark-border">
        <!-- Description -->
        <div v-if="describeTrig(trig)" class="mb-4 px-3 py-2.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg whitespace-pre-line">
          {{ describeTrig(trig) }}
        </div>

        <!-- Trigger Name + Source -->
        <div class="grid grid-cols-2 gap-3">
          <FormField label="트리거 이름" :description="'이 트리거의 고유 이름입니다. ARSAgent.json에서 참조됩니다.'" :required="true">
            <input type="text" :value="trig.name" @input="updateTriggerField(ti, 'name', $event.target.value)" :disabled="readOnly" placeholder="LIMITATION_TEST" class="form-input" />
          </FormField>
          <FormField label="multi-select-source" description="감시할 로그 소스를 선택하세요 (복수 선택 가능)" :required="true">
            <div class="flex flex-wrap gap-2">
              <label v-for="src in accessLogSources" :key="src" class="flex items-center gap-1.5 px-2 py-1 text-xs border rounded-md cursor-pointer transition"
                :class="isSourceSelected(trig, src) ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-dark-border text-gray-500 dark:text-gray-400'"
              >
                <input type="checkbox" :checked="isSourceSelected(trig, src)" @change="toggleSource(ti, src)" :disabled="readOnly" class="rounded text-primary-500" />
                {{ src }}
              </label>
            </div>
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

              <!-- Delay type hint -->
              <p v-if="step.type === 'delay'" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                delay 스텝: 패턴이 매칭되면 체인이 step 1로 리셋됩니다 (취소 동작).
              </p>

              <!-- Trigger Patterns -->
              <FormField :label="stepSchema.fields.trigger.label" :description="stepSchema.fields.trigger.description">
                <FormTagInput
                  :modelValue="step.trigger || []"
                  @update:modelValue="updateStepField(ti, si, 'trigger', $event)"
                  objectKey="syntax"
                  :placeholder="stepSchema.fields.trigger.placeholder"
                  :readOnly="readOnly"
                  :selectedIndex="selectedPatternIdx[`${ti}_${si}`] ?? -1"
                  @select="onPatternSelect(ti, si, $event)"
                />
                <p class="text-xs text-gray-400 mt-1">팁: &lt;&lt;변수명&gt;&gt; 문법으로 로그에서 값을 추출합니다. 예: .*value: (&lt;&lt;val&gt;[\d.]+)</p>

                <!-- Params Editor (선택된 패턴) -->
                <div v-if="getSelectedPatternItem(ti, si)" class="mt-2 p-3 border border-amber-200 dark:border-amber-800/50 rounded-lg bg-amber-50/30 dark:bg-amber-900/10">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-medium text-amber-700 dark:text-amber-400">파라미터 조건 (params)</span>
                    <button v-if="!readOnly" type="button" class="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition" @click="addParamsCondition(ti, si)">+ 조건 추가</button>
                  </div>
                  <div v-if="getParamsConditions(ti, si).length === 0" class="text-xs text-gray-400">
                    조건 없음. "조건 추가"를 눌러 파라미터 비교 조건을 설정하세요.
                  </div>
                  <div v-for="(cond, ci) in getParamsConditions(ti, si)" :key="ci" class="flex gap-2 items-center mb-1.5">
                    <input type="number" :value="cond.compareValue" @input="updateParamsCondition(ti, si, ci, 'compareValue', $event.target.value)" step="0.1" :disabled="readOnly" class="w-20 form-input text-xs" placeholder="값" />
                    <select :value="cond.op" @change="updateParamsCondition(ti, si, ci, 'op', $event.target.value)" :disabled="readOnly" class="form-input text-xs w-24">
                      <option value="eq">= (같음)</option>
                      <option value="neq">&#8800; (다름)</option>
                      <option value="gt">&gt; (초과)</option>
                      <option value="gte">&#8805; (이상)</option>
                      <option value="lt">&lt; (미만)</option>
                      <option value="lte">&#8804; (이하)</option>
                    </select>
                    <span class="text-xs text-gray-400">@</span>
                    <select :value="cond.varName" @change="updateParamsCondition(ti, si, ci, 'varName', $event.target.value)" :disabled="readOnly" class="w-28 form-input text-xs">
                      <option value="" disabled>변수 선택</option>
                      <option v-for="vn in extractVarNames(ti, si)" :key="vn" :value="vn">{{ vn }}</option>
                    </select>
                    <button v-if="!readOnly" type="button" class="text-gray-400 hover:text-red-500 transition text-sm leading-none" @click="removeParamsCondition(ti, si, ci)">&times;</button>
                  </div>
                </div>
              </FormField>

              <!-- Duration + Times -->
              <div class="grid grid-cols-2 gap-3">
                <FormField :label="stepSchema.fields.duration.label" :description="stepSchema.fields.duration.description">
                  <input type="text" :value="step.duration" @input="updateStepField(ti, si, 'duration', $event.target.value)" :disabled="readOnly" :placeholder="stepSchema.fields.duration.placeholder" class="form-input" />
                </FormField>
                <FormField :label="stepSchema.fields.times.label" :description="stepSchema.fields.times.description">
                  <input type="number" :value="step.times" @input="updateStepField(ti, si, 'times', $event.target.value === '' ? null : Number($event.target.value))" :disabled="readOnly" min="1" placeholder="1" class="form-input" />
                </FormField>
              </div>

              <!-- Next Action -->
              <FormField :label="stepSchema.fields.next.label" :description="stepSchema.fields.next.description">
                <select :value="step.next" @change="updateStepField(ti, si, 'next', $event.target.value)" :disabled="readOnly" class="form-input">
                  <option value="">-- 선택 --</option>
                  <template v-for="(s, ssi) in trig.recipe" :key="ssi">
                    <option v-if="ssi !== si && s.name" :value="s.name">{{ s.name }} (다음 스텝)</option>
                  </template>
                  <option value="@recovery">@recovery (시나리오 실행)</option>
                  <option value="@script">@script (코드 기반 시나리오 실행)</option>
                  <option value="@notify">@notify (메일 발송)</option>
                  <option value="@popup">@popup (PopUp 실행)</option>
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
                    <div class="flex items-center gap-4 py-1.5">
                      <label class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input type="checkbox" :checked="isNoEmailChecked(step.script?.['no-email'], 'success')" @change="toggleNoEmail(ti, si, 'script', 'success')" :disabled="readOnly" class="rounded text-primary-500" />
                        success
                      </label>
                      <label class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input type="checkbox" :checked="isNoEmailChecked(step.script?.['no-email'], 'fail')" @change="toggleNoEmail(ti, si, 'script', 'fail')" :disabled="readOnly" class="rounded text-primary-500" />
                        fail
                      </label>
                      <span v-if="step.script?.['no-email']" class="text-xs text-gray-400 ml-auto">{{ step.script['no-email'] }}</span>
                    </div>
                  </FormField>
                  <FormField :label="scriptSchema.fields.key.label" :description="scriptSchema.fields.key.description">
                    <input type="number" :value="step.script?.key" @input="updateScriptField(ti, si, 'key', $event.target.value === '' ? null : Number($event.target.value))" :disabled="readOnly" :placeholder="scriptSchema.fields.key.placeholder" class="form-input" />
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

              <!-- Popup Detail Section (conditional) -->
              <div v-if="step.next === '@popup'" class="border border-violet-200 dark:border-violet-800/50 rounded-lg bg-violet-50/50 dark:bg-violet-900/10 p-3 space-y-3">
                <h5 class="text-xs font-semibold text-violet-700 dark:text-violet-400">팝업 상세 설정</h5>
                <FormField label="이메일 비발송 조건 (no-email)" description="이 값과 일치하는 결과일 때 이메일을 발송하지 않습니다.">
                  <div class="flex items-center gap-4 py-1.5">
                    <label class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input type="checkbox" :checked="isNoEmailChecked(step.detail?.['no-email'], 'success')" @change="toggleNoEmail(ti, si, 'detail', 'success')" :disabled="readOnly" class="rounded text-primary-500" />
                      success
                    </label>
                    <label class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input type="checkbox" :checked="isNoEmailChecked(step.detail?.['no-email'], 'fail')" @change="toggleNoEmail(ti, si, 'detail', 'fail')" :disabled="readOnly" class="rounded text-primary-500" />
                      fail
                    </label>
                    <span v-if="step.detail?.['no-email']" class="text-xs text-gray-400 ml-auto">{{ step.detail['no-email'] }}</span>
                  </div>
                </FormField>
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
        <div v-if="trig.limitation" class="border border-green-200 dark:border-green-800/50 rounded-lg bg-green-50/50 dark:bg-green-900/10 p-3 space-y-3">
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
            <button
              v-if="!readOnly && isScriptTerminal(trig)"
              type="button"
              class="ml-auto p-0.5 text-green-400 hover:text-red-500 transition-colors"
              title="Limitation 삭제"
              @click="deleteLimitation(ti)"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </h4>
          <div class="grid grid-cols-2 gap-3">
            <FormField :label="triggerSchema.limitation.times.label" :description="triggerSchema.limitation.times.description">
              <input type="number" :value="trig.limitation?.times" @input="updateLimitation(ti, 'times', $event.target.value === '' ? null : Number($event.target.value))" :disabled="readOnly" min="1" placeholder="1" class="form-input" />
            </FormField>
            <FormField :label="triggerSchema.limitation.duration.label" :description="triggerSchema.limitation.duration.description">
              <input type="text" :value="trig.limitation?.duration" @input="updateLimitation(ti, 'duration', $event.target.value)" :disabled="readOnly" placeholder="1 minutes" class="form-input" />
            </FormField>
          </div>
        </div>
        <!-- Add Limitation button (for @script without limitation) -->
        <button
          v-else-if="isScriptTerminal(trig) && !readOnly"
          type="button"
          class="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-green-600 dark:text-green-400 border border-dashed border-green-300 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition"
          @click="addLimitation(ti)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Limitation 추가 (선택)
        </button>
      </div>

      <!-- Test Panel -->
      <TriggerTestPanel v-if="expanded[ti]" :trigger="trig" />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
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
const selectedPatternIdx = reactive({})
const draggingIdx = ref(-1)
const dragOverIdx = ref(-1)

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
      script: r.script || { ...TRIGGER_SCRIPT_SCHEMA.defaults },
      detail: r.detail || {}
    })),
    limitation: (() => {
      const lastStep = (config.recipe || []).slice(-1)[0]
      const isScript = lastStep && (lastStep.next === '@script' || lastStep.next === '@Script')
      if (config.limitation) {
        return {
          times: config.limitation.times || 1,
          duration: config.limitation.duration || config.limitation.durtaion || '1 minutes'
        }
      }
      if (isScript) return null
      return { times: 1, duration: '1 minutes' }
    })()
  }))
})

function toggleExpand(idx) {
  expanded[idx] = !expanded[idx]
}

function describeTrig(trig) {
  return describeTrigger(trig)
}

// Source multi-select helpers
function isSourceSelected(trig, src) {
  return (trig.source || '').split(',').map(s => s.trim()).filter(Boolean).includes(src)
}

function toggleSource(ti, src) {
  const trig = triggers.value[ti]
  const current = (trig.source || '').split(',').map(s => s.trim()).filter(Boolean)
  const idx = current.indexOf(src)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(src)
  updateTriggerField(ti, 'source', current.join(','))
}

function buildOutput(triggersList) {
  const obj = {}
  for (const trig of triggersList) {
    let name = trig.name || 'Unnamed_Trigger'
    let uniqueName = name
    let counter = 2
    while (Object.prototype.hasOwnProperty.call(obj, uniqueName)) {
      uniqueName = `${name}_${counter++}`
    }
    const triggerObj = {
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
          const script = {}
          for (const [k, v] of Object.entries(step.script || {})) {
            if (k === 'name' || (v !== '' && v !== null && v !== undefined)) script[k] = v
          }
          if (Object.keys(script).length > 0) s.script = script
        }
        if (step.next === '@popup') {
          const detail = {}
          for (const [k, v] of Object.entries(step.detail || {})) {
            if (v !== '' && v !== null && v !== undefined) detail[k] = v
          }
          if (Object.keys(detail).length > 0) s.detail = detail
        }
        return s
      })
    }
    const lastRecipeStep = trig.recipe[trig.recipe.length - 1]
    const isScriptTerm = lastRecipeStep && (lastRecipeStep.next === '@script' || lastRecipeStep.next === '@Script')
    if (trig.limitation) {
      triggerObj.limitation = {
        times: trig.limitation.times,
        duration: trig.limitation.duration
      }
    } else if (!isScriptTerm) {
      triggerObj.limitation = { times: 1, duration: '1 minutes' }
    }
    obj[uniqueName] = triggerObj
  }
  return obj
}

function emitUpdate(newTriggers) {
  emit('update:modelValue', buildOutput(newTriggers))
}

// Form 모드 진입 시 정규화된 데이터 동기화 (limitation 자동추가 등)
onMounted(() => {
  const normalized = buildOutput(triggers.value)
  if (JSON.stringify(normalized) !== JSON.stringify(props.modelValue)) {
    emit('update:modelValue', normalized)
  }
})

function cloneTriggers() {
  return triggers.value.map(t => ({
    ...t,
    recipe: t.recipe.map(r => ({ ...r, trigger: [...r.trigger], script: { ...r.script }, detail: { ...(r.detail || {}) } })),
    limitation: t.limitation ? { ...t.limitation } : null
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

function updateDetailField(ti, si, field, value) {
  const updated = cloneTriggers()
  updated[ti].recipe[si].detail = { ...updated[ti].recipe[si].detail, [field]: value }
  emitUpdate(updated)
}

function onPatternSelect(ti, si, idx) {
  const key = `${ti}_${si}`
  selectedPatternIdx[key] = idx
}

function getSelectedPatternItem(ti, si) {
  const key = `${ti}_${si}`
  const idx = selectedPatternIdx[key]
  if (idx == null || idx < 0) return null
  const trig = triggers.value[ti]
  if (!trig) return null
  const step = trig.recipe[si]
  if (!step || !step.trigger) return null
  return step.trigger[idx] || null
}

function getParamsConditions(ti, si) {
  const item = getSelectedPatternItem(ti, si)
  if (!item || !item.params) return []
  const match = item.params.match(/^ParameterMatcher(\d+):(.+)$/)
  if (!match) return []
  return match[2].split(',').map(c => {
    const m = c.match(/^([\d.]+)(eq|neq|gt|gte|lt|lte)@(\w*)$/)
    if (!m) return null
    return { compareValue: parseFloat(m[1]), op: m[2], varName: m[3] }
  }).filter(Boolean)
}

function serializeParams(conditions) {
  if (!conditions || conditions.length === 0) return ''
  const parts = conditions.map(c => `${c.compareValue}${c.op}@${c.varName}`)
  return `ParameterMatcher${conditions.length}:${parts.join(',')}`
}

function updateTriggerItemParams(ti, si, paramsStr) {
  const key = `${ti}_${si}`
  const idx = selectedPatternIdx[key]
  if (idx == null || idx < 0) return
  const updated = cloneTriggers()
  const trigger = updated[ti].recipe[si].trigger
  if (!trigger[idx]) return
  trigger[idx] = { ...trigger[idx] }
  if (paramsStr) {
    trigger[idx].params = paramsStr
  } else {
    delete trigger[idx].params
  }
  emitUpdate(updated)
}

function addParamsCondition(ti, si) {
  const current = getParamsConditions(ti, si)
  current.push({ compareValue: 0, op: 'gte', varName: '' })
  updateTriggerItemParams(ti, si, serializeParams(current))
}

function removeParamsCondition(ti, si, ci) {
  const current = getParamsConditions(ti, si)
  current.splice(ci, 1)
  updateTriggerItemParams(ti, si, serializeParams(current))
}


function extractVarNames(ti, si) {
  const idx = selectedPatternIdx[`${ti}_${si}`]
  if (idx == null || idx < 0) return []
  const trig = triggers.value[ti]
  if (!trig) return []
  const step = trig.recipe[si]
  if (!step || !step.trigger || !step.trigger[idx]) return []
  const syntax = step.trigger[idx].syntax || ''
  const names = []
  const re = /<<(\w+)>/g
  let m
  while ((m = re.exec(syntax)) !== null) {
    if (!names.includes(m[1])) names.push(m[1])
  }
  return names
}
function updateParamsCondition(ti, si, ci, field, value) {
  const current = getParamsConditions(ti, si)
  if (!current[ci]) return
  current[ci] = { ...current[ci] }
  if (field === 'compareValue') {
    current[ci].compareValue = value === '' ? 0 : parseFloat(value) || 0
  } else {
    current[ci][field] = value
  }
  updateTriggerItemParams(ti, si, serializeParams(current))
}

function isNoEmailChecked(value, option) {
  if (!value) return false
  return value.split(';').map(s => s.trim()).includes(option)
}

function toggleNoEmail(ti, si, target, option) {
  const updated = cloneTriggers()
  const obj = target === 'script' ? updated[ti].recipe[si].script : updated[ti].recipe[si].detail
  const current = (obj['no-email'] || '').split(';').map(s => s.trim()).filter(Boolean)
  const idx = current.indexOf(option)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(option)
  // 순서 보장: success가 항상 먼저
  const ordered = []
  if (current.includes('success')) ordered.push('success')
  if (current.includes('fail')) ordered.push('fail')
  if (target === 'script') {
    updated[ti].recipe[si].script = { ...obj, 'no-email': ordered.join(';') }
  } else {
    updated[ti].recipe[si].detail = { ...obj, 'no-email': ordered.join(';') }
  }
  emitUpdate(updated)
}

function updateLimitation(ti, field, value) {
  const updated = cloneTriggers()
  updated[ti].limitation[field] = value
  emitUpdate(updated)
}

function isScriptTerminal(trig) {
  const lastStep = trig.recipe[trig.recipe.length - 1]
  return lastStep && (lastStep.next === '@script' || lastStep.next === '@Script')
}

function deleteLimitation(ti) {
  const updated = cloneTriggers()
  updated[ti].limitation = null
  emitUpdate(updated)
}

function addLimitation(ti) {
  const updated = cloneTriggers()
  updated[ti].limitation = { times: 1, duration: '1 minutes' }
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

function moveTrigger(ti, direction) {
  const newIdx = ti + direction
  if (newIdx < 0 || newIdx >= triggers.value.length) return
  const updated = cloneTriggers()
  const temp = updated[ti]
  updated[ti] = updated[newIdx]
  updated[newIdx] = temp
  const tempExp = expanded[ti]
  expanded[ti] = expanded[newIdx]
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
  const updated = cloneTriggers()
  const oldExp = {}
  for (let i = 0; i < updated.length; i++) oldExp[i] = !!expanded[i]
  const [item] = updated.splice(fromIdx, 1)
  updated.splice(targetIdx, 0, item)
  const indices = triggers.value.map((_, i) => i)
  const [movedOrig] = indices.splice(fromIdx, 1)
  indices.splice(targetIdx, 0, movedOrig)
  for (let i = 0; i < indices.length; i++) expanded[i] = oldExp[indices[i]]
  emitUpdate(updated)
}

function onDragEnd() {
  draggingIdx.value = -1
  dragOverIdx.value = -1
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
