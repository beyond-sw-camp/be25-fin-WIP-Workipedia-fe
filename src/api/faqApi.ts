import http from './index'
import type { PopularWorkiResponse, FaqManualSummaryResponse } from '@/types/faq'

// FAQ 컨트롤러는 DTO 배열을 직접 반환한다 (ApiResponse 래퍼 없음). 현재 공개 API.

// 인기 워키
export function getPopularWorki() {
  return http.get<PopularWorkiResponse[]>('/faq/worki/popular')
}

// 인기 규정집
export function getPopularManuals() {
  return http.get<FaqManualSummaryResponse[]>('/faq/manuals/popular')
}

// 최신 규정집
export function getRecentManuals() {
  return http.get<FaqManualSummaryResponse[]>('/faq/manuals/recent')
}
