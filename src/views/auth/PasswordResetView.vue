<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, KeyRound, Lock, ChevronLeft, CheckCircle2 } from '@lucide/vue'
import http from '@/api/index'

const router = useRouter()

const step = ref<1 | 2 | 3>(1)
const done = ref(false)

const email = ref('')
const code = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const emailError = ref('')
const codeError = ref('')
const pwError = ref('')
const loading = ref(false)

const pwValid = computed(() =>
  /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(newPassword.value)
)
const pwMatch = computed(() => newPassword.value === confirmPassword.value)

async function sendCode() {
  emailError.value = ''
  if (!email.value.trim()) { emailError.value = '이메일을 입력해 주세요.'; return }
  loading.value = true
  try {
    await http.post('/auth/password/reset/code', { email: email.value })
    step.value = 2
  } catch {
    emailError.value = '등록되지 않은 이메일이거나 오류가 발생했습니다.'
  } finally {
    loading.value = false
  }
}

async function verifyCode() {
  codeError.value = ''
  if (code.value.length !== 6) { codeError.value = '6자리 인증코드를 입력해 주세요.'; return }
  loading.value = true
  try {
    await http.post('/auth/password/reset/code/verify', { email: email.value, code: code.value })
    step.value = 3
  } catch {
    codeError.value = '인증코드가 올바르지 않습니다.'
  } finally {
    loading.value = false
  }
}

