<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { MessageSquare, BookOpen, X, Send, ChevronRight, Bot, LogOut, Lock } from '@lucide/vue'
import type { WidgetConfig, WidgetPosition } from './config'
import { createWidgetClient } from './widgetApi'
import { isLoggedIn, nickname, setAuth, clearAuth } from './widgetAuth'

type Tab = 'chat' | 'guide'
type Role = 'assistant' | 'user'

interface Message {
  id: number
  role: Role
  content: string
  time: string
}

const props = defineProps<{ config: WidgetConfig }>()
const api = createWidgetClient(props.config)

// ── 위치(data-position) → 루트 컨테이너 인라인 스타일 ──────────────
// "vertical-horizontal" 형식. top 계열은 column-reverse 로 뒤집어
// 런처가 위, 패널이 아래로 펼쳐지게 한다(bottom 계열은 반대).
const POSITION_STYLE: Record<WidgetPosition, Record<string, string>> = {
  'bottom-right': { bottom: '24px', right: '24px', flexDirection: 'column', alignItems: 'flex-end' },
  'bottom-left': { bottom: '24px', left: '24px', flexDirection: 'column', alignItems: 'flex-start' },
  'top-right': { top: '24px', right: '24px', flexDirection: 'column-reverse', alignItems: 'flex-end' },
  'top-left': { top: '24px', left: '24px', flexDirection: 'column-reverse', alignItems: 'flex-start' },
}
const rootStyle = computed(() => POSITION_STYLE[props.config.position])

const nowTime = () =>
  new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

const isOpen = ref(false)
const activeTab = ref<Tab>('chat')
const inputValue = ref('')
const isTyping = ref(false) // 타이핑 인디케이터(...) — 첫 토큰 도착 전까지만 true
const loading = ref(false) // 질문 전송~응답 완료 전체 구간 — 입력/전송 잠금에 사용
const openFaqIdx = ref<number | null>(null)
const messagesEnd = ref<HTMLElement | null>(null)

// 챗봇 세션 — 첫 질문 전송 시 지연 생성한 뒤 재사용한다.
const sessionId = ref<number | null>(null)

let msgSeq = 1
function welcomeMessage(): Message {
  return {
    id: msgSeq++,
    role: 'assistant',
    content: '안녕하세요! 저는 노잇이에요 👋\n업무 관련 무엇이든 도와드릴게요!',
    time: '오전 10:00',
  }
}
const messages = ref<Message[]>([welcomeMessage()])

// ── 로그인 ──────────────────────────────────────────────────────
// 위젯은 외부 사이트라 로그인 사용자가 없다. 챗봇 이용 전 위젯 자체 로그인을 거치고,
// 받은 accessToken 으로 Bearer 인증해 기존 BE 챗봇을 그대로 사용한다.
const loginId = ref('')
const loginPw = ref('')
const loginError = ref('')
const loggingIn = ref(false)

async function handleLogin() {
  if (!loginId.value.trim() || !loginPw.value) {
    loginError.value = '사번과 비밀번호를 입력해 주세요.'
    return
  }
  loggingIn.value = true
  loginError.value = ''
  try {
    const data = await api.login(loginId.value.trim(), loginPw.value)
    if (data.status === 'INACTIVE') {
      loginError.value = '비활성화된 계정입니다. 관리자에게 문의해주세요.'
      return
    }
    setAuth(data.accessToken, data.nickname)
    loginPw.value = ''
    loginError.value = ''
    // 새 사용자 기준으로 대화를 초기화한다.
    sessionId.value = null
    messages.value = [welcomeMessage()]
  } catch (e) {
    loginError.value = (e as Error).message || '사번 또는 비밀번호가 올바르지 않습니다.'
  } finally {
    loggingIn.value = false
  }
}

function handleLogout() {
  clearAuth()
  sessionId.value = null
  messages.value = [welcomeMessage()]
  loginId.value = ''
  loginPw.value = ''
  loginError.value = ''
}

const TABS: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: '노잇', icon: MessageSquare },
  { id: 'guide', label: '사용법', icon: BookOpen },
]

