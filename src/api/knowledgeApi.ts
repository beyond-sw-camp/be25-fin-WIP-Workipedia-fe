import http from './index'
import type { PageResponse } from '@/types/common'
import type { KnowledgeTicketCandidateResponse, KnowledgeDataResponse } from '@/types/knowledge'

// 지식화 게시판 목록 조회 — USER 권한으로 접근 가능한 공개 지식 베이스
export function getKnowledgeList(params: { page?: number; size?: number } = {}) {
  return http.get<PageResponse<KnowledgeDataResponse>>('/knowledge-data', { params })
}

// 지식화 게시판 단건 상세 조회
export function getKnowledgeDetail(id: number) {
  return http.get<KnowledgeDataResponse>(`/knowledge-data/${id}`)
}

// TEAM_ADMIN 전용 — 부서 소속 티켓 중 AI가 생성한 지식화 후보 목록
// 답변 완료 시 BE가 자동으로 AI 초안을 생성하며, TEAM_ADMIN이 검토 후 승인/반려한다.
export function getTeamKnowledgeCandidates() {
  return http.get<PageResponse<KnowledgeTicketCandidateResponse>>('/admin/team/knowledge-data/candidates')
}

// 지식화 승인 — question·answer를 함께 전송해 TEAM_ADMIN이 수정한 내용을 게시판에 반영한다.
// 승인 시 BE에서 KnowledgeData 엔티티를 생성하고 게시판에 즉시 등록한다.
export function approveKnowledgeCandidate(ticketId: number, question: string, answer: string) {
  return http.post<KnowledgeDataResponse>(`/admin/team/knowledge-data/tickets/${ticketId}/approve`, { question, answer })
}

// 지식화 반려 — 해당 후보를 삭제하고 게시판에 등록하지 않는다.
export function rejectKnowledgeCandidate(ticketId: number) {
  return http.post<void>(`/admin/team/knowledge-data/tickets/${ticketId}/reject`)
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

// 월별 지식화 승인 건수 — 부서 대시보드 차트용. months 파라미터로 조회 기간 조정 가능.
export function getKnowledgeTrend(months = 6) {
  return http.get<MonthlyTrendResponse>('/admin/team/dashboard/knowledge-trend', { params: { months } })
}

// 월별 AI 챗봇 자동 배정 티켓 건수 — 챗봇 활용도 추이를 파악하기 위한 차트용 데이터
export function getChatbotTicketTrend(months = 6) {
  return http.get<MonthlyTrendResponse>('/admin/team/dashboard/chatbot-ticket-trend', { params: { months } })
}
