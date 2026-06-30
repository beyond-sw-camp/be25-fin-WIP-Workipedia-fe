import http from './index'
import type { PageParams, PageResponse } from '@/types/common'
import type { ManualSummaryResponse, ManualDetailResponse } from '@/types/manual'

// 규정집 컨트롤러는 DTO를 직접 반환한다 (ApiResponse 래퍼 없음).
// 목록은 BasePageRequest 기반이라 page 는 1-based (기본 1, size 기본 10).
// 일반 사용자는 PUBLISHED 규정집만 조회된다.

export type ManualSortType = 'RECENTLY_UPDATED' | 'RECENTLY_CREATED'

export interface ManualListParams extends PageParams {
  sortType?: ManualSortType
}

// 규정집 목록 (페이징)
export function getManuals(params: ManualListParams = {}) {
  return http.get<PageResponse<ManualSummaryResponse>>('/manuals', { params })
}

// 규정집 상세 (본문 content 포함)
export function getManualDetail(manualId: number) {
  return http.get<ManualDetailResponse>(`/manuals/${manualId}`)
}
