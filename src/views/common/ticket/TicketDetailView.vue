<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, Clock, Loader, CheckCircle2, XCircle, MessageCircle } from '@lucide/vue'

const router = useRouter()
const route = useRoute()

type TicketStatus = '접수중' | '처리중' | '완료' | '반려'

interface Comment {
  id: number
  author: string
  team: string
  body: string
  time: string
  isHandler: boolean
}

const ticket = ref({
  id: Number(route.params.id),
  title: '노트북 화면 출력 불가',
  category: 'IT장비',
  status: '처리중' as TicketStatus,
  handler: 'IT지원팀',
  handlerName: '김동욱',
  created: '2025.05.20',
  updated: '2025.05.21',
  body: '회의실 노트북을 외부 모니터에 연결했더니 화면 출력이 되지 않습니다. HDMI 케이블은 정상이고, 다른 노트북에서는 모니터가 잘 됩니다. 재부팅해도 동일 증상입니다.',
})

const comments = ref<Comment[]>([
  {
    id: 1,
    author: '김동욱',
    team: 'IT지원팀',
    body: '안녕하세요, 담당자 김동욱입니다. 그래픽 드라이버 문제일 수 있습니다. 오전 중에 찾아뵙겠습니다.',
    time: '2025.05.21 09:30',
    isHandler: true,
  },
])

const newComment = ref('')

const statusIcon = { '접수중': Clock, '처리중': Loader, '완료': CheckCircle2, '반려': XCircle }
const statusColor: Record<TicketStatus, string> = {
  '접수중': '#aeb2bb', '처리중': '#2b7fff', '완료': '#00a63e', '반려': '#ef4444',
}
const statusBadge: Record<TicketStatus, string> = {
  '접수중': 'gray', '처리중': 'blue', '완료': 'green', '반려': '',
}

function submitComment() {
  const body = newComment.value.trim()
  if (!body) return
  comments.value.push({
    id: comments.value.length + 1,
    author: '나',
    team: '요청자',
    body,
    time: '방금',
    isHandler: false,
  })
  newComment.value = ''
}
</script>

<template>
  <div class="content-inner" style="max-width: 820px;">
    <button class="btn" style="margin-bottom: 20px;" @click="router.back()">
      <ChevronLeft :size="16" /> 목록으로
    </button>

    <div class="card ticket-card">
      <div class="ticket-header">
        <div class="header-badges">
          <span
            class="badge"
            :class="statusBadge[ticket.status]"
            :style="statusBadge[ticket.status] ? {} : { background: '#fee2e2', color: '#ef4444' }"
          >
            <component :is="statusIcon[ticket.status]" :size="11" />
            {{ ticket.status }}
          </span>
          <span class="badge gray">{{ ticket.category }}</span>
        </div>
        <div class="ticket-status-bar-wrap">
          <div class="ticket-status-bar" :style="{ background: statusColor[ticket.status] }"></div>
        </div>
      </div>

      <h2 class="ticket-title">{{ ticket.title }}</h2>

      <div class="ticket-meta-grid">
        <div class="meta-item"><span>담당 부서</span><strong>{{ ticket.handler }}</strong></div>
        <div class="meta-item"><span>담당자</span><strong>{{ ticket.handlerName }}</strong></div>
        <div class="meta-item"><span>등록일</span><strong>{{ ticket.created }}</strong></div>
        <div class="meta-item"><span>최근 업데이트</span><strong>{{ ticket.updated }}</strong></div>
      </div>

      <hr class="divider" />

      <p class="ticket-body">{{ ticket.body }}</p>
    </div>

    <h3 class="comment-head">
      <MessageCircle :size="17" style="vertical-align: middle; margin-right: 6px;" />
      댓글 {{ comments.length }}개
    </h3>

    <div class="comment-list">
      <div v-for="c in comments" :key="c.id" class="card comment-item" :class="{ 'comment-handler': c.isHandler }">
        <div class="comment-top">
          <span class="chat-av" style="font-size: 12px; font-weight: 700;">{{ c.author.slice(0, 1) }}</span>
          <div>
            <span class="comment-author">{{ c.author }}</span>
            <span v-if="c.isHandler" class="badge blue" style="font-size: 11px; padding: 2px 8px; margin-left: 6px;">담당자</span>
            <div class="comment-meta">{{ c.team }} · {{ c.time }}</div>
          </div>
        </div>
        <p class="comment-body">{{ c.body }}</p>
      </div>
    </div>

    <div class="card comment-write">
      <textarea
        v-model="newComment"
        class="comment-textarea"
        placeholder="댓글을 입력하세요"
        rows="4"
      />
      <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
        <button class="btn primary" :disabled="!newComment.trim()" @click="submitComment">등록</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ticket-card { padding: 28px 32px; margin-bottom: 24px; }
.ticket-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.header-badges { display: flex; gap: 8px; }
.ticket-status-bar-wrap { }
.ticket-status-bar { height: 6px; width: 120px; border-radius: 99px; }
.ticket-title { font-size: 22px; font-weight: 800; color: #1f2430; margin: 0 0 20px; }
.ticket-meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.meta-item { display: flex; flex-direction: column; gap: 4px; }
.meta-item span { font-size: 12px; color: #aeb2bb; }
.meta-item strong { font-size: 14px; color: #1f2430; }
.divider { border: none; border-top: 1px solid var(--line); margin: 0 0 20px; }
.ticket-body { font-size: 15px; color: #404055; line-height: 1.75; margin: 0; }

.comment-head { font-size: 16px; font-weight: 700; color: #1f2430; margin: 0 0 14px; }
.comment-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.comment-item { padding: 18px 22px; }
.comment-handler { background: #eff6ff; border-color: #2b7fff; }
.comment-top { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
.comment-author { font-size: 14px; font-weight: 700; color: #1f2430; }
.comment-meta { font-size: 12px; color: #aeb2bb; margin-top: 2px; }
.comment-body { font-size: 14.5px; color: #404055; line-height: 1.65; margin: 0; }

.comment-write { padding: 20px 24px; }
.comment-textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 15px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
}
.comment-textarea:focus { border-color: #2b7fff; }
</style>
