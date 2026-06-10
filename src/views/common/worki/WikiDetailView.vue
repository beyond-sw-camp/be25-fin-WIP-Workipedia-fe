<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, CheckCircle2, MessageCircle, ThumbsUp } from '@lucide/vue'
import { getQuestionDetail, createAnswer, acceptAnswer, likeQuestion, unlikeQuestion } from '@/api/workiApi'
import { useAuthStore } from '@/stores/authStore'
import type { AxiosError } from 'axios'
import type { QuestionDetailResponse, AnswerResponse, QuestionStatus } from '@/types/worki'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const questionId = Number(route.params.id)

const question = ref<QuestionDetailResponse | null>(null)
const answers = ref<AnswerResponse[]>([])
const loading = ref(false)
const error = ref('')
const newAnswer = ref('')
const submitting = ref(false)
const accepting = ref(false)

// 좋아요. BE 상세 응답에 liked 필드가 없어, 사용자별로 "어떤 질문을 좋아요했는지"를
// localStorage에 저장해 뒤로가기/새로고침 후에도 상태를 복원한다.
// TODO: BE QuestionDetailResponse에 liked(+likeCount) 추가되면 응답값으로 대체.
const liked = ref(false)
const likeCount = ref(0)
const likePending = ref(false)
const LIKED_KEY = `worki:liked:${auth.userId ?? 'anon'}`

