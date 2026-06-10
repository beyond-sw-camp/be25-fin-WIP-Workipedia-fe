<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, MessageCircle, Ticket, Trophy, Trash2 } from '@lucide/vue'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/api/notificationApi'
import { useNotificationStore } from '@/stores/notificationStore'
import type { NotificationResponse, NotificationType } from '@/types/notification'

const router = useRouter()
const notiStore = useNotificationStore()

const PAGE_SIZE = 20
const items = ref<NotificationResponse[]>([])
const page = ref(0) // Pageable 기반(0-based)
const hasNext = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')

type Kind = 'ticket' | 'worki' | 'point' | 'system'

function kindOf(type: NotificationType): Kind {
  switch (type) {
    case 'WORKI_ANSWER_CREATED':
    case 'WORKI_ANSWER_ACCEPTED':
      return 'worki'
    case 'TICKET_STATUS_CHANGED':
    case 'TICKET_TRANSFER_REQUESTED':
    case 'COMMON_QUEUE_ASSIGNED':
      return 'ticket'
    case 'POINT_EARNED':
      return 'point'
    default:
      return 'system'
  }
}

const kindIcon = { ticket: Ticket, worki: MessageCircle, point: Trophy, system: Bell }
const kindColor: Record<Kind, string> = {
  ticket: '#ff6900', worki: '#7c3aed', point: '#f5c000', system: '#2b7fff',
}

const unreadCount = computed(() => items.value.filter((n) => !n.readAt).length)

function timeAgo(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

async function fetchPage(pageNum: number, append: boolean) {
  if (append) loadingMore.value = true
  else loading.value = true
  error.value = ''
  try {
    const res = await getNotifications({ page: pageNum, size: PAGE_SIZE })
    items.value = append ? [...items.value, ...res.data.content] : res.data.content
    hasNext.value = res.data.pageInfo.hasNext
    page.value = pageNum
  } catch {
    error.value = '알림을 불러오지 못했습니다.'
  } finally {
    if (append) loadingMore.value = false
    else loading.value = false
  }
}

function loadMore() {
  if (loading.value || loadingMore.value || !hasNext.value) return
  fetchPage(page.value + 1, true)
}

async function onClick(n: NotificationResponse) {
  if (!n.readAt) {
    try {
      await markNotificationRead(n.notificationId)
      n.readAt = new Date().toISOString()
      notiStore.decrement()
    } catch {
      // 읽음 처리 실패는 무시하고 이동만 진행
    }
  }
  if (n.targetUrl) router.push(n.targetUrl)
}

async function markAllRead() {
  try {
    await markAllNotificationsRead()
    const now = new Date().toISOString()
    items.value.forEach((n) => {
      if (!n.readAt) n.readAt = now
    })
    notiStore.reset()
  } catch {
    error.value = '모두 읽음 처리에 실패했습니다.'
  }
}

async function remove(n: NotificationResponse, e: Event) {
  e.stopPropagation()
  try {
    await deleteNotification(n.notificationId)
    const wasUnread = !n.readAt
    items.value = items.value.filter((x) => x.notificationId !== n.notificationId)
    if (wasUnread) notiStore.decrement()
  } catch {
    error.value = '삭제에 실패했습니다.'
  }
}

onMounted(() => fetchPage(0, false))
</script>

<template>
  <div class="content-inner" style="max-width: 760px;">
    <div class="page-head">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h1 class="page-title">
            <Bell :size="28" color="#2b7fff" />
            알림
          </h1>
          <p class="page-sub">읽지 않은 알림 {{ unreadCount }}개</p>
        </div>
        <button class="btn" :disabled="unreadCount === 0" @click="markAllRead">모두 읽음</button>
      </div>
    </div>

    <div v-if="loading && items.length === 0" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="error && items.length === 0" class="empty-ph" style="height: 240px;">{{ error }}</div>
    <div v-else-if="items.length === 0" class="empty-ph" style="height: 240px;">알림이 없습니다</div>

    <div v-else class="noti-list">
      <div
        v-for="n in items"
        :key="n.notificationId"
        class="card noti-item"
        :class="{ unread: !n.readAt }"
        @click="onClick(n)"
      >
        <div class="noti-icon" :style="{ background: kindColor[kindOf(n.type)] + '20' }">
          <component :is="kindIcon[kindOf(n.type)]" :size="18" :color="kindColor[kindOf(n.type)]" />
        </div>
        <div class="noti-content">
          <div class="noti-title">{{ n.title }}</div>
          <div class="noti-body">{{ n.message }}</div>
          <div class="noti-time">{{ timeAgo(n.createdAt) }}</div>
        </div>
        <div v-if="!n.readAt" class="unread-dot"></div>
        <button class="noti-del" title="삭제" @click="remove(n, $event)">
          <Trash2 :size="15" />
        </button>
      </div>

      <div v-if="hasNext" class="load-more">
        <button class="btn" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? '불러오는 중...' : '더 보기' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.noti-list { display: flex; flex-direction: column; gap: 10px; }
.noti-item { display: flex; align-items: flex-start; gap: 14px; padding: 18px 22px; cursor: pointer; transition: box-shadow 0.15s; position: relative; }
.noti-item:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
.noti-item:hover .noti-del { opacity: 1; }
.noti-item.unread { background: #f8fbff; }
.noti-icon {
  width: 40px; height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.noti-content { flex: 1; min-width: 0; }
.noti-title { font-size: 14.5px; font-weight: 700; color: #1f2430; margin-bottom: 4px; }
.noti-body { font-size: 13.5px; color: #717182; line-height: 1.5; margin-bottom: 6px; }
.noti-time { font-size: 12px; color: #aeb2bb; }
.unread-dot { width: 8px; height: 8px; border-radius: 50%; background: #2b7fff; flex-shrink: 0; margin-top: 6px; }
.noti-del {
  background: none; border: none; color: #cbd0d8; cursor: pointer;
  padding: 4px; opacity: 0; transition: opacity 0.12s, color 0.12s; flex-shrink: 0;
}
.noti-del:hover { color: #ef4444; }
.load-more { text-align: center; padding: 8px; }
</style>
