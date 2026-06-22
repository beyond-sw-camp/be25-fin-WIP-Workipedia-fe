import http from './index'
import type { ApiResponse } from './index'
import type { TicketResponse } from '@/types/ticket'
import type { PageResponse, PageParams } from '@/types/common'

// ── 공통 부서 목록 (non-admin views에서 사용) ──────────────────
export interface Department {
  departmentId: number
  departmentName: string
}
export function getDepartments() {
  return http.get<Department[]>('/departments')
}

// ── 관리자 설정 요약 (AdminSettingsView용) ────────────────────
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
  departmentId: number | null
  title: string
  description?: string
  category?: string
  status: string
  version: string | null
  sourceUrl?: string | null
  fileUrl?: string | null
  fileUrls?: string[]
  createdBy?: number | null
  createdAt?: string
  updatedAt: string
}
export interface AdminManualVersion {
  manualVersionId: number
  manualId: number
  userId: number | null
  manualNum: string
  updateReason: string | null
  title: string | null
  description: string | null
  contentDiff: string | null
  status: string
  sourceUrl: string | null
  version: string | null
  createdAt: string
}
export interface AdminManualPage {
  content: AdminManual[]
  pageInfo: { page: number; size: number; totalElements: number; totalPages: number; hasNext: boolean; hasPrevious: boolean }
}
export function getAdminManuals(params: PageParams & { status?: string } = {}) {
  return http.get<AdminManualPage>('/admin/manuals', { params })
}
export function createAdminManual(formData: FormData) {
  return http.post<AdminManual>('/admin/manuals/pdf', formData)
}
export function updateAdminManual(manualId: number, formData: FormData) {
  return http.patch<AdminManual>(`/admin/manuals/${manualId}/pdf`, formData)
}
export function updateAdminManualMeta(manualId: number, body: {
  title?: string
  description?: string
  content?: string
  version?: string
  status?: string
  sourceUrl?: string
  updateReason?: string
  departmentId?: number | null
}) {
  return http.patch<AdminManual>(`/admin/manuals/${manualId}`, body)
}
export function getAdminManualDetail(manualId: number) {
  return http.get<AdminManual>(`/admin/manuals/${manualId}`)
}
export function getAdminManualVersions(manualId: number) {
  return http.get<AdminManualVersion[]>(`/admin/manuals/${manualId}/versions`)
}
export function deleteAdminManual(manualId: number) {
  return http.delete<void>(`/admin/manuals/${manualId}`)
}

// ── 부서 관리 (추가/삭제/수정) ──────────────────────────────────
// syncStatus: BE가 routingPrompt를 Vector Store에 반영한 상태를 나타낸다.
//   SYNCED  — 마지막 반영 성공 (syncInfo = 반영 시각)
//   PENDING — 저장됐으나 아직 Vector Store에 반영되지 않은 상태 (syncInfo = null)
//   FAILED  — Vector Store 반영 시도 실패 (syncInfo = 실패 시각)
//   EMPTY   — routingPrompt가 한 번도 등록된 적 없음 (syncInfo = null, 레이블 미표시)
export type DeptSyncStatus = 'SYNCED' | 'PENDING' | 'FAILED' | 'EMPTY'