const faqItems = [
  {
    q: 'Workipedia는 어떻게 사용하나요?',
    a: "Workipedia는 사내 지식 공유 플랫폼입니다. AI 챗봇 '노잇'을 통해 업무 관련 질문에 즉시 답변을 받을 수 있습니다. 메인 화면의 노잇 챗봇에 궁금한 점을 물어보세요!",
  },
  {
    q: '포인트는 어떻게 얻나요?',
    a: '워키 작성(+20P), 댓글 작성(+5P), 좋아요 받기(+10P), 채택 답변(+50P), 티켓 처리(+30P) 등의 활동으로 포인트를 적립할 수 있습니다. 매일 로그인하면 출석 포인트(+5P)도 받을 수 있어요!',
  },
  {
    q: '포인트는 어디에 사용하나요?',
    a: '포인트는 사내 복지 상품 교환, 기프티콘 구매, 사내 카페 이용권 등에 사용할 수 있습니다. 마이페이지에서 현재 포인트를 확인해보세요!',
  },
  {
    q: 'ESG 포인트와 레벨 시스템은 무엇인가요?',
    a: 'ESG 포인트는 지식 공유를 통한 환경 기여도를 나타냅니다. LV1(0~100p), LV2(101~300p), LV3(301~700p), LV4(700p~) 4단계로 구성됩니다.',
  },
]

const FALLBACK = '해당 질문에 대한 내용을 찾을 수 없습니다.'

// 새 메시지 추가(messages), 패널 열기(isOpen), 탭 복귀(activeTab) 시
// 모두 메시지 목록 맨 아래로 스크롤한다.
// nextTick 없이 실행하면 DOM 반영 전에 scrollIntoView가 호출되어 이전 위치로 이동한다.
// 스트림 token 누적은 배열 요소 내부를 바꾸므로 deep watch 가 필요하다.
watch([messages, isOpen, activeTab], async () => {
  if (isOpen.value && activeTab.value === 'chat') {
    await nextTick()
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth' })
  }
}, { deep: true })

// Enter 전송 — 한글 등 IME 조합 중(isComposing)에는 무시한다.
// 조합 중 Enter로 보내면, 입력을 비운 직후 compositionend가 마지막 글자를
// 다시 입력창에 채워 넣어 "값이 안 비워지는" 것처럼 보이는 버그가 생긴다.
function onEnter(e: KeyboardEvent) {
  if (e.isComposing) return
  sendMessage()
}

// 질문 전송 → 실제 챗봇 스트림(token/done)을 받아 타자 효과로 답변을 출력한다.
// SPA(KnowItView)의 send() 흐름을 위젯 단일 채팅에 맞춰 옮긴 것이다.
async function sendMessage() {
  const q = inputValue.value.trim()
  if (!q || loading.value) return

  messages.value.push({ id: msgSeq++, role: 'user', content: q, time: nowTime() })
  inputValue.value = ''
  loading.value = true
  isTyping.value = true

  // done 으로 답변 버블을 이미 출력했는지 추적 — done 직후 스트림 종료가
  // catch 로 잡힐 때 폴백 문구가 중복 추가되는 것을 막는다.
  let answered = false
  let answerIdx = -1

  try {
    // 세션은 첫 질문에 지연 생성하고 이후 재사용한다.
    if (!sessionId.value) {
      const s = await api.createSession()
      sessionId.value = s.sessionId
    }
    const sid = sessionId.value

    await api.streamMessage(sid, q, {
      onToken: (chunk) => {
        // 첫 token 도착 시 타이핑 인디케이터를 빈 답변 버블로 교체한다.
        if (answerIdx === -1) {
          isTyping.value = false
          messages.value.push({ id: msgSeq++, role: 'assistant', content: '', time: nowTime() })
          answerIdx = messages.value.length - 1
        }
        messages.value[answerIdx]!.content += chunk
      },
      onDone: (saved) => {
        isTyping.value = false
        // 누적 token 과 최종 content 가 다를 수 있어 done.content 로 확정한다.
        // answerable=false 면 RAG 가 관련 지식을 못 찾은 상태 → 친화적 폴백 문구로 대체.
        const text = saved.answerable ? saved.content : FALLBACK
        if (answerIdx === -1) {
          messages.value.push({ id: msgSeq++, role: 'assistant', content: text, time: nowTime() })
          answerIdx = messages.value.length - 1
        } else {
          messages.value[answerIdx]!.content = text
        }
        answered = true
      },
    })
  } catch {
    // 스트림/세션 오류 시 표준 폴백 — 단, done 으로 이미 답변이 나온 뒤라면 추가하지 않는다.
    if (!answered) {
      messages.value.push({ id: msgSeq++, role: 'assistant', content: FALLBACK, time: nowTime() })
    }
  } finally {
    // 응답이 끝나면(성공·실패 무관) 입력 잠금을 푼다.
    loading.value = false
    isTyping.value = false
  }
}
</script>

