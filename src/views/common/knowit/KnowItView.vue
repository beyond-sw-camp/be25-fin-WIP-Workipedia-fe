<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Bot, User, MessageCircle, Ticket, Plus, HelpCircle, Send } from '@lucide/vue'
import SourceCard from '@/components/common/SourceCard.vue'
import type { Source } from '@/components/common/SourceCard.vue'
import BaseToast from '@/components/common/BaseToast.vue'
import { createSession, sendMessage } from '@/api/chatbotApi'
import type { ApiReference } from '@/api/chatbotApi'
import { createQuestion } from '@/api/workiApi'
import { createTicket } from '@/api/ticketApi'

type Mode = 'none' | 'question' | 'request'

interface Msg {
  kind: 'user' | 'mode' | 'answer' | 'sources' | 'actions' | 'loading'
  text?: string
  msgMode?: 'question' | 'request'
  sources?: Source[]
  userText?: string
  isTicket?: boolean
  nextAction?: 'SHOW_SOURCES' | 'CREATE_WORKI' | 'CREATE_TICKET'
  draftQuestion?: { title: string; content: string }
  draftTicket?: { title: string; content: string }
}

const router = useRouter()
const scrollEl = ref<HTMLElement | null>(null)
const mode = ref<Mode>('none')
const msgs = ref<Msg[]>([])
const inputVal = ref('')
const loading = ref(false)
const hasQueried = ref(false)

const sessionId = ref<number | null>(null)
const lastMessageId = ref<number | null>(null)

const showWorkyDialog = ref(false)
const workyTitle = ref('')
const workyContent = ref('')
const workyError = ref('')

const showTicketDialog = ref(false)
const ticketTitle = ref('')
const ticketContent = ref('')
const ticketError = ref('')
const ticketDept = ref('')

const toastVisible = ref(false)
const toastTitle = ref('')
const toastSub = ref('')

function showToast(title: string, sub = '') {
  toastTitle.value = title
  toastSub.value = sub
  toastVisible.value = true
}

function scroll() {
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  })
}

// BE에서 content snippet 필드 추가 시 body에 반영
function mapReferences(refs: ApiReference[]): Source[] {
  const typeConfig: Record<string, { label: string; cls: Source['cls'] }> = {
    MANUAL: { label: '매뉴얼',    cls: 'green' },
    TICKET: { label: '티켓 답변', cls: 'blue'  },
    CHAT:   { label: '채팅 답변', cls: 'gray'  },
  }
  return refs.map(r => {
    const cfg = typeConfig[r.type] ?? { label: r.type, cls: 'gray' as const }
    return { type: cfg.label, cls: cfg.cls, meta: r.title, link: '문서에서 보기', url: r.url }
  })
}

function selectMode(m: 'question' | 'request') {
  mode.value = m
  msgs.value = [
    { kind: 'user', text: m === 'question' ? '질문' : '요청' },
    {
      kind: 'mode',
      msgMode: m,
      text: m === 'question'
        ? '사내 위키와 문서를 검색해 답변을 찾아드릴게요.\n예: 5층 카페테리아 언제 열어요? / 연말정산 서류는 어디서 확인해요?'
        : '담당 부서에 티켓을 발행하여 처리를 요청할게요.\n예: 노트북 반납 신청합니다 / VPN 접속 오류 처리 요청합니다',
    },
  ]
  scroll()
}

function changeMode() {
  mode.value = 'none'
  msgs.value = []
  hasQueried.value = false
  sessionId.value = null
  lastMessageId.value = null
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = 0
  })
}

async function send() {
  const q = inputVal.value.trim()
  if (!q || loading.value) return
  hasQueried.value = true
  inputVal.value = ''
  msgs.value.push({ kind: 'user', text: q })
  loading.value = true
  msgs.value.push({ kind: 'loading', isTicket: mode.value === 'request' })
  scroll()

  try {
    if (!sessionId.value) {
      const s = await createSession()
      sessionId.value = s.data.data.sessionId
    }
    const sid = sessionId.value as number

    if (mode.value === 'request') {
      const res = await sendMessage(sid, q)
      const { messageId, draftTicket } = res.data.data
      lastMessageId.value = messageId
      msgs.value = msgs.value.filter(m => m.kind !== 'loading')
      ticketTitle.value = draftTicket?.title ?? ''
      ticketContent.value = draftTicket?.content ?? q
      ticketError.value = ''
      showTicketDialog.value = true
      return
    }

    const res = await sendMessage(sid, q)
    const { messageId, answer, references, nextAction, draftQuestion, draftTicket } = res.data.data
    lastMessageId.value = messageId
    msgs.value = msgs.value.filter(m => m.kind !== 'loading')
    msgs.value.push({ kind: 'answer', text: answer })
    if (nextAction === 'SHOW_SOURCES') {
      msgs.value.push({ kind: 'sources', sources: mapReferences(references) })
    }
    msgs.value.push({ kind: 'actions', userText: q, nextAction, draftQuestion, draftTicket })
    scroll()
  } catch {
    msgs.value = msgs.value.filter(m => m.kind !== 'loading')
  } finally {
    loading.value = false
  }
}