export interface AdminDepartment {
  departmentId: number
  departmentName: string
  routingPrompt: string | null
  memberCount: number
  syncStatus: DeptSyncStatus
  syncInfo: string | null  // SYNCED/FAILED 시 날짜 문자열, 그 외 null
}
export function getAdminDepartments() {
  return http.get<AdminDepartment[]>('/admin/departments')
}
export function createAdminDepartment(body: { departmentName: string }) {
  return http.post<AdminDepartment>('/admin/departments', body)
}
export function updateAdminDepartment(departmentId: number, body: { departmentName: string }) {
  return http.patch<AdminDepartment>(`/admin/departments/${departmentId}`, body)
}
// BE가 부서명(PATCH /admin/departments/{id})과 routingPrompt(PATCH /admin/departments/{id}/routing-prompt)를
// 별도 엔드포인트로 분리해 관리하므로 함수도 분리한다.
export function updateDepartmentRoutingPrompt(departmentId: number, body: { routingPrompt: string }) {
  return http.patch<AdminDepartment>(`/admin/departments/${departmentId}/routing-prompt`, body)
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

// ── 운영 대시보드 차트 (SYSTEM_ADMIN) ─────────────────────────
export interface MonthlyTicketTrend {
  month: string
  ticketCount: number
}
export interface MonthlyAutoAssignRate {
  month: string
  totalTicketCount: number
  autoAssignedTicketCount: number
  autoAssignmentRate: number
}
export interface DeptTicketStatus {
  departmentId: number
  departmentName: string
  totalTicketCount: number
  assignedTicketCount: number
  completedTicketCount: number
}
export interface DeptAutoAssignRate {
  departmentId: number
  departmentName: string
  autoAssignmentRate: number
}

// BE 래퍼: { months: number, points: T[] }
export interface MonthlyChartResponse<T> {
  months: number
  points: T[]
}
// BE 래퍼: { departments: T[] }
export interface DeptChartResponse<T> {
  departments: T[]
}

export function getMonthlyTicketTrend(months = 6) {
  return http.get<MonthlyChartResponse<MonthlyTicketTrend>>('/admin/dashboard/monthly-ticket-trend', { params: { months } })
}
export function getMonthlyAutoAssignRate(months = 6) {
  return http.get<MonthlyChartResponse<MonthlyAutoAssignRate>>('/admin/dashboard/monthly-auto-assignment-rate', { params: { months } })
}
export function getDeptTicketStatus() {
  return http.get<DeptChartResponse<DeptTicketStatus>>('/admin/dashboard/department-ticket-status')
}
export function getDeptAutoAssignRate() {
  return http.get<DeptChartResponse<DeptAutoAssignRate>>('/admin/dashboard/department-auto-assignment-rate')
}

// ── 공통 접수 큐 (SYSTEM_ADMIN) ────────────────────────────────
// commonQueueReason: ROUTING_FAILED/ASSIGNMENT_EXPIRED → 자동 배정 실패, TRANSFER_REQUESTED → 팀 관리자 이관
export function getCommonQueueTickets(params: PageParams = {}) {
  return http.get<PageResponse<TicketResponse>>('/admin/common-queue/tickets', { params })
}
export interface CommonQueueAssignResponse {
  ticketId: number
  status: string
  assignedDepartmentId: number
  assignedDepartmentName: string
}
export function assignCommonQueueTicket(ticketId: number, body: { departmentId: number }) {
  return http.patch<CommonQueueAssignResponse>(`/admin/common-queue/tickets/${ticketId}/department`, body)
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

// ── 수기 지식 관리 ──────────────────────────────────────────────
export interface AdminDirectData {
  directDataId: number
  title: string
  content: string
  category: string | null
  isActive: boolean
  createdBy: number | null
  updatedBy: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
// page: 1-based (BasePageRequest 기반, 기본값 1)
export interface DirectDataParams {
  isActive?: boolean
  category?: string
  keyword?: string
  page?: number
  size?: number
}
export function getAdminDirectData(params: DirectDataParams = {}) {
  return http.get<PageResponse<AdminDirectData>>('/admin/direct-data', { params })
}
export function createAdminDirectData(body: { title: string; content: string; category?: string; isActive?: boolean }) {
  return http.post<AdminDirectData>('/admin/direct-data', body)
}
export function updateAdminDirectData(id: number, body: { title: string; content: string; category?: string; isActive?: boolean }) {
  return http.put<AdminDirectData>(`/admin/direct-data/${id}`, body)
}
export function deleteAdminDirectData(id: number) {
  return http.delete<void>(`/admin/direct-data/${id}`)
}
