<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { CheckCircle } from '@lucide/vue'
import { sendPasswordResetCode, verifyPasswordResetCode, resetPassword } from '@/api/authApi'

const router = useRouter()

type Step = 'employee-id' | 'verify-email' | 'new-password' | 'done'
const step = ref<Step>('employee-id')

const employeeId = ref('')
const email = ref('')
const code = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const errors = ref<Record<string, string>>({})
const loading = ref(false)

const stepKeys: Step[] = ['employee-id', 'verify-email', 'new-password']
const currentStepIndex = computed(() => stepKeys.indexOf(step.value))

const pwValid = computed(() => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(newPassword.value))
const pwMatch = computed(() => newPassword.value === confirmPassword.value)

function clearError(key: string) {
  if (errors.value[key]) {
    const next = { ...errors.value }
    delete next[key]
    errors.value = next
  }
}

async function handleSendCode() {
  const errs: Record<string, string> = {}
  if (!employeeId.value.trim()) errs.employeeId = '사번을 입력해주세요.'
  if (!email.value.trim()) errs.email = '이메일을 입력해주세요.'
  if (Object.keys(errs).length > 0) { errors.value = errs; return }
  errors.value = {}
  loading.value = true
  try {
    await sendPasswordResetCode({ employeeId: employeeId.value, email: email.value })
    step.value = 'verify-email'
  } catch (e: any) {
    errors.value = { email: e.response?.data?.message ?? '등록되지 않은 정보이거나 오류가 발생했습니다.' }
  } finally {
    loading.value = false
  }
}

async function handleVerifyCode() {
  if (code.value.length !== 6) { errors.value = { code: '6자리 인증번호를 입력해주세요.' }; return }
  errors.value = {}
  loading.value = true
  try {
    await verifyPasswordResetCode({ email: email.value, code: code.value })
    step.value = 'new-password'
  } catch (e: any) {
    errors.value = { code: e.response?.data?.message ?? '인증번호가 올바르지 않습니다.' }
  } finally {
    loading.value = false
  }
}

async function handleResetPassword() {
  const errs: Record<string, string> = {}
  if (!pwValid.value) errs.newPassword = '비밀번호는 영문+숫자 8자 이상이어야 합니다.'
  if (!confirmPassword.value) errs.confirmPassword = '비밀번호 확인을 입력해주세요.'
  else if (!pwMatch.value) errs.confirmPassword = '비밀번호가 일치하지 않습니다.'
  if (Object.keys(errs).length > 0) { errors.value = errs; return }
  errors.value = {}
  loading.value = true
  try {
    await resetPassword({ email: email.value, code: code.value, newPassword: newPassword.value })
    step.value = 'done'
  } catch (e: any) {
    errors.value = { newPassword: e.response?.data?.message ?? '비밀번호 재설정에 실패했습니다. 다시 시도해 주세요.' }
  } finally {
    loading.value = false
  }
}

