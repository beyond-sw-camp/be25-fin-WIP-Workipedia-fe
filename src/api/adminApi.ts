import http from './index'
import type { ApiResponse } from './index'

// ── 공통 부서 목록 (non-admin views에서 사용) ──────────────────
export interface Department {
  departmentId: number
  departmentName: string
}
export function getDepartments() {
  return http.get<Department[]>('/departments')
}

// ── 대시보드 요약 ──────────────────────────────────────────────
export interface DashboardSummary {
  totalUserCount: number
  todayLoginCount: number
  totalDocumentCount: number
}
export function getDashboardSummary() {
  return http.get<DashboardSummary>('/admin/settings/summary')
}

// ── 사용자 관리 ────────────────────────────────────────────────
export interface AdminUser {
  userId: number
  employeeId: string
  nickname: string
  role: string
  status: 'ACTIVE' | 'INACTIVE'
  departmentId: number
  departmentName: string
  lastLoginAt: string
}
export interface AdminUserPage {
  content: AdminUser[]
  pageInfo: { page: number; size: number; totalElements: number; totalPages: number }
}
export function getAdminUsers() {
  return http.get<AdminUserPage>('/admin/users')
}
export function updateUserStatus(userId: number, status: 'ACTIVE' | 'INACTIVE') {
  return http.patch<ApiResponse<null>>(`/admin/users/${userId}/status`, { status })
}

// ── 매뉴얼 관리 ────────────────────────────────────────────────
export interface AdminManual {
  manualId: number
  title: string
  description?: string
  category?: string
  status: string
  version: string | null
  departmentId: number | null
  fileUrl?: string | null
  updatedAt: string
}
export interface AdminManualPage {
  content: AdminManual[]
  pageInfo: { page: number; size: number; totalElements: number; totalPages: number; hasNext: boolean; hasPrevious: boolean }
}
export function getAdminManuals() {
  return http.get<AdminManualPage>('/admin/manuals')
}
export function createAdminManual(formData: FormData) {
  return http.post<AdminManual>('/admin/manuals/pdf', formData)
}
export function updateAdminManual(manualId: number, formData: FormData) {
  return http.patch<ApiResponse<AdminManual>>(`/admin/manuals/${manualId}/pdf`, formData)
}
export function updateAdminManualMeta(manualId: number, body: { title?: string; version?: string; departmentId?: number | null }) {
  return http.patch<ApiResponse<AdminManual>>(`/admin/manuals/${manualId}`, body)
}
export function deleteAdminManual(manualId: number) {
  return http.delete<ApiResponse<null>>(`/admin/manuals/${manualId}`)
}

// ── 부서 관리 (추가/삭제/수정) ──────────────────────────────────
export interface AdminDepartment {
  departmentId: number
  departmentName: string
  routingPrompt: string | null
  memberCount: number
}
export function getAdminDepartments() {
  return http.get<AdminDepartment[]>('/admin/departments')
}
export function createAdminDepartment(body: { departmentName: string }) {
  return http.post<AdminDepartment>('/admin/departments', body)
}
export function updateAdminDepartment(departmentId: number, body: { departmentName: string; routingPrompt?: string }) {
  return http.patch<AdminDepartment>(`/admin/departments/${departmentId}`, body)
}
export function deleteAdminDepartment(departmentId: number) {
  return http.delete<ApiResponse<null>>(`/admin/departments/${departmentId}`)
}
// ── 포인트 관리 ────────────────────────────────────────────────
export interface AdminPointUser {
  userId: number
  employeeId: string
  nickname: string
  currentPoint: number
}
export interface AdminPointPage {
  content: AdminPointUser[]
  pageInfo: { page: number; size: number; totalElements: number; totalPages: number }
}
export function getAdminPoints() {
  return http.get<AdminPointPage>('/admin/points')
}
export function deductAdminPoints(employeeId: string, body: { amount: number; reason: string }) {
  return http.patch<ApiResponse<null>>(`/admin/points/${employeeId}/deduct`, body)
}

// ── 채팅 정책 ──────────────────────────────────────────────────
export interface ChatPolicy {
  messageTtlSeconds: number
  sendCooldownSeconds: number
  bannedWords: string[]
}
export function getChatPolicy() {
  return http.get<ChatPolicy>('/admin/flash-chat/policy')
}
export function updateChatPolicy(body: ChatPolicy) {
  return http.patch<ChatPolicy>('/admin/flash-chat/policy', body)
}
