<script setup lang="ts">
import { useAuthStore } from '@/stores/authStore'
import { BarChart2, Ticket, Users } from '@lucide/vue'
import BarChart from '@/components/common/BarChart.vue'
import LineChart from '@/components/common/LineChart.vue'

const auth = useAuthStore()

const ticketStats = [
  { label: '접수중', v: 4 },
  { label: '처리중', v: 9 },
  { label: '완료', v: 31 },
  { label: '반려', v: 2 },
]

const weeklyActivity = [3, 7, 5, 9, 6, 4, 8]
const weekLabels = ['월', '화', '수', '목', '금', '토', '일']

const members = [
  { name: '박이화', role: '팀장', tickets: 14, answers: 8, pts: 340 },
  { name: '김동욱', role: '팀원', tickets: 9, answers: 5, pts: 210 },
  { name: '이서연', role: '팀원', tickets: 7, answers: 3, pts: 170 },
  { name: '최준혁', role: '팀원', tickets: 5, answers: 2, pts: 120 },
]

const kpis = [
  { label: '이번 달 처리 티켓', value: '31', unit: '건', color: '#00a63e' },
  { label: '평균 처리 시간', value: '1.4', unit: '일', color: '#2b7fff' },
  { label: '워키 답변', value: '18', unit: '개', color: '#7c3aed' },
  { label: '팀 포인트', value: '840', unit: 'pt', color: '#f5c000' },
]
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <BarChart2 :size="28" color="#2b7fff" />
        팀 대시보드
      </h1>
      <p class="page-sub">{{ auth.team }} 이번 달 현황</p>
    </div>

    <div class="kpi-grid">
      <div v-for="k in kpis" :key="k.label" class="card kpi-card">
        <div class="kpi-value" :style="{ color: k.color }">
          {{ k.value }}<small>{{ k.unit }}</small>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
      </div>
    </div>

    <div class="charts-row">
      <div class="card chart-card">
        <h3 class="chart-title"><Ticket :size="16" /> 티켓 상태</h3>
        <BarChart :data="ticketStats" color="#2b7fff" />
      </div>
      <div class="card chart-card">
        <h3 class="chart-title"><BarChart2 :size="16" /> 주간 처리 건수</h3>
        <LineChart :data="weeklyActivity" :labels="weekLabels" color="#2b7fff" />
      </div>
    </div>

    <div class="card" style="padding: 24px 28px;">
      <h3 class="chart-title" style="margin-bottom: 16px;"><Users :size="16" /> 팀원 현황</h3>
      <table class="member-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>역할</th>
            <th>처리 티켓</th>
            <th>워키 답변</th>
            <th>포인트</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.name">
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="chat-av" style="font-size: 12px; font-weight: 700; width: 32px; height: 32px;">{{ m.name.slice(0, 1) }}</span>
                {{ m.name }}
              </div>
            </td>
            <td><span class="badge gray">{{ m.role }}</span></td>
            <td><strong>{{ m.tickets }}</strong></td>
            <td><strong>{{ m.answers }}</strong></td>
            <td><strong style="color: #f5c000;">{{ m.pts }}pt</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
.kpi-card { padding: 22px 20px; }
.kpi-value { font-size: 28px; font-weight: 900; line-height: 1; margin-bottom: 6px; }
.kpi-value small { font-size: 14px; font-weight: 600; margin-left: 2px; }
.kpi-label { font-size: 13px; color: #aeb2bb; }

.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.chart-card { padding: 22px 24px; }
.chart-title { display: flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 700; color: #1f2430; margin: 0 0 16px; }

.member-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.member-table th { text-align: left; color: #aeb2bb; font-size: 12.5px; font-weight: 600; padding: 0 0 12px; border-bottom: 1px solid var(--line); }
.member-table td { padding: 12px 0; border-bottom: 1px solid var(--line); color: #1f2430; }
.member-table tr:last-child td { border-bottom: none; }
</style>
