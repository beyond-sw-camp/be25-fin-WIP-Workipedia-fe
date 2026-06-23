<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { login } from '@/api/authApi'
import type { AxiosError } from 'axios'
import { User, Users, ShieldCheck } from '@lucide/vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const employeeId = ref('')
const password = ref('')
const serverError = ref('')
const isLoading = ref(false)
const errors = ref({ employeeId: '', password: '' })


function validate(): boolean {
  errors.value = { employeeId: '', password: '' }
  let valid = true
  if (!employeeId.value.trim()) {
    errors.value.employeeId = '사번을 입력해주세요.'
    valid = false
  }
  if (!password.value) {
    errors.value.password = '비밀번호를 입력해주세요.'
    valid = false
  } else if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password.value)) {
    errors.value.password = '영문+숫자 조합 8자 이상이어야 합니다.'
    valid = false
  }
  return valid
}

const QUICK_ACCOUNTS = [
  { label: '일반 사용자', role: 'USER',         employeeId: 'U1001', password: 'Test1234', icon: User },
  { label: '팀 관리자',   role: 'TEAM_ADMIN',   employeeId: 'TA001', password: 'Test1234', icon: Users },
  { label: '시스템 관리자', role: 'SYSTEM_ADMIN', employeeId: 'SA001', password: 'Test1234', icon: ShieldCheck },
] as const

// 폼 값을 채우고 바로 로그인 처리한다. validate()의 영문+숫자 8자 이상 조건을 Test1234가 통과한다.
async function quickLogin(empId: string, pwd: string) {
  employeeId.value = empId
  password.value = pwd
  await handleLogin()
}

async function handleLogin() {
  if (!validate()) return
  isLoading.value = true
  serverError.value = ''
  try {
    const res = await login({ employeeId: employeeId.value, password: password.value })
    const { accessToken, userId, departmentId, role, nickname, departmentName, status } = res.data

    if (status === 'INACTIVE') {
      serverError.value = '비활성화된 계정입니다. 관리자에게 문의해주세요.'
      return
    }

    auth.setAuth(accessToken, role, userId, nickname, departmentName, departmentId)

    const redirect = route.query.redirect as string | undefined
    router.push(redirect || '/knowit')
  } catch (e) {
    const err = e as AxiosError<{ message: string }>
    serverError.value = err.response?.data?.message ?? '사번 또는 비밀번호가 올바르지 않습니다.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <!-- Blob 배경 -->
    <div class="blobs">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>

    <!-- 로그인 카드 -->
    <div class="login-card">
      <!-- 로고 -->
      <div class="card-header">
        <svg width="56" height="64" viewBox="0 0 56 64" xmlns="http://www.w3.org/2000/svg" class="card-logo">
          <polygon points="28,2 54,17 28,31 2,17" fill="#bab4ab"/>
          <polygon points="2,17 28,31 28,62 2,48" fill="#9e9890"/>
          <polygon points="4,21 25,31 25,55 4,45" fill="white"/>
          <polygon points="28,31 54,17 54,48 28,62" fill="#88817a"/>
        </svg>
        <h1 class="card-title">Workipedia</h1>
        <p class="card-subtitle">로그인</p>
      </div>

      <!-- 폼 -->
      <form class="login-form" @submit.prevent="handleLogin">
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

        <div class="field">
          <label class="field-label" for="password">비밀번호</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="비밀번호를 입력하세요"
            class="field-input"
            :class="{ 'field-input--error': errors.password || serverError }"
            autocomplete="current-password"
          />
          <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
          <p v-else-if="serverError" class="field-error">{{ serverError }}</p>
        </div>

        <button type="submit" class="login-btn" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span>{{ isLoading ? '로그인 중...' : '로그인' }}</span>
        </button>
      </form>

      <!-- Quick Login -->
      <div class="quick-section">
        <div class="quick-label">Quick Login</div>
        <div class="quick-btns">
          <button
            v-for="acc in QUICK_ACCOUNTS"
            :key="acc.role"
            type="button"
            class="quick-btn"
            :disabled="isLoading"
            @click="quickLogin(acc.employeeId, acc.password)"
          >
            <component :is="acc.icon" :size="15" />
            {{ acc.label }}
          </button>
        </div>
      </div>

      <!-- 하단 링크 -->
      <div class="card-footer">
        <p class="footer-text">
          계정이 없으신가요?
          <router-link to="/register" class="footer-link footer-link--primary">회원가입</router-link>
        </p>
        <p>
          <router-link to="/reset-password" class="footer-link footer-link--secondary">
            비밀번호가 기억나지 않나요?
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
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
.login-card {
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
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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
}

.field-input::placeholder {
  color: #a8a29e;
}

.field-input:focus {
  border-color: #1c1917;
  box-shadow: 0 0 0 3px rgba(28, 25, 23, 0.08);
}

.field-input--error {
  border-color: #ef4444;
}

.field-input--error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.field-error {
  font-size: 0.78rem;
  color: #ef4444;
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

.login-btn {
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
  margin-top: 0.25rem;
}

.login-btn:hover:not(:disabled) {
  background: #1c1917;
  color: #fff;
}

.login-btn:disabled {
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
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 하단 */
.card-footer {
  margin-top: 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.footer-text {
  font-size: 0.9rem;
  color: #57534e;
}

.footer-link {
  text-decoration: underline;
  transition: color 0.15s;
}

.footer-link--primary {
  color: #1c1917;
  font-weight: 600;
  margin-left: 0.25rem;
}

.footer-link--primary:hover {
  color: #44403c;
}

.footer-link--secondary {
  font-size: 0.85rem;
  color: #78716c;
}

.footer-link--secondary:hover {
  color: #1c1917;
}

/* Quick Login */
.quick-section {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid #e7e5e4;
}

.quick-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #a8a29e;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
  text-align: center;
}

.quick-btns {
  display: flex;
  gap: 0.5rem;
}

.quick-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid #e7e5e4;
  background: #fff;
  color: #44403c;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.quick-btn:hover:not(:disabled) {
  background: #f5f5f4;
  border-color: #1c1917;
  color: #1c1917;
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
