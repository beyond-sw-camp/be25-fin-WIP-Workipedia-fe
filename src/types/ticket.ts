// BE: ticket.domain.TicketStatus
export type TicketStatus =
  | 'RECEIVED'
  | 'COMMON_QUEUE'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'DELETED'

// BE: ticket.domain.TicketPriority
export type TicketPriority = 'MEDIUM' | 'HIGH'

// BE: ticket.domain.RoutingDecision
export type RoutingDecision =
  | 'AUTO_ASSIGNED'
  | 'ADMIN_REVIEW'
  | 'COMMON_QUEUE'
  | 'NEED_MORE_INFO'

// BE: ticket.dto.CandidateDepartmentResponse
export interface CandidateDepartmentResponse {
  departmentId: number
  departmentName: string
  confidenceScore: number
}

// BE: ticket.dto.TicketResponse
export interface TicketResponse {
  ticketId: number
  status: TicketStatus
  assignedDepartmentId: number | null
  assignedDepartmentName: string | null // BE TODO: 부서 도메인 연결 전까지 null
  routingConfidenceScore: number | null
  routingDecision: RoutingDecision | null
  routingReasons: string[] | null
  candidateDepartments: CandidateDepartmentResponse[] | null
  sourceChatbotMessageId: number | null
  priority: TicketPriority | null
  title: string
  content: string
  assigneeId: number | null
  createdAt: string
  updatedAt: string
}

// BE: ticket.dto.CreateTicketRequest
export interface CreateTicketRequest {
  sourceChatbotMessageId?: number | null
  priority?: TicketPriority
  title: string
  content: string
}

// BE: ticket.dto.TicketStatusRequest
export interface TicketStatusRequest {
  status: TicketStatus
}

// BE: ticket.dto.TicketAssigneeRequest
export interface TicketAssigneeRequest {
  assigneeId: number
  memo?: string
}

// BE: ticket.dto.TicketAssigneeResponse
export interface TicketAssigneeResponse {
  ticketId: number
  status: TicketStatus
  priority: TicketPriority | null
  assigneeId: number | null
  assigneeNickname: string | null
}
