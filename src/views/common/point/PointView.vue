<script setup lang="ts">
import { ref } from 'vue'
import { Trophy, TrendingUp } from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'
import LineChart from '@/components/common/LineChart.vue'

const auth = useAuthStore()

interface PointHistory {
  id: number
  reason: string
  pts: number
  date: string
  plus: boolean
}

const history = ref<PointHistory[]>([
  { id: 1, reason: '베스트 답변 선정', pts: 100, date: '2025.05.20', plus: true },
  { id: 2, reason: '워키 답변 등록', pts: 30, date: '2025.05.18', plus: true },
  { id: 3, reason: '티켓 처리 완료', pts: 50, date: '2025.05.15', plus: true },
  { id: 4, reason: '워키 답변 등록', pts: 30, date: '2025.05.10', plus: true },
  { id: 5, reason: '워키 답변 등록', pts: 30, date: '2025.05.05', plus: true },
])

const monthlyPoints = [120, 180, 90, 210, 340, 890]
const monthLabels = ['1월', '2월', '3월', '4월', '5월', '6월']

const totalPoints = history.value.reduce((acc, h) => acc + (h.plus ? h.pts : -h.pts), 0)
</script>

<template>
  <div class="content-inner" style="max-width: 760px;">
    <div class="page-head">
      <h1 class="page-title">
        <Trophy :size="28" color="#f5c000" />
        포인트 내역
      </h1>
      <p class="page-sub">{{ auth.nickname }}님의 포인트 현황</p>
    </div>

    <div class="points-banner card">
      <div class="banner-pts">{{ totalPoints.toLocaleString() }}<span>pt</span></div>
      <div class="banner-label">보유 포인트</div>
    </div>

    <div class="card chart-card">
      <h3 class="chart-title"><TrendingUp :size="16" /> 월별 포인트 획득 추이</h3>
      <LineChart :data="monthlyPoints" :labels="monthLabels" color="#f5c000" />
    </div>

    <h3 class="hist-head">포인트 내역</h3>

    <div class="hist-list">
      <div v-for="h in history" :key="h.id" class="card hist-row">
        <div class="hist-reason">{{ h.reason }}</div>
        <div class="hist-date">{{ h.date }}</div>
        <div class="hist-pts" :class="h.plus ? 'plus' : 'minus'">
          {{ h.plus ? '+' : '-' }}{{ h.pts }}pt
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.points-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 36px 24px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #fdf6e3, #fff8e7);
}
.banner-pts { font-size: 48px; font-weight: 900; color: #f5c000; line-height: 1; }
.banner-pts span { font-size: 22px; margin-left: 4px; }
.banner-label { font-size: 14px; color: #aeb2bb; margin-top: 6px; }

.chart-card { padding: 22px 24px; margin-bottom: 24px; }
.chart-title { display: flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 700; color: #1f2430; margin: 0 0 16px; }

.hist-head { font-size: 16px; font-weight: 700; color: #1f2430; margin: 0 0 12px; }
.hist-list { display: flex; flex-direction: column; gap: 8px; }
.hist-row { display: flex; align-items: center; padding: 16px 22px; gap: 12px; }
.hist-reason { flex: 1; font-size: 14.5px; font-weight: 600; color: #1f2430; }
.hist-date { font-size: 13px; color: #aeb2bb; }
.hist-pts { font-size: 16px; font-weight: 800; }
.plus { color: #00a63e; }
.minus { color: #ef4444; }
</style>
