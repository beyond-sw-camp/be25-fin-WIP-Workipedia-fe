import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getUnreadCount } from '@/api/notificationApi'
import { openNotificationStream } from '@/api/notificationStream'
import { useAuthStore } from '@/stores/authStore'

// 안읽음 배지는 SSE(실시간 푸시)로 갱신한다. (BE: GET /notifications/stream)
// SSE 연결이 끊기면 폴링으로 보조하고, 연결이 복구되면 폴링을 중단한다.
export const useNotificationStore = defineStore('notification', () => {
  const unreadCount = ref(0)

  let source: EventSource | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryDelay = 1000 // 재연결 백오프 (지수, 최대 30초)

  async function refreshUnreadCount() {
    try {
      const res = await getUnreadCount()
      unreadCount.value = res.data.unreadCount
    } catch {
      // 비로그인/네트워크 오류 시 배지를 갱신하지 않는다.
    }
  }

  // SSE 활성화 여부. BE(/notifications/stream) 준비 전에는 false 로 두어
  // 실패하는 SSE 핸드셰이크 없이 폴링만 돌린다. 준비되면 .env 에서 true 로 전환.
  const sseEnabled = import.meta.env.VITE_NOTIFICATION_SSE === 'true'

  // --- 진입점 ---
  function start() {
    if (sseEnabled) connectStream()
    else startPolling()
  }

  // --- SSE (실시간) ---
  function connectStream() {
    const auth = useAuthStore()
    if (!auth.accessToken || source) return

    // 연결 직후 현재 안읽음 개수를 한 번 동기화한다.
    refreshUnreadCount()

    try {
      source = openNotificationStream(auth.accessToken)
    } catch {
      startPolling() // EventSource 미지원 환경 fallback
      return
    }

    source.onopen = () => {
      retryDelay = 1000
      stopPolling() // SSE 가 살아있으면 폴링 불필요
    }

    // 서버가 보내는 알림 이벤트. 'notification' 이름 이벤트와 기본 message 둘 다 처리.
    source.addEventListener('notification', handleEvent)
    source.onmessage = handleEvent

    source.onerror = () => {
      // CONNECTING 상태면 EventSource 가 자동 재연결 중이므로 그대로 둔다.
      // CLOSED 면 연결이 끊긴 것이라 폴링으로 보조하며 백오프 재연결한다.
      if (source && source.readyState === EventSource.CLOSED) {
        teardownSource()
        startPolling()
        scheduleReconnect()
      }
    }
  }

  function stop() {
    teardownSource()
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    stopPolling()
    retryDelay = 1000
  }

  // 알림 이벤트 처리. payload 형식이 확정 전이라 방어적으로 다룬다.
  // { unreadCount } 가 오면 그 값으로, 아니면 서버 재조회로 배지를 갱신한다.
  function handleEvent(e: MessageEvent) {
    try {
      const payload = JSON.parse(e.data)
      if (typeof payload?.unreadCount === 'number') {
        unreadCount.value = payload.unreadCount
        return
      }
    } catch {
      // 본문이 JSON 이 아니면 재조회로 처리
    }
    refreshUnreadCount()
  }

  function scheduleReconnect() {
    if (retryTimer) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      retryDelay = Math.min(retryDelay * 2, 30000)
      connectStream()
    }, retryDelay)
  }

  function teardownSource() {
    if (source) {
      source.close()
      source = null
    }
  }

  // --- 폴링 fallback ---
  function startPolling(intervalMs = 30000) {
    if (pollTimer) return
    refreshUnreadCount()
    pollTimer = setInterval(refreshUnreadCount, intervalMs)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  // 목록 화면에서 읽음 처리 시 서버 재조회 없이 배지를 즉시 반영(낙관적 UI).
  function decrement(by = 1) {
    unreadCount.value = Math.max(0, unreadCount.value - by)
  }

  function reset() {
    unreadCount.value = 0
  }

  return { unreadCount, refreshUnreadCount, start, stop, startPolling, stopPolling, decrement, reset }
})
