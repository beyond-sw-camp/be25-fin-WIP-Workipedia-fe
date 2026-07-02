<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Bot, User, MessageCircle, Ticket, Plus, HelpCircle, Send, X, ChevronDown, ChevronUp } from '@lucide/vue'
import SourceCard from '@/components/common/SourceCard.vue'
import type { Source } from '@/components/common/SourceCard.vue'
import BaseToast from '@/components/common/BaseToast.vue'
import { createSession, streamMessage, parseReferences, formatSourceLabel } from '@/api/chatbotApi'
import type { SourceItem } from '@/api/chatbotApi'
import { createQuestion } from '@/api/workiApi'
import { createTicket, draftTicket } from '@/api/ticketApi'
import { useAuthStore } from '@/stores/authStore'
import {
  RECOMMENDED_CHATBOT_QUESTIONS,
  type RecommendedChatbotQuestion,
} from '@/constants/recommendedChatbotQuestions'

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

interface TextSegment {
  text: string
  bold: boolean
}

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const scrollEl = ref<HTMLElement | null>(null)
const mode = ref<Mode>('none')
const msgs = ref<Msg[]>([])
const inputVal = ref('')
const loading = ref(false)
const hasQueried = ref(false)
const recommendedOpen = ref(true)
const RECOMMENDED_QUESTION_LIMIT = 5

function pickRecommendedQuestions(
  questions: RecommendedChatbotQuestion[],
  limit = RECOMMENDED_QUESTION_LIMIT,
) {
  return [...questions]
    .sort(() => Math.random() - 0.5)
    .slice(0, limit)
}

const visibleRecommendedQuestions = ref(
  pickRecommendedQuestions(RECOMMENDED_CHATBOT_QUESTIONS.filter(q => q.mode === 'question')),
)

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
const ticketDrafting = ref(false)
const ticketDept = ref('')
// 티켓 발행 버튼을 연속 클릭하면 동일 메시지에 대해 티켓이 중복 생성되는 문제가 있었다.
// API 응답 전까지 flag를 true로 유지해 중복 요청을 차단한다.
const submittingTicket = ref(false)

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

function formatAnswerText(text = ''): TextSegment[] {
  const segments: TextSegment[] = []
  const pattern = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false })
    }
    segments.push({ text: match[1] ?? '', bold: true })
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false })
  }
  return segments.length ? segments : [{ text, bold: false }]
}

// source_type → 표시 라벨/색상 + 내부 상세 경로 prefix
const SOURCE_TYPE_CONFIG: Record<string, { label: string; cls: Source['cls']; route?: string }> = {
  MANUAL:            { label: '규정집',    cls: 'green',  route: '/manuals' },
  MANUAL_KNOWLEDGE:  { label: '수기 지식', cls: 'orange', route: '/direct-data' },
  WORKI:             { label: '워키 답변', cls: 'blue',   route: '/worki' },
  TICKET:            { label: '티켓 답변', cls: 'blue',   route: '/tickets' },
  KNOWLEDGE_DATA:    { label: '지식 문서', cls: 'purple', route: '/knowledge' },
  CHAT:              { label: '채팅 답변', cls: 'gray' },
}

// AI 서버가 내려준 SourceItem[](snake_case) 을 SourceCard 표시용 Source[] 로 변환한다.
// 규정집은 파일/페이지 단위로 근거가 다를 수 있으므로 파일명·페이지까지 포함해 중복 제거한다.
// (페이지 정보가 없는 출처는 source_type+source_id 기준으로 기존처럼 문서 단위 중복 제거된다.)
// link가 null이면 source_type 기반 내부 상세 경로로 대체한다.
const SOURCE_TYPE_ORDER: Record<string, number> = {
  MANUAL: 0,
  MANUAL_KNOWLEDGE: 1,
  KNOWLEDGE_DATA: 2,
  WORKI: 3,
  TICKET: 4,
  CHAT: 5,
}

