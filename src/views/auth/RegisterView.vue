<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { sendSignupCode, verifySignupCode, signup } from '@/api/authApi'
import { getDepartments, type Department } from '@/api/adminApi'

const router = useRouter()

// 부서 목록
const departments = ref<Department[]>([])
onMounted(async () => {
  try {
    const res = await getDepartments()
    departments.value = res.data.data
  } catch {
    // 부서 목록 로드 실패 시 빈 목록 유지
  }
})

// 폼 상태
const employeeId = ref('')
const departmentId = ref<number | ''>('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const serverError = ref('')

// 이메일 인증 상태
const verificationCode = ref('')
const codeSent = ref(false)
const codeVerified = ref(false)
const isSendingCode = ref(false)
const isVerifyingCode = ref(false)
const codeError = ref('')

const errors = ref({
  employeeId: '',
  departmentId: '',
  email: '',
  password: '',
  confirmPassword: '',
})

// 이메일 인증코드 발송
async function handleSendCode() {
  if (!email.value.trim()) {
    errors.value.email = '이메일을 입력해주세요.'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    errors.value.email = '올바른 이메일 형식이 아닙니다.'
    return
  }
  errors.value.email = ''
  codeError.value = ''
  isSendingCode.value = true
  try {
    await sendSignupCode(email.value)
    codeSent.value = true
  } catch (err: any) {
    errors.value.email = err.response?.data?.message ?? '인증코드 발송에 실패했습니다.'
  } finally {
    isSendingCode.value = false
  }
}

// 인증코드 확인
async function handleVerifyCode() {
  if (!verificationCode.value.trim()) {
    codeError.value = '인증코드를 입력해주세요.'
    return
  }
  codeError.value = ''
  isVerifyingCode.value = true
  try {
    await verifySignupCode(email.value, verificationCode.value)
    codeVerified.value = true
  } catch (err: any) {
    codeError.value = err.response?.data?.message ?? '인증코드가 올바르지 않습니다.'
  } finally {
    isVerifyingCode.value = false
  }
}

function validate(): boolean {
  errors.value = { employeeId: '', departmentId: '', email: '', password: '', confirmPassword: '' }
  let valid = true

  if (!employeeId.value.trim()) {
    errors.value.employeeId = '사번을 입력해주세요.'
    valid = false
  }
  if (departmentId.value === '') {
    errors.value.departmentId = '부서를 선택해주세요.'
    valid = false
  }
  if (!email.value.trim()) {
    errors.value.email = '이메일을 입력해주세요.'
    valid = false
  }
  if (!codeVerified.value) {
    errors.value.email = errors.value.email || '이메일 인증을 완료해주세요.'
    valid = false
  }
  if (!password.value) {
    errors.value.password = '비밀번호를 입력해주세요.'
    valid = false
  } else if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password.value)) {
    errors.value.password = '영문+숫자 조합 8자 이상이어야 합니다.'
    valid = false
  }
  if (!confirmPassword.value) {
    errors.value.confirmPassword = '비밀번호 확인을 입력해주세요.'
    valid = false
  } else if (password.value !== confirmPassword.value) {
    errors.value.confirmPassword = '비밀번호가 일치하지 않습니다.'
    valid = false
  }

  return valid
}

