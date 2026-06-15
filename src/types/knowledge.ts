// BE: admin.team.knowledge.dto.KnowledgeTicketCandidateResponse
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
}

// BE: knowledge.dto.KnowledgeBoardResponse (게시판 목록/상세)
// ticketId·approvedBy는 게시판 응답(KnowledgeBoardResponse)에 포함되지 않을 수 있어 optional로 선언한다.
// 승인 API 응답(KnowledgeDataResponse)에는 포함되므로 타입을 분리하지 않고 optional로 통합한다.
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
}
