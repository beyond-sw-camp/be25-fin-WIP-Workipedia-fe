import http from './index'
import { useAuthStore } from '@/stores/authStore'
import type {
  Page,
  PageParams,
  SearchPage,
  WorkiSearchResponse,
  QuestionCreateRequest,
  QuestionUpdateRequest,
  QuestionResponse,
  QuestionSummaryResponse,
  QuestionDetailResponse,
  AnswerCreateRequest,
  AnswerResponse,
} from '@/types/worki'

// worki 컨트롤러는 ApiResponse 래퍼 없이 DTO를 직접 반환한다 (BE 컨벤션).
// 따라서 http 제네릭에 DTO를 바로 넣고, res.data 가 곧 결과다.

// BE 쓰기 API는 현재 @RequestHeader("X-User-Id") 로 작성자를 받는다.
// TODO: BE 시큐리티 통합 후 Bearer 토큰에서 식별하도록 바뀌면 이 헤더 제거.
function actorHeader() {
  const auth = useAuthStore()
  return { headers: { 'X-User-Id': auth.userId ?? '' } }
}

// ===== 질문(Question) =====

// 질문 생성
export function createQuestion(data: QuestionCreateRequest) {
  return http.post<QuestionResponse>('/worki/questions', data, actorHeader())
}

// 질문 목록 (페이징)
export function getQuestions(params: PageParams = {}) {
  return http.get<Page<QuestionSummaryResponse>>('/worki/questions', { params })
}

// 질문 상세
export function getQuestionDetail(questionId: number) {
  return http.get<QuestionDetailResponse>(`/worki/questions/${questionId}`)
}

// 질문 키워드 검색 (Elasticsearch). BE는 keyword 2~100자만 허용한다.
// 응답은 목록과 달리 PageResponse(pageInfo 중첩) 형태다.
export function searchQuestions(keyword: string, params: PageParams = {}) {
  return http.get<SearchPage<WorkiSearchResponse>>('/search/worki', {
    params: { keyword, ...params },
  })
}

// 검색어 자동완성 (worki_search_keywords 누적 기반)
export function autocompleteQuestions(keyword: string) {
  return http.get<string[]>('/search/worki/autocomplete', { params: { keyword } })
}

// 질문 수정
export function updateQuestion(questionId: number, data: QuestionUpdateRequest) {
  return http.patch<QuestionResponse>(`/worki/questions/${questionId}`, data, actorHeader())
}

// 좋아요 등록
export function likeQuestion(questionId: number) {
  return http.post<void>(`/worki/questions/${questionId}/like`, null, actorHeader())
}

// 좋아요 취소
export function unlikeQuestion(questionId: number) {
  return http.delete<void>(`/worki/questions/${questionId}/like`, actorHeader())
}

// ===== 답변(Answer) =====

// 답변 생성
export function createAnswer(questionId: number, data: AnswerCreateRequest) {
  return http.post<AnswerResponse>(
    `/worki/questions/${questionId}/answers`,
    data,
    actorHeader(),
  )
}

// 답변 채택
export function acceptAnswer(answerId: number) {
  return http.post<AnswerResponse>(`/worki/answers/${answerId}/accept`, null, actorHeader())
}
