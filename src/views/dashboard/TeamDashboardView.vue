<script setup lang="ts">
// ── 페이지 개요 ──────────────────────────────────────────────
// USER(일반 사원)가 자신의 부서에 배정된 티켓을 확인·답변하는 뷰.
// 역할: 부서 공용 큐 티켓 답변 / 내 답장 티켓 조회 / 처리 완료 이력 조회
//
// 핵심 구현 포인트
//   1. 티켓 버킷 분리: BE가 단일 status 필터만 지원하므로 ASSIGNED·COMPLETED를
//      병렬 조회한 뒤 FE에서 deptTickets / myTickets / doneTickets 3개로 분류한다.
//   2. 파일 영속: BE 파일 첨부 미지원 → 답변 시 blob URL(세션) + IndexedDB(새로고침 후 복원) 이중 저장.
//   3. 내 답장 추적: 부서 공용 큐에서 답변하면 BE가 assigneeId를 갱신하지 않을 수 있어
//      answeredInSession(localStorage 영속)으로 직접 답변한 ticketId를 추적한다.
//   4. 만료 배지: ASSIGNED 48h 미처리 시 BE 스케줄러가 공통 접수 큐로 이동시키므로
//      updatedAt 기준으로 남은 시간을 계산해 부서 티켓 목록에 배지로 표시한다.
import { ref, reactive, computed, onMounted } from 'vue'
import { Ticket, Clock, CheckCircle2, Bot, UserCheck, Paperclip, X, ChevronLeft, ChevronRight } from '@lucide/vue'
import { getTickets, answerTicket, getLatestAnswer } from '@/api/ticketApi'
import { useAuthStore } from '@/stores/authStore'
import type { TicketResponse, TicketAnswerResponse } from '@/types/ticket'
import BaseToast from '@/components/common/BaseToast.vue'

const auth = useAuthStore()

// 답변 제출·이관 요청 결과를 BaseToast로 표시하기 위한 상태
const toastVisible = ref(false)
const toastTitle = ref('')
const toastSub = ref('')
const toastType = ref<'success' | 'error'>('success')
function showToast(title: string, sub = '', type: 'success' | 'error' = 'success') {
  toastTitle.value = title
  toastSub.value = sub
  toastType.value = type
  toastVisible.value = true
}

// ── 티켓 버킷 ────────────────────────────────────────────────
// BE는 단일 status 필터만 지원하므로 ASSIGNED·COMPLETED를 각각 최대 100건씩 병렬 조회한 뒤
// FE에서 세 버킷으로 분리한다.
//   deptTickets : ASSIGNED + assigneeId === null  → 부서 공용 큐 (담당자 미지정)
//   myTickets   : ASSIGNED + assigneeId === 내 userId  (담당 진행 중)
//               + COMPLETED + (assigneeId === 나 OR answeredInSession에 있음)
//                 → BE가 assigneeId를 COMPLETED 후에도 갱신하지 않는 케이스가 있어
//                   answeredInSession(localStorage 영속)으로 직접 답변한 티켓을 추적한다.
//   doneTickets : COMPLETED 전체 (최근 1개월, updatedAt 기준)
//
// 요약 통계 카드 클릭 → 해당 섹션으로 smooth scroll (scrollIntoView)
const deptSectionRef = ref<HTMLElement | null>(null)
const mySectionRef   = ref<HTMLElement | null>(null)
const doneSectionRef = ref<HTMLElement | null>(null)

