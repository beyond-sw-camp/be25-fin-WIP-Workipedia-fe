import http from './index'
import type { ApiResponse } from './index'

interface TicketResult {
  ticketId: number
  status: string
  assignedDepartmentId: number | null
  assignedDepartmentName: string | null
  routingConfidenceScore: number
  routingDecision: string
}

export function createTicket(payload: {
  questionId: null
  sourceChatbotMessageId: number | null
  type: 'REQUEST'
  categoryId: number | null
  title: string
  content: string
}) {
  return http.post<ApiResponse<TicketResult>>('/tickets', payload)
}
