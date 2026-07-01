export type RecommendedChatbotQuestionMode = 'question' | 'request'

export interface RecommendedChatbotQuestion {
  mode: RecommendedChatbotQuestionMode
  text: string
}

// Demo suggestions are kept in one place so they can be replaced later by
// admin-managed settings or a DB-backed recommendation API.
export const RECOMMENDED_CHATBOT_QUESTIONS: RecommendedChatbotQuestion[] = [
  { mode: 'question', text: '사내 VPN 접속 방법 알려줘' },
  { mode: 'question', text: '프린터 드라이버 설치 방법 알려줘' },
  { mode: 'question', text: 'OTP를 분실했을 때 어떻게 해야 해?' },
  { mode: 'question', text: 'ERP 로그인이 안 될 때 확인할 항목 알려줘' },
  { mode: 'question', text: '비밀번호 초기화는 어디에서 신청해?' },
  { mode: 'question', text: '연차 신청은 어디에서 하나요?' },
  { mode: 'question', text: '반차를 당일에 신청할 수 있나요?' },
  { mode: 'question', text: '재택근무 신청 기준이 궁금해' },
  { mode: 'question', text: '법인카드 영수증 제출 기한은 언제야?' },
  { mode: 'question', text: '출장비 정산에는 어떤 증빙이 필요해?' },
  { mode: 'question', text: '회의실 예약 취소는 언제까지 가능해?' },
  { mode: 'question', text: '출입증을 잃어버렸을 때 어떻게 해야 해?' },
  { mode: 'question', text: '사무용품 신청은 어디에서 해?' },
  { mode: 'question', text: 'CRM 리드 소유권은 어떻게 변경해?' },
  { mode: 'question', text: '제안서 템플릿 최신본은 어디에 있어?' },
  { mode: 'question', text: '데이터 추출 요청은 어떤 양식으로 올려?' },
  { mode: 'question', text: '배치 실패 알림을 받으려면 어떻게 해야 해?' },
  { mode: 'question', text: '개인정보가 포함된 파일은 어떻게 공유해야 해?' },
  { mode: 'question', text: '운영 배포 승인자는 누구야?' },
  { mode: 'question', text: '릴리즈 노트 작성 기준이 있어?' },
  { mode: 'question', text: '장애 공지는 어디에 등록해?' },
  { mode: 'question', text: '매뉴얼 수정 요청은 누가 승인해?' },
  { mode: 'question', text: '워키 답변 채택 후에도 공식 답변을 달 수 있어?' },
  { mode: 'question', text: '포인트는 어떤 활동에서 적립돼?' },
]
