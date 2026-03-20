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

// #(5%) 이름(15%) ID(20%) 공정(25%) 횟수(10%) 마지막실행(25%)
const colWidths = {
  rank: 'w-[5%]',
  name: 'w-[15%]',
  id: 'w-[20%]',
  process: 'w-[25%]',
  count: 'w-[10%]',
  lastExec: 'w-[25%]'
}
</script>

<template>
  <div v-if="data.length > 0" class="w-full flex flex-col" style="height: 450px">
    <!-- Fixed header -->
    <table class="w-full text-sm table-fixed">
      <thead>
        <tr class="border-b border-gray-200 dark:border-dark-border">
          <th :class="colWidths.rank" class="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">#</th>
          <th :class="colWidths.name" class="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">이름</th>
          <th :class="colWidths.id" class="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">ID</th>
          <th :class="colWidths.process" class="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">공정</th>
          <th :class="colWidths.count" class="text-right py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">횟수</th>
          <th :class="colWidths.lastExec" class="text-right py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">마지막 실행</th>
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
            <td :class="colWidths.rank" class="py-2 px-2 text-gray-400 dark:text-gray-500">{{ idx + 1 }}</td>
            <td :class="colWidths.name" class="py-2 px-2 font-medium text-gray-900 dark:text-white truncate" :title="user.name">{{ user.name }}</td>
            <td :class="colWidths.id" class="py-2 px-2 text-gray-500 dark:text-gray-400 truncate" :title="user.singleid">{{ user.singleid }}</td>
            <td :class="colWidths.process" class="py-2 px-2 text-gray-600 dark:text-gray-300 truncate" :title="user.process || '-'">{{ user.process || '-' }}</td>
            <td :class="colWidths.count" class="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{{ user.accessnum?.toLocaleString() }}</td>
            <td :class="colWidths.lastExec" class="py-2 px-2 text-right whitespace-nowrap">
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