function openWorkyDialog(draft?: { title: string; content: string }) {
  workyTitle.value = draft?.title ?? ''
  workyContent.value = draft?.content ?? [...msgs.value].reverse().find(m => m.kind === 'user')?.text ?? ''
  workyError.value = ''
  showWorkyDialog.value = true
}

async function submitWorky() {
  if (!workyTitle.value.trim()) return
  if (workyContent.value.trim().length < 10) {
    workyError.value = '내용을 10자 이상 작성해주세요.'
    return
  }
  try {
    await createQuestion({
      title: workyTitle.value.trim(),
      content: workyContent.value.trim(),
      sourceChatbotMessageId: lastMessageId.value,
    })
    showWorkyDialog.value = false
    workyTitle.value = ''
    workyContent.value = ''
    workyError.value = ''
    showToast('워키 게시판에 질문이 등록되었습니다!', '10P가 적립되었습니다')
  } catch {
    workyError.value = '등록 중 오류가 발생했습니다. 다시 시도해주세요.'
  }
}

function openTicketDialog(userText: string, draft?: { title: string; content: string }) {
  ticketTitle.value = draft?.title ?? ''
  ticketContent.value = draft?.content ?? userText
  ticketError.value = ''
  showTicketDialog.value = true
}

async function submitTicket() {
  if (!ticketTitle.value.trim()) return
  if (ticketContent.value.trim().length < 10) {
    ticketError.value = '내용을 10자 이상 작성해주세요.'
    return
  }
  try {
    const res = await createTicket({
      sourceChatbotMessageId: lastMessageId.value,
      title: ticketTitle.value.trim(),
      content: ticketContent.value.trim(),
    })
    ticketDept.value = res.data.assignedDepartmentName ?? ''
    showTicketDialog.value = false
    ticketTitle.value = ''
    ticketContent.value = ''
    ticketError.value = ''
    const deptMsg = ticketDept.value
      ? `노잇이 ${ticketDept.value}부서로 전달했습니다.`
      : '담당자가 빠르게 처리해드립니다'
    showToast('티켓이 발행되었습니다!', deptMsg)
  } catch {
    ticketError.value = '발행 중 오류가 발생했습니다. 다시 시도해주세요.'
  }
}
</script>