<template>
  <div class="wk-widget" :data-theme="config.theme" :style="rootStyle">
    <!-- Panel: flex-column 상단에 위치하므로 launcher 위에 자연스럽게 표시됨 -->
    <div v-if="isOpen" class="wk-panel">
      <!-- Header -->
      <div class="wk-header">
        <div class="wk-logo">
          <div class="wk-logo-icon">W</div>
          <div>
            <p class="wk-logo-name">Workipedia</p>
            <p class="wk-logo-sub">{{ isLoggedIn ? `${nickname}님` : 'AI 업무 어시스턴트' }}</p>
          </div>
        </div>
        <div class="wk-header-actions">
          <button v-if="isLoggedIn" class="wk-icon-btn" @click="handleLogout" aria-label="로그아웃" title="로그아웃">
            <LogOut :size="14" />
          </button>
          <button class="wk-icon-btn" @click="isOpen = false" aria-label="닫기">
            <X :size="14" />
          </button>
        </div>
      </div>

      <!-- Tab bar -->
      <div class="wk-tabbar">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          :class="['wk-tab', activeTab === tab.id && 'wk-tab--active']"
          @click="activeTab = tab.id"
        >
          <component :is="tab.icon" :size="14" />
          <span>{{ tab.label }}</span>
          <div v-if="activeTab === tab.id" class="wk-tab-indicator" />
        </button>
      </div>

      <!-- ───── 노잇 챗봇 ───── -->
      <div v-if="activeTab === 'chat'" class="wk-chat">
        <!-- 로그인 전: 로그인 폼 -->
        <div v-if="!isLoggedIn" class="wk-login">
          <div class="wk-login-icon"><Lock :size="20" /></div>
          <p class="wk-login-title">로그인이 필요해요</p>
          <p class="wk-login-sub">노잇을 이용하려면 Workipedia 계정으로 로그인해 주세요.</p>
          <form class="wk-login-form" @submit.prevent="handleLogin">
            <input
              v-model="loginId"
              class="wk-field"
              placeholder="사번"
              autocomplete="username"
            />
            <input
              v-model="loginPw"
              type="password"
              class="wk-field"
              placeholder="비밀번호"
              autocomplete="current-password"
            />
            <p v-if="loginError" class="wk-login-error">{{ loginError }}</p>
            <button type="submit" class="wk-login-btn" :disabled="loggingIn">
              {{ loggingIn ? '로그인 중...' : '로그인' }}
            </button>
          </form>
        </div>

        <!-- 로그인 후: 채팅 -->
        <template v-else>
        <div class="wk-messages">
          <div
            v-for="msg in messages"
            :key="msg.id"
            :class="['wk-msg-row', msg.role === 'user' && 'wk-msg-row--user']"
          >
            <div v-if="msg.role === 'assistant'" class="wk-avatar">
              <Bot :size="14" />
            </div>
            <div :class="['wk-msg-group', msg.role === 'user' && 'wk-msg-group--user']">
              <div :class="['wk-bubble', msg.role === 'user' ? 'wk-bubble--user' : 'wk-bubble--bot']">
                {{ msg.content }}
              </div>
              <span class="wk-time">{{ msg.time }}</span>
            </div>
          </div>

          <div v-if="isTyping" class="wk-msg-row">
            <div class="wk-avatar"><Bot :size="14" /></div>
            <div class="wk-typing">
              <span
                v-for="i in 3"
                :key="i"
                class="wk-dot"
                :style="{ animationDelay: `${(i - 1) * 0.15}s` }"
              />
            </div>
          </div>

          <div ref="messagesEnd" />
        </div>

        <div class="wk-input-area">
          <div class="wk-input-wrap">
            <input
              v-model="inputValue"
              class="wk-input"
              :placeholder="loading ? '노잇이 답변 중이에요...' : '노잇에게 무엇이든 물어보세요...'"
              :disabled="loading"
              @keydown.enter="onEnter"
            />
            <button class="wk-send" :disabled="loading" @click="sendMessage" aria-label="전송">
              <Send :size="11" />
            </button>
          </div>
        </div>
        </template>
      </div>

      <!-- ───── 사용법 FAQ ───── -->
      <div v-else-if="activeTab === 'guide'" class="wk-guide">
        <div class="wk-guide-head">
          <p class="wk-guide-title">시스템 사용법</p>
          <p class="wk-guide-sub">자주 묻는 질문을 확인해보세요</p>
        </div>
        <div class="wk-faq-list">
          <div
            v-for="(item, i) in faqItems"
            :key="i"
            :class="['wk-faq-item', openFaqIdx === i && 'wk-faq-item--open']"
          >
            <button class="wk-faq-q" @click="openFaqIdx = openFaqIdx === i ? null : i">
              <span :class="['wk-faq-q-text', openFaqIdx === i && 'wk-faq-q-text--open']">{{ item.q }}</span>
              <ChevronRight
                :size="13"
                :class="['wk-faq-chevron', openFaqIdx === i && 'wk-faq-chevron--open']"
              />
            </button>
            <div v-if="openFaqIdx === i" class="wk-faq-a">{{ item.a }}</div>
          </div>
        </div>
      </div>
    </div>

    <!--
      런처 버튼: MessageSquare ↔ X 아이콘을 v-if 대신 두 span을 겹쳐 opacity+rotate로 전환한다.
      v-if 방식은 DOM 추가/제거 시 레이아웃이 흔들려 애니메이션이 어색하고,
      transition 그룹 설정도 복잡해진다. 두 span을 position:absolute로 포개고
      transform/opacity만 바꾸면 부드러운 모핑 효과를 얻을 수 있다.
    -->
    <button class="wk-launcher" @click="isOpen = !isOpen" aria-label="Workipedia 위젯 열기">
      <span
        class="wk-launch-icon"
        :style="{
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          opacity: isOpen ? 0 : 1,
        }"
      >
        <MessageSquare :size="22" />
      </span>
      <span
        class="wk-launch-icon wk-launch-icon--abs"
        :style="{
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-180deg)',
          opacity: isOpen ? 1 : 0,
        }"
      >
        <X :size="22" />
      </span>
    </button>
  </div>