function scrollTo(el: HTMLElement | null) {
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const deptTickets = ref<TicketResponse[]>([])
const myTickets = ref<TicketResponse[]>([])
const doneTickets = ref<TicketResponse[]>([])
const loading = ref(false)
const error = ref('')

// 목록이 길어지면 스크롤 없이 섹션당 4건씩 보여주고 화살표로 넘기는 방식
// totalPages는 최소 1로 보정해서 빈 목록일 때 "0/0" 표시 방지
const PAGE_SIZE = 4
const deptPage = ref(0)
const myPage = ref(0)
const donePage = ref(0)
const deptTotalPages = computed(() => Math.max(1, Math.ceil(deptTickets.value.length / PAGE_SIZE)))
const myTotalPages = computed(() => Math.max(1, Math.ceil(myTickets.value.length / PAGE_SIZE)))
const doneTotalPages = computed(() => Math.max(1, Math.ceil(doneTickets.value.length / PAGE_SIZE)))
const deptPaged = computed(() => deptTickets.value.slice(deptPage.value * PAGE_SIZE, (deptPage.value + 1) * PAGE_SIZE))
const myPaged = computed(() => myTickets.value.slice(myPage.value * PAGE_SIZE, (myPage.value + 1) * PAGE_SIZE))
const donePaged = computed(() => doneTickets.value.slice(donePage.value * PAGE_SIZE, (donePage.value + 1) * PAGE_SIZE))

// 부서 공용 큐에서 티켓을 클릭했을 때 답변 작성 다이얼로그
const selectedTicket = ref<TicketResponse | null>(null)
const showAnswerDialog = ref(false)
const answerText = ref('')
const uploadedFiles = ref<File[]>([])
const submitting = ref(false)
const submitError = ref('')
const fileInputEl = ref<HTMLInputElement | null>(null)

// 내 답장·처리 완료 티켓을 클릭했을 때 질문+답변 상세 보기 다이얼로그
// detailMode로 두 섹션이 같은 다이얼로그 컴포넌트를 공유
const detailTicket = ref<TicketResponse | null>(null)
const detailMode = ref<'my' | 'done'>('my')
const showDetailDialog = ref(false)
const latestAnswer = ref<TicketAnswerResponse | null>(null)
const detailLoading = ref(false)

// ── 파일 저장소 ──────────────────────────────────────────────
// BE가 파일 첨부를 아직 미지원하므로 FE에서 이중 저장 전략을 사용한다.
//   sessionFiles : 메모리 내 reactive 객체. 답변 직후 blob URL로 즉시 표시.
//                  페이지를 새로고침하면 초기화된다.
//   IndexedDB    : File 객체(Blob 포함)를 브라우저 로컬 스토리지에 영속 저장.
//                  새로고침 후 상세 다이얼로그를 열면 IDB에서 파일을 꺼내
//                  URL.createObjectURL 로 blob URL을 재생성해 sessionFiles에 채운다.
//                  결과적으로 사용자는 새로고침 후에도 첨부 파일을 열람할 수 있다.
type SavedFile = { name: string; size: number; url: string }
const sessionFiles = reactive<Record<number, SavedFile[]>>({})

const IDB_NAME = 'wk_files', IDB_STORE = 'ticket_files'

// IndexedDB 연결: objectStore가 없으면 onupgradeneeded에서 생성
function openFilesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ticketId를 키로 File 배열을 IDB에 저장. 실패해도 UX를 막지 않도록 오류를 삼킨다.
async function saveToIDB(ticketId: number, files: File[]): Promise<void> {
  try {
    const db = await openFilesDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put({ files }, ticketId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {}
}

// IDB에서 File 배열을 꺼내 blob URL로 변환. 데이터가 없거나 오류면 빈 배열 반환.
async function loadFromIDB(ticketId: number): Promise<SavedFile[]> {
  try {
    const db = await openFilesDB()
    return await new Promise<SavedFile[]>((resolve) => {
      const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(ticketId)
      req.onsuccess = () => {
        const record: { files: File[] } | undefined = req.result
        if (!record?.files?.length) { resolve([]); return }
        resolve(record.files.map(f => ({ name: f.name, size: f.size, url: URL.createObjectURL(f) })))
      }
      req.onerror = () => resolve([])
    })
  } catch { return [] }
}

// 이번 세션(페이지 로드 이후)에 직접 답변한 티켓 ID 집합.
// 새로고침 후에도 myTickets에 남아야 하므로 localStorage에 영속한다.
// loadAll이 호출될 때마다 이 Set을 참조해 COMPLETED 티켓을 myTickets에 포함시킨다.
const ANSWERED_KEY = 'wk_answered_tickets'
function loadAnsweredSet(): Set<number> {
  try { return new Set<number>(JSON.parse(localStorage.getItem(ANSWERED_KEY) ?? '[]')) }
  catch { return new Set() }
}
const answeredInSession = loadAnsweredSet()

// ASSIGNED·COMPLETED를 병렬 조회해 FE에서 세 버킷으로 분류한다.
// myTickets는 두 가지 소스를 합친다:
//   1) ASSIGNED 중 assigneeId === 내 userId  (관리자가 나에게 직접 배정한 진행 중 티켓)
//   2) COMPLETED 중 assigneeId === 나 OR answeredInSession에 있는 것
//      — BE가 assigneeId를 갱신하지 않는 케이스(부서 공용 큐에서 답변)를 보완하기 위해
//        답변 시 answeredInSession에 ticketId를 기록하고 여기서 합산한다.
async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const [assignedRes, doneRes] = await Promise.all([
      getTickets({ status: 'ASSIGNED', size: 100 }),
      getTickets({ status: 'COMPLETED', size: 100 }),
    ])
    const assigned = assignedRes.data.content
    const done = doneRes.data.content.filter(t => new Date(t.updatedAt) >= oneMonthAgo)
    deptTickets.value = assigned.filter(t => t.assigneeId === null)
    myTickets.value = [
      ...assigned
        .filter(t => t.assigneeId === auth.userId)
        .filter(t => new Date(t.updatedAt) >= oneMonthAgo),
      ...done.filter(t => t.assigneeId === auth.userId || answeredInSession.has(t.ticketId)),
    ]
    doneTickets.value = done
    deptPage.value = 0
    myPage.value = 0
    donePage.value = 0
  } catch {
    error.value = '티켓 목록을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)

// ── 만료 타이머 (부서 티켓용, 48h) ──────────────────────────
// ASSIGNED 상태에서 48시간 미답변 시 BE 스케줄러가 COMMON_QUEUE로 이동시킨다.
// BE에 assignedAt 필드가 없으므로 updatedAt(상태 변경 시각)을 기준으로 근사 계산한다.
function assignedExpiryMs(updatedAt: string): number {
  return new Date(updatedAt).getTime() + 48 * 3600000 - Date.now()
}
function assignedExpiryLabel(updatedAt: string): string {
  const ms = assignedExpiryMs(updatedAt)
  if (ms <= 0) return '만료됨'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}일 후 공통 티켓 이동`
  if (h > 0) return `${h}시간 후 공통 티켓 이동`
  return `${m}분 후 공통 티켓 이동`
}
function assignedExpiryClass(updatedAt: string): string {
  const ms = assignedExpiryMs(updatedAt)
  if (ms <= 0) return 'expiry-expired'
  const h = ms / 3600000
  if (h <= 12) return 'expiry-urgent'
  if (h <= 24) return 'expiry-warning'
  return 'expiry-ok'
}

// 티켓 배지 텍스트: routingDecision으로 배정 주체를 구분한다.
// sourceChatbotMessageId(챗봇 대화 경유 여부)가 아닌 routingDecision을 사용하는 이유는
// 챗봇 경유 티켓도 관리자가 재배정하면 ADMIN_REVIEW로 변경되기 때문이다.
function typeLabel(t: TicketResponse) {
  return t.routingDecision === 'AUTO_ASSIGNED' ? 'AI 챗봇 배정' : '관리자 배정'
}

// 생성/수정 시각을 "N분 전" 형태로 변환해 목록에 표시
function fromNow(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}시간 전`
  const days = Math.floor(h / 24)
  return days === 1 ? '어제' : `${days}일 전`
}

// ── 답변 작성 다이얼로그 ─────────────────────────────────────
// 부서 공용 큐 티켓 클릭 시 열림 / 닫힐 때 모든 입력 상태 초기화
function openAnswer(t: TicketResponse) {
  selectedTicket.value = t
  answerText.value = ''
  uploadedFiles.value = []
  submitError.value = ''
  showAnswerDialog.value = true
}

function closeAnswer() {
  showAnswerDialog.value = false
  selectedTicket.value = null
  answerText.value = ''
  uploadedFiles.value = []
  submitError.value = ''
}

// 파일 input의 change 이벤트 → 기존 목록에 누적 추가, input 값은 매번 초기화해 같은 파일 재선택 허용
function onFileChange(e: Event) {
  const inp = e.target as HTMLInputElement
  uploadedFiles.value = [...uploadedFiles.value, ...Array.from(inp.files ?? [])]
  inp.value = ''
}

function removeFile(i: number) {
  uploadedFiles.value = uploadedFiles.value.filter((_, idx) => idx !== i)
}

// 답변 제출 흐름:
//   1. POST /tickets/{id}/answers  → BE가 티켓 상태를 COMPLETED로 전환
//   2. 첨부 파일을 sessionFiles(blob URL)와 IDB(File 객체) 양쪽에 저장
//   3. answeredInSession에 ticketId 추가 + localStorage 갱신
//      → 다음 loadAll 호출 시 COMPLETED 티켓도 myTickets에 포함됨
//   4. loadAll()로 세 버킷 갱신
// 실패 시 409(중복)/403(권한) 별로 에러 메시지 표시, 다이얼로그는 닫지 않음
async function submitAnswer() {
  if (!selectedTicket.value || !answerText.value.trim()) return
  submitting.value = true
  submitError.value = ''
  try {
    const ticketId = selectedTicket.value.ticketId
    const files = [...uploadedFiles.value]
    await answerTicket(ticketId, answerText.value.trim())
    // 메모리(blob URL) + IDB(File 객체, 새로고침 후 복원용) 동시 저장
    sessionFiles[ticketId] = files.map(f => ({ name: f.name, size: f.size, url: URL.createObjectURL(f) }))
    await saveToIDB(ticketId, files)
    answeredInSession.add(ticketId)
    try { localStorage.setItem(ANSWERED_KEY, JSON.stringify([...answeredInSession])) } catch {}
    closeAnswer()
    showToast('답변이 등록되었습니다', '티켓이 내 답장 티켓으로 이동되었습니다', 'success')
    await loadAll()
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 409) {
      submitError.value = '이미 처리된 티켓입니다.'
    } else if (status === 403) {
      submitError.value = '답변 권한이 없습니다.'
    } else {
      submitError.value = '답변 제출에 실패했습니다. 다시 시도해주세요.'
    }
  } finally {
    submitting.value = false
  }
}

// ── 상세 보기 다이얼로그 ─────────────────────────────────────
// 내 답장·처리 완료 티켓 클릭 시 열린다. detailMode로 두 섹션이 같은 다이얼로그를 공유한다.
// 다이얼로그를 먼저 열어 즉각 반응성을 주고, 답변 조회·IDB 파일 복원을 병렬로 수행한다.
//   - IDB 복원: sessionFiles에 데이터가 없으면(새로고침 후) IDB에서 File 객체를 꺼내
//               blob URL을 재생성해 sessionFiles에 채운다. 이후 템플릿이 자동으로 재렌더한다.
//   - 답변 조회: GET /tickets/{id}/answers/latest 실패 시 null 유지, 답변란만 빈 상태로 표시.
async function openDetail(t: TicketResponse, mode: 'my' | 'done') {
  detailTicket.value = t
  detailMode.value = mode
  latestAnswer.value = null
  detailLoading.value = true
  showDetailDialog.value = true
  try {
    // IDB 복원과 최신 답변 조회를 병렬로 실행
    const [idbFiles, answerRes] = await Promise.all([
      sessionFiles[t.ticketId]?.length ? Promise.resolve<SavedFile[]>([]) : loadFromIDB(t.ticketId),
      getLatestAnswer(t.ticketId).catch(() => null),
    ])
    // sessionFiles가 없을 때만 IDB 결과로 채움 (blob URL 재생성)
    if (idbFiles.length && !sessionFiles[t.ticketId]?.length) {
      sessionFiles[t.ticketId] = idbFiles
    }
    if (answerRes) latestAnswer.value = answerRes.data
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  showDetailDialog.value = false
  detailTicket.value = null
  latestAnswer.value = null
}

</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <h1 class="page-title">
        <Ticket :size="28" color="#2b7fff" />
        부서 대시보드
      </h1>
      <p class="page-sub">우리 부서의 티켓을 확인하고 처리하세요.</p>
    </div>

    <div v-if="loading" class="empty-ph" style="height: 200px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height: 200px;">{{ error }}</div>

    <template v-else>
      <div class="cards-stack">
        <!-- 요약 통계 -->
        <div class="stat-grid">
          <div class="card stat-card stat-card--blue" @click="scrollTo(deptSectionRef)">
            <div class="stat-icon"><Ticket :size="18" color="#2b7fff" /></div>
            <div class="stat-num">{{ deptTickets.length }}</div>
            <div class="stat-label">부서 티켓</div>
            <div class="stat-sub">처리 대기 중</div>
          </div>
          <div class="card stat-card stat-card--green" @click="scrollTo(mySectionRef)">
            <div class="stat-icon"><Clock :size="18" color="#00a63e" /></div>
            <div class="stat-num">{{ myTickets.length }}</div>
            <div class="stat-label">내 답장 티켓</div>
            <div class="stat-sub">내가 처리 중</div>
          </div>
          <div class="card stat-card stat-card--purple" @click="scrollTo(doneSectionRef)">
            <div class="stat-icon"><CheckCircle2 :size="18" color="#7c3aed" /></div>
            <div class="stat-num">{{ doneTickets.length }}</div>
            <div class="stat-label">처리 완료</div>
            <div class="stat-sub">완료된 티켓</div>
          </div>
        </div>

        <!-- 부서 티켓 -->
        <div ref="deptSectionRef" class="card section-card">
          <div class="section-head">
            <div>
              <div class="section-title"><Ticket :size="15" color="#2b7fff" /> 부서 티켓</div>
              <div class="section-desc">우리 부서로 배정된 티켓입니다. 클릭하여 답변을 작성하세요.</div>
            </div>
            <span class="count-badge">{{ deptTickets.length }}건</span>
          </div>
          <div v-if="deptTickets.length === 0" class="empty-ph" style="height: 100px;">대기 중인 부서 티켓이 없습니다.</div>
          <template v-else>
            <div class="ticket-list">
              <div v-for="t in deptPaged" :key="t.ticketId" class="ticket-row" @click="openAnswer(t)">
                <div class="ticket-meta">
                  <span class="badge" :class="t.routingDecision === 'AUTO_ASSIGNED' ? 'blue' : 'gray'">
                    <Bot v-if="t.routingDecision === 'AUTO_ASSIGNED'" :size="11" />
                    <UserCheck v-else :size="11" />
                    {{ typeLabel(t) }}
                  </span>
                  <span class="expiry-tag" :class="assignedExpiryClass(t.updatedAt)">
                    <Clock :size="10" />
                    {{ assignedExpiryLabel(t.updatedAt) }}
                  </span>
                  <span class="ticket-time">{{ fromNow(t.createdAt) }}</span>
                </div>
                <div class="ticket-title">{{ t.title }}</div>
                <div class="ticket-body">{{ t.content }}</div>
              </div>
            </div>
            <div v-if="deptTotalPages > 1" class="pager">
              <button class="pager-btn" :disabled="deptPage === 0" @click="deptPage--"><ChevronLeft :size="15" /></button>
              <span class="pager-info">{{ deptPage + 1 }} / {{ deptTotalPages }}</span>
              <button class="pager-btn" :disabled="deptPage >= deptTotalPages - 1" @click="deptPage++"><ChevronRight :size="15" /></button>
            </div>
          </template>
        </div>

        <!-- 내 답장 티켓 -->
        <div ref="mySectionRef" class="card section-card">
          <div class="section-head">
            <div>
              <div class="section-title"><Clock :size="15" color="#00a63e" /> 내 답장 티켓</div>
              <div class="section-desc">내가 담당하는 티켓입니다. 클릭하여 질문·답변 내용을 확인하세요.</div>
            </div>
            <span class="count-badge">{{ myTickets.length }}건</span>
          </div>
          <div v-if="myTickets.length === 0" class="empty-ph" style="height: 100px;">담당 중인 티켓이 없습니다.</div>
          <template v-else>
            <div class="ticket-list">
              <div v-for="t in myPaged" :key="t.ticketId" class="ticket-row" @click="openDetail(t, 'my')">
                <div class="ticket-meta">
                  <span class="badge" :class="t.routingDecision === 'AUTO_ASSIGNED' ? 'blue' : 'gray'">
                    <Bot v-if="t.routingDecision === 'AUTO_ASSIGNED'" :size="11" />
                    <UserCheck v-else :size="11" />
                    {{ typeLabel(t) }}
                  </span>
                  <span class="ticket-time">{{ fromNow(t.createdAt) }}</span>
                </div>
                <div class="ticket-title">{{ t.title }}</div>
                <div class="ticket-body">{{ t.content }}</div>
              </div>
            </div>
            <div v-if="myTotalPages > 1" class="pager">
              <button class="pager-btn" :disabled="myPage === 0" @click="myPage--"><ChevronLeft :size="15" /></button>
              <span class="pager-info">{{ myPage + 1 }} / {{ myTotalPages }}</span>
              <button class="pager-btn" :disabled="myPage >= myTotalPages - 1" @click="myPage++"><ChevronRight :size="15" /></button>
            </div>
          </template>
        </div>

        <!-- 처리 완료 -->
        <div ref="doneSectionRef" class="card section-card">
          <div class="section-head">
            <div>
              <div class="section-title"><CheckCircle2 :size="15" color="#7c3aed" /> 처리 완료</div>
              <div class="section-desc">우리 부서에서 처리 완료된 티켓입니다. 클릭하여 내용을 확인하세요.</div>
            </div>
            <span class="count-badge">{{ doneTickets.length }}건</span>
          </div>
          <div v-if="doneTickets.length === 0" class="empty-ph" style="height: 100px;">처리 완료된 티켓이 없습니다.</div>
          <template v-else>
            <div class="ticket-list">
              <div v-for="t in donePaged" :key="t.ticketId" class="ticket-row ticket-row--done" @click="openDetail(t, 'done')">
                <div class="ticket-meta">
                  <span class="badge gray">
                    <Bot v-if="t.routingDecision === 'AUTO_ASSIGNED'" :size="11" />
                    <UserCheck v-else :size="11" />
                    {{ typeLabel(t) }}
                  </span>
                  <span class="ticket-time">완료: {{ fromNow(t.updatedAt) }}</span>
                </div>
                <div class="ticket-title">{{ t.title }}</div>
                <div class="ticket-body">{{ t.content }}</div>
              </div>
            </div>
            <div v-if="doneTotalPages > 1" class="pager">
              <button class="pager-btn" :disabled="donePage === 0" @click="donePage--"><ChevronLeft :size="15" /></button>
              <span class="pager-info">{{ donePage + 1 }} / {{ doneTotalPages }}</span>
              <button class="pager-btn" :disabled="donePage >= doneTotalPages - 1" @click="donePage++"><ChevronRight :size="15" /></button>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>

  <!-- 답변 작성 다이얼로그 -->
  <Teleport to="body">
    <div v-if="showAnswerDialog" class="modal-overlay" @click.self="closeAnswer">
      <div class="modal-box">
        <div class="modal-header">
          <div class="modal-title">티켓 답변 작성</div>
          <div class="modal-desc">사용자에게 전달할 답변을 작성하세요</div>
        </div>

        <div v-if="selectedTicket" class="modal-body">
          <div class="ticket-preview">
            <div class="ticket-meta">
              <span class="badge" :class="selectedTicket.routingDecision === 'AUTO_ASSIGNED' ? 'blue' : 'gray'">
                {{ typeLabel(selectedTicket) }}
              </span>
              <span class="ticket-time">{{ fromNow(selectedTicket.createdAt) }}</span>
            </div>
            <div class="ticket-title">{{ selectedTicket.title }}</div>
            <div class="ticket-body" style="margin-top:6px; max-height: none;">{{ selectedTicket.content }}</div>
          </div>

          <div class="field">
            <label class="field-label">답변 내용</label>
            <textarea
              v-model="answerText"
              class="field-textarea"
              placeholder="답변을 작성하세요..."
              rows="6"
            />
          </div>

          <div class="field">
            <label class="field-label">파일 첨부</label>
            <input
              ref="fileInputEl"
              type="file"
              multiple
              accept=".pdf,.txt,.docx"
              class="hidden-input"
              @change="onFileChange"
            />
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
          <button
            class="btn btn-primary"
            :disabled="!answerText.trim() || submitting"
            @click="submitAnswer"
          >
            {{ submitting ? '제출 중...' : '답변 완료' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <BaseToast v-model="toastVisible" :title="toastTitle" :sub="toastSub" :type="toastType" />

  <!-- 상세 보기 다이얼로그 (내 답장 / 처리 완료 공용) -->
  <Teleport to="body">
    <div v-if="showDetailDialog && detailTicket" class="modal-overlay" @click.self="closeDetail">
      <div class="modal-box">
        <div class="modal-header">
          <div class="modal-title">{{ detailMode === 'my' ? '내 답장 티켓 상세' : '처리 완료 티켓 상세' }}</div>
          <div class="modal-desc">
            {{ detailMode === 'my' ? '내가 처리한 티켓의 질문과 답변 내용입니다' : '부서에서 처리 완료된 티켓의 질문과 답변 내용입니다' }}
          </div>
        </div>

        <div class="modal-body">
          <!-- 질문 -->
          <div class="detail-section">
            <div class="detail-label">질문</div>
            <div class="ticket-preview">
              <div class="ticket-meta">
                <span class="badge" :class="detailTicket.routingDecision === 'AUTO_ASSIGNED' ? 'blue' : 'gray'">
                  <Bot v-if="detailTicket.routingDecision === 'AUTO_ASSIGNED'" :size="11" />
                  <UserCheck v-else :size="11" />
                  {{ typeLabel(detailTicket) }}
                </span>
                <span class="ticket-time">{{ fromNow(detailTicket.createdAt) }}</span>
              </div>
              <div class="ticket-title">{{ detailTicket.title }}</div>
              <div style="font-size:13px; color:#6b7280; line-height:1.6; margin-top:6px;">{{ detailTicket.content }}</div>
            </div>
          </div>

          <!-- 답변 -->
          <div class="detail-section">
            <div class="detail-label">답변<span v-if="latestAnswer?.authorNickname" class="detail-who"> · {{ latestAnswer.authorNickname }}</span></div>
            <div class="ticket-preview answer-preview">
              <div v-if="detailLoading" style="font-size:13px; color:#aeb2bb;">불러오는 중...</div>
              <div v-else-if="latestAnswer?.content" style="font-size:13.5px; color:#1f2430; line-height:1.7;">
                {{ latestAnswer.content }}
              </div>
              <div v-else style="font-size:13px; color:#aeb2bb;">
                {{ detailMode === 'my' ? '아직 답변이 작성되지 않았습니다.' : '답변 내용을 불러올 수 없습니다.' }}
              </div>
            </div>
            <!-- 첨부 파일: BE fileUrl 또는 sessionFiles (IDB 복원 포함) -->
            <template v-if="latestAnswer?.fileUrl || sessionFiles[detailTicket.ticketId]?.length">
              <div class="detail-files-label">첨부 파일</div>
              <div class="file-list">
                <a
                  v-if="latestAnswer?.fileUrl"
                  :href="latestAnswer.fileUrl"
                  target="_blank"
                  class="file-item file-item--link"
                >
                  <Paperclip :size="13" style="color:#aeb2bb;flex-shrink:0;" />
                  <span class="file-name">{{ latestAnswer.fileName ?? '첨부 파일' }}</span>
                  <span v-if="latestAnswer.fileSize" class="file-size">({{ (latestAnswer.fileSize / 1024).toFixed(1) }}KB)</span>
                </a>
                <a
                  v-for="(f, i) in sessionFiles[detailTicket.ticketId] ?? []"
                  :key="i"
                  :href="f.url"
                  target="_blank"
                  class="file-item file-item--link"
                >
                  <Paperclip :size="13" style="color:#aeb2bb;flex-shrink:0;" />
                  <span class="file-name">{{ f.name }}</span>
                  <span class="file-size">({{ (f.size / 1024).toFixed(1) }}KB)</span>
                </a>
              </div>
            </template>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-primary" @click="closeDetail">닫기</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cards-stack { display: flex; flex-direction: column; gap: 20px; }

/* ── 요약 통계 ── */
.stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.stat-card { padding: 20px 22px; cursor: pointer; transition: box-shadow 0.15s, transform 0.1s; }
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,0.09); }
.stat-card--blue  { border-left: 4px solid #2b7fff; }
.stat-card--green { border-left: 4px solid #00a63e; }
.stat-card--purple{ border-left: 4px solid #7c3aed; }
.stat-icon { margin-bottom: 10px; }
.stat-num  { font-size: 32px; font-weight: 900; color: #1f2430; line-height: 1; }
.stat-label{ font-size: 14px; font-weight: 700; color: #1f2430; margin-top: 4px; }
.stat-sub  { font-size: 12px; color: #aeb2bb; margin-top: 2px; }

/* ── 섹션 카드 ── */
.section-card { padding: 22px 24px; }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
.section-title { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; color: #1f2430; margin-bottom: 4px; }
.section-desc  { font-size: 12.5px; color: #aeb2bb; }
.count-badge { flex-shrink: 0; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 99px; color: #64748b; font-size: 13px; font-weight: 700; padding: 4px 12px; }

/* ── 티켓 목록 ── */
.ticket-list { display: flex; flex-direction: column; gap: 10px; }
.ticket-row { border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: background 0.15s; }
.ticket-row:hover { background: #f8fafc; }
.ticket-row--done { background: #fafafa; }
.ticket-row--done:hover { background: #f1f5f9; }
.ticket-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; flex-wrap: wrap; }
.expiry-tag { display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:600; padding:2px 7px; border-radius:99px; }
.expiry-ok      { background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.expiry-warning { background:#fffbeb; color:#b45309; border:1px solid #fde68a; }
.expiry-urgent  { background:#fff1f2; color:#be123c; border:1px solid #fecdd3; }
.expiry-expired { background:#f1f5f9; color:#94a3b8; border:1px solid #e2e8f0; }
.ticket-time { font-size: 12px; color: #aeb2bb; }
.ticket-title { font-size: 14px; font-weight: 600; color: #1f2430; margin-bottom: 4px; }
.ticket-body { font-size: 13px; color: #6b7280; line-height: 1.5; overflow: hidden; max-height: 3em; }
.badge { display: inline-flex; align-items: center; gap: 4px; }

/* ── 페이지네이션 ── */
.pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
.pager-btn { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; border: 1.5px solid var(--line); background: none; cursor: pointer; color: #1f2430; transition: all 0.15s; }
.pager-btn:hover:not(:disabled) { background: #f1f5f9; border-color: #2b7fff; color: #2b7fff; }
.pager-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.pager-info { font-size: 13px; font-weight: 600; color: #6b7280; min-width: 50px; text-align: center; }

/* ── 모달 ── */
@keyframes modal-slide-in {
  from { transform: translateY(24px) scale(0.98); opacity: 0; }
  to   { transform: translateY(0)    scale(1);    opacity: 1; }
}
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9000; }
.modal-box { background: #fff; border-radius: 16px; width: 600px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px); display: flex; flex-direction: column; animation: modal-slide-in 0.22s ease-out; }
.modal-header { padding: 24px 28px 0; }
.modal-title { font-size: 16px; font-weight: 700; color: #1f2430; }
.modal-desc  { font-size: 13px; color: #aeb2bb; margin-top: 4px; }
.modal-body  { padding: 20px 28px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.modal-footer{ padding: 16px 28px 24px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--line); }

/* ── 티켓 미리보기 ── */
.ticket-preview { background: #f8fafc; border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
.answer-preview { background: #f0fdf4; border-color: #bbf7d0; }

/* ── 상세 섹션 ── */
.detail-section { display: flex; flex-direction: column; gap: 8px; }
.detail-label { font-size: 13px; font-weight: 700; color: #1f2430; }
.detail-who { font-weight: 400; color: #7c3aed; }
.detail-files-label { font-size: 12px; font-weight: 600; color: #6b7280; margin-top: 4px; }

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
.file-item--link { text-decoration: none; cursor: pointer; }
.file-item--link:hover { background: #eff6ff; border-color: #bfdbfe; }
.file-item--link:hover .file-name { color: #2b7fff; }

/* ── 에러 ── */
.error-msg { font-size: 13px; color: #ef4444; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; }

/* ── 버튼 ── */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
.btn-primary { background: #2b7fff; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #1d6ef8; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost   { background: none; color: #6b7280; border: 1.5px solid var(--line); }
.btn-ghost:hover { background: #f8fafc; }
.btn-outline { background: none; color: #1f2430; border: 1.5px solid var(--line); }
.btn-outline:hover { background: #f8fafc; }
</style>