<template>
  <div class="knowit-page">

    <!-- 메시지 영역 -->
    <div ref="scrollEl" class="knowit-scroll">
      <div class="knowit-inner">

        <!-- 웰컴 (처음 진입 시) -->
        <div v-if="msgs.length === 0" class="welcome-hero">
          <div class="hero-icon-wrap">
            <MessageCircle :size="34" color="#2b7fff" />
          </div>
          <h2 class="hero-title">무엇을 도와드릴까요?</h2>
          <p class="hero-sub">사내 정보를 빠르고 정확하게 찾아드립니다.</p>
          <div class="hero-btns">
            <button class="btn-mode btn-question" @click="selectMode('question')">
              <MessageCircle :size="16" /> 질문
            </button>
            <button class="btn-mode btn-request" @click="selectMode('request')">
              <Ticket :size="16" /> 요청
            </button>
          </div>
          <div class="welcome-hints">
            <p><strong class="hint-q">질문:</strong> 사내 위키, 문서, FAQ를 검색해 답변을 찾아드려요</p>
            <p><strong class="hint-r">요청:</strong> 담당 부서에 티켓을 발행해 처리를 요청해요</p>
          </div>
        </div>

        <!-- 메시지 목록 -->
        <template v-for="(m, i) in msgs" :key="i">

          <!-- 사용자 메시지 -->
          <div v-if="m.kind === 'user'" class="msg-me">
            <div class="bubble-user">{{ m.text }}</div>
            <span class="chat-av"><User :size="18" /></span>
          </div>

          <!-- 봇 모드 안내 -->
          <div v-else-if="m.kind === 'mode'" class="msg-bot">
            <span class="chat-av"><Bot :size="18" /></span>
            <div class="card mode-card">
              <div class="mode-header">
                <span :class="['badge', m.msgMode === 'question' ? 'badge--blue' : 'badge--purple']">
                  {{ m.msgMode === 'question' ? '질문 모드' : '요청 모드' }}
                </span>
                <button class="mode-change" :disabled="loading" @click="changeMode">변경</button>
              </div>
              <p class="mode-text">{{ m.text }}</p>
            </div>
          </div>

          <!-- 봇 답변 텍스트 -->
          <div v-else-if="m.kind === 'answer'" class="msg-bot">
            <span class="chat-av"><Bot :size="18" /></span>
            <div class="card answer-card">{{ m.text }}</div>
          </div>

          <!-- 봇 소스 카드 -->
          <div v-else-if="m.kind === 'sources'" class="msg-bot">
            <span class="chat-av"><Bot :size="18" /></span>
            <div class="sources-list">
              <template v-if="m.sources && m.sources.length > 0">
                <SourceCard v-for="(s, j) in m.sources" :key="j" :source="s" />
              </template>
              <div v-else class="no-results">관련 문서를 찾지 못했어요. 아래 버튼으로 직접 문의해 보세요.</div>
            </div>
          </div>

          <!-- 액션 버튼 -->
          <div v-else-if="m.kind === 'actions'" class="msg-actions">
            <button v-if="m.nextAction !== 'CREATE_TICKET'" class="btn btn--outline" @click="openWorkyDialog(m.draftQuestion)">
              <Plus :size="13" /> 워키에 질문 등록하기
            </button>
            <button v-if="m.nextAction !== 'CREATE_WORKI'" class="btn btn--outline btn--purple" @click="openTicketDialog(m.userText ?? '', m.draftTicket)">
              <Ticket :size="13" /> 담당 부서에 문의하기
            </button>
          </div>

          <!-- 로딩 -->
          <div v-else-if="m.kind === 'loading'" class="msg-bot">
            <span class="chat-av"><Bot :size="18" /></span>
            <div class="loading-card">
              <div class="dots">
                <span></span><span></span><span></span>
              </div>
              <span v-if="m.isTicket" class="loading-text">티켓 발행 폼을 작성중입니다</span>
            </div>
          </div>

        </template>
      </div>
    </div>

    <!-- 도움말 버튼 -->
    <div class="help-row">
      <button class="help-btn" @click="router.push('/faq')">
        <HelpCircle :size="36" />
      </button>
    </div>

    <!-- 입력 영역 -->
    <div class="composer-area">
      <div v-if="mode === 'none'" class="no-mode-hint">질문 또는 요청을 선택해주세요</div>
      <form v-else class="composer-form" @submit.prevent="send">
        <input
          v-model="inputVal"
          class="composer-input"
          :placeholder="hasQueried
            ? (mode === 'question' ? '궁금한 내용을 입력해주세요' : '요청 내용을 입력해주세요')
            : (mode === 'question' ? '예: 5층 카페테리아 언제 열어요?' : '예: 노트북 반납 신청합니다')"
          :disabled="loading"
        />
        <button
          type="submit"
          class="composer-send"
          :class="{ active: inputVal.trim() && !loading }"
          :disabled="loading || !inputVal.trim()"
        >
          <Send :size="20" />
        </button>
      </form>
    </div>
  </div>

  <!-- 성공 토스트 -->
  <BaseToast v-model="toastVisible" :title="toastTitle" :sub="toastSub" />

  <!-- 워키 등록 다이얼로그 -->
  <Teleport to="body">
    <div v-if="showWorkyDialog" class="dialog-overlay" @click.self="showWorkyDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>워키 게시판에 질문 등록</h3>
          <p>질문을 등록하면 10P를 받으실 수 있습니다.</p>
        </div>
        <div class="dialog-body">
          <div class="field">
            <label>제목 <span class="required">*</span></label>
            <input v-model="workyTitle" type="text" placeholder="제목을 입력하세요" class="dialog-input" />
          </div>
          <div class="field">
            <label>내용</label>
            <p class="field-hint">오픈 질문 게시판에 등록될 예정입니다. 수정할 부분이 있다면 수정해주세요.</p>
            <textarea v-model="workyContent" class="dialog-textarea" rows="5" placeholder="질문 내용을 입력하세요 (최소 10자)" @input="workyError = ''" />
            <p v-if="workyError" class="field-error">{{ workyError }}</p>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn--ghost" @click="showWorkyDialog = false">취소</button>
          <button class="btn btn--primary" :disabled="!workyTitle.trim()" @click="submitWorky">질문 등록</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 티켓 발행 다이얼로그 -->
  <Teleport to="body">
    <div v-if="showTicketDialog" class="dialog-overlay" @click.self="showTicketDialog = false">
      <div class="dialog dialog--wide">
        <div class="dialog-header">
          <h3>티켓 발행</h3>
          <p>노잇이 자동으로 담당 부서를 추천해드립니다.</p>
        </div>
        <div class="dialog-body">
          <div class="field">
            <label>제목 <span class="required">*</span></label>
            <input v-model="ticketTitle" type="text" class="dialog-input" placeholder="제목을 입력하세요" />
          </div>
          <div class="field">
            <label>내용 <span class="required">*</span></label>
            <textarea v-model="ticketContent" class="dialog-textarea" rows="5" placeholder="요청 내용을 입력하세요 (최소 10자)" @input="ticketError = ''" />
            <p v-if="ticketError" class="field-error">{{ ticketError }}</p>
          </div>
          <div class="info-box">
            <strong>💡 참고:</strong> 닉네임과 부서명이 함께 전달됩니다.
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn--ghost" @click="showTicketDialog = false">취소</button>
          <button class="btn btn--purple-solid" :disabled="!ticketTitle.trim()" @click="submitTicket">티켓 발행</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── 레이아웃 ── */
