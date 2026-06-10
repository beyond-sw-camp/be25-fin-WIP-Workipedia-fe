// BE: notification.domain.NotificationType
export type NotificationType =
  | 'WORKI_ANSWER_CREATED'
  | 'WORKI_ANSWER_ACCEPTED'
  | 'TICKET_STATUS_CHANGED'
  | 'TICKET_TRANSFER_REQUESTED'
  | 'COMMON_QUEUE_ASSIGNED'
  | 'POINT_EARNED'

// BE: notification.domain.NotificationTargetType (알림 클릭 시 이동 대상)
export type NotificationTargetType =
  | 'WORKI_QUESTION'
  | 'WORKI_ANSWER'
  | 'TICKET'
  | 'KNOWLEDGE_DATA'

// BE: notification.dto.NotificationResponse
export interface NotificationResponse {
  notificationId: number
  type: NotificationType
  title: string
  message: string
  targetType: NotificationTargetType | null
  targetId: number | null
  targetUrl: string | null
  readAt: string | null // null 이면 미읽음
  createdAt: string
}

// BE: notification.dto.UnreadCountResponse
export interface UnreadCountResponse {
  unreadCount: number
}
