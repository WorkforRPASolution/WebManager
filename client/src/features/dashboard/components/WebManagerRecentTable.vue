<script setup>
const props = defineProps({
  data: { type: Array, default: () => [] }
})

function formatDuration(ms) {
  if (!ms || ms <= 0) return '-'
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}m ${sec}s`
}

function formatDateTime(dt) {
  if (!dt) return '-'
  const d = new Date(dt)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  })
}

function timeAgo(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  if (isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 0) return ''
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

// #(5%) 이름(13%) ID(14%) 페이지(25%) 체류시간(13%) 접속시간(30%)
const colWidths = {
  rank: 'w-[5%]',
  name: 'w-[13%]',
  id: 'w-[14%]',
  page: 'w-[25%]',
  duration: 'w-[13%]',
  time: 'w-[30%]'
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
          <th :class="colWidths.page" class="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">페이지</th>
          <th :class="colWidths.duration" class="text-right py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">체류</th>
          <th :class="colWidths.time" class="text-right py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">접속 시간</th>
        </tr>
      </thead>
    </table>
    <!-- Scrollable body -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <table class="w-full text-sm table-fixed">
        <tbody>
          <tr
            v-for="(item, idx) in data"
            :key="idx"
            class="border-b border-gray-100 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-dark-border/30 transition-colors"
          >
            <td :class="colWidths.rank" class="py-2 px-2 text-gray-400 dark:text-gray-500">{{ idx + 1 }}</td>
            <td :class="colWidths.name" class="py-2 px-2 font-medium text-gray-900 dark:text-white truncate" :title="item.name || '-'">{{ item.name || '-' }}</td>
            <td :class="colWidths.id" class="py-2 px-2 text-gray-500 dark:text-gray-400 truncate" :title="item.userId">{{ item.userId }}</td>
            <td :class="colWidths.page" class="py-2 px-2 text-gray-600 dark:text-gray-300 truncate" :title="item.pageName || item.pagePath">{{ item.pageName || item.pagePath }}</td>
            <td :class="colWidths.duration" class="py-2 px-2 text-right text-gray-500 dark:text-gray-400">{{ formatDuration(item.durationMs) }}</td>
            <td :class="colWidths.time" class="py-2 px-2 text-right whitespace-nowrap">
              <span class="text-gray-700 dark:text-gray-300">{{ formatDateTime(item.enterTime) }}</span>
              <span class="ml-1 text-xs text-gray-400 dark:text-gray-500">({{ timeAgo(item.enterTime) }})</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 450px">
    선택한 기간에 접속 이력이 없습니다
  </div>
</template>
