<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, CheckCircle2, ThumbsUp, MessageCircle } from '@lucide/vue'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const auth = useAuthStore()

interface Answer {
  id: number
  author: string
  team: string
  body: string
  time: string
  likes: number
  accepted: boolean
}

const question = ref({
  id: 1,
  title: '연차 신청은 며칠 전까지 해야 하나요?',
  body: '팀에 배정받은 지 얼마 안 됐는데, 연차 사용하려면 며칠 전까지 신청해야 하는지 궁금합니다. HR 시스템을 사용해야 하는 건가요?',
  team: '개발1팀',
  author: '신입사원A',
  time: '2025.05.15',
  tags: ['연차', 'HR', '신입'],
  solved: true,
})

const answers = ref<Answer[]>([
  {
    id: 1,
    author: '박이화',
    team: '인사팀',
    body: '연차 신청은 반드시 사용일 기준 3일 전(72시간)까지 완료하셔야 합니다. HR 시스템에서 신청하시면 담당자 승인 후 자동으로 등록됩니다. 긴급한 경우 팀장께 먼저 구두 승인을 받으신 후 시스템에 등록하시면 됩니다.',
    time: '2025.05.15',
    likes: 12,
    accepted: true,
  },
  {
    id: 2,
    author: '김동욱',
    team: '개발2팀',
    body: '저도 처음에 몰랐는데 3일 전이 맞아요. 저는 깜빡해서 팀장님께 말씀드리고 나중에 시스템에 올렸더니 괜찮더라고요.',
    time: '2025.05.16',
    likes: 5,
    accepted: false,
  },
])

const newAnswer = ref('')

function submitAnswer() {
  const body = newAnswer.value.trim()
  if (!body) return
  answers.value.push({
    id: answers.value.length + 1,
    author: auth.nickname ?? '나',
    team: auth.team ?? '',
    body,
    time: '방금',
    likes: 0,
    accepted: false,
  })
  newAnswer.value = ''
}
</script>

<template>
  <div class="content-inner" style="max-width: 860px;">
    <button class="btn" style="margin-bottom: 20px;" @click="router.back()">
      <ChevronLeft :size="16" /> 목록으로
    </button>

    <div class="card q-card">
      <div class="q-header">
        <span class="badge" :class="question.solved ? 'green' : 'gray'">
          <CheckCircle2 v-if="question.solved" :size="11" />
          {{ question.solved ? '해결됨' : '미해결' }}
        </span>
        <span class="badge gray">{{ question.team }}</span>
        <span style="color: #aeb2bb; font-size: 13px; margin-left: auto;">{{ question.time }} · {{ question.author }}</span>
      </div>
      <h2 class="q-title">{{ question.title }}</h2>
      <p class="q-body">{{ question.body }}</p>
      <div class="q-tags">
        <span v-for="t in question.tags" :key="t" class="chip" style="padding: 4px 12px; font-size: 13px;">{{ t }}</span>
      </div>
    </div>

    <h3 class="ans-head">답변 {{ answers.length }}개</h3>

    <div class="ans-list">
      <div v-for="a in answers" :key="a.id" class="card ans-item" :class="{ accepted: a.accepted }">
        <div class="ans-top">
          <div class="ans-author">
            <span class="chat-av" style="font-size: 13px; font-weight: 700;">{{ a.author.slice(0, 1) }}</span>
            <div>
              <div style="font-weight: 700; font-size: 14px;">{{ a.author }}</div>
              <div style="font-size: 12px; color: #aeb2bb;">{{ a.team }} · {{ a.time }}</div>
            </div>
          </div>
          <div v-if="a.accepted" class="accepted-badge">
            <CheckCircle2 :size="14" /> 채택된 답변
          </div>
        </div>
        <p class="ans-body">{{ a.body }}</p>
        <div class="ans-footer">
          <button class="btn" style="padding: 6px 14px; font-size: 13px;">
            <ThumbsUp :size="14" /> {{ a.likes }}
          </button>
        </div>
      </div>
    </div>

    <div class="card ans-write">
      <h4 style="margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #1f2430;">
        <MessageCircle :size="16" style="vertical-align: middle; margin-right: 6px;" />
        답변 작성
      </h4>
      <textarea
        v-model="newAnswer"
        class="ans-textarea"
        placeholder="도움이 될 만한 내용을 작성해 주세요"
        rows="5"
      />
      <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
        <button class="btn primary" :disabled="!newAnswer.trim()" @click="submitAnswer">답변 등록</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.q-card { padding: 28px 32px; margin-bottom: 28px; }
.q-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.q-title { font-size: 22px; font-weight: 800; color: #1f2430; margin: 0 0 12px; }
.q-body { font-size: 15.5px; color: #404055; line-height: 1.7; margin: 0 0 16px; }
.q-tags { display: flex; gap: 8px; flex-wrap: wrap; }

.ans-head { font-size: 17px; font-weight: 700; color: #1f2430; margin: 0 0 14px; }
.ans-list { display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px; }
.ans-item { padding: 22px 28px; }
.ans-item.accepted { border-color: #00a63e; background: #f0fdf4; }
.ans-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.ans-author { display: flex; align-items: center; gap: 10px; }
.accepted-badge { display: inline-flex; align-items: center; gap: 6px; color: #00a63e; font-size: 13px; font-weight: 700; }
.ans-body { font-size: 15px; color: #1f2430; line-height: 1.7; margin: 0 0 16px; }
.ans-footer { display: flex; gap: 8px; }

.ans-write { padding: 24px 28px; }
.ans-textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 15px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
}
.ans-textarea:focus { border-color: #2b7fff; }
</style>
