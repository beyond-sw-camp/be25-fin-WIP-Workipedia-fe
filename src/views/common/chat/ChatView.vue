<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useAuthStore } from '@/stores/authStore'
import MessageComposer from '@/components/common/MessageComposer.vue'
import { getActiveMessages } from '@/api/chatApi'
import type { FlashChatMessageResponse } from '@/types/chat'

const auth = useAuthStore()

interface ReplyRef {
  id: string
  name: string | null
  content: string | null
}

interface ChatMsg {
  id: string
  userId: number
  me: boolean
  name: string
  initial: string
  content: string
  createdAt: string
  expiresAt: string
  replyTo?: ReplyRef | null
}

// 30초마다 갱신되어 "방금" → 실제 시간 전환을 트리거
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval>

// 메시지별 삭제 타이머 (id → timeoutHandle)
const timeouts = new Map<string, ReturnType<typeof setTimeout>>()

const msgs = ref<ChatMsg[]>([])

function scheduleDelete(msg: ChatMsg) {
  const delay = new Date(msg.expiresAt).getTime() - Date.now()
  if (delay <= 0) {
    msgs.value = msgs.value.filter(m => m.id !== msg.id)
    return
  }
  const handle = setTimeout(() => {
    msgs.value = msgs.value.filter(m => m.id !== msg.id)
    timeouts.delete(msg.id)
  }, delay)
  timeouts.set(msg.id, handle)
}

// STOMP 클라이언트
let stompClient: Client | null = null

function connectStomp() {
  stompClient = new Client({
    webSocketFactory: () => new SockJS(`${new URL(import.meta.env.VITE_API_BASE_URL).origin}/ws/flash-chat`),
    beforeConnect: async () => {
      stompClient!.connectHeaders = { Authorization: `Bearer ${auth.accessToken}` }
    },
    onConnect: () => {
      stompClient!.subscribe('/topic/flash-chat', (frame) => {
        const raw = JSON.parse(frame.body)

        if (raw.type === 'DELETE') {
          clearTimeout(timeouts.get(raw.id))
          timeouts.delete(raw.id)
          msgs.value = msgs.value.filter(m => m.id !== raw.id)
          return
        }

        const original = raw.replyToId ? msgs.value.find(m => m.id === raw.replyToId) : null
        const msg: ChatMsg = {
          ...raw,
          name: raw.nickname,
          me: raw.userId === auth.userId,
          initial: (raw.nickname as string).slice(0, 1),
          replyTo: raw.replyToId
            ? { id: raw.replyToId, name: original?.name ?? null, content: original?.content ?? null }
            : null,
        }
        msgs.value.push(msg)
        scheduleDelete(msg)
        scroll()
      })
    },
  })
  stompClient.activate()
}

onMounted(async () => {
  ticker = setInterval(() => { now.value = Date.now() }, 30_000)

  try {
    const res = await getActiveMessages()
    msgs.value = res.data.messages.map((raw: FlashChatMessageResponse) => {
      const original = raw.replyToId ? res.data.messages.find(m => m.id === raw.replyToId) : null
      return {
        ...raw,
        name: raw.nickname,
        initial: raw.nickname.slice(0, 1),
        me: raw.userId === auth.userId,
        replyTo: raw.replyToId
          ? { id: raw.replyToId, name: original?.nickname ?? null, content: original?.content ?? null }
          : null,
      }
    })
    msgs.value.forEach(scheduleDelete)
  } catch {
    // 초기 로드 실패해도 실시간 연결은 유지
  }

  connectStomp()
  scroll()
})

onUnmounted(() => {
  clearInterval(ticker)
  timeouts.forEach(h => clearTimeout(h))
  timeouts.clear()
  stompClient?.deactivate()
})

function formatTime(createdAt: string): string {
  const ts = new Date(createdAt).getTime()
  if (now.value - ts < 60_000) return '방금'
  const d = new Date(createdAt)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`
}

const scrollEl = ref<HTMLElement | null>(null)
const val = ref('')
const replyTo = ref<ChatMsg | null>(null)
const highlightedId = ref<string | null>(null)

const scroll = () =>
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  })

function send() {
  const content = val.value.trim()
  if (!content) return
  const replyToId = replyTo.value?.id ?? null
  val.value = ''
  replyTo.value = null
  stompClient?.publish({
    destination: '/app/flash-chat/send',
    body: JSON.stringify({ content, replyToId }),
  })
}

function startReply(msg: ChatMsg) {
  replyTo.value = msg
}

function originalExists(id: string): boolean {
  return msgs.value.some(m => m.id === id)
}

function scrollToMessage(id: string) {
  if (!msgs.value.some(m => m.id === id)) return
  const el = scrollEl.value?.querySelector(`[data-msg-id="${id}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  highlightedId.value = id
  setTimeout(() => { highlightedId.value = null }, 1500)
}

function isContinuation(i: number): boolean {
  if (i === 0) return false
  const cur = msgs.value[i]
  const prev = msgs.value[i - 1]
  if (!cur || !prev) return false
  return cur.userId === prev.userId
}
</script>

<template>
  <div class="chat-page">
    <div ref="scrollEl" class="chat-scroll">
      <div class="chat-inner">
        <div v-for="(m, i) in msgs" :key="m.id" :data-msg-id="m.id" class="chat-row" :class="{ 'chat-row--me': m.me, 'chat-row--cont': isContinuation(i), 'chat-row--highlight': m.id === highlightedId }">
          <span class="chat-av chat-av--text" :class="{ 'chat-av--hidden': isContinuation(i) }">{{ m.initial }}</span>
          <div class="chat-content" :class="{ 'chat-content--me': m.me }">
            <div v-if="!isContinuation(i)" class="chat-meta">{{ m.name }}</div>
            <div class="msg-stack" :class="{ 'msg-stack--me': m.me }">
              <template v-if="m.replyTo">
                <div
                  class="reply-quote"
                  :class="{
                    'reply-quote--me': m.me,
                    'reply-quote--clickable': originalExists(m.replyTo!.id),
                  }"
                  @click="originalExists(m.replyTo!.id) && scrollToMessage(m.replyTo.id)"
                >
                  <span v-if="m.replyTo.name" class="reply-name">{{ m.replyTo.name }}</span>
                  <span class="reply-text">{{ m.replyTo.name ? m.replyTo.content : '삭제된 메시지입니다' }}</span>
                </div>
              </template>
              <div class="bubble-row" :class="{ 'bubble-row--me': m.me }">
                <div class="chat-bubble" :class="{ 'chat-bubble--me': m.me, 'chat-bubble--chained': m.replyTo }">{{ m.content }}</div>
                <div class="bubble-side">
                  <div class="chat-time">{{ formatTime(m.createdAt) }}</div>
                  <button class="reply-btn" @click="startReply(m)">↩</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="replyTo" class="reply-bar">
      <div class="reply-bar-inner">
        <span class="reply-bar-icon">↩</span>
        <span class="reply-bar-name">{{ replyTo.name }}</span>
        <span class="reply-bar-text">{{ replyTo.content }}</span>
        <button class="reply-bar-close" @click="replyTo = null">×</button>
      </div>
    </div>

    <MessageComposer v-model="val" placeholder="메시지를 입력하세요" @send="send" />
  </div>
