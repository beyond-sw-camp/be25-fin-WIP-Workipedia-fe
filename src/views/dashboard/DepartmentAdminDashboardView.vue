<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'
import {
  Ticket, Clock, CheckCircle2, Bot, Share2, Paperclip, X,
  ChevronLeft, ChevronRight, Edit2, Send, ArrowRightLeft, TrendingUp, XCircle,
} from '@lucide/vue'
import { getTickets, answerTicket, transferTicket, getLatestAnswer } from '@/api/ticketApi'
import {
  getTeamKnowledgeCandidates, approveKnowledgeCandidate, rejectKnowledgeCandidate,
  getKnowledgeTrend, getChatbotTicketTrend,
} from '@/api/knowledgeApi'
import { useAuthStore } from '@/stores/authStore'
import { ROLES } from '@/constants/roles'
import type { TicketResponse, TicketAnswerResponse } from '@/types/ticket'
import type { KnowledgeTicketCandidateResponse } from '@/types/knowledge'
import BaseToast from '@/components/common/BaseToast.vue'
import LineChart from '@/components/common/LineChart.vue'

const auth = useAuthStore()

// 토스트
const toastVisible = ref(false)
const toastTitle = ref('')
const toastSub = ref('')
const toastType = ref<'success' | 'error'>('success')
function showToast(title: string, sub = '', type: 'success' | 'error' = 'success') {
  toastTitle.value = title; toastSub.value = sub; toastType.value = type; toastVisible.value = true
}

// ── 카드 선택 상태 ───────────────────────────────────────────
type ActiveView = 'all' | 'my' | 'done'
const activeView = ref<ActiveView>('all')

const panelMeta = computed(() => {
  if (activeView.value === 'all') return { title: '전체 티켓', desc: '우리 부서에 배정된 모든 티켓입니다' }
  if (activeView.value === 'my') return { title: '내 답장 티켓', desc: '내가 답변 완료한 티켓입니다' }
  return { title: '처리 완료 티켓', desc: '최근 1개월 내 처리 완료된 티켓입니다' }
})

// ── 티켓 목록 ────────────────────────────────────────────────
// BE는 단일 status 필터만 지원하므로 ASSIGNED·COMPLETED를 각각 조회한 뒤 FE에서 4개 버킷으로 분리한다.
//   deptTickets    : ASSIGNED 중 assigneeId === null (부서에 배정됐지만 담당자 미지정)
//   myActiveTickets: ASSIGNED 중 assigneeId === 내 userId (내가 진행 중인 티켓)
//   doneTickets    : COMPLETED 전체 (최근 1개월 — 전체 이력이 아닌 현황 파악 목적)
//   myDoneTickets  : COMPLETED 중 assigneeId === 내 userId (내 답장 티켓)
const deptTickets = ref<TicketResponse[]>([])
const myActiveTickets = ref<TicketResponse[]>([])
const myDoneTickets = ref<TicketResponse[]>([])
const doneTickets = ref<TicketResponse[]>([])
const loading = ref(false)
const loadError = ref('')

// 통계 카드 클릭으로 activeView가 바뀌면 해당 버킷을 합산·필터해 패널에 표시한다.
const displayedTickets = computed<TicketResponse[]>(() => {
  if (activeView.value === 'all') return [...deptTickets.value, ...myActiveTickets.value]
  if (activeView.value === 'my') return myDoneTickets.value
  return doneTickets.value
})

const PAGE_SIZE = 3
const currentPage = ref(0)
watch(activeView, () => { currentPage.value = 0 })
const totalPages = computed(() => Math.max(1, Math.ceil(displayedTickets.value.length / PAGE_SIZE)))
const pagedTickets = computed(() => displayedTickets.value.slice(currentPage.value * PAGE_SIZE, (currentPage.value + 1) * PAGE_SIZE))

// ── 지식화 승인 큐 (TEAM_ADMIN 전용) ────────────────────────
const knowledgeQueue = ref<KnowledgeTicketCandidateResponse[]>([])
const kLoading = ref(false)
const editingTicketId = ref<number | null>(null)
const editedDraft = ref('')
const rejectTicketId = ref<number | null>(null)

const K_PAGE_SIZE = 3
const kPage = ref(0)
const kTotalPages = computed(() => Math.max(1, Math.ceil(knowledgeQueue.value.length / K_PAGE_SIZE)))
const kPaged = computed(() => knowledgeQueue.value.slice(kPage.value * K_PAGE_SIZE, (kPage.value + 1) * K_PAGE_SIZE))
// 승인·반려로 큐가 줄어들면 현재 페이지가 범위를 벗어날 수 있으므로 마지막 페이지로 클램핑한다.
watch(knowledgeQueue, () => {
  if (kPage.value >= kTotalPages.value) kPage.value = Math.max(0, kTotalPages.value - 1)
})

