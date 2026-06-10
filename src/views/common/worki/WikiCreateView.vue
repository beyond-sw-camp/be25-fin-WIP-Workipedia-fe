<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, MessageCircle, Plus, X } from '@lucide/vue'
import { createQuestion } from '@/api/workiApi'

const router = useRouter()

const title = ref('')
const body = ref('')
const tagInput = ref('')
const tags = ref<string[]>([])
const submitting = ref(false)
const error = ref('')

function addTag() {
  const t = tagInput.value.trim()
  if (t && !tags.value.includes(t) && tags.value.length < 5) {
    tags.value.push(t)
  }
  tagInput.value = ''
}

function removeTag(t: string) {
  tags.value = tags.value.filter(tag => tag !== t)
}

async function submit() {
  error.value = ''
  if (!title.value.trim()) {
    error.value = '질문 제목을 입력해 주세요.'
    return
  }
  if (!body.value.trim()) {
    error.value = '질문 내용을 입력해 주세요.'
    return
  }
  submitting.value = true
  try {
    // BE QuestionCreateRequest 는 title, content 만 받는다. (tags 미지원)
    await createQuestion({
      title: title.value,
      content: body.value,
    })
    router.push('/worki')
  } catch {
    error.value = '질문 등록에 실패했습니다. 다시 시도해 주세요.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="content-inner" style="max-width: 760px;">
    <button class="btn" style="margin-bottom: 20px;" @click="router.back()">
      <ChevronLeft :size="16" /> 목록으로
    </button>

    <div class="page-head">
      <h1 class="page-title">
        <MessageCircle :size="28" color="#7c3aed" />
        질문 올리기
      </h1>
      <p class="page-sub">팀원들에게 질문해 보세요</p>
    </div>

    <div class="card form-card">
      <div class="field">
        <label>제목 <span class="req">*</span></label>
        <input v-model="title" class="text-input" placeholder="궁금한 점을 간략히 적어 주세요" />
      </div>

      <div class="field">
        <label>내용</label>
        <textarea
          v-model="body"
          class="textarea-input"
          rows="10"
          placeholder="상황, 이미 시도한 방법 등을 자세히 적으면 더 빠른 답변을 받을 수 있어요"
        />
      </div>

      <div class="field">
        <label>태그 (최대 5개)</label>
        <div class="tag-input-row">
          <div class="input-wrap">
            <input
              v-model="tagInput"
              placeholder="태그 입력 후 Enter"
              @keydown.enter.prevent="addTag"
            />
          </div>
          <button class="btn" @click="addTag"><Plus :size="15" /> 추가</button>
        </div>
        <div v-if="tags.length" class="tag-list">
          <span v-for="t in tags" :key="t" class="chip tag-chip">
            {{ t }}
            <button class="tag-remove" @click="removeTag(t)"><X :size="12" /></button>
          </span>
        </div>
      </div>

      <div v-if="error" class="err-msg">{{ error }}</div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
        <button class="btn" @click="router.back()">취소</button>
        <button class="btn primary" :disabled="submitting" @click="submit">
          {{ submitting ? '등록 중...' : '질문 등록' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-card { padding: 32px 36px; display: flex; flex-direction: column; gap: 20px; }
.field { display: flex; flex-direction: column; gap: 7px; }
.field label { font-size: 13.5px; font-weight: 600; color: #4b5563; }
.req { color: #ef4444; }
.text-input, .textarea-input {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 15px;
  color: #1f2430;
  outline: none;
  font-family: inherit;
  background: #fff;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}
.text-input:focus, .textarea-input:focus { border-color: #7c3aed; }
.textarea-input { resize: vertical; }

.tag-input-row { display: flex; gap: 8px; }
.input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 14px;
  background: #fff;
}
.input-wrap input { flex: 1; border: none; background: none; outline: none; font-size: 15px; }

.tag-list { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.tag-chip { display: inline-flex; align-items: center; gap: 6px; }
.tag-remove { background: none; border: none; cursor: pointer; color: #aeb2bb; padding: 0; display: flex; align-items: center; }

.err-msg { font-size: 13px; color: #ef4444; font-weight: 500; }
</style>
