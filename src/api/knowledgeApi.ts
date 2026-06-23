import http from './index'
import type { PageResponse } from '@/types/common'
import type { KnowledgeTicketCandidateResponse, KnowledgeDataResponse } from '@/types/knowledge'

// 지식화 게시판 목록 조회 — USER 권한으로 접근 가능한 공개 지식 베이스
// 1-based 페이지네이션. keyword 파라미터로 질문·답변 전문 검색 가능.
export function getKnowledgeList(params: { page?: number; size?: number; keyword?: string } = {}) {
  return http.get<PageResponse<KnowledgeDataResponse>>('/knowledge-data', { params })
}

export function getKnowledgeDetail(id: number) {
  return http.get<KnowledgeDataResponse>(`/knowledge-data/${id}`)
}

// ── TEAM_ADMIN 전용 API ───────────────────────────────────────
// 승인 대기 후보 목록 (완료 티켓 중 아직 지식화되지 않은 것)
export function getTeamKnowledgeCandidates(params: { page?: number; size?: number } = {}) {
  return http.get<PageResponse<KnowledgeTicketCandidateResponse>>('/admin/team/knowledge-data/candidates', { params })
}

// 승인된 지식화 목록 (approvedAt 기준 내림차순)
export function getTeamKnowledgeList(params: { page?: number; size?: number } = {}) {
  return http.get<PageResponse<KnowledgeDataResponse>>('/admin/team/knowledge-data', { params })
}

// 지식화 승인 — question·answer를 함께 전송
export function approveKnowledgeCandidate(ticketId: number, question: string, answer: string) {
  return http.post<KnowledgeDataResponse>(`/admin/team/knowledge-data/tickets/${ticketId}/approve`, { question, answer })
}

// 지식화 반려
export function rejectKnowledgeCandidate(ticketId: number) {
  return http.post<void>(`/admin/team/knowledge-data/tickets/${ticketId}/reject`)
}

// 지식화 수정
export function updateKnowledgeData(id: number, question: string, answer: string) {
  return http.patch<KnowledgeDataResponse>(`/admin/team/knowledge-data/${id}`, { question, answer })
}

// TEAM_ADMIN 전용: BE가 호출자의 부서와 게시글 부서를 비교해 권한을 검증한다.
export function deleteKnowledgeData(id: number) {
  return http.delete<void>(`/admin/team/knowledge-data/${id}`)
}

// SYSTEM_ADMIN 전용: 부서 제한 없이 모든 게시글 삭제 가능한 별도 엔드포인트.
export function deleteKnowledgeDataAsAdmin(id: number) {
  return http.delete<void>(`/admin/knowledge-data/${id}`)
}

// ── 부서 대시보드 통계 트렌드 ────────────────────────────────────
export interface MonthlyTrendPoint {
  month: string  // "2025-12" 형식
  count: number
}

export interface MonthlyTrendResponse {
  departmentId: number
  departmentName: string
  months: number
  points: MonthlyTrendPoint[]  // 최근 N개월 슬라이딩 윈도우, 오래된 달부터 정렬
}

export function getKnowledgeTrend(months = 6) {
  return http.get<MonthlyTrendResponse>('/admin/team/dashboard/knowledge-trend', { params: { months } })
}

export function getChatbotTicketTrend(months = 6) {
  return http.get<MonthlyTrendResponse>('/admin/team/dashboard/chatbot-ticket-trend', { params: { months } })
}
