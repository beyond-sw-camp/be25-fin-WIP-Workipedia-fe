<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { MessageSquare, BookOpen, User, X, Send, ChevronRight, Star, Award, History, Bot } from '@lucide/vue'

type Tab = 'chat' | 'guide' | 'mypage'
type Role = 'assistant' | 'user'

interface Message {
  id: number
  role: Role
  content: string
  time: string
}

const nowTime = () =>
  new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

const isOpen = ref(false)
const activeTab = ref<Tab>('chat')
const inputValue = ref('')
const isTyping = ref(false)
const openFaqIdx = ref<number | null>(null)
const messagesEnd = ref<HTMLElement | null>(null)

const messages = ref<Message[]>([
  {
    id: 1,
    role: 'assistant',
    content: '안녕하세요! 저는 노잇이에요 👋\n업무 관련 무엇이든 도와드릴게요!',
    time: '오전 10:00',
  },
])

const aiReplies = [
  '네, 도움 드릴 수 있어요! 더 자세한 내용을 알려주시면 정확하게 안내해 드릴게요.',
  '좋은 질문이에요! Workipedia에서 해당 기능을 활용하면 효율적으로 처리할 수 있답니다.',
  '이해했어요. 지금 바로 분석해드릴게요. 잠시만 기다려 주세요!',
  '맞아요! 포인트를 활용하면 프리미엄 AI 분석도 이용하실 수 있어요.',
]

const TABS: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: '노잇', icon: MessageSquare },
  { id: 'guide', label: '사용법', icon: BookOpen },
  { id: 'mypage', label: '마이페이지', icon: User },
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

const pointsHistory = [
  { id: 1, type: 'earn', desc: '일일 출석 체크', points: 10, date: '2026.05.26' },
  { id: 2, type: 'earn', desc: '업무 완료 보상', points: 50, date: '2026.05.25' },
  { id: 3, type: 'use', desc: 'AI 분석 요청', points: -30, date: '2026.05.24' },
  { id: 4, type: 'earn', desc: '리뷰 작성', points: 20, date: '2026.05.23' },
  { id: 5, type: 'use', desc: '프리미엄 기능 이용', points: -100, date: '2026.05.22' },
]

// 새 메시지 추가(messages), 패널 열기(isOpen), 탭 복귀(activeTab) 시
// 모두 메시지 목록 맨 아래로 스크롤한다.
// nextTick 없이 실행하면 DOM 반영 전에 scrollIntoView가 호출되어 이전 위치로 이동한다.
watch([messages, isOpen, activeTab], async () => {
  if (isOpen.value && activeTab.value === 'chat') {
    await nextTick()
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth' })
  }
})

function sendMessage() {
  if (!inputValue.value.trim()) return
  messages.value.push({
    id: messages.value.length + 1,
    role: 'user',
    content: inputValue.value,
    time: nowTime(),
  })
  inputValue.value = ''
  isTyping.value = true
  setTimeout(() => {
    isTyping.value = false
    const reply = aiReplies[Math.floor(Math.random() * aiReplies.length)]!
    messages.value.push({
      id: messages.value.length + 1,
      role: 'assistant',
      content: reply,
      time: nowTime(),
    })
  }, 1400)
}
</script>

<template>
  <div class="wk-widget">
    <!-- Panel: flex-column 상단에 위치하므로 launcher 위에 자연스럽게 표시됨 -->
    <div v-if="isOpen" class="wk-panel">
      <!-- Header -->
      <div class="wk-header">
        <div class="wk-logo">
          <div class="wk-logo-icon">W</div>
          <div>
            <p class="wk-logo-name">Workipedia</p>
            <p class="wk-logo-sub">AI 업무 어시스턴트</p>
          </div>
        </div>
        <button class="wk-close" @click="isOpen = false" aria-label="닫기">
          <X :size="14" />
        </button>
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
              placeholder="노잇에게 무엇이든 물어보세요..."
              @keydown.enter="sendMessage"
            />
            <button class="wk-send" @click="sendMessage" aria-label="전송">
              <Send :size="11" />
            </button>
          </div>
        </div>
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

      <!-- ───── 마이페이지 ───── -->
      <div v-else-if="activeTab === 'mypage'" class="wk-mypage">
        <div class="wk-profile">
          <div class="wk-avatar-lg">김</div>
          <div class="wk-profile-info">
            <div class="wk-profile-row">
              <span class="wk-label">사번</span>
              <span class="wk-value-dim">EMP-2024-0312</span>
            </div>
            <div class="wk-profile-row">
              <span class="wk-label">닉네임</span>
              <span class="wk-value">김워크</span>
            </div>
            <div class="wk-profile-row">
              <span class="wk-label">이메일</span>
              <span class="wk-value-dim">kim.work@company.com</span>
            </div>
          </div>
        </div>

        <div class="wk-cards">
          <div class="wk-card wk-card--violet">
            <div class="wk-card-circle" />
            <p class="wk-card-label">보유 포인트</p>
            <div class="wk-card-val-row">
              <span class="wk-card-val">2,430</span>
              <span class="wk-card-unit">P</span>
            </div>
            <div class="wk-card-sub">
              <Star :size="10" /><span>이번 달 +80P</span>
            </div>
          </div>
          <div class="wk-card wk-card--green">
            <div class="wk-card-circle" />
            <p class="wk-card-label">ESG 점수</p>
            <div class="wk-card-val-row">
              <span class="wk-card-val">340</span>
              <span class="wk-card-unit">p</span>
            </div>
            <div class="wk-card-sub">
              <span class="wk-lv-badge">LV3</span>
            </div>
          </div>
        </div>

        <div class="wk-history">
          <p class="wk-history-title">최근 내역</p>
          <div class="wk-history-list">
            <div v-for="item in pointsHistory" :key="item.id" class="wk-hist-row">
              <div class="wk-hist-left">
                <div :class="['wk-hist-icon', item.type === 'earn' ? 'wk-hist-icon--earn' : 'wk-hist-icon--use']">
                  <component :is="item.type === 'earn' ? Award : History" :size="12" />
                </div>
                <div>
                  <p class="wk-hist-desc">{{ item.desc }}</p>
                  <p class="wk-hist-date">{{ item.date }}</p>
                </div>
              </div>
              <span :class="['wk-hist-pts', item.type === 'earn' ? 'wk-hist-pts--earn' : 'wk-hist-pts--use']">
                {{ item.points > 0 ? '+' : '' }}{{ item.points }}P
              </span>
            </div>
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
/* ── 루트 ─────────────────────────────────────────────────────── */
.wk-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
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
  background: #0f1117;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(124, 92, 252, 0.2);
}