function mapReferences(refs: SourceItem[]): Source[] {
  const seen = new Set<string>()
  const result: Source[] = []
  const sorted = [...refs].sort(
    (a, b) => (SOURCE_TYPE_ORDER[a.source_type] ?? 99) - (SOURCE_TYPE_ORDER[b.source_type] ?? 99),
  )
  for (const r of sorted) {
    const key = `${r.source_type}:${r.source_id}:${r.file_name ?? ''}:${r.page_start ?? ''}:${r.page_end ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    const cfg = SOURCE_TYPE_CONFIG[r.source_type] ?? { label: r.source_type, cls: 'gray' as const }
    const url = r.link ?? (cfg.route ? `${cfg.route}/${r.source_id}` : undefined)
    result.push({ type: cfg.label, cls: cfg.cls, meta: formatSourceLabel(r), link: '문서에서 보기', url })
  }
  return result
}


// 질문/요청 모드를 선택하는 즉시 챗봇 세션을 생성한다.
// 세션은 UI에 노출하지 않고 sessionId만 보관해 이후 메시지 전송에 재사용한다.
// 생성 실패 시 모드 선택을 취소하고 안내한다.
onMounted(() => {
  const q = route.query.mode
  if (q === 'question' || q === 'request') selectMode(q)
})

async function selectMode(m: 'question' | 'request') {
  if (loading.value) return
  router.replace({ query: { mode: m } })
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

  loading.value = true
  try {
    const s = await createSession()
    sessionId.value = s.data.sessionId
  } catch {
    changeMode()
    showToast('챗봇 세션을 시작하지 못했습니다.', '잠시 후 다시 시도해주세요.')
  } finally {
    loading.value = false
  }
}

function changeMode() {
  mode.value = 'none'
  msgs.value = []
  hasQueried.value = false
  sessionId.value = null
  lastMessageId.value = null
  router.replace({ query: {} })
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

  // done으로 답변(또는 폴백) 버블을 이미 출력했는지 추적. done 직후 스트림 종료 오류로
  // catch가 실행될 때 폴백 문구가 중복으로 추가되는 것을 막는다.
  let answered = false

  try {
    // 요청 모드: 챗봇(/chat)·세션을 건드리지 않고 폼만 즉시 연다.
    // 요청엔 챗봇 Q&A가 없어 sourceChatbotMessageId가 의미 없으므로 null로 둔다.
    // (이전엔 messageId를 얻으려 /chat을 호출해 RAG가 헛돌고 DB 커넥션을 점유하던 문제가 있었다)
    if (mode.value === 'request') {
      msgs.value = msgs.value.filter(m => m.kind !== 'loading')
      lastMessageId.value = null
      ticketTitle.value = ''
      ticketContent.value = q       // 우선 원문을 노출하고, AI 초안이 오면 채운다
      ticketError.value = ''
      showTicketDialog.value = true
      // AI가 제목/내용 초안을 정리해 채운다(편집 가능). 실패하면 원문 유지(graceful).
      ticketDrafting.value = true
      draftTicket(q)
        .then(res => {
          // 사용자가 그 사이 직접 손대지 않았을 때만 초안으로 덮어쓴다.
          if (ticketTitle.value === '') ticketTitle.value = res.data.title
          if (ticketContent.value === q) ticketContent.value = res.data.content
        })
        .catch(() => { /* 원문 유지 */ })
        .finally(() => { ticketDrafting.value = false })
      return
    }

    // 질문 모드: 세션이 없으면 지연 생성한 뒤 스트리밍 답변을 받는다.
    if (!sessionId.value) {
      const s = await createSession()
      sessionId.value = s.data.sessionId
    }
    const sid = sessionId.value as number

    // 질문 모드: 토큰을 받아 타자치듯 답변을 출력하고(token), done으로 최종 확정한다.
    // 첫 token 도착 시 로딩 버블을 빈 답변 버블로 교체한 뒤, 인덱스로 reactive 배열을 갱신한다.
    let answerIdx = -1
    await streamMessage(sid, q, {
      onToken: (chunk) => {
        if (answerIdx === -1) {
          msgs.value = msgs.value.filter(m => m.kind !== 'loading')
          msgs.value.push({ kind: 'answer', text: '' })
          answerIdx = msgs.value.length - 1
        }
        const a = msgs.value[answerIdx]!
        a.text = (a.text ?? '') + chunk
        scroll()
      },
      onDone: (saved) => {
        lastMessageId.value = saved.messageId
        msgs.value = msgs.value.filter(m => m.kind !== 'loading')
        // 누적된 token과 최종 content가 다를 수 있어 done.content를 확정값으로 덮어쓴다.
        // token이 한 번도 안 온 경우(fallback 등)에도 여기서 답변 버블을 만든다.
        // answerable=false는 RAG가 관련 지식을 찾지 못한 상태다.
        // BE가 내려주는 기본 오류 메시지 대신 사용자 친화적인 문구로 대체한다.
        const displayText = saved.answerable ? saved.content : '해당 질문에 대한 내용을 찾을 수 없습니다.'
        if (answerIdx === -1) {
          msgs.value.push({ kind: 'answer', text: displayText })
          answerIdx = msgs.value.length - 1
        } else {
          msgs.value[answerIdx]!.text = displayText
        }
        answered = true
        // 참조 문서는 nextAction과 무관하게 출처가 1개 이상이면 항상 표시한다.
        // (AI SUCCESS 응답은 action=null로 내려와 nextAction이 SHOW_SOURCES가 아니기 때문)
        const sources = mapReferences(parseReferences(saved.referencesJson))
        if (sources.length > 0) {
          msgs.value.push({ kind: 'sources', sources })
        }
        msgs.value.push({ kind: 'actions', userText: q, nextAction: saved.nextAction ?? undefined })
        scroll()
      },
    })
  } catch {
    msgs.value = msgs.value.filter(m => m.kind !== 'loading')
    // 스트림 오류 또는 세션 생성 실패 시 표준 폴백 문구를 답변 버블로 표시한다.
    // 단, done으로 이미 답변이 출력된 뒤(스트림 종료 단계) 오류라면 폴백을 추가하지 않는다.
    if (!answered) {
      msgs.value.push({ kind: 'answer', text: '해당 질문에 대한 내용을 찾을 수 없습니다.' })
    }
  } finally {
    loading.value = false
  }
}

async function sendRecommendedQuestion(question: RecommendedChatbotQuestion) {
  if (loading.value) return

  if (mode.value !== question.mode) {
    await selectMode(question.mode)
    if (mode.value !== question.mode) return
  }

  inputVal.value = question.text
  await send()
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
  if (submittingTicket.value) return
  if (!ticketTitle.value.trim()) return
  if (ticketContent.value.trim().length < 10) {
    ticketError.value = '내용을 10자 이상 작성해주세요.'
    return
  }
  submittingTicket.value = true
  try {
    // TicketResponse에 발신자 필드가 없어 content 끝에 마커로 삽입한다.
    // 대시보드에서 SENDER_RE 정규식으로 파싱해 발신자 정보를 별도 UI 영역에 표시한다.
    const senderParts = [authStore.team, authStore.nickname].filter(Boolean)
    const senderTag = senderParts.length ? `\n##SENDER:${senderParts.join('|')}##` : ''
    const res = await createTicket({
      sourceChatbotMessageId: lastMessageId.value,
      title: ticketTitle.value.trim(),
      content: ticketContent.value.trim() + senderTag,
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
  } finally {
    submittingTicket.value = false
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
            <p><strong class="hint-q">질문:</strong> 사내 규정집, 워키, FAQ를 검색하여 답변을 제공해요</p>
            <p><strong class="hint-r">요청:</strong> 담당 부서에 티켓을 발행하여 업무 처리를 요청해요</p>
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
                <button
                  :class="['mode-change', m.msgMode === 'question' ? 'mode-change--blue' : 'mode-change--purple']"
                  :disabled="loading"
                  @click="changeMode"
                >모드 변경</button>
              </div>
              <p class="mode-text">{{ m.text }}</p>
            </div>
          </div>

          <!-- 봇 답변 텍스트 -->
          <div v-else-if="m.kind === 'answer'" class="msg-bot">
            <span class="chat-av"><Bot :size="18" /></span>
            <div class="card answer-card">
              <template v-for="(segment, segmentIndex) in formatAnswerText(m.text)" :key="segmentIndex">
                <strong v-if="segment.bold">{{ segment.text }}</strong>
                <template v-else>{{ segment.text }}</template>
              </template>
            </div>
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
          <!-- 노잇이 답변하지 못한 경우에도 사용자가 워키 질문 등록 / 티켓 발송 중 선택할 수 있도록 두 버튼을 항상 함께 노출한다. -->
          <div v-else-if="m.kind === 'actions'" class="msg-actions">
            <button class="btn btn--outline" @click="openWorkyDialog(m.draftQuestion)">
              <Plus :size="13" /> 워키에 질문 등록하기
            </button>
            <button class="btn btn--outline btn--purple" @click="openTicketDialog(m.userText ?? '', m.draftTicket)">
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

    <!-- 도움말 버튼 — ?tab=usage 쿼리로 FAQ 시스템 사용법 탭을 직접 연다 -->
    <div class="help-row">
      <div class="help-wrap">
        <span class="help-tooltip">사용법이 궁금해요</span>
        <button class="help-btn" @click="router.push('/faq?tab=usage')">
          <HelpCircle :size="30" />
        </button>
      </div>
    </div>

    <div
      v-if="mode === 'question' && visibleRecommendedQuestions.length"
      class="recommended-area"
      aria-label="질문 가이드"
    >
      <div class="recommended-shell">
        <div class="recommended-header">
          <div class="help-wrap">
            <span class="help-tooltip">사용법이 궁금해요</span>
            <button class="help-btn" @click="router.push('/faq?tab=usage')">
              <HelpCircle :size="30" />
            </button>
          </div>
          <button
            type="button"
            class="recommended-toggle"
            :aria-expanded="recommendedOpen"
            @click="recommendedOpen = !recommendedOpen"
          >
            <span>질문 가이드</span>
            <ChevronUp v-if="recommendedOpen" :size="16" />
            <ChevronDown v-else :size="16" />
          </button>
        </div>
        <div v-if="recommendedOpen" class="recommended-questions">
          <button
            v-for="question in visibleRecommendedQuestions"
            :key="`${question.mode}-${question.text}`"
            type="button"
            class="recommended-question"
            :disabled="loading"
            :title="question.text"
            @click="sendRecommendedQuestion(question)"
          >
            <span class="recommended-question-text">{{ question.text }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 입력 영역 -->
    <div class="composer-area">
      <div v-if="mode === 'none'" class="no-mode-hint">질문 또는 요청을 선택해주세요</div>
      <template v-else>
        <form class="composer-form" @submit.prevent="send">
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
      </template>
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
    <div v-if="showTicketDialog" class="dialog-overlay">
      <div class="dialog dialog--wide">
        <div class="dialog-header">
          <button class="dialog-close" aria-label="닫기" @click="showTicketDialog = false">
            <X :size="18" />
          </button>
          <h3>티켓 발행</h3>
          <p v-if="ticketDrafting">노잇이 요청 내용을 정리하고 있어요…</p>
          <p v-else>노잇이 자동으로 담당 부서를 추천해드립니다.</p>
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
          <button class="btn btn--purple-solid" :disabled="!ticketTitle.trim() || submittingTicket" @click="submitTicket">티켓 발행</button>
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
.welcome-hints {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  text-align: left;
}
.welcome-hints p {
  display: flex;
  align-items: baseline;
  font-size: 14px;
  color: #717182;
  margin: 0;
}
.welcome-hints strong {
  width: 38px;
  flex-shrink: 0;
}
.hint-q { color: #2b7fff; }
.hint-r { color: #8b5cf6; }

.recommended-area {
  padding: 8px 2% 14px;
  background: #f7f8fa;
}
.recommended-shell {
  max-width: 1100px;
  margin: 0 auto;
  padding: 8px 14px;
  border: 1px solid #d6e6dd;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 8px 24px rgba(31, 36, 48, 0.05);
}
.recommended-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  margin-bottom: 8px;
}
.recommended-header:last-child {
  margin-bottom: 0;
}
.recommended-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #717182;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.recommended-toggle:hover {
  background: #edf7f1;
  color: #15803d;
}
.recommended-questions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  padding-left: 44px;
}
.recommended-question {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(100%, 720px);
  min-height: 30px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.52);
  color: #182233;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  box-shadow: none;
  transition: background 0.15s, box-shadow 0.15s, color 0.15s, transform 0.15s;
}
.recommended-question::before {
  content: '';
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 2px;
  background: #22a06b;
  transform: rotate(45deg);
}
.recommended-question:hover:not(:disabled) {
  border-color: #a7d8bd;
  background: #fff;
  box-shadow: 0 8px 22px rgba(21, 128, 61, 0.12);
  color: #1f2430;
  transform: translateX(3px) translateY(-1px);
}
.recommended-question:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.recommended-question-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 모드 카드 ── */
.card { background: #fff; border: 1px solid #eceef2; border-radius: 14px; box-shadow: 0 2px 6px rgba(0,0,0,.05); }
.mode-card { padding: 18px 22px; max-width: 680px; }
.answer-card { padding: 18px 22px; max-width: 680px; font-size: 15px; color: #44403c; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.mode-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.badge { padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
.badge--blue { background: #2b7fff; color: #fff; }
.badge--purple { background: #8b5cf6; color: #fff; }
.mode-change {
  background: none; border: 1px solid; font-size: 12px; font-weight: 600;
  cursor: pointer; padding: 4px 12px; border-radius: 6px;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.mode-change--blue { background: #eff6ff; border-color: #93c5fd; color: #2563eb; }
.mode-change--blue:hover:not(:disabled) { background: #dbeafe; border-color: #60a5fa; }
.mode-change--purple { background: #f5f3ff; border-color: #c4b5fd; color: #7c3aed; }
.mode-change--purple:hover:not(:disabled) { background: #ede9fe; border-color: #a78bfa; }
.mode-change:disabled { opacity: 0.4; cursor: not-allowed; }
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
.help-row { display: none; }
.help-wrap { position: relative; display: inline-flex; }
.help-btn {
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  color: #717182;
  cursor: pointer;
  padding: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}
.help-btn:hover { color: #1f2430; }
.help-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  background: #1f2430;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 10px;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}
.help-wrap:hover .help-tooltip { opacity: 1; }

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
.dialog-header { position: relative; padding: 24px 24px 0; }
.dialog-close {
  position: absolute; top: 16px; right: 16px;
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border: none; border-radius: 8px;
  background: transparent; color: #717182; cursor: pointer;
  transition: background .15s, color .15s;
}
.dialog-close:hover { background: #f3f4f6; color: #1f2430; }
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

@media (max-width: 640px) {
  .knowit-scroll { padding: 24px 16px; }
  .welcome-hero { padding: 36px 0 24px; }
  .hero-title { font-size: 24px; }
  .hero-sub { font-size: 15px; margin-bottom: 24px; }
  .hero-btns { width: 100%; }
  .welcome-hints { width: 100%; }
  .welcome-hints p { font-size: 13px; }
  .recommended-area { padding: 6px 16px 12px; }
  .recommended-shell { width: 100%; padding: 8px 10px; }
  .recommended-header { gap: 6px; margin-bottom: 6px; }
  .recommended-toggle { margin-bottom: 0; }
  .recommended-questions { width: 100%; gap: 6px; padding-left: 0; }
  .recommended-question {
    max-width: 100%;
    min-height: 30px;
    padding: 6px 8px;
    font-size: 12px;
  }
}

</style>
