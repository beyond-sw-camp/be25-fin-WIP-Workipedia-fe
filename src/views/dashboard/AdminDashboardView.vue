<script setup lang="ts">
import { BarChart2, Users, Ticket } from '@lucide/vue'
import LineChart from '@/components/common/LineChart.vue'
import BarChart from '@/components/common/BarChart.vue'

const kpis = [
  { label: '전체 사용자', value: '1,284', unit: '명', color: '#2b7fff' },
  { label: '이번 달 티켓', value: '847', unit: '건', color: '#ff6900' },
  { label: '워키 질문', value: '213', unit: '개', color: '#7c3aed' },
  { label: '지식 베이스', value: '532', unit: '건', color: '#00a63e' },
]

const monthlyUsers = [980, 1020, 1085, 1120, 1198, 1284]
const monthLabels = ['1월', '2월', '3월', '4월', '5월', '6월']

const deptTickets = [
  { label: '개발1팀', v: 142 },
  { label: '마케팅', v: 98 },
  { label: '인사팀', v: 87 },
  { label: 'IT지원', v: 75 },
  { label: '재무팀', v: 64 },
]

const recentTickets = [
  { id: 301, title: 'VPN 오류 보고', dept: 'IT지원팀', status: '처리중', created: '2025.05.22' },
  { id: 302, title: '신규 입사자 계정 생성', dept: '인사팀', status: '완료', created: '2025.05.21' },
  { id: 303, title: '법인카드 한도 검토', dept: '재무팀', status: '접수중', created: '2025.05.22' },
]

const statusBadge: Record<string, string> = {
  '접수중': 'gray',
  '처리중': 'blue',
  '완료': 'green',
}
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <BarChart2 :size="28" color="#1f2430" />
        시스템 대시보드
      </h1>
      <p class="page-sub">플랫폼 전체 현황</p>
    </div>

    <div class="kpi-grid">
      <div v-for="k in kpis" :key="k.label" class="card kpi-card">
        <div class="kpi-value" :style="{ color: k.color }">{{ k.value }}<small>{{ k.unit }}</small></div>
        <div class="kpi-label">{{ k.label }}</div>
      </div>
    </div>

    <div class="charts-row">
      <div class="card chart-card">
        <h3 class="chart-title"><Users :size="16" /> 월별 사용자 증가</h3>
        <LineChart :data="monthlyUsers" :labels="monthLabels" color="#2b7fff" />
      </div>
      <div class="card chart-card">
        <h3 class="chart-title"><Ticket :size="16" /> 부서별 티켓</h3>
        <BarChart :data="deptTickets" color="#2b7fff" />
      </div>
    </div>

    <div class="card" style="padding: 24px 28px;">
      <h3 class="chart-title" style="margin-bottom: 16px;"><Ticket :size="16" /> 최근 티켓</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>제목</th>
            <th>부서</th>
            <th>상태</th>
            <th>등록일</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in recentTickets" :key="t.id">
            <td style="color: #aeb2bb;">{{ t.id }}</td>
            <td style="font-weight: 600;">{{ t.title }}</td>
            <td><span class="badge gray">{{ t.dept }}</span></td>
            <td><span class="badge" :class="statusBadge[t.status]">{{ t.status }}</span></td>
            <td style="color: #aeb2bb;">{{ t.created }}</td>
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

.data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.data-table th { text-align: left; color: #aeb2bb; font-size: 12.5px; font-weight: 600; padding: 0 0 12px; border-bottom: 1px solid var(--line); }
.data-table td { padding: 12px 0; border-bottom: 1px solid var(--line); color: #1f2430; }
.data-table tr:last-child td { border-bottom: none; }
</style>
