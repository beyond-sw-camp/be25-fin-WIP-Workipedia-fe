<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, Ticket } from '@lucide/vue'
import { getDepartments } from '@/api/adminApi'
import type { Department } from '@/api/adminApi'
import http from '@/api/index'

const router = useRouter()

const departments = ref<Department[]>([])
const title = ref('')
const category = ref('')
const targetDeptId = ref<number | null>(null)
const body = ref('')
const submitting = ref(false)
const error = ref('')

const categories = ['IT장비', 'IT시스템', 'HR', '재무', '시설', '총무', '기타']

onMounted(async () => {
  try {
    const res = await getDepartments()
    departments.value = res.data.data
  } catch {
    // 부서 목록 로드 실패해도 진행
  }
})

async function submit() {
  error.value = ''
  if (!title.value.trim() || !category.value || !targetDeptId.value) {
    error.value = '제목, 카테고리, 담당 부서를 모두 입력해 주세요.'
    return
  }
  submitting.value = true
  try {
    await http.post('/tickets', {
      title: title.value,
      category: category.value,
      departmentId: targetDeptId.value,
      content: body.value,
    })
    router.push('/tickets')
  } catch {
    error.value = '티켓 등록에 실패했습니다. 다시 시도해 주세요.'
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
        <Ticket :size="28" color="#ff6900" />
        티켓 등록
      </h1>
      <p class="page-sub">담당 부서에 업무 요청을 남겨요</p>
    </div>

    <div class="card form-card">
      <div class="field">
        <label>제목 <span class="req">*</span></label>
        <input v-model="title" class="text-input" placeholder="요청 내용을 간략히 적어 주세요" />
      </div>

      <div class="field-row">
        <div class="field">
          <label>카테고리 <span class="req">*</span></label>
          <select v-model="category" class="select-input">
            <option value="" disabled>카테고리 선택</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div class="field">
          <label>담당 부서 <span class="req">*</span></label>
          <select v-model="targetDeptId" class="select-input">
            <option :value="null" disabled>부서 선택</option>
            <option v-for="d in departments" :key="d.departmentId" :value="d.departmentId">{{ d.name }}</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label>상세 내용</label>
        <textarea
          v-model="body"
          class="textarea-input"
          rows="8"
          placeholder="증상, 발생 시점, 관련 파일 등을 자세히 설명해 주세요"
        />
      </div>

      <div v-if="error" class="err-msg">{{ error }}</div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
        <button class="btn" @click="router.back()">취소</button>
        <button class="btn primary" :disabled="submitting" @click="submit">
          {{ submitting ? '등록 중...' : '티켓 등록' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-card { padding: 32px 36px; display: flex; flex-direction: column; gap: 20px; }
.field { display: flex; flex-direction: column; gap: 7px; }
.field label { font-size: 13.5px; font-weight: 600; color: #4b5563; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.req { color: #ef4444; }
.text-input, .select-input, .textarea-input {
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
.text-input:focus, .select-input:focus, .textarea-input:focus { border-color: #2b7fff; }
.textarea-input { resize: vertical; }
.err-msg { font-size: 13px; color: #ef4444; font-weight: 500; }
</style>
