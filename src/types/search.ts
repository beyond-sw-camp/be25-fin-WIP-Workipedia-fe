import type { PageResponse } from '@/types/common'
import type { WorkiSearchResponse } from '@/types/worki'
import type { ManualStatus } from '@/types/manual'

// BE: search.dto.ManualSearchResponse
// 본문(content)은 응답에 없고 제목·메타데이터만 내려준다.
export interface ManualSearchResponse {
  manualId: number
  title: string
  status: ManualStatus
  departmentId: number | null
  version: string
  createdAt: string
}

// BE: search.dto.IntegratedSearchResponse
// 워키(ES) + 매뉴얼(DB)을 도메인별로 분리해 담는다.
// 각 도메인 pageInfo.totalElements 로 "워키 N건 / 매뉴얼 N건"을 표시할 수 있다.
export interface IntegratedSearchResponse {
  worki: PageResponse<WorkiSearchResponse>
  manuals: PageResponse<ManualSearchResponse>
}
