<script setup lang="ts">
// ── 페이지 개요 ──────────────────────────────────────────────
// SYSTEM_ADMIN(시스템 어드민) 전용 대시보드 뷰.
// 역할: 플랫폼 전체 KPI 모니터링 / 공통 접수 큐 티켓을 담당 부서에 배정
//
// 핵심 구현 포인트
//   1. KPI + 차트 데이터는 onMounted에서 5개 API를 병렬 조회해 초기 렌더링 지연을 최소화한다.
//   2. 공통 접수 큐는 무한 스크롤(append 모드)로 추가 로드한다. 1-based 페이지네이션
//      (/admin/common-queue/tickets)에 맞춰 queuePage를 1부터 시작한다.
//   3. 배정 낙관적 업데이트: assignCommonQueueTicket 성공 시 재조회 없이 큐 목록에서
//      해당 티켓을 즉시 제거한다.
//   4. 배정 버튼 독립 로딩: 여러 티켓을 동시에 배정할 수 있도록 assigning을 Set으로 관리.
//      Vue 3가 Set 직접 변이를 감지하지 못해 매번 새 Set으로 교체한다.
//   5. 공통 큐 만료 배지: 7일 미배정 시 BE 스케줄러가 soft delete → updatedAt 기준 남은 시간 표시.
//   6. 진입 사유 태그: TRANSFER_REQUESTED(이관)·ASSIGNMENT_EXPIRED(48h 미처리)·ROUTING_FAILED(자동 배정 실패)
//      3가지로 구분한다. ASSIGNMENT_EXPIRED는 UI에서 "24시간 초과"로 표시한다.
import { ref, computed, onMounted } from 'vue'
import { ShieldCheck, AlertCircle, Users, Ticket, FileText, Clock, Paperclip } from '@lucide/vue'
import LineChart from '@/components/common/LineChart.vue'
import BarChart from '@/components/common/BarChart.vue'
import BaseToast from '@/components/common/BaseToast.vue'
import {
  getDashboardSummary,
  getMonthlyTicketTrend,
  getMonthlyAutoAssignRate,
  getDeptTicketStatus,
  getDeptAutoAssignRate,
  getCommonQueueTickets,
  assignCommonQueueTicket,
  getAdminDepartments,
} from '@/api/adminApi'
import type {
  DashboardSummary,
  MonthlyTicketTrend,
  MonthlyAutoAssignRate,
  DeptTicketStatus,
  DeptAutoAssignRate,
  AdminDepartment,
} from '@/api/adminApi'
import type { TicketResponse } from '@/types/ticket'

// ── 토스트 ───────────────────────────────────────────────────
const toastVisible = ref(false)
const toastTitle = ref('')
const toastSub = ref('')
const toastType = ref<'success' | 'error'>('success')
function showToast(title: string, sub = '', type: 'success' | 'error' = 'success') {
  toastTitle.value = title; toastSub.value = sub; toastType.value = type; toastVisible.value = true
}

// ── 로딩/에러 ────────────────────────────────────────────────
const loading = ref(false)
const error = ref('')

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

// ── 공통 접수 큐 ─────────────────────────────────────────────
const queueTickets = ref<TicketResponse[]>([])
const queueLoading = ref(false)
const queueError = ref(false)
const queueHasNext = ref(false)
// /admin/common-queue/tickets는 BasePageRequest 기반 1-based 페이지네이션 (Spring Pageable 0-based와 다름)
const queuePage = ref(1)
const queueLoadingMore = ref(false)
const selectedDept = ref<Record<number, number>>({})
// 배정 중인 ticketId를 Set으로 관리해 여러 티켓 동시 배정 시 각 버튼이 독립적으로 로딩 상태를 갖는다.
// Vue 3는 Set 직접 변이를 감지하지 못하므로 매번 새 Set으로 교체한다.
const assigning = ref<Set<number>>(new Set())

// ── 부서 목록 (배정 select 드롭다운) ─────────────────────────
const departments = ref<AdminDepartment[]>([])

