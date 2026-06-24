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

export function createTicketWithFiles(data: CreateTicketRequest, files: File[]) {
  const formData = new FormData()
  if (data.sourceChatbotMessageId != null) {
    formData.append('sourceChatbotMessageId', String(data.sourceChatbotMessageId))
  }
  if (data.priority) {
    formData.append('priority', data.priority)
  }
  formData.append('title', data.title)
  formData.append('content', data.content)
  files.forEach((file) => formData.append('files', file))
  return http.post<TicketResponse>('/tickets', formData)
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

// 답변 등록 — BE에서 티켓 상태를 COMPLETED로 전환하고 AI 지식화 초안을 생성한다.
// 파일 첨부 흐름: storageApi.uploadFileAndGetKey(file)로 presigned URL 업로드 후
// 반환된 objectKey를 fileKey로 전달한다. BE는 fileKey: String(단수)만 지원하므로
// 멀티파일이 필요해지면 BE의 fileKeys: List<String> 지원 이후 확장한다.
export function answerTicket(ticketId: number, content: string, fileKey?: string) {
  if (!fileKey) return http.post<TicketAnswerResponse>(`/tickets/${ticketId}/answers`, { content })
  return http.post<TicketAnswerResponse>(`/tickets/${ticketId}/answers`, { content, fileKey })
}

// 최신 답변 단건 조회 — 처리 완료 티켓 상세 다이얼로그에서 기존 답변 내용을 표시하기 위해 사용한다.
export function getLatestAnswer(ticketId: number) {
  return http.get<TicketAnswerResponse>(`/tickets/${ticketId}/answers/latest`)
}

// 이관 요청 — AI 챗봇 배정 티켓이 잘못된 부서로 왔을 때 공통 접수 큐로 돌려보내고
// SYSTEM_ADMIN이 적합한 부서로 재배정한다.
export function transferTicket(ticketId: number, reason: string) {
  return http.post<TicketResponse>(`/team/tickets/${ticketId}/transfer`, { reason })
}
