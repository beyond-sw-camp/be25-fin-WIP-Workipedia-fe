// 알림 실시간 스트림(SSE). BE: GET /notifications/stream (api-contract Phase 2)
// EventSource 는 커스텀 헤더를 보낼 수 없어 Bearer 토큰을 쿼리 파라미터로 전달한다.
// (쿠키 기반 인증을 위해 withCredentials 도 함께 켠다.)
const BASE = import.meta.env.VITE_API_BASE_URL

export function openNotificationStream(token: string): EventSource {
  const url = `${BASE}/notifications/stream?token=${encodeURIComponent(token)}`
  return new EventSource(url, { withCredentials: true })
}
