import type { Role } from '@/constants/roles'

export interface LoginRequest {
  employeeId: string
  password: string
}

export interface LoginData {
  accessToken: string
  userId: number
  departmentId: number
  role: Role
  nickname: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface SignupRequest {
  employeeId: string
  departmentId: number
  email: string
  password: string
}

export interface SignupData {
  userId: number
  role: Role
  nickname: string
  status: 'ACTIVE' | 'INACTIVE'
}
