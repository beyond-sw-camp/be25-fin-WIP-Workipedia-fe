<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { LogOut, Trophy, Award, TrendingUp, Target } from '@lucide/vue'
import { getMyPoint, getMyEsg, getPointHistories } from '@/api/pointApi'
import { logout as logoutApi } from '@/api/authApi'
import type { PointHistoryResponse } from '@/types/point'

const router = useRouter()
const auth = useAuthStore()

const tab = ref<'activity' | 'settings'>('activity')

const currentPoint = ref(0)
const esgScore = ref(0)
const gradeName = ref('-')
const remainingForNext = ref<number | null>(null)
const histories = ref<PointHistoryResponse[]>([])
const loading = ref(false)

const reasonLabel: Record<string, string> = {
  ANSWER_ACCEPTED: '답변 채택',
  ANSWER_CREATED: '답변 등록',
  QUESTION_CREATED: '질문 등록',
  TICKET_COMPLETED: '티켓 처리 완료',
  ADMIN_DEDUCT: '관리자 차감',
}
function labelOf(reasonType: string) {
  return reasonLabel[reasonType] ?? reasonType
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

async function logout() {
  try {
    await logoutApi()
  } finally {
    auth.clearAuth()
    router.push('/login')
  }
}

onMounted(async () => {
  loading.value = true
  try {
    const [pointRes, esgRes, histRes] = await Promise.all([
      getMyPoint(),
      getMyEsg(),
      getPointHistories({ page: 0, size: 10 }),
    ])
    currentPoint.value = pointRes.data.currentPoint
    esgScore.value = esgRes.data.esgScore
    gradeName.value = esgRes.data.gradeName
    remainingForNext.value = esgRes.data.remainingScoreForNextGrade
    histories.value = histRes.data.content
  } catch {
    // 부분 실패 시에도 화면은 표시(기본값 유지)
  } finally {
    loading.value = false
  }
})
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
      <div class="card stat-card">
        <Trophy :size="22" color="#f5c000" />
        <div class="stat-value">{{ currentPoint.toLocaleString() }}pt</div>
        <div class="stat-label">보유 포인트</div>
      </div>
      <div class="card stat-card">
        <TrendingUp :size="22" color="#7c3aed" />
        <div class="stat-value">{{ esgScore.toLocaleString() }}</div>
        <div class="stat-label">ESG 점수</div>
      </div>
      <div class="card stat-card">
        <Award :size="22" color="#00a63e" />
        <div class="stat-value">{{ gradeName }}</div>
        <div class="stat-label">ESG 등급</div>
      </div>
      <div class="card stat-card">
        <Target :size="22" color="#ff6900" />
        <div class="stat-value">{{ remainingForNext != null ? `${remainingForNext.toLocaleString()}` : '-' }}</div>
        <div class="stat-label">다음 등급까지</div>
      </div>
    </div>

    <div class="seg" style="width: 280px; margin-bottom: 20px;">
      <button :class="{ on: tab === 'activity' }" @click="tab = 'activity'">최근 활동</button>
      <button :class="{ on: tab === 'settings' }" @click="tab = 'settings'">설정</button>
    </div>

    <div v-if="tab === 'activity'">
      <div v-if="loading" class="empty-ph" style="height: 160px;">불러오는 중...</div>
      <div v-else-if="histories.length === 0" class="empty-ph" style="height: 160px;">최근 활동이 없습니다</div>
      <div v-else class="act-list">
        <div v-for="h in histories" :key="h.pointHistoryId" class="card act-row">
          <div class="act-dot" :style="{ background: h.pointAmount >= 0 ? '#00a63e' : '#ef4444' }"></div>
          <div class="act-content">
            <div class="act-title">{{ labelOf(h.reasonType) }}</div>
            <div class="act-time">{{ formatDate(h.createdAt) }}</div>
          </div>
          <div class="act-pts" :class="h.pointAmount >= 0 ? 'plus' : 'minus'">
            {{ h.pointAmount >= 0 ? '+' : '' }}{{ h.pointAmount }}pt
          </div>
        </div>
      </div>
    </div>

    <div v-else class="card settings-card">
      <div class="setting-row">
        <div>
          <div class="setting-label">비밀번호 변경</div>
          <div class="setting-sub">로그인 비밀번호를 재설정합니다</div>
        </div>
        <button class="btn" @click="router.push('/reset-password')">변경</button>
      </div>
      <div class="setting-row" style="border-bottom: none;">
        <div>
          <div class="setting-label">로그아웃</div>
        </div>
        <button class="btn" @click="logout">로그아웃</button>
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
.act-row { display: flex; align-items: center; gap: 14px; padding: 16px 20px; }
.act-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.act-content { flex: 1; }
.act-title { font-size: 14.5px; font-weight: 600; color: #1f2430; margin-bottom: 2px; }
.act-time { font-size: 12.5px; color: #aeb2bb; }
.act-pts { font-size: 15px; font-weight: 800; }
.act-pts.plus { color: #00a63e; }
.act-pts.minus { color: #ef4444; }

.settings-card { padding: 0; overflow: hidden; }
.setting-row { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--line); }
.setting-label { font-size: 14.5px; font-weight: 600; color: #1f2430; margin-bottom: 3px; }
.setting-sub { font-size: 12.5px; color: #aeb2bb; }
</style>
