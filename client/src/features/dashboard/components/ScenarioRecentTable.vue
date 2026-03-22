<script setup>
const props = defineProps({
  data: { type: Array, default: () => [] }
})

function formatDateTime(kstStr) {
  if (!kstStr) return '-'
  // Format: "yyyy-MM-dd HH:mm:ss" → "yyyy-MM-dd HH:mm"
  return kstStr.length >= 16 ? kstStr.substring(0, 16) : kstStr
}

function timeAgo(kstStr) {
  if (!kstStr) return ''
  // Parse KST string "yyyy-MM-dd HH:mm:ss" as local time
  const parts = kstStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!parts) return ''
  const d = new Date(+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5], +parts[6])
  if (isNaN(d.getTime())) return ''
  // Adjust for KST offset: the string is KST but we parsed as local
  const kstOffset = 9 * 60 // KST = UTC+9
  const localOffset = -d.getTimezoneOffset() // local offset in minutes from UTC
  const diffOffset = (kstOffset - localOffset) * 60000
  const utcMs = d.getTime() - diffOffset
  const diffMs = Date.now() - utcMs
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

// #(4%) 시나리오(24%) 공정(12%) 모델(12%) 이름(12%) ID(12%) 수정시간(24%)
const colWidths = {
  rank: 'w-[4%]',
  scname: 'w-[24%]',
  process: 'w-[12%]',
  model: 'w-[12%]',
  name: 'w-[12%]',
  id: 'w-[12%]',
  time: 'w-[24%]'
}
</script>

<template>
  <div v-if="data.length > 0" class="w-full flex flex-col" style="height: 450px">
    <!-- Fixed header -->
    <table class="w-full text-sm table-fixed">
      <thead>
        <tr class="border-b border-gray-200 dark:border-dark-border">
          <th :class="colWidths.rank" class="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">#</th>
          <th :class="colWidths.scname" class="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">시나리오</th>
          <th :class="colWidths.process" class="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">공정</th>
          <th :class="colWidths.model" class="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">모델</th>
          <th :class="colWidths.name" class="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">이름</th>
          <th :class="colWidths.id" class="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">ID</th>
          <th :class="colWidths.time" class="text-right py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">수정 시간</th>
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
            <td :class="colWidths.scname" class="py-2 px-2 font-medium text-gray-900 dark:text-white truncate" :title="item.scname">{{ item.scname }}</td>
            <td :class="colWidths.process" class="py-2 px-2 text-gray-600 dark:text-gray-300 truncate">{{ item.process || '-' }}</td>
            <td :class="colWidths.model" class="py-2 px-2 text-gray-600 dark:text-gray-300 truncate" :title="item.eqpModel">{{ item.eqpModel || '-' }}</td>
            <td :class="colWidths.name" class="py-2 px-2 font-medium text-gray-900 dark:text-white truncate" :title="item.name || '-'">{{ item.name || '-' }}</td>
            <td :class="colWidths.id" class="py-2 px-2 text-gray-500 dark:text-gray-400 truncate" :title="item.userId">{{ item.userId || '-' }}</td>
            <td :class="colWidths.time" class="py-2 px-2 text-right whitespace-nowrap">
              <span class="text-gray-700 dark:text-gray-300">{{ formatDateTime(item.modifiedAt) }}</span>
              <span class="ml-1 text-xs text-gray-400 dark:text-gray-500">({{ timeAgo(item.modifiedAt) }})</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 450px">
    선택한 기간에 수정된 시나리오가 없습니다
  </div>
</template>