function readLikedSet(): Set<number> {
  try {
    const raw = localStorage.getItem(LIKED_KEY)
    return new Set<number>(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set<number>()
  }
}

function persistLiked(value: boolean) {
  const set = readLikedSet()
  if (value) set.add(questionId)
  else set.delete(questionId)
  localStorage.setItem(LIKED_KEY, JSON.stringify(Array.from(set)))
}

async function toggleLike() {
  if (likePending.value) return
  likePending.value = true
  const prev = liked.value
  liked.value = !prev // 낙관적 업데이트
  likeCount.value += prev ? -1 : 1 // 개수도 즉시 반영
  try {
    if (prev) await unlikeQuestion(questionId)
    else await likeQuestion(questionId)
    persistLiked(liked.value)
  } catch (e) {
    // 로컬 상태와 서버가 어긋난 경우 자기치유:
    //  - like 했는데 409(이미 좋아요) → 이미 눌린 상태이므로 방금 더한 +1만 취소
    //  - unlike 했는데 404(기록 없음) → 안 눌린 상태이므로 방금 뺀 -1만 취소
    const status = (e as AxiosError)?.response?.status
    if (!prev && status === 409) {
      liked.value = true
      likeCount.value -= 1
      persistLiked(true)
    } else if (prev && status === 404) {
      liked.value = false
      likeCount.value += 1
      persistLiked(false)
    } else {
      liked.value = prev // 그 외 오류는 원복
      likeCount.value += prev ? 1 : -1
      error.value = '좋아요 처리에 실패했습니다.'
    }
  } finally {
    likePending.value = false
  }
}

function isSolved(status: QuestionStatus) {
  return status === 'ANSWERED'
}

// 질문 작성자 본인이고, 아직 채택된 답변이 없을 때만 채택 가능
const canAccept = computed(
  () =>
    !!question.value &&
    question.value.authorId === auth.userId &&
    question.value.acceptedAnswerId == null,
)

async function accept(answerId: number) {
  if (accepting.value) return
  accepting.value = true
  try {
    await acceptAnswer(answerId)
    await load() // 채택 결과(상태/채택여부) 반영
  } catch {
    error.value = '답변 채택에 실패했습니다.'
  } finally {
    accepting.value = false
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 작성자 표시: "부서 · 닉네임". BE 응답의 닉네임/부서명을 그대로 쓴다(질문·답변 공통).
// 닉네임이 없으면(탈퇴 등 null) "작성자"로 표기.
function formatAuthor(nickname?: string | null, department?: string | null) {
  if (!nickname) return '작성자'
  return department ? `${department} · ${nickname}` : nickname
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await getQuestionDetail(questionId)
    question.value = res.data
    answers.value = res.data.answers
    likeCount.value = res.data.likeCount ?? 0 // 서버 집계 개수로 초기화
  } catch {
    error.value = '질문을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  liked.value = readLikedSet().has(questionId) // 뒤로가기/새로고침 후 좋아요 상태 복원
  load()
})

async function submitAnswer() {
  const content = newAnswer.value.trim()
  if (!content || submitting.value) return
  submitting.value = true
  try {
    const res = await createAnswer(questionId, { content })
    answers.value.push(res.data)
    newAnswer.value = ''
  } catch {
    error.value = '답변 등록에 실패했습니다.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="content-inner" style="max-width: 860px;">
    <button class="btn" style="margin-bottom: 20px;" @click="router.back()">
      <ChevronLeft :size="16" /> 목록으로
    </button>

    <div v-if="loading" class="empty-ph" style="height: 200px;">불러오는 중...</div>
    <div v-else-if="error" class="empty-ph" style="height: 200px;">{{ error }}</div>

    <template v-else-if="question">
      <div class="card q-card">
        <div class="q-header">
          <span class="badge" :class="isSolved(question.status) ? 'green' : 'gray'">
            <CheckCircle2 v-if="isSolved(question.status)" :size="11" />
            {{ isSolved(question.status) ? '해결됨' : '미해결' }}
          </span>
          <span style="color: #aeb2bb; font-size: 13px; margin-left: auto;">
            {{ formatDate(question.createdAt) }} · {{ formatAuthor(question.authorNickname, question.authorDepartmentName) }}
          </span>
        </div>
        <h2 class="q-title">{{ question.title }}</h2>
        <p class="q-body">{{ question.content }}</p>
        <div class="q-footer">
          <button class="like-btn" :class="{ liked }" :disabled="likePending" @click="toggleLike">
            <ThumbsUp :size="15" /> 좋아요 {{ likeCount }}
          </button>
        </div>
      </div>

      <h3 class="ans-head">답변 {{ answers.length }}개</h3>

      <div class="ans-list">
        <div v-for="a in answers" :key="a.answerId" class="card ans-item" :class="{ accepted: a.accepted }">
          <div class="ans-top">
            <div class="ans-author">
              <span class="chat-av" style="font-size: 13px; font-weight: 700;">{{ (a.authorNickname ?? '작성자').slice(0, 1) }}</span>
              <div>
                <div class="ans-author-name">
                  {{ a.authorNickname ?? '작성자' }}
                  <span v-if="a.authorDepartmentName" class="ans-author-dept">{{ a.authorDepartmentName }}</span>
                </div>
                <div style="font-size: 12px; color: #aeb2bb;">{{ formatDate(a.createdAt) }}</div>
              </div>
            </div>
            <div v-if="a.accepted" class="accepted-badge">
              <CheckCircle2 :size="14" /> 채택된 답변
            </div>
            <button
              v-else-if="canAccept"
              class="btn primary"
              style="padding: 6px 14px; font-size: 13px;"
              :disabled="accepting"
              @click="accept(a.answerId)"
            >
              <CheckCircle2 :size="14" /> 채택하기
            </button>
          </div>
          <p class="ans-body">{{ a.content }}</p>
        </div>
      </div>

      <!-- 채택된 답변이 있으면(해결 완료) 답변 작성창을 숨긴다 -->
      <div v-if="question.acceptedAnswerId == null" class="card ans-write">
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
          <button class="btn primary" :disabled="!newAnswer.trim() || submitting" @click="submitAnswer">
            {{ submitting ? '등록 중...' : '답변 등록' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.q-card { padding: 28px 32px; margin-bottom: 28px; }
.q-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.q-title { font-size: 22px; font-weight: 800; color: #1f2430; margin: 0 0 12px; }
.q-body { font-size: 15.5px; color: #404055; line-height: 1.7; margin: 0; white-space: pre-wrap; }
.q-footer { display: flex; justify-content: flex-end; margin-top: 18px; }
.like-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #57534e;
  background: #fff;
  border: 1px solid #d6d3d1;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s;
}
.like-btn:hover:not(:disabled) { border-color: #7c3aed; color: #7c3aed; }
.like-btn.liked { background: #f3f0ff; border-color: #7c3aed; color: #7c3aed; }
.like-btn:disabled { opacity: 0.6; cursor: default; }

.ans-head { font-size: 17px; font-weight: 700; color: #1f2430; margin: 0 0 14px; }
.ans-list { display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px; }
.ans-item { padding: 22px 28px; }
.ans-item.accepted { border-color: #00a63e; background: #f0fdf4; }
.ans-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.ans-author { display: flex; align-items: center; gap: 10px; }
.ans-author-name { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #1f2430; }
.ans-author-dept { font-weight: 500; font-size: 12px; color: #7c3aed; background: #f3f0ff; padding: 1px 9px; border-radius: 999px; }
.accepted-badge { display: inline-flex; align-items: center; gap: 6px; color: #00a63e; font-size: 13px; font-weight: 700; }
.ans-body { font-size: 15px; color: #1f2430; line-height: 1.7; margin: 0; white-space: pre-wrap; }

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
