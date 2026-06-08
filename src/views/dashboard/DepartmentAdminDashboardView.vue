<script setup lang="ts">
import { useAuthStore } from '@/stores/authStore'
import { BarChart2, Ticket, Users, TrendingUp } from '@lucide/vue'
import BarChart from '@/components/common/BarChart.vue'
import LineChart from '@/components/common/LineChart.vue'

const auth = useAuthStore()

const kpis = [
  { label: '이번 달 총 티켓', value: '124', unit: '건', color: '#2b7fff' },
  { label: '처리 완료', value: '98', unit: '건', color: '#00a63e' },
  { label: '미처리(접수·처리중)', value: '26', unit: '건', color: '#ff6900' },
  { label: '평균 처리 시간', value: '1.8', unit: '일', color: '#7c3aed' },
]

const categoryStats = [
  { label: 'IT장비', v: 34 },
  { label: 'HR', v: 28 },
  { label: '재무', v: 22 },
  { label: '시설', v: 18 },
  { label: '총무', v: 12 },
  { label: '기타', v: 10 },
]

const monthlyTrend = [78, 91, 104, 88, 112, 124]
const monthLabels = ['1월', '2월', '3월', '4월', '5월', '6월']

const pendingTickets = [
  { id: 201, title: 'VPN 접속 오류', requester: '이민호', team: '개발1팀', age: '3일', status: '접수중' },
  { id: 202, title: '노트북 화면 출력 불가', requester: '정수아', team: '마케팅팀', age: '1일', status: '처리중' },
  { id: 203, title: '법인카드 한도 초과 요청', requester: '김영준', team: '영업팀', age: '2일', status: '접수중' },
]

const contributors = [
  { name: '박이화', team: '인사팀', handled: 22, pts: 580 },
  { name: '김동욱', team: 'IT지원팀', handled: 19, pts: 490 },
  { name: '이서연', team: '재무팀', handled: 15, pts: 380 },
]
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <BarChart2 :size="28" color="#7c3aed" />
        부서 대시보드
      </h1>
      <p class="page-sub">{{ auth.team }} 운영 현황</p>
    </div>

    <div class="kpi-grid">
      <div v-for="k in kpis" :key="k.label" class="card kpi-card">
        <div class="kpi-value" :style="{ color: k.color }">{{ k.value }}<small>{{ k.unit }}</small></div>
        <div class="kpi-label">{{ k.label }}</div>
      </div>
    </div>

    <div class="charts-row">
      <div class="card chart-card">
        <h3 class="chart-title"><Ticket :size="16" /> 카테고리별 티켓</h3>
        <BarChart :data="categoryStats" color="#7c3aed" />
      </div>
      <div class="card chart-card">
        <h3 class="chart-title"><TrendingUp :size="16" /> 월별 티켓 추이</h3>
        <LineChart :data="monthlyTrend" :labels="monthLabels" color="#7c3aed" />
      </div>
    </div>

    <div class="bottom-row">
      <div class="card bottom-card">
        <h3 class="chart-title"><Ticket :size="16" /> 미처리 티켓</h3>
        <div class="pending-list">
          <div v-for="t in pendingTickets" :key="t.id" class="pending-row">
            <div class="pending-info">
              <div class="pending-title">{{ t.title }}</div>
              <div class="pending-meta">{{ t.requester }} · {{ t.team }} · {{ t.age }} 경과</div>
            </div>
            <span class="badge" :class="t.status === '처리중' ? 'blue' : 'gray'">{{ t.status }}</span>
          </div>
        </div>
      </div>

      <div class="card bottom-card">
        <h3 class="chart-title"><Users :size="16" /> 이달의 기여자</h3>
        <div class="contrib-list">
          <div v-for="(c, i) in contributors" :key="c.name" class="contrib-row">
            <div class="contrib-rank">{{ i + 1 }}</div>
            <span class="chat-av" style="font-size: 12px; font-weight: 700; width: 32px; height: 32px;">{{ c.name.slice(0, 1) }}</span>
            <div class="contrib-info">
              <div class="contrib-name">{{ c.name }}</div>
              <div style="font-size: 12px; color: #aeb2bb;">{{ c.team }}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 14px; font-weight: 700; color: #1f2430;">{{ c.handled }}건</div>
              <div style="font-size: 12px; color: #f5c000; font-weight: 700;">{{ c.pts }}pt</div>
            </div>
          </div>
        </div>
      </div>
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

.bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.bottom-card { padding: 22px 24px; }

.pending-list { display: flex; flex-direction: column; gap: 12px; }
.pending-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pending-title { font-size: 14px; font-weight: 600; color: #1f2430; margin-bottom: 2px; }
.pending-meta { font-size: 12px; color: #aeb2bb; }

.contrib-list { display: flex; flex-direction: column; gap: 14px; }
.contrib-row { display: flex; align-items: center; gap: 12px; }
.contrib-rank { width: 20px; font-size: 14px; font-weight: 800; color: #aeb2bb; }
.contrib-info { flex: 1; }
.contrib-name { font-size: 14px; font-weight: 700; color: #1f2430; }
</style>
