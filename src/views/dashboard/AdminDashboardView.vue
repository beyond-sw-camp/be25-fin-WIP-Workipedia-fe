<script setup lang="ts">
// ── 페이지 개요 ──────────────────────────────────────────────
// SYSTEM_ADMIN(시스템 어드민) 전용 대시보드 뷰.
// 역할: 플랫폼 전체 KPI와 주요 현황 차트를 모니터링한다.
//
// 핵심 구현 포인트
//   1. KPI + 차트 데이터는 onMounted에서 5개 API를 병렬 조회해 초기 렌더링 지연을 최소화한다.
//   2. 자동 배정률과 부서별 처리 현황은 정렬 옵션으로 상위 5개만 표시한다.
//   3. 공통 접수 티켓은 별도 관리자 메뉴(/admin/common-queue)에서 처리한다.
import { ref, computed, onMounted } from 'vue'
import { ShieldCheck, Users, Ticket, FileText } from '@lucide/vue'
import LineChart from '@/components/common/LineChart.vue'
import BarChart from '@/components/common/BarChart.vue'
import InfraEsgPanel from '@/components/admin/InfraEsgPanel.vue'
import {
  getDashboardSummary,
  getMonthlyTicketTrend,
  getMonthlyAutoAssignRate,
  getDeptTicketStatus,
  getDeptAutoAssignRate,
} from '@/api/adminApi'
import type {
  DashboardSummary,
  MonthlyTicketTrend,
  MonthlyAutoAssignRate,
  DeptTicketStatus,
  DeptAutoAssignRate,
} from '@/api/adminApi'

// ── 토스트 ───────────────────────────────────────────────────
// ── 로딩/에러 ────────────────────────────────────────────────
const loading = ref(false)
const error = ref('')

const CHART_MONTH_COUNT = 6

