<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] }
})

function formatDateTime(isoStr) {
  if (!isoStr) return '-'
  // "2026-03-15T10:00:00.000+09:00" → "2026-03-15 10:00"
  const m = isoStr.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  if (m) return `${m[1]} ${m[2]}`
  return isoStr
}

function timeAgo(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}시간 전`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 30) return `${diffDays}일 전`
  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths}개월 전`
}
</script>

<template>
  <div class="w-full overflow-x-auto">
    <table v-if="data.length > 0" class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-200 dark:border-dark-border">
          <th class="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">#</th>
          <th class="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">이름</th>
          <th class="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">ID</th>
          <th class="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">공정</th>
          <th class="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">실행 횟수</th>
          <th class="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">마지막 실행</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(user, idx) in data"
          :key="user.singleid"
          class="border-b border-gray-100 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-dark-border/30 transition-colors"
        >
          <td class="py-2 px-3 text-gray-400 dark:text-gray-500">{{ idx + 1 }}</td>
          <td class="py-2 px-3 font-medium text-gray-900 dark:text-white">{{ user.name }}</td>
          <td class="py-2 px-3 text-gray-500 dark:text-gray-400">{{ user.singleid }}</td>
          <td class="py-2 px-3 text-gray-600 dark:text-gray-300">{{ user.process || '-' }}</td>
          <td class="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{{ user.accessnum?.toLocaleString() }}</td>
          <td class="py-2 px-3 text-right">
            <span class="text-gray-700 dark:text-gray-300">{{ formatDateTime(user.latestExecution) }}</span>
            <span class="ml-1.5 text-xs text-gray-400 dark:text-gray-500">({{ timeAgo(user.latestExecution) }})</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm py-10">
      데이터가 없습니다
    </div>
  </div>
</template>
