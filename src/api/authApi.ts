import http from './index'
import type { LoginRequest, LoginData, SignupRequest, SignupData } from '@/types/auth'

interface ApiResponse<T> {
  code: number
  status: string
  message: string
  data: T
}

export function login(data: LoginRequest) {
  return http.post<ApiResponse<LoginData>>('/auth/login', data)
}

export function sendSignupCode(email: string) {
  return http.post<ApiResponse<null>>('/auth/signup/code', { email })
}

export function verifySignupCode(email: string, code: string) {
  return http.post<ApiResponse<null>>('/auth/signup/code/verify', { email, code })
}

export function signup(data: SignupRequest) {
  return http.post<ApiResponse<SignupData>>('/auth/signup', data)
}

export function sendPasswordResetCode(data: { employeeId: string; email: string }) {
  return http.post<ApiResponse<null>>('/auth/password-reset/code', data)
}

export function verifyPasswordResetCode(data: { email: string; code: string }) {
  return http.post<ApiResponse<null>>('/auth/password-reset/code/verify', data)
}

export function resetPassword(data: { email: string; code: string; newPassword: string }) {
  return http.patch<ApiResponse<null>>('/auth/password-reset', data)
}

export function logout() {
  return http.post<ApiResponse<null>>('/auth/logout')
}