// BE TicketStatus에 TRANSFERRED 값이 없음. 이관된 티켓도 status=COMMON_QUEUE로 들어온다.
// ASSIGNMENT_EXPIRED: 48h 미처리로 BE 스케줄러가 이동. UI 라벨은 "24시간 초과"로 표시한다.
function entryReasonLabel(ticket: TicketResponse) {
  if (ticket.commonQueueReason === 'TRANSFER_REQUESTED') return '팀 관리자 이관'
  if (ticket.commonQueueReason === 'ASSIGNMENT_EXPIRED') return '24시간 초과'
  return '자동 배정 실패'
}

function formatDate(iso: string) {
  return iso.slice(0, 10).replace(/-/g, '.')
}

// 공통 큐에서 7일 미배정 시 BE 스케줄러가 자동 삭제(soft delete)한다.
// updatedAt(큐 진입 시각 근사)을 기준으로 남은 시간을 계산한다.
function queueExpiryMs(updatedAt: string): number {
  return new Date(updatedAt).getTime() + 7 * 24 * 3600000 - Date.now()
}
function queueExpiryLabel(updatedAt: string): string {
  const ms = queueExpiryMs(updatedAt)
  if (ms <= 0) return '만료됨'
  const days = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  if (days >= 2) return `${days}일 후 자동 삭제`
  if (days === 1) return `1일 ${h}시간 후 자동 삭제`
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}시간 후 자동 삭제`
  return `${m}분 후 자동 삭제`
}
function queueExpiryClass(updatedAt: string): string {
  const ms = queueExpiryMs(updatedAt)
  if (ms <= 0) return 'expiry-expired'
  const days = ms / 86400000
  if (days <= 1) return 'expiry-urgent'
  if (days <= 3) return 'expiry-warning'
  return 'expiry-ok'
}

async function loadQueue(page: number, append: boolean) {
  if (append) queueLoadingMore.value = true
  else { queueLoading.value = true; queueError.value = false }
  try {
    const res = await getCommonQueueTickets({ page, size: 10 })
    queueTickets.value = append
      ? [...queueTickets.value, ...res.data.content]
      : res.data.content
    queueHasNext.value = res.data.pageInfo.hasNext
    queuePage.value = page
  } catch {
    if (append) showToast('더 보기 로딩에 실패했습니다. 다시 시도해주세요.', '', 'error')
    else queueError.value = true
  } finally {
    if (append) queueLoadingMore.value = false
    else queueLoading.value = false
  }
}

// 배정 성공 시 재조회 없이 해당 티켓을 큐에서 즉시 제거(낙관적 업데이트).
// API가 성공했으므로 BE 상태도 이미 변경됐기 때문에 재조회 없는 제거가 안전하다.
async function handleAssign(ticket: TicketResponse) {
  const deptId = selectedDept.value[ticket.ticketId]
  if (!deptId) { showToast('담당 부서를 선택해주세요.', '', 'error'); return }

  assigning.value = new Set([...assigning.value, ticket.ticketId])
  try {
    await assignCommonQueueTicket(ticket.ticketId, { departmentId: deptId })
    queueTickets.value = queueTickets.value.filter(t => t.ticketId !== ticket.ticketId)
    delete selectedDept.value[ticket.ticketId] // 큐에서 제거된 티켓의 선택 상태 정리 (stale key 방지)
    const deptName = departments.value.find(d => d.departmentId === deptId)?.departmentName ?? '해당 부서'
    showToast(`${deptName}에 티켓이 배정되었습니다.`)
  } catch {
    showToast('배정에 실패했습니다. 다시 시도해주세요.', '', 'error')
  } finally {
    assigning.value = new Set([...assigning.value].filter(id => id !== ticket.ticketId))
  }
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const [sumRes, trendRes, rateRes, deptStatusRes, deptRateRes] = await Promise.all([
      getDashboardSummary(),
      getMonthlyTicketTrend(6),
      getMonthlyAutoAssignRate(6),
      getDeptTicketStatus(),
      getDeptAutoAssignRate(),
    ])
    summary.value = sumRes.data
    ticketTrends.value = trendRes.data.points
    autoAssignRates.value = rateRes.data.points
    deptTicketStatuses.value = deptStatusRes.data.departments
    deptAutoAssignRates.value = deptRateRes.data.departments
  } catch {
    error.value = '대시보드 데이터를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }

  // 부서 목록과 공통 접수 큐는 항상 BE에서 로드
  try {
    const deptRes = await getAdminDepartments()
    departments.value = deptRes.data
  } catch {
    // 배정 드롭다운 공백 허용
  }
  loadQueue(1, false)
})

// KnowIt에서 발행된 티켓은 content 끝에 "\n##SENDER:부서명|닉네임##" 마커를 포함한다.
// ticketBody: 마커를 제거한 순수 내용을 반환해 content 영역에 표시한다.
// ticketSender: 마커에서 "부서명 · 닉네임" 형태의 발신자 정보를 추출해 별도 UI에 표시한다.
const SENDER_RE = /\n##SENDER:(.+)##$/
function ticketBody(content: string) { return content.replace(SENDER_RE, '').trim() }
function ticketSender(content: string) {
  return content.match(SENDER_RE)?.[1]?.replaceAll('|', ' · ') ?? ''
}
function ticketFiles(t: TicketResponse) {
  if (t.files?.length) return t.files.filter(f => !!f.fileUrl)
  return t.fileUrl ? [{ fileKey: '', fileUrl: t.fileUrl, fileName: '첨부 이미지', fileContentType: null, fileSize: null }] : []
}
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

      <!-- ── 공통 접수 큐 ── -->
      <div class="card" style="padding: 24px 28px;">
        <div class="queue-header">
          <div>
            <h3 class="chart-title" style="margin-bottom: 4px;">
              <AlertCircle :size="18" color="#f97316" /> 공통 접수 티켓
            </h3>
            <p class="queue-desc">자동 배정에 실패했거나 부서 관리자가 이관한 티켓을 처리하세요</p>
          </div>
          <span class="badge gray queue-count">
            {{ queueLoading ? '...' : `${queueTickets.length}건` }}
          </span>
        </div>

        <div v-if="queueLoading" class="empty-ph" style="height:120px;">불러오는 중...</div>
        <div v-else-if="queueError" class="empty-ph" style="height:120px;color:#e03131;">
          공통 접수 큐를 불러오지 못했습니다.
          <button class="btn" style="margin-top:8px;" @click="loadQueue(1, false)">다시 시도</button>
        </div>
        <div v-else-if="queueTickets.length === 0" class="empty-ph" style="height:120px;">공통 접수 티켓이 없습니다</div>
        <div v-else class="queue-list">
          <div v-for="ticket in queueTickets" :key="ticket.ticketId" class="queue-item">
            <div class="queue-item-top">
              <div class="queue-item-title-row">
                <span class="queue-title">{{ ticket.title }}</span>
                <span class="badge" :class="ticket.commonQueueReason === 'TRANSFER_REQUESTED' ? 'gray' : ticket.commonQueueReason === 'ASSIGNMENT_EXPIRED' ? 'orange' : 'red'">
                  {{ entryReasonLabel(ticket) }}
                </span>
                <span class="expiry-tag" :class="queueExpiryClass(ticket.updatedAt)">
                  <Clock :size="10" />
                  {{ queueExpiryLabel(ticket.updatedAt) }}
                </span>
              </div>
              <div class="queue-item-meta-right">
                <span class="queue-time">접수: {{ formatDate(ticket.createdAt) }}</span>
                <span v-if="ticketSender(ticket.content)" class="queue-sender">{{ ticketSender(ticket.content) }}</span>
              </div>
            </div>

            <p class="ticket-content">{{ ticketBody(ticket.content) }}</p>

            <div v-if="ticketFiles(ticket).length" class="file-list">
              <a
                v-for="f in ticketFiles(ticket)"
                :key="f.fileKey || f.fileUrl || f.fileName || 'ticket-file'"
                :href="f.fileUrl ?? '#'"
                target="_blank"
                rel="noopener noreferrer"
                class="file-item file-item--link"
              >
                <Paperclip :size="13" style="color:#aeb2bb;" />
                <span class="file-name">{{ f.fileName ?? '첨부 이미지' }}</span>
                <span v-if="f.fileSize" class="file-size">({{ (f.fileSize / 1024).toFixed(1) }}KB)</span>
              </a>
            </div>

            <div v-if="ticket.commonQueueReason === 'TRANSFER_REQUESTED' && ticket.transferReason" class="transfer-reason">
              <p class="transfer-label">이관 사유</p>
              <p class="transfer-text">{{ ticket.transferReason }}</p>
            </div>

            <div class="queue-assign-row">
              <select v-model="selectedDept[ticket.ticketId]" class="dept-select">
                <option :value="undefined" disabled>담당 부서 선택</option>
                <option
                  v-for="dept in departments"
                  :key="dept.departmentId"
                  :value="dept.departmentId"
                >
                  {{ dept.departmentName }}
                </option>
              </select>
              <button
                class="btn btn-primary"
                :disabled="assigning.has(ticket.ticketId)"
                @click="handleAssign(ticket)"
              >
                {{ assigning.has(ticket.ticketId) ? '배정 중...' : '배정' }}
              </button>
            </div>
          </div>

          <div v-if="queueHasNext" style="text-align:center; padding: 8px 0;">
            <button class="btn" :disabled="queueLoadingMore" @click="loadQueue(queuePage + 1, true)">
              {{ queueLoadingMore ? '불러오는 중...' : '더 보기' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>

  <BaseToast v-model="toastVisible" :title="toastTitle" :sub="toastSub" :type="toastType" />
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

/* 공통 접수 큐 */
.queue-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.queue-desc { font-size: 13px; color: #aeb2bb; margin: 4px 0 0; }
.queue-count { font-size: 14px; font-weight: 700; padding: 4px 12px; }

.queue-list { display: flex; flex-direction: column; gap: 12px; max-height: 450px; overflow-y: auto; }
.queue-item { border: 1px solid var(--line); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.queue-item-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.queue-item-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.queue-title { font-size: 14px; font-weight: 600; color: #1f2430; }
.queue-item-meta-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.queue-time { font-size: 12px; color: #aeb2bb; white-space: nowrap; }
.queue-sender { font-size: 12px; color: #aeb2bb; white-space: nowrap; }
.expiry-tag { display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:600; padding:2px 7px; border-radius:99px; white-space:nowrap; }
.expiry-ok      { background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.expiry-warning { background:#fffbeb; color:#b45309; border:1px solid #fde68a; }
.expiry-urgent  { background:#fff1f2; color:#be123c; border:1px solid #fecdd3; }
.expiry-expired { background:#f1f5f9; color:#94a3b8; border:1px solid #e2e8f0; }

.ticket-content {
  font-size: 13.5px;
  color: #475569;
  line-height: 1.6;
  margin: 0;
  padding: 10px 14px;
  background: #f8fafc;
  border-radius: 8px;
  max-height: 80px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.transfer-reason { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 10px 14px; }
.transfer-label { font-size: 11.5px; color: #aeb2bb; margin: 0 0 4px; }
.transfer-text { font-size: 13.5px; color: #1f2430; margin: 0; }
.file-list { display: flex; flex-direction: column; gap: 6px; margin-top: -2px; }
.file-item {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px; border: 1px solid var(--line);
  border-radius: 8px; background: #fff; font-size: 12.5px;
  color: #475569; text-decoration: none;
}
.file-item--link:hover { border-color: #93c5fd; background: #eff6ff; }
.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { color: #94a3b8; }

.queue-assign-row { display: flex; gap: 8px; align-items: center; }
.dept-select {
  flex: 1;
  font-size: 13.5px;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: #1f2430;
}

.badge.red { background: #fff0f0; color: #e03131; border-color: #ffc0c0; }
</style>