// ── 티켓 다이얼로그 상태 ─────────────────────────────────────
const selectedTicket = ref<TicketResponse | null>(null)
const detailAnswer = ref<TicketAnswerResponse | null>(null)
const detailLoading = ref(false)
const showDetailDialog = ref(false)
const showAnswerDialog = ref(false)
const showTransferDialog = ref(false)
const answerText = ref('')
const transferReason = ref('')
const uploadedFiles = ref<File[]>([])
const submitting = ref(false)
const transferring = ref(false)
const submitError = ref('')
const transferError = ref('')
const fileInputEl = ref<HTMLInputElement | null>(null)

// BE가 파일 첨부를 미지원하므로 blob URL로 세션 메모리에만 저장
type SavedFile = { name: string; size: number; url: string }
const sessionFiles = reactive<Record<number, SavedFile[]>>({})

// AI 챗봇이 자동 배정한 티켓만 이관 가능하다.
// 관리자가 직접 배정한 티켓(sourceChatbotMessageId === null)은 이미 담당 부서가 결정된 것이므로 이관 대상이 아니다.
function canTransfer(t: TicketResponse): boolean {
  return t.status === 'ASSIGNED' && t.sourceChatbotMessageId !== null
}

// ── 차트 데이터 ──────────────────────────────────────────────
const knowledgeChartData = ref<number[]>([0, 0, 0, 0, 0, 0])
const knowledgeChartLabels = ref<string[]>([])
const chatbotChartData = ref<number[]>([0, 0, 0, 0, 0, 0])
const chatbotChartLabels = ref<string[]>([])

