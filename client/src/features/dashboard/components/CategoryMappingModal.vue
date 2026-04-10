<script setup>
import { ref, watch } from 'vue'
import { recoveryApi } from '../../../shared/api'
import { useToast } from '../../../shared/composables/useToast'

const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible', 'saved'])

const { showSuccess, showError } = useToast()

const loading = ref(false)
const saving = ref(false)
const rows = ref([])

async function loadData() {
  loading.value = true
  try {
    const [mapRes, scRes] = await Promise.all([
      recoveryApi.getCategoryMap(),
      recoveryApi.getScCategories()
    ])
    const nameMap = {}
    for (const m of (mapRes.data?.data || [])) {
      nameMap[m.scCategory] = { categoryName: m.categoryName, description: m.description || '' }
    }
    const scCategories = (scRes.data?.data || []).sort((a, b) => a - b)
    rows.value = scCategories.map(sc => ({
      scCategory: sc,
      categoryName: nameMap[sc]?.categoryName || '',
      description: nameMap[sc]?.description || '',
      hasName: !!nameMap[sc]?.categoryName
    }))
  } catch {
    showError('카테고리 데이터 로드에 실패했습니다')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  const items = rows.value
    .filter(r => r.categoryName.trim())
    .map(r => ({ scCategory: r.scCategory, categoryName: r.categoryName.trim(), description: r.description.trim() }))
  if (items.length === 0) {
    showError('저장할 카테고리명이 없습니다')
    return
  }
  saving.value = true
  try {
    await recoveryApi.upsertCategoryMap({ items })
    showSuccess(`${items.length}개 카테고리가 저장되었습니다`)
    emit('saved')
    emit('update:visible', false)
  } catch {
    showError('저장에 실패했습니다')
  } finally {
    saving.value = false
  }
}

function close() {
  emit('update:visible', false)
}

watch(() => props.visible, (v) => {
  if (v) loadData()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="close">
      <div class="bg-white dark:bg-dark-card rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border w-full max-w-2xl max-h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Scenario Category Mapping</h2>
          <button @click="close" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
            SC_PROPERTY에서 사용 중인 scCategory 번호에 이름을 지정합니다.
          </p>

          <div v-if="loading" class="flex items-center justify-center py-10">
            <svg class="animate-spin w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>

          <div v-else-if="rows.length === 0" class="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
            SC_PROPERTY에 scCategory 데이터가 없습니다
          </div>

          <table v-else class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-dark-border text-left">
                <th class="py-2 px-2 w-20 font-semibold text-gray-600 dark:text-gray-400">Code</th>
                <th class="py-2 px-2 font-semibold text-gray-600 dark:text-gray-400">Category Name</th>
                <th class="py-2 px-2 font-semibold text-gray-600 dark:text-gray-400">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.scCategory"
                  class="border-b border-gray-100 dark:border-gray-700/50"
                  :class="{ 'bg-amber-50 dark:bg-amber-900/10': !row.categoryName.trim() }">
                <td class="py-1.5 px-2 text-gray-700 dark:text-gray-300 font-mono">{{ row.scCategory }}</td>
                <td class="py-1.5 px-2">
                  <input
                    v-model="row.categoryName"
                    class="w-full px-2 py-1 text-sm rounded border bg-transparent
                           border-gray-300 dark:border-gray-600
                           text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter category name"
                  />
                </td>
                <td class="py-1.5 px-2">
                  <input
                    v-model="row.description"
                    class="w-full px-2 py-1 text-sm rounded border bg-transparent
                           border-gray-300 dark:border-gray-600
                           text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Optional description"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-dark-border">
          <button @click="close"
                  class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600
                         text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button @click="handleSave" :disabled="saving"
                  class="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