async function handleSignup() {
  if (!validate()) return
  isLoading.value = true
  serverError.value = ''
  try {
    await signup({
      employeeId: employeeId.value,
      departmentId: Number(departmentId.value),
      email: email.value,
      password: password.value,
    })
    router.push('/login')
  } catch (err: any) {
    serverError.value = err.response?.data?.message ?? '회원가입에 실패했습니다.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="register-page">
    <!-- Blob 배경 -->
    <div class="blobs">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>

    <!-- 회원가입 카드 -->
    <div class="register-card">
      <!-- 로고 -->
      <div class="card-header">
        <svg width="56" height="64" viewBox="0 0 56 64" xmlns="http://www.w3.org/2000/svg" class="card-logo">
          <polygon points="28,2 54,17 28,31 2,17" fill="#bab4ab"/>
          <polygon points="2,17 28,31 28,62 2,48" fill="#9e9890"/>
          <polygon points="4,21 25,31 25,55 4,45" fill="white"/>
          <polygon points="28,31 54,17 54,48 28,62" fill="#88817a"/>
        </svg>
        <h1 class="card-title">Workipedia</h1>
        <p class="card-subtitle">회원가입</p>
      </div>

      <!-- 폼 -->
      <form class="register-form" @submit.prevent="handleSignup">
        <!-- 사번 -->
        <div class="field">
          <label class="field-label" for="employeeId">사번</label>
          <input
            id="employeeId"
            v-model="employeeId"
            type="text"
            placeholder="사번을 입력하세요"
            class="field-input"
            :class="{ 'field-input--error': errors.employeeId }"
            autocomplete="username"
          />
          <p v-if="errors.employeeId" class="field-error">{{ errors.employeeId }}</p>
        </div>

        <!-- 부서 드롭다운 -->
        <div class="field">
          <label class="field-label" for="departmentId">부서</label>
          <select
            id="departmentId"
            v-model="departmentId"
            class="field-input field-select"
            :class="{ 'field-input--error': errors.departmentId }"
          >
            <option value="" disabled>부서를 선택하세요</option>
            <option v-for="dept in departments" :key="dept.departmentId" :value="dept.departmentId">
              {{ dept.name }}
            </option>
          </select>
          <p v-if="errors.departmentId" class="field-error">{{ errors.departmentId }}</p>
        </div>

        <!-- 이메일 + 인증 발송 -->
        <div class="field">
          <label class="field-label" for="email">이메일</label>
          <div class="inline-row">
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="example@company.com"
              class="field-input"
              :class="{ 'field-input--error': errors.email }"
              :disabled="codeVerified"
              autocomplete="email"
            />
            <button
              type="button"
              class="inline-btn"
              :class="{ 'inline-btn--done': codeVerified }"
              :disabled="codeVerified || isSendingCode"
              @click="handleSendCode"
            >
              <span v-if="isSendingCode" class="spinner spinner--sm"></span>
              <span>{{ codeVerified ? '인증완료' : (codeSent ? '재발송' : '인증발송') }}</span>
            </button>
          </div>
          <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
        </div>

        <!-- 인증코드 입력 (코드 발송 후 ~ 인증 완료 전) -->
        <div v-if="codeSent && !codeVerified" class="field">
          <label class="field-label" for="verificationCode">인증코드</label>
          <div class="inline-row">
            <input
              id="verificationCode"
              v-model="verificationCode"
              type="text"
              placeholder="6자리 인증코드 입력"
              class="field-input"
              :class="{ 'field-input--error': codeError }"
              maxlength="6"
            />
            <button
              type="button"
              class="inline-btn"
              :disabled="isVerifyingCode"
              @click="handleVerifyCode"
            >
              <span v-if="isVerifyingCode" class="spinner spinner--sm"></span>
              <span>인증확인</span>
            </button>
          </div>
          <p v-if="codeError" class="field-error">{{ codeError }}</p>
        </div>

        <!-- 비밀번호 -->
        <div class="field">
          <label class="field-label" for="password">비밀번호</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="영문+숫자 조합 8자 이상"
            class="field-input"
            :class="{ 'field-input--error': errors.password }"
            autocomplete="new-password"
          />
          <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
        </div>

        <!-- 비밀번호 확인 -->
        <div class="field">
          <label class="field-label" for="confirmPassword">비밀번호 확인</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            class="field-input"
            :class="{ 'field-input--error': errors.confirmPassword }"
            autocomplete="new-password"
          />
          <p v-if="errors.confirmPassword" class="field-error">{{ errors.confirmPassword }}</p>
        </div>

        <p v-if="serverError" class="server-error">{{ serverError }}</p>

        <button type="submit" class="signup-btn" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span>{{ isLoading ? '처리 중...' : '회원가입' }}</span>
        </button>
      </form>

      <!-- 하단 링크 -->
      <div class="card-footer">
        <p class="footer-text">
          이미 계정이 있으신가요?
          <router-link to="/login" class="footer-link">로그인</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
  padding: 3rem 1rem;
}

/* Blob 배경 */
.blobs {
  position: absolute;
  inset: 0;
  opacity: 0.3;
  pointer-events: none;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  animation: blob 7s infinite;
}

.blob-1 {
  width: 380px;
  height: 380px;
  top: -60px;
  left: -60px;
  background: #3b82f6;
  animation-delay: 0s;
}

.blob-2 {
  width: 380px;
  height: 380px;
  top: -60px;
  right: -60px;
  background: #334155;
  animation-delay: 2s;
}

.blob-3 {
  width: 380px;
  height: 380px;
  bottom: -80px;
  left: 80px;
  background: #1e3a5f;
  animation-delay: 4s;
}

@keyframes blob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%       { transform: translate(30px, -50px) scale(1.1); }
  66%       { transform: translate(-20px, 20px) scale(0.9); }
}

