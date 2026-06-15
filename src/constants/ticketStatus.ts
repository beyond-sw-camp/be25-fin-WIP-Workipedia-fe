import type { TicketStatus } from '@/types/ticket'

// 티켓 상태별 표시 메타. 목록/상세에서 공통 사용.
// badgeClass 는 공통 CSS의 badge 클래스(green/blue/gray). 빈 문자열이면 인라인 색(반려 등) 처리.
export interface TicketStatusMeta {
  label: string
  color: string
  badgeClass: '' | 'green' | 'blue' | 'gray'
}

// 각 상태의 한글 라벨·색상·배지 클래스를 중앙 관리한다.
// TRANSFERRED: TEAM_ADMIN이 이관 요청한 뒤 SYSTEM_ADMIN이 재배정 전까지의 중간 상태
export const TICKET_STATUS_META: Record<TicketStatus, TicketStatusMeta> = {
  COMMON_QUEUE: { label: '공통 접수', color: '#aeb2bb', badgeClass: 'gray' },
  ASSIGNED: { label: '배정됨', color: '#f5c000', badgeClass: '' },
  TRANSFERRED: { label: '이관됨', color: '#f59e0b', badgeClass: '' },
  COMPLETED: { label: '완료', color: '#00a63e', badgeClass: 'green' },
  DELETED: { label: '삭제됨', color: '#aeb2bb', badgeClass: 'gray' },
}

// 목록 필터 칩에 노출할 상태(사용자에게 의미 있는 것만). '전체'는 null.
export const TICKET_FILTER_STATUSES: TicketStatus[] = [
  'COMMON_QUEUE',
  'ASSIGNED',
  'TRANSFERRED',
  'COMPLETED',
]
