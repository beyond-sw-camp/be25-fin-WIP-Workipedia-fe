<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, Building2, Paperclip } from '@lucide/vue'
import { getMyTicketDetail } from '@/api/mypageApi'
import { getLatestAnswer } from '@/api/ticketApi'
import type { MyTicketDetailResponse } from '@/types/mypage'
import type { AnswerFileInfo, TicketFileInfo } from '@/types/ticket'

const router = useRouter()
const route = useRoute()

const ticket = ref<MyTicketDetailResponse | null>(null)
const answerFiles = ref<AnswerFileInfo[]>([])
const loading = ref(false)
const error = ref('')

// KnowIt 발행 티켓의 content에 삽입된 발신자 마커가 마이페이지 상세에서 그대로 노출되는 문제를 방지한다.
const SENDER_RE = /\n##SENDER:(.+)##$/
function ticketBody(content: string) { return content.replace(SENDER_RE, '').trim() }

function ticketFiles(t: MyTicketDetailResponse | null): TicketFileInfo[] {
  if (!t) return []
  if (t.files?.length) return t.files.filter(f => !!f.fileUrl)
  return t.fileUrl ? [{ fileKey: '', fileUrl: t.fileUrl, fileName: '첨부 이미지', fileContentType: null, fileSize: null }] : []
}

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
    // 티켓 상세와 최신 답변을 병렬 조회한다.
    // getLatestAnswer는 TEAM_ADMIN 전용 엔드포인트일 수 있어 USER 권한으로 403이 날 수 있다.
    // Promise.allSettled로 한 쪽이 실패해도 나머지 결과를 처리한다.
    const [ticketRes, answerRes] = await Promise.allSettled([
      getMyTicketDetail(id),
      getLatestAnswer(id),
    ])
    if (ticketRes.status === 'fulfilled') {
      ticket.value = ticketRes.value.data
    } else {
      error.value = '티켓을 불러오지 못했습니다.'
    }
    if (answerRes.status === 'fulfilled') {
      // getLatestAnswer 성공: files[] 우선, 없으면 단일 fileUrl
      const a = answerRes.value.data
      if (a.files?.length) {
        answerFiles.value = a.files.filter(f => !!f.fileUrl)
      } else if (a.fileUrl) {
        answerFiles.value = [{ fileKey: a.fileKey ?? '', fileUrl: a.fileUrl, fileName: a.fileName, fileContentType: a.fileContentType, fileSize: a.fileSize }]
      }
    } else {
      // getLatestAnswer 실패(권한 없음 등) 시 GET /me/tickets/{id} 응답의
      // answer.fileUrl로 폴백한다. BE가 이 필드를 채우면 자동으로 표시된다.
      const fallback = ticket.value?.answer
      if (fallback?.fileUrl) {
        answerFiles.value = [{
          fileKey: '',
          fileUrl: fallback.fileUrl,
          fileName: fallback.fileName ?? null,
          fileContentType: null,
          fileSize: fallback.fileSize ?? null,
        }]
      }
    }
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
          <div v-if="ticketFiles(ticket).length" class="request-files">
            <a
              v-for="f in ticketFiles(ticket)"
              :key="f.fileKey || f.fileUrl || f.fileName || 'ticket-file'"
              :href="f.fileUrl ?? '#'"
              target="_blank"
              rel="noopener noreferrer"
              class="answer-file"
            >
              <Paperclip :size="13" />
              <span>{{ f.fileName ?? '첨부 이미지' }}</span>
              <span v-if="f.fileSize" class="answer-file-size">({{ (f.fileSize / 1024).toFixed(1) }}KB)</span>
            </a>
          </div>
        </div>

        <!-- Answer -->
        <div v-if="ticket.answer" class="answer-section">
          <div class="answer-head">
            <div class="section-label">답변</div>
            <span v-if="ticket.answer.authorNickname" class="answer-who">{{ ticket.answer.authorNickname }}</span>
          </div>
          <p class="detail-content answer-content">{{ ticket.answer.content }}</p>
          <div class="answer-date">{{ formatDateTime(ticket.answer.answeredAt) }}</div>
          <a v-for="f in answerFiles" :key="f.fileKey" :href="f.fileUrl ?? '#'" target="_blank" rel="noopener noreferrer" class="answer-file">
            <Paperclip :size="13" />
            <span>{{ f.fileName ?? '첨부 파일' }}</span>
            <span v-if="f.fileSize" class="answer-file-size">({{ (f.fileSize / 1024).toFixed(1) }}KB)</span>
          </a>
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
.request-files { display: flex; flex-direction: column; gap: 7px; margin-top: 8px; }

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

.answer-file {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; border: 1px solid #bbf7d0; border-radius: 8px;
  font-size: 13px; color: #00a63e; text-decoration: none;
  transition: background 0.12s;
}
.answer-file:hover { background: #f0fdf4; }
.answer-file-size { color: #aeb2bb; font-size: 12px; }
</style>