/* 카드 */
.register-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 440px;
  padding: 2.5rem;
  background: #f5f5f4;
  border: 1px solid #d6d3d1;
  border-radius: 1.5rem;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
}

.card-header {
  text-align: center;
  margin-bottom: 2rem;
}

.card-logo {
  margin: 0 auto 1rem;
  display: block;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
}

.card-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1c1917;
  margin-bottom: 0.25rem;
}

.card-subtitle {
  font-size: 1rem;
  color: #57534e;
}

/* 폼 */
.register-form {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #44403c;
}

.field-input {
  height: 2.5rem;
  padding: 0 0.875rem;
  border-radius: 0.75rem;
  border: 1px solid #d6d3d1;
  background: #fff;
  color: #1c1917;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.field-input::placeholder {
  color: #a8a29e;
}

.field-input:focus {
  border-color: #1c1917;
  box-shadow: 0 0 0 3px rgba(28, 25, 23, 0.08);
}

.field-input:disabled {
  background: #f5f5f4;
  color: #78716c;
  cursor: not-allowed;
}

.field-input--error {
  border-color: #ef4444;
}

.field-input--error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.field-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a8a29e' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.875rem center;
  padding-right: 2.25rem;
  cursor: pointer;
}

.field-error {
  font-size: 0.78rem;
  color: #ef4444;
}

/* 인라인 행 (이메일 + 버튼) */
.inline-row {
  display: flex;
  gap: 0.5rem;
}

.inline-row .field-input {
  flex: 1;
}

.inline-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  height: 2.5rem;
  padding: 0 1rem;
  border-radius: 0.75rem;
  border: 1px solid #1c1917;
  background: #f5f5f4;
  color: #1c1917;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.inline-btn:hover:not(:disabled) {
  background: #1c1917;
  color: #fff;
}

.inline-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.inline-btn--done {
  border-color: #10b981;
  color: #10b981;
  background: #f0fdf4;
}

.inline-btn--done:disabled {
  opacity: 1;
}

.server-error {
  font-size: 0.85rem;
  color: #ef4444;
  text-align: center;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  padding: 0.6rem 0.875rem;
}

.signup-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  border: 1px solid #1c1917;
  background: #f5f5f4;
  color: #1c1917;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  margin-top: 0.5rem;
}

.signup-btn:hover:not(:disabled) {
  background: #1c1917;
  color: #fff;
}

.signup-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

.spinner--sm {
  width: 11px;
  height: 11px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 하단 */
.card-footer {
  margin-top: 1.5rem;
  text-align: center;
}

.footer-text {
  font-size: 0.9rem;
  color: #57534e;
}

.footer-link {
  color: #1c1917;
  font-weight: 600;
  text-decoration: underline;
  margin-left: 0.25rem;
  transition: color 0.15s;
}

.footer-link:hover {
  color: #44403c;
}
</style>
