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
