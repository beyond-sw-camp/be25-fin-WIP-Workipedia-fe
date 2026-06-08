<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { LogOut, Trophy, MessageCircle, Ticket, Star } from '@lucide/vue'

const router = useRouter()
const auth = useAuthStore()

const tab = ref<'activity' | 'settings'>('activity')

interface ActivityItem {
  kind: '워키 답변' | '티켓 처리' | '포인트 획득'
  title: string
  time: string
  pts?: number
}

const activities = ref<ActivityItem[]>([
  { kind: '워키 답변', title: '연차 신청은 며칠 전까지?에 답변', time: '2일 전', pts: 30 },
  { kind: '티켓 처리', title: '노트북 화면 출력 불가 처리 완료', time: '5일 전', pts: 50 },
  { kind: '포인트 획득', title: '베스트 답변 선정', time: '1주 전', pts: 100 },
  { kind: '워키 답변', title: 'VPN 설정 방법에 답변', time: '2주 전', pts: 30 },
])

const stats = [
  { label: '총 포인트', value: '890pt', icon: Trophy, color: '#f5c000' },
  { label: '워키 답변', value: '13개', icon: MessageCircle, color: '#7c3aed' },
  { label: '처리한 티켓', value: '8개', icon: Ticket, color: '#ff6900' },
  { label: '베스트 답변', value: '3개', icon: Star, color: '#00a63e' },
]

const kindColor: Record<string, string> = {
  '워키 답변': '#7c3aed',
  '티켓 처리': '#ff6900',
  '포인트 획득': '#f5c000',
}

function logout() {
  auth.clearAuth()
  router.push('/login')
}
</script>

<template>
  <div class="content-inner" style="max-width: 860px;">
    <div class="card profile-card">
      <span class="chat-av profile-av">{{ (auth.nickname ?? '나').slice(0, 1) }}</span>
      <div class="profile-info">
        <h2 class="profile-name">{{ auth.nickname ?? '이름 없음' }}</h2>
        <div class="profile-team">{{ auth.team ?? '팀 정보 없음' }}</div>
        <div class="profile-id">사번 {{ auth.userId ?? '-' }}</div>
      </div>
      <button class="btn" style="margin-left: auto;" @click="logout">
        <LogOut :size="15" /> 로그아웃
      </button>
    </div>

    <div class="stat-grid">
      <div v-for="s in stats" :key="s.label" class="card stat-card">
        <component :is="s.icon" :size="22" :color="s.color" />
        <div class="stat-value">{{ s.value }}</div>
        <div class="stat-label">{{ s.label }}</div>
      </div>
    </div>

    <div class="seg" style="width: 280px; margin-bottom: 20px;">
      <button :class="{ on: tab === 'activity' }" @click="tab = 'activity'">활동 내역</button>
      <button :class="{ on: tab === 'settings' }" @click="tab = 'settings'">설정</button>
    </div>

    <div v-if="tab === 'activity'" class="act-list">
      <div v-for="(a, i) in activities" :key="i" class="card act-row">
        <div class="act-dot" :style="{ background: kindColor[a.kind] }"></div>
        <div class="act-content">
          <div class="act-kind" :style="{ color: kindColor[a.kind] }">{{ a.kind }}</div>
          <div class="act-title">{{ a.title }}</div>
          <div class="act-time">{{ a.time }}</div>
        </div>
        <div v-if="a.pts" class="act-pts">+{{ a.pts }}pt</div>
      </div>
    </div>

    <div v-else class="card settings-card">
      <div class="setting-row">
        <div>
          <div class="setting-label">비밀번호 변경</div>
          <div class="setting-sub">마지막 변경: 2025.03.01</div>
        </div>
        <button class="btn" @click="router.push('/reset-password')">변경</button>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">알림 설정</div>
          <div class="setting-sub">워키 답변, 티켓 상태 변경 알림</div>
        </div>
        <button class="btn">설정</button>
      </div>
      <div class="setting-row" style="border-bottom: none;">
        <div>
          <div class="setting-label" style="color: #ef4444;">회원 탈퇴</div>
        </div>
        <button class="btn" style="color: #ef4444; border-color: #fecaca;">탈퇴</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-card { display: flex; align-items: center; gap: 18px; padding: 28px 32px; margin-bottom: 20px; }
.profile-av { width: 56px; height: 56px; font-size: 22px; font-weight: 800; }
.profile-name { font-size: 20px; font-weight: 800; color: #1f2430; margin: 0 0 4px; }
.profile-team { font-size: 14px; color: #717182; }
.profile-id { font-size: 12.5px; color: #aeb2bb; }

.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
.stat-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px 16px; }
.stat-value { font-size: 22px; font-weight: 800; color: #1f2430; }
.stat-label { font-size: 12.5px; color: #aeb2bb; }

.act-list { display: flex; flex-direction: column; gap: 10px; }
.act-row { display: flex; align-items: flex-start; gap: 14px; padding: 16px 20px; }
.act-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.act-content { flex: 1; }
.act-kind { font-size: 12px; font-weight: 700; margin-bottom: 3px; }
.act-title { font-size: 14.5px; font-weight: 600; color: #1f2430; margin-bottom: 2px; }
.act-time { font-size: 12.5px; color: #aeb2bb; }
.act-pts { font-size: 14px; font-weight: 700; color: #00a63e; }

.settings-card { padding: 0; overflow: hidden; }
.setting-row { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--line); }
.setting-label { font-size: 14.5px; font-weight: 600; color: #1f2430; margin-bottom: 3px; }
.setting-sub { font-size: 12.5px; color: #aeb2bb; }
</style>
