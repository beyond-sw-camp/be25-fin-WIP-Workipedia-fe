<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import Composer from '@/components/common/Composer.vue'

const auth = useAuthStore()

interface ChatMsg {
  me: boolean
  name: string
  team: string
  initial: string
  text: string
  time: string
}

const scrollEl = ref<HTMLElement | null>(null)
const val = ref('')

const msgs = ref<ChatMsg[]>([
  { me: false, name: '춤추는데이민다', team: '인사팀', initial: '춤', text: '다들 이번 분기 OKR 정리 다 하셨어요?', time: '오전 9:12' },
  { me: false, name: '서두르라바라기', team: 'IT지원팀', initial: '서', text: '저는 오늘까지 마무리하려구요 🔥', time: '오전 9:14' },
  { me: true, name: auth.nickname ?? '나', team: auth.team ?? '', initial: (auth.nickname ?? '나').slice(0, 1), text: '재무팀의 이전 끝났습니다! 템플릿 공유 드릴게요', time: '오전 9:15' },
])

const scroll = () =>
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  })

function send() {
  const t = val.value.trim()
  if (!t) return
  val.value = ''
  msgs.value.push({
    me: true,
    name: auth.nickname ?? '나',
    team: auth.team ?? '',
    initial: (auth.nickname ?? '나').slice(0, 1),
    text: t,
    time: '방금',
  })
  scroll()
}
</script>

<template>
  <div class="chat-page">
    <div class="chat-topbar">
      <div class="chat-topbar-inner">
        <span class="badge green">
          <span class="online-dot"></span>
          실시간 채팅
        </span>
        <span class="online-count">온라인 24명</span>
      </div>
    </div>

    <div ref="scrollEl" class="chat-scroll">
      <div class="chat-inner">
        <div v-for="(m, i) in msgs" :key="i" class="chat-row" :class="{ 'chat-row--me': m.me }">
          <span class="chat-av chat-av--text">{{ m.initial }}</span>
          <div class="chat-content" :class="{ 'chat-content--me': m.me }">
            <div class="chat-meta">{{ m.name }} · {{ m.team }}</div>
            <div class="chat-bubble" :class="{ 'chat-bubble--me': m.me }">{{ m.text }}</div>
            <div class="chat-time">{{ m.time }}</div>
          </div>
        </div>
      </div>
    </div>

    <Composer v-model="val" placeholder="메시지를 입력하세요" @send="send" />
  </div>
</template>

<style scoped>
.chat-page { display: flex; flex-direction: column; height: 100%; }

.chat-topbar { padding: 16px 8% 0; }
.chat-topbar-inner {
  max-width: 940px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.online-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #00c950;
  display: inline-block;
}
.online-count { color: #717182; font-size: 14px; }

.chat-scroll { flex: 1; overflow-y: auto; padding: 24px 8%; }
.chat-inner {
  max-width: 940px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.chat-row { display: flex; gap: 12px; align-items: flex-start; }
.chat-row--me { flex-direction: row-reverse; }

.chat-av--text { font-size: 13px; font-weight: 700; }
.chat-content { max-width: 520px; }
.chat-content--me { text-align: right; }
.chat-meta { font-size: 13px; color: #717182; margin-bottom: 4px; }
.chat-bubble {
  display: inline-block;
  background: #fff;
  color: #1f2430;
  border: 1px solid #eceef2;
  padding: 12px 16px;
  border-radius: 14px;
  font-size: 15.5px;
  line-height: 1.5;
}
.chat-bubble--me { background: #2b7fff; color: #fff; border: none; }
.chat-time { font-size: 11px; color: #aeb2bb; margin-top: 4px; }
</style>
