// BE: point.dto.MyPointResponse
export interface MyPointResponse {
  userId: number
  currentPoint: number
}

// BE: point.dto.PointHistoryResponse
// pointAmount 가 양수면 적립, 음수면 차감.
export interface PointHistoryResponse {
  pointHistoryId: number
  pointAmount: number
  reasonType: string // 적립/차감 사유 코드 (예: ANSWER_ACCEPTED)
  relatedType: string | null
  relatedId: number | null
  createdAt: string
}
