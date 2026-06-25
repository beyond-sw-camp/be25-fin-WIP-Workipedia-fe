<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { Client } from '@stomp/stompjs'
import { useAuthStore } from '@/stores/authStore'
import MessageComposer from '@/components/common/MessageComposer.vue'
import { getActiveMessages } from '@/api/chatApi'
import type { FlashChatMessageResponse } from '@/types/chat'
import { Zap, Clock, MessageCircle, ChevronDown, ChevronUp } from '@lucide/vue'

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

// formatTime이 "방금"(60초 내) ↔ 실제 시각을 전환하려면 현재 시각이 반응형이어야 한다.
// 30초마다 갱신해 DOM을 최소한으로 업데이트한다.
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval>

// 각 메시지는 expiresAt 시점에 자동 제거된다. 타이머 핸들을 Map으로 관리해 DELETE 이벤트나
// 언마운트 시 clearTimeout으로 메모리 누수를 방지한다.
const timeouts = new Map<string, ReturnType<typeof setTimeout>>()

const msgs = ref<ChatMsg[]>([])
// 초기 메시지 로드가 끝나기 전에 안내 문구가 잠깐 보이는 플래시를 막기 위해 사용한다.
// 초기 메시지 로드가 끝나기 전에 안내 문구가 잠깐 보이는 플래시를 막기 위해 사용한다.
// onMounted의 getActiveMessages finally 블록에서 true로 설정된다.
const initialLoaded = ref(false)
// 안내 섹션의 접힘 상태. 기본값 true(펼침)이며 사용자가 직접 토글한다.
const guideOpen = ref(true)

// 메시지 expiresAt까지 남은 시간(ms)을 계산해 setTimeout으로 자동 제거를 예약한다.
// 이미 만료된 메시지는 즉시 제거한다.
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

// STOMP over SockJS로 Flash Chat 실시간 채널에 연결한다.
// SockJS는 WebSocket이 차단된 환경을 위한 fallback 라이브러리이며, 동적 import로 번들을 분리한다.
// VITE_API_BASE_URL에서 origin만 추출해 /ws/flash-chat 엔드포인트를 구성한다.
let stompClient: Client | null = null
const chatError = ref('')
let chatErrorTimer: ReturnType<typeof setTimeout> | null = null

function removeMessage(messageId: string) {
  clearTimeout(timeouts.get(messageId))
  timeouts.delete(messageId)
  msgs.value = msgs.value.filter(m => m.id !== messageId)
}

function showChatError(message: string) {
  chatError.value = message
  if (chatErrorTimer) clearTimeout(chatErrorTimer)
  chatErrorTimer = setTimeout(() => {
    chatError.value = ''
    chatErrorTimer = null
  }, 3000)
}