</template>

<style scoped>
/* ── 테마 토큰 ─────────────────────────────────────────────────────
   패널 배경 위에 올라오는 표면/텍스트만 변수화한다.
   보라/초록 그래디언트 카드, user 말풍선, 런처처럼 항상 유색 배경 위에
   흰 글씨가 올라가는 요소는 테마와 무관하므로 리터럴을 유지한다.
   기본값 = 다크. [data-theme="light"] 에서만 덮어쓴다. */
.wk-widget {
  --wk-accent: #7c5cfc;
  --wk-accent-hover: #6d4fea;
  --wk-accent-soft: #a78bfa; /* 탭 활성, 셰브론 open */
  --wk-panel-bg: #0f1117;
  --wk-border: rgba(255, 255, 255, 0.1);
  --wk-border-soft: rgba(255, 255, 255, 0.08);
  --wk-border-faint: rgba(255, 255, 255, 0.05);
  --wk-text: #ffffff;
  --wk-text-strong: rgba(255, 255, 255, 0.9);
  --wk-text-dim: rgba(255, 255, 255, 0.55);
  --wk-text-muted: rgba(255, 255, 255, 0.4);
  --wk-text-faint: rgba(255, 255, 255, 0.3);
  --wk-text-ghost: rgba(255, 255, 255, 0.22);
  --wk-surface: rgba(255, 255, 255, 0.08);
  --wk-surface-2: rgba(255, 255, 255, 0.04);
  --wk-surface-hover: rgba(255, 255, 255, 0.1);
  --wk-input-bg: rgba(255, 255, 255, 0.07);
  --wk-faq-q: rgba(255, 255, 255, 0.75);
  --wk-faq-q-open: #c4b5fd;
  --wk-panel-shadow: 0 24px 64px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(124, 92, 252, 0.2);
}
.wk-widget[data-theme='light'] {
  --wk-accent-soft: #7c5cfc;
  --wk-panel-bg: #ffffff;
  --wk-border: rgba(0, 0, 0, 0.1);
  --wk-border-soft: rgba(0, 0, 0, 0.07);
  --wk-border-faint: rgba(0, 0, 0, 0.06);
  --wk-text: #16161d;
  --wk-text-strong: #2a2a35;
  --wk-text-dim: rgba(0, 0, 0, 0.55);
  --wk-text-muted: rgba(0, 0, 0, 0.45);
  --wk-text-faint: rgba(0, 0, 0, 0.4);
  --wk-text-ghost: rgba(0, 0, 0, 0.32);
  --wk-surface: rgba(0, 0, 0, 0.05);
  --wk-surface-2: rgba(0, 0, 0, 0.025);
  --wk-surface-hover: rgba(0, 0, 0, 0.06);
  --wk-input-bg: rgba(0, 0, 0, 0.045);
  --wk-faq-q: rgba(0, 0, 0, 0.7);
  --wk-faq-q-open: #7c5cfc;
  --wk-panel-shadow: 0 24px 64px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(124, 92, 252, 0.15);
}

