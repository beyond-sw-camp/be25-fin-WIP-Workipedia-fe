import type { TicketStatus } from './ticket'

// GET /me/profile 응답 (nested 구조)
export interface MyProfileResponse {
  user: {
    userId: number
    nickname: string
    role: string
    status: string
  }
  ticket: {
    createdTicketCount: number
  }
  point: {
    currentPoint: number
    esgScore: number
  }
  notificationSettings: NotificationSettings
}

// PATCH /me/notification-settings 요청 & GET /me/profile 안 notificationSettings 공유
export interface NotificationSettings {
  allEnabled: boolean
  ticketEnabled: boolean
  workiEnabled: boolean
  manualEnabled: boolean
}

// /me/tickets?status= 쿼리 파라미터 값 (TicketStatus enum과 별도)
export type MyTicketStatusFilter = 'WAITING' | 'COMPLETED'

// 목록 응답
export interface MyTicketResponse {
  ticketId: number
  status: TicketStatus
  title: string
  assignedDepartmentName: string | null
  createdAt: string
}

// 상세 응답
export interface MyTicketDetailResponse extends MyTicketResponse {
  content: string
  answer: MyTicketAnswer | null
  completedAt: string | null
}

export interface MyTicketAnswer {
  content: string
  answeredAt: string
  authorNickname: string | null
}
