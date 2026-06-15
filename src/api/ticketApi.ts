import http from './index'
import type { PageParams, PageResponse } from '@/types/common'
import type {
  TicketResponse,
  TicketAnswerResponse,
  CreateTicketRequest,
  TicketStatus,
  TicketAssigneeRequest,
  TicketAssigneeResponse,
} from '@/types/ticket'

// 티켓 컨트롤러는 DTO를 직접 반환한다 (ApiResponse 래퍼 없음).
// 목록은 BasePageRequest 기반이라 page 는 1-based (기본 1). 작성자(@AuthenticationPrincipal)는 토큰에서 식별.

// 티켓 생성
export function createTicket(data: CreateTicketRequest) {
  return http.post<TicketResponse>('/tickets', data)
}

// 내 팀 티켓 목록 (status 필터 + 페이징, ticketId desc 고정)
export function getTickets(params: PageParams & { status?: TicketStatus } = {}) {
  return http.get<PageResponse<TicketResponse>>('/tickets', { params })
}

// 티켓 상세
export function getTicketDetail(ticketId: number) {
  return http.get<TicketResponse>(`/tickets/${ticketId}`)
}

// 티켓 상태 변경
export function changeTicketStatus(ticketId: number, status: TicketStatus) {
  return http.patch<TicketResponse>(`/tickets/${ticketId}/status`, { status })
}

// 티켓 담당자 배정 (TEAM_ADMIN)
export function assignTicket(ticketId: number, data: TicketAssigneeRequest) {
  return http.patch<TicketAssigneeResponse>(`/tickets/${ticketId}/assignee`, data)
}

// 담당 부서 공식 답변 (JSON 전송 / TODO: BE 파일 첨부 스펙 확정 후 multipart 복원)
export function answerTicket(ticketId: number, content: string, _files: File[] = []) {
  return http.post<TicketAnswerResponse>(`/tickets/${ticketId}/answers`, { content })
}

// 최신 답변 조회 (GET /tickets/{id}/answers/latest)
export function getLatestAnswer(ticketId: number) {
  return http.get<TicketAnswerResponse>(`/tickets/${ticketId}/answers/latest`)
}

// 티켓 이관 요청 → COMMON_QUEUE로 이동 (TEAM_ADMIN 전용)
export function transferTicket(ticketId: number, reason: string) {
  return http.post<TicketResponse>(`/team/tickets/${ticketId}/transfer`, { reason })
}
