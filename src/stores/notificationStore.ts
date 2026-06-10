import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getUnreadCount } from '@/api/notificationApi'

// 실시간 푸시(SSE)는 BE 미정이라 폴링으로 안읽음 배지를 갱신한다.
export const useNotificationStore = defineStore('notification', () => {
  const unreadCount = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  async function refreshUnreadCount() {
    try {
      const res = await getUnreadCount()
      unreadCount.value = res.data.unreadCount
    } catch {
      // 비로그인/네트워크 오류 시 배지를 갱신하지 않는다.
    }
  }

  function startPolling(intervalMs = 30000) {
    if (timer) return
    refreshUnreadCount()
    timer = setInterval(refreshUnreadCount, intervalMs)
  }

  function stopPolling() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  // 목록 화면에서 읽음 처리 시 서버 재조회 없이 배지를 즉시 반영(낙관적 UI).
  function decrement(by = 1) {
    unreadCount.value = Math.max(0, unreadCount.value - by)
  }

  function reset() {
    unreadCount.value = 0
  }

  return { unreadCount, refreshUnreadCount, startPolling, stopPolling, decrement, reset }
})