function completedRecentMonths() {
  const currentMonth = new Date()
  currentMonth.setDate(1)
  currentMonth.setHours(0, 0, 0, 0)

  return Array.from({ length: CHART_MONTH_COUNT }, (_, index) => {
    const d = new Date(currentMonth)
    d.setMonth(currentMonth.getMonth() - CHART_MONTH_COUNT + index)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

function filterCompletedRecentMonths<T extends { month: string }>(points: T[]) {
  const months = new Set(completedRecentMonths())
  return points.filter(point => months.has(point.month))
}

// ── 요약 KPI ─────────────────────────────────────────────────
const summary = ref<DashboardSummary | null>(null)

// ── 차트 1: 월별 AI 자동 배정률 추이 ─────────────────────────
const autoAssignRates = ref<MonthlyAutoAssignRate[]>([])
const autoAssignValues = computed(() => autoAssignRates.value.map(r => r.autoAssignmentRate))
// '2026-01' → '1월' 형식으로 변환해 x축 가독성을 높인다
const autoAssignLabels = computed(() => autoAssignRates.value.map(r => `${Number(r.month.slice(5))}월`))

// ── 차트 2: 월별 티켓 수 추이 ────────────────────────────────
const ticketTrends = ref<MonthlyTicketTrend[]>([])
const ticketTrendValues = computed(() => ticketTrends.value.map(t => t.ticketCount))
const ticketTrendLabels = computed(() => ticketTrends.value.map(t => `${Number(t.month.slice(5))}월`))

// ── 차트 3: 부서별 AI 자동 배정률 (정렬 가능 바차트, 상위 5개) ──
type SortOrder = 'high' | 'low'
const deptAutoAssignRates = ref<DeptAutoAssignRate[]>([])
const deptAutoSort = ref<SortOrder>('high')
const deptAutoBarData = computed(() => {
  const raw = deptAutoAssignRates.value.map(d => ({ label: d.departmentName, v: d.autoAssignmentRate }))
  // 차트 가독성을 위해 정렬 후 상위 5개만 표시한다.
  return [...raw].sort((a, b) => deptAutoSort.value === 'high' ? b.v - a.v : a.v - b.v).slice(0, 5)
})

// ── 차트 4: 부서별 티켓 처리 현황 (정렬 가능 누적 바) ─────────
type StatusSortOrder = 'assigned-high' | 'assigned-low' | 'completed-high' | 'completed-low'
const deptTicketStatuses = ref<DeptTicketStatus[]>([])
const deptStatusSort = ref<StatusSortOrder>('assigned-high')
const sortedDeptStatus = computed(() => {
  // 차트 가독성을 위해 정렬 후 상위 5개만 표시한다.
  return [...deptTicketStatuses.value].sort((a, b) => {
    switch (deptStatusSort.value) {
      case 'assigned-high':  return b.assignedTicketCount - a.assignedTicketCount
      case 'assigned-low':   return a.assignedTicketCount - b.assignedTicketCount
      case 'completed-high': return b.completedTicketCount - a.completedTicketCount
      case 'completed-low':  return a.completedTicketCount - b.completedTicketCount
      default: return 0
    }
  }).slice(0, 5)
})

// ── 차트 4: 스택 바 hover 상태 ───────────────────────────────
const hoveredStatusId = ref<number | null>(null)

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const [sumRes, trendRes, rateRes, deptStatusRes, deptRateRes] = await Promise.all([
      getDashboardSummary(),
      getMonthlyTicketTrend(CHART_MONTH_COUNT + 1),
      getMonthlyAutoAssignRate(CHART_MONTH_COUNT + 1),
      getDeptTicketStatus(),
      getDeptAutoAssignRate(),
    ])
    summary.value = sumRes.data
    ticketTrends.value = filterCompletedRecentMonths(trendRes.data.points)
    autoAssignRates.value = filterCompletedRecentMonths(rateRes.data.points)
    deptTicketStatuses.value = deptStatusRes.data.departments
    deptAutoAssignRates.value = deptRateRes.data.departments
  } catch {
    error.value = '대시보드 데이터를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})

</script>

<template>
  <div class="content-inner">
    <!-- 헤더 + KPI 카드를 한 행에 배치 -->
    <div class="header-kpi-row">
      <div class="page-head" style="margin-bottom:0;">
        <h1 class="page-title">
          <ShieldCheck :size="28" color="#ef4444" />
          시스템 대시보드
        </h1>
        <p class="page-sub">워키 플랫폼의 전반적인 현황을 모니터링하고 관리하세요.</p>
      </div>
      <div v-if="!loading && !error" class="kpi-grid">
        <div class="card kpi-card">
          <div class="kpi-icon" style="background:#eff6ff;"><Users :size="20" color="#2b7fff" /></div>
          <div class="kpi-value" style="color:#2b7fff;">{{ summary?.totalUserCount.toLocaleString() }}<small>명</small></div>
          <div class="kpi-label">전체 사용자</div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-icon" style="background:#fff7ed;"><Ticket :size="20" color="#f97316" /></div>
          <div class="kpi-value" style="color:#f97316;">{{ summary?.todayLoginCount.toLocaleString() }}<small>명</small></div>
          <div class="kpi-label">오늘 로그인</div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-icon" style="background:#f0fdf4;"><FileText :size="20" color="#00a63e" /></div>
          <div class="kpi-value" style="color:#00a63e;">{{ summary?.totalDocumentCount.toLocaleString() }}<small>건</small></div>
          <div class="kpi-label">전체 문서</div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="empty-ph" style="height: 200px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height: 200px;">{{ error }}</div>

    <template v-else>
      <!-- ── 차트 2×2 그리드 ── -->
      <div class="charts-grid">
        <!-- 차트 1: 월별 AI 자동 배정률 추이 -->
        <div class="card chart-card">
          <h3 class="chart-title">챗봇 자동 배정 성공률 추이</h3>
          <p class="chart-sub">월별 AI 자동 배정 성공률</p>
          <LineChart :data="autoAssignValues" :labels="autoAssignLabels" color="#10b981" tooltipLabel="성공률 (%)" :fixedMax="100" />
        </div>

        <!-- 차트 2: 월별 티켓 수 추이 -->
        <div class="card chart-card">
          <h3 class="chart-title">전체 티켓 추이</h3>
          <p class="chart-sub">월별 전체 티켓 발행 수</p>
          <LineChart :data="ticketTrendValues" :labels="ticketTrendLabels" color="#f97316" tooltipLabel="티켓 수" />
        </div>

        <!-- 차트 3: 부서별 AI 자동 배정률 -->
        <div class="card chart-card">
          <div class="chart-title-row">
            <div>
              <h3 class="chart-title">부서별 챗봇 자동 배정 성공률</h3>
              <p class="chart-sub">각 부서의 AI 자동 배정 성공률</p>
            </div>
            <select v-model="deptAutoSort" class="sort-select">
              <option value="high">높은 순</option>
              <option value="low">낮은 순</option>
            </select>
          </div>
          <BarChart :data="deptAutoBarData" color="#8b5cf6" tooltipLabel="성공률 (%)" :fixedMax="100" />
        </div>

        <!-- 차트 4: 부서별 티켓 처리 현황 (누적 바) -->
        <div class="card chart-card">
          <div class="chart-title-row">
            <div>
              <h3 class="chart-title">부서별 티켓 처리 현황</h3>
              <p class="chart-sub">부서별 처리 중 / 완료 현황</p>
            </div>
            <select v-model="deptStatusSort" class="sort-select">
              <option value="assigned-high">처리 전 높은 순</option>
              <option value="assigned-low">처리 전 낮은 순</option>
              <option value="completed-high">완료 높은 순</option>
              <option value="completed-low">완료 낮은 순</option>
            </select>
          </div>

          <div v-if="sortedDeptStatus.length === 0" class="empty-ph" style="height:120px;">데이터가 없습니다</div>
          <div v-else class="stacked-list">
            <div
              v-for="dept in sortedDeptStatus"
              :key="dept.departmentId"
              class="stacked-row"
              @mouseenter="hoveredStatusId = dept.departmentId"
              @mouseleave="hoveredStatusId = null"
            >
              <span class="stacked-label">{{ dept.departmentName }}</span>
              <div class="stacked-track">
                <div
                  class="stacked-seg assigned"
                  :style="{ width: `${Math.min(100, (dept.assignedTicketCount / (dept.totalTicketCount || 1)) * 100)}%` }"
                />
                <div
                  class="stacked-seg completed"
                  :style="{ width: `${Math.min(100, (dept.completedTicketCount / (dept.totalTicketCount || 1)) * 100)}%` }"
                />
                <!-- hover 툴팁 -->
                <div v-if="hoveredStatusId === dept.departmentId" class="status-tooltip">
                  <div class="status-tooltip-row">
                    <span class="legend-dot assigned" />처리 전
                    <strong>{{ dept.assignedTicketCount }}건</strong>
                  </div>
                  <div class="status-tooltip-row">
                    <span class="legend-dot completed" />완료
                    <strong>{{ dept.completedTicketCount }}건</strong>
                  </div>
                </div>
              </div>
              <span class="stacked-summary">{{ dept.completedTicketCount }}/{{ dept.totalTicketCount }}건 완료</span>
            </div>
            <div class="stacked-legend">
              <span><span class="legend-dot assigned" />처리 전</span>
              <span><span class="legend-dot completed" />완료</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── 인프라 ESG (CloudWatch 기반) ── -->
      <InfraEsgPanel />
    </template>
  </div>
</template>

<style scoped>
/* 헤더 + KPI 한 행 레이아웃 */
.header-kpi-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}

/* KPI */
.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; flex-shrink: 0; }
.kpi-card { padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; min-width: 130px; }
.kpi-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.kpi-value { font-size: 24px; font-weight: 900; line-height: 1; }
.kpi-value small { font-size: 13px; font-weight: 600; margin-left: 2px; }
.kpi-label { font-size: 12px; color: #aeb2bb; }

/* 차트 그리드 */
.charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px; }
.chart-card { padding: 22px 24px; display: flex; flex-direction: column; }
.chart-title { font-size: 14.5px; font-weight: 700; color: #1f2430; margin: 0; }
.chart-sub { font-size: 12px; color: #aeb2bb; margin: 4px 0 14px; }
.chart-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.chart-title-row .chart-title { margin-bottom: 0; }
.chart-title-row .chart-sub { margin-bottom: 0; }

.sort-select {
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fff;
  color: #1f2430;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

/* 누적 바 차트 — 각 행 100%, 부서명 왼쪽, 완료수 오른쪽 */
.stacked-list { display: flex; flex-direction: column; flex: 1; justify-content: space-between; }
.stacked-row { display: grid; grid-template-columns: 68px 1fr 90px; align-items: center; gap: 8px; }
.stacked-label { font-size: 12.5px; font-weight: 600; color: #1f2430; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stacked-track { height: 26px; border-radius: 6px; display: flex; overflow: hidden; position: relative; }
.stacked-seg { height: 100%; transition: width 0.3s; min-width: 0; overflow: hidden; }

.status-tooltip {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.10);
  z-index: 30;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
  white-space: nowrap;
}
.status-tooltip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: #1f2430;
}
.status-tooltip-row strong { margin-left: auto; font-weight: 700; padding-left: 12px; }
.stacked-seg.assigned { background: #1e40af; }
.stacked-seg.completed { background: #f97316; }
.stacked-summary { font-size: 11.5px; color: #64748b; white-space: nowrap; text-align: right; }
.stacked-legend { display: flex; gap: 14px; margin-top: 8px; padding-left: 76px; font-size: 12px; color: #64748b; }
.stacked-legend span { display: flex; align-items: center; gap: 5px; }
.legend-dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; flex-shrink: 0; }
.legend-dot.assigned { background: #1e40af; }
.legend-dot.completed { background: #f97316; }

</style>
