<script setup lang="ts">
// 워키 질문 상세 페이지.
// 삭제는 SYSTEM_ADMIN 전용(작성자 -100P 차감), 수정은 작성자 본인 + 답변 없을 때만 허용한다.
// 수정은 페이지 이동 없이 카드 내에서 입력 필드로 전환하는 인라인 편집 방식으로 구현한다.
// 삭제 전 BaseModal 공통 모달로 확인 단계를 거친다.
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, CheckCircle2, MessageCircle, ThumbsUp, Trash2, Pencil } from '@lucide/vue'
import {
  getQuestionDetail, createAnswer, acceptAnswer,
  likeQuestion, unlikeQuestion, deleteQuestionAsAdmin, updateQuestion,
} from '@/api/workiApi'
import { useAuthStore } from '@/stores/authStore'
import { ROLES } from '@/constants/roles'
import BaseModal from '@/components/common/BaseModal.vue'
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

// ANSWERED 상태만 "해결됨" 배지로 표시한다. TICKETED/DELETED 등은 미해결과 동일하게 처리.
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

// 삭제 권한: SYSTEM_ADMIN 전용 (답변 유무 무관, 작성자 -100P 차감 API 호출)
const isSystemAdmin = computed(() => auth.role === ROLES.SYSTEM_ADMIN)
const canDelete = computed(() => isSystemAdmin.value)

// 수정 권한: 질문 작성자 본인 + 아직 답변이 없을 때만 허용
const canEdit = computed(
  () => !!question.value && question.value.authorId === auth.userId && answers.value.length === 0,
)

// 삭제 확인 모달 상태
const showDeleteModal = ref(false)
const deleting = ref(false)

function openDeleteModal() {
  showDeleteModal.value = true
}

// 관리자 삭제: BE에서 작성자 -100P 자동 차감
async function confirmDelete() {
  if (deleting.value) return
  showDeleteModal.value = false
  deleting.value = true
  try {
    await deleteQuestionAsAdmin(questionId)
    router.push('/worki')
  } catch {
    error.value = '질문 삭제에 실패했습니다.'
    deleting.value = false
  }
}

// 인라인 수정 — 수정 버튼 클릭 시 제목·본문을 편집 가능한 입력 필드로 전환한다.
// 저장 성공 시 로컬 상태를 즉시 갱신해 재조회 없이 UI를 업데이트한다.
const editing = ref(false)
const editTitle = ref('')
const editBody = ref('')
const editError = ref('')
const saving = ref(false)

function startEdit() {
  editTitle.value = question.value!.title
  editBody.value = question.value!.content
  editError.value = ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  editError.value = ''
}

async function saveEdit() {
  editError.value = ''
  if (!editTitle.value.trim()) { editError.value = '제목을 입력해 주세요.'; return }
  if (!editBody.value.trim()) { editError.value = '내용을 입력해 주세요.'; return }
  if (saving.value) return
  saving.value = true
  try {
    await updateQuestion(questionId, { title: editTitle.value.trim(), content: editBody.value.trim() })
    question.value!.title = editTitle.value.trim()
    question.value!.content = editBody.value.trim()
    editing.value = false
  } catch {
    editError.value = '질문 수정에 실패했습니다.'
  } finally {
    saving.value = false
  }
}

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

// 질문 상세와 답변 목록을 한 번의 API 호출로 가져온다.
// 답변 채택 후에도 재호출해 채택 상태와 acceptedAnswerId를 최신화한다.
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

// 앱 내부에서 진입했으면 뒤로가기(스크롤·필터 복원), 직접 URL 진입이면 목록으로 안전 이동.
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push('/worki')
}

async function submitAnswer() {
  const content = newAnswer.value.trim()
  if (!content || submitting.value) return
  submitting.value = true
  try {
    const res = await createAnswer(questionId, { content })
    answers.value.push(res.data)
    newAnswer.value = ''
    error.value = '' // 이전 오류 후 재시도 성공 시 메시지 잔류 방지
  } catch {
    error.value = '답변 등록에 실패했습니다.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="content-inner">
    <button class="btn" style="margin-bottom: 20px;" @click="goBack">
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
        <!-- 수정 모드: 제목·본문을 입력 필드로 전환 -->
        <template v-if="editing">
          <input v-model="editTitle" class="edit-title-input" placeholder="질문 제목" />
          <textarea v-model="editBody" class="edit-body-input" rows="6" placeholder="질문 내용" />
          <div v-if="editError" class="edit-err">{{ editError }}</div>
          <div class="q-footer">
            <button class="btn" @click="cancelEdit">취소</button>
            <button class="btn primary" :disabled="saving" @click="saveEdit">
              {{ saving ? '저장 중...' : '수정 완료' }}
            </button>
          </div>
        </template>

        <!-- 읽기 모드 -->
        <template v-else>
          <h2 class="q-title">{{ question.title }}</h2>
          <p class="q-body">{{ question.content }}</p>
          <div class="q-footer">
            <button
              v-if="canDelete"
              class="delete-btn"
              :disabled="deleting"
              @click="openDeleteModal"
            >
              <Trash2 :size="15" /> {{ deleting ? '삭제 중...' : '삭제' }}
            </button>
            <button v-if="canEdit" class="edit-btn" @click="startEdit">
              <Pencil :size="15" /> 수정
            </button>
            <button class="like-btn" :class="{ liked }" :disabled="likePending" @click="toggleLike">
              <ThumbsUp :size="15" /> 좋아요 {{ likeCount }}
            </button>
          </div>
        </template>
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

      <!-- 채택 완료/티켓 전환/삭제 상태면 답변 작성창을 숨긴다 -->
      <div
        v-if="question.acceptedAnswerId == null && question.status !== 'TICKETED' && question.status !== 'DELETED'"
        class="card ans-write"
      >
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

    <!-- 삭제 확인 모달 -->
    <BaseModal
      v-model="showDeleteModal"
      title="질문 삭제"
      :message="'이 질문을 삭제하시겠습니까?\n작성자에게 100포인트가 차감됩니다.'"
      confirm-label="삭제"
      :danger="true"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.q-card { padding: 28px 32px; margin-bottom: 28px; }
.q-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.q-title { font-size: 22px; font-weight: 800; color: #1f2430; margin: 0 0 12px; }
.q-body { font-size: 15.5px; color: #404055; line-height: 1.7; margin: 0; white-space: pre-wrap; }
.q-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.delete-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #e7000b;
  background: #fff;
  border: 1px solid #ffc9c9;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s;
}
.delete-btn:hover:not(:disabled) { background: #fff0f0; border-color: #e7000b; }
.delete-btn:disabled { opacity: 0.6; cursor: default; }
.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #2b7fff;
  background: #fff;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s;
}
.edit-btn:hover { background: #eff6ff; border-color: #2b7fff; }
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

/* ── 인라인 수정 ── */
.edit-title-input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 20px;
  font-weight: 800;
  color: #1f2430;
  outline: none;
  font-family: inherit;
  background: #fff;
  box-sizing: border-box;
  margin-bottom: 12px;
  transition: border-color 0.15s;
}
.edit-title-input:focus { border-color: #7c3aed; }
.edit-body-input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 15px;
  color: #404055;
  line-height: 1.7;
  outline: none;
  font-family: inherit;
  background: #fff;
  box-sizing: border-box;
  resize: vertical;
  transition: border-color 0.15s;
}
.edit-body-input:focus { border-color: #7c3aed; }
.edit-err { font-size: 13px; color: #ef4444; font-weight: 500; margin-top: 6px; }

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
