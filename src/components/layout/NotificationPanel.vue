<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { X } from '@lucide/vue'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/api/notificationApi'
import { useNotificationStore } from '@/stores/notificationStore'
import type { NotificationResponse, NotificationType } from '@/types/notification'

const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const notiStore = useNotificationStore()

const items = ref<NotificationResponse[]>([])
const loading = ref(false)
const error = ref('')

type Tab = 'all' | 'ticket' | 'worki' | 'manual'
const activeTab = ref<Tab>('all')

// 카테고리는 티켓/게시판/매뉴얼 3가지만 존재한다.
// 매핑되지 않는 타입은 null을 반환해 배지를 숨기고 전체 탭에서만 노출한다.
// DIRECT_DATA_ACTIVATED는 null을 반환해 '매뉴얼' 탭에 포함되지 않고 전체 탭에서만 보인다.
type Kind = 'ticket' | 'worki' | 'manual'
function kindOf(type: NotificationType): Kind | null {
  switch (type) {
    case 'WORKI_QUESTION_CREATED':
    case 'WORKI_QUESTION_ANSWERED':
    case 'WORKI_ANSWER_ACCEPTED':
      return 'worki'
    case 'TICKET_ASSIGNED':
    case 'TICKET_REASSIGNED':
    case 'TICKET_COMPLETED':
    case 'TICKET_DELETED':
      return 'ticket'
    case 'MANUAL_UPDATED':
      return 'manual'
    default:
      return null
  }
}

const kindLabel: Record<Kind, string> = {
  ticket: '티켓', worki: '게시판', manual: '매뉴얼',
}

// 배지 표시용 — kindOf와 별개로 DIRECT_DATA_ACTIVATED에 '수기 지식' 배지를 달아준다.
function badgeOf(type: NotificationType): { label: string; cls: string } | null {
  if (type === 'DIRECT_DATA_ACTIVATED') return { label: '수기 지식', cls: 'badge-direct-data' }
  const k = kindOf(type)
  return k ? { label: kindLabel[k], cls: `badge-${k}` } : null
}

// null-kind 항목은 카테고리 탭에 속하지 않아 전체 탭에서만 표시된다.
const filteredItems = computed(() => {
  if (activeTab.value === 'all') return items.value
  return items.value.filter((n) => kindOf(n.type) === activeTab.value)
})

const hasUnread = computed(() => items.value.some((n) => !n.readAt))

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

// 읽음 처리 실패 시에도 패널을 닫고 이동은 항상 진행한다 — 사용자 흐름이 끊기지 않도록.
// notiStore.decrement()로 헤더 배지를 서버 재조회 없이 즉시 갱신한다(낙관적 UI).
async function onClick(n: NotificationResponse) {
  if (!n.readAt) {
    try {
      await markNotificationRead(n.notificationId)
      n.readAt = new Date().toISOString()
      notiStore.decrement()
    } catch { /* 무시 */ }
  }
  emit('close')
  if (n.targetUrl) router.push(n.targetUrl)
}

// 낙관적 업데이트: API 성공 전에 로컬 readAt을 채우고 배지를 0으로 초기화한다.
async function markAllRead() {
  try {
    await markAllNotificationsRead()
    const now = new Date().toISOString()
    items.value.forEach((n) => { if (!n.readAt) n.readAt = now })
    notiStore.reset()
  } catch { /* 무시 */ }
}

// e.stopPropagation(): 부모 li의 onClick(읽음 처리 + 이동)이 함께 실행되지 않도록 차단한다.
async function remove(n: NotificationResponse, e: Event) {
  e.stopPropagation()
  try {
    await deleteNotification(n.notificationId)
    const wasUnread = !n.readAt
    items.value = items.value.filter((x) => x.notificationId !== n.notificationId)
    if (wasUnread) notiStore.decrement()
  } catch { /* 무시 */ }
}

// BE가 내려주는 title 대신 FE 기준 제목으로 통일한다.
// map에 없는 타입은 n.title(BE 원본)이 그대로 표시된다.
const NOTIFICATION_TITLES: Partial<Record<NotificationType, string>> = {
  TICKET_ASSIGNED: '티켓 부서가 배정되었습니다',
  TICKET_REASSIGNED: '티켓 담당 부서가 재배정되었습니다',
  TICKET_COMPLETED: '티켓 답변이 완료되었습니다',
  TICKET_DELETED: '티켓이 삭제되었습니다',
  WORKI_QUESTION_CREATED: '워키 질문이 등록되었습니다',
  WORKI_QUESTION_ANSWERED: '워키 답변이 등록되었습니다',
  WORKI_ANSWER_ACCEPTED: '워키 답변이 채택되었습니다',
  MANUAL_UPDATED: '매뉴얼이 업데이트되었습니다',
  DIRECT_DATA_ACTIVATED: '수기 지식이 등록되었습니다',
}

