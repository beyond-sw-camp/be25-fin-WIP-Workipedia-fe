import http from './index'
import type { PageParams, PageResponse } from '@/types/common'
import type { IntegratedSearchResponse, ManualSearchResponse } from '@/types/search'
import type { WorkiSearchResponse } from '@/types/worki'

// 검색 컨트롤러(/search)는 DTO를 직접 반환한다 (ApiResponse 래퍼 없음).
// 검색 API는 Spring Pageable 기반이라 page 는 0-based (기본 0). keyword 는 2~100자만 허용.

// 통합 검색 (워키 + 규정집). 도메인별 미리보기 size 만큼 반환한다 (page 0 고정).
// 예) GET /search?keyword=휴가&size=5
export function searchIntegrated(keyword: string, size = 5) {
  return http.get<IntegratedSearchResponse>('/search', {
    params: { keyword, size },
  })
}

// 워키 질문 검색 (Elasticsearch). 도메인별 더보기/페이징용.
export function searchWorki(keyword: string, params: PageParams = {}) {
  return http.get<PageResponse<WorkiSearchResponse>>('/search/worki', {
    params: { keyword, ...params },
  })
}

// 규정집 검색 (DB). 도메인별 더보기/페이징용.
export function searchManuals(keyword: string, params: PageParams = {}) {
  return http.get<PageResponse<ManualSearchResponse>>('/search/manuals', {
    params: { keyword, ...params },
  })
}

// 검색어 자동완성 (worki_search_keywords 누적 기반)
export function autocompleteSearch(keyword: string) {
  return http.get<string[]>('/search/worki/autocomplete', { params: { keyword } })
}