</template>

<style scoped>
.chat-page { display: flex; flex-direction: column; height: 100%; }

.chat-scroll { flex: 1; overflow-y: auto; padding: 24px 2%; }
.chat-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.chat-row { display: flex; gap: 12px; align-items: flex-start; }
.chat-row--me { flex-direction: row-reverse; }
.chat-row--cont { margin-top: -10px; }

.chat-av--text {
  width: 36px; height: 36px; flex-shrink: 0;
  border-radius: 50%;
  background: #3d4158;
  color: #fff;
  font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.chat-av--hidden { visibility: hidden; }
.chat-content { max-width: 560px; }
.chat-content--me { text-align: right; }
.chat-meta { font-size: 14px; color: #717182; margin-bottom: 4px; }

/* 인용카드 + 말풍선 수직 스택 */
.msg-stack {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
}
.msg-stack--me { align-items: flex-end; }

/* 말풍선 + 시간/화살표 가로 배치 */
.bubble-row {
  display: inline-flex;
  align-items: flex-end;
  gap: 6px;
}
.bubble-row--me { flex-direction: row-reverse; }

/* 답장 인용 카드 */
.reply-quote {
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: rgba(43, 127, 255, 0.07);
  border-left: 3px solid #2b7fff;
  border-radius: 0 8px 0 0;
  padding: 6px 12px;
  margin-bottom: 0;
  max-width: 360px;
  text-align: left;
  overflow: hidden;
}
.reply-quote--me {
  border-left: none;
  border-right: 3px solid #2b7fff;
  border-radius: 8px 0 0 0;
}
.reply-quote--clickable { cursor: pointer; transition: background 0.15s; }
.reply-quote--clickable:hover { background: rgba(43, 127, 255, 0.13); }
/* 원본이 만료됐을 때: 클릭 불가 + 텍스트 흐리게 */
.reply-quote:not(.reply-quote--clickable) { opacity: 0.55; cursor: default; }
.reply-name { font-size: 12px; font-weight: 700; color: #2b7fff; line-height: 1.3; }
.reply-text {
  font-size: 12px; color: #8b8fa8; line-height: 1.4;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 320px;
}

/* 말풍선 */
.chat-bubble {
  display: inline-block;
  background: #fff;
  color: #1f2430;
  border: 1px solid #eceef2;
  padding: 14px 22px;
  border-radius: 16px;
  font-size: 16px;
  line-height: 1.5;
  text-align: left;
}
.chat-bubble--me { background: #2b7fff; color: #fff; border: none; }
/* 인용카드와 붙을 때 연결부 모서리 처리 */
.chat-bubble--chained { border-top-left-radius: 0; }
.chat-bubble--me.chat-bubble--chained { border-top-left-radius: 16px; border-top-right-radius: 0; }

/* 원본 메시지 하이라이트 */
.chat-row--highlight .chat-bubble {
  box-shadow: 0 0 0 3px rgba(43, 127, 255, 0.35);
  transition: box-shadow 0.2s;
}

.bubble-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.chat-time { font-size: 11px; color: #aeb2bb; white-space: nowrap; }

.reply-btn {
  visibility: hidden;
  opacity: 0;
  background: none;
  border: none;
  color: #aeb2bb;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
}
.chat-row:hover .reply-btn { visibility: visible; opacity: 1; }
.reply-btn:hover { color: #2b7fff; background: #f0f4ff; }

/* 답장 미리보기 바 */
.reply-bar {
  padding: 11px 2%;
  background: #f0f4ff;
  border-top: 1px solid #dbeafe;
}
.reply-bar-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding-left: 20px; /* input padding-left과 동일 → ↩와 "메" 시작점 정렬 */
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
}
.reply-bar-icon { color: #2b7fff; font-size: 17px; flex-shrink: 0; line-height: 1; }
.reply-bar-name { font-weight: 700; color: #2b7fff; flex-shrink: 0; }
.reply-bar-text {
  color: #717182; flex: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.reply-bar-close {
  background: none; border: none; color: #aeb2bb;
  cursor: pointer; font-size: 18px; line-height: 1; padding: 0 4px;
  flex-shrink: 0;
}
.reply-bar-close:hover { color: #1f2430; }
</style>