/* ── 루트 ─────────────────────────────────────────────────────── */
/* top/bottom/left/right/flex-direction/align-items 는 data-position 에 따라
   인라인 스타일(rootStyle)로 주입된다. */
.wk-widget {
  position: fixed;
  z-index: 99999;
  display: flex;
  gap: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans KR', 'Segoe UI', sans-serif;
}

/* ── 패널 ─────────────────────────────────────────────────────── */
.wk-panel {
  width: 370px;
  height: 560px;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--wk-panel-bg);
  border: 1px solid var(--wk-border);
  box-shadow: var(--wk-panel-shadow);
}

/* ── 헤더 ─────────────────────────────────────────────────────── */
.wk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--wk-border-soft);
  flex-shrink: 0;
}
.wk-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}
.wk-logo-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #7c5cfc, #5b21b6);
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wk-logo-name {
  color: var(--wk-text);
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 1px;
  line-height: 1;
}
.wk-logo-sub {
  color: var(--wk-text-faint);
  font-size: 10px;
  margin: 0;
  line-height: 1;
}
.wk-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.wk-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--wk-text-faint);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.wk-icon-btn:hover {
  color: var(--wk-text);
  background: var(--wk-surface-hover);
}

/* ── 탭바 ─────────────────────────────────────────────────────── */
.wk-tabbar {
  display: flex;
  border-bottom: 1px solid var(--wk-border-soft);
  flex-shrink: 0;
}
.wk-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 0 9px;
  border: none;
  background: transparent;
  color: var(--wk-text-faint);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: color 0.15s;
}
.wk-tab:hover { color: var(--wk-text-dim); }
.wk-tab--active { color: var(--wk-accent-soft); }
.wk-tab-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2px;
  border-radius: 99px;
  background: var(--wk-accent);
}

/* ── 채팅 ─────────────────────────────────────────────────────── */
.wk-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0; /* flex 기본값 min-height:auto 를 0으로 덮어야 자식이 부모 높이에 구속됨 */
}
.wk-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-width: none;
  min-height: 0; /* 동일한 이유 — 없으면 콘텐츠 크기로 확장되어 스크롤이 동작하지 않음 */
}
.wk-messages::-webkit-scrollbar { display: none; }
.wk-msg-row {
  display: flex;
  gap: 8px;
}
.wk-msg-row--user { flex-direction: row-reverse; }
.wk-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(124, 92, 252, 0.2);
  border: 1px solid rgba(124, 92, 252, 0.3);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
  color: var(--wk-accent-soft);
}
.wk-msg-group {
  max-width: 76%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wk-msg-group--user { align-items: flex-end; }
.wk-bubble {
  padding: 9px 12px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.wk-bubble--bot {
  background: var(--wk-surface);
  color: var(--wk-text-strong);
  border-top-left-radius: 4px;
}
.wk-bubble--user {
  background: #7c5cfc;
  color: #fff;
  border-top-right-radius: 4px;
}
.wk-time {
  color: var(--wk-text-ghost);
  font-size: 9px;
}

/* 타이핑 인디케이터 */
.wk-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  border-radius: 12px;
  border-top-left-radius: 4px;
  background: var(--wk-surface);
}
.wk-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wk-text-muted);
  display: inline-block;
  animation: wk-bounce 0.9s infinite;
}
@keyframes wk-bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-5px); }
}

