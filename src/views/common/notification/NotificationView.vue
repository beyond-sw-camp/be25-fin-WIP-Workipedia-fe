<script setup lang="ts">
import { ref } from 'vue'
import { Bell, CheckCircle2, MessageCircle, Ticket, Trophy } from '@lucide/vue'

interface Noti {
  id: number
  kind: 'ticket' | 'worki' | 'point' | 'system'
  title: string
  body: string
  time: string
  read: boolean
}

const notifications = ref<Noti[]>([
  { id: 1, kind: 'worki', title: '내 질문에 답변이 달렸어요', body: '연차 신청은 며칠 전까지 해야 하나요? — 박이화님이 답변했습니다.', time: '방금', read: false },
  { id: 2, kind: 'ticket', title: '티켓 상태가 변경되었어요', body: '노트북 화면 출력 불가 — 처리중으로 변경되었습니다.', time: '1시간 전', read: false },
  { id: 3, kind: 'point', title: '포인트가 적립되었어요', body: '베스트 답변 선정으로 100pt가 적립되었습니다.', time: '어제', read: true },
  { id: 4, kind: 'system', title: '시스템 공지', body: '2025년 6월 정기 점검이 예정되어 있습니다. (6/15 02:00~04:00)', time: '2일 전', read: true },
])

const kindIcon = { ticket: Ticket, worki: MessageCircle, point: Trophy, system: Bell }
const kindColor: Record<string, string> = {
  ticket: '#ff6900', worki: '#7c3aed', point: '#f5c000', system: '#2b7fff',
}

function markRead(id: number) {
  const n = notifications.value.find(n => n.id === id)
  if (n) n.read = true
}

function markAllRead() {
  notifications.value.forEach(n => n.read = true)
}

const unreadCount = ref(() => notifications.value.filter(n => !n.read).length)
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
          <p class="page-sub">읽지 않은 알림 {{ notifications.filter(n => !n.read).length }}개</p>
        </div>
        <button class="btn" @click="markAllRead">모두 읽음</button>
      </div>
    </div>

    <div v-if="notifications.length === 0" class="empty-ph" style="height: 240px;">
      알림이 없습니다
    </div>

    <div v-else class="noti-list">
      <div
        v-for="n in notifications"
        :key="n.id"
        class="card noti-item"
        :class="{ unread: !n.read }"
        @click="markRead(n.id)"
      >
        <div class="noti-icon" :style="{ background: kindColor[n.kind] + '20' }">
          <component :is="kindIcon[n.kind]" :size="18" :color="kindColor[n.kind]" />
        </div>
        <div class="noti-content">
          <div class="noti-title">{{ n.title }}</div>
          <div class="noti-body">{{ n.body }}</div>
          <div class="noti-time">{{ n.time }}</div>
        </div>
        <div v-if="!n.read" class="unread-dot"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.noti-list { display: flex; flex-direction: column; gap: 10px; }
.noti-item { display: flex; align-items: flex-start; gap: 14px; padding: 18px 22px; cursor: pointer; transition: box-shadow 0.15s; position: relative; }
.noti-item:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
.noti-item.unread { background: #f8fbff; }
.noti-icon {
  width: 40px; height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.noti-content { flex: 1; }
.noti-title { font-size: 14.5px; font-weight: 700; color: #1f2430; margin-bottom: 4px; }
.noti-body { font-size: 13.5px; color: #717182; line-height: 1.5; margin-bottom: 6px; }
.noti-time { font-size: 12px; color: #aeb2bb; }
.unread-dot { width: 8px; height: 8px; border-radius: 50%; background: #2b7fff; flex-shrink: 0; margin-top: 6px; }
</style>
