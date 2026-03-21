/**
 * Access Logger Composable
 *
 * Vue Router guard + 배치 전송으로 페이지 접근 로그를 수집.
 * - 페이지 진입 시 enterTime 기록
 * - 페이지 이탈 시 leaveTime + durationMs 계산
 * - 30초마다 또는 beforeunload 시 서버로 배치 전송
 * - sendBeacon으로 마지막 페이지 기록 보장
 */

import { ref, onUnmounted } from 'vue'
import api from '@/shared/api'

const FLUSH_INTERVAL_MS = 30_000
const MAX_BUFFER_SIZE = 20

// 모듈 레벨 상태 (싱글톤)
const buffer = ref([])
let currentPage = null
let flushTimer = null
let initialized = false

function startPage(path, name) {
  if (currentPage) {
    endCurrentPage()
  }
  currentPage = {
    pagePath: path,
    pageName: name || path,
    enterTime: new Date().toISOString()
  }
}

function endCurrentPage() {
  if (!currentPage) return

  const now = new Date()
  const enterTime = new Date(currentPage.enterTime)
  const durationMs = now - enterTime

  buffer.value.push({
    ...currentPage,
    leaveTime: now.toISOString(),
    durationMs
  })

  currentPage = null

  // 버퍼가 가득 차면 즉시 전송
  if (buffer.value.length >= MAX_BUFFER_SIZE) {
    flush()
  }
}

function hasAuthToken() {
  return !!localStorage.getItem('token')
}

async function flush() {
  if (buffer.value.length === 0) return
  if (!hasAuthToken()) return // 인증 전이면 스킵

  const logs = [...buffer.value]
  buffer.value = []

  try {
    await api.post('/access-logs', { logs })
  } catch {
    // 실패 시 버퍼에 다시 추가 (최대 크기 초과 시 버림)
    if (buffer.value.length + logs.length <= MAX_BUFFER_SIZE * 2) {
      buffer.value.unshift(...logs)
    }
  }
}

function flushBeacon() {
  endCurrentPage()

  if (buffer.value.length === 0) return
  const token = localStorage.getItem('token')
  if (!token) return // 인증 전이면 스킵

  const logs = [...buffer.value]
  buffer.value = []

  const blob = new Blob(
    [JSON.stringify({ logs, token })],
    { type: 'application/json' }
  )

  const apiUrl = api.defaults.baseURL || '/api'
  navigator.sendBeacon(`${apiUrl}/access-logs`, blob)
}

/**
 * Router에 연결하여 access logging 시작
 * @param {Router} router - Vue Router 인스턴스
 */
export function useAccessLogger(router) {
  if (initialized) return

  initialized = true

  // Router afterEach: 페이지 진입 기록
  router.afterEach((to) => {
    const name = to.meta?.title || to.name || to.path
    startPage(to.path, name)
  })

  // Router beforeEach: 이전 페이지 종료
  router.beforeEach((to, from, next) => {
    endCurrentPage()
    next()
  })

  // 주기적 플러시
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS)

  // beforeunload: sendBeacon으로 마지막 기록 전송
  window.addEventListener('beforeunload', flushBeacon)

  onUnmounted(() => {
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
    window.removeEventListener('beforeunload', flushBeacon)
    initialized = false
  })
}