/* 입력 영역 */
.wk-input-area {
  padding: 12px;
  border-top: 1px solid var(--wk-border-soft);
  flex-shrink: 0;
}
.wk-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--wk-input-bg);
  border-radius: 12px;
  padding: 8px 12px;
  transition: box-shadow 0.15s;
}
.wk-input-wrap:focus-within {
  box-shadow: 0 0 0 1.5px rgba(124, 92, 252, 0.5);
}
.wk-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--wk-text);
  font-size: 12px;
  font-family: inherit;
}
.wk-input::placeholder { color: var(--wk-text-faint); }
.wk-send {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: none;
  background: var(--wk-accent);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}
.wk-send:hover { background: var(--wk-accent-hover); }
.wk-send:disabled { opacity: 0.5; cursor: default; }
.wk-input:disabled { cursor: default; }
/* 답변 대기 중 입력 영역 비활성 느낌 */
.wk-input-wrap:has(.wk-input:disabled) { opacity: 0.6; }

/* ── 로그인 ───────────────────────────────────────────────────── */
.wk-login {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 28px 36px;
  text-align: center;
}
.wk-login-icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: rgba(124, 92, 252, 0.15);
  border: 1px solid rgba(124, 92, 252, 0.3);
  color: var(--wk-accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.wk-login-title {
  color: var(--wk-text);
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 6px;
}
.wk-login-sub {
  color: var(--wk-text-dim);
  font-size: 12px;
  line-height: 1.55;
  margin: 0 0 20px;
}
.wk-login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.wk-field {
  width: 100%;
  box-sizing: border-box;
  background: var(--wk-input-bg);
  border: 1px solid var(--wk-border-soft);
  border-radius: 10px;
  padding: 11px 13px;
  color: var(--wk-text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.wk-field::placeholder { color: var(--wk-text-faint); }
.wk-field:focus {
  border-color: transparent;
  box-shadow: 0 0 0 1.5px rgba(124, 92, 252, 0.5);
}
.wk-login-error {
  color: #f87171;
  font-size: 11px;
  margin: 0;
  text-align: left;
}
.wk-login-btn {
  margin-top: 3px;
  width: 100%;
  border: none;
  border-radius: 10px;
  padding: 11px;
  background: var(--wk-accent);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.wk-login-btn:hover { background: var(--wk-accent-hover); }
.wk-login-btn:disabled { opacity: 0.6; cursor: default; }

/* ── FAQ ─────────────────────────────────────────────────────── */
.wk-guide {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  scrollbar-width: none;
  min-height: 0; /* wk-chat와 동일한 이유 */
}
.wk-guide::-webkit-scrollbar { display: none; }
.wk-guide-head { margin-bottom: 14px; }
.wk-guide-title {
  color: var(--wk-text);
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 3px;
}
.wk-guide-sub {
  color: var(--wk-text-muted);
  font-size: 11px;
  margin: 0;
}
.wk-faq-list { display: flex; flex-direction: column; gap: 8px; }
.wk-faq-item {
  border-radius: 12px;
  border: 1px solid var(--wk-border-faint);
  background: var(--wk-surface-2);
  transition: border-color 0.15s, background 0.15s;
}
.wk-faq-item--open {
  border-color: rgba(124, 92, 252, 0.35);
  background: rgba(124, 92, 252, 0.08);
}
.wk-faq-q {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
.wk-faq-q-text {
  color: var(--wk-faq-q);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  flex: 1;
}
.wk-faq-q-text--open { color: var(--wk-faq-q-open); }
.wk-faq-chevron {
  color: var(--wk-text-faint);
  transition: transform 0.2s;
  flex-shrink: 0;
  margin-top: 1px;
}
.wk-faq-chevron--open {
  transform: rotate(90deg);
  color: var(--wk-accent-soft);
}
.wk-faq-a {
  padding: 0 14px 13px;
  color: var(--wk-text-dim);
  font-size: 11px;
  line-height: 1.65;
}

/* ── 런처 버튼 ────────────────────────────────────────────────── */
.wk-launcher {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  border: none;
  background: var(--wk-accent);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(124, 92, 252, 0.5);
  transition: transform 0.15s;
}
.wk-launcher:hover  { transform: scale(1.06); }
.wk-launcher:active { transform: scale(0.94); }

.wk-launch-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.22s ease, opacity 0.22s ease;
}
.wk-launch-icon--abs { position: absolute; }
</style>
