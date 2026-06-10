import type { TicketStatus } from '@/types/ticket'

// 티켓 상태별 표시 메타. 목록/상세에서 공통 사용.
// badgeClass 는 공통 CSS의 badge 클래스(green/blue/gray). 빈 문자열이면 인라인 색(반려 등) 처리.
export interface TicketStatusMeta {
  label: string
  color: string
  badgeClass: '' | 'green' | 'blue' | 'gray'
}

export const TICKET_STATUS_META: Record<TicketStatus, TicketStatusMeta> = {
  RECEIVED: { label: '접수', color: '#aeb2bb', badgeClass: 'gray' },
  COMMON_QUEUE: { label: '공통 접수', color: '#aeb2bb', badgeClass: 'gray' },
  ASSIGNED: { label: '배정됨', color: '#f5c000', badgeClass: '' },
  IN_PROGRESS: { label: '처리중', color: '#2b7fff', badgeClass: 'blue' },
  COMPLETED: { label: '완료', color: '#00a63e', badgeClass: 'green' },
  REJECTED: { label: '반려', color: '#ef4444', badgeClass: '' },
  DELETED: { label: '삭제됨', color: '#aeb2bb', badgeClass: 'gray' },
}

// 목록 필터 칩에 노출할 상태(사용자에게 의미 있는 것만). '전체'는 null.
export const TICKET_FILTER_STATUSES: TicketStatus[] = [
  'RECEIVED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
]