async function resetPassword() {
  pwError.value = ''
  if (!pwValid.value) { pwError.value = '비밀번호는 영문+숫자 8자 이상이어야 합니다.'; return }
  if (!pwMatch.value) { pwError.value = '비밀번호가 일치하지 않습니다.'; return }
  loading.value = true
  try {
    await http.post('/auth/password/reset', {
      email: email.value,
      code: code.value,
      newPassword: newPassword.value,
    })
    done.value = true
    setTimeout(() => router.push('/login'), 2500)
  } catch {
    pwError.value = '비밀번호 재설정에 실패했습니다. 다시 시도해 주세요.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="reset-page">
    <div class="reset-card">
      <button class="back-btn" @click="router.push('/login')">
        <ChevronLeft :size="16" /> 로그인으로
      </button>

      <!-- 완료 상태 -->
      <div v-if="done" class="done-state">
        <CheckCircle2 :size="52" color="#00a63e" />
        <h3>비밀번호가 재설정되었습니다</h3>
        <p>잠시 후 로그인 페이지로 이동합니다.</p>
      </div>

      <template v-else>
        <h1 class="reset-title">비밀번호 재설정</h1>

        <!-- 스텝 인디케이터 -->
        <div class="step-indicator">
          <div v-for="n in [1, 2, 3]" :key="n" class="step-dot" :class="{ active: step >= n, current: step === n }">
            {{ n }}
          </div>
          <div class="step-line step-line-1" :class="{ filled: step >= 2 }"></div>
          <div class="step-line step-line-2" :class="{ filled: step >= 3 }"></div>
        </div>

        <!-- Step 1: 이메일 입력 -->
        <div v-if="step === 1" class="step-body">
          <p class="step-desc">가입 시 등록한 이메일 주소를 입력하면 인증코드를 보내드려요.</p>
          <div class="field">
            <label>이메일</label>
            <div class="input-wrap" :class="{ error: emailError }">
              <Mail :size="16" color="#aeb2bb" />
              <input v-model="email" type="email" placeholder="example@company.com" @keydown.enter="sendCode" />
            </div>
            <span v-if="emailError" class="err-msg">{{ emailError }}</span>
          </div>
          <button class="submit-btn" :disabled="loading || !email.trim()" @click="sendCode">
            {{ loading ? '전송 중...' : '인증코드 전송' }}
          </button>
        </div>

        <!-- Step 2: 인증코드 확인 -->
        <div v-else-if="step === 2" class="step-body">
          <p class="step-desc"><strong>{{ email }}</strong>로 전송된 6자리 코드를 입력해 주세요.</p>
          <div class="field">
            <label>인증코드</label>
            <div class="input-wrap" :class="{ error: codeError }">
              <KeyRound :size="16" color="#aeb2bb" />
              <input v-model="code" placeholder="000000" maxlength="6" @keydown.enter="verifyCode" />
            </div>
            <span v-if="codeError" class="err-msg">{{ codeError }}</span>
          </div>
          <button class="submit-btn" :disabled="loading || code.length !== 6" @click="verifyCode">
            {{ loading ? '확인 중...' : '코드 확인' }}
          </button>
          <button class="resend-btn" @click="step = 1">이메일 다시 입력</button>
        </div>

        <!-- Step 3: 새 비밀번호 -->
        <div v-else class="step-body">
          <p class="step-desc">새로운 비밀번호를 설정해 주세요.</p>
          <div class="field">
            <label>새 비밀번호</label>
            <div class="input-wrap">
              <Lock :size="16" color="#aeb2bb" />
              <input v-model="newPassword" type="password" placeholder="영문+숫자 8자 이상" />
            </div>
            <span v-if="newPassword && !pwValid" class="hint-msg">영문+숫자 8자 이상으로 설정해 주세요.</span>
          </div>
          <div class="field">
            <label>비밀번호 확인</label>
            <div class="input-wrap" :class="{ error: confirmPassword && !pwMatch }">
              <Lock :size="16" color="#aeb2bb" />
              <input v-model="confirmPassword" type="password" placeholder="비밀번호 재입력" @keydown.enter="resetPassword" />
            </div>
            <span v-if="confirmPassword && !pwMatch" class="err-msg">비밀번호가 일치하지 않습니다.</span>
          </div>
          <span v-if="pwError" class="err-msg" style="margin-top: -4px;">{{ pwError }}</span>
          <button class="submit-btn" :disabled="loading || !pwValid || !pwMatch" @click="resetPassword">
            {{ loading ? '처리 중...' : '비밀번호 재설정' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.reset-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f6f8;
}
.reset-card {
  width: 100%;
  max-width: 440px;
  background: #fff;
  border-radius: 20px;
  padding: 40px 40px 48px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.10);
}
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #717182;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 24px;
  padding: 0;
}
.reset-title { font-size: 22px; font-weight: 800; color: #1f2430; margin: 0 0 24px; }

.step-indicator {
  display: grid;
  grid-template-columns: 28px 1fr 28px 1fr 28px;
  align-items: center;
  margin-bottom: 28px;
}
.step-dot {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: #eceef2;
  color: #aeb2bb;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
}
.step-dot.active { background: #2b7fff; color: #fff; }
.step-dot.current { box-shadow: 0 0 0 4px #dbeafe; }
.step-line { height: 2px; background: #eceef2; transition: background 0.2s; }
.step-line.filled { background: #2b7fff; }

.step-body { display: flex; flex-direction: column; gap: 16px; }
.step-desc { font-size: 14px; color: #717182; line-height: 1.6; margin: 0; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 13px; font-weight: 600; color: #4b5563; }
.input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #eceef2;
  border-radius: 10px;
  padding: 12px 14px;
  background: #f9fafb;
  transition: border-color 0.15s;
}
.input-wrap:focus-within { border-color: #2b7fff; background: #fff; }
.input-wrap.error { border-color: #ef4444; }
.input-wrap input { flex: 1; border: none; background: none; outline: none; font-size: 15px; color: #1f2430; }
.err-msg { font-size: 12.5px; color: #ef4444; font-weight: 500; }
.hint-msg { font-size: 12.5px; color: #f5a500; font-weight: 500; }

.submit-btn {
  width: 100%;
  padding: 14px;
  background: #2b7fff;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
  margin-top: 4px;
}
.submit-btn:hover:not(:disabled) { background: #1a6ef5; }
.submit-btn:disabled { background: #d1d5db; cursor: not-allowed; }

.resend-btn {
  background: none;
  border: none;
  color: #717182;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
}

.done-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 32px 0 20px;
  text-align: center;
}
.done-state h3 { font-size: 18px; font-weight: 700; color: #1f2430; margin: 0; }
.done-state p { font-size: 14px; color: #aeb2bb; margin: 0; }
</style>
