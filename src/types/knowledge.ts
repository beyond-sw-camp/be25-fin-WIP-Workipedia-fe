// BE: knowledge.dto.KnowledgeBoardResponse (게시판 목록/상세)
// ticketId·approvedBy 는 게시판 엔드포인트 응답에 포함되지 않을 수 있어 optional.
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
