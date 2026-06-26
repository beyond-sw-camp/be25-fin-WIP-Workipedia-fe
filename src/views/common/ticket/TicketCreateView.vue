<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, Paperclip, Ticket, X } from '@lucide/vue'
import { useDeptStore } from '@/stores/deptStore'
import { useAuthStore } from '@/stores/authStore'
import { createTicket, createTicketWithFiles } from '@/api/ticketApi'

const router = useRouter()
// deptStore는 App 진입 시 미리 로드되므로 여기서 추가 fetch 없이 바로 departments를 사용할 수 있다.
const deptStore = useDeptStore()
const authStore = useAuthStore()

const title = ref('')
const category = ref('')
const targetDeptId = ref<number | null>(null)
const body = ref('')
const imageFiles = ref<File[]>([])
// 중복 제출 방지 플래그 — API 응답 전에 버튼이 재클릭되는 경우를 막는다.
const submitting = ref(false)
const error = ref('')

// 카테고리는 현재 프론트엔드 하드코딩. 어드민 설정 API 연동 전까지 이 배열로 관리한다.
const categories = ['IT장비', 'IT시스템', 'HR', '재무', '시설', '총무', '기타']
const allowedImageTypes = ['image/jpeg', 'image/png']

function onImageChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  const invalid = files.find((file) => !allowedImageTypes.includes(file.type))
  if (invalid) {
    error.value = 'JPG, JPEG, PNG 이미지 파일만 첨부할 수 있습니다.'
    input.value = ''
    return
  }
  imageFiles.value = files
  error.value = ''
  input.value = ''
}

function removeImage(index: number) {
  imageFiles.value = imageFiles.value.filter((_, i) => i !== index)
}

function fileSizeLabel(size: number) {
  return `${(size / 1024).toFixed(1)}KB`
}

async function submit() {
  error.value = ''
  if (!title.value.trim() || !category.value || !targetDeptId.value) {
    error.value = '제목, 카테고리, 담당 부서를 모두 입력해 주세요.'
    return
  }
  submitting.value = true
  try {
    const senderParts = [authStore.team, authStore.nickname].filter(Boolean)
    const senderTag = senderParts.length ? `\n##SENDER:${senderParts.join('|')}##` : ''
    const payload = {
      title: title.value,
      content: body.value + senderTag,
    }
    if (imageFiles.value.length > 0) {
      await createTicketWithFiles(payload, imageFiles.value)
    } else {
      await createTicket(payload)
    }
    router.push('/tickets')
  } catch {
    error.value = '티켓 등록에 실패했습니다. 다시 시도해 주세요.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="content-inner">
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
            <option v-for="d in deptStore.departments" :key="d.departmentId" :value="d.departmentId">{{ d.departmentName }}</option>
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

      <div class="field">
        <label>사진 첨부</label>
        <input
          id="ticket-image-upload"
          type="file"
          class="hidden-input"
          accept="image/jpeg,image/png"
          multiple
          @change="onImageChange"
        />
        <label class="upload-box" for="ticket-image-upload">
          <Paperclip :size="16" />
          JPG, JPEG, PNG 이미지 선택
        </label>
        <div v-if="imageFiles.length" class="file-list">
          <div v-for="(file, index) in imageFiles" :key="`${file.name}-${index}`" class="file-item">
            <Paperclip :size="13" />
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">({{ fileSizeLabel(file.size) }})</span>
            <button class="file-remove" type="button" @click="removeImage(index)">
              <X :size="13" />
            </button>
          </div>
        </div>
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
.hidden-input { display: none; }
.upload-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  color: #4b5563;
  font-size: 14px;
  cursor: pointer;
  background: #f8fafc;
  transition: background 0.15s, border-color 0.15s;
}
.upload-box:hover { background: #eff6ff; border-color: #bfdbfe; }
.file-list { display: flex; flex-direction: column; gap: 6px; }
.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}
.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: #1f2430; }
.file-size { flex-shrink: 0; font-size: 12px; color: #aeb2bb; }
.file-remove { display: flex; align-items: center; border: 0; background: transparent; color: #aeb2bb; cursor: pointer; padding: 2px; }
.file-remove:hover { color: #ef4444; }
</style>
