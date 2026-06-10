<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Ticket, Search, Plus } from '@lucide/vue'
import { getTickets } from '@/api/ticketApi'
import { TICKET_STATUS_META, TICKET_FILTER_STATUSES } from '@/constants/ticketStatus'
import type { TicketResponse, TicketStatus } from '@/types/ticket'

const router = useRouter()
const query = ref('')
// null = 전체
const statusFilter = ref<TicketStatus | null>(null)

const PAGE_SIZE = 20
const tickets = ref<TicketResponse[]>([])
const page = ref(1) // BasePageRequest 기반(1-based)
const hasNext = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// BE 티켓 목록엔 keyword 검색이 없어 불러온 항목에 대해 클라이언트 필터.
const filtered = computed(() => {
  const q = query.value.trim()
  if (!q) return tickets.value
  return tickets.value.filter((t) => t.title.includes(q))
})

async function fetchPage(pageNum: number, append: boolean) {
  if (append) loadingMore.value = true
  else loading.value = true
  error.value = ''
  try {
    const res = await getTickets({
      page: pageNum,
      size: PAGE_SIZE,
      ...(statusFilter.value ? { status: statusFilter.value } : {}),
    })
    tickets.value = append ? [...tickets.value, ...res.data.content] : res.data.content
    hasNext.value = res.data.pageInfo.hasNext
    page.value = pageNum
  } catch {
    error.value = '티켓을 불러오지 못했습니다.'
  } finally {
    if (append) loadingMore.value = false
    else loading.value = false
  }
}

function loadMore() {
  if (loading.value || loadingMore.value || !hasNext.value) return
  fetchPage(page.value + 1, true)
}

// 상태 필터는 서버 측 필터(status 파라미터)라 변경 시 첫 페이지부터 다시 조회.
watch(statusFilter, () => fetchPage(1, false))

onMounted(() => fetchPage(1, false))
</script>

<template>
  <div class="content-inner">
    <div class="page-head">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h1 class="page-title">
            <Ticket :size="28" color="#ff6900" />
            내 티켓
          </h1>
          <p class="page-sub">담당 부서에 요청한 업무 현황</p>
        </div>
        <button class="btn primary" @click="router.push('/tickets/new')">
          <Plus :size="16" /> 티켓 등록
        </button>
      </div>
    </div>

    <div class="status-chips">
      <button class="chip" :class="{ 'chip--on': statusFilter === null }" @click="statusFilter = null">
        전체
      </button>
      <button
        v-for="s in TICKET_FILTER_STATUSES"
        :key="s"
        class="chip"
        :class="{ 'chip--on': statusFilter === s }"
        @click="statusFilter = s"
      >
        {{ TICKET_STATUS_META[s].label }}
      </button>
    </div>

    <div class="search-bar" style="max-width: 400px; margin-bottom: 20px;">
      <Search :size="16" />
      <input v-model="query" placeholder="티켓 제목 검색" />
    </div>

    <div v-if="loading && tickets.length === 0" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="error && tickets.length === 0" class="empty-ph" style="height: 240px;">{{ error }}</div>
    <div v-else-if="filtered.length === 0" class="empty-ph" style="height: 240px;">
      {{ query.trim() ? '검색 결과가 없습니다' : '티켓이 없습니다' }}
    </div>

    <div v-else class="ticket-list">
      <div
        v-for="t in filtered"
        :key="t.ticketId"
        class="card ticket-row"
        @click="router.push(`/tickets/${t.ticketId}`)"
      >
        <div class="ticket-status-bar" :style="{ background: TICKET_STATUS_META[t.status].color }"></div>
        <div class="ticket-body">
          <div class="ticket-top">
            <span
              class="badge"
              :class="TICKET_STATUS_META[t.status].badgeClass"
              :style="TICKET_STATUS_META[t.status].badgeClass ? {} : { background: TICKET_STATUS_META[t.status].color + '22', color: TICKET_STATUS_META[t.status].color }"
            >
              {{ TICKET_STATUS_META[t.status].label }}
            </span>
            <span v-if="t.priority === 'HIGH'" class="badge" style="background: #fee2e2; color: #ef4444;">긴급</span>
            <span style="font-size: 12.5px; color: #aeb2bb; margin-left: auto;">등록 {{ formatDate(t.createdAt) }}</span>
          </div>
          <h3 class="ticket-title">{{ t.title }}</h3>
          <div class="ticket-meta">
            <span>담당: {{ t.assignedDepartmentName ?? '미배정' }}</span>
            <span>최근 업데이트: {{ formatDate(t.updatedAt) }}</span>
          </div>
        </div>
      </div>

      <div v-if="hasNext && !query.trim()" class="load-more">
        <button class="btn" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? '불러오는 중...' : '더 보기' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.chip--on { background: #2b7fff; border-color: #2b7fff; color: #fff; }
.ticket-list { display: flex; flex-direction: column; gap: 12px; }
.ticket-row { display: flex; align-items: stretch; cursor: pointer; padding: 0; overflow: hidden; transition: box-shadow 0.15s; }
.ticket-row:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
.ticket-status-bar { width: 5px; flex-shrink: 0; }
.ticket-body { flex: 1; padding: 18px 22px; }
.ticket-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.ticket-title { font-size: 16px; font-weight: 700; color: #1f2430; margin: 0 0 8px; }
.ticket-meta { display: flex; gap: 16px; font-size: 12.5px; color: #aeb2bb; }
.load-more { text-align: center; padding: 8px; }
</style>
