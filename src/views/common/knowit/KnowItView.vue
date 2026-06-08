<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { User, Bot } from '@lucide/vue'
import Composer from '@/components/common/Composer.vue'
import SourceCard from '@/components/common/SourceCard.vue'
import type { Source } from '@/components/common/SourceCard.vue'

const router = useRouter()

interface Message {
  who: 'me' | 'bot'
  kind?: 'mode' | 'sources' | 'actions' | 'text'
  text?: string
  sources?: Source[]
}

const scrollEl = ref<HTMLElement | null>(null)
const val = ref('')
const msgs = ref<Message[]>([
  {
    who: 'bot',
    kind: 'mode',
    text: '사내 위키와 문서를 검색해 답변을 찾아드릴게요. 예: 5층 카페테리아는 언제 열어요? / 연말에 연 사용율은 어디서 확인해요?',
  },
])

function makeAnswer(): Message {
  return {
    who: 'bot',
    kind: 'sources',
    sources: [
      {
        type: '티켓 답변',
        cls: 'blue',
        meta: '인사팀 · 박이화',
        date: '2025.05.15',
        body: '연차 신청은 반드시 사용일 기준 3일 전(72시간)까지 완료하셔야 합니다. HR 시스템에서 신청하시면 담당자 승인 후 자동으로 등록됩니다.',
        link: '워키에서 보기',
      },
      {
        type: '매뉴얼',
        cls: 'green',
        meta: '2025.03 개정',
        body: '연차는 3일 전까지 신청하여야 합니다. 단일 승인 후 HR 시스템 등록됩니다.',
        link: '매뉴얼에서 보기',
      },
      {
        type: '채팅 답변',
        cls: 'gray',
        meta: '인사팀 · 한다',
        date: '2025.04.10',
        body: '신규 입사자도 동일하게 3일 전까지 신청하면 됩니다. 팀 사람에게 미리 공유해 주세요!',
        link: '워키에서 보기',
      },
    ],
  }
}

const scroll = () =>
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  })

function send() {
  const q = val.value.trim()
  if (!q) return
  val.value = ''
  msgs.value.push({ who: 'me', kind: 'text', text: q })
  scroll()
  setTimeout(() => {
    msgs.value.push(makeAnswer())
    msgs.value.push({ who: 'bot', kind: 'actions' })
    scroll()
  }, 450)
}
</script>

<template>
  <div class="knowit-page">
    <div ref="scrollEl" class="knowit-scroll">
      <div class="knowit-inner">
        <div class="me-bubble-wrap">
          <span class="bubble-me">질문</span>
        </div>

        <template v-for="(m, i) in msgs" :key="i">
          <div v-if="m.who === 'me'" class="msg-me">
            <div class="bubble-user">{{ m.text }}</div>
            <span class="chat-av"><User :size="18" /></span>
          </div>

          <div v-else-if="m.kind === 'mode'" class="msg-bot">
            <span class="chat-av"><Bot :size="18" /></span>
            <div class="card mode-card">
              <div class="mode-header">
                <span class="badge blue">질문 모드</span>
                <button class="mode-change">변경</button>
              </div>
              <p class="mode-text">{{ m.text }}</p>
            </div>
          </div>

          <div v-else-if="m.kind === 'sources'" class="msg-bot">
            <span class="chat-av"><Bot :size="18" /></span>
            <div class="sources-list">
              <SourceCard v-for="(s, j) in m.sources" :key="j" :source="s" />
            </div>
          </div>

          <div v-else-if="m.kind === 'actions'" class="msg-actions">
            <button class="btn" @click="router.push('/worki/new')">+ 워키에 질문 등록하기</button>
            <button class="btn ghost-purple" @click="router.push('/tickets/new')">담당 부서에 문의하기</button>
          </div>
        </template>
      </div>
    </div>

    <Composer v-model="val" placeholder="예: 5층 카페테리아는 언제 열어요?" @send="send" />
  </div>
</template>

<style scoped>
.knowit-page { display: flex; flex-direction: column; height: 100%; }
.knowit-scroll { flex: 1; overflow-y: auto; padding: 32px 8%; }
.knowit-inner {
  max-width: 940px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.me-bubble-wrap { display: flex; justify-content: flex-end; }
.bubble-me {
  background: #2b7fff;
  color: #fff;
  padding: 8px 18px;
  border-radius: 12px;
  font-weight: 600;
}
.msg-me { display: flex; justify-content: flex-end; align-items: flex-start; gap: 12px; }
.bubble-user {
  background: #2b7fff;
  color: #fff;
  padding: 14px 20px;
  border-radius: 16px;
  font-size: 16px;
  max-width: 560px;
  line-height: 1.5;
}
.msg-bot { display: flex; gap: 12px; align-items: flex-start; }
.mode-card { padding: 16px 20px; max-width: 720px; }
.mode-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.mode-change { background: none; border: none; color: #717182; font-weight: 600; font-size: 13px; cursor: pointer; }
.mode-text { font-size: 15.5px; color: #1f2430; line-height: 1.6; margin: 0; }
.sources-list { display: flex; flex-direction: column; gap: 12px; flex: 1; max-width: 760px; }
.msg-actions { display: flex; gap: 12px; margin-left: 48px; }
</style>