async function resendCode() {
  code.value = ''
  errors.value = {}
  loading.value = true
  try {
    await sendPasswordResetCode({ employeeId: employeeId.value, email: email.value })
  } catch (e: any) {
    errors.value = { code: e.response?.data?.message ?? '재발송에 실패했습니다.' }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="reset-page">
    <!-- Blob 배경 -->
    <div class="blobs">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>

    <div class="reset-card">
      <!-- 로고 & 헤더 -->
      <div class="card-header">
        <svg width="56" height="64" viewBox="0 0 56 64" xmlns="http://www.w3.org/2000/svg" class="card-logo">
          <polygon points="28,2 54,17 28,31 2,17" fill="#bab4ab"/>
          <polygon points="2,17 28,31 28,62 2,48" fill="#9e9890"/>
          <polygon points="4,21 25,31 25,55 4,45" fill="white"/>
          <polygon points="28,31 54,17 54,48 28,62" fill="#88817a"/>
        </svg>
        <h1 class="card-title">Workipedia</h1>
        <p class="card-subtitle">비밀번호 재설정</p>
      </div>

      <!-- 스텝 인디케이터 -->
      <div v-if="step !== 'done'" class="step-indicator">
        <template v-for="(s, i) in stepKeys" :key="s">
          <div
            class="step-dot"
            :class="{
              'step-dot--done': i < currentStepIndex,
              'step-dot--current': i === currentStepIndex,
            }"
          >{{ i + 1 }}</div>
          <div v-if="i < 2" class="step-line" :class="{ 'step-line--filled': i < currentStepIndex }"></div>
        </template>
      </div>

      <!-- Step 1: 사번 + 이메일 입력 -->
      <div v-if="step === 'employee-id'" class="step-body">
        <p class="step-desc">사번과 가입 시 등록한 이메일을 입력하면<br>인증번호를 발송해 드립니다.</p>

        <div class="field">
          <label class="field-label" for="employeeId">사번</label>
          <input
            id="employeeId"
            v-model="employeeId"
            type="text"
            placeholder="사번을 입력하세요"
            class="field-input"
            :class="{ 'field-input--error': errors.employeeId }"
            @input="clearError('employeeId')"
          />
          <p v-if="errors.employeeId" class="field-error">{{ errors.employeeId }}</p>
        </div>

        <div class="field">
          <label class="field-label" for="email">이메일</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="가입 시 등록한 이메일을 입력하세요"
            class="field-input"
            :class="{ 'field-input--error': errors.email }"
            @input="clearError('email')"
            @keydown.enter="handleSendCode"
          />
          <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
        </div>

        <button class="submit-btn" :disabled="loading" @click="handleSendCode">
          <span v-if="loading" class="spinner"></span>
          <span>{{ loading ? '전송 중...' : '인증번호 발송' }}</span>
        </button>
      </div>

      <!-- Step 2: 이메일 인증번호 입력 -->
      <div v-else-if="step === 'verify-email'" class="step-body">
        <p class="step-desc">
          <strong>{{ email }}</strong>로<br>
          인증번호를 발송했습니다. 확인 후 입력해주세요.
        </p>

        <div class="field">
          <label class="field-label" for="code">이메일 인증번호</label>
          <input
            id="code"
            v-model="code"
            type="text"
            placeholder="인증번호 6자리를 입력하세요"
            class="field-input field-input--center"
            :class="{ 'field-input--error': errors.code }"
            maxlength="6"
            @input="clearError('code')"
            @keydown.enter="handleVerifyCode"
          />
          <p v-if="errors.code" class="field-error">{{ errors.code }}</p>
        </div>

        <button class="submit-btn" :disabled="loading || code.length !== 6" @click="handleVerifyCode">
          <span v-if="loading" class="spinner"></span>
          <span>{{ loading ? '확인 중...' : '인증 확인' }}</span>
        </button>

        <div class="text-center">
          <button class="resend-btn" :disabled="loading" @click="resendCode">
            인증번호 재발송
          </button>
        </div>
      </div>

      <!-- Step 3: 새 비밀번호 입력 -->
      <div v-else-if="step === 'new-password'" class="step-body">
        <p class="step-desc">본인 확인이 완료되었습니다.<br>새 비밀번호를 설정해주세요.</p>

        <div class="field">
          <label class="field-label" for="newPassword">새 비밀번호</label>
          <input
            id="newPassword"
            v-model="newPassword"
            type="password"
            placeholder="새 비밀번호를 입력하세요 (영문+숫자 8자 이상)"
            class="field-input"
            :class="{ 'field-input--error': errors.newPassword }"
            @input="clearError('newPassword')"
          />
          <p v-if="newPassword && !pwValid" class="field-hint">영문+숫자 8자 이상으로 설정해 주세요.</p>
          <p v-if="errors.newPassword" class="field-error">{{ errors.newPassword }}</p>
        </div>

        <div class="field">
          <label class="field-label" for="confirmPassword">비밀번호 확인</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="새 비밀번호를 다시 입력하세요"
            class="field-input"
            :class="{ 'field-input--error': errors.confirmPassword || (confirmPassword && !pwMatch) }"
            @input="clearError('confirmPassword')"
            @keydown.enter="handleResetPassword"
          />
          <p v-if="confirmPassword && !pwMatch && !errors.confirmPassword" class="field-error">비밀번호가 일치하지 않습니다.</p>
          <p v-if="errors.confirmPassword" class="field-error">{{ errors.confirmPassword }}</p>
        </div>

        <button class="submit-btn" :disabled="loading || !pwValid || !pwMatch" @click="handleResetPassword">
          <span v-if="loading" class="spinner"></span>
          <span>{{ loading ? '처리 중...' : '비밀번호 재설정' }}</span>
        </button>
      </div>

      <!-- Done -->
      <div v-else class="done-state">
        <CheckCircle :size="64" class="done-icon" :stroke-width="1.5" />
        <div>
          <p class="done-title">비밀번호가 재설정되었습니다.</p>
          <p class="done-desc">새 비밀번호로 로그인해주세요.</p>
        </div>
        <button class="submit-btn" @click="router.push('/login')">로그인으로 이동</button>
      </div>

      <!-- 하단 링크 -->
      <div v-if="step !== 'done'" class="card-footer">
        <router-link to="/login" class="footer-link">로그인으로 돌아가기</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reset-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
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
.blob-1 { width: 380px; height: 380px; top: -60px; left: -60px; background: #3b82f6; animation-delay: 0s; }
.blob-2 { width: 380px; height: 380px; top: -60px; right: -60px; background: #334155; animation-delay: 2s; }
.blob-3 { width: 380px; height: 380px; bottom: -80px; left: 80px; background: #1e3a5f; animation-delay: 4s; }

@keyframes blob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%       { transform: translate(30px, -50px) scale(1.1); }
  66%       { transform: translate(-20px, 20px) scale(0.9); }
}

/* 카드 */
.reset-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 440px;
  margin: 1rem;
  padding: 2.5rem;
  background: #f5f5f4;
  border: 1px solid #d6d3d1;
  border-radius: 1.5rem;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
}

/* 헤더 */
.card-header {
  text-align: center;
  margin-bottom: 1.75rem;
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

/* 스텝 인디케이터 */
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1.75rem;
}
.step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #d6d3d1;
  background: #fff;
  color: #a8a29e;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s, color 0.3s, border-color 0.3s;
}
.step-dot--done { background: #a8a29e; color: #fff; border-color: #a8a29e; }
.step-dot--current { background: #1c1917; color: #fff; border-color: #1c1917; }
.step-line {
  width: 2rem;
  height: 1px;
  background: #d6d3d1;
  transition: background 0.3s;
}
.step-line--filled { background: #a8a29e; }

/* 스텝 바디 */
.step-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.step-desc {
  font-size: 0.875rem;
  color: #57534e;
  text-align: center;
  line-height: 1.6;
  margin: 0;
}

/* 폼 필드 */
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
}
.field-input::placeholder { color: #a8a29e; }
.field-input:focus { border-color: #1c1917; box-shadow: 0 0 0 3px rgba(28, 25, 23, 0.08); }
.field-input--error { border-color: #ef4444; }
.field-input--error:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1); }
.field-input--center { text-align: center; letter-spacing: 0.25em; font-size: 1.1rem; }
.field-error { font-size: 0.78rem; color: #ef4444; }
.field-hint { font-size: 0.78rem; color: #f59e0b; }

/* 버튼 */
.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  height: 2.5rem;
  border-radius: 0.75rem;
  border: 1px solid #1c1917;
  background: #f5f5f4;
  color: #1c1917;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.submit-btn:hover:not(:disabled) { background: #1c1917; color: #fff; }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.resend-btn {
  background: none;
  border: none;
  font-size: 0.875rem;
  color: #78716c;
  text-decoration: underline;
  cursor: pointer;
  transition: color 0.15s;
  padding: 0;
}
.resend-btn:hover:not(:disabled) { color: #1c1917; }
.resend-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.text-center { text-align: center; }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Done 상태 */
.done-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  text-align: center;
  padding: 0.5rem 0;
}
.done-icon { color: #57534e; }
.done-title { font-size: 1.1rem; font-weight: 600; color: #1c1917; margin: 0 0 0.25rem; }
.done-desc { font-size: 0.875rem; color: #57534e; margin: 0; }

/* 하단 */
.card-footer {
  margin-top: 1.5rem;
  text-align: center;
}
.footer-link {
  font-size: 0.875rem;
  color: #78716c;
  text-decoration: underline;
  transition: color 0.15s;
}
.footer-link:hover { color: #1c1917; }
</style>
