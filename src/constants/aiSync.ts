// 기타 지식 데이터(KNOWLEDGE_DATA, MANUAL_KNOWLEDGE) 동기화 탭에서 쓰는 표시 상수

export const KNOWLEDGE_SYNC_SOURCE_TYPES = [
  { label: '팀 승인 지식', value: 'KNOWLEDGE_DATA' },
  { label: '시스템 수기 지식', value: 'MANUAL_KNOWLEDGE' },
] as const

export const AI_SYNC_STATUS_LABELS = {
  PENDING: '대기 중',
  PROCESSING: '처리 중',
  SYNCED: '완료',
  FAILED: '실패',
} as const

export const AI_SYNC_OPERATION_LABELS = {
  UPSERT: '등록/수정',
  DELETE: '삭제',
} as const
