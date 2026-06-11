import http from './index'
import type { PageParams, PageResponse } from '@/types/common'
import type { MyPointResponse, PointHistoryResponse } from '@/types/point'
import type { EsgResponse, EsgLeaderboardPageResponse } from '@/types/esg'

// 포인트/ESG 컨트롤러는 DTO를 직접 반환한다 (ApiResponse 래퍼 없음). 사용자는 토큰에서 식별.
// 포인트 이력은 Spring Pageable 기반이라 page 는 0-based.

// 내 포인트 (보유 포인트)
export function getMyPoint() {
  return http.get<MyPointResponse>('/points/me')
}

// 포인트 변동 이력 (페이징)
export function getPointHistories(params: PageParams = {}) {
  return http.get<PageResponse<PointHistoryResponse>>('/points/histories', { params })
}

// 내 ESG 등급
export function getMyEsg() {
  return http.get<EsgResponse>('/esg/me')
}

// ESG 리더보드 (상위 랭커 + 내 순위)
export function getEsgLeaderboard() {
  return http.get<EsgLeaderboardPageResponse>('/esg/leaderboard')
}