function titleOf(n: NotificationResponse): string {
  return NOTIFICATION_TITLES[n.type] ?? n.title
}

// 패널은 미리보기 용도이므로 최신 20개만 로드한다. 페이지네이션 없음.
onMounted(async () => {
  loading.value = true
  try {
    const res = await getNotifications({ page: 0, size: 20 })
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
      <div class="header-actions">
        <button
          class="mark-all-btn"
          :disabled="!hasUnread"
          @click="markAllRead"
        >모두 읽음</button>
        <button class="close-btn" @click="emit('close')"><X :size="16" /></button>
      </div>
    </div>

    <div class="panel-tabs">
      <button
        v-for="t in (['all', 'ticket', 'worki', 'manual'] as Tab[])"
        :key="t"
        class="tab-btn"
        :class="{ active: activeTab === t }"
        @click="activeTab = t"
      >
        {{ t === 'all' ? '전체' : t === 'ticket' ? '티켓' : t === 'worki' ? '게시판' : '매뉴얼' }}
      </button>
    </div>

    <div class="panel-body">
      <div v-if="loading" class="panel-msg">불러오는 중...</div>
      <div v-else-if="error" class="panel-msg">{{ error }}</div>
      <div v-else-if="filteredItems.length === 0" class="panel-msg">알림이 없습니다</div>
      <ul v-else class="noti-ul">
        <li
          v-for="n in filteredItems"
          :key="n.notificationId"
          class="noti-li"
          :class="{ unread: !n.readAt }"
          @click="onClick(n)"
        >
          <div class="noti-li-content">
            <div class="noti-li-meta">
              <span v-if="badgeOf(n.type)" class="kind-badge" :class="badgeOf(n.type)!.cls">
                {{ badgeOf(n.type)!.label }}
              </span>
              <div v-if="!n.readAt" class="unread-dot"></div>
            </div>
            <div class="noti-li-title">{{ titleOf(n) }}</div>
            <div class="noti-li-msg">{{ n.message }}</div>
            <div class="noti-li-time">{{ timeAgo(n.createdAt) }}</div>
          </div>
          <button class="del-btn" title="삭제" @click="remove(n, $event)">
            <X :size="12" />
          </button>
        </li>
      </ul>
    </div>

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
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.panel-title { font-size: 1rem; font-weight: 700; color: #1e293b; }

.header-actions { display: flex; align-items: center; gap: 6px; }

.mark-all-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.1s;
}
.mark-all-btn:hover:not(:disabled) { background: #f1f5f9; color: #334155; }
.mark-all-btn:disabled { color: #cbd0d8; cursor: default; }

.close-btn {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.1s;
}
.close-btn:hover { background: #f1f5f9; color: #475569; }

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  padding: 0.6rem 0;
  font-size: 0.8rem;
  font-weight: 500;
  color: #94a3b8;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
}
.tab-btn.active { color: #2b7fff; border-bottom-color: #2b7fff; font-weight: 700; }
.tab-btn:hover:not(.active) { color: #475569; }

.panel-body { flex: 1; overflow-y: auto; }
.panel-msg { padding: 2rem 1.25rem; text-align: center; color: #94a3b8; font-size: 0.85rem; }

.noti-ul { list-style: none; margin: 0; padding: 0; }
.noti-li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 0.85rem 1rem 0.85rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.12s;
  position: relative;
}
.noti-li:hover { background: #f8fafc; }
.noti-li.unread { background: #fff9ef; }
.noti-li:hover .del-btn { opacity: 1; }

.noti-li-content { flex: 1; min-width: 0; }

.noti-li-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}

/* 카테고리 배지 */
.kind-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 99px;
}
.badge-ticket      { background: #e0f2fe; color: #0369a1; }
.badge-worki       { background: #ede9fe; color: #7c3aed; }
.badge-manual      { background: #fee2e2; color: #dc2626; }
.badge-direct-data { background: #ecfdf5; color: #059669; }

.unread-dot { width: 7px; height: 7px; border-radius: 50%; background: #ff6900; flex-shrink: 0; }

.noti-li-title { font-size: 0.85rem; font-weight: 700; color: #1e293b; margin-bottom: 2px; }
.noti-li-msg { font-size: 0.8rem; color: #64748b; line-height: 1.4; margin-bottom: 4px; }
.noti-li-time { font-size: 0.7rem; color: #aeb2bb; }

/* 개별 삭제 버튼 — 호버 시에만 표시 */
.del-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  color: #cbd0d8;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.12s, color 0.12s, background 0.12s;
  margin-top: 2px;
}
.del-btn:hover { color: #ef4444; background: #fee2e2; }
</style>
