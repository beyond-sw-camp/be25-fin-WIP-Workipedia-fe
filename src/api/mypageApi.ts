import http from './index'
import type { PageParams, PageResponse } from '@/types/common'
import type {
  MyProfileResponse,
  MyTicketStatusFilter,
  MyTicketResponse,
  MyTicketDetailResponse,
  NotificationSettings,
} from '@/types/mypage'

// 프로필 + 포인트 + ESG + 알림설정 + 티켓수 통합 조회
export function getMyProfile() {
  return http.get<MyProfileResponse>('/me/profile')
}

// 내 발행 티켓 목록 (status: WAITING | COMPLETED, 0-based page — Spring Pageable)
export function getMyTickets(params: PageParams & { status: MyTicketStatusFilter }) {
  return http.get<PageResponse<MyTicketResponse>>('/me/tickets', { params })
}

// 내 발행 티켓 상세 (answer 포함)
export function getMyTicketDetail(ticketId: number) {
  return http.get<MyTicketDetailResponse>(`/me/tickets/${ticketId}`)
}

// 알림 설정 저장
export function updateNotificationSettings(data: NotificationSettings) {
  return http.patch<void>('/me/notification-settings', data)
}
