// BE: notification.domain.NotificationType
// 각 타입에 대응하는 FE 표준 제목은 NotificationPanel.vue의 NOTIFICATION_TITLES 맵에서 관리한다.
export type NotificationType =
  | 'TICKET_ASSIGNED'
  | 'TICKET_REASSIGNED'
  | 'TICKET_COMPLETED'
  | 'TICKET_DELETED'
  | 'WORKI_QUESTION_CREATED'
  | 'WORKI_QUESTION_ANSWERED'
  | 'WORKI_ANSWER_ACCEPTED'
  | 'MANUAL_UPDATED'
  | 'DIRECT_DATA_ACTIVATED'

// BE: notification.domain.NotificationTargetType (알림 클릭 시 이동 대상)
// targetUrl이 FE 라우트와 맞지 않는 경우: DIRECT_DATA → `/direct-data/{id}` 경로 없음 (홈으로 fallback)
export type NotificationTargetType =
  | 'TICKET'
  | 'WORKI_QUESTION'
  | 'WORKI_ANSWER'
  | 'MANUAL'
  | 'DIRECT_DATA'

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

// GET /notifications?tab=TICKET 서버 필터 파라미터.
// Panel은 최신 20개 client-side 탭 필터로 충분하나, 향후 전체 목록 뷰 추가 시 사용한다.
export type NotificationTab = 'TICKET' | 'WORKI' | 'MANUAL'

export interface NotificationListParams {
  page?: number
  size?: number
  tab?: NotificationTab
}
