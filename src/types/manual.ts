// BE: manual.domain.ManualStatus
export type ManualStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED'

// BE: manual.dto.ManualSummaryResponse (목록용)
export interface ManualSummaryResponse {
  manualId: number
  departmentId: number | null
  title: string
  description?: string
  status: ManualStatus
  sourceUrl: string | null
  version: string | null
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

// BE: manual.dto.ManualDetailResponse (상세 = 목록 + content 본문 + fileUrl)
export interface ManualDetailResponse extends ManualSummaryResponse {
  content: string
  fileUrl: string | null
}
