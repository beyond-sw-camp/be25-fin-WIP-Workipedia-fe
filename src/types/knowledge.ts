import type { TicketFileInfo } from './ticket'

// BE: KnowledgeTicketCandidateResponse
// 답변 완료 티켓을 기반으로 AI가 생성한 지식화 후보. TEAM_ADMIN 승인 대기 상태.
export interface KnowledgeTicketCandidateResponse {
  ticketId: number
  departmentId: number
  question: string
  answer: string
  answerId: number
  answerAuthorId: number
  completedAt: string
  answeredAt: string
  fileUrl?: string | null
  files?: TicketFileInfo[]
}

// BE: KnowledgeDataResponse
// 사용자 목록/상세 응답: knowledgeDataId, departmentId, departmentName, question, answer, approvedAt, createdAt, updatedAt
// 관리자 응답 추가 필드: ticketId, approvedBy (optional로 통합)
export interface KnowledgeDataResponse {
  knowledgeDataId: number
  ticketId?: number
  departmentId: number
  departmentName: string | null
  question: string
  answer: string
  approvedBy?: number
  approvedAt: string
  createdAt: string
  updatedAt: string
  fileUrl?: string | null
  files?: TicketFileInfo[]
}