.knowit-page { display: flex; flex-direction: column; height: 100%; background: #f7f8fa; }
.knowit-scroll { flex: 1; overflow-y: auto; padding: 32px 2%; }
.knowit-inner { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }

/* ── 아바타 ── */
.chat-av {
  width: 32px; height: 32px; border-radius: 50%;
  background: #2b7fff; color: #fff;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

/* ── 사용자 메시지 ── */
.msg-me { display: flex; justify-content: flex-end; align-items: flex-start; gap: 10px; }
.bubble-user {
  background: #2b7fff; color: #fff;
  padding: 14px 22px; border-radius: 16px;
  font-size: 16px; max-width: 560px; line-height: 1.6;
}

/* ── 봇 메시지 공통 ── */
.msg-bot { display: flex; gap: 12px; align-items: flex-start; }

/* ── 웰컴 히어로 ── */
.welcome-hero {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; padding: 56px 20px 32px; gap: 0;
}
.hero-icon-wrap {
  width: 80px; height: 80px; border-radius: 50%;
  background: #eef3ff;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 22px;
}
.hero-title {
  font-size: 30px; font-weight: 800; color: #1f2430;
  margin: 0 0 12px;
}
.hero-sub {
  font-size: 18px; color: #2b7fff;
  margin: 0 0 32px;
}
.hero-btns { display: flex; gap: 10px; margin-bottom: 20px; width: 300px; }
.btn-mode {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  height: 46px; border-radius: 10px; border: none;
  font-size: 16px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
}
.btn-mode:hover:not(:disabled) { opacity: 0.88; }
.btn-mode:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-question { background: #2b7fff; color: #fff; }
.btn-request { background: #8b5cf6; color: #fff; }
.welcome-hints { display: flex; flex-direction: column; gap: 6px; }
.welcome-hints p { font-size: 14px; color: #717182; margin: 0; }
.hint-q { color: #2b7fff; }
.hint-r { color: #8b5cf6; }

/* ── 모드 카드 ── */
.card { background: #fff; border: 1px solid #eceef2; border-radius: 14px; box-shadow: 0 2px 6px rgba(0,0,0,.05); }
.mode-card { padding: 18px 22px; max-width: 680px; }
.answer-card { padding: 18px 22px; max-width: 680px; font-size: 15px; color: #44403c; line-height: 1.7; }
.mode-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.badge { padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
.badge--blue { background: #2b7fff; color: #fff; }
.badge--purple { background: #8b5cf6; color: #fff; }
.mode-change { background: none; border: none; color: #717182; font-size: 13px; font-weight: 600; cursor: pointer; padding: 0; }
.mode-change:hover { color: #1f2430; }
.mode-text { font-size: 15px; color: #44403c; line-height: 1.7; margin: 0; white-space: pre-line; }

/* ── 소스 카드 ── */
.sources-list { display: flex; flex-direction: column; gap: 10px; flex: 1; max-width: 720px; }
.no-results {
  align-self: flex-start;
  background: #fff; border: 1px solid #eceef2; border-radius: 14px;
  padding: 16px 20px; font-size: 15px; color: #44403c;
  box-shadow: 0 2px 6px rgba(0,0,0,.05);
}

/* ── 액션 버튼 ── */
.msg-actions { display: flex; gap: 10px; margin-left: 44px; flex-wrap: wrap; }
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 8px;
  font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.15s;
}
.btn--outline {
  background: #fff; border: 1px solid #d1d5db; color: #374151;
}
.btn--outline:hover { background: #f3f4f6; }
.btn--purple { border-color: #c4b5fd; color: #7c3aed; }
.btn--purple:hover { background: #f5f3ff; }

/* ── 로딩 ── */
.loading-card {
  display: flex; align-items: center; gap: 10px;
  background: #fff; border: 1px solid #eceef2; border-radius: 14px;
  padding: 16px 20px; box-shadow: 0 2px 6px rgba(0,0,0,.05);
}
.dots { display: flex; gap: 5px; }
.dots span {
  width: 8px; height: 8px; border-radius: 50%; background: #717182;
  animation: bounce 1.2s infinite ease-in-out;
}
.dots span:nth-child(1) { animation-delay: 0ms; }
.dots span:nth-child(2) { animation-delay: 150ms; }
.dots span:nth-child(3) { animation-delay: 300ms; }
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}
.loading-text { font-size: 13px; color: #717182; }

/* ── 도움말 버튼 ── */
.help-row { display: flex; justify-content: flex-end; padding: 4px 2%; }
.help-btn { background: none; border: none; color: #717182; cursor: pointer; padding: 6px; transition: color 0.15s; }
.help-btn:hover { color: #1f2430; }

/* ── 입력 영역 ── */
.composer-area { border-top: 1px solid #eceef2; padding: 16px 2%; background: #fff; }
.no-mode-hint { display: flex; align-items: center; justify-content: center; height: 48px; font-size: 16px; color: #a8a29e; }
.composer-form { max-width: 1100px; margin: 0 auto; display: flex; gap: 12px; align-items: center; }
.composer-input {
  flex: 1; padding: 14px 20px; border-radius: 12px;
  border: 1px solid #e6e8ec; background: #f7f8fa;
  font-size: 15px; outline: none; transition: border-color 0.15s;
}
.composer-input:focus { border-color: #2b7fff; background: #fff; }
.composer-input:disabled { opacity: 0.5; cursor: not-allowed; }
.composer-send {
  width: 48px; height: 48px; border-radius: 50%;
  background: #d1d5db; border: none; color: #fff;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; cursor: pointer; transition: background 0.15s;
}
.composer-send.active { background: #2b7fff; }
.composer-send:disabled { cursor: not-allowed; }

/* ── 다이얼로그 공통 ── */
.dialog-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 1rem;
}
.dialog {
  background: #fff; border-radius: 16px;
  width: 100%; max-width: 480px;
  box-shadow: 0 20px 60px rgba(0,0,0,.2);
}
.dialog--wide { max-width: 600px; }
.dialog-header { padding: 24px 24px 0; }
.dialog-header h3 { font-size: 17px; font-weight: 700; color: #1f2430; margin: 0 0 4px; }
.dialog-header p { font-size: 13px; color: #717182; margin: 0; }
.dialog-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field label { font-size: 13px; font-weight: 600; color: #44403c; }
.field-hint { font-size: 12px; color: #a8a29e; margin: 0; }
.field-error { font-size: 12px; color: #ef4444; margin: 0; }
.required { color: #ef4444; }
.dialog-input {
  height: 40px; padding: 0 14px;
  border: 1px solid #e6e8ec; border-radius: 8px;
  font-size: 14px; outline: none; transition: border-color 0.15s;
}
.dialog-input:focus { border-color: #2b7fff; }
.dialog-textarea {
  padding: 10px 14px; border: 1px solid #e6e8ec; border-radius: 8px;
  font-size: 14px; outline: none; resize: vertical;
  font-family: inherit; transition: border-color 0.15s;
}
.dialog-textarea:focus { border-color: #2b7fff; }
.info-box {
  background: #eff6ff; border: 1px solid #bfdbfe;
  border-radius: 8px; padding: 10px 14px;
  font-size: 13px; color: #1e40af;
}
.dialog-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 0 24px 20px;
}
.btn--ghost {
  background: none; border: 1px solid #e6e8ec; color: #717182;
  padding: 8px 16px; border-radius: 8px; font-size: 14px;
  cursor: pointer; transition: background 0.15s;
}
.btn--ghost:hover { background: #f7f8fa; }
.btn--primary {
  background: #2b7fff; border: none; color: #fff;
  padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
}
.btn--primary:hover:not(:disabled) { background: #1a6ef5; }
.btn--primary:disabled { background: #d1d5db; cursor: not-allowed; }
.btn--purple-solid {
  background: #8b5cf6; border: none; color: #fff;
  padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
}
.btn--purple-solid:hover:not(:disabled) { background: #7c3aed; }
.btn--purple-solid:disabled { background: #d1d5db; cursor: not-allowed; }

</style>
