import http from './index'
import { useAuthStore } from '@/stores/authStore'

// 챗봇 컨트롤러(ChatbotController)는 ApiResponse 래퍼 없이 DTO를 직접 반환한다 (BE 컨벤션).
// 따라서 http 제네릭에 DTO를 바로 넣고, res.data 가 곧 결과다.
// base path: /api/v1/chatbot/sessions (VITE_API_BASE_URL 에 /api/v1 포함)

export type NextAction = 'SHOW_SOURCES' | 'CREATE_WORKI' | 'CREATE_TICKET'
export type SenderType = 'USER' | 'ASSISTANT' | 'SYSTEM'

export interface ChatbotSessionResponse {
  sessionId: number
  title: string | null
  createdAt: string
}

// referencesJson 을 파싱하면 나오는 단위.
// BE SourceItem 이 @JsonNaming(SnakeCase)로 직렬화하므로 키는 snake_case 그대로다.
// 예: { "candidate_id":"MANUAL:1:2", "source_type":"MANUAL", "source_id":"1",
//      "chunk_index":2, "title":"...", "score":0.39, "link":null }
export interface SourceItem {
  candidate_id: string
  source_type: string // 'MANUAL' | 'WORKI' | 'TICKET' | 'KNOWLEDGE_DATA' | 'CHAT' ...
  source_id: string
  chunk_index: number | null
  title: string
  score: number
  link: string | null
}

export interface ChatbotMessageResponse {
  messageId: number
  senderType: SenderType
  content: string // ASSISTANT 답변 본문
  answerable: boolean // CREATE_TICKET 이면 false
  nextAction: NextAction | null
  referencesJson: string | null // SourceItem[] 가 JSON 문자열로 직렬화되어 옴
  createdAt: string
}

// 새 세션 생성. title 은 선택값(query param). 프론트에서는 세션을 노출하지 않으므로 보통 생략한다.
export function createSession(title?: string) {
  return http.post<ChatbotSessionResponse>('/chatbot/sessions', null, {
    params: title ? { title } : undefined,
  })
}

// 질문 전송 → ASSISTANT 응답 저장 후 반환. 본문 필드명은 BE 규약상 question.
export function sendMessage(sessionId: number, question: string) {
  return http.post<ChatbotMessageResponse>(
    `/chatbot/sessions/${sessionId}/messages`,
    { question },
  )
}

// ── 스트리밍(타자 효과) ─────────────────────────────────────────────
// BE: POST /chatbot/sessions/{sessionId}/messages/stream (produces text/event-stream)
//   event: token / data: {"content":"..."}        ← 토큰 조각 (반복)
//   event: done  / data: <ChatbotMessageResponse> ← 최종 확정값 (1회)
//
// 네이티브 EventSource 는 GET 전용이라 요청 body·Authorization 헤더를 못 보낸다.
// 이 엔드포인트는 POST(+JSON body)+Bearer 인증이므로 fetch + ReadableStream 으로 직접 파싱한다.
export interface ChatbotStreamToken {
  content: string
}

export interface StreamHandlers {
  onToken: (content: string) => void          // token 이벤트마다 호출 (글자 출력용)
  onDone: (message: ChatbotMessageResponse) => void  // done 이벤트 1회 (최종 확정값)
  onError?: (err: unknown) => void
}

export async function streamMessage(
  sessionId: number,
  question: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const auth = useAuthStore()
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/chatbot/sessions/${sessionId}/messages/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      },
      body: JSON.stringify({ question }),
      credentials: 'include',
      signal,
    },
  )
  if (!res.ok || !res.body) {
    throw new Error(`챗봇 스트림 요청 실패: ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  // SSE 프레임은 빈 줄(\n\n)로 구분되고, 각 프레임은 event:/data: 라인으로 구성된다.
  // CRLF(\r\n) 로 올 수도 있어 LF 로 정규화한 뒤 처리한다.
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      dispatchFrame(frame, handlers)
    }
  }
}

// SSE 프레임 1건을 파싱해 token/done 핸들러로 분기한다.
function dispatchFrame(frame: string, handlers: StreamHandlers) {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue // 주석/heartbeat 무시
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
  }
  if (dataLines.length === 0) return
  const data = dataLines.join('\n')

  if (event === 'token') {
    try {
      const { content } = JSON.parse(data) as ChatbotStreamToken
      if (content) handlers.onToken(content)
    } catch {
      /* 깨진 토큰 프레임은 무시 */
    }
  } else if (event === 'done') {
    try {
      handlers.onDone(JSON.parse(data) as ChatbotMessageResponse)
    } catch (e) {
      handlers.onError?.(e)
    }
  }
}

// referencesJson(문자열)을 SourceItem[] 로 파싱한다. null/파싱 실패 시 빈 배열.
export function parseReferences(referencesJson: string | null): SourceItem[] {
  if (!referencesJson) return []
  try {
    const parsed = JSON.parse(referencesJson)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
