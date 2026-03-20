<script setup>
const props = defineProps({
  data: { type: Array, default: () => [] }
})

function formatDateTime(isoStr) {
  if (!isoStr) return '-'
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
  <div v-if="data.length > 0" class="w-full flex flex-col" style="height: 450px">
    <!-- Fixed header -->
    <table class="w-full text-sm table-fixed">
      <thead>
        <tr class="border-b border-gray-200 dark:border-dark-border">
          <th class="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-8">#</th>
          <th class="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">이름</th>
          <th class="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">ID</th>
          <th class="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">공정</th>
          <th class="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-16">횟수</th>
          <th class="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">마지막 실행</th>
        </tr>
      </thead>
    </table>
    <!-- Scrollable body -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <table class="w-full text-sm table-fixed">
        <tbody>
          <tr
            v-for="(user, idx) in data"
            :key="user.singleid"
            class="border-b border-gray-100 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-dark-border/30 transition-colors"
          >
            <td class="py-2 px-3 text-gray-400 dark:text-gray-500 w-8">{{ idx + 1 }}</td>
            <td class="py-2 px-3 font-medium text-gray-900 dark:text-white truncate">{{ user.name }}</td>
            <td class="py-2 px-3 text-gray-500 dark:text-gray-400 truncate">{{ user.singleid }}</td>
            <td class="py-2 px-3 text-gray-600 dark:text-gray-300 truncate">{{ user.process || '-' }}</td>
            <td class="py-2 px-3 text-right text-gray-700 dark:text-gray-300 w-16">{{ user.accessnum?.toLocaleString() }}</td>
            <td class="py-2 px-3 text-right whitespace-nowrap">
              <span class="text-gray-700 dark:text-gray-300">{{ formatDateTime(user.latestExecution) }}</span>
              <span class="ml-1 text-xs text-gray-400 dark:text-gray-500">({{ timeAgo(user.latestExecution) }})</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 450px">
    데이터가 없습니다
  </div>
</template>
