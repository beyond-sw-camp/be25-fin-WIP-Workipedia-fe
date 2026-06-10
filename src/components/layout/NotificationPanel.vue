<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getNotifications, markNotificationRead } from '@/api/notificationApi'
import { useNotificationStore } from '@/stores/notificationStore'
import type { NotificationResponse } from '@/types/notification'

const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const notiStore = useNotificationStore()

const items = ref<NotificationResponse[]>([])
const loading = ref(false)
const error = ref('')

function timeAgo(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return `${Math.floor(hr / 24)}일 전`
}

async function onClick(n: NotificationResponse) {
  if (!n.readAt) {
    try {
      await markNotificationRead(n.notificationId)
      n.readAt = new Date().toISOString()
      notiStore.decrement()
    } catch {
      /* 무시 */
    }
  }
  emit('close')
  if (n.targetUrl) router.push(n.targetUrl)
}

function goAll() {
  emit('close')
  router.push('/notifications')
}

onMounted(async () => {
  loading.value = true
  try {
    const res = await getNotifications({ page: 0, size: 10 })
    items.value = res.data.content
  } catch {
    error.value = '알림을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">알림</span>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>

    <div class="panel-body">
      <div v-if="loading" class="panel-msg">불러오는 중...</div>
      <div v-else-if="error" class="panel-msg">{{ error }}</div>
      <div v-else-if="items.length === 0" class="panel-msg">알림이 없습니다</div>
      <ul v-else class="noti-ul">
        <li
          v-for="n in items"
          :key="n.notificationId"
          class="noti-li"
          :class="{ unread: !n.readAt }"
          @click="onClick(n)"
        >
          <div class="noti-li-title">{{ n.title }}</div>
          <div class="noti-li-msg">{{ n.message }}</div>
          <div class="noti-li-time">{{ timeAgo(n.createdAt) }}</div>
        </li>
      </ul>
    </div>

    <button class="panel-footer" @click="goAll">전체 알림 보기</button>
  </div>
</template>

<style scoped>
.panel {
  position: fixed;
  left: var(--sidebar-width);
  top: 0;
  width: 320px;
  height: 100vh;
  background: #fff;
  box-shadow: 4px 0 16px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
}

.panel-title { font-size: 1rem; font-weight: 700; color: #1e293b; }

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.9rem;
}

.panel-body { flex: 1; overflow-y: auto; }
.panel-msg { padding: 2rem 1.25rem; text-align: center; color: #94a3b8; font-size: 0.85rem; }

.noti-ul { list-style: none; margin: 0; padding: 0; }
.noti-li {
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.12s;
}
.noti-li:hover { background: #f8fafc; }
.noti-li.unread { background: #f8fbff; }
.noti-li-title { font-size: 0.85rem; font-weight: 700; color: #1e293b; margin-bottom: 2px; }
.noti-li-msg { font-size: 0.8rem; color: #64748b; line-height: 1.4; margin-bottom: 4px; }
.noti-li-time { font-size: 0.7rem; color: #aeb2bb; }

.panel-footer {
  border: none;
  border-top: 1px solid #f1f5f9;
  background: #fff;
  padding: 0.9rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #2b7fff;
  cursor: pointer;
}
.panel-footer:hover { background: #f8fafc; }
</style>
