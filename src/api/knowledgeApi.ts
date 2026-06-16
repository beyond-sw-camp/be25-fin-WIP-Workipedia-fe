import http from './index'
import type { PageResponse } from '@/types/common'
import type { KnowledgeDataResponse } from '@/types/knowledge'

// GET /knowledge-data — 승인된 지식 목록 (1-based page)
export function getKnowledgeList(params: { page?: number; size?: number } = {}) {
  return http.get<PageResponse<KnowledgeDataResponse>>('/knowledge-data', { params })
}

// GET /knowledge-data/{id} — 지식 상세
export function getKnowledgeDetail(id: number) {
  return http.get<KnowledgeDataResponse>(`/knowledge-data/${id}`)
}