async function connectStomp() {
  const sockjsMod = await import('sockjs-client')
  const SockJS = (sockjsMod.default ?? sockjsMod) as unknown as new (url: string) => WebSocket
  const wsUrl = `${new URL(import.meta.env.VITE_API_BASE_URL).origin}/ws/flash-chat`
  stompClient = new Client({
    webSocketFactory: () => new SockJS(wsUrl),
    beforeConnect: async () => {
      stompClient!.connectHeaders = { Authorization: `Bearer ${auth.accessToken}` }
    },
    onConnect: () => {
      stompClient!.subscribe('/topic/flash-chat', (frame) => {
        const raw = JSON.parse(frame.body)

        // 관리자 삭제 등 서버 주도 메시지 제거. 로컬 타이머도 함께 정리한다.
        if (raw.type === 'DELETE') {
          removeMessage(raw.id)
          return
        }

        const original = raw.replyToId ? msgs.value.find(m => m.id === raw.replyToId) : null
        // raw.expiresAt은 서버가 정책 TTL 기준으로 계산한 값이므로 그대로 사용한다.
        // localStorage TTL로 재계산하면 관리자만 정확한 TTL을 가지는 문제가 생긴다.
        const expiresAt = raw.expiresAt
          ?? new Date(new Date(raw.createdAt).getTime() + parseInt(localStorage.getItem('chat_message_ttl_seconds') ?? '600') * 1000).toISOString()
        const msg: ChatMsg = {
          ...raw,
          expiresAt,
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

      stompClient!.subscribe('/user/queue/errors', (frame) => {
        const raw = JSON.parse(frame.body)
        showChatError(raw.message ?? '메시지를 전송할 수 없습니다.')
      })
    },
  })
  stompClient.activate()
}

// 마운트 시 미만료 메시지를 REST로 선로드한 뒤 STOMP를 연결한다.
onMounted(async () => {
  ticker = setInterval(() => { now.value = Date.now() }, 30_000)

  try {
    const res = await getActiveMessages()
    msgs.value = res.data.messages.map((raw: FlashChatMessageResponse) => {
      const original = raw.replyToId ? res.data.messages.find(m => m.id === raw.replyToId) : null
      return {
        ...raw,
        // 서버가 내려주는 expiresAt을 그대로 사용 — 모든 클라이언트가 동일한 만료 시각을 공유
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
  } finally {
    // API 실패 시에도 true로 설정해야 안내 문구가 표시된다.
    // try에만 두면 네트워크 오류 시 안내 섹션이 영원히 나타나지 않는다.
    initialLoaded.value = true
  }

  connectStomp().catch(console.error)
  scroll()
})

onUnmounted(() => {
  clearInterval(ticker)
  if (chatErrorTimer) clearTimeout(chatErrorTimer)
  timeouts.forEach(h => clearTimeout(h))
  timeouts.clear()
  stompClient?.deactivate()
})

// 60초 이내는 "방금", 이후는 오전/오후 시:분 형식으로 표시한다. now ref가 30초마다 갱신되어 재계산을 트리거한다.
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
  const replyRefNow = replyTo.value
  val.value = ''
  replyTo.value = null

  try {
    if (!stompClient?.connected) {
      showChatError('메시지를 전송할 수 없습니다.')
      return
    }
    stompClient.publish({
      destination: '/app/flash-chat/send',
      body: JSON.stringify({ content, replyToId: replyRefNow?.id ?? null }),
    })
  } catch {
    showChatError('메시지를 전송할 수 없습니다.')
  }
}

function startReply(msg: ChatMsg) {
  replyTo.value = msg
}

// 원본 메시지가 만료됐는지 확인해 인용 카드 클릭 가능 여부를 결정한다.
function originalExists(id: string): boolean {
  return msgs.value.some(m => m.id === id)
}

// 인용 카드 클릭 시 원본 메시지로 스크롤하고 1.5초간 하이라이트한다.
// data-msg-id 속성으로 DOM 요소를 특정한다.
function scrollToMessage(id: string) {
  if (!msgs.value.some(m => m.id === id)) return
  const el = scrollEl.value?.querySelector(`[data-msg-id="${id}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  highlightedId.value = id
  setTimeout(() => { highlightedId.value = null }, 1500)
}

// 같은 사용자가 연속으로 보낸 메시지는 아바타·이름을 숨겨 채팅을 압축한다(isContinuation).
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
    <!-- 스크롤 영역 밖에 배치해 메시지가 쌓여도 항상 상단에 고정된다. -->
    <div v-if="initialLoaded" class="guide-wrap">
      <div class="guide">
          <!-- 항상 표시되는 헤더 행: 아이콘 + 요약 문구 + 접기/펼치기 버튼 -->
          <div class="guide-header" @click="guideOpen = !guideOpen">
            <div class="empty-icon-wrap">
              <Zap :size="18" color="#2b7fff" />
            </div>
            <span class="guide-summary">팀원들과 실시간으로 소통하는 채널입니다. 메시지는 일정 시간이 지나면 자동으로 사라집니다.</span>
            <ChevronUp v-if="guideOpen" :size="16" color="#aeb2bb" class="guide-chevron" />
            <ChevronDown v-else :size="16" color="#aeb2bb" class="guide-chevron" />
          </div>
          <!-- 펼쳐진 상태에서만 보이는 상세 내용 -->
          <template v-if="guideOpen">
            <div class="empty-cards">
              <div class="empty-card">
                <Zap :size="18" color="#2b7fff" />
                <div>
                  <span class="empty-card-title">실시간 소통</span>
                  <span class="empty-card-desc">팀원이 보낸 메시지를 즉시 확인하세요</span>
                </div>
              </div>
              <div class="empty-card">
                <Clock :size="18" color="#8b5cf6" />
                <div>
                  <span class="empty-card-title">자동 만료</span>
                  <span class="empty-card-desc">메시지는 설정된 시간 후 자동 삭제됩니다</span>
                </div>
              </div>
            </div>
            <div class="empty-hint">
              <MessageCircle :size="13" color="#aeb2bb" />
              <span>아래 입력창에 메시지를 입력해 대화를 시작해보세요</span>
            </div>
          </template>
        </div>
    </div>

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

    <div v-if="chatError" class="chat-error">{{ chatError }}</div>

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

.chat-error {
  margin: 0 auto 10px;
  max-width: 1100px;
  width: calc(100% - 4%);
  padding: 10px 14px;
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 14px;
  font-weight: 600;
}

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

/* ── 상단 고정 안내 섹션 ─────────────────────────────── */
/* chat-scroll 밖에 있어 스크롤과 무관하게 항상 상단에 위치한다 */
/* chat-scroll 밖에 위치해 메시지가 쌓여도 스크롤과 무관하게 항상 상단에 고정된다.
   max-width는 chat-inner(1100px)에 양쪽 패딩(2% × 2 = 4%)을 더한 값으로
   좌우 여백을 유지하면서 채팅 영역 너비와 일치시킨다. */
.guide-wrap {
  padding: 16px 2% 0;
  max-width: calc(1100px + 4%);
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 20px;
  border-radius: 14px;
  border: 1px solid #eceef2;
  background: #fafbfc;
}

.guide-header {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.guide-summary {
  flex: 1;
  font-size: 13px;
  color: #717182;
  line-height: 1.5;
}

.guide-chevron { flex-shrink: 0; }

.empty-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #eaf2ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.empty-cards {
  display: flex;
  gap: 10px;
}

.empty-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid #eceef2;
  background: #fff;
  flex: 1;
}

.empty-card-title {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #1f2430;
}

.empty-card-desc {
  display: block;
  font-size: 12px;
  color: #aeb2bb;
  line-height: 1.4;
  margin-top: 2px;
}

.empty-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: #aeb2bb;
}
</style>
