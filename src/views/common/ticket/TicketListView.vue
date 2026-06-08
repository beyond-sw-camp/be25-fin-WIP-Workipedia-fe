<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Ticket, Search, Plus, Clock, Loader, CheckCircle2, XCircle } from '@lucide/vue'

const router = useRouter()
const query = ref('')
const statusFilter = ref<'전체' | '접수중' | '처리중' | '완료' | '반려'>('전체')

type TicketStatus = '접수중' | '처리중' | '완료' | '반려'

interface TicketItem {
  id: number
  title: string
  category: string
  status: TicketStatus
  handler: string
  created: string
  updated: string
}

const tickets = ref<TicketItem[]>([
  { id: 101, title: '노트북 화면 출력 불가', category: 'IT장비', status: '처리중', handler: 'IT지원팀', created: '2025.05.20', updated: '2025.05.21' },
  { id: 102, title: '법인카드 한도 초과 승인 요청', category: '재무', status: '완료', handler: '재무팀', created: '2025.05.10', updated: '2025.05.12' },
  { id: 103, title: '사무용품 신청 (볼펜, 노트)', category: '총무', status: '완료', handler: '총무팀', created: '2025.05.08', updated: '2025.05.09' },
  { id: 104, title: 'VPN 접속 오류 해결 요청', category: 'IT', status: '접수중', handler: 'IT지원팀', created: '2025.05.22', updated: '2025.05.22' },
  { id: 105, title: '회의실 에어컨 고장 신고', category: '시설', status: '반려', handler: '시설팀', created: '2025.04.30', updated: '2025.05.02' },
])

const statusIcon = {
  '접수중': Clock,
  '처리중': Loader,
  '완료': CheckCircle2,
  '반려': XCircle,
}

const statusColor: Record<TicketStatus, string> = {
  '접수중': '#aeb2bb',
  '처리중': '#2b7fff',
  '완료': '#00a63e',
  '반려': '#ef4444',
}

const statusBadgeClass: Record<TicketStatus, string> = {
  '접수중': 'gray',
  '처리중': 'blue',
  '완료': 'green',
  '반려': '',
}

const filtered = computed(() => {
  let list = tickets.value
  if (statusFilter.value !== '전체') list = list.filter(t => t.status === statusFilter.value)
  if (query.value.trim()) list = list.filter(t => t.title.includes(query.value.trim()))
  return list
})

const counts = computed(() => {
  const c: Record<string, number> = { 전체: tickets.value.length }
  for (const t of tickets.value) c[t.status] = (c[t.status] ?? 0) + 1
  return c
})
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
      <button
        v-for="s in (['전체', '접수중', '처리중', '완료', '반려'] as const)"
        :key="s"
        class="chip"
        :class="{ 'chip--on': statusFilter === s }"
        @click="statusFilter = s"
      >
        {{ s }}
        <span class="count-badge">{{ counts[s] ?? 0 }}</span>
      </button>
    </div>

    <div class="search-bar" style="max-width: 400px; margin-bottom: 20px;">
      <Search :size="16" />
      <input v-model="query" placeholder="티켓 검색" />
    </div>

    <div v-if="filtered.length === 0" class="empty-ph" style="height: 240px;">
      티켓이 없습니다
    </div>

    <div v-else class="ticket-list">
      <div
        v-for="t in filtered"
        :key="t.id"
        class="card ticket-row"
        @click="router.push(`/tickets/${t.id}`)"
      >
        <div class="ticket-status-bar" :style="{ background: statusColor[t.status] }"></div>
        <div class="ticket-body">
          <div class="ticket-top">
            <span
              class="badge"
              :class="statusBadgeClass[t.status]"
              :style="statusBadgeClass[t.status] ? {} : { background: '#fee2e2', color: '#ef4444' }"
            >
              <component :is="statusIcon[t.status]" :size="11" />
              {{ t.status }}
            </span>
            <span class="badge gray">{{ t.category }}</span>
            <span style="font-size: 12.5px; color: #aeb2bb; margin-left: auto;">등록 {{ t.created }}</span>
          </div>
          <h3 class="ticket-title">{{ t.title }}</h3>
          <div class="ticket-meta">
            <span>담당: {{ t.handler }}</span>
            <span>최근 업데이트: {{ t.updated }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.chip--on { background: #2b7fff; border-color: #2b7fff; color: #fff; }
.count-badge { background: rgba(0,0,0,0.1); border-radius: 99px; padding: 0 6px; font-size: 11px; font-weight: 700; }
.ticket-list { display: flex; flex-direction: column; gap: 12px; }
.ticket-row { display: flex; align-items: stretch; cursor: pointer; padding: 0; overflow: hidden; transition: box-shadow 0.15s; }
.ticket-row:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
.ticket-status-bar { width: 5px; flex-shrink: 0; }
.ticket-body { flex: 1; padding: 18px 22px; }
.ticket-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.ticket-title { font-size: 16px; font-weight: 700; color: #1f2430; margin: 0 0 8px; }
.ticket-meta { display: flex; gap: 16px; font-size: 12.5px; color: #aeb2bb; }
</style>
