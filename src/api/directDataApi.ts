import http from './index'
import type { PageResponse } from '@/types/common'

// 수기 지식 게시판 (일반 사용자용) — SYSTEM_ADMIN이 직접 작성·활성화한 지식 문서를 제공한다.
// BE는 isActive=Y 항목만 내려보내므로 응답 DTO에 isActive 필드가 없다.
// 관리자용 CRUD는 src/api/adminApi.ts의 AdminDirectData 섹션에서 분리 관리한다.
// page: 1-based (BasePageRequest 기반, 기본값 1)
export interface DirectDataResponse {
  directDataId: number
  title: string
  content: string
  category: string | null
  createdAt: string
  updatedAt: string
}

export interface DirectDataListParams {
  category?: string
  keyword?: string
  page?: number
  size?: number
}

export function getDirectDataList(params: DirectDataListParams = {}) {
  return http.get<PageResponse<DirectDataResponse>>('/direct-data', { params })
}

export function getDirectDataDetail(id: number) {
  return http.get<DirectDataResponse>(`/direct-data/${id}`)
}