/* ── 헤더 ─────────────────────────────────────────────────────── */
.wk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 1px;
  line-height: 1;
}
.wk-logo-sub {
  color: rgba(255, 255, 255, 0.35);
  font-size: 10px;
  margin: 0;
  line-height: 1;
}
.wk-close {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.wk-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

/* ── 탭바 ─────────────────────────────────────────────────────── */
.wk-tabbar {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
  color: rgba(255, 255, 255, 0.3);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: color 0.15s;
}
.wk-tab:hover { color: rgba(255, 255, 255, 0.6); }
.wk-tab--active { color: #a78bfa; }
.wk-tab-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2px;
  border-radius: 99px;
  background: #7c5cfc;
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
  color: #a78bfa;
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
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  border-top-left-radius: 4px;
}
.wk-bubble--user {
  background: #7c5cfc;
  color: #fff;
  border-top-right-radius: 4px;
}
.wk-time {
  color: rgba(255, 255, 255, 0.2);
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
  background: rgba(255, 255, 255, 0.08);
}
.wk-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
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
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}
.wk-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.07);
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
  color: #fff;
  font-size: 12px;
  font-family: inherit;
}
.wk-input::placeholder { color: rgba(255, 255, 255, 0.25); }
.wk-send {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: none;
  background: #7c5cfc;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}
.wk-send:hover { background: #6d4fea; }

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
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 3px;
}
.wk-guide-sub {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  margin: 0;
}
.wk-faq-list { display: flex; flex-direction: column; gap: 8px; }
.wk-faq-item {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.04);
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
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  flex: 1;
}
.wk-faq-q-text--open { color: #c4b5fd; }
.wk-faq-chevron {
  color: rgba(255, 255, 255, 0.25);
  transition: transform 0.2s;
  flex-shrink: 0;
  margin-top: 1px;
}
.wk-faq-chevron--open {
  transform: rotate(90deg);
  color: #a78bfa;
}
.wk-faq-a {
  padding: 0 14px 13px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  line-height: 1.65;
}

/* ── 마이페이지 ───────────────────────────────────────────────── */
.wk-mypage {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
  min-height: 0; /* wk-chat와 동일한 이유 */
}
.wk-mypage::-webkit-scrollbar { display: none; }

.wk-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.wk-avatar-lg {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  flex-shrink: 0;
  background: linear-gradient(135deg, #7c5cfc, #5b21b6);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wk-profile-info { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.wk-profile-row { display: flex; align-items: center; gap: 8px; }
.wk-label { color: rgba(255, 255, 255, 0.28); font-size: 9px; min-width: 30px; }
.wk-value { color: #fff; font-size: 11px; font-weight: 600; }
.wk-value-dim { color: rgba(255, 255, 255, 0.55); font-size: 11px; }

.wk-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 14px 16px;
}
.wk-card {
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  padding: 14px;
}
.wk-card--violet { background: linear-gradient(135deg, #7c5cfc 0%, #5b21b6 100%); }
.wk-card--green { background: linear-gradient(135deg, #059669 0%, #065f46 100%); }
.wk-card-circle {
  position: absolute;
  right: -14px;
  top: -14px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
}
.wk-card-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
  font-weight: 500;
  margin: 0 0 7px;
  position: relative;
  z-index: 1;
}
.wk-card-val-row {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  position: relative;
  z-index: 1;
}
.wk-card-val { color: #fff; font-size: 22px; font-weight: 700; line-height: 1; }
.wk-card-unit { color: rgba(255, 255, 255, 0.7); font-size: 12px; font-weight: 500; margin-bottom: 1px; }
.wk-card-sub {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 7px;
  position: relative;
  z-index: 1;
  color: rgba(255, 255, 255, 0.7);
  font-size: 9px;
}
.wk-lv-badge {
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
}

.wk-history { padding: 0 16px 16px; }
.wk-history-title {
  color: rgba(255, 255, 255, 0.35);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin: 0 0 10px;
}
.wk-history-list { display: flex; flex-direction: column; }
.wk-hist-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.wk-hist-left { display: flex; align-items: center; gap: 10px; }
.wk-hist-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wk-hist-icon--earn { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.wk-hist-icon--use  { background: rgba(239, 68, 68, 0.15);  color: #f87171; }
.wk-hist-desc {
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  font-weight: 500;
  margin: 0;
}
.wk-hist-date {
  color: rgba(255, 255, 255, 0.25);
  font-size: 9px;
  margin: 0;
}
.wk-hist-pts { font-size: 12px; font-weight: 700; }
.wk-hist-pts--earn { color: #34d399; }
.wk-hist-pts--use  { color: #f87171; }

/* ── 런처 버튼 ────────────────────────────────────────────────── */
.wk-launcher {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  border: none;
  background: #7c5cfc;
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