// ── 데이터 로드 ──────────────────────────────────────────────
async function loadTickets() {
  loading.value = true
  loadError.value = ''
  try {
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    // ASSIGNED·COMPLETED를 병렬 조회해 네트워크 왕복을 줄인다.
    const [assignedRes, doneRes] = await Promise.all([
      getTickets({ status: 'ASSIGNED', size: 100 }),
      getTickets({ status: 'COMPLETED', size: 100 }),
    ])
    const assigned = assignedRes.data.content
    // 처리 완료는 최근 1개월만 표시한다. 전체 이력을 다 불러오면 목록이 너무 길어지고
    // '처리 완료' 통계 카드가 현황 지표가 아닌 누적 수치가 되어버리기 때문이다.
    const done = doneRes.data.content.filter(t => new Date(t.updatedAt) >= oneMonthAgo)
    deptTickets.value = assigned.filter(t => t.assigneeId === null)
    myActiveTickets.value = assigned.filter(t => t.assigneeId === auth.userId)
    doneTickets.value = done
    myDoneTickets.value = done.filter(t => t.assigneeId === auth.userId)
  } catch {
    loadError.value = '티켓 목록을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

// TEAM_ADMIN 전용 API — 답변 완료 후 AI가 생성한 지식화 초안 목록을 가져온다.
// USER 권한으로는 접근 불가하므로 SYSTEM_ADMIN도 이 함수를 호출하지 않는다.
async function loadKnowledge() {
  kLoading.value = true
  try {
    const res = await getTeamKnowledgeCandidates()
    knowledgeQueue.value = res.data.content
  } catch {
    knowledgeQueue.value = []
  } finally {
    kLoading.value = false
  }
}

// BE가 최근 N개월 슬라이딩 윈도우로 데이터를 반환하므로 월 라벨도 BE 응답(points[].month)에서 파싱한다.
// "2026-02" → "2월" 변환은 toMonthLabel로 처리한다.
async function loadCharts() {
  try {
    const [knowledgeRes, chatbotRes] = await Promise.all([
      getKnowledgeTrend(6),
      getChatbotTicketTrend(6),
    ])
    const toMonthLabel = (m: string) => `${Number(m.split('-')[1])}월`
    knowledgeChartData.value = knowledgeRes.data.points.map(p => p.count)
    knowledgeChartLabels.value = knowledgeRes.data.points.map(p => toMonthLabel(p.month))
    chatbotChartData.value = chatbotRes.data.points.map(p => p.count)
    chatbotChartLabels.value = chatbotRes.data.points.map(p => toMonthLabel(p.month))
  } catch { /* 실패 시 초기값 유지 */ }
}

// 지식화 승인 큐와 차트는 TEAM_ADMIN만 사용하는 기능이다.
// SYSTEM_ADMIN은 /dashboard/team에서 부서 대시보드를 열람하지만 지식화 관리 권한은 없다.
onMounted(() => {
  loadTickets()
  if (auth.role === ROLES.TEAM_ADMIN) {
    loadKnowledge()
    loadCharts()
  }
})

function typeLabel(t: TicketResponse) {
  return t.sourceChatbotMessageId !== null ? 'AI 챗봇' : '관리자 배정'
}

function fromNow(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}시간 전`
  const days = Math.floor(h / 24)
  return days === 1 ? '어제' : `${days}일 전`
}

// ── 티켓 상세 다이얼로그 ─────────────────────────────────────
async function openDetail(t: TicketResponse) {
  selectedTicket.value = t
  detailAnswer.value = null
  showDetailDialog.value = true
  if (t.status === 'COMPLETED') {
    detailLoading.value = true
    try {
      const res = await getLatestAnswer(t.ticketId)
      detailAnswer.value = res.data
    } catch { /* 로드 실패 시 null 유지 */ } finally {
      detailLoading.value = false
    }
  }
}

function closeDetail() {
  showDetailDialog.value = false
  selectedTicket.value = null
  detailAnswer.value = null
}

// ── 답변 작성 다이얼로그 ─────────────────────────────────────
function openAnswer() {
  showDetailDialog.value = false
  answerText.value = ''
  uploadedFiles.value = []
  submitError.value = ''
  showAnswerDialog.value = true
}

function closeAnswer() {
  showAnswerDialog.value = false
  answerText.value = ''
  uploadedFiles.value = []
  submitError.value = ''
}

function onFileChange(e: Event) {
  const inp = e.target as HTMLInputElement
  uploadedFiles.value = [...uploadedFiles.value, ...Array.from(inp.files ?? [])]
  inp.value = ''
}

function removeFile(i: number) {
  uploadedFiles.value = uploadedFiles.value.filter((_, idx) => idx !== i)
}

// 답변 등록 시 BE가 티켓 상태를 COMPLETED로 전환하고 AI 지식화 초안을 생성한다.
// 파일 첨부는 BE 미지원으로 blob URL로 세션 메모리에만 보관하며 페이지 새로고침 시 사라진다.
// 답변 후 loadTickets + loadKnowledge를 재호출해 티켓 목록과 지식화 큐를 즉시 갱신한다.
async function submitAnswer() {
  if (!selectedTicket.value || !answerText.value.trim()) return
  submitting.value = true
  submitError.value = ''
  try {
    const ticketId = selectedTicket.value.ticketId
    await answerTicket(ticketId, answerText.value.trim())
    sessionFiles[ticketId] = uploadedFiles.value.map(f => ({
      name: f.name, size: f.size, url: URL.createObjectURL(f),
    }))
    await loadTickets()
    if (auth.role === ROLES.TEAM_ADMIN) await loadKnowledge()
    closeAnswer()
    showToast('답변이 등록되었습니다', '티켓이 처리 완료로 이동되었습니다', 'success')
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 409) submitError.value = '이미 처리된 티켓입니다.'
    else if (status === 403) submitError.value = '답변 권한이 없습니다.'
    else submitError.value = '답변 제출에 실패했습니다. 다시 시도해주세요.'
  } finally {
    submitting.value = false
  }
}

// ── 이관 다이얼로그 ──────────────────────────────────────────
function openTransfer() {
  showDetailDialog.value = false
  transferReason.value = ''
  transferError.value = ''
  showTransferDialog.value = true
}

function closeTransfer() {
  showTransferDialog.value = false
  transferReason.value = ''
  transferError.value = ''
}

async function submitTransfer() {
  if (!selectedTicket.value || !transferReason.value.trim()) return
  transferring.value = true
  transferError.value = ''
  const tid = selectedTicket.value.ticketId
  try {
    await transferTicket(tid, transferReason.value.trim())
    await loadTickets()
    closeTransfer()
    showToast('이관 요청이 완료되었습니다', '시스템 관리자가 적합한 부서로 재배정합니다', 'success')
  } catch {
    transferError.value = '이관 요청에 실패했습니다. 다시 시도해주세요.'
  } finally {
    transferring.value = false
  }
}

// ── 지식화 승인/반려 ─────────────────────────────────────────
// question·answer를 함께 전송하는 이유: TEAM_ADMIN이 승인 전에 AI 초안을 수정할 수 있고,
// 수정된 내용이 item.answer에 반영된 상태로 승인 API에 전달되어 게시판에 등록된다.
// 승인 성공 후 loadCharts()를 호출해 지식화 건수 추이 차트를 즉시 반영한다.
async function approveKnowledge(item: KnowledgeTicketCandidateResponse) {
  try {
    await approveKnowledgeCandidate(item.ticketId, item.question, item.answer)
    knowledgeQueue.value = knowledgeQueue.value.filter(k => k.ticketId !== item.ticketId)
    await loadCharts()
    showToast('지식화가 승인되었습니다', '지식화 게시판에 등록되었습니다', 'success')
  } catch {
    showToast('승인에 실패했습니다', '', 'error')
  }
}

// rejectTicketId를 API 성공 후 null로 설정해 다이얼로그를 닫는다.
// await 전에 닫으면 실패 시 재시도 UI가 사라지므로 성공 후 순서대로 처리한다.
async function confirmReject() {
  if (rejectTicketId.value === null) return
  const id = rejectTicketId.value
  try {
    await rejectKnowledgeCandidate(id)
    rejectTicketId.value = null
    knowledgeQueue.value = knowledgeQueue.value.filter(k => k.ticketId !== id)
    showToast('지식화가 반려되었습니다', '', 'success')
  } catch {
    showToast('반려에 실패했습니다', '', 'error')
  }
}

function startEditDraft(item: KnowledgeTicketCandidateResponse) {
  editingTicketId.value = item.ticketId
  editedDraft.value = item.answer
}

function saveEditDraft(ticketId: number) {
  const item = knowledgeQueue.value.find(k => k.ticketId === ticketId)
  if (item) item.answer = editedDraft.value
  editingTicketId.value = null
}
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <TrendingUp :size="28" color="#7c3aed" />
        부서 대시보드
      </h1>
      <p class="page-sub">우리 부서의 티켓을 처리하고 지식화를 관리하세요</p>
    </div>

    <!-- 차트 (TEAM_ADMIN 전용 — API가 TEAM_ADMIN 스코프) -->
    <div v-if="auth.role === ROLES.TEAM_ADMIN" class="charts-row">
      <div class="card chart-card">
        <div class="chart-title">지식화 건수 추이</div>
        <div class="chart-sub">월별 지식화 승인 건수</div>
        <LineChart :data="knowledgeChartData" :labels="knowledgeChartLabels" color="#7c3aed" :h="180" />
      </div>
      <div class="card chart-card">
        <div class="chart-title">챗봇 배정 티켓 추이</div>
        <div class="chart-sub">월별 AI 챗봇 배정 티켓 건수</div>
        <LineChart :data="chatbotChartData" :labels="chatbotChartLabels" color="#2b7fff" :h="180" />
      </div>
    </div>

    <!-- 지식화 승인 (TEAM_ADMIN 전용) -->
    <div v-if="auth.role === ROLES.TEAM_ADMIN" class="card section-card">
      <div class="section-head">
        <div>
          <div class="section-title">지식화 승인</div>
          <div class="section-desc">부서원이 제출한 지식화 후보를 검토하고 승인하세요</div>
        </div>
        <span class="count-badge">{{ knowledgeQueue.length }}건</span>
      </div>

      <div v-if="kLoading" class="empty-ph" style="height:80px;">불러오는 중...</div>
      <div v-else-if="knowledgeQueue.length === 0" class="empty-ph" style="height:80px;">
        <CheckCircle2 :size="32" style="color:#d1d5db;margin-bottom:8px;" />
        승인 대기 중인 항목이 없습니다
      </div>
      <template v-else>
        <div class="k-list">
          <div v-for="item in kPaged" :key="item.ticketId" class="k-card">
          <div class="k-block">
            <div class="k-block-head">
              <span class="badge gray">원본 질문</span>
              <span class="k-who">{{ fromNow(item.answeredAt) }}</span>
            </div>
            <p class="k-text">{{ item.question }}</p>
          </div>
          <div class="k-block">
            <div class="k-block-head">
              <span class="badge blue">AI 초안</span>
              <button
                v-if="editingTicketId !== item.ticketId"
                class="btn-icon-sm"
                @click="startEditDraft(item)"
              >
                <Edit2 :size="13" /> 수정
              </button>
            </div>
            <div v-if="editingTicketId === item.ticketId" class="k-edit-area">
              <textarea v-model="editedDraft" class="field-textarea" rows="6" />
              <div class="k-edit-btns">
                <button class="btn btn-primary" @click="saveEditDraft(item.ticketId)">저장</button>
                <button class="btn btn-ghost" @click="editingTicketId = null">취소</button>
              </div>
            </div>
            <div v-else class="k-draft-box">
              <p class="k-text" style="white-space:pre-line;">{{ item.answer }}</p>
            </div>
          </div>
          <div class="k-actions">
            <button
              class="btn btn-approve"
              :disabled="editingTicketId === item.ticketId"
              @click="approveKnowledge(item)"
            >
              <CheckCircle2 :size="15" /> 승인
            </button>
            <button
              class="btn btn-ghost"
              :disabled="editingTicketId === item.ticketId"
              @click="rejectTicketId = item.ticketId"
            >
              <XCircle :size="15" /> 반려
            </button>
          </div>
        </div>
        </div>
        <div v-if="kTotalPages > 1" class="pager" style="margin-top:12px;">
          <button class="pager-btn" :disabled="kPage === 0" @click="kPage--"><ChevronLeft :size="15" /></button>
          <span class="pager-info">{{ kPage + 1 }} / {{ kTotalPages }}</span>
          <button class="pager-btn" :disabled="kPage >= kTotalPages - 1" @click="kPage++"><ChevronRight :size="15" /></button>
        </div>
      </template>
    </div>

    <!-- 통계 카드 + 티켓 목록 -->
    <div class="main-row">
      <!-- 통계 카드 (클릭 시 오른쪽 패널 변경) -->
      <div class="stat-col">
        <div
          class="card stat-card stat-card--blue"
          :class="{ 'stat-card--active': activeView === 'all' }"
          @click="activeView = 'all'"
        >
          <div class="stat-icon"><Ticket :size="18" color="#2b7fff" /></div>
          <div class="stat-num">{{ deptTickets.length + myActiveTickets.length }}</div>
          <div class="stat-label">총 티켓</div>
          <div class="stat-sub">우리 부서에 배정된 전체 티켓</div>
        </div>
        <div
          class="card stat-card stat-card--green"
          :class="{ 'stat-card--active': activeView === 'my' }"
          @click="activeView = 'my'"
        >
          <div class="stat-icon"><Clock :size="18" color="#00a63e" /></div>
          <div class="stat-num">{{ myDoneTickets.length }}</div>
          <div class="stat-label">내 답장 티켓</div>
          <div class="stat-sub">내가 답변 완료한 티켓</div>
        </div>
        <div
          class="card stat-card stat-card--purple"
          :class="{ 'stat-card--active': activeView === 'done' }"
          @click="activeView = 'done'"
        >
          <div class="stat-icon"><CheckCircle2 :size="18" color="#7c3aed" /></div>
          <div class="stat-num">{{ doneTickets.length }}</div>
          <div class="stat-label">처리 완료</div>
          <div class="stat-sub">최근 1개월 처리 건수</div>
        </div>
      </div>

      <!-- 오른쪽 티켓 목록 패널 -->
      <div class="card ticket-col">
        <div class="section-head">
          <div>
            <div class="section-title">{{ panelMeta.title }}</div>
            <div class="section-desc">{{ panelMeta.desc }}</div>
          </div>
          <span class="count-badge">{{ displayedTickets.length }}건</span>
        </div>

        <div v-if="loading" class="empty-ph" style="height:200px;">불러오는 중...</div>
        <div v-else-if="loadError" class="empty-ph" style="height:200px;">{{ loadError }}</div>
        <template v-else>
          <div v-if="displayedTickets.length === 0" class="empty-ph" style="height:180px;">
            <Ticket :size="36" style="color:#d1d5db;margin-bottom:8px;" />
            표시할 티켓이 없습니다
          </div>
          <template v-else>
            <div class="ticket-list">
              <div
                v-for="t in pagedTickets"
                :key="t.ticketId"
                class="ticket-row"
                :class="{
                  'ticket-row--my': t.assigneeId === auth.userId && t.status === 'ASSIGNED',
                  'ticket-row--done': t.status === 'COMPLETED',
                }"
                @click="openDetail(t)"
              >
                <div class="ticket-meta">
                  <span class="badge" :class="t.sourceChatbotMessageId !== null ? 'blue' : 'gray'">
                    <Bot v-if="t.sourceChatbotMessageId !== null" :size="11" />
                    <Share2 v-else :size="11" />
                    {{ typeLabel(t) }}
                  </span>
                  <span v-if="t.assigneeId === auth.userId && t.status === 'ASSIGNED'" class="badge green" style="font-size:11px;">내 티켓</span>
                  <span v-if="t.status === 'COMPLETED'" class="badge done-badge">완료</span>
                  <span class="ticket-time">{{ fromNow(t.createdAt) }}</span>
                </div>
                <div class="ticket-title">{{ t.title }}</div>
                <div class="ticket-body">{{ t.content }}</div>
              </div>
            </div>
            <div v-if="totalPages > 1" class="pager">
              <button class="pager-btn" :disabled="currentPage === 0" @click="currentPage--"><ChevronLeft :size="15" /></button>
              <span class="pager-info">{{ currentPage + 1 }} / {{ totalPages }}</span>
              <button class="pager-btn" :disabled="currentPage >= totalPages - 1" @click="currentPage++"><ChevronRight :size="15" /></button>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>

  <!-- 티켓 상세 다이얼로그 -->
  <Teleport to="body">
    <div v-if="showDetailDialog && selectedTicket" class="modal-overlay" @click.self="closeDetail">
      <div class="modal-box">
        <!-- 헤더: 제목 + 이관 버튼 (AI 챗봇 배정 + 미답변 티켓에만 표시) -->
        <div class="modal-header detail-header">
          <div class="detail-header-main">
            <div class="modal-title">{{ selectedTicket.title }}</div>
            <div class="modal-desc" style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <span class="badge" :class="selectedTicket.sourceChatbotMessageId !== null ? 'blue' : 'gray'">
                <Bot v-if="selectedTicket.sourceChatbotMessageId !== null" :size="11" />
                <Share2 v-else :size="11" />
                {{ typeLabel(selectedTicket) }}
              </span>
              <span class="ticket-time">{{ fromNow(selectedTicket.createdAt) }}</span>
            </div>
          </div>
          <button
            v-if="canTransfer(selectedTicket)"
            class="btn btn-transfer"
            @click="openTransfer"
          >
            <ArrowRightLeft :size="14" /> 이관하기
          </button>
        </div>

        <div class="modal-body">
          <!-- 질문 내용 -->
          <div class="detail-section">
            <div class="detail-section-label">질문 내용</div>
            <div class="ticket-preview">
              <div class="detail-content">{{ selectedTicket.content }}</div>
            </div>
          </div>

          <!-- 답변 내용 (COMPLETED 티켓에만 표시) -->
          <template v-if="selectedTicket.status === 'COMPLETED'">
            <div class="detail-section">
              <div class="detail-section-label">답변 내용</div>
              <div v-if="detailLoading" class="answer-loading">답변을 불러오는 중...</div>
              <div v-else-if="detailAnswer" class="answer-box">
                <div class="answer-meta">
                  <span class="answer-author">{{ detailAnswer.authorNickname ?? '담당자' }}</span>
                  <span class="answer-time">{{ fromNow(detailAnswer.answeredAt) }}</span>
                </div>
                <div class="detail-content" style="white-space:pre-line;">{{ detailAnswer.content }}</div>
                <!-- 세션 중 첨부한 파일 (BE 파일 미지원 → blob URL) -->
                <div v-if="sessionFiles[selectedTicket.ticketId]?.length" class="file-list" style="margin-top:8px;">
                  <div v-for="f in sessionFiles[selectedTicket.ticketId]" :key="f.name" class="file-item">
                    <Paperclip :size="13" style="color:#aeb2bb;" />
                    <a :href="f.url" target="_blank" class="file-name">{{ f.name }}</a>
                    <span class="file-size">({{ (f.size / 1024).toFixed(1) }}KB)</span>
                  </div>
                </div>
              </div>
              <div v-else class="answer-box" style="color:#aeb2bb;font-size:13px;text-align:center;padding:20px 0;">
                답변 정보를 불러오지 못했습니다.
              </div>
            </div>
          </template>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" @click="closeDetail">닫기</button>
          <button
            v-if="selectedTicket.status === 'ASSIGNED'"
            class="btn btn-primary"
            @click="openAnswer"
          >
            <Send :size="14" /> 답변하기
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 답변 작성 다이얼로그 -->
  <Teleport to="body">
    <div v-if="showAnswerDialog && selectedTicket" class="modal-overlay" @click.self="closeAnswer">
      <div class="modal-box">
        <div class="modal-header">
          <div class="modal-title">답변 작성</div>
          <div class="modal-desc">{{ selectedTicket.title }}</div>
        </div>
        <div class="modal-body">
          <div class="ticket-preview">
            <div class="ticket-meta">
              <span class="badge" :class="selectedTicket.sourceChatbotMessageId !== null ? 'blue' : 'gray'">
                {{ typeLabel(selectedTicket) }}
              </span>
              <span class="ticket-time">{{ fromNow(selectedTicket.createdAt) }}</span>
            </div>
            <div class="detail-content" style="margin-top:6px;">{{ selectedTicket.content }}</div>
          </div>
          <div class="field">
            <label class="field-label">답변 내용</label>
            <textarea v-model="answerText" class="field-textarea" placeholder="답변을 작성하세요..." rows="6" />
          </div>
          <div class="field">
            <label class="field-label">파일 첨부 <span class="field-hint">PDF, 이미지 파일 가능</span></label>
            <input ref="fileInputEl" type="file" multiple accept=".pdf,image/*" class="hidden-input" @change="onFileChange" />
            <button class="btn btn-outline" @click="fileInputEl?.click()">
              <Paperclip :size="13" /> 파일 선택
            </button>
            <div v-if="uploadedFiles.length" class="file-list">
              <div v-for="(f, i) in uploadedFiles" :key="i" class="file-item">
                <Paperclip :size="13" style="color:#aeb2bb;flex-shrink:0;" />
                <span class="file-name">{{ f.name }}</span>
                <span class="file-size">({{ (f.size / 1024).toFixed(1) }}KB)</span>
                <button class="file-remove" @click.stop="removeFile(i)"><X :size="13" /></button>
              </div>
            </div>
          </div>
          <div v-if="submitError" class="error-msg">{{ submitError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="closeAnswer">취소</button>
          <button class="btn btn-primary" :disabled="!answerText.trim() || submitting" @click="submitAnswer">
            <Send :size="14" /> {{ submitting ? '제출 중...' : '답변 등록' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 이관 다이얼로그 -->
  <Teleport to="body">
    <div v-if="showTransferDialog && selectedTicket" class="modal-overlay" @click.self="closeTransfer">
      <div class="modal-box" style="width:480px;">
        <div class="modal-header">
          <div class="modal-title">티켓 이관</div>
          <div class="modal-desc">이관 사유 작성 후 시스템 관리자의 공통 접수 티켓로 이동됩니다</div>
        </div>
        <div class="modal-body">
          <div class="info-box">
            이관된 티켓은 공통 접수 티켓로 이동하고 시스템 관리자가 적합한 부서로 재배정합니다.
          </div>
          <div class="field">
            <label class="field-label">이관 사유</label>
            <textarea
              v-model="transferReason"
              class="field-textarea"
              placeholder="이관 사유를 입력하세요 (예: 우리 부서 업무 범위가 아님)"
              rows="4"
            />
          </div>
          <div v-if="transferError" class="error-msg">{{ transferError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="closeTransfer">취소</button>
          <button class="btn btn-primary" :disabled="!transferReason.trim() || transferring" @click="submitTransfer">
            {{ transferring ? '이관 중...' : '이관하기' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 반려 확인 다이얼로그 -->
  <Teleport to="body">
    <div v-if="rejectTicketId !== null" class="modal-overlay" @click.self="rejectTicketId = null">
      <div class="modal-box" style="width:400px;">
        <div class="modal-header">
          <div class="modal-title">지식화 반려</div>
          <div class="modal-desc">이 지식화를 반려하시겠습니까? 반려된 항목은 삭제됩니다.</div>
        </div>
        <div class="modal-footer" style="border-top:none;padding-top:8px;">
          <button class="btn btn-ghost" @click="rejectTicketId = null">취소</button>
          <button class="btn btn-danger" @click="confirmReject">반려하기</button>
        </div>
      </div>
    </div>
  </Teleport>

  <BaseToast v-model="toastVisible" :title="toastTitle" :sub="toastSub" :type="toastType" />
</template>

<style scoped>
/* ── 차트 ── */
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.chart-card { padding: 22px 24px; }
.chart-title { font-size: 15px; font-weight: 700; color: #1f2430; margin-bottom: 2px; }
.chart-sub { font-size: 12.5px; color: #aeb2bb; margin-bottom: 14px; }

/* ── 지식화 섹션 ── */
.section-card { padding: 22px 24px; margin-bottom: 20px; }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
.section-title { font-size: 15px; font-weight: 700; color: #1f2430; margin-bottom: 4px; }
.section-desc { font-size: 12.5px; color: #aeb2bb; }
.count-badge { flex-shrink: 0; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 99px; color: #64748b; font-size: 13px; font-weight: 700; padding: 4px 12px; }

.k-list { display: flex; flex-direction: column; gap: 14px; }
.k-card { border: 1px solid var(--line); border-left: 4px solid #f5c000; border-radius: 10px; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.k-block { display: flex; flex-direction: column; gap: 6px; }
.k-block-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.k-who { font-size: 12px; color: #aeb2bb; }
.k-text { font-size: 13px; color: #6b7280; line-height: 1.6; }
.k-draft-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; }
.k-edit-area { display: flex; flex-direction: column; gap: 8px; }
.k-edit-btns { display: flex; gap: 8px; }
.k-actions { display: flex; gap: 8px; padding-top: 4px; }

/* ── 통계 + 티켓 레이아웃 ── */
/* align-items: stretch(기본값)로 좌우 동일 높이 */
.main-row { display: grid; grid-template-columns: 260px 1fr; gap: 16px; align-items: stretch; }
.stat-col { display: flex; flex-direction: column; gap: 14px; }

/* 클릭 가능한 통계 카드 — flex:1 로 3개 카드가 균등하게 늘어나 오른쪽 패널과 높이 맞춤 */
.stat-card { padding: 18px 20px; cursor: pointer; transition: box-shadow 0.15s, transform 0.1s; user-select: none; flex: 1; }
.stat-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.stat-card--blue  { border-left: 4px solid #2b7fff; }
.stat-card--green { border-left: 4px solid #00a63e; }
.stat-card--purple{ border-left: 4px solid #7c3aed; }
.stat-card--active.stat-card--blue   { box-shadow: 0 0 0 2px #2b7fff, 0 4px 16px rgba(43,127,255,0.18); }
.stat-card--active.stat-card--green  { box-shadow: 0 0 0 2px #00a63e, 0 4px 16px rgba(0,166,62,0.18); }
.stat-card--active.stat-card--purple { box-shadow: 0 0 0 2px #7c3aed, 0 4px 16px rgba(124,58,237,0.18); }
.stat-icon { margin-bottom: 8px; }
.stat-num  { font-size: 28px; font-weight: 900; color: #1f2430; line-height: 1; }
.stat-label{ font-size: 14px; font-weight: 700; color: #1f2430; margin-top: 4px; }
.stat-sub  { font-size: 12px; color: #aeb2bb; margin-top: 2px; }

/* ── 티켓 목록 패널 ── */
.ticket-col { padding: 22px 24px; }
.ticket-list { display: flex; flex-direction: column; gap: 8px; }
.ticket-row { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; cursor: pointer; transition: background 0.15s; }
.ticket-row:hover { background: #f8fafc; }
.ticket-row--my   { border-left: 3px solid #00a63e; }
.ticket-row--done { border-left: 3px solid #7c3aed; }
.ticket-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.ticket-time { font-size: 12px; color: #aeb2bb; }
.ticket-title { font-size: 14px; font-weight: 600; color: #1f2430; margin-bottom: 3px; }
.ticket-body { font-size: 13px; color: #6b7280; line-height: 1.5; overflow: hidden; max-height: 3em; }
.badge { display: inline-flex; align-items: center; gap: 4px; }
.done-badge { font-size: 11px; background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; border-radius: 99px; padding: 1px 8px; }

/* ── 페이지네이션 ── */
.pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); }
.pager-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 7px; border: 1.5px solid var(--line); background: none; cursor: pointer; color: #1f2430; transition: all 0.15s; }
.pager-btn:hover:not(:disabled) { background: #f1f5f9; border-color: #2b7fff; color: #2b7fff; }
.pager-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.pager-info { font-size: 13px; font-weight: 600; color: #6b7280; min-width: 44px; text-align: center; }

/* ── 모달 ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9000; }
.modal-box { background: #fff; border-radius: 16px; width: 600px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px); display: flex; flex-direction: column; }
.modal-header { padding: 24px 28px 0; }
.modal-title { font-size: 16px; font-weight: 700; color: #1f2430; }
.modal-desc  { font-size: 13px; color: #aeb2bb; margin-top: 4px; }
.modal-body  { padding: 20px 28px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.modal-footer{ padding: 16px 28px 24px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--line); }

/* 상세 모달 헤더: 제목 영역 + 이관 버튼 나란히 */
.detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.detail-header-main { flex: 1; min-width: 0; }

/* ── 상세 섹션 ── */
.detail-section { display: flex; flex-direction: column; gap: 8px; }
.detail-section-label { font-size: 11.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
.detail-content { font-size: 14px; color: #374151; line-height: 1.7; }

/* ── 답변 박스 ── */
.answer-loading { font-size: 13px; color: #aeb2bb; text-align: center; padding: 20px 0; }
.answer-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.answer-meta { display: flex; align-items: center; gap: 8px; }
.answer-author { font-size: 13px; font-weight: 600; color: #00a63e; }
.answer-time { font-size: 12px; color: #aeb2bb; }

/* ── 티켓 미리보기 ── */
.ticket-preview { background: #f8fafc; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }

/* ── 안내 박스 ── */
.info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #1d4ed8; line-height: 1.6; }

/* ── 폼 ── */
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 13px; font-weight: 600; color: #1f2430; display: flex; align-items: center; gap: 8px; }
.field-hint { font-size: 11.5px; font-weight: 400; color: #aeb2bb; }
.field-textarea { width: 100%; resize: vertical; border: 1.5px solid var(--line); border-radius: 8px; padding: 10px 12px; font-size: 14px; color: #1f2430; font-family: inherit; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
.field-textarea:focus { border-color: #2b7fff; }
.hidden-input { display: none; }

/* ── 파일 ── */
.file-list { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
.file-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #f8fafc; border: 1px solid var(--line); border-radius: 8px; }
.file-name { font-size: 13px; color: #1f2430; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 12px; color: #aeb2bb; flex-shrink: 0; }
.file-remove { background: none; border: none; cursor: pointer; display: flex; align-items: center; color: #aeb2bb; padding: 2px; transition: color 0.15s; }
.file-remove:hover { color: #ef4444; }

/* ── 에러 ── */
.error-msg { font-size: 13px; color: #ef4444; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; }

/* ── 버튼 ── */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
.btn-primary { background: #2b7fff; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #1d6ef8; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost   { background: none; color: #6b7280; border: 1.5px solid var(--line); }
.btn-ghost:hover { background: #f8fafc; }
.btn-outline { background: none; color: #1f2430; border: 1.5px solid var(--line); }
.btn-outline:hover { background: #f8fafc; }
.btn-transfer { background: none; color: #f59e0b; border: 1.5px solid #f59e0b; flex-shrink: 0; }
.btn-transfer:hover { background: #fffbeb; }
.btn-approve { background: #00a63e; color: #fff; }
.btn-approve:hover:not(:disabled) { background: #008f33; }
.btn-approve:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-danger  { background: #ef4444; color: #fff; }
.btn-danger:hover { background: #dc2626; }
.btn-icon-sm { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #6b7280; background: none; border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; cursor: pointer; transition: all 0.15s; }
.btn-icon-sm:hover { background: #f8fafc; color: #1f2430; }

/* ── 공통 ── */
.empty-ph { display: flex; flex-direction: column; align-items: center; justify-content: center; color: #aeb2bb; font-size: 13.5px; text-align: center; }
</style>
