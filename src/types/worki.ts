// BE: com.wip.workipedia.worki.domain.QuestionStatus
export type QuestionStatus =
  | 'WAITING' // 답변 대기
  | 'IN_PROGRESS' // 답변 진행
  | 'ANSWERED' // 채택 완료
  | 'TICKETED' // 티켓 전환
  | 'DELETED' // 관리자 삭제 처리

// Spring Data Page<T> 응답 형태. 여러 도메인에서 공통으로 쓰이면 추후 공통 타입으로 분리.
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number // 현재 페이지 (0-based)
  size: number
  first: boolean
  last: boolean
  numberOfElements: number
  empty: boolean
}

export interface PageParams {
  page?: number
  size?: number
  sort?: string // 예: 'createdAt,desc'
}

// ===== 질문(Question) =====

export interface QuestionCreateRequest {
  title: string
  content: string
  sourceChatbotMessageId?: number | null
}

export interface QuestionUpdateRequest {
  title: string
  content: string
}

export interface QuestionResponse {
  questionId: number
  authorId: number
  title: string
  status: QuestionStatus
  authorNickname: string | null // BE 유저 도메인 통합 전까지 null
}

export interface QuestionSummaryResponse {
  questionId: number
  authorId: number
  title: string
  status: QuestionStatus
  viewCount: number
  createdAt: string // ISO LocalDateTime
}

export interface QuestionDetailResponse {
  questionId: number
  authorId: number
  title: string
  content: string
  status: QuestionStatus
  acceptedAnswerId: number | null
  viewCount: number
  createdAt: string
  updatedAt: string
  answers: AnswerResponse[]
}

// ===== 답변(Answer) =====

export interface AnswerCreateRequest {
  content: string
}

export interface AnswerResponse {
  answerId: number
  questionId: number
  authorId: number
  content: string
  accepted: boolean
  official: boolean
  acceptedAt: string | null
  createdAt: string
}
