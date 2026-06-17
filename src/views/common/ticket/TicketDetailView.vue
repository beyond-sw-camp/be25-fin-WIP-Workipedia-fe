<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, Info } from '@lucide/vue'
import { getTicketDetail } from '@/api/ticketApi'
import { TICKET_STATUS_META } from '@/constants/ticketStatus'
import type { TicketResponse } from '@/types/ticket'

const router = useRouter()
const route = useRoute()

const ticket = ref<TicketResponse | null>(null)
const loading = ref(false)
const error = ref('')

function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(async () => {
  const id = Number(route.params.id)
  // route.params.id가 없거나 비정수 문자열인 경우 Number()는 NaN/Infinity를 반환한다.
  // Number.isFinite로 유효한 정수 ID인지 확인해 잘못된 URL 진입을 차단한다.
  if (!Number.isFinite(id)) {
    error.value = '잘못된 접근입니다.'
    return
  }
  loading.value = true
  try {
    const res = await getTicketDetail(id)
    ticket.value = res.data
  } catch {
    error.value = '티켓을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="content-inner">
    <button class="btn" style="margin-bottom: 20px;" @click="router.back()">
      <ChevronLeft :size="16" /> 목록으로
    </button>

    <div v-if="loading" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height: 240px;">{{ error }}</div>

    <template v-else-if="ticket">
      <div class="card ticket-card">
        <div class="ticket-header">
          <div class="header-badges">
            <span
              class="badge"
              :class="TICKET_STATUS_META[ticket.status].badgeClass"
              :style="TICKET_STATUS_META[ticket.status].badgeClass ? {} : { background: TICKET_STATUS_META[ticket.status].color + '22', color: TICKET_STATUS_META[ticket.status].color }"
            >
              {{ TICKET_STATUS_META[ticket.status].label }}
            </span>
            <span v-if="ticket.priority === 'HIGH'" class="badge" style="background: #fee2e2; color: #ef4444;">긴급</span>
          </div>
          <div class="ticket-status-bar" :style="{ background: TICKET_STATUS_META[ticket.status].color }"></div>
        </div>

        <h2 class="ticket-title">{{ ticket.title }}</h2>

        <div class="ticket-meta-grid">
          <div class="meta-item"><span>담당 부서</span><strong>{{ ticket.assignedDepartmentName ?? '미배정' }}</strong></div>
          <div class="meta-item"><span>담당자</span><strong>{{ ticket.assigneeId ? `#${ticket.assigneeId}` : '미지정' }}</strong></div>
          <div class="meta-item"><span>등록일</span><strong>{{ formatDateTime(ticket.createdAt) }}</strong></div>
          <div class="meta-item"><span>최근 업데이트</span><strong>{{ formatDateTime(ticket.updatedAt) }}</strong></div>
        </div>

        <hr class="divider" />

        <p class="ticket-body">{{ ticket.content }}</p>
      </div>

      <!-- 라우팅 근거: BE가 자동 배정 시 제공 -->
      <div v-if="ticket.routingReasons?.length || ticket.candidateDepartments?.length" class="card routing-card">
        <h3 class="routing-head"><Info :size="16" color="#2b7fff" /> 자동 배정 정보</h3>
        <div v-if="ticket.routingConfidenceScore != null" class="routing-score">
          신뢰도 {{ ticket.routingConfidenceScore }}점
        </div>
        <ul v-if="ticket.routingReasons?.length" class="routing-reasons">
          <li v-for="(r, i) in ticket.routingReasons" :key="i">{{ r }}</li>
        </ul>
        <div v-if="ticket.candidateDepartments?.length" class="candidates">
          <div class="candidates-label">후보 부서</div>
          <div
            v-for="c in ticket.candidateDepartments"
            :key="c.departmentId"
            class="candidate-row"
          >
            <span>{{ c.departmentName }}</span>
            <span class="candidate-score">{{ c.confidenceScore }}점</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ticket-card { padding: 28px 32px; margin-bottom: 20px; }
.ticket-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.header-badges { display: flex; gap: 8px; }
.ticket-status-bar { height: 6px; width: 120px; border-radius: 99px; }
.ticket-title { font-size: 22px; font-weight: 800; color: #1f2430; margin: 0 0 20px; }
.ticket-meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.meta-item { display: flex; flex-direction: column; gap: 4px; }
.meta-item span { font-size: 12px; color: #aeb2bb; }
.meta-item strong { font-size: 14px; color: #1f2430; }
.divider { border: none; border-top: 1px solid var(--line); margin: 0 0 20px; }
.ticket-body { font-size: 15px; color: #404055; line-height: 1.75; margin: 0; white-space: pre-wrap; }

.routing-card { padding: 22px 26px; }
.routing-head { display: flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 700; color: #1f2430; margin: 0 0 12px; }
.routing-score { font-size: 13px; color: #2b7fff; font-weight: 600; margin-bottom: 10px; }
.routing-reasons { margin: 0 0 12px; padding-left: 18px; }
.routing-reasons li { font-size: 14px; color: #404055; line-height: 1.7; }
.candidates { border-top: 1px solid var(--line); padding-top: 12px; }
.candidates-label { font-size: 12.5px; color: #aeb2bb; margin-bottom: 8px; }
.candidate-row { display: flex; justify-content: space-between; font-size: 14px; color: #1f2430; padding: 4px 0; }
.candidate-score { color: #717182; }
</style>
