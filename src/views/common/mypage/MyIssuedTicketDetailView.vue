<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, Building2 } from '@lucide/vue'
import { getMyTicketDetail } from '@/api/mypageApi'
import type { MyTicketDetailResponse } from '@/types/mypage'

const router = useRouter()
const route = useRoute()

const ticket = ref<MyTicketDetailResponse | null>(null)
const loading = ref(false)
const error = ref('')

// KnowIt 발행 티켓의 content에 삽입된 발신자 마커가 마이페이지 상세에서 그대로 노출되는 문제를 방지한다.
const SENDER_RE = /\n##SENDER:(.+)##$/
function ticketBody(content: string) { return content.replace(SENDER_RE, '').trim() }

function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(async () => {
  const id = Number(route.params.id)
  if (!Number.isFinite(id)) { error.value = '잘못된 접근입니다.'; return }
  loading.value = true
  try {
    const res = await getMyTicketDetail(id)
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

    <button class="btn" style="margin-bottom: 20px;" @click="router.push('/my/tickets')">
      <ChevronLeft :size="16" /> 내 발행 티켓으로
    </button>

    <div v-if="loading" class="empty-ph" style="height: 240px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height: 240px;">{{ error }}</div>

    <template v-else-if="ticket">
      <div class="card detail-card">

        <!-- Badges row -->
        <div class="badges-row">
          <span class="badge" :class="ticket.status === 'COMPLETED' ? 'solid-blue' : 'solid-orange'">
            {{ ticket.status === 'COMPLETED' ? '처리 완료' : '처리 전' }}
          </span>
          <span v-if="ticket.assignedDepartmentName" class="badge gray" style="display:inline-flex; align-items:center; gap:4px;">
            <Building2 :size="12" /> {{ ticket.assignedDepartmentName }}
          </span>
        </div>

        <!-- Title -->
        <h2 class="detail-title">{{ ticket.title }}</h2>

        <!-- Content -->
        <div class="detail-section">
          <div class="section-label">질문 내용</div>
          <p class="detail-content">{{ ticketBody(ticket.content) }}</p>
        </div>

        <!-- Answer -->
        <div v-if="ticket.answer" class="answer-section">
          <div class="answer-head">
            <div class="section-label">답변</div>
            <span v-if="ticket.answer.authorNickname" class="answer-who">{{ ticket.answer.authorNickname }}</span>
          </div>
          <p class="detail-content answer-content">{{ ticket.answer.content }}</p>
          <div class="answer-date">{{ formatDateTime(ticket.answer.answeredAt) }}</div>
        </div>

        <!-- Meta -->
        <div class="detail-meta">
          발행일시: {{ formatDateTime(ticket.createdAt) }}
          <template v-if="ticket.completedAt">
            · 처리 완료: {{ formatDateTime(ticket.completedAt) }}
          </template>
        </div>
      </div>
    </template>

  </div>
</template>

<style scoped>
.detail-card { padding: 28px 32px; display: flex; flex-direction: column; gap: 20px; }

.badges-row { display: flex; flex-wrap: wrap; gap: 8px; }

.detail-title { font-size: 22px; font-weight: 800; color: #1f2430; margin: 0; }

.detail-section { display: flex; flex-direction: column; gap: 8px; }
.section-label { font-size: 12.5px; font-weight: 600; color: #aeb2bb; text-transform: uppercase; letter-spacing: 0.05em; }
.detail-content { font-size: 15px; line-height: 1.7; color: #1f2430; white-space: pre-line; margin: 0; }

.answer-section {
  display: flex; flex-direction: column; gap: 10px;
  background: #f0fdf4; border: 1px solid #bbf7d0;
  border-radius: 12px; padding: 18px 20px;
}
.answer-head { display: flex; align-items: center; justify-content: space-between; }
.answer-who { font-size: 13px; font-weight: 600; color: #00a63e; }
.answer-content { color: #1f2430; }
.answer-date { font-size: 12px; color: #aeb2bb; }

.detail-meta { font-size: 12px; color: #aeb2bb; border-top: 1px solid var(--line); padding-top: 16px; }
</style>
