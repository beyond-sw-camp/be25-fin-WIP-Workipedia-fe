import http from './index'
import type { PageParams, PageResponse } from '@/types/common'
import type {
  TicketResponse,
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
