// BE: faq.dto.PopularWorkiResponse (인기 워키)
export interface PopularWorkiResponse {
  questionId: number
  title: string
  likeCount: number
  viewCount: number
  createdAt: string
}

// BE: faq.dto.ManualSummaryResponse (인기/최신 규정집 — manual 패키지의 것과 필드가 다름)
export interface FaqManualSummaryResponse {
  manualId: number
  title: string
  departmentId: number | null
  citationCount: number // 인용/참조 횟수 (최신 규정집은 0)
  createdAt: string
}
