import http from './index'
import type { PageParams, PageResponse } from '@/types/common'
import type { NotificationResponse, UnreadCountResponse } from '@/types/notification'

// 알림 컨트롤러는 DTO를 직접 반환한다 (ApiResponse 래퍼 없음). res.data 가 곧 결과.
// 목록은 Spring Pageable 기반이라 page 는 0-based.

// 알림 목록 (페이징)
export function getNotifications(params: PageParams = {}) {
  return http.get<PageResponse<NotificationResponse>>('/notifications', { params })
}

// 안읽음 개수
export function getUnreadCount() {
  return http.get<UnreadCountResponse>('/notifications/unread-count')
}

// 단건 읽음
export function markNotificationRead(notificationId: number) {
  return http.patch<void>(`/notifications/${notificationId}/read`)
}

// 전체 읽음
export function markAllNotificationsRead() {
  return http.patch<void>('/notifications/read-all')
}

// 알림 삭제
export function deleteNotification(notificationId: number) {
  return http.delete<void>(`/notifications/${notificationId}`)
}
